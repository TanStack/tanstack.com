CREATE TABLE "chat_conversation_copies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"source_bot_id" text NOT NULL,
	"source_conversation_id" text NOT NULL,
	"target_bot_id" text NOT NULL,
	"target_conversation_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_digest" text NOT NULL,
	"kind" text NOT NULL,
	"boundary_json" jsonb NOT NULL,
	"name" text NOT NULL,
	"purpose" text NOT NULL,
	"parent_id" text,
	"status" text DEFAULT 'copying' NOT NULL,
	"phase" text DEFAULT 'export' NOT NULL,
	"manifest_json" jsonb,
	"next_page" bigint DEFAULT 0 NOT NULL,
	"work_version" bigint DEFAULT 0 NOT NULL,
	"error_code" text,
	"error_message" text,
	"attempts" bigint DEFAULT 0 NOT NULL,
	"retry_at" bigint DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"completed_at" bigint,
	CONSTRAINT "chat_conversation_copies_target_bot_id_unique" UNIQUE("target_bot_id"),
	CONSTRAINT "chat_conversation_copies_target_conversation_id_unique" UNIQUE("target_conversation_id"),
	CONSTRAINT "chat_conversation_copies_workspace_id_user_id_idempotency_key_unique" UNIQUE("workspace_id","user_id","idempotency_key"),
	CONSTRAINT "chat_copy_kind" CHECK ("chat_conversation_copies"."kind" IN ('duplicate','fork')),
	CONSTRAINT "chat_copy_status" CHECK ("chat_conversation_copies"."status" IN ('copying','ready','failed')),
	CONSTRAINT "chat_copy_phase" CHECK ("chat_conversation_copies"."phase" IN ('export','transfer','import','publish','cleanup','done'))
);
--> statement-breakpoint
ALTER TABLE "chat_conversation_copies" ADD CONSTRAINT "chat_conversation_copies_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversation_copies" ADD CONSTRAINT "chat_conversation_copies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_copies_pending" ON "chat_conversation_copies" USING btree ("source_conversation_id","phase","retry_at");--> statement-breakpoint
CREATE INDEX "chat_copies_viewer" ON "chat_conversation_copies" USING btree ("workspace_id","user_id","created_at");