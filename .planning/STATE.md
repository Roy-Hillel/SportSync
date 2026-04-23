# GSD State — SportSync

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-08)

**Core value:** A subscribed user's calendar always shows accurate upcoming match times — automatically, without manual effort.
**Current focus:** Milestone v3.0 — Subscription Filters (FILTER-01: Stage/Round filter, FILTER-02: Team rank filter)

## Current Phase

**Milestone v3.0 — Subscription Filters.** Active. Phase 06.1 (SCORE-01) complete — both plans executed and verified. Next: Phase 7 (FILTER-01: Stage/Round filter).

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

- Date: 2026-04-23
- Action: Executed Phase 06.1 (SCORE-01) — both plans complete. Added home_score/away_score to DB schema + migration applied. Extended ProviderEvent type with homeScore/awayScore. Mapped goals in API-Football mapFixture(). Included scores in hashEvent(). Propagated scores through sync engine insert/update paths. Changed sync window to now-3days → +26weeks. Updated iCal generator: buildSummary() shows score in title for closed events (en-dash format), SEQUENCE field added to createEvent(), buildDescription() shows "Final score: N–M" for closed events. TypeScript clean, build passes.

## Accumulated Context

### Roadmap Evolution

- Phase 06.1 inserted after Phase 6 (before Phase 7): SCORE-01 — Post-match score update in calendar events (URGENT)

---
*State initialized: 2026-03-27*
*Last updated: 2026-04-23 — Phase 06.1 (SCORE-01) inserted as urgent work before Phase 7*
