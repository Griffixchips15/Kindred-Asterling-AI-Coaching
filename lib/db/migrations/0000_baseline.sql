-- Baseline for every PostgreSQL object exported by src/schema/index.ts.
-- CREATE ... IF NOT EXISTS permits adoption of databases previously managed by
-- drizzle-kit push; subsequent numbered migrations reconcile legacy medication data.

CREATE TABLE IF NOT EXISTS "affirmations" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "entitlement_audit" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"actor_id" varchar,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" varchar NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_tokens_token_unique" UNIQUE("token")
);

CREATE TABLE IF NOT EXISTS "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"password_hash" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"preferred_name" varchar,
	"birthday" date,
	"struggles" text,
	"strengths" text,
	"interests" text,
	"bio" text,
	"motivational_quote" text,
	"phone" varchar,
	"timezone" varchar,
	"email_verified_at" timestamp with time zone,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "beta_grants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"granted_by" varchar NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" varchar
);

CREATE TABLE IF NOT EXISTS "body_scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"scanned_at" timestamp DEFAULT now() NOT NULL,
	"feelings" text[] DEFAULT '{}' NOT NULL,
	"energy_level" integer NOT NULL,
	"physical_sensations" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "calendar_connections" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'google' NOT NULL,
	"encrypted_refresh_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "daily_usage" (
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_usage_user_id_date_unique" UNIQUE("user_id","date")
);

CREATE TABLE IF NOT EXISTS "evening_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"date" date NOT NULL,
	"medication_effectiveness" integer NOT NULL,
	"overall_mood" text,
	"wins" text,
	"challenges" text,
	"tomorrow_intent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "habit_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"habit_id" integer NOT NULL,
	"user_id" varchar,
	"date" date NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "habits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"target_days" integer DEFAULT 90 NOT NULL,
	"start_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "morning_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"date" date NOT NULL,
	"mental_load_level" text NOT NULL,
	"mini_goals" text[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "medication_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"medication_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"date" date NOT NULL,
	"scheduled_time" text NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"effectiveness" integer
);

CREATE TABLE IF NOT EXISTS "medication_schedule_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"medication_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"scheduled_time" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date
);

CREATE TABLE IF NOT EXISTS "medications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"dosage" text NOT NULL,
	"times" text[] NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "subscriptions" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"email" varchar,
	"status" varchar DEFAULT 'inactive' NOT NULL,
	"payment_customer_id" varchar,
	"payment_subscription_id" varchar,
	"current_period_end" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "reminder_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"dose_time" text DEFAULT '' NOT NULL,
	"local_date" date NOT NULL,
	"channel" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "reminder_settings" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"morning_enabled" boolean DEFAULT false NOT NULL,
	"morning_time" text DEFAULT '08:00' NOT NULL,
	"medication_enabled" boolean DEFAULT false NOT NULL,
	"evening_enabled" boolean DEFAULT false NOT NULL,
	"evening_time" text DEFAULT '21:00' NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "processed_webhooks" (
	"webhook_id" varchar PRIMARY KEY NOT NULL,
	"event_type" varchar NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entitlement_audit_user_id_users_id_fk') THEN
    ALTER TABLE "entitlement_audit" ADD CONSTRAINT "entitlement_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entitlement_audit_actor_id_users_id_fk') THEN
    ALTER TABLE "entitlement_audit" ADD CONSTRAINT "entitlement_audit_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_verification_tokens_user_id_users_id_fk') THEN
    ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'beta_grants_user_id_users_id_fk') THEN
    ALTER TABLE "beta_grants" ADD CONSTRAINT "beta_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'beta_grants_granted_by_users_id_fk') THEN
    ALTER TABLE "beta_grants" ADD CONSTRAINT "beta_grants_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'beta_grants_revoked_by_users_id_fk') THEN
    ALTER TABLE "beta_grants" ADD CONSTRAINT "beta_grants_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendar_connections_user_id_users_id_fk') THEN
    ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_user_id_users_id_fk') THEN
    ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_usage_user_id_users_id_fk') THEN
    ALTER TABLE "daily_usage" ADD CONSTRAINT "daily_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'habit_entries_habit_id_habits_id_fk') THEN
    ALTER TABLE "habit_entries" ADD CONSTRAINT "habit_entries_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'habit_entries_user_id_users_id_fk') THEN
    ALTER TABLE "habit_entries" ADD CONSTRAINT "habit_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_conversation_id_conversations_id_fk') THEN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medication_logs_medication_id_medications_id_fk') THEN
    ALTER TABLE "medication_logs" ADD CONSTRAINT "medication_logs_medication_id_medications_id_fk" FOREIGN KEY ("medication_id") REFERENCES "public"."medications"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medication_logs_user_id_users_id_fk') THEN
    ALTER TABLE "medication_logs" ADD CONSTRAINT "medication_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medication_schedule_entries_medication_id_medications_id_fk') THEN
    ALTER TABLE "medication_schedule_entries" ADD CONSTRAINT "medication_schedule_entries_medication_id_medications_id_fk" FOREIGN KEY ("medication_id") REFERENCES "public"."medications"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medication_schedule_entries_user_id_users_id_fk') THEN
    ALTER TABLE "medication_schedule_entries" ADD CONSTRAINT "medication_schedule_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medications_user_id_users_id_fk') THEN
    ALTER TABLE "medications" ADD CONSTRAINT "medications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_user_id_users_id_fk') THEN
    ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reminder_deliveries_user_id_users_id_fk') THEN
    ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reminder_settings_user_id_users_id_fk') THEN
    ALTER TABLE "reminder_settings" ADD CONSTRAINT "reminder_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "IDX_email_verification_user" ON "email_verification_tokens" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" USING btree ("expire");
CREATE INDEX IF NOT EXISTS "IDX_calendar_connections_provider" ON "calendar_connections" USING btree ("provider");
CREATE UNIQUE INDEX IF NOT EXISTS "medication_logs_user_med_date_time_unique" ON "medication_logs" USING btree ("user_id","medication_id","date","scheduled_time");
CREATE INDEX IF NOT EXISTS "medication_schedule_entries_med_idx" ON "medication_schedule_entries" USING btree ("medication_id");
CREATE UNIQUE INDEX IF NOT EXISTS "reminder_deliveries_unique" ON "reminder_deliveries" USING btree ("user_id","type","local_date","dose_time","channel");
CREATE INDEX IF NOT EXISTS "reminder_deliveries_user_idx" ON "reminder_deliveries" USING btree ("user_id");