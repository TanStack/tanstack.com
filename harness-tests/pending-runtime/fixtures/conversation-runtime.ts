import { sqliteDoTransactions } from '../../core/fixtures/sqlite-do-storage'
import postgres from 'postgres'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, vi } from 'vitest'
import { defaultPolicy } from '../../../src/chat/core/types'
// Real TanStack chat and provider adapter. Only unrelated external MCP is excluded.
vi.mock('../../../src/chat/server/mcp-connections', () => ({
  connectedMcpServers: async () => [],
}))
vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(
      public ctx: any,
      public env: any,
    ) {}
  },
}))
vi.mock('../../../src/chat/server/conversation-stream', () => ({
  ConversationStream: class {
    enqueue() {}
    async flush() {}
  },
  streamRequest: vi.fn(),
}))
import {
  Conversation,
  type RunInput,
} from '../../../src/chat/server/conversation'
const closes: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const close of closes.splice(0)) await close()
})
export async function conversationHarness(saved?: Record<string, unknown>) {
  const url = new URL(process.env.DATABASE_URL ?? '')
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !url.pathname.startsWith('/tanchat_test')
  )
    throw new Error(
      'Conversation runtime tests require a migrated local tanchat_test database.',
    )
  const local = new DatabaseSync(':memory:')
  const db = postgres(url.href, { max: 1 })
  closes.push(async () => {
    // Match waitUntil's lifetime, including publication after an RPC returns.
    await settle()
    local.close()
    await db.end()
  })
  // Daily usage includes the shared global counter and has no account foreign key.
  // Reset it explicitly alongside account-owned rows in this guarded test database.
  await db`TRUNCATE users, chat_daily_usage CASCADE`
  await db`INSERT INTO users(id) VALUES(${'00000000-0000-4000-8000-000000000001'})`
  await db`INSERT INTO chat_workspaces(id,owner_id,name,policy) VALUES('w',${'00000000-0000-4000-8000-000000000001'},'Workspace',${db.json(defaultPolicy)})`
  await db`INSERT INTO chat_memberships(workspace_id,user_id,role) VALUES('w',${'00000000-0000-4000-8000-000000000001'},'owner')`
  await db`INSERT INTO chat_bots(id,workspace_id,name,purpose) VALUES('b','w','Bot','')`
  await db`INSERT INTO chat_conversations(id,bot_id,user_id) VALUES('main-conversation','b',${'00000000-0000-4000-8000-000000000001'})`
  await db`INSERT INTO chat_conversation_mains(bot_id,user_id,conversation_id) VALUES('b',${'00000000-0000-4000-8000-000000000001'},'main-conversation')`
  const sql = {
    exec: (query: string, ...values: any[]) => {
      values = values.map((value) =>
        value instanceof ArrayBuffer ? new Uint8Array(value) : value,
      )
      const stmt = local.prepare(query)
      const rows = stmt.columns().length
        ? stmt.all(...values)
        : (stmt.run(...values), [])
      return { toArray: () => rows }
    },
  }
  if (saved) {
    local.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,json TEXT)')
    local.prepare('INSERT INTO state VALUES(1,?)').run(
      JSON.stringify({
        messages: [],
        approvals: [],
        traces: [],
        status: 'idle',
        activeRun: null,
        identity: {
          botId: 'b',
          userId: '00000000-0000-4000-8000-000000000001',
          workspaceId: 'w',
        },
        ...saved,
      }),
    )
  }
  const pending: Promise<unknown>[] = []
  const ctx = {
    id: { equals: (other: string) => other === 'main-conversation' },
    storage: {
      sql,
      ...sqliteDoTransactions(local),
    },
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => pending.push(fn()),
    waitUntil: (p: Promise<unknown>) => pending.push(p),
  }
  const env = {
    CONVERSATIONS: { idFromName: (name: string) => name },
    AI: {
      run: vi.fn(),
      aiGatewayLogId: null,
      models() {
        throw new Error('Unexpected model listing in runtime fixture')
      },
      toMarkdown() {
        throw new Error('Unexpected Markdown conversion in runtime fixture')
      },
      gateway() {
        throw new Error('Unexpected gateway call in runtime fixture')
      },
      websearch() {
        throw new Error('Unexpected web search in runtime fixture')
      },
      aiSearch() {
        throw new Error('Unexpected AI Search in runtime fixture')
      },
      autorag() {
        throw new Error('Unexpected AutoRAG in runtime fixture')
      },
    },
    FILES: {
      async put() {
        throw new Error('Unexpected file write')
      },
      async head() {
        throw new Error('Unexpected file lookup')
      },
      async get() {
        throw new Error('Unexpected file read')
      },
    },
    KODY_ORIGIN: 'https://kody.codes',
    APP_MODE: 'fixture',
    GUM_FIXTURE_DELAY_MS: '20',
    INCLUDED_MODEL: '@cf/moonshotai/kimi-k2.6',
    ENCRYPTION_KEY: 'synthetic-queue-test-encryption-key-only',
  }
  const c = new Conversation(ctx as any, env as any)
  const settle = async () => {
    while (pending.length) await pending.shift()
  }
  await settle()
  const input = (messageId: string, text = messageId): RunInput => ({
    messageId,
    text,
    bot: {
      id: 'b',
      workspace_id: 'w',
      parent_id: null,
      name: 'Bot',
      purpose: '',
      created_at: 1,
    },
    userId: '00000000-0000-4000-8000-000000000001',
    policy: defaultPolicy,
    recipes: [],
    fixture: true,
  })
  const reconstruct = async () => {
    const restored = new Conversation(ctx as any, env as any)
    await settle()
    return restored
  }
  return { c, local, db, ctx, env, input, settle, reconstruct }
}
