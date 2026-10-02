CREATE TABLE "chat_thread_requests" (
	"workspace_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"parent_conversation_id" text NOT NULL,
	"source_message_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	CONSTRAINT "chat_thread_requests_workspace_id_user_id_idempotency_key_pk" PRIMARY KEY("workspace_id","user_id","idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "chat_thread_requests" ADD CONSTRAINT "chat_thread_requests_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_thread_requests" ADD CONSTRAINT "chat_thread_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_thread_requests" ADD CONSTRAINT "chat_thread_requests_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;