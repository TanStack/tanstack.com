CREATE TABLE "chat_bots" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"parent_id" text,
	"name" text NOT NULL,
	"purpose" text DEFAULT '' NOT NULL,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_bots_workspace_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "chat_personal_assistant_active_check" CHECK ("chat_bots"."id" NOT LIKE 'assistant:%' OR ("chat_bots"."archived_at" IS NULL AND "chat_bots"."deleted_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "chat_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"bot_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_conversation_user_bot" UNIQUE("bot_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_memberships" (
	"workspace_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "chat_memberships_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id"),
	CONSTRAINT "chat_memberships_role_check" CHECK ("chat_memberships"."role" IN ('owner', 'admin', 'member'))
);
--> statement-breakpoint
CREATE TABLE "chat_workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"policy" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_bots" ADD CONSTRAINT "chat_bots_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_bots" ADD CONSTRAINT "chat_bots_workspace_id_parent_id_chat_bots_workspace_id_id_fk" FOREIGN KEY ("workspace_id","parent_id") REFERENCES "public"."chat_bots"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_bot_id_chat_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."chat_bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_memberships" ADD CONSTRAINT "chat_memberships_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_memberships" ADD CONSTRAINT "chat_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_workspaces" ADD CONSTRAINT "chat_workspaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_bots_workspace_idx" ON "chat_bots" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "chat_memberships_user_idx" ON "chat_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_workspaces_owner_idx" ON "chat_workspaces" USING btree ("owner_id");