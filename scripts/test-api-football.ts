/**
 * Quick smoke test for the ApiFootballProvider.
 * Run with: npx tsx scripts/test-api-football.ts
 *
 * Tests:
 *  1. getSchedule — Maccabi Haifa (team 4195), next 90 days
 *  2. getSchedule — Ligat Ha'al (league 383), next 90 days
 *  3. listCompetitions — spot-check count and shape
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { getApiFootballProvider } from "../src/lib/providers/api-football";

const provider = getApiFootballProvider();

const from = new Date();
const to = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

function fmtDate(d: Date) {
  return d.toISOString().split("T")[0];
}

async function main() {
  console.log(`\n=== API-Football Smoke Test ===`);
  console.log(`Range: ${fmtDate(from)} → ${fmtDate(to)}\n`);

  // Test 1: Maccabi Haifa by team ID
  console.log("--- 1. Maccabi Haifa (team 4195) ---");
  try {
    const haifaEntity = {
      providerId: "4195",
      entityType: "team" as const,
      displayName: "Maccabi Haifa",
    };
    const haifaFixtures = await provider.getSchedule(haifaEntity, from, to);
    console.log(`  Fixtures returned: ${haifaFixtures.length}`);
    if (haifaFixtures.length > 0) {
      const next = haifaFixtures[0];
      console.log(
        `  Next: ${next.homeTeamName} vs ${next.awayTeamName} (${fmtDate(next.startTime)}) — ${next.competitionName}`
      );
    }
  } catch (e) {
    console.error(`  ERROR: ${e}`);
  }

  // Test 2: Ligat Ha'al by league ID
  console.log("\n--- 2. Ligat Ha'al (league 383) ---");
  try {
    const ligaEntity = {
      providerId: "383",
      entityType: "competition" as const,
      displayName: "Ligat Ha'al",
    };
    const ligaFixtures = await provider.getSchedule(ligaEntity, from, to);
    console.log(`  Fixtures returned: ${ligaFixtures.length}`);
    if (ligaFixtures.length > 0) {
      const next = ligaFixtures[0];
      console.log(
        `  Next: ${next.homeTeamName} vs ${next.awayTeamName} (${fmtDate(next.startTime)})`
      );
    }
  } catch (e) {
    console.error(`  ERROR: ${e}`);
  }

  // Test 3: listCompetitions — spot-check
  console.log("\n--- 3. listCompetitions ---");
  try {
    const competitions = await provider.listCompetitions();
    console.log(`  Total competitions returned: ${competitions.length}`);
    const known = competitions.find((c) => c.providerId === "383");
    if (known) {
      console.log(`  Ligat Ha'al found: ✓ (${known.displayName}, country: ${known.country})`);
    } else {
      console.log(`  Ligat Ha'al NOT found in competition list`);
    }
    const ucl = competitions.find((c) => c.displayName.includes("Champions"));
    if (ucl) {
      console.log(`  Champions League: ${ucl.displayName} (id: ${ucl.providerId})`);
    }
  } catch (e) {
    console.error(`  ERROR: ${e}`);
  }

  console.log("\n=== Done ===\n");
}

main().catch(console.error);
