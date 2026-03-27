# Roadmap: SportSync — Maintenance Milestone v1

**Created:** 2026-03-27
**Milestone:** Production Health & Data Integrity
**Granularity:** Coarse
**Total Phases:** 2
**Requirements covered:** 11/11 ✓

---

## Phase 1: Data & Production Verification

**Goal:** Confirm the production app is healthy, all subscriptions return correct data, and known data bugs are diagnosed and resolved.

**Requirements:** DATA-01, DATA-02, DATA-03, DATA-04, PROD-01, PROD-02, PROD-03

**Plans:**

### Plan 1.1 — Israeli League Investigation
Investigate whether the competition-schedule endpoint (`/competitions/{id}/seasons.json` → season schedule) returns future fixtures for Israeli Premier League teams where the competitor endpoint only returns past results. Test with Maccabi Haifa (`sr:competitor:5197`) and Maccabi Tel Aviv (`sr:competitor:5198`).

Tasks:
- Identify the Israeli Premier League competition ID (search `subscribable_entities` for "Israel" competitions)
- Fetch competition season schedule and check for future fixtures
- If future fixtures found: update sync engine to prefer competition-schedule for entities where competitor-schedule returns 0 future events
- If still empty: document that Israeli league fixture data is not available on trial tier; add note to ENGINEERING_NOTES.md

**UI hint**: no

### Plan 1.2 — Real Madrid & event data verification
Verify `sport_events` rows are correct after Real Madrid subscription fix. Confirm `competition_name` shows LaLiga matches, not women's competitions.

Tasks:
- Query `sport_events` where `home_team_provider_id = 'sr:competitor:2829'` OR `away_team_provider_id = 'sr:competitor:2829'`
- Confirm `competition_name` = "LaLiga" (or equivalent) for all returned rows
- If any rows show women's competitions: delete or correct them; trigger a fresh sync
- Document result in ENGINEERING_NOTES.md open questions section

**UI hint**: no

### Plan 1.3 — Production DB health check
Verify production `subscribable_entities` is seeded, review `sync_log` for recent errors, and confirm Premier League subscription returns events.

Tasks:
- Query count of `subscribable_entities` by `entity_type` — confirm 1,265+ competitions and 10k+ teams
- Query `sync_log` for last 10 entries — check for errors or 429 patterns
- Confirm at least 1 future event exists in `sport_events` for Premier League (`sr:competition:17`)
- Document findings; if sync_log shows issues, investigate and resolve

**UI hint**: no

**Success criteria:**
1. Israeli league investigation is complete and documented — either fixtures are being synced or a clear explanation exists for why they're not
2. `sport_events` for Real Madrid (sr:competitor:2829) shows only LaLiga competition events — no women's competition rows
3. `subscribable_entities` has 1,265+ competitions and 10k+ teams in production
4. `sync_log` has at least one recent successful sync with no persistent 429 errors
5. Premier League has at least 1 future event in `sport_events`

---

## Phase 2: Code Quality & Quota Safety

**Goal:** Clean up documentation, add quota visibility, remove orphaned data, and ensure the codebase is well-documented for future maintenance.

**Requirements:** QUOTA-01, QUOTA-02, CODE-01, CODE-02

**Plans:**

### Plan 2.1 — API quota visibility
Make SportRadar daily quota usage visible so Roy can check usage before running bootstrap or extra manual syncs.

Tasks:
- Add a `/api/quota-status` endpoint (or integrate into dashboard) that shows estimated daily API calls used based on `sync_log` entries from the current UTC day
- Add a warning banner in the Sync Now UI if estimated usage is above 800 requests for the day
- Update README/ENGINEERING_NOTES with quota guidance

**UI hint**: yes

### Plan 2.2 — Orphaned event cleanup
Identify and clean up `sport_events` rows that were created for subscriptions that no longer exist (e.g., Real Madrid women's events from the old subscription).

Tasks:
- Write a query that finds `sport_events` rows whose `competition_provider_id`, `home_team_provider_id`, and `away_team_provider_id` do not match any currently active subscription's tracked entities
- Review results before deleting — confirm these are genuinely orphaned
- Add a cleanup script (`npm run db:cleanup-orphans`) that can be run periodically

**UI hint**: no

### Plan 2.3 — Documentation wrap-up
Update ENGINEERING_NOTES.md to mark all open questions as resolved/deferred, and add a quota safety warning to bootstrap script.

Tasks:
- Update ENGINEERING_NOTES.md "Open Questions / Next Steps" section — mark each item as ✓ resolved, ⚠ deferred, or still open with current status
- Add a prominent comment block to `src/lib/bootstrap/seed-entities.ts` warning about daily quota usage (~778 requests) and advising not to re-run bootstrap on the same day as manual syncs
- Update README.md with any setup clarifications learned since initial deploy

**UI hint**: no

**Success criteria:**
1. Roy can see estimated daily API request count without logging into SportRadar dashboard
2. Sync Now UI warns when daily quota is approaching limit (>800 requests)
3. Orphaned `sport_events` rows are identified — either cleaned up or explicitly documented as acceptable
4. All 5 open questions in ENGINEERING_NOTES.md are marked with current status
5. Bootstrap script has a quota warning comment visible before running

---

## Requirement Traceability

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| DATA-01 | Phase 1 | Plan 1.1 | Pending |
| DATA-02 | Phase 1 | Plan 1.1 | Pending |
| DATA-03 | Phase 1 | Plan 1.2 | Pending |
| DATA-04 | Phase 1 | Plan 1.2 | Pending |
| PROD-01 | Phase 1 | Plan 1.3 | Pending |
| PROD-02 | Phase 1 | Plan 1.3 | Pending |
| PROD-03 | Phase 1 | Plan 1.3 | Pending |
| QUOTA-01 | Phase 2 | Plan 2.1 | Pending |
| QUOTA-02 | Phase 2 | Plan 2.3 | Pending |
| CODE-01 | Phase 2 | Plan 2.3 | Pending |
| CODE-02 | Phase 2 | Plan 2.2 | Pending |

**Coverage:** 11/11 v1 requirements mapped ✓

---

## Backlog (v2 — not in current roadmap)

- SPORT-01/02: Multi-sport support (SportsDataProvider interface already in place)
- UX-01/02/03: Dashboard improvements (subscription labels, sync timestamps, failure alerts)
- API-01/02: Paid SportRadar tier migration

---
*Roadmap created: 2026-03-27*
*Last updated: 2026-03-27 after initialization*
