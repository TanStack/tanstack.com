CREATE OR REPLACE FUNCTION chat_workspace_sync_membership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO chat_workspace_sync_members(workspace_id,user_id) VALUES(NEW.workspace_id,NEW.user_id);
  UPDATE chat_workspace_sync_clock SET revision=revision+1 WHERE workspace_id=NEW.workspace_id;
  RETURN NEW;
 END IF;
 UPDATE chat_workspace_sync_clock SET revision=revision+1 WHERE workspace_id=OLD.workspace_id AND EXISTS (SELECT 1 FROM chat_workspaces WHERE id=OLD.workspace_id);
 RETURN OLD;
END $$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION chat_workspace_sync_dirty() RETURNS trigger LANGUAGE plpgsql AS $$
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
 UPDATE chat_workspace_sync_clock SET revision=revision+1 WHERE workspace_id IN(previous_workspace,next_workspace) AND EXISTS (SELECT 1 FROM chat_workspaces WHERE id=chat_workspace_sync_clock.workspace_id);
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION chat_bump_membership_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP IN ('DELETE','UPDATE') AND EXISTS (SELECT 1 FROM chat_workspaces WHERE id=OLD.workspace_id) AND EXISTS (SELECT 1 FROM users WHERE id=OLD.user_id) THEN
 INSERT INTO chat_execution_membership_generations VALUES(OLD.workspace_id,OLD.user_id,1) ON CONFLICT(workspace_id,user_id) DO UPDATE SET generation=chat_execution_membership_generations.generation+1;
 END IF;
 IF TG_OP='INSERT' OR (TG_OP='UPDATE' AND (OLD.workspace_id,OLD.user_id) IS DISTINCT FROM (NEW.workspace_id,NEW.user_id)) THEN
 INSERT INTO chat_execution_membership_generations VALUES(NEW.workspace_id,NEW.user_id,1) ON CONFLICT(workspace_id,user_id) DO UPDATE SET generation=chat_execution_membership_generations.generation+1;
 END IF; RETURN NULL; END $$;
