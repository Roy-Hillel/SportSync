# GSD State — SportSync

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-08)

**Core value:** A subscribed user's calendar always shows accurate upcoming match times — automatically, without manual effort.
**Current focus:** Milestone v3.0 — Subscription Filters (FILTER-01: Stage/Round filter, FILTER-02: Team rank filter)

## Current Phase

**Milestone v3.0 — Subscription Filters.** Active. No phase started yet. Next: `gsd:discuss-phase 7` or `gsd:plan-phase 7` to begin Phase 7 (Stage/Round Filter).

## Phase History

| Phase | Name | Status | Completed |
|-------|------|--------|-----------|
| 1 | Data & Production Verification (v1.0) | Superseded | — |
| 2 | Code Quality & Quota Safety (v1.0) | Superseded | — |
| 3 | Provider Implementation (v2.0) | Shipped | 2026-04-11 |
| 4 | Bootstrap & Entity Re-seed (v2.0) | Shipped | 2026-04-11 |
| 5 | Data Migration & Subscription Remapping (v2.0) | Shipped | 2026-04-11 |
| 6 | Cutover & Validation (v2.0) | Shipped | 2026-04-11 |

> v1.0 phases 1 and 2 were superseded by the API-Football migration decision. The Israeli league, Real Madrid verification, and orphan cleanup tasks are all resolved by migrating to API-Football Pro tier.

## Key Context

- Production URL: https://sport-sync-lac.vercel.app
- Supabase project ref: see `.mcp.json` (gitignored)
- Provider: `api-football` (SPORTS_PROVIDER=api-football in Vercel env)
- API-Football Pro: active until 2026-05-08 — **renew before this date**
- Cron: `0 0 * * *` (daily at midnight UTC)

## Last Session

- Date: 2026-04-11
- Action: Initialized Milestone v3.0 — Subscription Filters. Updated PROJECT.md, REQUIREMENTS.md, ROADMAP.md, and STATE.md. Defined 12 requirements (FILT-01 through FILT-12) across 2 phases (Phase 7: Stage/Round filter, Phase 8: Team rank filter). Phase numbering continues from v2.0 (last phase was 6).

---
*State initialized: 2026-03-27*
*Last updated: 2026-04-11 — Milestone v3.0 Subscription Filters initialized*
