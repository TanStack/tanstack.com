import { getTableConfig } from 'drizzle-orm/pg-core'
import {
  users,
  roles,
  roleAssignments,
  oauthAccounts,
} from '../../../src/db/schema'
import { CAPABILITIES, OAUTH_PROVIDERS } from '../../../src/db/types'
import { AuthService } from '../../../src/auth/auth.server'
import { SessionService } from '../../../src/auth/session.server'
import {
  DrizzleUserRepository,
  DrizzleCapabilitiesRepository,
} from '../../../src/auth/repositories.server'
import type { conversationHarness } from './conversation-runtime'

type Harness = Awaited<ReturnType<typeof conversationHarness>>
let runtimeEnv: Record<string, unknown> | undefined
const sessions = new SessionService('isolated-shared-auth-runtime-test-secret')
const auth = new AuthService(
  sessions,
  new DrizzleUserRepository(),
  new DrizzleCapabilitiesRepository(),
)
export function getRuntimeAuth() {
  return auth
}
export function getRuntimeEnv() {
  return runtimeEnv
}
export function bindRuntimeEnv(env: Record<string, unknown>) {
  runtimeEnv = env
}

/** Add the actual shared auth column types to the intentionally minimal local
 * chat baseline. This is not a replacement migration or a production schema. */
export async function prepareSharedSessionRuntime(h: Harness) {
  const values = CAPABILITIES.map(
    (value) => `'${value.replaceAll("'", "''")}'`,
  ).join(',')
  await h.db.unsafe(
    `DO $$ BEGIN CREATE TYPE capability AS ENUM (${values}); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  )
  const providers = OAUTH_PROVIDERS.map((value) => `'${value}'`).join(',')
  await h.db.unsafe(
    `DO $$ BEGIN CREATE TYPE oauth_provider AS ENUM (${providers}); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  )
  for (const table of [users, roles, roleAssignments, oauthAccounts]) {
    const config = getTableConfig(table)
    await h.db.unsafe(
      `CREATE TABLE IF NOT EXISTS "${config.name}" (id uuid PRIMARY KEY)`,
    )
    for (const column of config.columns) {
      if (column.name === 'id') continue
      await h.db.unsafe(
        `ALTER TABLE "${config.name}" ADD COLUMN IF NOT EXISTS "${column.name}" ${column.getSQLType()}`,
      )
    }
  }
  await h.db`INSERT INTO chat_access(user_id) SELECT id FROM users ON CONFLICT DO NOTHING`
  await h.db`UPDATE users SET email='runtime@example.invalid', capabilities=ARRAY['builder']::capability[], session_version=0, signup_sources='[]'::jsonb,created_at=now(),updated_at=now()`
}
export async function createSharedSession(userId: string) {
  const cookie = await sessions.signCookie({
    userId,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    version: 0,
  })
  return sessions
    .createSessionCookieHeader(cookie, 30 * 24 * 60 * 60)
    .split(';')[0]
}
