CREATE TABLE "chat_skill_commands" (
	"workspace_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"command_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"receipt" jsonb NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "chat_skill_commands_workspace_id_user_id_command_id_pk" PRIMARY KEY("workspace_id","user_id","command_id")
);
--> statement-breakpoint
CREATE TABLE "chat_skill_versions" (
	"skill_id" uuid NOT NULL,
	"version" bigint NOT NULL,
	"document" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "chat_skill_versions_skill_id_version_pk" PRIMARY KEY("skill_id","version"),
	CONSTRAINT "chat_skill_saved_version" CHECK ("chat_skill_versions"."version">0 AND "chat_skill_versions"."version"<=9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "chat_skills" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"version" bigint NOT NULL,
	"revision" bigint NOT NULL,
	"enabled" boolean NOT NULL,
	"archived" boolean NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "chat_skill_version" CHECK ("chat_skills"."version">0 AND "chat_skills"."version"<=9007199254740991),
	CONSTRAINT "chat_skill_revision" CHECK ("chat_skills"."revision">0 AND "chat_skills"."revision"<=9007199254740991)
);
--> statement-breakpoint
ALTER TABLE "chat_skill_commands" ADD CONSTRAINT "chat_skill_commands_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_skill_commands" ADD CONSTRAINT "chat_skill_commands_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_skill_versions" ADD CONSTRAINT "chat_skill_versions_skill_id_chat_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."chat_skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_skills" ADD CONSTRAINT "chat_skills_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_skills" ADD CONSTRAINT "chat_skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_skill_owner_list" ON "chat_skills" USING btree ("workspace_id","user_id","archived","updated_at","id");