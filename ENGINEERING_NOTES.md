# SportSync — Engineering Notes

This document captures the engineering process, bugs encountered, decisions made, and open problems. It is intended to give a new engineer or AI agent full working context without having to re-discover everything from scratch.

See `README.md` for setup instructions and `CLAUDE.md` for architecture reference. This file covers the *why*, the *journey*, and the *gotchas*.

---

## Current State (as of April 11, 2026)

### What is working
- Google OAuth sign-in and user creation
- Subscription management (add/remove teams and competitions)
- Entity search against the local `subscribable_entities` cache (~8,955 entries — API-Football data)
- Sync engine: fetches schedules from API-Football, upserts into `sport_events`, logs results
- iCal feed at `/calendar/[token]` — verified to return valid `.ics` with correct events
- Manual "Sync Now" button with per-entity results panel
- Vercel cron configured (`0 0 * * *` — daily at midnight UTC)
- Production deployed at `https://sport-sync-lac.vercel.app`
- **Israeli league (Ligat Ha'al) fixtures now available** — was broken on SportRadar

### What is not working / open issues

**Google Calendar refresh lag**
Google polls subscribed iCal feeds on its own schedule (up to 24h). The feed is correct and verified, but the user may not see events immediately. No workaround — Google limitation.

**Champions League bracket TBDs**
Final rounds may show as TBDs until API-Football publishes the bracket. Auto-updates on future syncs.

**South American league season heuristic**
`deriveSeason()` uses month < July → previous year. Works for European/Israeli leagues (Aug start) but wrong for Argentine/Brazilian leagues (Jan start). Not a current problem — no South American teams subscribed.

---

## Migration History

### v1.0 — SportRadar (March 2026)
Initial build used SportRadar trial API. Key limitation: Israeli league (Ligat Ha'al) returned 0 future fixtures — data not available on trial tier.

### v2.0 — API-Football (April 2026)
Migrated to API-Football (api-sports.io). Israeli fixtures now available. Full entity re-seed (8,955 entities). All user subscriptions wiped (small user base, clean restart preferred over complex migration).

**API-Football Pro plan:** Active until 2026-05-08. Key: `API_FOOTBALL_KEY` in Vercel env vars.

---

## API-Football — Accumulated Knowledge

### Plan & Rate Limits
- **Pro tier:** 7,500 req/day, 300 req/min
- **Auth header:** `x-apisports-key` — NOT `Authorization: Bearer`, NOT `x-api-key`
- **Base URL:** `https://v3.football.api-sports.io`
- **Response wrapper:** all endpoints return `{ response: [...] }`

### Season Identification
API-Football identifies seasons by the **year the season started**:
- 2025/26 European/Israeli season → `season=2025`
- Query in April 2026 → use `season=2025` (not 2026)

`deriveSeason()` helper in `src/lib/providers/api-football/index.ts`: `month < 7 ? year - 1 : year`

### Nullable Fields (confirmed from production)
- `fixture.venue.id` — nullable (some Champions League fixtures)
- `league.flag` — nullable (international competitions like UCL, World Cup)
- `goals.home`, `goals.away` — nullable pre-match

### Country Names
- International competitions (UCL, Europa League, World Cup): `"World"`
- Israel: `"Israel"`
- England, Spain, Germany, etc.: standard names (same as expected)

### Known Entity IDs
| Entity | Type | Provider ID |
|--------|------|-------------|
| Maccabi Haifa | team | `4195` |
| Ligat Ha'al | league | `383` |
| UEFA Champions League | league | `2` |
| UEFA Europa League | league | `3` |
| UEFA Conference League | league | `848` |
| Premier League (England) | league | `39` |
| La Liga (Spain) | league | `140` |
| Serie A (Italy) | league | `135` |
| Bundesliga (Germany) | league | `78` |
| Ligue 1 (France) | league | `61` |

### Status Codes
| Code | Meaning | Maps to |
|------|---------|---------|
| `NS` | Not Started | `scheduled` |
| `1H`, `HT`, `2H`, `ET`, `P` | In Play | `live` |
| `FT`, `AET`, `PEN` | Finished | `closed` |
| `PST` | Postponed | `postponed` |
| `CANC` | Cancelled | `cancelled` |
| `ABD`, `SUSP` | Abandoned/Suspended | `delayed` |

---

## Bugs Encountered and Fixed

### 1. ES Module import hoisting — `DATABASE_URL undefined` in bootstrap script
**Symptom:** `TypeError: Invalid URL` when running `npm run bootstrap`.
**Cause:** `dotenv.config()` ran after ES module imports were evaluated — DB client initialized before env vars were injected.
**Fix:** Lazy DB client via Proxy in `src/lib/db/index.ts`. Double-cast `as unknown as Record<...>` required for strict TypeScript build.

### 2. SportRadar competitor schedule — wrong field name in Zod schema
**Symptom:** Sync failed with `"expected array, received undefined"` at `sport_events`.
**Fix:** Updated schema to `{ schedules: [{ sport_event }] }` and extraction accordingly.

### 3. Competition name stored as "Unknown Competition"
**Fix:** Read from `event.sport_event_context.competition.name` (not `event.tournament`).

### 4. Competition seasons ordered oldest-first (SportRadar)
**Fix:** Take `seasons[seasons.length - 1]` for current season.

### 5. Real Madrid subscription was the Women's team
**Fix:** Bootstrap appends `(W)` suffix when parent competition contains "Women"; `(U19)` for youth competitions.

### 6. Rate limiting 429s during sync (SportRadar)
**Fix:** Added 1.1s delay between entity syncs. Removed after migration to API-Football (300 req/min limit — no delay needed).

### 7. API-Football season year off by one
**Symptom:** `getSchedule()` with `season=2026` returned 0 fixtures for Israeli/European leagues.
**Cause:** `from.getFullYear()` returns 2026 in April, but the 2025/26 season is identified as `2025`.
**Fix:** `deriveSeason()` helper: `month < 7 ? year - 1 : year`.

---

## Infrastructure Setup Notes

### Supabase connection
Use `postgres` npm package with explicit host/port/password (not connection URL string) to avoid SSL option conflicts. `decodeURIComponent` the password — special chars break URL parsing.

### drizzle-kit vs app DB connection
`drizzle-kit` requires `?sslmode=require` appended to URL. Runtime connection uses explicit `ssl` option. `drizzle.config.ts` appends the param if missing.

### Vercel environment variables (production)
| Variable | Value |
|----------|-------|
| `SPORTS_PROVIDER` | `api-football` |
| `API_FOOTBALL_KEY` | *(Pro plan key — see `.env.local`)* |
| `SPORTRADAR_API_KEY` | *(retained but inactive — SportRadar provider preserved as fallback)* |

### Vercel deployment
- Auth.js requires exact callback URL registered in Google Cloud Console: `https://YOUR_DOMAIN/api/auth/callback/google`
- Both JS origin AND redirect URI must be in Google Cloud Console

---

## Data State (as of April 11, 2026)

### `subscribable_entities`
- 1,220 competitions (API-Football, `current=true`)
- ~7,735 teams across priority leagues
- All rows: `provider = 'api-football'`
- No SportRadar rows remain

### `sport_events`
- 2 Maccabi Haifa fixtures (confirmed live post-migration):
  - Maccabi Haifa vs Ironi Kiryat Shmona — Apr 12, Ligat Ha'al, Sammy Ofer Stadium
  - Maccabi Tel Aviv vs Maccabi Haifa — Apr 15, State Cup, Bloomfield Stadium
- All rows: `provider = 'api-football'`

### Active subscriptions
- Wiped during v2.0 migration (clean restart)
- Roy re-subscribed to Maccabi Haifa (verified working — 2 events synced)

---

## Open Questions / Next Steps

1. **Sync window** — syncs next 90 days. Fixtures beyond that won't appear until within range.
2. **Google OAuth errors** — 3 callback errors observed in runtime logs around migration time. May be stale sessions. Monitor.
3. **API-Football Pro plan renewal** — expires 2026-05-08. Set a reminder.
