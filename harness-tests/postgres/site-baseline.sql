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
