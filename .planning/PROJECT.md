# SportSync

## Current Milestone: v3.0 Subscription Filters

**Goal:** Let users subscribe to a competition with optional filters that narrow which fixtures get synced — starting from a specific round (FILTER-01) or only involving top-N ranked teams (FILTER-02). Both features share the same subscription-time filter model and ship together.

**Target features:**
- FILTER-01: Stage/Round filter — user picks a start round (e.g., "Round of 16") at subscription creation; only fixtures from that round onward are synced. API path: `GET /fixtures/rounds` for round names, `GET /fixtures?round=` for filtering.
- FILTER-02: Team rank filter — user subscribes to a competition filtered to top-N ranked teams (e.g., "La Liga top 10"); sync fetches standings at sync time, extracts the top-N team IDs, then only syncs fixtures involving those teams. API path: `GET /standings` for ranked team IDs.
- Subscription schema change: `user_subscriptions` gets optional `start_round` (text) and `top_n_teams` (integer) columns.
- UI: subscription creation modal gets pickers for both filters (optional, default = no filter).
- Sync logic: engine applies active filters before upserting to `sport_events`.

---

## What This Is

SportSync is a personal web app that automatically syncs soccer match schedules into any calendar app via a personal iCal feed. Users sign in with Google, subscribe to teams and competitions, and paste their unique webcal URL into Google Calendar, Apple Calendar, or Outlook — matches appear automatically and stay current. It's a solo-maintained tool built by Roy Hillel for personal use, currently live in production.

## Core Value

A subscribed user's calendar always shows accurate upcoming match times — automatically, without manual effort.

## Requirements

### Validated

These features are shipped and working in production:

- ✓ Google OAuth sign-in with automatic user creation — existing
- ✓ User can subscribe to teams and competitions from a seeded entity database — existing
- ✓ User can remove subscriptions — existing
- ✓ Entity search against local `subscribable_entities` cache (~11k entries) — existing
- ✓ Sync engine fetches schedules from SportRadar, upserts global `sport_events` table, logs results — existing
- ✓ iCal feed at `/calendar/[token]` returns valid `.ics` with correct events for user's subscriptions — existing
- ✓ Vercel cron runs sync every 5 hours automatically — existing
- ✓ Manual "Sync Now" button with per-entity results panel — existing
- ✓ Hash-based change detection avoids unnecessary DB writes — existing
- ✓ Gender/age suffix disambiguation on team display names (W), (U19) — existing
- ✓ Production deployed at https://sport-sync-lac.vercel.app — existing

### Active

Current scope (v3.0 Subscription Filters):

**FILTER-01: Stage/Round Filter**
- [ ] **FILT-01**: `user_subscriptions` has optional `start_round` column (text, nullable)
- [ ] **FILT-02**: Subscription creation UI shows a round picker populated from `GET /fixtures/rounds` for the selected competition
- [ ] **FILT-03**: Sync engine filters fetched fixtures to those at or after `start_round` when the column is set
- [ ] **FILT-04**: A per-competition round ordering map exists (rounds are strings like "Regular Season - 1", "Round of 16"; API returns unordered)

**FILTER-02: Team Rank Filter**
- [ ] **FILT-05**: `user_subscriptions` has optional `top_n_teams` column (integer, nullable)
- [ ] **FILT-06**: Subscription creation UI shows a top-N picker (e.g., "Top 5", "Top 10", "Top 20") for competition subscriptions
- [ ] **FILT-07**: Sync engine calls `GET /standings` at sync time for the competition, extracts the top-N team IDs, then filters fixtures to those involving at least one ranked team
- [ ] **FILT-08**: Standings fetch is quota-efficient — one call per filtered competition subscription per sync

### Out of Scope

- **Google Calendar API write scope** — App uses iCal feed instead; simpler auth, universal calendar support, no push complexity
- **Per-user event storage** — Global `sport_events` table is a deliberate architectural choice; keeps sync O(entities) not O(users × entities)
- **Real-time push updates** — Calendar apps poll iCal on their own schedule (up to 24h for Google); no workaround exists
- **Mobile app** — Web-first; personal project scope
- **Multiple calendar feeds per user** — Single iCal feed per user; no calendar selection UI needed at this scale
- **Other sports (football, basketball, etc.)** — Soccer-only via SportRadar Soccer v4; adding sports is a future milestone

## Context

**Production state (as of 2026-04-11):**
- Live at https://sport-sync-lac.vercel.app
- Single production user (Roy)
- Active subscriptions: Maccabi Haifa FC (team) — reset after v2.0 migration
- Provider: API-Football Pro ($19/month, 7,500 req/day) — **plan expires 2026-05-08, must renew**
- 1,220 competitions + 8,658 unique teams seeded in `subscribable_entities`
- Cron: daily at midnight UTC (`0 0 * * *`)

**Validated API-Football facts (from real calls, 2026-04-11):**
- API key: goes in `.env.local` as `API_FOOTBALL_KEY`
- Maccabi Haifa: team ID `4195`, confirmed 2 upcoming fixtures
- Ligat Ha'al: league ID `383`, current season year `2025`
- Rate limits: 300 req/min on Pro (no per-second limit)
- `fixture.venue.id` can be `null` on some fixtures
- `league.flag` is `null` for international competitions (Champions League)
- `league.season` is an integer year (e.g. `2025`), not a string ID
- `GET /fixtures/rounds?league=<id>&season=<year>` returns array of round name strings
- `GET /standings?league=<id>&season=<year>` returns ranked teams with `rank` field

**Tech environment:**
- Next.js 14 App Router + TypeScript
- Auth.js v5 (Google OAuth, JWT sessions)
- Supabase (Postgres) via Drizzle ORM — lazy DB init via Proxy pattern
- API-Football v3 (migrating from SportRadar Soccer API v4)
- Vercel free tier — cron at `0 */5 * * *`
- Provider abstraction in place (`SportsDataProvider` interface, `SPORTS_PROVIDER` env var)

**Critical API-Football knowledge:**
- Fixture response shape confirmed (see full context doc)
- Use `?league=383&season=2025` directly — no `seasons[seasons.length-1]` hack needed
- `league.season` is integer year, not string ID
- Bootstrap: `GET /leagues` for competitions, `GET /teams?league&season` for teams

## Constraints

- **API quota**: API-Football Pro — 7,500 req/day, 300 req/min. No per-second limit. Plan active until 2026-05-08.
- **Tech stack**: Next.js 14 + Supabase + Vercel — locked in for continuity with existing codebase
- **Solo maintenance**: Roy is the only developer; changes should be minimal-footprint and well-documented
- **Provider abstraction**: `SportsDataProvider` interface already exists — migration must implement it exactly, not redesign it
- **DB migration**: Provider IDs change completely (SportRadar `sr:competitor:2829` → API-Football `529`); full re-seed + subscription remapping required

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| iCal feed over Google Calendar API | No calendar write scope needed, universal calendar support, simpler auth | ✓ Good |
| Global `sport_events` table (not per-user) | O(entities) sync instead of O(users × entities) | ✓ Good |
| Hash-based change detection | Skip DB writes when event data unchanged | ✓ Good |
| Lazy DB init via Proxy | Fixes ES module import hoisting issue in bootstrap scripts | ✓ Good |
| `seasons[seasons.length - 1]` for current season | SportRadar returns seasons oldest-first | ✓ Good |
| 1.1s delay between entity syncs | Respects SportRadar 1 req/sec rate limit | ✗ Removing — API-Football has no per-second limit |
| Gender/age suffix in display names | Prevents ambiguous search results (Real Madrid men vs women vs U19) | ✓ Good |
| Single shared DB for dev and prod | Simplicity for solo dev; bootstrap only needed once | ✓ Good |
| Migrate to API-Football (not stay on SportRadar) | SportRadar trial quota issues; API-Football Pro validated and active | ✓ Decided 2026-04-08 |
| Use `SportsDataProvider` interface for swap | Interface was designed for exactly this migration | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-08 — Milestone v2.0 API-Football Migration started*
