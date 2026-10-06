import type { SqlStorage } from '@cloudflare/workers-types'
import { DatabaseSync } from 'node:sqlite'
import { expect, it } from 'vitest'
import { orderedTaskHistoryTool } from '../../src/chat/server/ordered-history'
import {
  initializeTaskHistory,
  saveTaskHistory,
} from '../../src/chat/server/task-history'
function setup() {
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
  for (let i = 1; i <= 3; i++)
    saveTaskHistory(sql, 't' + i, {
      request: 'Task ' + i,
      observations: [
        {
          id: 'o' + i,
          toolId: 'read',
          toolName: 'read',
          arguments: {},
          ok: true,
          value: { id: i },
        },
      ],
      unresolved: [],
    })
  return { db, sql, tool: orderedTaskHistoryTool(sql) }
}
it.each(['oldest', 'newest'])(
  'paginates %s tasks without skips or duplicates',
  async (order) => {
    const { db, tool } = setup()
    try {
      let args: any = { order, pageSize: 1 }
      const ids: string[] = []
      while (args) {
        const page: any = await tool.invoke(args, new AbortController().signal)
        ids.push(...page.matches.map((m: any) => m.taskId))
        args = page.nextArguments
        expect(page.hasMoreTasks).toBe(args !== null)
      }
      expect(ids).toEqual(
        order === 'oldest' ? ['t1', 't2', 't3'] : ['t3', 't2', 't1'],
      )
    } finally {
      db.close()
    }
  },
)
it('omits oversized observation contents while preserving a readable reference', async () => {
  const { db, sql, tool } = setup()
  try {
    saveTaskHistory(sql, 'large', {
      request: 'Large saved result',
      observations: [
        {
          id: 'large-result',
          toolId: 'read',
          toolName: 'read',
          arguments: {},
          ok: true,
          value: 'x'.repeat(45000),
        },
      ],
      unresolved: [],
    })
    const page: any = await tool.invoke(
      { order: 'newest', pageSize: 1 },
      new AbortController().signal,
    )
    expect(page.matches[0]).toMatchObject({
      taskId: 'large',
      observations: [
        { id: 'large-result', historical: true, resultOmitted: true },
      ],
    })
    expect(page.matches[0].observations[0]).not.toHaveProperty('value')
  } finally {
    db.close()
  }
})
