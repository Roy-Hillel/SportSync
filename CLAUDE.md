# SportSync — Claude Context

## What This App Does

SportSync syncs sports match schedules into users' calendars via a personal iCal feed URL. Users sign in with Google, subscribe to teams/competitions, and subscribe to their feed URL in any calendar app. A cron job syncs events every 5 hours automatically.

**Key user flow:** Sign in → subscribe to "Real Madrid" or "UEFA Champions League" → copy webcal URL into Google Calendar → matches appear automatically.

## Architecture Decisions

### iCal Feed (not Google Calendar API)
The app generates a static `.ics` feed at `/calendar/[token]` — users subscribe to this URL. Calendar apps poll it. This means:
- No Google Calendar OAuth (simpler auth, no calendar write scope)
- Works with every calendar app, not just Google
- No push/webhook complexity; just a GET endpoint

### Global `sport_events` Table
Events are stored **once globally**, not per-user. User→event relationship is computed dynamically at iCal generation time:

```
WHERE home_team_provider_id IN (user's subscribed entity provider IDs)
   OR away_team_provider_id IN (...)
   OR competition_provider_id IN (...)
```

This keeps sync O(unique entities tracked) instead of O(users × entities).

### Provider Abstraction
Sports data is behind a `SportsDataProvider` interface (`src/lib/providers/types.ts`). SportRadar is the only implementation. Swap via `SPORTS_PROVIDER` env var.

### Hash-Based Change Detection
Each sport event stores a `data_hash` = MD5 of (startTime|home|away|competition|venue|status). Sync skips DB write if hash unchanged.

### Lazy DB Init
`src/lib/db/index.ts` uses a Proxy to defer client creation until first use. This allows bootstrap scripts to call `dotenv.config()` before the module initializes (ES import hoisting issue — static imports are evaluated before runtime code runs).

## Database (Supabase)

**Project ref:** stored in `.mcp.json` (gitignored — ask the user for it)

**Supabase MCP:** The project has a read-only Supabase MCP configured at `.mcp.json`. When available, use `mcp__supabase__execute_sql` to inspect the DB directly instead of writing diagnostic scripts.

### Tables

| Table | Key columns |
|---|---|
| `users` | `id`, `email`, `calendar_token`, `sync_window_weeks` |
| `subscribable_entities` | `id`, `provider_id`, `provider`, `entity_type`, `display_name`, `logo_url`, `country`, `parent_provider_id` |
| `subscriptions` | `id`, `user_id`, `entity_id` |
| `sport_events` | `id`, `provider_id`, `provider`, `home_team_name`, `away_team_name`, `competition_name`, `home_team_provider_id`, `away_team_provider_id`, `competition_provider_id`, `season_provider_id`, `start_time`, `venue`, `status`, `data_hash`, `last_fetched_at` |
| `sync_log` | `id`, `subscription_id`, `started_at`, `completed_at`, `events_created`, `events_updated`, `events_unchanged`, `events_removed`, `error` |

## SportRadar API Notes

**Base URL:** `https://api.sportradar.com/soccer/trial/v4/en`
**Auth:** `?api_key=KEY` query param
**Rate limit:** 1 req/sec on trial tier

### Endpoint shapes (important — differs from what you might expect)

- **Competitor schedule** (`/competitors/{id}/schedules.json`): returns `{ schedules: [{ sport_event, sport_event_status }] }` — NOT `sport_events[]`
- **Season schedule** (`/seasons/{id}/schedules.json`): same shape as competitor schedule
- **Competition seasons** (`/competitions/{id}/seasons.json`): `{ seasons: [...] }` — **ordered oldest first**, take `seasons[seasons.length - 1]` for current season
- **Competition name**: in `sport_event_context.competition.name` (not top-level `tournament`)

All API responses are validated with Zod in `src/lib/providers/sportradar/api-types.ts`.

### Known Limitations (trial API)
- Rate limit causes 429s if syncing many entities quickly
- Bootstrap takes ~7 min for full entity seed (389 competitions × 1.1s delay)
- TBD matches (semifinals, finals) use placeholder names like "WSF1", "WQF2" until brackets are set

## Display Name Conventions

Teams seeded by the bootstrap script get gender/age suffixes based on parent competition:
- Women's competition → `"Real Madrid (W)"`
- Youth competition → `"Real Madrid (U19)"`
- Men's (default) → `"Real Madrid"`

The `fix-display-names.ts` script backfills existing data using a SQL UPDATE JOIN.

## Sync Engine (`src/lib/sync/engine.ts`)

Core flow:
1. Get all unique entities subscribed to by any user (`getUniqueTrackedEntities`)
2. For each entity: fetch schedule from provider (now → +26 weeks)
3. Hash each incoming event; compare against stored hash
4. Batch insert/update in a DB transaction
5. Log to `sync_log`

`SyncResult` includes per-entity breakdown (`entities[]`) returned to the UI.

## iCal Generator (`src/lib/ical/generator.ts`)

Looks up user by `calendarToken`, gets their subscriptions, builds OR conditions matching provider IDs, filters by `sync_window_weeks`, excludes cancelled events, renders with `ical-generator`.

Feed URL format: `/calendar/[token]` — the token is a 32-byte hex string generated at first sign-in.

## Auth (`src/lib/auth.ts`)

- Auth.js v5 with Google provider (sign-in only — no calendar scope)
- On first sign-in: creates `users` row + generates `calendarToken` (crypto.randomBytes(32))
- Session strategy: JWT

## API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/auth/[...nextauth]` | * | — | Auth.js handler |
| `/calendar/[token]` | GET | token | iCal feed |
| `/api/subscriptions` | GET | session | List user subscriptions |
| `/api/subscriptions` | POST | session | Add subscription |
| `/api/subscriptions/[id]` | DELETE | session | Remove subscription |
| `/api/search` | GET | session | Search entities (`q`, `type`, `parentId`, `limit`) |
| `/api/sync` | POST | session | Manual sync trigger |
| `/api/cron/sync` | GET | `Authorization: Bearer CRON_SECRET` | Vercel cron |
| `/api/user` | GET/PATCH/DELETE | session | User profile |

## Environment Variables

See `.env.local.example`. All required:

- `DATABASE_URL` — Supabase pooler URL (Transaction mode, 5432)
- `AUTH_SECRET` — random 32-byte hex
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google OAuth credentials
- `SPORTRADAR_API_KEY` — SportRadar trial or paid key
- `CRON_SECRET` — random 32-byte hex, checked by cron endpoint
- `NEXTAUTH_URL` — app base URL

## Known Issues / Future Work

- **Champions League TBD teams**: placeholder names (WQF1 etc.) will auto-resolve on future syncs
- **Google Calendar refresh lag**: subscribed iCal feeds are polled by Google on their own schedule (up to 24h). No workaround — this is a Google limitation.
- **Trial API rate limits**: 429s on rapid consecutive syncs. The cron cadence (5h) is safe; manual rapid-fire syncs may fail for some entities.
- **Soccer only**: SportRadar Soccer v4. Adding other sports requires a new provider implementation.
- **Single calendar per user**: no calendar selection UI; all events go to one feed.

## Bootstrap Scripts

```bash
npm run bootstrap               # Full entity seed (~7 min, ~10k teams + 1265 competitions)
npm run bootstrap:fix-names     # Backfill (W)/(U19) suffixes — run after bootstrap if needed
```

Both scripts load `.env.local` via `dotenv` before importing the DB module (lazy init handles the rest).

## Deployment Checklist (Vercel)

1. Set all env vars in Vercel dashboard
2. Update `NEXTAUTH_URL` to production URL
3. Add production URL to Google Cloud Console OAuth redirect URIs
4. Run `npm run db:migrate` against production DB
5. Run `npm run bootstrap` against production DB (one-time)
6. Cron runs automatically per `vercel.json`
