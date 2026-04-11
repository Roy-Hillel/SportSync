import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// users
// One row per authenticated user. Calendar token is the secret that generates
// their personal .ics feed URL — treat it like a password.
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  // The opaque token embedded in /calendar/{token}.ics
  // Generated on first sign-in, never changes unless user explicitly resets.
  calendarToken: text("calendar_token").notNull().unique(),
  syncWindowWeeks: integer("sync_window_weeks").notNull().default(8),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// subscribable_entities
// Cached snapshot of things users can subscribe to (leagues, teams, nations).
// Source-agnostic: provider field identifies where the ID comes from.
// Refreshed periodically by the entity bootstrap job.
// ---------------------------------------------------------------------------
export const subscribableEntities = pgTable(
  "subscribable_entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Opaque ID from the data provider (e.g. "sr:competitor:4419")
    providerId: text("provider_id").notNull(),
    // Which provider this ID belongs to (e.g. "sportradar")
    provider: text("provider").notNull(),
    // "competition" | "team" | "nation"
    entityType: text("entity_type").notNull(),
    displayName: text("display_name").notNull(),
    logoUrl: text("logo_url"),
    country: text("country"),
    // For teams: the competition they primarily play in (for browse-by-league UI)
    parentProviderId: text("parent_provider_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("subscribable_entities_provider_id_provider_entity_type").on(
      t.providerId,
      t.provider,
      t.entityType
    ),
    index("subscribable_entities_display_name_idx").on(t.displayName),
    index("subscribable_entities_entity_type_idx").on(t.entityType),
    index("subscribable_entities_parent_provider_id_idx").on(
      t.parentProviderId
    ),
  ]
);

// ---------------------------------------------------------------------------
// subscriptions
// Which entities a user has chosen to follow.
// ---------------------------------------------------------------------------
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => subscribableEntities.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("subscriptions_user_entity").on(t.userId, t.entityId),
    index("subscriptions_user_id_idx").on(t.userId),
  ]
);

// ---------------------------------------------------------------------------
// sport_events
// One row per match, globally. Not per-user — this is the single source of
// truth for match data fetched from the sports data provider.
//
// data_hash: MD5 of fields that affect a calendar event. Used to detect
// changes without re-fetching from the provider unnecessarily.
// ---------------------------------------------------------------------------
export const sportEvents = pgTable(
  "sport_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Opaque ID from the data provider
    providerId: text("provider_id").notNull(),
    provider: text("provider").notNull(),
    homeTeamName: text("home_team_name").notNull(),
    awayTeamName: text("away_team_name").notNull(),
    competitionName: text("competition_name").notNull(),
    // Provider IDs for the entities involved (for subscription matching)
    homeTeamProviderId: text("home_team_provider_id"),
    awayTeamProviderId: text("away_team_provider_id"),
    competitionProviderId: text("competition_provider_id"),
    seasonProviderId: text("season_provider_id"),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    venue: text("venue"),
    // "scheduled" | "live" | "closed" | "cancelled" | "postponed" | "delayed"
    status: text("status").notNull().default("scheduled"),
    // Hash of fields that would change a calendar event entry.
    // Recalculate on every provider fetch; skip DB write if unchanged.
    dataHash: text("data_hash").notNull(),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("sport_events_provider_id_provider").on(t.providerId, t.provider),
    index("sport_events_start_time_idx").on(t.startTime),
    index("sport_events_competition_provider_id_idx").on(
      t.competitionProviderId
    ),
    index("sport_events_home_team_provider_id_idx").on(t.homeTeamProviderId),
    index("sport_events_away_team_provider_id_idx").on(t.awayTeamProviderId),
  ]
);

// ---------------------------------------------------------------------------
// sync_log
// Audit trail for each sync run. Helps diagnose issues without needing logs.
// ---------------------------------------------------------------------------
export const syncLog = pgTable("sync_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  // null = full global sync; set = single subscription trigger
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
    onDelete: "set null",
  }),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  eventsCreated: integer("events_created").notNull().default(0),
  eventsUpdated: integer("events_updated").notNull().default(0),
  eventsUnchanged: integer("events_unchanged").notNull().default(0),
  eventsRemoved: integer("events_removed").notNull().default(0),
  error: text("error"),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const subscribableEntitiesRelations = relations(
  subscribableEntities,
  ({ many }) => ({
    subscriptions: many(subscriptions),
  })
);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
  entity: one(subscribableEntities, {
    fields: [subscriptions.entityId],
    references: [subscribableEntities.id],
  }),
}));
