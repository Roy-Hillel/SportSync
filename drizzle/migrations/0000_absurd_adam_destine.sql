CREATE TABLE "sport_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"provider" text NOT NULL,
	"home_team_name" text NOT NULL,
	"away_team_name" text NOT NULL,
	"competition_name" text NOT NULL,
	"home_team_provider_id" text,
	"away_team_provider_id" text,
	"competition_provider_id" text,
	"season_provider_id" text,
	"start_time" timestamp with time zone NOT NULL,
	"venue" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"data_hash" text NOT NULL,
	"last_fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sport_events_provider_id_provider" UNIQUE("provider_id","provider")
);
--> statement-breakpoint
CREATE TABLE "subscribable_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"provider" text NOT NULL,
	"entity_type" text NOT NULL,
	"display_name" text NOT NULL,
	"logo_url" text,
	"country" text,
	"parent_provider_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscribable_entities_provider_id_provider" UNIQUE("provider_id","provider")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_entity" UNIQUE("user_id","entity_id")
);
--> statement-breakpoint
CREATE TABLE "sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"events_created" integer DEFAULT 0 NOT NULL,
	"events_updated" integer DEFAULT 0 NOT NULL,
	"events_unchanged" integer DEFAULT 0 NOT NULL,
	"events_removed" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"calendar_token" text NOT NULL,
	"sync_window_weeks" integer DEFAULT 8 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_calendar_token_unique" UNIQUE("calendar_token")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_entity_id_subscribable_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."subscribable_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_log" ADD CONSTRAINT "sync_log_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sport_events_start_time_idx" ON "sport_events" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "sport_events_competition_provider_id_idx" ON "sport_events" USING btree ("competition_provider_id");--> statement-breakpoint
CREATE INDEX "sport_events_home_team_provider_id_idx" ON "sport_events" USING btree ("home_team_provider_id");--> statement-breakpoint
CREATE INDEX "sport_events_away_team_provider_id_idx" ON "sport_events" USING btree ("away_team_provider_id");--> statement-breakpoint
CREATE INDEX "subscribable_entities_display_name_idx" ON "subscribable_entities" USING btree ("display_name");--> statement-breakpoint
CREATE INDEX "subscribable_entities_entity_type_idx" ON "subscribable_entities" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "subscribable_entities_parent_provider_id_idx" ON "subscribable_entities" USING btree ("parent_provider_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");