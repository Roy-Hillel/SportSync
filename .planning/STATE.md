# GSD State — SportSync

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-08)

**Core value:** A subscribed user's calendar always shows accurate upcoming match times — automatically, without manual effort.
**Current focus:** Milestone v2.0 — API-Football Migration (defining requirements, roadmap pending)

## Current Phase

**Phase 3: Provider Implementation** — Not started
- Status: Ready to plan
- Milestone: v2.0 API-Football Migration
- Next action: `/gsd:plan-phase 3`

## Phase History

| Phase | Name | Status | Completed |
|-------|------|--------|-----------|
| 1 | Data & Production Verification (v1.0) | Superseded | — |
| 2 | Code Quality & Quota Safety (v1.0) | Superseded | — |
| 3 | Provider Implementation (v2.0) | Pending | — |
| 4 | Bootstrap & Entity Re-seed (v2.0) | Pending | — |
| 5 | Data Migration & Subscription Remapping (v2.0) | Pending | — |
| 6 | Cutover & Validation (v2.0) | Pending | — |

> v1.0 phases 1 and 2 were superseded by the API-Football migration decision. The Israeli league, Real Madrid verification, and orphan cleanup tasks are all resolved by migrating to API-Football Pro tier.

## Key Context

- Production URL: https://sport-sync-lac.vercel.app
- Supabase project ref: see `.mcp.json` (gitignored)
- API-Football Pro: active until 2026-05-08, 7,500 req/day, 300 req/min
- API-Football key: `API_FOOTBALL_KEY` in `.env.local`
- Maccabi Haifa: team ID `4195`, league `383` (Ligat Ha'al), season `2025`
- Cron: `0 */5 * * *` on Vercel

## Accumulated Context

- `SportsDataProvider` interface already exists at `src/lib/providers/types.ts`
- Current SportRadar provider at `src/lib/providers/sportradar/`
- Sync engine at `src/lib/sync/engine.ts` — calls provider methods
- Bootstrap at `src/lib/bootstrap/seed-entities.ts`
- `subscribable_entities` table: `provider_id`, `provider`, `entity_type`, `display_name`, `logo_url`, `country`, `parent_provider_id`
- `sport_events` table: `provider_id`, `provider`, `home_team_provider_id`, `away_team_provider_id`, `competition_provider_id`, `season_provider_id`
- `SPORTS_PROVIDER` env var controls which provider is loaded

## Last Session

- Date: 2026-04-08
- Action: Milestone v2.0 (API-Football Migration) initialized
- Artifacts created/updated: PROJECT.md, STATE.md, REQUIREMENTS.md, ROADMAP.md

---
*State initialized: 2026-03-27*
*Last updated: 2026-04-08 — Milestone v2.0 started*
