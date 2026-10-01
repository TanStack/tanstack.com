CREATE TABLE "chat_workflow_children" (
	"conversation_id" text PRIMARY KEY NOT NULL,
	"owner_conversation_id" text NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"step_id" text NOT NULL,
	"admission_json" text NOT NULL,
	CONSTRAINT "chat_workflow_children_owner_conversation_id_workflow_run_id_step_id_unique" UNIQUE("owner_conversation_id","workflow_run_id","step_id"),
	CONSTRAINT "chat_workflow_child_admission_json" CHECK (jsonb_typeof("chat_workflow_children"."admission_json"::jsonb)='object')
);
--> statement-breakpoint
ALTER TABLE "chat_workflow_children" ADD CONSTRAINT "chat_workflow_children_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_workflow_children" ADD CONSTRAINT "chat_workflow_children_owner_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("owner_conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;