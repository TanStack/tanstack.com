import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sql, eq } from 'drizzle-orm'

const databaseUrl = process.env.PRESENCE_TEST_DATABASE_URL

test(
  'presence writes, sequence ordering, history, and transactions with pg',
  {
    skip: databaseUrl
      ? false
      : 'Set PRESENCE_TEST_DATABASE_URL to a disposable local database',
  },
  async () => {
    assert.ok(databaseUrl)
    const url = new URL(databaseUrl)
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname))
    assert.equal(url.pathname, '/presence_driver_tests')
    assert.equal(url.search, '')
    process.env.DATABASE_URL = databaseUrl
    const { db, schema } = await import('../src/db/client')
    const { recordLiveEvent } =
      await import('../src/utils/analytics/live.server')
    try {
      await db.execute(sql`CREATE TABLE live_sessions (
      id uuid PRIMARY KEY, chat_proof_hash text, visitor_chat_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(), company jsonb, lookup_status text NOT NULL
    )`)
      await db.execute(sql`CREATE TABLE live_tabs (
      id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES live_sessions(id),
      page text NOT NULL, visible boolean NOT NULL, sequence bigint NOT NULL,
      last_seen timestamptz NOT NULL, left_at timestamptz, activity jsonb NOT NULL
    )`)
      const event = {
        sessionId: crypto.randomUUID(),
        tabId: crypto.randomUUID(),
        sequence: 1,
        page: '/query/latest',
        visible: true,
      }
      const write = (sequence: number) =>
        recordLiveEvent(
          { ...event, sequence, kind: 'update', action: 'page_view' },
          '192.0.2.1',
          undefined,
          undefined,
        )
      assert.equal(await write(1), true)
      assert.equal(await write(2), false)
      for (let sequence = 3; sequence <= 45; sequence++) await write(sequence)
      await Promise.all([write(48), write(47), write(46)])
      const [tab] = await db
        .select()
        .from(schema.liveTabs)
        .where(eq(schema.liveTabs.id, event.tabId))
      assert.equal(tab.sequence, 48)
      assert.equal(tab.activity.length, 40)
      assert.equal(tab.activity.at(-1)?.action, 'page_view')
      assert.ok(tab.lastSeen instanceof Date)
      await recordLiveEvent(
        { ...event, sequence: 49, kind: 'leave' },
        '192.0.2.1',
        undefined,
        undefined,
      )
      const result = await db.execute(
        sql`SELECT left_at FROM live_tabs WHERE id=${event.tabId}`,
      )
      assert.equal(typeof result.rows[0].left_at, 'string')
      await assert.rejects(
        db.transaction(async (tx) => {
          await tx.delete(schema.liveTabs)
          throw new Error('rollback fixture')
        }),
        /rollback fixture/,
      )
      assert.equal((await db.select().from(schema.liveTabs)).length, 1)
    } finally {
      await db.execute(sql`DROP TABLE IF EXISTS live_tabs, live_sessions`)
      await db.$client.end()
    }
  },
)
