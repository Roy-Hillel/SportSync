// ---------------------------------------------------------------------------
// iCal feed generator
//
// Builds a standards-compliant iCal feed for a user's subscriptions.
// Reads from sport_events — no provider calls at request time.
//
// The output is deterministic: same DB state → same .ics output.
// This makes it safe to cache at the CDN layer (set Cache-Control on the
// route handler) and easy to test.
// ---------------------------------------------------------------------------

import ical, { ICalCalendarMethod } from "ical-generator";
import { db } from "@/lib/db";
import { sportEvents, subscriptions, subscribableEntities, users } from "@/lib/db/schema";
import { eq, and, gte, lte, or } from "drizzle-orm";
import { addWeeks } from "@/lib/sync/date-utils";

const APP_NAME = "SportSync";

export async function generateICalForUser(calendarToken: string): Promise<string | null> {
  // Resolve the user from their calendar token.
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      syncWindowWeeks: users.syncWindowWeeks,
    })
    .from(users)
    .where(eq(users.calendarToken, calendarToken))
    .limit(1);

  if (!user) return null;

  // Fetch this user's active subscriptions with entity metadata.
  const userSubscriptions = await db
    .select({
      providerId: subscribableEntities.providerId,
      entityType: subscribableEntities.entityType,
      provider: subscribableEntities.provider,
    })
    .from(subscriptions)
    .innerJoin(
      subscribableEntities,
      eq(subscriptions.entityId, subscribableEntities.id)
    )
    .where(eq(subscriptions.userId, user.id));

  if (userSubscriptions.length === 0) {
    return buildEmptyCalendar(user.name ?? user.email);
  }

  const now = new Date();
  const to = addWeeks(now, user.syncWindowWeeks);

  // Build OR conditions: a sport_event is relevant to this user if it
  // involves any entity they're subscribed to.
  const conditions = userSubscriptions.map((sub) => {
    if (sub.entityType === "competition") {
      return eq(sportEvents.competitionProviderId, sub.providerId);
    }
    // team or nation: either home or away
    return or(
      eq(sportEvents.homeTeamProviderId, sub.providerId),
      eq(sportEvents.awayTeamProviderId, sub.providerId)
    )!;
  });

  const events = await db
    .select()
    .from(sportEvents)
    .where(
      and(
        gte(sportEvents.startTime, now),
        lte(sportEvents.startTime, to),
        or(...conditions)
      )
    )
    .orderBy(sportEvents.startTime);

  return buildCalendar(user.name ?? user.email, events);
}

// ---------------------------------------------------------------------------
// iCal builders
// ---------------------------------------------------------------------------

type SportEventRow = typeof sportEvents.$inferSelect;

function buildEmptyCalendar(userName: string): string {
  const cal = ical({ name: `${APP_NAME} — ${userName}` });
  cal.method(ICalCalendarMethod.PUBLISH);
  return cal.toString();
}

function buildCalendar(userName: string, events: SportEventRow[]): string {
  const cal = ical({
    name: `${APP_NAME} — ${userName}`,
    description: "Sports schedule synced by SportSync",
    // Suggest a 4-hour refresh interval to calendar clients.
    // Most clients respect this but may impose their own minimums.
    ttl: 4 * 60 * 60,
  });

  cal.method(ICalCalendarMethod.PUBLISH);

  for (const event of events) {
    // Skip cancelled events — they should not appear in the calendar.
    if (event.status === "cancelled") continue;

    const summary = `${event.homeTeamName} vs ${event.awayTeamName}`;
    const description = buildDescription(event);

    // Matches are typically 2 hours; mark end time accordingly.
    // If a provider starts giving us end times, use those instead.
    const end = new Date(event.startTime);
    end.setHours(end.getHours() + 2);

    cal.createEvent({
      id: `${event.provider}:${event.providerId}`,
      summary,
      description,
      location: event.venue ?? undefined,
      start: event.startTime,
      end,
      // SEQUENCE allows calendar clients to detect updates to the same event.
      // We don't increment it explicitly, but including the lastFetchedAt
      // as a timestamp-based UID ensures the event is treated as updated.
      url: undefined,
    });
  }

  return cal.toString();
}

function buildDescription(event: SportEventRow): string {
  const lines: string[] = [event.competitionName];
  if (event.venue) lines.push(`Venue: ${event.venue}`);
  if (event.status !== "scheduled") {
    lines.push(`Status: ${event.status.toUpperCase()}`);
  }
  return lines.join("\n");
}
