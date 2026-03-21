// ---------------------------------------------------------------------------
// One-off fix: append (W) / (U##) suffixes to team display names based on
// parent competition name. Uses a single SQL UPDATE with a JOIN.
//
// Usage:
//   npx tsx src/lib/bootstrap/fix-display-names.ts
// ---------------------------------------------------------------------------

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function fixDisplayNames() {
  // Append (W) to teams whose parent competition name contains "women"
  const womenResult = await db.execute(sql`
    UPDATE subscribable_entities team
    SET display_name = team.display_name || ' (W)'
    FROM subscribable_entities comp
    WHERE team.parent_provider_id = comp.provider_id
      AND team.entity_type = 'team'
      AND comp.display_name ILIKE '%women%'
      AND team.display_name NOT LIKE '%(W)%'
  `);
  console.log(`Women suffix applied: ${(womenResult as unknown as { rowCount: number }).rowCount ?? "?"} rows`);

  // Append youth group (e.g. U19) to teams in youth competitions
  const youthResult = await db.execute(sql`
    UPDATE subscribable_entities team
    SET display_name = team.display_name || ' (' ||
        regexp_replace(comp.display_name, '.*(U\d+).*', '\1', 'i') || ')'
    FROM subscribable_entities comp
    WHERE team.parent_provider_id = comp.provider_id
      AND team.entity_type = 'team'
      AND comp.display_name ~* '\yU\d+\y'
      AND team.display_name NOT LIKE '%(U%'
  `);
  console.log(`Youth suffix applied: ${(youthResult as unknown as { rowCount: number }).rowCount ?? "?"} rows`);

  console.log("\nDone.");
}

fixDisplayNames()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fix failed:", err);
    process.exit(1);
  });
