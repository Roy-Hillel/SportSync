# SportSync — Engineering Notes

This document captures the engineering process, bugs encountered, decisions made, and open problems as of the end of the first build session. It is intended to give a new engineer or AI agent full working context without having to re-discover everything from scratch.

See `README.md` for setup instructions and `CLAUDE.md` for architecture reference. This file covers the *why*, the *journey*, and the *gotchas*.

---

## Current State (as of March 22, 2026)

### What is working
- Google OAuth sign-in and user creation
- Subscription management (add/remove teams and competitions)
- Entity search against the local `subscribable_entities` cache (~10k entries seeded)
- Sync engine: fetches schedules from SportRadar, upserts into `sport_events`, logs results
- iCal feed at `/calendar/[token]` — verified to return valid `.ics` with correct events
- Manual "Sync Now" button with per-entity results panel
- Vercel cron configured (`0 */5 * * *`)
- Production deployed at `https://sport-sync-lac.vercel.app`

### What is not working / open issues

**Israeli league teams return no future fixtures**
Maccabi Haifa (sr:competitor:5197) and Maccabi Tel Aviv (sr:competitor:5198) were subscribed to but synced 0 events. Investigation showed their `/competitors/{id}/schedules.json` response returns 30 events, all in the past (newest: December 2025). The Israeli Premier League fixtures for the rest of the 2025/26 season appear not to be published in SportRadar yet, or they are accessible via a different endpoint/competition path. This was not resolved — needs follow-up.

**Google Calendar refresh lag**
Google polls subscribed iCal feeds on its own schedule (up to 24h). The feed is correct and verified, but the user may not see events in Google Calendar immediately. No workaround exists — this is a Google limitation.

**Champions League bracket TBDs**
The final rounds (semifinals, final) currently show as "WSF1 vs WSF2" etc. because SportRadar hasn't assigned teams yet. These will auto-update on future syncs once the bracket fills in.

**SportRadar trial daily quota**
Trial plan = 1,000 requests/day. The initial bootstrap consumed ~778 requests. Be careful about running bootstrap + multiple syncs on the same day. Quota resets at midnight UTC.

---

## Bugs Encountered and Fixed

### 1. ES Module import hoisting — `DATABASE_URL undefined` in bootstrap script
**Symptom:** `TypeError: Invalid URL` when running `npm run bootstrap`.

**Cause:** The bootstrap script called `config({ path: ".env.local" })` at the top, but ES module `import` statements are hoisted and evaluated *before* any runtime code. By the time `dotenv.config()` ran, `src/lib/db/index.ts` had already been evaluated — and it called `createClient()` immediately at module load time, reading `process.env.DATABASE_URL` before dotenv had injected it.

**Fix:** Made the DB client lazy. `src/lib/db/index.ts` now exports a `Proxy` that defers `createClient()` until the first property access. The Proxy forwards all property gets to the lazily-created Drizzle instance. This means the database connection is only opened when first used, not when the module loads.

```ts
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
```

The `as unknown as Record<...>` double-cast was required for the TypeScript production build — omitting `unknown` caused a type error that only appeared in `npm run build`, not in `npm run dev`.

---

### 2. SportRadar competitor schedule — wrong field name in Zod schema
**Symptom:** Sync for team subscriptions (Real Madrid, Maccabi Haifa) failed with Zod validation error: `"expected array, received undefined"` at path `sport_events`.

**Cause:** The `CompetitorScheduleResponseSchema` expected `{ sport_events: [...] }` but the actual API response is `{ schedules: [{ sport_event, sport_event_status }] }` — identical structure to the season schedule endpoint.

**Fix:** Updated `CompetitorScheduleResponseSchema` to match:
```ts
schedules: z.array(z.object({ sport_event: SportEventSchema }))
```
And updated the provider to extract events the same way: `data.schedules.map((s) => s.sport_event)`.

---

### 3. Competition name stored as "Unknown Competition"
**Symptom:** Events synced correctly but `competition_name` was "Unknown Competition" and `competition_provider_id` was null.

**Cause:** `mapSportEvent()` read competition name from `event.tournament?.name`, but SportRadar's actual response nests it under `event.sport_event_context.competition.name`.

**Fix:** Added `sport_event_context` to `SportEventSchema` and updated `mapSportEvent` to prefer it:
```ts
const competition = event.sport_event_context?.competition ?? event.tournament;
```

---

### 4. Competition seasons ordered oldest-first
**Symptom:** Champions League subscription synced 0 events despite the endpoint working.

**Cause:** `/competitions/{id}/seasons.json` returns seasons ordered **oldest first**. The code took `seasons[0]` (the 23/24 season, already finished), fetched its schedule, and found 0 events in the future date window.

**Fix:** Changed both `getCompetitionSchedule` and `listTeamsInCompetition` to take `seasons[seasons.length - 1]`.

---

### 5. Real Madrid subscription was the Women's team
**Symptom:** Real Madrid subscription synced events for "Primera Division Women" and "UEFA Champions League Women".

**Cause:** The search results contained three "Real Madrid" entries with identical display names. The user picked `sr:competitor:522312` which is the women's team (`"gender": "female"` in their profile). The men's team is `sr:competitor:2829`.

**Root cause of the ambiguity:** The bootstrap seeds teams from competition rosters, and all three Real Madrids (men, women, U19) came from different competitions but had the same `display_name`.

**Fix:** Updated `seed-entities.ts` to append gender/age suffixes when the parent competition name contains "Women" or a youth age group (U19, U18, etc.):
- Women's competition → `"Real Madrid (W)"`
- Youth competition → `"Real Madrid (U19)"`

Created `fix-display-names.ts` to backfill existing data using a single SQL `UPDATE ... FROM` join (not row-by-row — that took too long on 10k+ teams).

---

### 6. Production build TypeScript error
**Symptom:** `npm run build` failed in CI/Vercel with a TypeScript error in `src/lib/db/index.ts` about the Proxy cast.

**Cause:** The cast `getDb() as Record<string | symbol, unknown>` was rejected by the TypeScript compiler in strict mode. The types don't overlap sufficiently.

**Fix:** `(getDb() as unknown as Record<string | symbol, unknown>)` — the double cast via `unknown` is the standard TypeScript escape hatch for this pattern.

---

### 7. Rate limiting 429s during sync
**Symptom:** After running bootstrap (which uses ~778 of the 1,000 daily API calls), subsequent syncs would 429 on one or more entities.

**Cause 1 — Per-second limit:** The sync engine processed entities in a `for` loop with no delay. Multiple entities synced back-to-back fired requests faster than 1/sec.

**Cause 2 — Daily limit:** The trial plan has 1,000 req/day. Heavy testing + bootstrap on the same day exhausts this.

**Fix for per-second limit:** Added a 1.1s delay between entity syncs:
```ts
if (i > 0) await new Promise((r) => setTimeout(r, 1100));
```

**Fix for daily limit:** Wait until midnight UTC. No code change needed — the cron's 5-hour cadence keeps daily usage well within quota in normal operation.

---

### 8. Bootstrap display name fix script ran slowly
**Symptom:** First version of `fix-display-names.ts` iterated over 10k+ teams and issued one DB UPDATE per row. Would have taken several minutes.

**Fix:** Rewrote to a single SQL `UPDATE ... FROM` join:
```sql
UPDATE subscribable_entities team
SET display_name = team.display_name || ' (W)'
FROM subscribable_entities comp
WHERE team.parent_provider_id = comp.provider_id
  AND team.entity_type = 'team'
  AND comp.display_name ILIKE '%women%'
  AND team.display_name NOT LIKE '%(W)%'
```
Ran in under 1 second. Updated 999 rows.

---

## Infrastructure Setup Notes

### Supabase connection
The `postgres` npm package has a conflict when SSL options are passed alongside a connection URL string. The workaround is to parse the URL components manually and pass them as separate options:
```ts
const url = new URL(process.env.DATABASE_URL!);
return postgres({
  host: url.hostname,
  port: Number(url.port) || 5432,
  database: url.pathname.slice(1),
  username: url.username,
  password: decodeURIComponent(url.password), // passwords may contain URL-encoded chars
  ssl: { rejectUnauthorized: false },
});
```
Note: `decodeURIComponent` on the password is important — passwords with `+` or other special characters will fail otherwise.

### drizzle-kit vs app DB connection
`drizzle-kit` (the CLI migration tool) requires `?sslmode=require` appended to the URL. The app's runtime connection (using the `postgres` npm package) does NOT use this — it uses the explicit `ssl` option instead. `drizzle.config.ts` handles this by appending the param if it's missing.

### Vercel deployment
- Vercel URL was not known before the first deploy — had to deploy with a placeholder `NEXTAUTH_URL`, then update it after getting the assigned URL
- Auth.js requires the exact callback URL registered in Google Cloud Console: `https://YOUR_DOMAIN/api/auth/callback/google`
- Both the JavaScript origin AND the redirect URI must be added to Google Cloud Console

---

## SportRadar API — Accumulated Knowledge

### Trial plan constraints
- **1 request/second** — enforced strictly; rapid-fire requests return 429
- **1,000 requests/day** — resets at midnight UTC
- **Coverage:** Major European leagues, Champions League, World Cup, Copa América, MLS, Brasileirão, plus many smaller leagues. Israeli league (Ligat Ha'Al) is present but fixture data may be incomplete.

### Endpoint quirks discovered through testing

**`/competitors/{id}/schedules.json`**
Returns recent past fixtures + near-future fixtures. For some teams (tested: Israeli Premier League teams), only past results are returned with no future fixtures. This appears to be a data availability issue, not an API bug — SportRadar may not have future fixture data for certain leagues on the trial tier.

**`/competitions/{id}/seasons.json`**
Seasons are ordered **oldest first** — always use `seasons[seasons.length - 1]` for the current season.

**Event location of competition name**
Always in `sport_event.sport_event_context.competition.name`. The top-level `tournament` field exists in some responses but is not reliable — `sport_event_context` is the canonical source.

**Competitor gender**
Not exposed in the schedule or search endpoints. Only available via `/competitors/{id}/profile.json`. Gender disambiguation is done via parent competition name (if competition name contains "Women" → team is women's).

**Known provider IDs for reference:**
- Real Madrid (men): `sr:competitor:2829`
- Real Madrid (W): `sr:competitor:522312`
- UEFA Champions League: `sr:competition:7`
- Premier League (England): `sr:competition:17`
- Israeli State Cup: `sr:competition:370`

---

## Data State (as of session end)

### `subscribable_entities`
- 1,265 competitions
- ~10,176 teams
- 999 teams with `(W)` suffix
- Teams without a parent competition in the seeded priority list have no suffix (may be ambiguous)

### `sport_events`
- 10 Real Madrid (men) fixtures: Primera Division Women (wrong) — these were seeded when the women's Real Madrid was still subscribed. After the user re-subscribed to the correct men's team and synced, these should now be correct LaLiga matches. Verify by checking `competition_name` in the DB.
- 13 UEFA Champions League fixtures (QFs through the final, some TBD team names)
- 0 Maccabi Haifa / Maccabi Tel Aviv events (Israeli league fixture data not available)

### Active subscriptions (production user)
- UEFA Champions League (`sr:competition:7`)
- Maccabi Haifa FC (`sr:competitor:5197`)
- Premier League (`sr:competition:17`) — added later; may have events after next successful sync
- Real Madrid — re-added after discovering it was the women's team; the correct men's ID is `sr:competitor:2829`

---

## Open Questions / Next Steps

1. **Israeli league fixtures** — investigate whether SportRadar has upcoming Israeli Premier League data via the competition schedule endpoint (`/competitions/{id}/seasons.json` → season schedule) rather than the competitor schedule endpoint. The competitor endpoint only returned past results.

2. **Verify Real Madrid events are now correct** — after the user removed the women's subscription and re-added the men's team, run a sync and confirm `competition_name` shows LaLiga matches, not women's competitions.

3. **Production bootstrap** — `subscribable_entities` in the production Supabase DB needs to be seeded. The user was using the same DB for dev and prod (same `DATABASE_URL`), so it may already be seeded. Confirm by checking the production DB.

4. **`fix-display-names` already applied** — the gender/age suffix backfill was run against the (shared) Supabase DB. No need to re-run.

5. **Cron first run** — Vercel cron will fire automatically every 5 hours. First automatic sync will happen within 5 hours of deploy.
