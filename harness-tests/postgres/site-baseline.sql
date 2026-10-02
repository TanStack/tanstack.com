-- Minimal existing-site boundary for isolated chat runtime tests.
-- Production already owns the users table. These tests exercise UUID foreign
-- keys and cascades, not site authentication or its complete user schema.
CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());

-- The existing showcase migration also runs before chat migrations.
CREATE TABLE showcases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status text);
