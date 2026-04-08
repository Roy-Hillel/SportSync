# SportSync

## Current Milestone: v2.0 API-Football Migration

**Goal:** Replace SportRadar with API-Football as the live data provider — implementing the new provider, re-seeding all entities, migrating sport_events, and remapping user subscriptions to the new provider ID space.

**Target features:**
- New `ApiFootballProvider` implementing the existing `SportsDataProvider` interface with Zod schemas for API-Football response shapes
- Updated bootstrap script using API-Football endpoints (`GET /leagues`, `GET /teams?league&season`)
- Full re-seed of `subscribable_entities` (provider IDs change from SportRadar format to API-Football integer IDs)
- Clear and re-populate `sport_events` after re-seed
- User subscription remapping (old SportRadar entity IDs → new API-Football IDs)
- Env var updates (`API_FOOTBALL_KEY`, `SPORTS_PROVIDER`) and removal of 1.1s per-second delay

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

Current migration scope (v2.0 API-Football Migration):

- [ ] Implement `ApiFootballProvider` with Zod schemas for fixture/league/team response shapes
- [ ] Update bootstrap script to seed from API-Football (`/leagues`, `/teams?league&season`)
- [ ] Re-seed `subscribable_entities` with API-Football provider IDs (e.g., Maccabi Haifa `4195`, Ligat Ha'al `383`)
- [ ] Clear and re-populate `sport_events` after re-seed
- [ ] Remap existing user subscriptions from SportRadar entity IDs to API-Football entity IDs
- [ ] Update env vars (`API_FOOTBALL_KEY`, `SPORTS_PROVIDER`) and remove 1.1s rate-limit delay

### Out of Scope

- **Google Calendar API write scope** — App uses iCal feed instead; simpler auth, universal calendar support, no push complexity
- **Per-user event storage** — Global `sport_events` table is a deliberate architectural choice; keeps sync O(entities) not O(users × entities)
- **Real-time push updates** — Calendar apps poll iCal on their own schedule (up to 24h for Google); no workaround exists
- **Mobile app** — Web-first; personal project scope
- **Multiple calendar feeds per user** — Single iCal feed per user; no calendar selection UI needed at this scale
- **Other sports (football, basketball, etc.)** — Soccer-only via SportRadar Soccer v4; adding sports is a future milestone

## Context

**Production state (as of 2026-03-27):**
- Live at https://sport-sync-lac.vercel.app
- Single production user (Roy)
- Active subscriptions: UEFA Champions League, Maccabi Haifa FC, Premier League, Real Madrid (men)
- ~11k entities seeded: 1,265 competitions + ~10,176 teams (999 with W suffix)
- 13 Champions League events in DB (some TBD bracket names), 0 Israeli league events

**Known data issues:**
- Israeli Premier League fixture data appears incomplete on SportRadar trial tier — competitor endpoint returns only past results; competition-schedule endpoint not yet tested for this
- Champions League QFs/SFs use placeholder team names (WQF1, WSF2 etc.) until brackets fill in — auto-resolves on future syncs
- 10 sport_events rows may have incorrect competition_name from earlier bug (women's team was subscribed); verify after next sync

**Tech environment:**
- Next.js 14 App Router + TypeScript
- Auth.js v5 (Google OAuth, JWT sessions)
- Supabase (Postgres) via Drizzle ORM — lazy DB init via Proxy pattern
- SportRadar Soccer API v4, trial key — 1 req/sec, 1,000 req/day
- Vercel free tier — cron at `0 */5 * * *`
- Provider abstraction in place (`SportsDataProvider` interface, `SPORTS_PROVIDER` env var)

**Critical API knowledge (hard-won):**
- Competitor schedule response shape: `{ schedules: [{ sport_event, sport_event_status }] }` (NOT `sport_events[]`)
- Competition seasons ordered oldest-first — always use `seasons[seasons.length - 1]`
- Competition name lives at `sport_event.sport_event_context.competition.name` (not `tournament`)
- Rate limiting: 1.1s delay between entity syncs prevents 429s

## Constraints

- **API quota**: SportRadar trial — 1,000 req/day, 1 req/sec. Sync cadence (5h cron) is safe; avoid running bootstrap + multiple manual syncs same day.
- **Tech stack**: Next.js 14 + Supabase + Vercel — locked in for continuity with existing codebase
- **Solo maintenance**: Roy is the only developer; changes should be minimal-footprint and well-documented
- **Trial API tier**: Some leagues (e.g., Israeli Premier League) may have incomplete fixture data; paid tier would improve coverage

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| iCal feed over Google Calendar API | No calendar write scope needed, universal calendar support, simpler auth | ✓ Good |
| Global `sport_events` table (not per-user) | O(entities) sync instead of O(users × entities) | ✓ Good |
| Hash-based change detection | Skip DB writes when event data unchanged | ✓ Good |
| Lazy DB init via Proxy | Fixes ES module import hoisting issue in bootstrap scripts | ✓ Good |
| `seasons[seasons.length - 1]` for current season | SportRadar returns seasons oldest-first | ✓ Good |
| 1.1s delay between entity syncs | Respects SportRadar 1 req/sec rate limit | ✓ Good |
| Gender/age suffix in display names | Prevents ambiguous search results (Real Madrid men vs women vs U19) | ✓ Good |
| Single shared DB for dev and prod | Simplicity for solo dev; bootstrap only needed once | — Pending review |

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
*Last updated: 2026-03-27 after initialization*
