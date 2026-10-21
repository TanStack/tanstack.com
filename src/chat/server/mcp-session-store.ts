import type { SqlStorage } from '@cloudflare/workers-types'
import { seal, unseal } from './crypto'
import type { McpClientOptions } from './mcp'

export function initializeMcpSessions(sql: SqlStorage) {
  sql.exec(`CREATE TABLE IF NOT EXISTS mcp_sessions (
    user_id TEXT NOT NULL, task_id TEXT NOT NULL, server_id TEXT NOT NULL,
    encrypted TEXT NOT NULL,
    PRIMARY KEY (user_id, task_id, server_id)
  )`)
}
/** Conversation-owned SQLite plus explicit user/task/server scope. Never returned in UI state. */
export function durableMcpSession(
  sql: SqlStorage,
  scope: { userId: string; taskId: string; serverId: string },
  encryptionKey: string,
): NonNullable<McpClientOptions['session']> {
  const keys = [scope.userId, scope.taskId, scope.serverId]
  if (keys.some((key) => !key))
    throw new Error('MCP session scope is incomplete.')
  return {
    async load() {
      const row = sql
        .exec<{ encrypted: string }>(
          'SELECT encrypted FROM mcp_sessions WHERE user_id=? AND task_id=? AND server_id=?',
          ...keys,
        )
        .toArray()[0]
      return row ? unseal(row.encrypted, encryptionKey) : undefined
    },
    async save(state) {
      if (!state) {
        sql.exec(
          'DELETE FROM mcp_sessions WHERE user_id=? AND task_id=? AND server_id=?',
          ...keys,
        )
        return
      }
      const encrypted = await seal(state, encryptionKey)
      sql.exec(
        'INSERT INTO mcp_sessions (user_id,task_id,server_id,encrypted) VALUES (?,?,?,?) ON CONFLICT(user_id,task_id,server_id) DO UPDATE SET encrypted=excluded.encrypted',
        ...keys,
        encrypted,
      )
    },
  }
}
