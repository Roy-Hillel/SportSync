// ---------------------------------------------------------------------------
// API-Football implementation of SportsDataProvider
//
// Maps API-Football v3 responses to provider-agnostic domain types.
// The rest of the app never imports from this file directly — it uses the
// SportsDataProvider interface via src/lib/providers/index.ts.
//
// Key contract: all provider IDs are stringified with String() because
// API-Football returns integers while the interface expects strings.
// ---------------------------------------------------------------------------

import type {
  SportsDataProvider,
  ProviderEntity,
  ProviderEvent,
  EventStatus,
  EntityType,
} from "../types";
import { getApiFootballClient } from "./client";
import {
  FixturesResponseSchema,
  LeaguesResponseSchema,
  TeamsResponseSchema,
  type ApiFootballFixtureItem,
} from "./schemas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapStatus(short: string): EventStatus {
  switch (short) {
    case "NS":
      return "scheduled";
    case "1H":
    case "HT":
    case "2H":
    case "ET":
    case "P":
      return "live";
    case "FT":
    case "AET":
    case "PEN":
      return "closed";
    case "PST":
      return "postponed";
    case "CANC":
      return "cancelled";
    case "ABD":
    case "SUSP":
      return "delayed";
    default:
      return "scheduled";
  }
}

function mapFixture(item: ApiFootballFixtureItem): ProviderEvent | null {
  const startTime = new Date(item.fixture.date);
  if (isNaN(startTime.getTime())) return null;

  return {
    // All IDs stringified — API-Football returns integers, interface expects strings
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

// ---------------------------------------------------------------------------
// API-Football provider
// ---------------------------------------------------------------------------

export class ApiFootballProvider implements SportsDataProvider {
  readonly name = "api-football";

  private get client() {
    return getApiFootballClient();
  }

  async searchEntities(query: string): Promise<ProviderEntity[]> {
    // API-Football has no free-text search endpoint — filter from the cached
    // competitions list. Real search is done against the local DB cache.
    // This method is here for interface completeness.
    const all = await this.listCompetitions();
    const q = query.toLowerCase();
    return all.filter((e) => e.displayName.toLowerCase().includes(q));
  }

  async listCompetitions(): Promise<ProviderEntity[]> {
    const data = await this.client.get(
      "/leagues",
      { current: "true" },
      LeaguesResponseSchema
    );

    return data.response.map((item) => ({
      providerId: String(item.league.id),
      entityType: "competition" as EntityType,
      displayName: item.league.name,
      logoUrl: item.league.logo,
      country: item.country?.name,
    }));
  }

  async listTeamsInCompetition(
    competitionProviderId: string
  ): Promise<ProviderEntity[]> {
    // Use current calendar year as season — no season ID resolution needed (PROV-04)
    const season = new Date().getFullYear();

    const data = await this.client.get(
      "/teams",
      { league: competitionProviderId, season },
      TeamsResponseSchema
    );

    return data.response.map((item) => ({
      providerId: String(item.team.id),
      entityType: "team" as EntityType,
      displayName: item.team.name,
      logoUrl: item.team.logo,
      country: item.team.country ?? undefined,
      parentProviderId: competitionProviderId,
    }));
  }

  async getSchedule(
    entity: ProviderEntity,
    from: Date,
    to: Date
  ): Promise<ProviderEvent[]> {
    const season = from.getFullYear();
    const fmtFrom = from.toISOString().split("T")[0];
    const fmtTo = to.toISOString().split("T")[0];

    const params =
      entity.entityType === "competition"
        ? { league: entity.providerId, season, from: fmtFrom, to: fmtTo }
        : { team: entity.providerId, season, from: fmtFrom, to: fmtTo };

    const data = await this.client.get("/fixtures", params, FixturesResponseSchema);

    return data.response
      .map(mapFixture)
      .filter((e): e is ProviderEvent => e !== null);
  }
}

// Singleton instance
let _provider: ApiFootballProvider | null = null;

export function getApiFootballProvider(): ApiFootballProvider {
  if (!_provider) _provider = new ApiFootballProvider();
  return _provider;
}
