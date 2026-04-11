# Roadmap: SportSync — Milestone v2.0 API-Football Migration

**Created:** 2026-04-08
**Milestone:** API-Football Migration
**Granularity:** Coarse
**Total Phases:** 4 (Phases 3–6, continuing from v1.0's phases 1–2)
**Requirements covered:** 19/19 ✓

---

## Phase 3: Provider Implementation

**Goal:** Build the `ApiFootballProvider` class that fully implements the existing `SportsDataProvider` interface, with Zod-validated response schemas and correct env var wiring.

**Requirements:** PROV-01, PROV-02, PROV-03, PROV-04, PROV-05, PROV-06, PROV-07

**Plans:**

### Plan 3.1 — ApiFootballProvider core

Implement `src/lib/providers/api-football/index.ts` (and supporting files) that implements the `SportsDataProvider` interface.

Tasks:
- Read `src/lib/providers/types.ts` — understand the full interface contract
- Read `src/lib/providers/sportradar/` — understand existing implementation pattern
- Create `src/lib/providers/api-football/` directory with:
  - `index.ts` — `ApiFootballProvider` class implementing `SportsDataProvider`
  - `schemas.ts` — Zod schemas for fixture, league, team response shapes
  - `client.ts` — HTTP client using `API_FOOTBALL_KEY` env var, `x-apisports-key` header
- Handle nullable fields: `fixture.venue.id`, `league.flag`, `goals.home/away`
- Use `?league=<id>&season=<year>` query params directly (no seasons array hack)
- Remove 1.1s per-second delay — API-Football limits are per-minute only

**UI hint**: no

### Plan 3.2 — Provider registration and env var wiring

Wire the new provider into the existing provider-loading mechanism.

Tasks:
- Update `src/lib/providers/index.ts` (or wherever `SPORTS_PROVIDER` switch lives) to load `ApiFootballProvider` when `SPORTS_PROVIDER=api-football`
- Add `API_FOOTBALL_KEY` to `.env.local` (documented) and Vercel environment variables
- Update `SPORTS_PROVIDER` to `api-football` in `.env.local`
- Verify `SPORTS_PROVIDER=sportradar` still loads the old provider (fallback intact)
- Add type safety: throw clear error if `API_FOOTBALL_KEY` is missing

**UI hint**: no

**Success criteria:**
1. `ApiFootballProvider` instantiates without error when `API_FOOTBALL_KEY` is set
2. All `SportsDataProvider` interface methods are implemented (TypeScript compiles cleanly)
3. Zod schemas parse a real API-Football fixture response without throwing (test with the confirmed response shape)
4. `SPORTS_PROVIDER=api-football` loads the new provider; `SPORTS_PROVIDER=sportradar` still loads the old one
5. Nullable fields (`venue.id`, `league.flag`) do not cause runtime errors

---

## Phase 4: Bootstrap & Entity Re-seed

**Goal:** Update the bootstrap script to seed `subscribable_entities` from API-Football endpoints and run a full re-seed in production.

**Requirements:** SEED-01, SEED-02, SEED-03, SEED-04

**Plans:**

### Plan 4.1 — Update bootstrap script for API-Football

Rewrite `src/lib/bootstrap/seed-entities.ts` to use API-Football's `GET /leagues` and `GET /teams?league&season` endpoints.

Tasks:
- Read existing `seed-entities.ts` to understand current SportRadar seeding logic
- Replace SportRadar API calls with API-Football calls:
  - `GET /leagues` → seed competitions (with `provider = 'api-football'`, integer string `provider_id`)
  - `GET /teams?league=<id>&season=<year>` per league → seed teams
- Set `provider = 'api-football'` on all written rows
- Set `provider_id` to API-Football integer IDs as strings (e.g., `"4195"` not `"sr:competitor:4195"`)
- Set `parent_provider_id` on team rows to the API-Football league ID string
- Remove per-second rate limit delay (300 req/min is plenty for bootstrap)
- Preserve gender/age suffix disambiguation logic if needed

**UI hint**: no

### Plan 4.2 — Production re-seed

Clear existing SportRadar entities and run the updated bootstrap.

Tasks:
- Clear `subscribable_entities` rows where `provider = 'sportradar'`
- Run bootstrap script against production Supabase
- Verify row counts: competitions and teams seeded with `provider = 'api-football'`
- Spot-check: confirm Maccabi Haifa (`4195`), Ligat Ha'al (`383`), Premier League, Real Madrid exist in the table
- Document new entity IDs for the known subscriptions (needed for MIGR-04 mapping)

**UI hint**: no

**Success criteria:**
1. `subscribable_entities` contains rows with `provider = 'api-football'` after bootstrap
2. Maccabi Haifa (team ID `4195`) exists in `subscribable_entities`
3. Ligat Ha'al (league ID `383`) exists in `subscribable_entities`
4. Bootstrap script completes without quota errors (well within 7,500 req/day limit)
5. All seeded rows have integer string `provider_id` values (no `sr:` prefix format)

---

## Phase 5: Data Migration & Subscription Remapping

**Goal:** Clear stale SportRadar sport_events, re-populate via a full sync with the new provider, and remap existing user subscriptions to API-Football entity IDs.

**Requirements:** MIGR-01, MIGR-02, MIGR-03, MIGR-04

**Plans:**

### Plan 5.1 — Clear and re-populate sport_events

Remove all SportRadar fixture data and trigger a full sync with the new provider.

Tasks:
- Delete all `sport_events` rows where `provider = 'sportradar'`
- Trigger a manual full sync via the new `ApiFootballProvider`
- Verify `sport_events` rows have `provider = 'api-football'` after sync
- Verify at least 1 future fixture exists for Maccabi Haifa and Premier League

**UI hint**: no

### Plan 5.2 — User subscription remapping

Remap the production user's subscriptions from SportRadar entity IDs to API-Football entity IDs.

Tasks:
- Query `user_subscriptions` to see current entity IDs (expect: Champions League, Maccabi Haifa, Premier League, Real Madrid)
- Build explicit mapping: SportRadar ID → API-Football ID for each active subscription
  - Maccabi Haifa: `sr:competitor:5197` → `4195`
  - Premier League: `sr:competition:17` → look up from seeded `subscribable_entities`
  - UEFA Champions League: `sr:competition:7` → look up from seeded `subscribable_entities`
  - Real Madrid: `sr:competitor:2829` → look up from seeded `subscribable_entities`
- Update `user_subscriptions` rows with new `entity_id` values
- Verify subscriptions now reference valid `subscribable_entities` rows with `provider = 'api-football'`

**UI hint**: no

**Success criteria:**
1. No `sport_events` rows with `provider = 'sportradar'` remain in DB
2. `sport_events` contains rows with `provider = 'api-football'` after sync
3. All active `user_subscriptions` reference `subscribable_entities` rows with `provider = 'api-football'`
4. No broken foreign key references in `user_subscriptions` after remapping
5. Maccabi Haifa and Premier League each have at least 1 future event in `sport_events`

---

## Phase 6: Cutover & Validation

**Goal:** Confirm end-to-end production functionality with the new provider — iCal feed works, cron runs cleanly, fallback provider is preserved.

**Requirements:** CUTOVER-01, CUTOVER-02, CUTOVER-03, CUTOVER-04

**Plans:**

### Plan 6.1 — End-to-end validation

Verify the full stack works with API-Football as the live provider.

Tasks:
- Confirm Vercel environment variables are set: `SPORTS_PROVIDER=api-football`, `API_FOOTBALL_KEY=<value>`
- Fetch the production iCal feed URL — confirm it returns valid `.ics` with events
- Check that calendar events include correct team names, dates, and competition names
- Verify `sync_log` shows a successful cron run with no errors after deploy
- Manually trigger "Sync Now" in the dashboard — confirm results panel shows synced entities

**UI hint**: no

### Plan 6.2 — Documentation and cleanup

Update ENGINEERING_NOTES.md and finalize the migration.

Tasks:
- Update `ENGINEERING_NOTES.md` with:
  - API-Football provider facts (rate limits, response shape quirks, key env var names)
  - Known entity IDs for current subscriptions (Maccabi Haifa `4195`, Ligat Ha'al `383`, etc.)
  - Note that SportRadar provider is preserved but inactive
  - Mark v1.0 open questions as resolved or superseded
- Confirm `SPORTS_PROVIDER=sportradar` still loads the old provider (inert but available)
- Add comment in `seed-entities.ts` about API-Football rate limits (300 req/min)

**UI hint**: no

**Success criteria:**
1. iCal feed returns valid `.ics` with at least 1 future Maccabi Haifa fixture
2. `sync_log` shows at least 1 successful sync run after cutover with `provider = 'api-football'`
3. Cron continues to run every 5 hours without errors
4. `SPORTS_PROVIDER=sportradar` can still be loaded without TypeScript errors (fallback intact)
5. ENGINEERING_NOTES.md reflects current API-Football state — no stale SportRadar-only notes

---

## Requirement Traceability

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| PROV-01 | Phase 3 | Plan 3.1 | Pending |
| PROV-02 | Phase 3 | Plan 3.1 | Pending |
| PROV-03 | Phase 3 | Plan 3.1 | Pending |
| PROV-04 | Phase 3 | Plan 3.1 | Pending |
| PROV-05 | Phase 3 | Plan 3.1 | Pending |
| PROV-06 | Phase 3 | Plan 3.2 | Pending |
| PROV-07 | Phase 3 | Plan 3.2 | Pending |
| SEED-01 | Phase 4 | Plan 4.1 | Pending |
| SEED-02 | Phase 4 | Plan 4.1 | Pending |
| SEED-03 | Phase 4 | Plan 4.1 | Pending |
| SEED-04 | Phase 4 | Plan 4.1 | Pending |
| MIGR-01 | Phase 5 | Plan 5.1 | Pending |
| MIGR-02 | Phase 5 | Plan 5.1 | Pending |
| MIGR-03 | Phase 5 | Plan 5.2 | Pending |
| MIGR-04 | Phase 5 | Plan 5.2 | Pending |
| CUTOVER-01 | Phase 6 | Plan 6.1 | Pending |
| CUTOVER-02 | Phase 6 | Plan 6.1 | Pending |
| CUTOVER-03 | Phase 6 | Plan 6.1 | Pending |
| CUTOVER-04 | Phase 6 | Plan 6.2 | Pending |

**Coverage:** 19/19 v2.0 requirements mapped ✓

---

## Backlog (v3+ — not in current roadmap)

- SPORT-01/02: Multi-sport support (SportsDataProvider interface in place)
- UX-01/02/03: Dashboard improvements (subscription labels, sync timestamps, failure alerts)
- SCORE-01: Post-match score in calendar event
- TIMEAHEAD-01: Per-subscription time-ahead override
- FILTER-01/02: Conditional subscription filters (stage/rank)
- SHARE-01: Subscription export/import
- MCP-01: API-Football MCP server for agent use

---
*Roadmap created: 2026-04-08*
*Last updated: 2026-04-08 — Milestone v2.0 initialized*
