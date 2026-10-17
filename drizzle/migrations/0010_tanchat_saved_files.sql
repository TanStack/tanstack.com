CREATE TABLE "chat_bot_drafts" (
	"workspace_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"bot_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "chat_bot_drafts_workspace_id_user_id_id_pk" PRIMARY KEY("workspace_id","user_id","id"),
	CONSTRAINT "chat_bot_draft_attachments" CHECK (jsonb_typeof("chat_bot_drafts"."file_ids")='array' AND jsonb_array_length("chat_bot_drafts"."file_ids")<=5)
);
--> statement-breakpoint
CREATE TABLE "chat_file_drafts" (
	"workspace_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "chat_file_drafts_workspace_id_user_id_id_pk" PRIMARY KEY("workspace_id","user_id","id")
);
--> statement-breakpoint
CREATE TABLE "chat_saved_file_imports" (
	"target_file_id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"target_conversation_id" text NOT NULL,
	"source_conversation_id" text NOT NULL,
	"source_file_id" uuid NOT NULL,
	"sha256" text NOT NULL,
	"name" text NOT NULL,
	"media_type" text NOT NULL,
	"size" integer NOT NULL,
	"source" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "chat_file_import_size" CHECK ("chat_saved_file_imports"."size">=0 AND "chat_saved_file_imports"."size"<=2097152),
	CONSTRAINT "chat_file_import_digest" CHECK ("chat_saved_file_imports"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "chat_file_import_source" CHECK ("chat_saved_file_imports"."source" IN ('upload','assistant'))
);
--> statement-breakpoint
CREATE TABLE "chat_saved_files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"bot_id" text,
	"conversation_id" text,
	"draft_id" uuid,
	"name" text NOT NULL,
	"media_type" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"source" text NOT NULL,
	"state" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "chat_file_scope" CHECK (("chat_saved_files"."draft_id" IS NOT NULL AND "chat_saved_files"."bot_id" IS NULL AND "chat_saved_files"."conversation_id" IS NULL) OR ("chat_saved_files"."draft_id" IS NULL AND "chat_saved_files"."bot_id" IS NOT NULL AND "chat_saved_files"."conversation_id" IS NOT NULL)),
	CONSTRAINT "chat_file_size" CHECK ("chat_saved_files"."size">=0 AND "chat_saved_files"."size"<=2097152),
	CONSTRAINT "chat_file_name" CHECK (length("chat_saved_files"."name") BETWEEN 1 AND 180),
	CONSTRAINT "chat_file_digest" CHECK ("chat_saved_files"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "chat_file_source" CHECK ("chat_saved_files"."source" IN ('upload','assistant')),
	CONSTRAINT "chat_file_state" CHECK ("chat_saved_files"."state" IN ('pending','ready'))
);
--> statement-breakpoint
ALTER TABLE "chat_bot_drafts" ADD CONSTRAINT "chat_bot_draft_scope_fk" FOREIGN KEY ("workspace_id","user_id","id") REFERENCES "public"."chat_file_drafts"("workspace_id","user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_bot_drafts" ADD CONSTRAINT "chat_bot_draft_conversation_fk" FOREIGN KEY ("conversation_id","bot_id","user_id") REFERENCES "public"."chat_conversations"("id","bot_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_bot_drafts" ADD CONSTRAINT "chat_bot_draft_workspace_fk" FOREIGN KEY ("workspace_id","bot_id") REFERENCES "public"."chat_bots"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_file_drafts" ADD CONSTRAINT "chat_file_drafts_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_file_drafts" ADD CONSTRAINT "chat_file_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_saved_file_imports" ADD CONSTRAINT "chat_saved_file_imports_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_saved_file_imports" ADD CONSTRAINT "chat_saved_file_imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_saved_file_imports" ADD CONSTRAINT "chat_saved_file_imports_target_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("target_conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_saved_files" ADD CONSTRAINT "chat_saved_files_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_saved_files" ADD CONSTRAINT "chat_saved_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_saved_files" ADD CONSTRAINT "chat_file_draft_fk" FOREIGN KEY ("workspace_id","user_id","draft_id") REFERENCES "public"."chat_file_drafts"("workspace_id","user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_saved_files" ADD CONSTRAINT "chat_file_conversation_fk" FOREIGN KEY ("conversation_id","bot_id","user_id") REFERENCES "public"."chat_conversations"("id","bot_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_saved_files" ADD CONSTRAINT "chat_file_workspace_fk" FOREIGN KEY ("workspace_id","bot_id") REFERENCES "public"."chat_bots"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_file_import_target_idx" ON "chat_saved_file_imports" USING btree ("workspace_id","user_id","target_conversation_id");--> statement-breakpoint
CREATE INDEX "chat_file_conversation_idx" ON "chat_saved_files" USING btree ("workspace_id","user_id","conversation_id","created_at","id");--> statement-breakpoint
CREATE INDEX "chat_file_draft_idx" ON "chat_saved_files" USING btree ("workspace_id","user_id","draft_id","created_at","id");--> statement-breakpoint
CREATE FUNCTION chat_saved_file_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id,NEW.workspace_id,NEW.user_id,NEW.name,NEW.media_type,NEW.size,NEW.sha256,NEW.source,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.workspace_id,OLD.user_id,OLD.name,OLD.media_type,OLD.size,OLD.sha256,OLD.source,OLD.created_at)
    OR (OLD.state='ready' AND NEW.state!='ready') THEN
    RAISE EXCEPTION 'Saved files are immutable.';
  END IF;
  IF ROW(NEW.bot_id,NEW.draft_id,NEW.conversation_id) IS DISTINCT FROM ROW(OLD.bot_id,OLD.draft_id,OLD.conversation_id) THEN
    IF NOT (OLD.bot_id IS NULL AND OLD.conversation_id IS NULL AND OLD.draft_id IS NOT NULL
      AND NEW.bot_id IS NOT NULL AND NEW.conversation_id IS NOT NULL AND NEW.draft_id IS NULL) THEN
      RAISE EXCEPTION 'Saved files are immutable.';
    END IF;
    PERFORM 1 FROM chat_conversations c JOIN chat_bots b ON b.id=c.bot_id
      JOIN chat_memberships a ON a.workspace_id=b.workspace_id AND a.user_id=c.user_id
      WHERE c.id=NEW.conversation_id AND c.bot_id=NEW.bot_id AND c.user_id=NEW.user_id
        AND b.workspace_id=NEW.workspace_id AND b.archived_at IS NULL AND b.deleted_at IS NULL
      FOR UPDATE OF c,b,a;
    IF NOT FOUND OR NOT EXISTS (
      SELECT 1 FROM chat_bot_drafts d WHERE d.workspace_id=OLD.workspace_id AND d.user_id=OLD.user_id
        AND d.id=OLD.draft_id AND d.bot_id=NEW.bot_id AND d.conversation_id=NEW.conversation_id
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(d.file_ids) ref
          WHERE jsonb_typeof(ref)!='string' OR NOT EXISTS (
            SELECT 1 FROM chat_saved_files f WHERE f.id::text=ref#>>'{}'
              AND f.workspace_id=d.workspace_id AND f.user_id=d.user_id AND f.state='ready'
              AND (f.draft_id=d.id OR f.conversation_id=d.conversation_id)
          )
        )
    ) THEN
      RAISE EXCEPTION 'Draft files could not be promoted. Check access and retry.';
    END IF;
    IF (SELECT count(*) FROM chat_saved_files WHERE workspace_id=NEW.workspace_id AND user_id=NEW.user_id AND conversation_id=NEW.conversation_id)>=100
      OR (SELECT COALESCE(sum(size),0) FROM chat_saved_files WHERE workspace_id=NEW.workspace_id AND user_id=NEW.user_id AND conversation_id=NEW.conversation_id)+NEW.size>52428800 THEN
      RAISE EXCEPTION 'The conversation file limit has been reached.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER chat_saved_file_immutable BEFORE UPDATE ON chat_saved_files FOR EACH ROW EXECUTE FUNCTION chat_saved_file_immutable();
--> statement-breakpoint
CREATE FUNCTION chat_saved_file_import_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'File import identities are immutable.';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER chat_saved_file_import_immutable BEFORE UPDATE ON chat_saved_file_imports FOR EACH ROW EXECUTE FUNCTION chat_saved_file_import_immutable();
