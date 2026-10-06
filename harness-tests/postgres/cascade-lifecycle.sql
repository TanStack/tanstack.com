-- Run against a migrated disposable test database. All changes roll back.
BEGIN;
INSERT INTO users(id) VALUES('00000000-0000-4000-8000-000000000038');
INSERT INTO chat_workspaces(id,owner_id,name,policy) VALUES('cascade-check','00000000-0000-4000-8000-000000000038','Cascade check','{}');
INSERT INTO chat_memberships(workspace_id,user_id,role) VALUES('cascade-check','00000000-0000-4000-8000-000000000038','owner');
INSERT INTO chat_bots(id,workspace_id,name,purpose) VALUES('cascade-bot','cascade-check','Check','');
DELETE FROM chat_memberships WHERE workspace_id='cascade-check';
DO $$ BEGIN
 IF (SELECT generation FROM chat_execution_membership_generations WHERE workspace_id='cascade-check') <> 2 THEN
  RAISE EXCEPTION 'Membership removal did not invalidate execution authority';
 END IF;
END $$;
INSERT INTO chat_memberships(workspace_id,user_id,role) VALUES('cascade-check','00000000-0000-4000-8000-000000000038','owner');
DELETE FROM chat_workspaces WHERE id='cascade-check';
INSERT INTO chat_workspaces(id,owner_id,name,policy) VALUES('cascade-check','00000000-0000-4000-8000-000000000038','Cascade check','{}');
INSERT INTO chat_memberships(workspace_id,user_id,role) VALUES('cascade-check','00000000-0000-4000-8000-000000000038','owner');
INSERT INTO chat_bots(id,workspace_id,name,purpose) VALUES('cascade-bot','cascade-check','Check','');
DELETE FROM users WHERE id='00000000-0000-4000-8000-000000000038';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM chat_workspaces WHERE id='cascade-check') OR EXISTS(SELECT 1 FROM chat_bots WHERE id='cascade-bot') THEN
  RAISE EXCEPTION 'Account deletion left workspace or bot records';
 END IF;
END $$;
ROLLBACK;
