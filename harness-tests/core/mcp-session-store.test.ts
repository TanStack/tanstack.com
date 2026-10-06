import type { SqlStorage } from '@cloudflare/workers-types'
import { DatabaseSync } from 'node:sqlite'
import { expect, it } from 'vitest'
import {
  initializeMcpSessions,
  durableMcpSession,
} from '../../src/chat/server/mcp-session-store'
it('persists encrypted session state across store recreation with user, task, and server isolation', async () => {
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
  try {
    initializeMcpSessions(sql)
    const scope = { userId: 'u1', taskId: 't1', serverId: 's1' }
    const secret = 'session-storage-test-key-with-32-characters'
    const state = {
      connectionHash: 'fingerprint',
      sessionId: 'private-session-value',
      protocolVersion: '2025-03-26',
      capabilities: { tools: {} },
    }
    await durableMcpSession(sql, scope, secret).save(state)
    expect(await durableMcpSession(sql, scope, secret).load()).toEqual(state)
    const raw = db.prepare('SELECT encrypted FROM mcp_sessions').get()!
      .encrypted as string
    expect(raw).not.toContain(state.sessionId)
    for (const change of [
      { userId: 'u2' },
      { taskId: 't2' },
      { serverId: 's2' },
    ])
      expect(
        await durableMcpSession(sql, { ...scope, ...change }, secret).load(),
      ).toBeUndefined()
    await expect(
      durableMcpSession(sql, scope, secret + 'wrong').load(),
    ).rejects.toThrow()
    await durableMcpSession(sql, scope, secret).save(undefined)
    expect(await durableMcpSession(sql, scope, secret).load()).toBeUndefined()
  } finally {
    db.close()
  }
})
