-- Ported from Gum migrations/0004_bot_workspace.sql, bots_parent_insert/update.
-- Serialize hierarchy and parent availability writes within each workspace.
CREATE FUNCTION chat_bot_hierarchy_lock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.workspace_id <> NEW.workspace_id THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('chat-hierarchy:' || least(OLD.workspace_id, NEW.workspace_id), 0));
    PERFORM pg_advisory_xact_lock(hashtextextended('chat-hierarchy:' || greatest(OLD.workspace_id, NEW.workspace_id), 0));
  ELSE
    PERFORM pg_advisory_xact_lock(hashtextextended('chat-hierarchy:' || NEW.workspace_id, 0));
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER chat_bots_00_hierarchy_lock BEFORE INSERT OR UPDATE OF parent_id, workspace_id, archived_at, deleted_at ON chat_bots
FOR EACH ROW EXECUTE FUNCTION chat_bot_hierarchy_lock();
--> statement-breakpoint
CREATE FUNCTION chat_bot_parent_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  IF (TG_OP = 'INSERT' AND NEW.parent_id = NEW.id) OR NOT EXISTS (
    SELECT 1 FROM chat_bots p WHERE p.id=NEW.parent_id AND p.workspace_id=NEW.workspace_id
      AND p.archived_at IS NULL AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Parent bot is not available in this workspace.' USING ERRCODE='23514';
  END IF;
  IF TG_OP = 'UPDATE' AND EXISTS (
    WITH RECURSIVE ancestors(id, parent_id) AS (
      SELECT id,parent_id FROM chat_bots WHERE id=NEW.parent_id
      UNION SELECT b.id,b.parent_id FROM chat_bots b JOIN ancestors a ON b.id=a.parent_id
    ) SELECT 1 FROM ancestors WHERE id=NEW.id
  ) THEN
    RAISE EXCEPTION 'A bot cannot be its own ancestor.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER chat_bots_01_parent_guard BEFORE INSERT OR UPDATE OF parent_id, workspace_id ON chat_bots
FOR EACH ROW EXECUTE FUNCTION chat_bot_parent_guard();
