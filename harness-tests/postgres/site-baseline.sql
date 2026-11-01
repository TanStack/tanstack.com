-- Minimal existing-site boundary for isolated chat runtime tests.
-- Production already owns the users table. These tests exercise UUID foreign
-- keys and cascades, not site authentication or its complete user schema.
CREATE TYPE capability AS ENUM ('admin', 'api-keys', 'disableAds', 'builder', 'mcp', 'moderate-feedback', 'moderate-showcases');
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capabilities capability[] NOT NULL DEFAULT '{}'
);

-- The existing showcase migration also runs before chat migrations.
CREATE TABLE showcases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status text);

-- Stored roles participate in the same effective admin check as authentication.
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capabilities capability[] NOT NULL DEFAULT '{}'
);
CREATE TABLE role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE
);

-- Existing site OAuth tables predate the migration journal. New OAuth
-- migrations must also run against this disposable site boundary.
CREATE TABLE oauth_mcp_authorization_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash varchar(64) UNIQUE NOT NULL,
  user_id uuid REFERENCES users(id),
  client_id varchar(255) NOT NULL,
  redirect_uri text NOT NULL,
  code_challenge varchar(128) NOT NULL,
  code_challenge_method varchar(8) NOT NULL DEFAULT 'S256',
  scope text NOT NULL DEFAULT 'api',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE oauth_mcp_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash varchar(64) UNIQUE NOT NULL,
  user_id uuid REFERENCES users(id),
  client_id varchar(255) NOT NULL,
  scope text NOT NULL DEFAULT 'api',
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE oauth_mcp_refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash varchar(64) UNIQUE NOT NULL,
  user_id uuid REFERENCES users(id),
  client_id varchar(255) NOT NULL,
  access_token_id uuid REFERENCES oauth_mcp_access_tokens(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
