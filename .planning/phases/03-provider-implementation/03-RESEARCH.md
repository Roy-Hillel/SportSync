# Phase 3: Provider Implementation - Research

**Researched:** 2026-04-08
**Domain:** TypeScript / Zod / API-Football v3 / SportsDataProvider interface
**Confidence:** HIGH

---

## Summary

Phase 3 is a pure code addition. The `SportsDataProvider` interface is already defined, the Sportradar provider is a complete working reference implementation, and the API-Football v3 response shapes have been confirmed from real API calls (documented in `.claude/commands/api-football.md`). No unknowns remain about the interface contract, HTTP client pattern, or response shapes.

The new `ApiFootballProvider` must mirror the file structure of `src/lib/providers/sportradar/` (three files: `client.ts`, `api-types.ts`/`schemas.ts`, `index.ts`) and be registered in `src/lib/providers/index.ts` via the existing `PROVIDERS` map. The only meaningful complexity is mapping the flat API-Football fixture shape (a single object with `fixture`, `league`, `teams`, `goals` keys) to `ProviderEvent`, versus SportRadar's nested competitor/schedule shape.

The rate limiting change (remove 1.1s per-second delay from the sync engine) touches `src/lib/sync/engine.ts` — a file outside the providers directory. This must be handled carefully so it does not break the Sportradar fallback behavior.

**Primary recommendation:** Mirror the Sportradar implementation file-for-file. Map the confirmed real API response shape directly to Zod schemas, using `.nullable()` for the two known nullable fields. Register in the providers map; remove per-second delay from the engine.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROV-01 | `ApiFootballProvider` class exists at `src/lib/providers/api-football/` and fully implements `SportsDataProvider` | Interface contract fully read from `types.ts`; Sportradar pattern as reference |
| PROV-02 | Zod schemas exist for all API-Football response shapes (fixture, league, team) — runtime-validated | Real fixture response shape confirmed in `api-football.md`; Zod v4.3.6 installed |
| PROV-03 | Provider handles `fixture.venue.id = null` and `league.flag = null` without throwing | Both nulls documented from real API calls; Zod `.nullable()` confirmed working |
| PROV-04 | Provider uses `?league=<id>&season=<year>` query params directly (no seasons array hack) | API-Football exposes season as integer year param — no need to resolve season ID |
| PROV-05 | Per-second delay (1.1s) removed; provider respects 300 req/min limit only | Delay lives in `src/lib/sync/engine.ts` line 73 — must be removed there |
| PROV-06 | `SPORTS_PROVIDER=api-football` loads `ApiFootballProvider` | Registry pattern fully read from `src/lib/providers/index.ts` |
| PROV-07 | `API_FOOTBALL_KEY` env var used for authentication | Key already in `.env.local`; header is `x-apisports-key` |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 4.3.6 (installed) | Runtime schema validation of API responses | Already used by Sportradar provider; same pattern required |
| TypeScript | 5.9.3 | Type safety | Project standard |
| Next.js fetch | (built-in) | HTTP requests | Already used by Sportradar client; supports `next: { revalidate }` |

### No new dependencies required

All libraries needed already exist in the project. No `npm install` step.

---

## Architecture Patterns

### Recommended File Structure

```
src/lib/providers/api-football/
├── client.ts     # HTTP client — auth header, error class, singleton factory
├── schemas.ts    # Zod schemas for fixture, leagues, teams responses
└── index.ts      # ApiFootballProvider class implementing SportsDataProvider
```

This mirrors the Sportradar structure exactly (`client.ts`, `api-types.ts`, `index.ts`). The only name difference is `schemas.ts` vs `api-types.ts` — use `schemas.ts` per the plan.

### Pattern 1: HTTP Client (mirrors `sportradar/client.ts`)

```typescript
// src/lib/providers/api-football/client.ts
import { ZodSchema } from "zod";

const BASE_URL = "https://v3.football.api-sports.io";

export class ApiFootballApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string
  ) {
    super(message);
    this.name = "ApiFootballApiError";
  }
}

export class ApiFootballClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("API_FOOTBALL_KEY is required");
    this.apiKey = apiKey;
  }

  async get<T>(endpoint: string, params: Record<string, string | number>, schema: ZodSchema<T>): Promise<T> {
    const url = new URL(`${BASE_URL}${endpoint}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }

    const response = await fetch(url.toString(), {
      headers: { "x-apisports-key": this.apiKey },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new ApiFootballApiError(
        `API-Football error ${response.status}: ${response.statusText}`,
        response.status,
        endpoint
      );
    }

    const raw: unknown = await response.json();
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `API-Football response validation failed for ${endpoint}: ${parsed.error.message}`
      );
    }
    return parsed.data;
  }
}

let _client: ApiFootballClient | null = null;

export function getApiFootballClient(): ApiFootballClient {
  if (!_client) {
    const key = process.env.API_FOOTBALL_KEY;
    if (!key) throw new Error("API_FOOTBALL_KEY environment variable is not set");
    _client = new ApiFootballClient(key);
  }
  return _client;
}
```

**Key differences from Sportradar client:**
- Auth header is `x-apisports-key` (not `x-api-key`)
- Base URL is `https://v3.football.api-sports.io`
- `get()` takes a `params` object (query params) instead of embedding them in the endpoint string — cleaner for the league/season combo

### Pattern 2: Zod Schemas for API-Football Responses

The fixture response is a wrapper: `{ response: FixtureItem[] }`. Each item is a flat object with sub-objects.

```typescript
// src/lib/providers/api-football/schemas.ts
import { z } from "zod";

// --- Fixture response (GET /fixtures) ---

const FixtureStatusSchema = z.object({
  short: z.string(),  // "NS", "FT", "PST", "CANC", etc.
  long: z.string().optional(),
  elapsed: z.number().nullable().optional(),
});

const FixtureVenueSchema = z.object({
  id: z.number().nullable(),   // NULLABLE — confirmed null on some fixtures
  name: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
});

const FixtureLeagueSchema = z.object({
  id: z.number(),
  name: z.string(),
  country: z.string().optional(),
  logo: z.string().optional(),
  flag: z.string().nullable().optional(),  // NULLABLE — null for international competitions
  season: z.number(),  // integer year, e.g. 2025
  round: z.string().optional(),
});

const FixtureTeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  logo: z.string().optional(),
  winner: z.boolean().nullable().optional(),
});

const FixtureGoalsSchema = z.object({
  home: z.number().nullable(),   // null pre-match
  away: z.number().nullable(),   // null pre-match
});

const FixtureItemSchema = z.object({
  fixture: z.object({
    id: z.number(),
    date: z.string(),  // ISO 8601 datetime string
    timestamp: z.number().optional(),
    timezone: z.string().optional(),
    venue: FixtureVenueSchema,
    status: FixtureStatusSchema,
  }),
  league: FixtureLeagueSchema,
  teams: z.object({
    home: FixtureTeamSchema,
    away: FixtureTeamSchema,
  }),
  goals: FixtureGoalsSchema,
});

export type ApiFootballFixtureItem = z.infer<typeof FixtureItemSchema>;

export const FixturesResponseSchema = z.object({
  response: z.array(FixtureItemSchema),
});

// --- League response (GET /leagues) ---
const LeagueSchema = z.object({
  league: z.object({
    id: z.number(),
    name: z.string(),
    type: z.string().optional(),
    logo: z.string().optional(),
  }),
  country: z.object({
    name: z.string().optional(),
    code: z.string().nullable().optional(),
    flag: z.string().nullable().optional(),
  }).optional(),
});

export const LeaguesResponseSchema = z.object({
  response: z.array(LeagueSchema),
});

// --- Teams response (GET /teams?league=&season=) ---
const TeamResponseItemSchema = z.object({
  team: z.object({
    id: z.number(),
    name: z.string(),
    logo: z.string().optional(),
    country: z.string().nullable().optional(),
  }),
});

export const TeamsResponseSchema = z.object({
  response: z.array(TeamResponseItemSchema),
});
```

### Pattern 3: Provider Class (mirrors `sportradar/index.ts`)

```typescript
// src/lib/providers/api-football/index.ts
import type { SportsDataProvider, ProviderEntity, ProviderEvent, EventStatus } from "../types";
import { getApiFootballClient } from "./client";
import { FixturesResponseSchema, LeaguesResponseSchema, TeamsResponseSchema, type ApiFootballFixtureItem } from "./schemas";

function mapStatus(short: string): EventStatus {
  switch (short) {
    case "NS": return "scheduled";
    case "1H": case "HT": case "2H": case "ET": case "P": return "live";
    case "FT": case "AET": case "PEN": return "closed";
    case "PST": return "postponed";
    case "CANC": return "cancelled";
    case "ABD": case "SUSP": return "delayed";
    default: return "scheduled";
  }
}

function mapFixture(item: ApiFootballFixtureItem): ProviderEvent | null {
  const startTime = new Date(item.fixture.date);
  if (isNaN(startTime.getTime())) return null;

  return {
    providerId: String(item.fixture.id),
    homeTeamName: item.teams.home.name,
    awayTeamName: item.teams.away.name,
    competitionName: item.league.name,
    homeTeamProviderId: String(item.teams.home.id),
    awayTeamProviderId: String(item.teams.away.id),
    competitionProviderId: String(item.league.id),
    seasonProviderId: String(item.league.season),
    startTime,
    venue: item.fixture.venue.name ?? undefined,
    status: mapStatus(item.fixture.status.short),
  };
}

export class ApiFootballProvider implements SportsDataProvider {
  readonly name = "api-football";

  private get client() { return getApiFootballClient(); }

  async searchEntities(query: string): Promise<ProviderEntity[]> {
    // Same as Sportradar: no free-text search endpoint; filter from competitions cache
    const all = await this.listCompetitions();
    const q = query.toLowerCase();
    return all.filter((e) => e.displayName.toLowerCase().includes(q));
  }

  async listCompetitions(): Promise<ProviderEntity[]> {
    const data = await this.client.get("/leagues", { current: "true" }, LeaguesResponseSchema);
    return data.response.map((item) => ({
      providerId: String(item.league.id),
      entityType: "competition" as const,
      displayName: item.league.name,
      country: item.country?.name,
    }));
  }

  async listTeamsInCompetition(competitionProviderId: string): Promise<ProviderEntity[]> {
    // API-Football uses integer season year directly — no seasons lookup needed (PROV-04)
    const season = new Date().getFullYear();
    const data = await this.client.get("/teams", { league: competitionProviderId, season }, TeamsResponseSchema);
    return data.response.map((item) => ({
      providerId: String(item.team.id),
      entityType: "team" as const,
      displayName: item.team.name,
      country: item.team.country ?? undefined,
      logoUrl: item.team.logo,
      parentProviderId: competitionProviderId,
    }));
  }

  async getSchedule(entity: ProviderEntity, from: Date, to: Date): Promise<ProviderEvent[]> {
    const season = from.getFullYear();
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const params: Record<string, string | number> =
      entity.entityType === "competition"
        ? { league: entity.providerId, season, from: fmt(from), to: fmt(to) }
        : { team: entity.providerId, season, from: fmt(from), to: fmt(to) };

    const data = await this.client.get("/fixtures", params, FixturesResponseSchema);
    return data.response
      .map(mapFixture)
      .filter((e): e is ProviderEvent => e !== null);
  }
}

let _provider: ApiFootballProvider | null = null;

export function getApiFootballProvider(): ApiFootballProvider {
  if (!_provider) _provider = new ApiFootballProvider();
  return _provider;
}
```

### Pattern 4: Provider Registry Update (`src/lib/providers/index.ts`)

```typescript
import { getSportRadarProvider } from "./sportradar";
import { getApiFootballProvider } from "./api-football";

const PROVIDERS: Record<string, () => SportsDataProvider> = {
  sportradar: getSportRadarProvider,
  "api-football": getApiFootballProvider,
};
```

No other changes to `index.ts`.

### Pattern 5: Remove Per-Second Delay from Sync Engine

In `src/lib/sync/engine.ts`, line 73:
```typescript
// REMOVE THIS LINE:
if (i > 0) await new Promise((r) => setTimeout(r, 1100));
```

Also remove the comment block above it (lines 70-73) explaining the SportRadar 1 req/sec limit. API-Football is 300 req/min — the cron cadence (5h, typically 4-8 entities) will never approach this limit.

**IMPORTANT:** This edit must preserve the surrounding `for` loop structure. Only delete the delay lines; keep `syncEntity` call and error handling intact.

### Anti-Patterns to Avoid

- **Don't use numeric types for `providerId`**: The `SportsDataProvider` interface uses `string` for all IDs. API-Football returns integers — always `String(id)` when mapping.
- **Don't throw on nullable fields**: `fixture.venue.id` and `league.flag` are null in real data. Zod schemas must use `.nullable()`, not `.optional()` alone.
- **Don't use `seasons.length - 1` hack**: The whole point of PROV-04 is that API-Football takes `?season=2025` as a year integer, not a resolved season ID string. No seasons lookup step.
- **Don't forget `from`/`to` date filtering in `getSchedule`**: The Sportradar implementation relies on the engine's date window being passed directly. API-Football's `/fixtures` endpoint supports `from`/`to` params natively — use them.
- **Don't hard-code the season year**: Derive it from `from.getFullYear()` in `getSchedule()` or `new Date().getFullYear()` in `listTeamsInCompetition()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Response validation | Manual type assertions | Zod schemas (already installed) | Type narrowing at runtime; fail loudly at API boundary |
| HTTP error handling | Raw fetch status checks | Wrap in typed error class (see `ApiFootballApiError`) | Consistent error surfacing; matches Sportradar pattern |
| Provider switching | Custom if/else in each consumer | `PROVIDERS` map in `index.ts` | Already implemented; just add one entry |

---

## Common Pitfalls

### Pitfall 1: Numeric IDs vs String IDs

**What goes wrong:** API-Football returns all IDs as integers (`fixture.id: 1391120`, `teams.home.id: 529`). The `SportsDataProvider` interface expects `string` for `providerId`, `homeTeamProviderId`, etc. Passing integers will cause TypeScript type errors or silent DB schema mismatches (`provider_id` column is text).

**Why it happens:** The mapping function (`mapFixture`) must explicitly call `String(item.fixture.id)`.

**How to avoid:** Every numeric ID in the response must be stringified on mapping. Add a lint comment in `schemas.ts` or a note in `mapFixture`.

**Warning signs:** TypeScript error `Type 'number' is not assignable to type 'string'` in the mapping function.

---

### Pitfall 2: Season Year vs Season ID

**What goes wrong:** SportRadar uses opaque season IDs (e.g., `sr:season:106479`). If a developer tries to resolve a season ID before calling `/fixtures`, they'll get 404s or empty results because API-Football expects a plain integer year (`2025`).

**Why it happens:** Copying Sportradar's `getCompetitionSchedule` pattern which calls `/seasons.json` first.

**How to avoid:** Use `from.getFullYear()` directly as the `season` param. No seasons lookup.

**Warning signs:** Extra API call to a `/seasons` endpoint that doesn't exist in API-Football.

---

### Pitfall 3: Missing `.nullable()` in Zod for `venue.id` and `league.flag`

**What goes wrong:** Zod parse throws at runtime for fixtures where `fixture.venue.id` is `null` or `league.flag` is `null`. This affects Champions League fixtures and potentially Israeli league fixtures.

**Why it happens:** These fields look like they'd always be present (venues always have IDs; leagues always have country flags). Real API responses proved otherwise.

**How to avoid:** Use `z.number().nullable()` for `venue.id`, `z.string().nullable().optional()` for `league.flag`. Verified in real response in `api-football.md`.

**Warning signs:** `ZodError: expected number, received null` in sync logs.

---

### Pitfall 4: Rate Limit Delay Still Active for API-Football

**What goes wrong:** The 1.1s delay in `engine.ts` was added specifically for SportRadar's 1 req/sec limit. If left in place when using API-Football (300 req/min), a sync over 8 entities takes 8.8 unnecessary seconds.

**Why it happens:** The delay is provider-agnostic in `engine.ts` — it applies regardless of which provider is active.

**How to avoid:** Remove lines 70-73 from `engine.ts`. The comment explains it's for SportRadar; removing the code removes the constraint for all providers. API-Football's 300 req/min limit is far beyond any realistic sync load.

**Warning signs:** Sync takes >10s for a small entity list even with a fast provider.

---

### Pitfall 5: `API_FOOTBALL_KEY` Missing in Vercel

**What goes wrong:** The key is in `.env.local` but not added to Vercel's environment variables. Production deploys silently fall back to the missing-key error: `"API_FOOTBALL_KEY environment variable is not set"`.

**How to avoid:** Plan 3.2 must include an explicit task to add `API_FOOTBALL_KEY` and set `SPORTS_PROVIDER=api-football` in Vercel dashboard. Also update `.env.local.example` to document both new vars.

---

## Key Data: Confirmed API-Football Response Shape

From a real API call on 2026-04-08 (documented in `.claude/commands/api-football.md`):

```json
{
  "fixture": {
    "id": 1391120,
    "date": "2026-04-11T16:30:00+00:00",
    "venue": { "id": 19939, "name": "Camp Nou", "city": "Barcelona" },
    "status": { "long": "Not Started", "short": "NS", "elapsed": null }
  },
  "league": {
    "id": 140, "name": "La Liga", "country": "Spain",
    "logo": "...", "flag": "https://media.api-sports.io/flags/es.svg",
    "season": 2025, "round": "Regular Season - 31"
  },
  "teams": {
    "home": { "id": 529, "name": "Barcelona", "logo": "...", "winner": null },
    "away": { "id": 540, "name": "Espanyol", "logo": "...", "winner": null }
  },
  "goals": { "home": null, "away": null }
}
```

**Known nullable fields (from real data):**
- `fixture.venue.id` — null on some Champions League fixtures
- `league.flag` — null for international competitions (CL, World Cup)
- `goals.home`, `goals.away` — null pre-match
- `fixture.venue.name`, `fixture.venue.city` — may be absent on some fixtures

---

## Environment Availability

Step 2.6: SKIPPED — Phase 3 is a pure code addition. No new external services, databases, or CLI tools are required. API-Football key is already in `.env.local`. Zod, TypeScript, and Next.js are all installed.

**Existing env vars relevant to this phase:**

| Var | Location | Status |
|-----|----------|--------|
| `API_FOOTBALL_KEY` | `.env.local` | Present (value confirmed) |
| `SPORTS_PROVIDER` | `.env.local` | Not yet set (defaults to `sportradar`) |
| `API_FOOTBALL_KEY` | Vercel | Not yet added — task required in Plan 3.2 |
| `SPORTS_PROVIDER` | Vercel | Not yet set — task required in Plan 3.2 |

---

## Project Constraints (from CLAUDE.md)

From `CLAUDE.md` in the SportSync repo:

- **Tech stack locked:** Next.js 14 + Supabase + Vercel. No new frameworks.
- **Solo maintenance:** Changes should be minimal-footprint and well-documented.
- **Lazy DB init:** `src/lib/db/index.ts` uses a Proxy. Do not import DB directly in scripts without dotenv loaded first.
- **Provider abstraction:** Nothing outside `src/lib/providers/` should import provider-specific types.
- **GSD workflow:** Use `/gsd:execute-phase` for planned phase work — no direct edits outside GSD.
- **Hash-based change detection:** Sync engine already handles deduplication. Provider does not need to deduplicate events.
- **Files under 300 lines:** Keep implementation files concise. Split if needed.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| SportRadar seasons array hack (`seasons[seasons.length - 1]`) | API-Football direct `?season=YYYY` param | Eliminates one extra API call per competition sync |
| Per-second delay (1.1s × N entities) | No delay needed (300 req/min limit) | Faster sync runs |
| SportRadar opaque string IDs (`sr:competitor:4195`) | API-Football integer IDs as strings (`"4195"`) | Simpler, human-readable IDs |

---

## Open Questions

1. **Season year boundary for `listTeamsInCompetition`**
   - What we know: The method uses `new Date().getFullYear()` to derive the season.
   - What's unclear: If called in January 2026 for a league whose current season is 2025 (the 2025/26 season), `getFullYear()` returns `2026`, which may return 0 results.
   - Recommendation: Use `2025` as a default or derive from the competition's known season. For the bootstrap use case (Phase 4), the caller can pass the season explicitly. For Phase 3, document the limitation — it's out of scope here since bootstrap is Phase 4.

2. **`searchEntities` behavior**
   - What we know: API-Football has a `/teams?search=X` endpoint, but it lacks country metadata. The Sportradar implementation filters from `listCompetitions()` (in-memory), which only returns competitions, not teams.
   - What's unclear: Whether the new provider's `searchEntities` should also search teams. Looking at the codebase, `src/lib/providers/sportradar/index.ts` line 96-99 shows the method exists for interface completeness only — the app uses the DB cache for actual search.
   - Recommendation: Match the Sportradar stub exactly. Return filtered competitions from `listCompetitions()`. The app's `/api/search` route queries the `subscribable_entities` DB table, not the provider directly.

---

## Sources

### Primary (HIGH confidence)
- `src/lib/providers/types.ts` — full `SportsDataProvider` interface contract (read directly)
- `src/lib/providers/sportradar/client.ts` — HTTP client pattern (read directly)
- `src/lib/providers/sportradar/index.ts` — provider class pattern (read directly)
- `src/lib/providers/sportradar/api-types.ts` — Zod schema pattern (read directly)
- `src/lib/providers/index.ts` — provider registry pattern (read directly)
- `src/lib/sync/engine.ts` — per-second delay location confirmed at line 73 (read directly)
- `.claude/commands/api-football.md` — real API-Football v3 response shapes, confirmed nullables, known IDs (project research doc, confirmed from real API calls 2026-04-08)
- `.env.local` — `API_FOOTBALL_KEY` present; `SPORTS_PROVIDER` not yet set (read directly)
- `node_modules/zod/package.json` — version 4.3.6 installed, `.nullable()` API verified (confirmed via node)

### Secondary (MEDIUM confidence)
- `ENGINEERING_NOTES.md` — 1.1s delay rationale; SportRadar API quirks; history of why delay exists
- `.planning/REQUIREMENTS.md` — PROV-01 through PROV-07 definitions
- `.planning/ROADMAP.md` — Phase 3 plan structure

---

## Metadata

**Confidence breakdown:**
- Interface contract: HIGH — read directly from source
- HTTP client pattern: HIGH — copied from working Sportradar implementation
- Zod schema shapes: HIGH — derived from confirmed real API call data in `api-football.md`
- Nullable fields: HIGH — documented from real API responses on 2026-04-08
- Provider registry: HIGH — mechanism fully read from `index.ts`
- Rate limit delay location: HIGH — confirmed in `engine.ts` line 73
- Season year derivation: MEDIUM — known approach but edge case (Jan boundary) flagged as open question

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (API-Football Pro subscription end date; response shapes are stable)
