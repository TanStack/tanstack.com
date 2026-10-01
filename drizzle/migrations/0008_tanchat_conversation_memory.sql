CREATE TABLE "chat_memories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"revision" bigint NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"source_message_id" text,
	"source_run_id" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"expires_at" bigint
);
--> statement-breakpoint
CREATE TABLE "chat_memory_commands" (
	"conversation_id" text NOT NULL,
	"command_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"memory_id" uuid NOT NULL,
	"revision" bigint NOT NULL,
	"operation" text NOT NULL,
	"completed_at" bigint NOT NULL,
	CONSTRAINT "chat_memory_commands_conversation_id_command_id_pk" PRIMARY KEY("conversation_id","command_id")
);
--> statement-breakpoint
CREATE TABLE "chat_memory_preferences" (
	"conversation_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"revision" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_memories" ADD CONSTRAINT "chat_memories_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_memories" ADD CONSTRAINT "chat_memories_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_memories" ADD CONSTRAINT "chat_memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_memory_commands" ADD CONSTRAINT "chat_memory_commands_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_memory_preferences" ADD CONSTRAINT "chat_memory_preferences_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_memory_scope_idx" ON "chat_memories" USING btree ("conversation_id","id");--> statement-breakpoint
CREATE INDEX "chat_memory_command_identity_idx" ON "chat_memory_commands" USING btree ("conversation_id","memory_id");