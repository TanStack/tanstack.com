-- Forge production readiness delta.
-- Run this against the production Postgres database before enabling Forge.
-- Safe to rerun. It intentionally does not grant Forge to any user or role.

ALTER TYPE capability ADD VALUE IF NOT EXISTS 'forge';

CREATE TABLE IF NOT EXISTS forge_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  runtime_project_id varchar(160) NOT NULL DEFAULT 'local-project',
  active_chat_session_id uuid,
  name varchar(255) NOT NULL DEFAULT 'Forge project',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forge_projects_user_idx
  ON forge_projects(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS forge_projects_user_runtime_project_unique
  ON forge_projects(user_id, runtime_project_id);

CREATE TABLE IF NOT EXISTS forge_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  runtime_session_id varchar(160) NOT NULL,
  title varchar(255) NOT NULL DEFAULT 'New chat',
  current_manifest_version_id varchar(160),
  latest_run_id varchar(160),
  latest_run_status varchar(32),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS forge_chat_sessions_runtime_session_id_unique
  ON forge_chat_sessions(runtime_session_id);

CREATE INDEX IF NOT EXISTS forge_chat_sessions_project_updated_idx
  ON forge_chat_sessions(project_id, updated_at);

CREATE INDEX IF NOT EXISTS forge_chat_sessions_runtime_session_idx
  ON forge_chat_sessions(runtime_session_id);

CREATE INDEX IF NOT EXISTS forge_chat_sessions_user_updated_idx
  ON forge_chat_sessions(user_id, updated_at);

-- Optional grant template, to run separately with a real email:
-- UPDATE users
-- SET capabilities = array_append(capabilities, 'forge'::capability),
--     updated_at = now()
-- WHERE email = '<user@example.com>'
--   AND NOT ('forge'::capability = ANY(capabilities));
