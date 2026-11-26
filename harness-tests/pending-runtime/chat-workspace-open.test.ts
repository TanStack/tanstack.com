import { afterAll, beforeAll, expect, it } from 'vitest'
import process from 'node:process'
import postgres from 'postgres'
import { openPersonalChatWorkspace } from '../../src/chat/workspace.server'

const url = new URL(process.env.DATABASE_URL ?? '')
if (
  !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
  !url.pathname.startsWith('/tanchat_test')
) {
  throw new Error(
    'Workspace-open tests require a migrated local tanchat_test database.',
  )
}
const sql = postgres(url.href, { max: 1 })
const userId = crypto.randomUUID()
beforeAll(async () => {
  await sql`INSERT INTO users(id) VALUES(${userId})`
})
afterAll(async () => {
  await sql`DELETE FROM users WHERE id=${userId}`
  await sql.end()
})
it('opens concurrently, preserves existing settings on warm opens, and repairs incomplete initialization', async () => {
  const opened = await Promise.all(
    Array.from({ length: 8 }, () => openPersonalChatWorkspace(userId)),
  )
  const conversationIds = new Set<string>()
  for (const result of opened) conversationIds.add(result.conversationId)
  expect(conversationIds.size).toBe(1)
  const first = opened[0]
  await sql`UPDATE chat_workspaces SET name='Existing workspace' WHERE id=${first.workspace.id}`
  await sql`UPDATE chat_bots SET name='Existing assistant' WHERE id=${first.assistantId}`
  const warm = await openPersonalChatWorkspace(userId)
  expect(warm.workspace.name).toBe('Existing workspace')
  for (const bot of warm.bots) {
    if (bot.id === warm.assistantId) expect(bot.name).toBe('Existing assistant')
  }
  expect(warm.conversationId).toBe(first.conversationId)
  expect(
    await sql`SELECT user_id FROM chat_account_onboarding WHERE user_id=${userId}`,
  ).toHaveLength(1)
  await sql`DELETE FROM chat_account_onboarding WHERE user_id=${userId}`
  const repaired = await openPersonalChatWorkspace(userId)
  expect(repaired.conversationId).toBe(first.conversationId)
  expect(repaired.workspace.name).toBe('Existing workspace')
  expect(
    await sql`SELECT user_id FROM chat_account_onboarding WHERE user_id=${userId}`,
  ).toHaveLength(1)
  expect(
    await sql`SELECT id FROM chat_conversations WHERE user_id=${userId}`,
  ).toHaveLength(1)
})
