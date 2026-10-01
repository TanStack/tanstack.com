CREATE TABLE "chat_conversation_retries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"source_bot_id" text NOT NULL,
	"source_conversation_id" text NOT NULL,
	"message_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"source_json" jsonb NOT NULL,
	"file_plan_json" jsonb NOT NULL,
	"status" text DEFAULT 'preparing' NOT NULL,
	"error_code" text,
	"error_message" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "chat_conversation_retries_workspace_id_user_id_idempotency_key_unique" UNIQUE("workspace_id","user_id","idempotency_key"),
	CONSTRAINT "chat_retry_status" CHECK ("chat_conversation_retries"."status" IN ('preparing','ready','failed'))
);
--> statement-breakpoint
ALTER TABLE "chat_conversation_copies" ADD COLUMN "retry_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_conversation_retries" ADD CONSTRAINT "chat_conversation_retries_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversation_retries" ADD CONSTRAINT "chat_conversation_retries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_retries_viewer" ON "chat_conversation_retries" USING btree ("workspace_id","user_id","created_at");--> statement-breakpoint
ALTER TABLE "chat_conversation_copies" ADD CONSTRAINT "chat_conversation_copies_retry_id_chat_conversation_retries_id_fk" FOREIGN KEY ("retry_id") REFERENCES "public"."chat_conversation_retries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversation_copies" ADD CONSTRAINT "chat_conversation_copies_retry_id_unique" UNIQUE("retry_id");--> statement-breakpoint
CREATE FUNCTION chat_guard_retry_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Retry source and input identities are immutable'; END $$;
--> statement-breakpoint
CREATE TRIGGER chat_retry_identity_immutable BEFORE UPDATE OF id,workspace_id,user_id,source_bot_id,source_conversation_id,message_id,idempotency_key,source_json,file_plan_json,created_at ON chat_conversation_retries FOR EACH ROW EXECUTE FUNCTION chat_guard_retry_identity();
--> statement-breakpoint
CREATE FUNCTION chat_guard_copy_retry_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Copy retry identity is immutable'; END $$;
--> statement-breakpoint
CREATE TRIGGER chat_copy_retry_immutable BEFORE UPDATE OF retry_id ON chat_conversation_copies FOR EACH ROW EXECUTE FUNCTION chat_guard_copy_retry_identity();
