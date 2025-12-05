# Data Migration Guide

## Overview

This guide covers migrating data from Convex to PostgreSQL (Neon DB).

## Prerequisites

1. **Export Convex Data**
   - Use Convex dashboard or CLI to export all tables
   - Export format: JSON or CSV
   - Tables to export:
     - `users`
     - `roles`
     - `role_assignments`
     - `sessions`
     - `oauth_accounts`
     - `feed_entries`
     - `feed_config`
     - **Skip**: `oauth_states` (no longer needed)

2. **Database Setup**
   - Ensure PostgreSQL database is provisioned via Netlify DB
   - Run Drizzle migrations: `npm run db:push`
   - Verify schema matches `src/db/schema.ts`

## Migration Steps

### Step 1: Transform Data

Create a transformation script that:

1. **Convert Convex IDs to UUIDs**
   - Generate new UUIDs for each record
   - Maintain mapping for foreign key relationships

2. **Transform Timestamps**
   - Convex: milliseconds (number)
   - PostgreSQL: `timestamp with time zone` (Date object)
   - Convert: `new Date(timestamp)` for milliseconds

3. **Transform Arrays**
   - Convex: stored as arrays
   - PostgreSQL: array columns (already compatible)
   - Ensure proper formatting

4. **Handle Nullable Fields**
   - Map `undefined` → `null` for optional fields
   - Verify required fields are present

### Step 2: Import Order

Import data in dependency order:

1. **users** (no dependencies)
2. **roles** (no dependencies)
3. **role_assignments** (depends on users, roles)
4. **sessions** (depends on users)
5. **oauth_accounts** (depends on users)
6. **feed_config** (no dependencies)
7. **feed_entries** (no dependencies, but may reference users in metadata)

### Step 3: Data Validation

After import, run validation queries:

```sql
-- Check record counts
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'roles', COUNT(*) FROM roles
UNION ALL
SELECT 'role_assignments', COUNT(*) FROM role_assignments
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL
SELECT 'oauth_accounts', COUNT(*) FROM oauth_accounts
UNION ALL
SELECT 'feed_entries', COUNT(*) FROM feed_entries
UNION ALL
SELECT 'feed_config', COUNT(*) FROM feed_config;

-- Check foreign key integrity
SELECT COUNT(*) as orphaned_role_assignments
FROM role_assignments ra
LEFT JOIN users u ON ra.user_id = u.id
LEFT JOIN roles r ON ra.role_id = r.id
WHERE u.id IS NULL OR r.id IS NULL;

SELECT COUNT(*) as orphaned_sessions
FROM sessions s
LEFT JOIN users u ON s.user_id = u.id
WHERE u.id IS NULL;

SELECT COUNT(*) as orphaned_oauth_accounts
FROM oauth_accounts oa
LEFT JOIN users u ON oa.user_id = u.id
WHERE u.id IS NULL;
```

### Step 4: Post-Migration Tasks

1. **Set up indexes** (if not created by Drizzle):

   ```sql
   -- GIN indexes for array columns
   CREATE INDEX IF NOT EXISTS feed_entries_library_ids_gin_idx
     ON feed_entries USING GIN (library_ids);
   CREATE INDEX IF NOT EXISTS feed_entries_tags_gin_idx
     ON feed_entries USING GIN (tags);

   -- Full-text search (see drizzle/migrations/README.md)
   ```

2. **Verify functionality**:
   - Test authentication flow
   - Test feed queries
   - Test admin interfaces

3. **Monitor**:
   - Check error logs
   - Monitor query performance
   - Verify data consistency

## Rollback Plan

If migration fails:

1. Keep Convex database active for 24-48 hours
2. Document any data discrepancies
3. Have rollback procedure ready:
   - Revert code deployment
   - Switch back to Convex
   - Investigate issues
   - Retry migration

## Notes

- **entryId field**: The `feed_entries` table uses `entryId` (string) as the unique identifier, not `id` (UUID). Make sure to map Convex feed entry IDs to `entryId` field.
- **Metadata**: JSONB fields should be preserved as-is from Convex
- **Capabilities**: Array fields should be preserved as arrays
