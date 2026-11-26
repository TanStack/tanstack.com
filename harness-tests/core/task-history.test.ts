import type { SqlStorage } from '@cloudflare/workers-types'
import { DatabaseSync } from 'node:sqlite'
import { expect, it } from 'vitest'
import {
  initializeTaskHistory,
  recentTaskContext,
  saveTaskHistory,
  searchTaskHistory,
  readTaskObservation,
  historyCursor,
  continueTaskHistory,
} from '../../src/chat/server/task-history'

it('stores independent turns, updates in place, and reports the bounded recent window', () => {
  const db = new DatabaseSync(':memory:')
  const sql = {
    exec(query: string, ...args: unknown[]) {
      const stmt = db.prepare(query)
      if (query.startsWith('SELECT'))
        return { toArray: () => stmt.all(...(args as any[])) }
      stmt.run(...(args as any[]))
      return { toArray: () => [] }
    },
  } as unknown as SqlStorage
  initializeTaskHistory(sql)
  for (let i = 0; i < 10; i++)
    saveTaskHistory(sql, String(i), {
      request: 'turn ' + i,
      observations: [],
      unresolved: [],
      context: [{ request: 'never recursively save this', observations: [] }],
    })
  saveTaskHistory(sql, '9', {
    request: 'updated turn 9',
    observations: [],
    unresolved: [],
  })
  const recent = recentTaskContext(sql)
  expect(recent.context.map((t) => t.taskId)).toEqual([
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
  ])
  expect(recent.contextWindow).toEqual({ includedTurns: 8, totalTurns: 10 })
  expect(JSON.stringify(recent)).not.toContain('recursively')
  expect(recent.context.at(-1)?.request).toBe('updated turn 9')
  expect(recentTaskContext(sql, 1)).toEqual({
    context: [],
    contextWindow: { includedTurns: 0, totalTurns: 10 },
  })
  expect(searchTaskHistory(sql, 'updated turn')).toMatchObject({
    complete: true,
    matches: [{ taskId: '9' }],
  })
  expect(searchTaskHistory(sql, '%')).toMatchObject({ matches: [] })
  expect(searchTaskHistory(sql, 'UPDATED')).toMatchObject({ matches: [] })
  expect(() => readTaskObservation(sql, 'missing', 'o')).toThrow('unavailable')
  saveTaskHistory(sql, '10', {
    request: 'final',
    observations: [
      {
        id: 'o',
        toolId: 'read',
        toolName: 'read',
        source: { serverId: 's42', serverLabel: 'Team Archive', kind: 'tool' },
        arguments: {},
        ok: false,
        value: { error: 'Historical failure' },
      },
    ],
    unresolved: [],
  })
  const page = searchTaskHistory(sql, '')
  expect(page.matches[0].observations[0].source).toEqual({
    serverId: 's42',
    serverLabel: 'Team Archive',
    kind: 'tool',
  })
  expect(recentTaskContext(sql).context.at(-1)?.observations[0].source).toEqual(
    page.matches[0].observations[0].source,
  )
  expect(page.complete).toBe(false)
  expect(page.matches).toHaveLength(10)
  expect(
    searchTaskHistory(
      sql,
      page.nextArguments!.query,
      page.nextArguments!.before,
    ).matches.map((m) => m.taskId),
  ).toEqual(['0'])
  expect(readTaskObservation(sql, '10', 'o').observation).toMatchObject({
    ok: false,
    value: { error: 'Historical failure' },
  })
  expect(() => readTaskObservation(sql, '10', 'other')).toThrow('not found')
  db.close()
})

it('continues a Unicode history query with an exact bounded cursor', () => {
  const db = new DatabaseSync(':memory:')
  const sql = {
    exec(query: string, ...args: unknown[]) {
      const statement = db.prepare(query)
      if (query.startsWith('SELECT'))
        return { toArray: () => statement.all(...(args as any[])) }
      statement.run(...(args as any[]))
      return { toArray: () => [] }
    },
  } as unknown as SqlStorage
  initializeTaskHistory(sql)
  for (let index = 0; index < 12; index++)
    saveTaskHistory(sql, String(index), {
      request: '議題 ' + index,
      observations: [],
      unresolved: [],
    })
  const first = searchTaskHistory(sql, '議題')
  const next = continueTaskHistory(
    sql,
    historyCursor('議題', first.nextBefore!),
  )
  expect(first.matches).toHaveLength(10)
  expect(next.matches.map((row) => row.taskId)).toEqual(['1', '0'])
  expect(next.complete).toBe(true)
  for (const cursor of [
    'bad',
    'history:broken',
    historyCursor('x', 0),
    historyCursor('x', 1.2),
    historyCursor('x'.repeat(301), 1),
  ]) {
    expect(() => continueTaskHistory(sql, cursor)).toThrow(
      'Invalid history cursor',
    )
  }
  db.close()
})
