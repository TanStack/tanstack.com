CREATE TABLE "chat_workflow_revisions" (
	"conversation_id" text NOT NULL,
	"workflow_id" uuid NOT NULL,
	"revision" bigint NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"command_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"definition_json" jsonb NOT NULL,
	"archived" boolean NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "chat_workflow_revisions_conversation_id_workflow_id_revision_pk" PRIMARY KEY("conversation_id","workflow_id","revision"),
	CONSTRAINT "chat_workflow_revisions_conversation_id_command_id_unique" UNIQUE("conversation_id","command_id"),
	CONSTRAINT "chat_workflow_revision_positive" CHECK ("chat_workflow_revisions"."revision">0)
);
--> statement-breakpoint
ALTER TABLE "chat_workflow_revisions" ADD CONSTRAINT "chat_workflow_revisions_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_workflow_revisions" ADD CONSTRAINT "chat_workflow_revisions_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_workflow_revisions" ADD CONSTRAINT "chat_workflow_revisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
CREATE FUNCTION chat_guard_workflow_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Workflow revisions are immutable'; END IF;
 PERFORM id FROM chat_conversations WHERE id=NEW.conversation_id FOR UPDATE;
 IF NOT EXISTS (
 SELECT 1 FROM chat_conversations c JOIN chat_bots b ON b.id=c.bot_id
 JOIN chat_memberships member ON member.workspace_id=b.workspace_id AND member.user_id=c.user_id
 WHERE c.id=NEW.conversation_id AND c.user_id=NEW.user_id AND b.workspace_id=NEW.workspace_id
 AND b.deleted_at IS NULL AND b.archived_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM chat_conversation_threads t WHERE t.conversation_id=c.id AND t.archived_at IS NOT NULL)
 ) THEN RAISE EXCEPTION 'Workflow access is unavailable'; END IF;
 IF NEW.revision<>COALESCE((SELECT MAX(revision) FROM chat_workflow_revisions WHERE conversation_id=NEW.conversation_id AND workflow_id=NEW.workflow_id),0)+1 THEN RAISE EXCEPTION 'Workflow revision must advance once'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER chat_workflow_revision_guard BEFORE INSERT OR UPDATE ON chat_workflow_revisions FOR EACH ROW EXECUTE FUNCTION chat_guard_workflow_revision();
