// ---------------------------------------------------------------------------
// API-Football v3 Zod schemas
//
// Covers /fixtures, /leagues, /teams endpoints.
// IMPORTANT: Several fields are nullable per confirmed real API behaviour:
//   - fixture.venue.id — null on some fixtures (e.g. Champions League neutrals)
//   - league.flag — null for international competitions
//   - goals.home / goals.away — null pre-match
// ---------------------------------------------------------------------------

import { z } from "zod";

// ---------------------------------------------------------------------------
// /fixtures — sub-schemas
// ---------------------------------------------------------------------------

const FixtureStatusSchema = z.object({
  short: z.string(),
  long: z.string().optional(),
  elapsed: z.number().nullable().optional(),
});

const FixtureVenueSchema = z.object({
  // CRITICAL: confirmed null on some Champions League fixtures (PROV-03)
  id: z.number().nullable(),
  name: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
});

const FixtureLeagueSchema = z.object({
  id: z.number(),
  name: z.string(),
  country: z.string().optional(),
  logo: z.string().optional(),
  // CRITICAL: null for international competitions (PROV-03)
  flag: z.string().nullable().optional(),
  season: z.number(),
  round: z.string().optional(),
});

const FixtureTeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  logo: z.string().optional(),
  winner: z.boolean().nullable().optional(),
});

const FixtureGoalsSchema = z.object({
  // Both null pre-match
  home: z.number().nullable(),
  away: z.number().nullable(),
});

const FixtureItemSchema = z.object({
  fixture: z.object({
    id: z.number(),
    date: z.string(),
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

// ---------------------------------------------------------------------------
// /leagues
// ---------------------------------------------------------------------------

const LeagueSchema = z.object({
  league: z.object({
    id: z.number(),
    name: z.string(),
    type: z.string().optional(),
    logo: z.string().optional(),
  }),
  country: z
    .object({
      name: z.string().optional(),
      code: z.string().nullable().optional(),
      flag: z.string().nullable().optional(),
    })
    .optional(),
});

export const LeaguesResponseSchema = z.object({
  response: z.array(LeagueSchema),
});

// ---------------------------------------------------------------------------
// /teams?league&season
// ---------------------------------------------------------------------------

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
