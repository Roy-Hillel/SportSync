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

    const summary = buildSummary(event);
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
      // SEQUENCE tells calendar clients this event has been updated.
      // lastFetchedAt is a monotonically increasing timestamp — converting
      // to seconds gives an integer that increments on every sync write.
      sequence: Math.floor(event.lastFetchedAt.getTime() / 1000),
      url: undefined,
    });
  }

  return cal.toString();
}

function buildDescription(event: SportEventRow): string {
  const lines: string[] = [event.competitionName];
  if (event.venue) lines.push(`Venue: ${event.venue}`);
  if (
    event.status === "closed" &&
    event.homeScore != null &&
    event.awayScore != null
  ) {
    lines.push(`Final score: ${event.homeScore}–${event.awayScore}`);
  } else if (event.status !== "scheduled") {
    lines.push(`Status: ${event.status.toUpperCase()}`);
  }
  return lines.join("\n");
}

/**
 * Build the iCal event summary (title).
 *
 * Post-match (status === 'closed' with scores available):
 *   "Real Madrid 3–1 Barcelona"
 *
 * All other states (pre-match, live, postponed, etc.):
 *   "Real Madrid vs Barcelona"
 *
 * The en-dash (–) is used as the score separator per locked decision.
 */
function buildSummary(event: SportEventRow): string {
  if (
    event.status === "closed" &&
    event.homeScore != null &&
    event.awayScore != null
  ) {
    return `${event.homeTeamName} ${event.homeScore}–${event.awayScore} ${event.awayTeamName}`;
  }
  return `${event.homeTeamName} vs ${event.awayTeamName}`;
}
