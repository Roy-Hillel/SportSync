// ---------------------------------------------------------------------------
// SportRadar implementation of SportsDataProvider
//
// Maps SportRadar API responses to provider-agnostic domain types.
// The rest of the app never imports from this file directly — it uses the
// SportsDataProvider interface.
// ---------------------------------------------------------------------------

import type {
  SportsDataProvider,
  ProviderEntity,
  ProviderEvent,
  EventStatus,
  EntityType,
} from "../types";
import { getSportRadarClient } from "./client";
import {
  CompetitionsResponseSchema,
  CompetitorScheduleResponseSchema,
  SeasonScheduleResponseSchema,
  SeasonCompetitorsResponseSchema,
  CompetitionSeasonsResponseSchema,
  type SportRadarSportEvent,
} from "./api-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapStatus(srStatus: string | undefined): EventStatus {
  switch (srStatus) {
    case "not_started":
      return "scheduled";
    case "live":
    case "started":
      return "live";
    case "closed":
      return "closed";
    case "cancelled":
    case "abandoned":
      return "cancelled";
    case "postponed":
      return "postponed";
    case "delayed":
    case "interrupted":
      return "delayed";
    default:
      return "scheduled";
  }
}

function mapSportEvent(event: SportRadarSportEvent): ProviderEvent | null {
  const home = event.competitors.find((c) => c.qualifier === "home");
  const away = event.competitors.find((c) => c.qualifier === "away");

  // Both teams and a start time are required for a valid calendar event.
  if (!home || !away || !event.start_time) return null;

  const startTime = new Date(event.start_time);
  if (isNaN(startTime.getTime())) return null;

  const competition =
    event.sport_event_context?.competition ?? event.tournament;
  const season =
    event.sport_event_context?.season ?? event.season;

  return {
    providerId: event.id,
    homeTeamName: home.name,
    awayTeamName: away.name,
    competitionName: competition?.name ?? "Unknown Competition",
    homeTeamProviderId: home.id,
    awayTeamProviderId: away.id,
    competitionProviderId: competition?.id,
    seasonProviderId: season?.id,
    startTime,
    venue: event.venue?.name,
    status: mapStatus(event.sport_event_status?.status),
  };
}

// ---------------------------------------------------------------------------
// SportRadar provider
// ---------------------------------------------------------------------------

export class SportRadarProvider implements SportsDataProvider {
  readonly name = "sportradar";

  private get client() {
    return getSportRadarClient();
  }

  async searchEntities(query: string): Promise<ProviderEntity[]> {
    // SportRadar does not have a free-text search endpoint — filter from the
    // cached competitions list. Real search is done against the local DB cache.
    // This method is here for interface completeness; the app uses the DB cache.
    const all = await this.listCompetitions();
    const q = query.toLowerCase();
    return all.filter((e) => e.displayName.toLowerCase().includes(q));
  }

  async listCompetitions(): Promise<ProviderEntity[]> {
    const data = await this.client.get(
      "/competitions.json",
      CompetitionsResponseSchema
    );

    return data.competitions.map((c) => ({
      providerId: c.id,
      entityType: "competition" as EntityType,
      displayName: c.name,
      country: c.category?.name,
      parentProviderId: c.parent_id,
    }));
  }

  async listTeamsInCompetition(
    competitionProviderId: string
  ): Promise<ProviderEntity[]> {
    // Get the most recent season for this competition first.
    const seasonsData = await this.client.get(
      `/competitions/${competitionProviderId}/seasons.json`,
      CompetitionSeasonsResponseSchema
    );

    if (seasonsData.seasons.length === 0) return [];

    // Seasons are ordered oldest first; take the last one for the current season.
    const currentSeason = seasonsData.seasons[seasonsData.seasons.length - 1];

    const competitorsData = await this.client.get(
      `/seasons/${currentSeason.id}/competitors.json`,
      SeasonCompetitorsResponseSchema
    );

    return competitorsData.season_competitors.map((c) => ({
      providerId: c.id,
      entityType: "team" as EntityType,
      displayName: c.name,
      country: c.country,
      logoUrl: c.logo_url,
      parentProviderId: competitionProviderId,
    }));
  }

  async getSchedule(
    entity: ProviderEntity,
    from: Date,
    to: Date
  ): Promise<ProviderEvent[]> {
    let events: SportRadarSportEvent[];

    if (entity.entityType === "competition") {
      events = await this.getCompetitionSchedule(entity.providerId, from, to);
    } else {
      // team and nation both use the competitor schedule endpoint
      events = await this.getCompetitorSchedule(entity.providerId, from, to);
    }

    const mapped = events
      .map(mapSportEvent)
      .filter((e): e is ProviderEvent => e !== null);

    // Filter to the requested date range.
    return mapped.filter((e) => e.startTime >= from && e.startTime <= to);
  }

  private async getCompetitorSchedule(
    competitorId: string,
    _from: Date,
    _to: Date
  ): Promise<SportRadarSportEvent[]> {
    const data = await this.client.get(
      `/competitors/${competitorId}/schedules.json`,
      CompetitorScheduleResponseSchema
    );
    return data.schedules.map((s) => s.sport_event);
  }

  private async getCompetitionSchedule(
    competitionId: string,
    _from: Date,
    _to: Date
  ): Promise<SportRadarSportEvent[]> {
    // Need the current season first.
    const seasonsData = await this.client.get(
      `/competitions/${competitionId}/seasons.json`,
      CompetitionSeasonsResponseSchema
    );

    if (seasonsData.seasons.length === 0) return [];

    // Seasons are ordered oldest first; take the last one for the current season.
    const currentSeason = seasonsData.seasons[seasonsData.seasons.length - 1];

    const data = await this.client.get(
      `/seasons/${currentSeason.id}/schedules.json`,
      SeasonScheduleResponseSchema
    );

    return data.schedules.map((s) => s.sport_event);
  }
}

// Singleton instance
let _provider: SportRadarProvider | null = null;

export function getSportRadarProvider(): SportRadarProvider {
  if (!_provider) _provider = new SportRadarProvider();
  return _provider;
}
