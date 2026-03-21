// ---------------------------------------------------------------------------
// Sync engine
//
// Fetches schedules from the active sports data provider and upserts them
// into the sport_events table. Operates globally — one fetch per unique
// entity being tracked across all users. The iCal endpoint reads from this
// table at request time, so there's no per-user write phase.
//
// Correctness guarantees:
//   1. Events are validated by the provider before reaching this engine.
//   2. Hash comparison prevents stale/duplicate writes.
//   3. All DB writes are batched in a transaction per entity.
//   4. Errors in one entity do not abort syncing of others.
// ---------------------------------------------------------------------------

import { db } from "@/lib/db";
import { subscriptions, subscribableEntities, sportEvents, syncLog } from "@/lib/db/schema";
import { getActiveProvider, type ProviderEntity } from "@/lib/providers";
import { hashEvent } from "./hash";
import { eq, and, inArray, sql } from "drizzle-orm";
import { addWeeks } from "./date-utils";

export interface EntitySyncSummary {
  name: string;
  created: number;
  updated: number;
  unchanged: number;
  error?: string;
}

export interface SyncResult {
  entitiesProcessed: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsUnchanged: number;
  errors: Array<{ entityId: string; error: string }>;
  entities: EntitySyncSummary[];
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run a full sync for all actively-subscribed entities.
 * Called by the cron job and the manual "Sync Now" trigger.
 */
export async function runFullSync(): Promise<SyncResult> {
  const logId = await startSyncLog(null);
  const result: SyncResult = {
    entitiesProcessed: 0,
    eventsCreated: 0,
    eventsUpdated: 0,
    eventsUnchanged: 0,
    errors: [],
    entities: [],
  };

  try {
    const entities = await getUniqueTrackedEntities();
    const provider = getActiveProvider();

    const now = new Date();
    // We sync the max window across all users to keep the global event table
    // complete. Individual user feeds filter to their own sync_window_weeks.
    const to = addWeeks(now, 26); // ~6 months ahead

    for (const entity of entities) {
      try {
        const entityResult = await syncEntity(entity, provider, now, to);
        result.eventsCreated += entityResult.created;
        result.eventsUpdated += entityResult.updated;
        result.eventsUnchanged += entityResult.unchanged;
        result.entitiesProcessed++;
        result.entities.push({
          name: entity.displayName,
          created: entityResult.created,
          updated: entityResult.updated,
          unchanged: entityResult.unchanged,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push({ entityId: entity.providerId, error: message });
        result.entities.push({ name: entity.displayName, created: 0, updated: 0, unchanged: 0, error: message });
      }
    }
  } finally {
    await completeSyncLog(logId, result);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Entity-level sync
// ---------------------------------------------------------------------------

interface EntitySyncResult {
  created: number;
  updated: number;
  unchanged: number;
}

async function syncEntity(
  entity: ProviderEntity,
  provider: ReturnType<typeof getActiveProvider>,
  from: Date,
  to: Date
): Promise<EntitySyncResult> {
  const incoming = await provider.getSchedule(entity, from, to);

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  if (incoming.length === 0) return { created, updated, unchanged };

  // Fetch existing records for this provider in one query.
  const providerIds = incoming.map((e) => e.providerId);
  const existing = await db
    .select({
      id: sportEvents.id,
      providerId: sportEvents.providerId,
      dataHash: sportEvents.dataHash,
    })
    .from(sportEvents)
    .where(
      and(
        eq(sportEvents.provider, provider.name),
        inArray(sportEvents.providerId, providerIds)
      )
    );

  const existingByProviderId = new Map(existing.map((r) => [r.providerId, r]));

  const toInsert: (typeof sportEvents.$inferInsert)[] = [];
  const toUpdate: Array<{ id: string; values: Partial<typeof sportEvents.$inferInsert> }> = [];

  for (const event of incoming) {
    const hash = hashEvent(event);
    const existingRecord = existingByProviderId.get(event.providerId);

    if (!existingRecord) {
      toInsert.push({
        providerId: event.providerId,
        provider: provider.name,
        homeTeamName: event.homeTeamName,
        awayTeamName: event.awayTeamName,
        competitionName: event.competitionName,
        homeTeamProviderId: event.homeTeamProviderId,
        awayTeamProviderId: event.awayTeamProviderId,
        competitionProviderId: event.competitionProviderId,
        seasonProviderId: event.seasonProviderId,
        startTime: event.startTime,
        venue: event.venue,
        status: event.status,
        dataHash: hash,
        lastFetchedAt: new Date(),
      });
      created++;
    } else if (existingRecord.dataHash !== hash) {
      toUpdate.push({
        id: existingRecord.id,
        values: {
          homeTeamName: event.homeTeamName,
          awayTeamName: event.awayTeamName,
          competitionName: event.competitionName,
          startTime: event.startTime,
          venue: event.venue,
          status: event.status,
          dataHash: hash,
          lastFetchedAt: new Date(),
        },
      });
      updated++;
    } else {
      // Touch lastFetchedAt so we know this event is still current.
      toUpdate.push({
        id: existingRecord.id,
        values: { lastFetchedAt: new Date() },
      });
      unchanged++;
    }
  }

  // Batch writes in a transaction.
  await db.transaction(async (tx) => {
    if (toInsert.length > 0) {
      await tx.insert(sportEvents).values(toInsert);
    }
    for (const { id, values } of toUpdate) {
      await tx
        .update(sportEvents)
        .set(values)
        .where(eq(sportEvents.id, id));
    }
  });

  return { created, updated, unchanged };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the deduplicated list of entities that at least one user is subscribed to.
 * One DB query regardless of user count.
 */
async function getUniqueTrackedEntities(): Promise<ProviderEntity[]> {
  const rows = await db
    .selectDistinct({
      providerId: subscribableEntities.providerId,
      entityType: subscribableEntities.entityType,
      displayName: subscribableEntities.displayName,
      logoUrl: subscribableEntities.logoUrl,
      country: subscribableEntities.country,
      parentProviderId: subscribableEntities.parentProviderId,
    })
    .from(subscriptions)
    .innerJoin(
      subscribableEntities,
      eq(subscriptions.entityId, subscribableEntities.id)
    );

  return rows.map((r) => ({
    providerId: r.providerId,
    entityType: r.entityType as ProviderEntity["entityType"],
    displayName: r.displayName,
    logoUrl: r.logoUrl ?? undefined,
    country: r.country ?? undefined,
    parentProviderId: r.parentProviderId ?? undefined,
  }));
}

async function startSyncLog(
  subscriptionId: string | null
): Promise<string> {
  const [row] = await db
    .insert(syncLog)
    .values({ subscriptionId, startedAt: new Date() })
    .returning({ id: syncLog.id });
  return row.id;
}

async function completeSyncLog(
  id: string,
  result: SyncResult
): Promise<void> {
  const hasErrors = result.errors.length > 0;
  await db
    .update(syncLog)
    .set({
      completedAt: new Date(),
      eventsCreated: result.eventsCreated,
      eventsUpdated: result.eventsUpdated,
      eventsUnchanged: result.eventsUnchanged,
      error: hasErrors
        ? result.errors.map((e) => `${e.entityId}: ${e.error}`).join("; ")
        : null,
    })
    .where(eq(syncLog.id, id));
}
