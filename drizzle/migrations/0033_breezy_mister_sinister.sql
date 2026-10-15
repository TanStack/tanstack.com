CREATE TABLE "chat_bot_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" real DEFAULT 0 NOT NULL,
	"version" bigint DEFAULT 0 NOT NULL,
	"sort_override" text
);
--> statement-breakpoint
CREATE TABLE "chat_bot_viewer_state" (
	"bot_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"section_id" text,
	"position" real DEFAULT 0 NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "chat_bot_viewer_state_bot_id_user_id_pk" PRIMARY KEY("bot_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_workspace_sync_clock" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"revision" bigint DEFAULT 1 NOT NULL,
	"published_revision" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_workspace_sync_members" (
	"workspace_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"generation" uuid DEFAULT gen_random_uuid() NOT NULL,
	CONSTRAINT "chat_workspace_sync_members_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "chat_bots" ADD COLUMN "version" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_bots" ADD COLUMN "avatar" text;--> statement-breakpoint
ALTER TABLE "chat_bots" ADD COLUMN "deletion_batch" text;--> statement-breakpoint
ALTER TABLE "chat_bots" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_bot_sections" ADD CONSTRAINT "chat_bot_sections_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_bot_sections" ADD CONSTRAINT "chat_bot_sections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_bot_viewer_state" ADD CONSTRAINT "chat_bot_viewer_state_bot_id_chat_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."chat_bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_bot_viewer_state" ADD CONSTRAINT "chat_bot_viewer_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_bot_viewer_state" ADD CONSTRAINT "chat_bot_viewer_state_section_id_chat_bot_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."chat_bot_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_workspace_sync_clock" ADD CONSTRAINT "chat_workspace_sync_clock_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_workspace_sync_members" ADD CONSTRAINT "chat_workspace_sync_members_workspace_id_user_id_chat_memberships_workspace_id_user_id_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."chat_memberships"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_bot_sections_viewer" ON "chat_bot_sections" USING btree ("workspace_id","user_id");
--> statement-breakpoint
INSERT INTO chat_workspace_sync_clock(workspace_id) SELECT id FROM chat_workspaces;
INSERT INTO chat_workspace_sync_members(workspace_id,user_id) SELECT workspace_id,user_id FROM chat_memberships;
CREATE FUNCTION chat_initialize_workspace_sync() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO chat_workspace_sync_clock(workspace_id) VALUES(NEW.id);
 RETURN NEW;
END $$;
CREATE TRIGGER chat_workspace_sync_initialize AFTER INSERT ON chat_workspaces FOR EACH ROW EXECUTE FUNCTION chat_initialize_workspace_sync();
CREATE FUNCTION chat_workspace_sync_membership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO chat_workspace_sync_members(workspace_id,user_id) VALUES(NEW.workspace_id,NEW.user_id);
  UPDATE chat_workspace_sync_clock SET revision=revision+1 WHERE workspace_id=NEW.workspace_id;
  RETURN NEW;
 END IF;
 UPDATE chat_workspace_sync_clock SET revision=revision+1 WHERE workspace_id=OLD.workspace_id;
 RETURN OLD;
END $$;
CREATE TRIGGER chat_workspace_sync_member_add AFTER INSERT ON chat_memberships FOR EACH ROW EXECUTE FUNCTION chat_workspace_sync_membership();
CREATE TRIGGER chat_workspace_sync_member_remove BEFORE DELETE ON chat_memberships FOR EACH ROW EXECUTE FUNCTION chat_workspace_sync_membership();
CREATE FUNCTION chat_workspace_sync_dirty() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous_workspace text; next_workspace text;
BEGIN
 IF TG_OP<>'INSERT' THEN
  IF TG_ARGV[0]='workspace' THEN previous_workspace=to_jsonb(OLD)->>'workspace_id';
  ELSE SELECT workspace_id INTO previous_workspace FROM chat_bots WHERE id=to_jsonb(OLD)->>'bot_id'; END IF;
 END IF;
 IF TG_OP<>'DELETE' THEN
  IF TG_ARGV[0]='workspace' THEN next_workspace=to_jsonb(NEW)->>'workspace_id';
  ELSE SELECT workspace_id INTO next_workspace FROM chat_bots WHERE id=to_jsonb(NEW)->>'bot_id'; END IF;
 END IF;
 UPDATE chat_workspace_sync_clock SET revision=revision+1 WHERE workspace_id IN(previous_workspace,next_workspace);
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION chat_check_viewer_section() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.section_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM chat_bot_sections s JOIN chat_bots b ON b.workspace_id=s.workspace_id WHERE s.id=NEW.section_id AND s.user_id=NEW.user_id AND b.id=NEW.bot_id) THEN
  RAISE EXCEPTION 'Section is not available.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER chat_viewer_section_guard BEFORE INSERT OR UPDATE OF section_id,bot_id,user_id ON chat_bot_viewer_state FOR EACH ROW EXECUTE FUNCTION chat_check_viewer_section();
CREATE TRIGGER chat_bots_sync_write AFTER INSERT OR UPDATE ON chat_bots FOR EACH ROW EXECUTE FUNCTION chat_workspace_sync_dirty('workspace');
CREATE TRIGGER chat_bots_sync_delete BEFORE DELETE ON chat_bots FOR EACH ROW EXECUTE FUNCTION chat_workspace_sync_dirty('workspace');
CREATE TRIGGER chat_bot_sections_sync_write AFTER INSERT OR UPDATE ON chat_bot_sections FOR EACH ROW EXECUTE FUNCTION chat_workspace_sync_dirty('workspace');
CREATE TRIGGER chat_bot_sections_sync_delete BEFORE DELETE ON chat_bot_sections FOR EACH ROW EXECUTE FUNCTION chat_workspace_sync_dirty('workspace');
CREATE TRIGGER chat_bot_viewer_state_sync_write AFTER INSERT OR UPDATE ON chat_bot_viewer_state FOR EACH ROW EXECUTE FUNCTION chat_workspace_sync_dirty('bot');
CREATE TRIGGER chat_bot_viewer_state_sync_delete BEFORE DELETE ON chat_bot_viewer_state FOR EACH ROW EXECUTE FUNCTION chat_workspace_sync_dirty('bot');
CREATE TRIGGER chat_conversation_mains_sync_write AFTER INSERT OR UPDATE ON chat_conversation_mains FOR EACH ROW EXECUTE FUNCTION chat_workspace_sync_dirty('bot');
CREATE TRIGGER chat_conversation_mains_sync_delete BEFORE DELETE ON chat_conversation_mains FOR EACH ROW EXECUTE FUNCTION chat_workspace_sync_dirty('bot');
CREATE TRIGGER chat_conversation_activity_sync_write AFTER INSERT OR UPDATE ON chat_conversation_activity FOR EACH ROW EXECUTE FUNCTION chat_workspace_sync_dirty('bot');
CREATE TRIGGER chat_conversation_activity_sync_delete BEFORE DELETE ON chat_conversation_activity FOR EACH ROW EXECUTE FUNCTION chat_workspace_sync_dirty('bot');
