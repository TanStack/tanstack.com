CREATE TABLE IF NOT EXISTS "workflow_runs" (
  "run_id" text PRIMARY KEY,
  "workflow_id" text NOT NULL,
  "workflow_version" text,
  "status" text NOT NULL,
  "input" jsonb NOT NULL,
  "output" jsonb,
  "error" jsonb,
  "waiting_for" jsonb,
  "pending_approval" jsonb,
  "wake_at" bigint,
  "lease_owner" text,
  "lease_expires_at" bigint,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_runs_status_idx" ON "workflow_runs" ("status", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_runs_lease_idx" ON "workflow_runs" ("status", "lease_expires_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workflow_run_states" (
  "run_id" text PRIMARY KEY,
  "workflow_id" text NOT NULL,
  "workflow_version" text,
  "status" text NOT NULL,
  "input" jsonb NOT NULL,
  "output" jsonb,
  "error" jsonb,
  "waiting_for" jsonb,
  "pending_approval" jsonb,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workflow_event_locks" (
  "run_id" text PRIMARY KEY,
  "created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workflow_events" (
  "run_id" text NOT NULL,
  "event_index" integer NOT NULL,
  "event_type" text NOT NULL,
  "step_id" text,
  "event" jsonb NOT NULL,
  "created_at" bigint NOT NULL,
  CONSTRAINT "workflow_events_run_id_event_index_pk" PRIMARY KEY ("run_id", "event_index")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_events_type_idx" ON "workflow_events" ("run_id", "event_type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workflow_timers" (
  "run_id" text NOT NULL,
  "signal_id" text NOT NULL,
  "workflow_id" text NOT NULL,
  "workflow_version" text,
  "wake_at" bigint NOT NULL,
  "lease_owner" text,
  "lease_expires_at" bigint,
  CONSTRAINT "workflow_timers_run_id_signal_id_pk" PRIMARY KEY ("run_id", "signal_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_timers_due_idx" ON "workflow_timers" ("wake_at", "lease_expires_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workflow_signal_deliveries" (
  "run_id" text NOT NULL,
  "signal_id" text NOT NULL,
  "created_at" bigint NOT NULL,
  CONSTRAINT "workflow_signal_deliveries_run_id_signal_id_pk" PRIMARY KEY ("run_id", "signal_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workflow_schedules" (
  "schedule_id" text PRIMARY KEY,
  "workflow_id" text NOT NULL,
  "workflow_version" text,
  "schedule" jsonb NOT NULL,
  "overlap_policy" text NOT NULL,
  "input" jsonb,
  "next_fire_at" bigint,
  "enabled" boolean NOT NULL,
  "updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_schedules_due_idx" ON "workflow_schedules" ("enabled", "next_fire_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workflow_schedule_buckets" (
  "schedule_id" text NOT NULL,
  "bucket_id" text NOT NULL,
  "workflow_id" text NOT NULL,
  "workflow_version" text,
  "run_id" text NOT NULL,
  "fire_at" bigint NOT NULL,
  "input" jsonb,
  "overlap_policy" text NOT NULL,
  "status" text NOT NULL,
  "lease_owner" text,
  "lease_expires_at" bigint,
  "started_at" bigint,
  CONSTRAINT "workflow_schedule_buckets_schedule_id_bucket_id_pk" PRIMARY KEY ("schedule_id", "bucket_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_schedule_buckets_lease_idx" ON "workflow_schedule_buckets" ("status", "fire_at", "lease_expires_at");
