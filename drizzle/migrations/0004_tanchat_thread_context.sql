CREATE TABLE "chat_conversation_threads" (
	"conversation_id" text PRIMARY KEY NOT NULL,
	"parent_conversation_id" text NOT NULL,
	"bot_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"source_message_id" text NOT NULL,
	"source" jsonb NOT NULL,
	"title" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "chat_thread_not_self" CHECK ("chat_conversation_threads"."conversation_id" <> "chat_conversation_threads"."parent_conversation_id"),
	CONSTRAINT "chat_thread_version_nonnegative" CHECK ("chat_conversation_threads"."version" >= 0)
);
--> statement-breakpoint
ALTER TABLE "chat_conversation_threads" ADD CONSTRAINT "chat_thread_child_identity_fk" FOREIGN KEY ("conversation_id","bot_id","user_id") REFERENCES "public"."chat_conversations"("id","bot_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversation_threads" ADD CONSTRAINT "chat_thread_parent_identity_fk" FOREIGN KEY ("parent_conversation_id","bot_id","user_id") REFERENCES "public"."chat_conversations"("id","bot_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_thread_parent_idx" ON "chat_conversation_threads" USING btree ("parent_conversation_id");