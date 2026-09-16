-- Run once as the database owner after applying schema.sql and seeding.
-- Provision the password through your provider or psql's \password command.
CREATE ROLE dashboard_reader LOGIN CONNECTION LIMIT 20;
GRANT USAGE ON SCHEMA dashboard TO dashboard_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA dashboard TO dashboard_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA dashboard GRANT SELECT ON TABLES TO dashboard_reader;
ALTER ROLE dashboard_reader SET statement_timeout = '15s';
ALTER ROLE dashboard_reader SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE dashboard_reader SET default_transaction_read_only = on;
