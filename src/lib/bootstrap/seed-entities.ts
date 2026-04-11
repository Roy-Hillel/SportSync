// ---------------------------------------------------------------------------
// Entity bootstrap script
//
// Seeds the subscribable_entities table from the active sports data provider.
// Run this once to populate the search index, then re-run periodically
// (e.g., weekly via cron) to pick up newly promoted/relegated teams.
//
// Usage:
//   npx tsx src/lib/bootstrap/seed-entities.ts
// ---------------------------------------------------------------------------

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/lib/db";
import { subscribableEntities } from "@/lib/db/schema";
import { getActiveProvider, type ProviderEntity } from "@/lib/providers";
import { sql } from "drizzle-orm";

async function seedEntities() {
  const provider = getActiveProvider();
  console.log(`\nSeeding entities from provider: ${provider.name}`);

  // --- Step 1: Fetch all competitions ---
  console.log("Fetching competitions…");
  const competitions = await provider.listCompetitions();
  console.log(`  Found ${competitions.length} competitions`);

  // Upsert competitions
  await upsertEntities(provider.name, competitions);
  console.log(`  Upserted ${competitions.length} competitions`);

  // --- Step 2: Fetch teams for top competitions ---
  // The trial API has rate limits (~1 req/sec). We batch the most important
  // competitions rather than all 1265 to avoid exhausting the quota.
  // Filter to competitions that have a known country (i.e. domestic leagues)
  // plus international club competitions.
  const topCompetitions = competitions.filter((c) =>
    PRIORITY_COMPETITION_IDS.has(c.providerId) ||
    (c.country && PRIORITY_COUNTRIES.has(c.country))
  );

  console.log(`\nFetching teams for ${topCompetitions.length} priority competitions…`);

  let teamCount = 0;
  let errors = 0;

  for (const comp of topCompetitions) {
    try {
      const rawTeams = await provider.listTeamsInCompetition(comp.providerId);
      // Append gender/age suffix so teams with the same name across competitions
      // are distinguishable in search (e.g. "Real Madrid (W)" vs "Real Madrid").
      const isWomen = /women/i.test(comp.displayName);
      const youthMatch = comp.displayName.match(/\bU\d+\b/i);
      const teams = (isWomen || youthMatch)
        ? rawTeams.map((t) => ({
            ...t,
            displayName: isWomen
              ? `${t.displayName} (W)`
              : `${t.displayName} (${youthMatch![0].toUpperCase()})`,
          }))
        : rawTeams;
      if (teams.length > 0) {
        await upsertEntities(provider.name, teams);
        teamCount += teams.length;
        process.stdout.write(`  ${comp.displayName}: ${teams.length} teams\n`);
      }
      // API-Football: 300 req/min — no per-request delay needed
    } catch (err) {
      errors++;
      process.stdout.write(`  ${comp.displayName}: ERROR — ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  console.log(`\nDone.`);
  console.log(`  Competitions: ${competitions.length}`);
  console.log(`  Teams: ${teamCount}`);
  console.log(`  Errors: ${errors}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BATCH_SIZE = 100;

async function upsertEntities(provider: string, entities: ProviderEntity[]) {
  if (entities.length === 0) return;

  const rows = entities.map((e) => ({
    providerId: e.providerId,
    provider,
    entityType: e.entityType,
    displayName: e.displayName,
    logoUrl: e.logoUrl ?? null,
    country: e.country ?? null,
    parentProviderId: e.parentProviderId ?? null,
    updatedAt: new Date(),
  }));

  // Batch to stay within PostgreSQL's parameter limit.
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db
      .insert(subscribableEntities)
      .values(batch)
      .onConflictDoUpdate({
        target: [subscribableEntities.providerId, subscribableEntities.provider],
        set: {
          displayName: sql`excluded.display_name`,
          logoUrl: sql`excluded.logo_url`,
          country: sql`excluded.country`,
          parentProviderId: sql`excluded.parent_provider_id`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Priority filter — top domestic leagues + major international competitions
// Keeps the trial API quota manageable while covering the most-followed teams.
// ---------------------------------------------------------------------------

const PRIORITY_COMPETITION_IDS = new Set([
  "2",    // UEFA Champions League
  "3",    // UEFA Europa League
  "848",  // UEFA Conference League
  "960",  // UEFA Euro
  "1",    // FIFA World Cup
  "9",    // CONMEBOL Copa América
]);

const PRIORITY_COUNTRIES = new Set([
  "England",
  "Spain",
  "Germany",
  "Italy",
  "France",
  "Netherlands",
  "Portugal",
  "Brazil",
  "Argentina",
  "USA",
  "International Clubs",
  "International",
]);

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

seedEntities()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Bootstrap failed:", err);
    process.exit(1);
  });
