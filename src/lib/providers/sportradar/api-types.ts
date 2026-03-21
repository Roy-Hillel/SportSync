// ---------------------------------------------------------------------------
// Zod schemas for SportRadar Soccer API v4 responses
//
// These validate raw API responses at the boundary. If SportRadar changes
// their API shape, validation will fail loudly here rather than silently
// corrupting data downstream.
// ---------------------------------------------------------------------------

import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

const SportRadarId = z.string().min(1);

const CompetitorSchema = z.object({
  id: SportRadarId,
  name: z.string(),
  abbreviation: z.string().optional(),
  country: z.string().optional(),
  country_code: z.string().optional(),
  logo_url: z.string().url().optional(),
});

const VenueSchema = z.object({
  id: SportRadarId.optional(),
  name: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Sport event (match)
// ---------------------------------------------------------------------------

const SportEventStatusSchema = z.enum([
  "not_started",
  "live",
  "closed",
  "cancelled",
  "postponed",
  "delayed",
  "interrupted",
  "abandoned",
  "coverage_lost",
  "started",
]);

// SportRadar returns scheduled_start_time OR start_time_tbd
const SportEventSchema = z.object({
  id: SportRadarId,
  start_time: z.string().datetime({ offset: true }).optional(),
  start_time_tbd: z.boolean().optional(),
  // Older endpoints use top-level `tournament`; newer ones nest it in `sport_event_context`
  tournament: z
    .object({
      id: SportRadarId,
      name: z.string(),
    })
    .optional(),
  sport_event_context: z
    .object({
      competition: z
        .object({
          id: SportRadarId,
          name: z.string(),
        })
        .optional(),
      season: z
        .object({
          id: SportRadarId,
          name: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  season: z
    .object({
      id: SportRadarId,
      name: z.string().optional(),
    })
    .optional(),
  competitors: z
    .array(
      CompetitorSchema.extend({
        qualifier: z.enum(["home", "away"]),
      })
    )
    .min(2)
    .max(2),
  venue: VenueSchema.optional(),
  sport_event_status: z
    .object({
      status: SportEventStatusSchema.optional(),
      match_status: z.string().optional(),
    })
    .optional(),
});

export type SportRadarSportEvent = z.infer<typeof SportEventSchema>;

// ---------------------------------------------------------------------------
// Competitor (team / nation) schedule response
// ---------------------------------------------------------------------------

export const CompetitorScheduleResponseSchema = z.object({
  generated_at: z.string().optional(),
  schedules: z.array(
    z.object({
      sport_event: SportEventSchema,
    })
  ),
});

// ---------------------------------------------------------------------------
// Season schedule response
// ---------------------------------------------------------------------------

export const SeasonScheduleResponseSchema = z.object({
  generated_at: z.string().optional(),
  schedules: z.array(
    z.object({
      sport_event: SportEventSchema,
    })
  ),
});

// ---------------------------------------------------------------------------
// Competitions list response
// ---------------------------------------------------------------------------

export const CompetitionsResponseSchema = z.object({
  generated_at: z.string().optional(),
  competitions: z.array(
    z.object({
      id: SportRadarId,
      name: z.string(),
      parent_id: SportRadarId.optional(),
      category: z
        .object({
          id: SportRadarId.optional(),
          name: z.string().optional(),
          country_code: z.string().optional(),
        })
        .optional(),
    })
  ),
});

export type SportRadarCompetition = z.infer<
  typeof CompetitionsResponseSchema
>["competitions"][number];

// ---------------------------------------------------------------------------
// Season info (to get current season ID for a competition)
// ---------------------------------------------------------------------------

export const CompetitionSeasonsResponseSchema = z.object({
  seasons: z.array(
    z.object({
      id: SportRadarId,
      name: z.string().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      year: z.string().optional(),
      competition_id: SportRadarId.optional(),
    })
  ),
});

// ---------------------------------------------------------------------------
// Competitors in a season
// ---------------------------------------------------------------------------

export const SeasonCompetitorsResponseSchema = z.object({
  season_competitors: z.array(
    z.object({
      id: SportRadarId,
      name: z.string(),
      abbreviation: z.string().optional(),
      country: z.string().optional(),
      country_code: z.string().optional(),
      logo_url: z.string().url().optional(),
    })
  ),
});
