# Roadmap: SportSync — Milestone v3.0 Subscription Filters

**Created:** 2026-04-11
**Milestone:** Subscription Filters
**Granularity:** Coarse
**Total Phases:** 2 (Phases 7–8, continuing from v2.0's phases 3–6)
**Requirements covered:** 12/12 ✓

---

## Phase 7: Stage / Round Filter (FILTER-01)

**Goal:** Add an optional `start_round` filter to subscriptions. Users subscribing to a competition can pick a starting round (e.g., "Round of 16"); only fixtures from that round onward are synced into their calendar.

**Requirements:** FILT-01, FILT-02, FILT-03, FILT-04, FILT-09, FILT-12

**Plans:**

### Plan 7.1 — DB schema and subscription UI

Add the `start_round` column to `user_subscriptions` and expose a round picker in the subscription creation modal.

Tasks:
- Add `start_round` column (text, nullable) to `user_subscriptions` in `src/lib/db/schema.ts`
- Write Drizzle migration to add the column (`drizzle-kit generate` + apply)
- In the add-subscription modal (`src/components/add-subscription-modal.tsx`):
  - When a competition entity is selected, fetch `GET /fixtures/rounds?league=<id>&season=<year>` from API-Football
  - Show a dropdown/picker with "All rounds" as default plus the fetched round names
  - Store the selected value as `start_round` when creating the subscription
- Update `user_subscriptions` insert logic to include `start_round`
- Subscription list UI: display `start_round` if set on a subscription card (FILT-12)

**UI hint**: yes — round picker dropdown in modal, filter badge on subscription card

### Plan 7.2 — Sync engine round filter

Apply the `start_round` filter during sync for subscriptions that have it set.

Tasks:
- Read `src/lib/sync/engine.ts` — understand where fixtures are fetched and upserted
- When fetching fixtures for a subscription with `start_round` set:
  - Call `GET /fixtures/rounds?league=<id>&season=<year>` to get the ordered round list
  - Build a round ordering map: `{ roundName: index }` (round names as keys, position as value)
  - After fetching fixtures via `getSchedule()`, filter out fixtures where `round` index < `start_round` index
- Round ordering utility: extract into a helper `getRoundOrder(rounds: string[]): Map<string, number>` — handles both "Regular Season - N" (numeric sort) and knockout rounds (fixed order: "Round of 16" < "Quarter-finals" < "Semi-finals" < "Final")
- Subscriptions without `start_round` are unaffected (FILT-11 regression check)

**UI hint**: no

**Success criteria:**
1. `user_subscriptions.start_round` column exists and is nullable text
2. Modal shows round picker for competition subscriptions; selection is saved to DB
3. Sync for a subscription with `start_round = "Round of 16"` skips group stage fixtures
4. Sync for a subscription without `start_round` is unchanged — no regression
5. Round ordering utility correctly orders both league rounds and knockout stages
6. TypeScript clean, build passes

---

## Phase 8: Team Rank Filter (FILTER-02)

**Goal:** Add an optional `top_n_teams` filter to competition subscriptions. At sync time, standings are fetched to get the current top-N team IDs; only fixtures involving those teams are synced.

**Requirements:** FILT-05, FILT-06, FILT-07, FILT-08, FILT-10, FILT-11

**Plans:**

### Plan 8.1 — DB schema and subscription UI

Add the `top_n_teams` column to `user_subscriptions` and expose a top-N picker in the subscription creation modal.

Tasks:
- Add `top_n_teams` column (integer, nullable) to `user_subscriptions` in `src/lib/db/schema.ts`
- Write Drizzle migration to add the column (`drizzle-kit generate` + apply)
- In the add-subscription modal:
  - For competition subscriptions, show a "Top N teams" picker (options: All, Top 5, Top 10, Top 20)
  - Store the selected value as `top_n_teams` when creating the subscription
- Update `user_subscriptions` insert logic to include `top_n_teams`
- Subscription list UI: display `top_n_teams` filter badge if set (extends Plan 7.1's card update)

**UI hint**: yes — top-N picker dropdown in modal, filter badge on subscription card

### Plan 8.2 — Sync engine team rank filter

Apply the `top_n_teams` filter during sync using live standings data.

Tasks:
- Read `src/lib/sync/engine.ts` — identify where entity fixtures are processed
- For subscriptions with `top_n_teams` set:
  - Call `GET /standings?league=<id>&season=<year>` once per subscription per sync run
  - Extract team IDs for ranks 1 through `top_n_teams` (use `standings[0][0..N-1].team.id`)
  - Filter fixtures: keep only those where `teams.home.id` or `teams.away.id` is in the top-N set
- Quota discipline: fetch standings once per `top_n_teams` subscription per sync, not per fixture (FILT-08)
- Composability: a subscription with both `start_round` and `top_n_teams` applies both filters (both non-null = AND logic) (FILT-10)
- Subscriptions without `top_n_teams` are unaffected (FILT-11 regression check)

**UI hint**: no

**Success criteria:**
1. `user_subscriptions.top_n_teams` column exists and is nullable integer
2. Modal shows top-N picker; selection is saved to DB
3. Sync for a subscription with `top_n_teams = 10` in La Liga only syncs fixtures involving the top-10 ranked teams
4. Only 1 standings API call per filtered subscription per sync (verified in sync_log or via code review)
5. A subscription with both `start_round = "Round of 16"` and `top_n_teams = 8` applies both filters correctly
6. Subscriptions without either filter are unchanged — no regression
7. TypeScript clean, build passes

---

## Requirement Traceability

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| FILT-01 | Phase 7 | Plan 7.1 | Pending |
| FILT-02 | Phase 7 | Plan 7.1 | Pending |
| FILT-03 | Phase 7 | Plan 7.2 | Pending |
| FILT-04 | Phase 7 | Plan 7.2 | Pending |
| FILT-05 | Phase 8 | Plan 8.1 | Pending |
| FILT-06 | Phase 8 | Plan 8.1 | Pending |
| FILT-07 | Phase 8 | Plan 8.2 | Pending |
| FILT-08 | Phase 8 | Plan 8.2 | Pending |
| FILT-09 | Phase 7 | Plan 7.1 | Pending |
| FILT-10 | Phase 8 | Plan 8.2 | Pending |
| FILT-11 | Phase 8 | Plan 8.2 | Pending |
| FILT-12 | Phase 7 | Plan 7.1 | Pending |

**Coverage:** 12/12 v3.0 requirements mapped ✓

---

## Backlog (v4+ — not in current roadmap)

- SCORE-01: Post-match score in calendar event
- TIMEAHEAD-01: Per-subscription time-ahead override
- SHARE-01: Subscription export/import
- SPORT-01/02: Multi-sport support
- UX-01/02/03: Dashboard improvements
- MCP-01: API-Football MCP server for agent use

---
*Roadmap created: 2026-04-11*
*Last updated: 2026-04-11 — Milestone v3.0 initialized*
