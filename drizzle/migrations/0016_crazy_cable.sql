CREATE TABLE "chat_kody_skill_sync" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"account_fingerprint" text NOT NULL,
	"fetched_at" bigint NOT NULL,
	"revision" bigint DEFAULT 0 NOT NULL,
	"lease_until" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_kody_skill_sync_stage" (
	"user_id" uuid NOT NULL,
	"revision" bigint NOT NULL,
	"id" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "chat_kody_skill_sync_stage_user_id_revision_id_pk" PRIMARY KEY("user_id","revision","id")
);
--> statement-breakpoint
CREATE TABLE "chat_kody_skill_versions" (
	"user_id" uuid NOT NULL,
	"id" text NOT NULL,
	"version" bigint NOT NULL,
	"package_id" uuid NOT NULL,
	"source_skill_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"document" jsonb NOT NULL,
	"files" jsonb NOT NULL,
	"updated_at" bigint NOT NULL,
	"current" boolean NOT NULL,
	CONSTRAINT "chat_kody_skill_versions_user_id_id_version_pk" PRIMARY KEY("user_id","id","version")
);
--> statement-breakpoint
ALTER TABLE "chat_kody_skill_sync" ADD CONSTRAINT "chat_kody_skill_sync_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_kody_skill_sync_stage" ADD CONSTRAINT "chat_kody_skill_sync_stage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_kody_skill_versions" ADD CONSTRAINT "chat_kody_skill_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_kody_skill_current_idx" ON "chat_kody_skill_versions" USING btree ("user_id","current","name");