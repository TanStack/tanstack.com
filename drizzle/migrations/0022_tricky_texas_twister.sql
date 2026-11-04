CREATE TABLE "chat_conversation_activity" (
	"conversation_id" text PRIMARY KEY NOT NULL,
	"bot_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text NOT NULL,
	"activity_at" bigint NOT NULL,
	"event_version" bigint NOT NULL,
	"read_version" bigint DEFAULT 0 NOT NULL,
	"preview" text DEFAULT '' NOT NULL,
	"message_count" bigint DEFAULT 0 NOT NULL,
	"queued_count" bigint DEFAULT 0 NOT NULL,
	"queue_paused" boolean DEFAULT false NOT NULL,
	CONSTRAINT "chat_activity_status" CHECK ("chat_conversation_activity"."status" IN ('idle','running','approval','setup','error','completed'))
);
--> statement-breakpoint
ALTER TABLE "chat_conversation_activity" ADD CONSTRAINT "chat_conversation_activity_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversation_activity" ADD CONSTRAINT "chat_conversation_activity_bot_id_chat_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."chat_bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversation_activity" ADD CONSTRAINT "chat_conversation_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_activity_user_time" ON "chat_conversation_activity" USING btree ("user_id","activity_at");