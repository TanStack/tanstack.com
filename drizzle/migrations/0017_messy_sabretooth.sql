CREATE TABLE "chat_plugin_bindings" (
	"installation_id" uuid NOT NULL,
	"version" bigint NOT NULL,
	"requirement_key" text NOT NULL,
	"server_id" text NOT NULL,
	"endpoint" text NOT NULL,
	CONSTRAINT "chat_plugin_bindings_installation_id_version_requirement_key_pk" PRIMARY KEY("installation_id","version","requirement_key")
);
--> statement-breakpoint
CREATE TABLE "chat_plugin_commands" (
	"workspace_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"command_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"receipt" jsonb NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "chat_plugin_commands_workspace_id_user_id_command_id_pk" PRIMARY KEY("workspace_id","user_id","command_id")
);
--> statement-breakpoint
CREATE TABLE "chat_plugin_files" (
	"installation_id" uuid NOT NULL,
	"version" bigint NOT NULL,
	"path" text NOT NULL,
	"content" text NOT NULL,
	CONSTRAINT "chat_plugin_files_installation_id_version_path_pk" PRIMARY KEY("installation_id","version","path")
);
--> statement-breakpoint
CREATE TABLE "chat_plugin_installations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"current_version" bigint NOT NULL,
	"revision" bigint NOT NULL,
	"enabled" boolean NOT NULL,
	"removed" boolean NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "chat_plugin_version_positive" CHECK ("chat_plugin_installations"."current_version">0),
	CONSTRAINT "chat_plugin_revision_positive" CHECK ("chat_plugin_installations"."revision">0)
);
--> statement-breakpoint
CREATE TABLE "chat_plugin_skill_identities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"installation_id" uuid NOT NULL,
	"path" text NOT NULL,
	CONSTRAINT "chat_plugin_skill_path" UNIQUE("installation_id","path")
);
--> statement-breakpoint
CREATE TABLE "chat_plugin_skill_versions" (
	"skill_id" uuid NOT NULL,
	"version" bigint NOT NULL,
	"document" jsonb NOT NULL,
	CONSTRAINT "chat_plugin_skill_versions_skill_id_version_pk" PRIMARY KEY("skill_id","version")
);
--> statement-breakpoint
CREATE TABLE "chat_plugin_versions" (
	"installation_id" uuid NOT NULL,
	"version" bigint NOT NULL,
	"digest" text NOT NULL,
	"preview" jsonb NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "chat_plugin_versions_installation_id_version_pk" PRIMARY KEY("installation_id","version"),
	CONSTRAINT "chat_plugin_saved_version_positive" CHECK ("chat_plugin_versions"."version">0)
);
--> statement-breakpoint
ALTER TABLE "chat_plugin_bindings" ADD CONSTRAINT "chat_plugin_bindings_installation_id_version_chat_plugin_versions_installation_id_version_fk" FOREIGN KEY ("installation_id","version") REFERENCES "public"."chat_plugin_versions"("installation_id","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_plugin_commands" ADD CONSTRAINT "chat_plugin_commands_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_plugin_commands" ADD CONSTRAINT "chat_plugin_commands_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_plugin_files" ADD CONSTRAINT "chat_plugin_files_installation_id_version_chat_plugin_versions_installation_id_version_fk" FOREIGN KEY ("installation_id","version") REFERENCES "public"."chat_plugin_versions"("installation_id","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_plugin_installations" ADD CONSTRAINT "chat_plugin_installations_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_plugin_installations" ADD CONSTRAINT "chat_plugin_installations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_plugin_skill_identities" ADD CONSTRAINT "chat_plugin_skill_identities_installation_id_chat_plugin_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."chat_plugin_installations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_plugin_skill_versions" ADD CONSTRAINT "chat_plugin_skill_versions_skill_id_chat_plugin_skill_identities_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."chat_plugin_skill_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_plugin_versions" ADD CONSTRAINT "chat_plugin_versions_installation_id_chat_plugin_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."chat_plugin_installations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_plugin_owner_list" ON "chat_plugin_installations" USING btree ("workspace_id","user_id","removed","updated_at","id");