import { afterAll, beforeAll, expect, it } from 'vitest'
import postgres from 'postgres'
import process from 'node:process'
import type { AuthUser } from '../../src/auth/types'
import {
  joinChatWaitlist,
  readChatWaitlist,
} from '../../src/chat/access.server'

const url = new URL(process.env.DATABASE_URL ?? '')
if (
  !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
  !url.pathname.startsWith('/tanchat_test')
) {
  throw new Error(
    'Waitlist tests require a migrated local tanchat_test database.',
  )
}
const sql = postgres(url.href, { max: 1 })
const first: AuthUser = {
  userId: crypto.randomUUID(),
  email: 'waitlist@example.com',
  name: null,
  image: null,
  oauthImage: null,
  displayUsername: null,
  capabilities: [],
  adsDisabled: null,
  interestedInHidingAds: null,
  lastUsedFramework: null,
  signupSources: [],
}
const second = { ...first, userId: crypto.randomUUID() }
beforeAll(async () => {
  await sql`INSERT INTO users(id) VALUES (${first.userId}), (${second.userId})`
})
afterAll(async () => {
  await sql`DELETE FROM users WHERE id IN (${first.userId}, ${second.userId})`
  await sql.end()
})
it('saves one request per account without granting chat access, and removes it with the account', async () => {
  expect(await readChatWaitlist(first)).toBe(false)
  await Promise.all([joinChatWaitlist(first), joinChatWaitlist(first)])
  expect(await readChatWaitlist(first)).toBe(true)
  expect(await readChatWaitlist(second)).toBe(false)
  const entries =
    await sql`SELECT user_id,created_at FROM chat_waitlist WHERE user_id=${first.userId}`
  expect(entries).toHaveLength(1)
  expect(entries[0].created_at).toBeInstanceOf(Date)
  expect(
    await sql`SELECT user_id FROM chat_access WHERE user_id=${first.userId}`,
  ).toHaveLength(0)
  await sql`DELETE FROM users WHERE id=${first.userId}`
  expect(await readChatWaitlist(first)).toBe(false)
})
