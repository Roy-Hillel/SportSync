# Requirements: SportSync

**Defined:** 2026-03-27
**Updated:** 2026-04-08 — v2.0 API-Football Migration requirements added
**Core Value:** A subscribed user's calendar always shows accurate upcoming match times — automatically, without manual effort.

---

## v2.0 Requirements

Requirements for the API-Football migration milestone. This is a production migration — research phase is complete. Focus is execution.

### Provider Implementation

- [ ] **PROV-01**: `ApiFootballProvider` class exists at `src/lib/providers/api-football/` and fully implements the `SportsDataProvider` interface
- [ ] **PROV-02**: Zod schemas exist for all API-Football response shapes used (fixture, league, team) — runtime-validated on API responses
- [ ] **PROV-03**: Provider handles `fixture.venue.id = null` and `league.flag = null` without throwing (nullable fields handled gracefully)
- [ ] **PROV-04**: Provider uses `?league=<id>&season=<year>` query params directly (no `seasons[seasons.length-1]` hack needed)
- [ ] **PROV-05**: Per-second delay (1.1s) is removed; provider respects API-Football's 300 req/min limit only
- [ ] **PROV-06**: `SPORTS_PROVIDER` env var set to `api-football` loads `ApiFootballProvider` (existing env var switch mechanism)
- [ ] **PROV-07**: `API_FOOTBALL_KEY` env var is used for authentication (added to `.env.local` and Vercel environment)

### Bootstrap / Entity Seed

- [ ] **SEED-01**: Bootstrap script (`seed-entities.ts`) is updated to call API-Football `GET /leagues` endpoint to populate competitions
- [ ] **SEED-02**: Bootstrap script calls `GET /teams?league=<id>&season=<year>` for each seeded league to populate teams
- [ ] **SEED-03**: `subscribable_entities` rows written by bootstrap have `provider = 'api-football'` and integer string `provider_id` values (e.g., `"4195"` not `"sr:competitor:4195"`)
- [ ] **SEED-04**: `parent_provider_id` on team rows references the correct API-Football league ID string

### Data Migration

- [ ] **MIGR-01**: All existing `sport_events` rows with `provider = 'sportradar'` are cleared before re-population
- [ ] **MIGR-02**: After re-seed, `sport_events` is re-populated via a full sync run using `ApiFootballProvider`
- [ ] **MIGR-03**: Existing user subscriptions in `user_subscriptions` are remapped — old SportRadar `entity_id` values replaced with corresponding API-Football entity IDs
- [ ] **MIGR-04**: A mapping table or script exists that translates known SportRadar IDs to API-Football IDs for the subscriptions currently in production (Champions League, Maccabi Haifa, Premier League, Real Madrid)

### Cutover & Validation

- [ ] **CUTOVER-01**: After cutover, a manual sync confirms at least 1 future fixture appears for Maccabi Haifa (team ID `4195`) in `sport_events`
- [ ] **CUTOVER-02**: iCal feed for the production user returns valid events after cutover — no empty feed or errors
- [ ] **CUTOVER-03**: Vercel cron continues to run every 5 hours using the new provider without errors in `sync_log`
- [ ] **CUTOVER-04**: Old SportRadar provider code is retained but inert (not deleted) — `SPORTS_PROVIDER=sportradar` can still load it as a fallback

---

## v1.0 Requirements (Superseded)

The following v1.0 requirements are superseded by the API-Football migration. They are archived here for reference.

| Req ID | Description | Superseded By |
|--------|-------------|---------------|
| DATA-01 | Israeli league investigation via competition-schedule endpoint | CUTOVER-01 — API-Football Pro confirms fixtures exist for Maccabi Haifa |
| DATA-02 | Sync engine fallback to competition-schedule | Not needed — API-Football returns complete fixture data on Pro tier |
| DATA-03 | Real Madrid LaLiga events verification | MIGR-01/02 — full re-seed and re-sync resolves stale data |
| DATA-04 | Incorrect competition_name rows from prior bug | MIGR-01 — clearing all sportradar sport_events eliminates these |
| PROD-01 | Confirm subscribable_entities seeded | SEED-01/02/03 — re-seeded from API-Football |
| PROD-02 | Sync log review for 429 patterns | No longer relevant — rate limits are per-minute, not per-second |
| PROD-03 | Premier League future events confirmed | CUTOVER-02 — iCal feed validation covers this |
| QUOTA-01 | SportRadar quota visibility | Not needed — migrating away from SportRadar |
| QUOTA-02 | Bootstrap quota warning | Not needed — API-Football Pro has 7,500 req/day headroom |
| CODE-01 | ENGINEERING_NOTES open questions marked | Deferred — update after v2.0 cutover |
| CODE-02 | Orphaned sport_events cleanup script | MIGR-01 — full clear resolves orphan issue |

---

## Future Requirements (v3+)

Deferred to a future milestone. Tracked but not in current roadmap.

### Multi-Sport Support

- **SPORT-01**: App supports a second sport (e.g., basketball) via a new SportsDataProvider implementation
- **SPORT-02**: User can subscribe to teams/competitions from multiple sports in a single feed

### UX Improvements

- **UX-01**: User can name or label their calendar subscriptions
- **UX-02**: User can see last-sync timestamp and next-sync time on the dashboard
- **UX-03**: User receives email notification when sync fails for a subscribed entity

### Post-Match Score Updates

- **SCORE-01**: After a match ends, the calendar event is updated to include the final score in the event title or description

### Per-Subscription Time Ahead Override

- **TIMEAHEAD-01**: Each subscription can override the user's global time-ahead setting

### Conditional Subscription Filters

- **FILTER-01**: User can subscribe to a competition starting from a specific stage
- **FILTER-02**: User can subscribe to a competition filtered by team rank

### Subscription Sharing

- **SHARE-01**: User can export a subscription as a shareable link or code

### API-Football MCP Server

- **MCP-01**: An MCP server wraps the API-Football v3 API for agent use — deferred from v2.0

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Google Calendar API write scope | iCal feed is simpler, universal, no OAuth calendar scope needed |
| Per-user `sport_events` storage | Global table is a deliberate O(entities) architecture decision |
| Real-time push to calendars | Google polls iCal on its own schedule; no API workaround |
| Mobile app | Personal web project; mobile not needed |
| Multiple calendar feeds per user | Single feed sufficient at current scale |
| Admin dashboard for multi-user management | Solo-user app; no multi-tenancy planned |
| API-Football MCP server | Deferred to v3+ |
| Multi-sport support | Deferred to v3+ |

---

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROV-01 | TBD | Pending |
| PROV-02 | TBD | Pending |
| PROV-03 | TBD | Pending |
| PROV-04 | TBD | Pending |
| PROV-05 | TBD | Pending |
| PROV-06 | TBD | Pending |
| PROV-07 | TBD | Pending |
| SEED-01 | TBD | Pending |
| SEED-02 | TBD | Pending |
| SEED-03 | TBD | Pending |
| SEED-04 | TBD | Pending |
| MIGR-01 | TBD | Pending |
| MIGR-02 | TBD | Pending |
| MIGR-03 | TBD | Pending |
| MIGR-04 | TBD | Pending |
| CUTOVER-01 | TBD | Pending |
| CUTOVER-02 | TBD | Pending |
| CUTOVER-03 | TBD | Pending |
| CUTOVER-04 | TBD | Pending |

**Coverage:**
- v2.0 requirements: 19 total
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 19

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-04-08 — v2.0 API-Football Migration requirements defined*
