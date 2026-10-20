CREATE TABLE "chat_bot_schedule_suspensions" (
	"bot_id" text PRIMARY KEY NOT NULL,
	"generation" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "chat_bot_generation_safe" CHECK ("chat_bot_schedule_suspensions"."generation" BETWEEN 0 AND 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "chat_execution_membership_generations" (
	"workspace_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"generation" bigint NOT NULL,
	CONSTRAINT "chat_execution_membership_generations_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id"),
	CONSTRAINT "chat_membership_generation_safe" CHECK ("chat_execution_membership_generations"."generation" BETWEEN 0 AND 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "chat_thread_schedule_suspensions" (
	"conversation_id" text PRIMARY KEY NOT NULL,
	"generation" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "chat_thread_generation_safe" CHECK ("chat_thread_schedule_suspensions"."generation" BETWEEN 0 AND 9007199254740991)
);
--> statement-breakpoint
ALTER TABLE "chat_bot_schedule_suspensions" ADD CONSTRAINT "chat_bot_schedule_suspensions_bot_id_chat_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."chat_bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_execution_membership_generations" ADD CONSTRAINT "chat_execution_membership_generations_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_execution_membership_generations" ADD CONSTRAINT "chat_execution_membership_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_thread_schedule_suspensions" ADD CONSTRAINT "chat_thread_schedule_suspensions_conversation_id_chat_conversation_threads_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversation_threads"("conversation_id") ON DELETE cascade ON UPDATE no action;
CREATE FUNCTION chat_bump_bot_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL) OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
 INSERT INTO chat_bot_schedule_suspensions VALUES(NEW.id,1) ON CONFLICT(bot_id) DO UPDATE SET generation=chat_bot_schedule_suspensions.generation+1;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER chat_bot_lifecycle AFTER UPDATE OF archived_at,deleted_at ON chat_bots FOR EACH ROW EXECUTE FUNCTION chat_bump_bot_lifecycle();
CREATE FUNCTION chat_bump_thread_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN
 INSERT INTO chat_thread_schedule_suspensions VALUES(NEW.conversation_id,1) ON CONFLICT(conversation_id) DO UPDATE SET generation=chat_thread_schedule_suspensions.generation+1;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER chat_thread_lifecycle AFTER UPDATE OF archived_at ON chat_conversation_threads FOR EACH ROW EXECUTE FUNCTION chat_bump_thread_lifecycle();
CREATE FUNCTION chat_bump_membership_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP IN ('DELETE','UPDATE') THEN
 INSERT INTO chat_execution_membership_generations VALUES(OLD.workspace_id,OLD.user_id,1) ON CONFLICT(workspace_id,user_id) DO UPDATE SET generation=chat_execution_membership_generations.generation+1;
 END IF;
 IF TG_OP='INSERT' OR (TG_OP='UPDATE' AND (OLD.workspace_id,OLD.user_id) IS DISTINCT FROM (NEW.workspace_id,NEW.user_id)) THEN
 INSERT INTO chat_execution_membership_generations VALUES(NEW.workspace_id,NEW.user_id,1) ON CONFLICT(workspace_id,user_id) DO UPDATE SET generation=chat_execution_membership_generations.generation+1;
 END IF; RETURN NULL; END $$;
CREATE TRIGGER chat_membership_lifecycle_insert AFTER INSERT ON chat_memberships FOR EACH ROW EXECUTE FUNCTION chat_bump_membership_lifecycle();
CREATE TRIGGER chat_membership_lifecycle_delete AFTER DELETE ON chat_memberships FOR EACH ROW EXECUTE FUNCTION chat_bump_membership_lifecycle();
CREATE TRIGGER chat_membership_lifecycle_update AFTER UPDATE OF workspace_id,user_id,role ON chat_memberships FOR EACH ROW WHEN ((OLD.workspace_id,OLD.user_id,OLD.role) IS DISTINCT FROM (NEW.workspace_id,NEW.user_id,NEW.role)) EXECUTE FUNCTION chat_bump_membership_lifecycle();
