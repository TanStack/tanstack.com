import type { SqlStorage } from '@cloudflare/workers-types'
import { DatabaseSync } from 'node:sqlite'
import { expect, it } from 'vitest'
import type { UIMessage } from '@tanstack/ai'
import {
  initializeTranscriptArchive,
  archiveEarlierTurns,
  readArchivedMessage,
  readArchivedTurn,
  readArchivedNavigation,
  modelTranscriptHistory,
} from '../../src/chat/server/transcript-archive'
function fixture() {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys=ON')
  const queries: string[] = []
  const sql = {
    exec(query: string, ...args: unknown[]) {
      queries.push(query)
      const stmt = db.prepare(query)
      const values = args.map((v) =>
        v instanceof ArrayBuffer ? new Uint8Array(v) : v,
      )
      if (query.startsWith('SELECT'))
        return { toArray: () => stmt.all(...(values as any[])) }
      stmt.run(...(values as any[]))
      return { toArray: () => [] }
    },
  } as unknown as SqlStorage
  initializeTranscriptArchive(sql)
  return { db, sql, queries }
}
function simpleMessages(turns: number): UIMessage[] {
  return Array.from({ length: turns }, (_, i) => [
    {
      id: `u${i}`,
      role: 'user' as const,
      parts: [{ type: 'text' as const, content: `request ${i}` }],
    },
    {
      id: `a${i}`,
      role: 'assistant' as const,
      parts: [{ type: 'text' as const, content: `answer ${i}` }],
    },
  ]).flat()
}
it('restores older facts for model context after the six-turn storage window rolls over', () => {
  const { db, sql } = fixture()
  const original = simpleMessages(10)
  original[0].parts = [
    { type: 'text', content: 'Cedar has 18 of 24 tasks done.' },
  ]
  const state = { messages: original, approvals: [] }
  archiveEarlierTurns(sql, state)
  expect(state.messages).toHaveLength(12)
  const model = modelTranscriptHistory(sql, state.messages)
  expect(model).toEqual(original)
  expect(state.messages).toHaveLength(12)
  expect(readArchivedTurn(sql).turn?.id).toBe('u3')
  db.close()
})

it('preserves whole archived turns and points to the first omitted page', () => {
  const { db, sql } = fixture()
  const state = { messages: simpleMessages(10), approvals: [] }
  archiveEarlierTurns(sql, state)
  const model = modelTranscriptHistory(sql, state.messages, 80000, 2)
  expect(model.slice(1).map((m) => m.id)).toEqual(
    simpleMessages(10)
      .slice(4)
      .map((m) => m.id),
  )
  const notice = model[0].parts[0]
  expect(notice.type).toBe('text')
  if (notice.type !== 'text') throw new Error('Missing history boundary')
  const cursor = JSON.parse(notice.content.match(/\{"before":\d+\}/)![0])
  expect(readArchivedTurn(sql, cursor.before).turn?.id).toBe('u1')
  const bounded = modelTranscriptHistory(sql, state.messages, 1000)
  expect(bounded.slice(1)).toEqual(state.messages)
  expect(bounded[0].parts[0]).toMatchObject({
    type: 'text',
    content: expect.stringContaining('using {}'),
  })
  db.close()
})
it('archives whole turns without losing Unicode, outcomes, approvals, or page order', () => {
  const { db, sql } = fixture()
  const messages: UIMessage[] = Array.from({ length: 4 }, (_, i) => [
    {
      id: 'u' + i,
      role: 'user' as const,
      parts: [{ type: 'text' as const, content: 'request ' + i }],
    },
    {
      id: 'a' + i,
      role: 'assistant' as const,
      parts: [{ type: 'text' as const, content: '🌳'.repeat(18000) + i }],
    },
  ]).flat()
  const state = {
    messages,
    approvals: [
      {
        id: 'approval',
        turnId: 'u0',
        title: 'Read',
        code: '{}',
        status: 'done' as const,
        result: 'done',
      },
    ],
    turnOutcomes: { u0: { status: 'done' as const, answerId: 'a0' } },
    archivedTurns: 0,
  }
  archiveEarlierTurns(sql, state, 1)
  expect(state.messages.map((m) => m.id)).toEqual(['u3', 'a3'])
  expect(state.archivedTurns).toBe(3)
  expect(state.approvals).toEqual([])
  const newest = readArchivedTurn(sql)
  expect(newest.turn?.messages).toEqual(messages.slice(4, 6))
  const middle = readArchivedTurn(sql, newest.nextBefore!)
  expect(middle.turn?.id).toBe('u1')
  const oldest = readArchivedTurn(sql, middle.nextBefore!)
  expect(oldest.turn?.messages).toEqual(messages.slice(0, 2))
  expect(oldest.turn?.approvals).toHaveLength(1)
  expect(oldest.turn?.outcome).toEqual({ status: 'done', answerId: 'a0' })
  expect(oldest.nextBefore).toBeNull()
  archiveEarlierTurns(sql, state, 1)
  expect(state.archivedTurns).toBe(3)
  expect(() => readArchivedTurn(sql, -1)).toThrow('cursor')
  expect(
    sql
      .exec('SELECT turn_id FROM transcript_turns WHERE turn_id=?', 'u0')
      .toArray(),
  ).toHaveLength(1)
  db.close()
})

it('finds an archived message directly and preserves its older-page cursor', () => {
  const { db, sql, queries } = fixture()
  const messages = simpleMessages(4)
  archiveEarlierTurns(sql, { messages, approvals: [] }, 1)
  queries.length = 0
  const found = readArchivedMessage(sql, 'a1')
  expect(found.turn?.messages).toEqual(messages.slice(2, 4))
  expect(found.nextBefore).toBe(2)
  expect(found.indexing).toBeUndefined()
  expect(queries.some((query) => query.includes('LEFT JOIN'))).toBe(false)
  expect(readArchivedTurn(sql, found.nextBefore!).turn?.id).toBe('u0')
  expect(readArchivedMessage(sql, 'a0').nextBefore).toBeNull()
  expect(readArchivedMessage(sql, 'a3')).toEqual({
    turn: null,
    nextBefore: null,
  })
  expect(() => readArchivedMessage(sql, '')).toThrow('message ID')
  expect(() => readArchivedMessage(sql, 'x'.repeat(129))).toThrow('message ID')
  db.close()
})

it('resumes bounded legacy indexing and distinguishes unfinished from missing', () => {
  const { db, sql } = fixture()
  archiveEarlierTurns(sql, { messages: simpleMessages(19), approvals: [] }, 1)
  db.exec(
    'DELETE FROM transcript_messages; DELETE FROM transcript_indexed_turns',
  )
  expect(readArchivedMessage(sql, 'a0')).toEqual({
    turn: null,
    nextBefore: null,
    indexing: { remainingTurns: 10 },
  })
  initializeTranscriptArchive(sql)
  expect(readArchivedMessage(sql, 'a0')).toEqual({
    turn: null,
    nextBefore: null,
    indexing: { remainingTurns: 2 },
  })
  expect(readArchivedMessage(sql, 'a0').turn?.id).toBe('u0')
  expect(readArchivedMessage(sql, 'missing')).toEqual({
    turn: null,
    nextBefore: null,
  })
  expect(
    db.prepare('SELECT count(*) AS total FROM transcript_messages').get(),
  ).toEqual({ total: 36 })
  db.close()
})

it('repairs partially indexed legacy turns without rewriting archive chunks', () => {
  const { db, sql } = fixture()
  archiveEarlierTurns(sql, { messages: simpleMessages(3), approvals: [] }, 1)
  const chunks = db
    .prepare('SELECT * FROM transcript_chunks ORDER BY turn_id,ordinal')
    .all()
  db.exec(
    'DELETE FROM transcript_messages; DELETE FROM transcript_indexed_turns',
  )
  db.prepare('INSERT INTO transcript_messages VALUES (?,?)').run('u0', 'u0')
  expect(readArchivedMessage(sql, 'a0').turn?.id).toBe('u0')
  expect(
    db
      .prepare('SELECT * FROM transcript_chunks ORDER BY turn_id,ordinal')
      .all(),
  ).toEqual(chunks)
  db.exec('DELETE FROM transcript_indexed_turns')
  readArchivedTurn(sql)
  expect(
    db.prepare('SELECT turn_id FROM transcript_indexed_turns').all(),
  ).toEqual([{ turn_id: 'u1' }])
  db.close()
})

it('keeps existing archives immutable and fails visibly on damaged chunks', () => {
  const { db, sql } = fixture()
  archiveEarlierTurns(sql, { messages: simpleMessages(2), approvals: [] }, 1)
  const changed = simpleMessages(2)
  changed[1].parts = [{ type: 'text', content: 'changed answer' }]
  expect(() =>
    archiveEarlierTurns(sql, { messages: changed, approvals: [] }, 1),
  ).toThrow('cannot be changed')
  expect(readArchivedMessage(sql, 'a0').turn?.messages).toEqual(
    simpleMessages(1),
  )
  db.exec('UPDATE transcript_chunks SET ordinal=2')
  expect(() => readArchivedMessage(sql, 'a0')).toThrow('incomplete')
  db.close()
})

it('clears the message index when archive turns are reset', () => {
  const { db, sql } = fixture()
  archiveEarlierTurns(sql, { messages: simpleMessages(2), approvals: [] }, 1)
  db.exec('DELETE FROM transcript_chunks; DELETE FROM transcript_turns')
  expect(db.prepare('SELECT * FROM transcript_messages').all()).toEqual([])
  expect(db.prepare('SELECT * FROM transcript_indexed_turns').all()).toEqual([])
  expect(db.prepare('SELECT * FROM transcript_navigation').all()).toEqual([])
  expect(readArchivedMessage(sql, 'a0')).toEqual({
    turn: null,
    nextBefore: null,
  })
  db.close()
})

it('pages the entire archive with bounded previews without rereading message bodies', () => {
  const { db, sql, queries } = fixture()
  const messages = simpleMessages(103)
  archiveEarlierTurns(sql, { messages, approvals: [] }, 1)
  queries.length = 0
  const first = readArchivedNavigation(sql)
  expect(first.items).toHaveLength(40)
  expect(first).toMatchObject({ total: 102, startIndex: 62, nextBefore: 63 })
  expect(first.items[0]).toEqual({
    id: 'u62',
    sequence: 63,
    prompt: 'request 62',
    preview: 'answer 62',
  })
  const second = readArchivedNavigation(sql, first.nextBefore!)
  const third = readArchivedNavigation(sql, second.nextBefore!)
  expect(second).toMatchObject({ total: 102, startIndex: 22, nextBefore: 23 })
  expect(third).toMatchObject({ total: 102, startIndex: 0, nextBefore: null })
  expect(
    [...third.items, ...second.items, ...first.items].map((item) => item.id),
  ).toEqual(Array.from({ length: 102 }, (_, i) => `u${i}`))
  expect(queries.some((q) => q.includes('transcript_chunks'))).toBe(false)
  expect(() => readArchivedNavigation(sql, NaN)).toThrow('cursor')
  db.close()
})

it('indexes legacy/imported turns a bounded page at a time, preserving gaps and future appends', () => {
  const { db, sql, queries } = fixture()
  archiveEarlierTurns(sql, { messages: simpleMessages(20), approvals: [] }, 1)
  db.exec('DELETE FROM transcript_navigation')
  const bodies = db.prepare('SELECT * FROM transcript_chunks').all()
  queries.length = 0
  const first = readArchivedNavigation(sql)
  expect(first.items.map((item) => item.id)).toEqual(
    Array.from({ length: 8 }, (_, i) => `u${i + 11}`),
  )
  expect(
    queries.filter((q) => q.includes('FROM transcript_chunks')),
  ).toHaveLength(8)
  initializeTranscriptArchive(sql)
  const second = readArchivedNavigation(sql, first.nextBefore!)
  const third = readArchivedNavigation(sql, second.nextBefore!)
  expect(third.items.map((item) => item.id)).toEqual(['u0', 'u1', 'u2'])
  expect(third.nextBefore).toBeNull()
  expect(db.prepare('SELECT * FROM transcript_chunks').all()).toEqual(bodies)
  const more = simpleMessages(22).slice(38)
  archiveEarlierTurns(sql, { messages: more, approvals: [] }, 1)
  expect(
    readArchivedNavigation(sql, first.nextBefore!).items.map((item) => item.id),
  ).toEqual(Array.from({ length: 11 }, (_, i) => `u${i}`))
  db.close()
})

it('previews only visible prompt/final text and never includes tools, approvals or private reasoning', () => {
  const { db, sql } = fixture()
  const messages = simpleMessages(5)
  messages[0].parts = [
    { type: 'text', content: '# ' + 'Long prompt '.repeat(100) },
  ]
  messages[1].parts = [
    { type: 'text', content: 'Interim progress' },
    {
      type: 'tool-call',
      id: 'secret',
      name: 'tool',
      arguments: '{"token":"secret"}',
      state: 'complete',
    },
    { type: 'thinking', content: 'private reasoning' } as any,
    { type: 'text', content: 'Final **answer**' },
  ]
  archiveEarlierTurns(
    sql,
    {
      messages,
      approvals: [],
      turnOutcomes: {
        u0: { status: 'done', answerId: 'a0' },
        u1: { status: 'error', answerId: 'a1' },
        u2: { status: 'waiting', answerId: 'a2' },
      },
      inheritedTurns: { u3: { partial: true } },
    },
    1,
  )
  const page = readArchivedNavigation(sql)
  expect(page.items[0].prompt.length).toBeLessThanOrEqual(180)
  expect(page.items[0].prompt).toMatch(/…$/)
  expect(page.items.map((item) => item.preview)).toEqual([
    'Final answer',
    '',
    '',
    '',
  ])
  expect(JSON.stringify(page)).not.toMatch(
    /secret|private reasoning|Interim progress/,
  )
  db.close()
})
