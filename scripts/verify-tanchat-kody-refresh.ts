import { connectionSchema } from '../src/chat/core/types'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import postgres from 'postgres'
import { kodyConnection, kodyNeedsSignIn } from '../src/chat/server/kody'
import {
  readCredentials,
  writeCredentials,
} from '../src/chat/server/credentials'
import { hash } from '../src/chat/server/crypto'

const url = new URL(process.env.DATABASE_URL ?? '')
if (
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  !url.pathname.startsWith('/tanchat_test')
)
  throw new Error('Use an empty local tanchat_test database.')
const sql = postgres(url.href)
const env = {
  ENCRYPTION_KEY: 'local-test-encryption-key-not-a-production-secret',
  KODY_ORIGIN: 'https://kody.test',
}
const connection = connectionSchema.parse({
  provider: 'included',
  model: '@cf/moonshotai/kimi-k2.6',
})
const originalFetch = globalThis.fetch
try {
  await sql`CREATE TABLE users (id uuid PRIMARY KEY)`
  for (const name of ['0006_tanchat_credentials.sql', '0014_pale_risque.sql'])
    await sql.unsafe(
      await readFile(
        new URL('../drizzle/migrations/' + name, import.meta.url),
        'utf8',
      ),
    )
  const user = crypto.randomUUID()
  await sql`INSERT INTO users VALUES (${user})`
  const expired = {
    client_id: 'client',
    access_token: 'expired',
    refresh_token: 'single-use',
    expires_at: Date.now() - 1,
  }
  await writeCredentials(env, user, { connection, kody: expired })
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    await new Promise((resolve) => setTimeout(resolve, 50))
    return Response.json({
      access_token: 'renewed',
      refresh_token: 'rotated',
      expires_in: 3600,
    })
  }
  const connections = await Promise.all(
    Array.from({ length: 8 }, () => kodyConnection(env, user)),
  )
  assert.equal(calls, 1)
  assert.ok(
    connections.every((connection) => connection.accessToken === 'renewed'),
  )
  assert.equal(
    (await readCredentials(env, user))?.kody?.refresh_token,
    'rotated',
  )
  // A stale reader must not consume the token again, even after its lease expires.
  await writeCredentials(env, user, { connection, kody: expired })
  await sql`UPDATE chat_kody_refresh_claims SET status='refreshing',lease_until=0 WHERE user_id=${user}`
  await assert.rejects(kodyConnection(env, user), /Reconnect/)
  assert.equal(calls, 1)
  assert.equal(await kodyNeedsSignIn(env, user, expired), true)
  // A fresh grant may claim renewal after the previous grant was rejected.
  const fresh = {
    ...expired,
    access_token: 'fresh-expired',
    refresh_token: 'fresh-grant',
  }
  await writeCredentials(env, user, { connection, kody: fresh })
  globalThis.fetch = async () => {
    calls++
    return new Response('', { status: 401 })
  }
  await assert.rejects(kodyConnection(env, user), /expired/)
  assert.equal(calls, 2)
  await assert.rejects(kodyConnection(env, user), /Reconnect/)
  assert.equal(calls, 2)
  const fingerprint = await hash(
    JSON.stringify([
      fresh.client_id,
      fresh.access_token,
      fresh.refresh_token,
      fresh.expires_at,
    ]),
  )
  const [claim] =
    await sql`SELECT status,token_fingerprint FROM chat_kody_refresh_claims WHERE user_id=${user}`
  assert.equal(claim.status, 'needs_auth')
  assert.equal(claim.token_fingerprint, fingerprint)
  console.log(
    'Passed: concurrent renewal, rotated credentials, stale grant protection, expired lease handling, failed refresh replay, and local sign-in status.',
  )
} finally {
  globalThis.fetch = originalFetch
  await sql.end()
}
process.exit(0)
