CREATE TYPE "public"."builder_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."builder_project_event_type" AS ENUM('project.created', 'project.updated', 'project.deleted', 'thread.created', 'thread.updated', 'thread.archived', 'revision.created', 'message.created', 'message.updated', 'message.deleted', 'run.created', 'run.started', 'run.activity', 'run.interrupted', 'run.completed', 'run.failed', 'run.cancelled');--> statement-breakpoint
CREATE TYPE "public"."builder_run_status" AS ENUM('pending', 'running', 'interrupted', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "builder_project_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"thread_id" uuid,
	"revision_id" uuid,
	"message_id" uuid,
	"run_id" uuid,
	"sequence" bigint NOT NULL,
	"client_event_id" uuid NOT NULL,
	"client_mutation_id" uuid,
	"browser_session_id" uuid,
	"type" "builder_project_event_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "builder_project_events_project_sequence_unique" UNIQUE("project_id","sequence"),
	CONSTRAINT "builder_project_events_project_client_event_unique" UNIQUE("project_id","client_event_id"),
	CONSTRAINT "builder_project_events_sequence_check" CHECK ("builder_project_events"."sequence" BETWEEN 1 AND 9007199254740991),
	CONSTRAINT "builder_project_events_payload_check" CHECK (jsonb_typeof("builder_project_events"."payload") = 'object' AND pg_column_size("builder_project_events"."payload") <= 262144),
	CONSTRAINT "builder_project_events_entity_reference_check" CHECK ((("builder_project_events"."type"::text NOT LIKE 'revision.%') OR "builder_project_events"."revision_id" IS NOT NULL)
        AND (("builder_project_events"."type"::text NOT LIKE 'thread.%') OR "builder_project_events"."thread_id" IS NOT NULL)
        AND (("builder_project_events"."type"::text NOT LIKE 'message.%') OR "builder_project_events"."message_id" IS NOT NULL)
        AND (("builder_project_events"."type"::text NOT LIKE 'run.%') OR "builder_project_events"."run_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "builder_project_legacy_imports" (
	"owner_id" uuid PRIMARY KEY NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "builder_project_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"run_id" uuid,
	"client_mutation_id" uuid NOT NULL,
	"position" bigint NOT NULL,
	"role" "builder_message_role" NOT NULL,
	"content" text NOT NULL,
	"parts" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "builder_project_messages_project_id_unique" UNIQUE("project_id","id"),
	CONSTRAINT "builder_project_messages_project_mutation_unique" UNIQUE("project_id","client_mutation_id"),
	CONSTRAINT "builder_project_messages_thread_position_unique" UNIQUE("project_id","thread_id","position"),
	CONSTRAINT "builder_project_messages_parts_check" CHECK (jsonb_typeof("builder_project_messages"."parts") = 'array' AND pg_column_size("builder_project_messages"."parts") <= 1048576),
	CONSTRAINT "builder_project_messages_content_size_check" CHECK (octet_length("builder_project_messages"."content") <= 1048576),
	CONSTRAINT "builder_project_messages_position_check" CHECK ("builder_project_messages"."position" BETWEEN 1 AND 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "builder_project_mutation_receipts" (
	"project_id" uuid NOT NULL,
	"client_mutation_id" uuid NOT NULL,
	"command_type" varchar(40) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "builder_project_mutation_receipts_pk" PRIMARY KEY("project_id","client_mutation_id"),
	CONSTRAINT "builder_project_mutation_receipts_command_type_check" CHECK ("builder_project_mutation_receipts"."command_type" IN ('project.create', 'project.revise', 'project.delete', 'thread.create', 'run.enqueue', 'run.claim', 'run.cancel', 'run.finish', 'run.finish.fallback', 'transcript.import')),
	CONSTRAINT "builder_project_mutation_receipts_request_hash_check" CHECK ("builder_project_mutation_receipts"."request_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "builder_project_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"client_mutation_id" uuid NOT NULL,
	"parent_revision_id" uuid,
	"revision_number" integer NOT NULL,
	"snapshot_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "builder_project_revisions_project_revision_unique" UNIQUE("project_id","revision_number"),
	CONSTRAINT "builder_project_revisions_project_id_unique" UNIQUE("project_id","id"),
	CONSTRAINT "builder_project_revisions_project_mutation_unique" UNIQUE("project_id","client_mutation_id"),
	CONSTRAINT "builder_project_revisions_snapshot_hash_check" CHECK ("builder_project_revisions"."snapshot_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "builder_project_revisions_revision_number_check" CHECK ("builder_project_revisions"."revision_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "builder_project_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"client_mutation_id" uuid NOT NULL,
	"status" "builder_run_status" DEFAULT 'pending' NOT NULL,
	"queue_kind" varchar(10) DEFAULT 'queue' NOT NULL,
	"provider" varchar(50) NOT NULL,
	"model" varchar(100) NOT NULL,
	"base_revision_id" uuid,
	"result_revision_id" uuid,
	"lease_owner_id" uuid,
	"lease_fencing_token" bigint DEFAULT 0 NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"last_heartbeat_at" timestamp with time zone,
	"error" jsonb,
	"activity" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "builder_project_runs_project_id_unique" UNIQUE("project_id","id"),
	CONSTRAINT "builder_project_runs_project_thread_id_unique" UNIQUE("project_id","thread_id","id"),
	CONSTRAINT "builder_project_runs_project_mutation_unique" UNIQUE("project_id","client_mutation_id"),
	CONSTRAINT "builder_project_runs_queue_kind_check" CHECK ("builder_project_runs"."queue_kind" IN ('queue', 'steer')),
	CONSTRAINT "builder_project_runs_fencing_token_check" CHECK ("builder_project_runs"."lease_fencing_token" BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "builder_project_runs_lease_pair_check" CHECK (("builder_project_runs"."lease_owner_id" IS NULL) = ("builder_project_runs"."lease_expires_at" IS NULL)),
	CONSTRAINT "builder_project_runs_running_lease_check" CHECK (("builder_project_runs"."status" = 'running') = ("builder_project_runs"."lease_owner_id" IS NOT NULL)),
	CONSTRAINT "builder_project_runs_terminal_state_check" CHECK (("builder_project_runs"."status" IN ('interrupted', 'completed', 'failed', 'cancelled')) = ("builder_project_runs"."completed_at" IS NOT NULL)),
	CONSTRAINT "builder_project_runs_timestamp_order_check" CHECK ("builder_project_runs"."completed_at" IS NULL OR "builder_project_runs"."started_at" IS NULL OR "builder_project_runs"."completed_at" >= "builder_project_runs"."started_at"),
	CONSTRAINT "builder_project_runs_activity_size_check" CHECK ("builder_project_runs"."activity" IS NULL OR (jsonb_typeof("builder_project_runs"."activity") = 'object' AND pg_column_size("builder_project_runs"."activity") <= 262144)),
	CONSTRAINT "builder_project_runs_error_size_check" CHECK ("builder_project_runs"."error" IS NULL OR (jsonb_typeof("builder_project_runs"."error") = 'object' AND pg_column_size("builder_project_runs"."error") <= 262144)),
	CONSTRAINT "builder_project_runs_result_revision_check" CHECK ("builder_project_runs"."result_revision_id" IS NULL OR "builder_project_runs"."status" = 'completed')
);
--> statement-breakpoint
CREATE TABLE "builder_project_snapshot_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"snapshot_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "builder_project_snapshot_reservations_owner_snapshot_unique" UNIQUE("owner_id","snapshot_hash")
);
--> statement-breakpoint
CREATE TABLE "builder_project_snapshots" (
	"hash" varchar(64) PRIMARY KEY NOT NULL,
	"source_bytes" integer,
	"stored_at" timestamp with time zone,
	"deleting_at" timestamp with time zone,
	"quarantined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "builder_project_snapshots_hash_check" CHECK ("builder_project_snapshots"."hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "builder_project_snapshots_source_bytes_check" CHECK ("builder_project_snapshots"."source_bytes" IS NULL OR "builder_project_snapshots"."source_bytes" BETWEEN 1 AND 1048576)
);
--> statement-breakpoint
CREATE TABLE "builder_project_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"client_mutation_id" uuid NOT NULL,
	"title" varchar(160) NOT NULL,
	"last_message_position" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "builder_project_threads_project_id_unique" UNIQUE("project_id","id"),
	CONSTRAINT "builder_project_threads_project_mutation_unique" UNIQUE("project_id","client_mutation_id"),
	CONSTRAINT "builder_project_threads_message_position_check" CHECK ("builder_project_threads"."last_message_position" BETWEEN 0 AND 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "builder_project_tombstones" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid,
	"deleted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "builder_project_usage" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"threads" integer DEFAULT 0 NOT NULL,
	"messages" integer DEFAULT 0 NOT NULL,
	"runs" integer DEFAULT 0 NOT NULL,
	"revisions" integer DEFAULT 0 NOT NULL,
	"events" integer DEFAULT 0 NOT NULL,
	"payload_bytes" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "builder_project_usage_nonnegative_check" CHECK ("builder_project_usage"."threads" >= 0 AND "builder_project_usage"."messages" >= 0 AND "builder_project_usage"."runs" >= 0 AND "builder_project_usage"."revisions" >= 0 AND "builder_project_usage"."events" >= 0 AND "builder_project_usage"."payload_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "builder_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"client_mutation_id" uuid NOT NULL,
	"forked_from_id" uuid,
	"title" varchar(160) NOT NULL,
	"description" varchar(1000) DEFAULT '' NOT NULL,
	"snapshot_hash" varchar(64) NOT NULL,
	"current_revision_number" integer DEFAULT 1 NOT NULL,
	"last_event_sequence" bigint DEFAULT 0 NOT NULL,
	"last_lease_fencing_token" bigint DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "builder_projects_id_owner_unique" UNIQUE("id","owner_id"),
	CONSTRAINT "builder_projects_owner_mutation_unique" UNIQUE("owner_id","client_mutation_id"),
	CONSTRAINT "builder_projects_snapshot_hash_check" CHECK ("builder_projects"."snapshot_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "builder_projects_revision_number_check" CHECK ("builder_projects"."current_revision_number" > 0),
	CONSTRAINT "builder_projects_event_sequence_check" CHECK ("builder_projects"."last_event_sequence" BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "builder_projects_lease_fencing_token_check" CHECK ("builder_projects"."last_lease_fencing_token" BETWEEN 0 AND 9007199254740991)
);
--> statement-breakpoint
ALTER TABLE "builder_project_events" ADD CONSTRAINT "builder_project_events_project_owner_fk" FOREIGN KEY ("project_id","owner_id") REFERENCES "public"."builder_projects"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_events" ADD CONSTRAINT "builder_project_events_thread_fk" FOREIGN KEY ("project_id","thread_id") REFERENCES "public"."builder_project_threads"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_events" ADD CONSTRAINT "builder_project_events_revision_fk" FOREIGN KEY ("project_id","revision_id") REFERENCES "public"."builder_project_revisions"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_events" ADD CONSTRAINT "builder_project_events_message_fk" FOREIGN KEY ("project_id","message_id") REFERENCES "public"."builder_project_messages"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_events" ADD CONSTRAINT "builder_project_events_run_fk" FOREIGN KEY ("project_id","run_id") REFERENCES "public"."builder_project_runs"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_legacy_imports" ADD CONSTRAINT "builder_project_legacy_imports_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_messages" ADD CONSTRAINT "builder_project_messages_project_owner_fk" FOREIGN KEY ("project_id","owner_id") REFERENCES "public"."builder_projects"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_messages" ADD CONSTRAINT "builder_project_messages_thread_fk" FOREIGN KEY ("project_id","thread_id") REFERENCES "public"."builder_project_threads"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_messages" ADD CONSTRAINT "builder_project_messages_run_fk" FOREIGN KEY ("project_id","thread_id","run_id") REFERENCES "public"."builder_project_runs"("project_id","thread_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_mutation_receipts" ADD CONSTRAINT "builder_project_mutation_receipts_project_fk" FOREIGN KEY ("project_id") REFERENCES "public"."builder_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_revisions" ADD CONSTRAINT "builder_project_revisions_project_owner_fk" FOREIGN KEY ("project_id","owner_id") REFERENCES "public"."builder_projects"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_revisions" ADD CONSTRAINT "builder_project_revisions_parent_fk" FOREIGN KEY ("project_id","parent_revision_id") REFERENCES "public"."builder_project_revisions"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_revisions" ADD CONSTRAINT "builder_project_revisions_snapshot_hash_fk" FOREIGN KEY ("snapshot_hash") REFERENCES "public"."builder_project_snapshots"("hash") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_runs" ADD CONSTRAINT "builder_project_runs_project_owner_fk" FOREIGN KEY ("project_id","owner_id") REFERENCES "public"."builder_projects"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_runs" ADD CONSTRAINT "builder_project_runs_thread_fk" FOREIGN KEY ("project_id","thread_id") REFERENCES "public"."builder_project_threads"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_runs" ADD CONSTRAINT "builder_project_runs_base_revision_fk" FOREIGN KEY ("project_id","base_revision_id") REFERENCES "public"."builder_project_revisions"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_runs" ADD CONSTRAINT "builder_project_runs_result_revision_fk" FOREIGN KEY ("project_id","result_revision_id") REFERENCES "public"."builder_project_revisions"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_snapshot_reservations" ADD CONSTRAINT "builder_project_snapshot_reservations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_snapshot_reservations" ADD CONSTRAINT "builder_project_snapshot_reservations_snapshot_hash_builder_project_snapshots_hash_fk" FOREIGN KEY ("snapshot_hash") REFERENCES "public"."builder_project_snapshots"("hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_threads" ADD CONSTRAINT "builder_project_threads_project_owner_fk" FOREIGN KEY ("project_id","owner_id") REFERENCES "public"."builder_projects"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_tombstones" ADD CONSTRAINT "builder_project_tombstones_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_project_usage" ADD CONSTRAINT "builder_project_usage_project_id_builder_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."builder_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_projects" ADD CONSTRAINT "builder_projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_projects" ADD CONSTRAINT "builder_projects_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_projects" ADD CONSTRAINT "builder_projects_forked_from_fk" FOREIGN KEY ("forked_from_id") REFERENCES "public"."builder_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_projects" ADD CONSTRAINT "builder_projects_snapshot_hash_fk" FOREIGN KEY ("snapshot_hash") REFERENCES "public"."builder_project_snapshots"("hash") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "builder_project_events_project_created_at_idx" ON "builder_project_events" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "builder_project_events_run_sequence_idx" ON "builder_project_events" USING btree ("run_id","sequence");--> statement-breakpoint
CREATE INDEX "builder_project_events_client_mutation_idx" ON "builder_project_events" USING btree ("project_id","client_mutation_id");--> statement-breakpoint
CREATE INDEX "builder_project_messages_project_thread_created_at_idx" ON "builder_project_messages" USING btree ("project_id","thread_id","created_at");--> statement-breakpoint
CREATE INDEX "builder_project_messages_run_id_idx" ON "builder_project_messages" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "builder_project_revisions_project_created_at_idx" ON "builder_project_revisions" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "builder_project_revisions_snapshot_hash_idx" ON "builder_project_revisions" USING btree ("snapshot_hash");--> statement-breakpoint
CREATE INDEX "builder_project_runs_project_thread_created_at_idx" ON "builder_project_runs" USING btree ("project_id","thread_id","created_at");--> statement-breakpoint
CREATE INDEX "builder_project_runs_active_lease_idx" ON "builder_project_runs" USING btree ("status","lease_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "builder_project_runs_active_project_unique" ON "builder_project_runs" USING btree ("project_id") WHERE "builder_project_runs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "builder_project_snapshot_reservations_owner_created_at_idx" ON "builder_project_snapshot_reservations" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "builder_project_snapshot_reservations_snapshot_hash_idx" ON "builder_project_snapshot_reservations" USING btree ("snapshot_hash");--> statement-breakpoint
CREATE INDEX "builder_project_snapshots_stored_at_idx" ON "builder_project_snapshots" USING btree ("stored_at");--> statement-breakpoint
CREATE INDEX "builder_project_threads_project_updated_at_idx" ON "builder_project_threads" USING btree ("project_id","updated_at");--> statement-breakpoint
CREATE INDEX "builder_project_tombstones_owner_deleted_at_idx" ON "builder_project_tombstones" USING btree ("owner_id","deleted_at");--> statement-breakpoint
CREATE INDEX "builder_projects_owner_id_idx" ON "builder_projects" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "builder_projects_owner_updated_at_idx" ON "builder_projects" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "builder_projects_deleted_at_idx" ON "builder_projects" USING btree ("deleted_at");