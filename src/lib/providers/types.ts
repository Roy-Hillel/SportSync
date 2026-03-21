// ---------------------------------------------------------------------------
// Provider-agnostic domain types
//
// These are the canonical types used throughout the app. Sports data providers
// map their API responses to these types. Nothing outside of src/lib/providers/
// should import provider-specific types.
// ---------------------------------------------------------------------------

export type EntityType = "competition" | "team" | "nation";

export type EventStatus =
  | "scheduled"
  | "live"
  | "closed"
  | "cancelled"
  | "postponed"
  | "delayed";

export interface ProviderEntity {
  /** Opaque ID from the provider, e.g. "sr:competitor:4419" */
  providerId: string;
  entityType: EntityType;
  displayName: string;
  logoUrl?: string;
  country?: string;
  /** For teams: the competition they primarily play in */
  parentProviderId?: string;
}

export interface ProviderEvent {
  /** Opaque ID from the provider */
  providerId: string;
  homeTeamName: string;
  awayTeamName: string;
  competitionName: string;
  homeTeamProviderId?: string;
  awayTeamProviderId?: string;
  competitionProviderId?: string;
  seasonProviderId?: string;
  startTime: Date;
  venue?: string;
  status: EventStatus;
}

// ---------------------------------------------------------------------------
// SportsDataProvider interface
//
// Implement this interface to add a new sports data source. The sync engine
// and entity bootstrap job use only this interface — they are unaware of
// any specific provider implementation.
// ---------------------------------------------------------------------------
export interface SportsDataProvider {
  /** Human-readable identifier, used as the "provider" column in the DB */
  readonly name: string;

  /**
   * Search for subscribable entities by name.
   * Returns competitions, teams, and nations matching the query.
   */
  searchEntities(query: string): Promise<ProviderEntity[]>;

  /**
   * Return all top-level competitions covered by this provider.
   * Used to bootstrap the browsable entity cache.
   */
  listCompetitions(): Promise<ProviderEntity[]>;

  /**
   * Return all teams participating in a given competition season.
   * @param competitionProviderId - provider ID of the competition
   */
  listTeamsInCompetition(
    competitionProviderId: string
  ): Promise<ProviderEntity[]>;

  /**
   * Fetch upcoming schedule for a specific entity.
   * The engine calls this for each unique entity being tracked.
   *
   * @param entity - the entity to fetch schedule for
   * @param from   - start of date range (inclusive)
   * @param to     - end of date range (inclusive)
   */
  getSchedule(
    entity: ProviderEntity,
    from: Date,
    to: Date
  ): Promise<ProviderEvent[]>;
}
