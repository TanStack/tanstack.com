import type { SqlStorage } from '@cloudflare/workers-types'
import type { UIMessage } from '@tanstack/ai'
import type { FileScope, SavedFile } from '../core/files'
import {
  fileDeliverySchema,
  fileDeliveryToolName,
  readFileDeliveries,
  type FileDelivery,
} from '../core/file-deliveries'

export type ExpectedNativeFile = Pick<
  SavedFile,
  'id' | 'name' | 'mediaType' | 'size' | 'sha256'
> & { source?: SavedFile['source'] }
export type NativeFileIntent = {
  /** Absent is a legacy/new save. References never assert a storage write. */
  kind?: 'reference' | 'copy'
  scope: FileScope
  taskId: string
  turnId: string
  messageId: string
  toolCallId: string
  expected: ExpectedNativeFile
}
type Row = {
  id: string
  json: string
  receipt: string | null
  attempts: number
  retry_at: number
}
/** Private authority journal. No tool result, model text or MCP payload can write it. */
export class NativeFileDelivery {
  constructor(private sql: SqlStorage) {
    sql.exec(
      'CREATE TABLE IF NOT EXISTS native_file_deliveries (id TEXT PRIMARY KEY,json TEXT NOT NULL,receipt TEXT,attempts INTEGER NOT NULL DEFAULT 0,retry_at INTEGER NOT NULL DEFAULT 0)',
    )
  }
  private key(intent: Pick<NativeFileIntent, 'taskId' | 'toolCallId'>) {
    return JSON.stringify([intent.taskId, intent.toolCallId])
  }
  intent(taskId: string, toolCallId: string) {
    const row = this.sql
      .exec<Row>(
        'SELECT * FROM native_file_deliveries WHERE id=?',
        this.key({ taskId, toolCallId }),
      )
      .toArray()[0]
    if (!row) throw new Error('The native save intent is unavailable.')
    return JSON.parse(row.json) as NativeFileIntent
  }
  prepare(intent: NativeFileIntent) {
    const id = this.key(intent)
    const row = this.sql
      .exec<Row>('SELECT * FROM native_file_deliveries WHERE id=?', id)
      .toArray()[0]
    const json = JSON.stringify(intent)
    if (row && row.json !== json)
      throw new Error(
        'This native save identity already belongs to another file.',
      )
    if (
      !row &&
      this.sql
        .exec<{ total: number }>(
          'SELECT count(*) AS total FROM native_file_deliveries',
        )
        .toArray()[0].total >= 1000
    )
      throw new Error('Too many unfinished file deliveries. Try again later.')
    this.sql.exec(
      'INSERT OR IGNORE INTO native_file_deliveries(id,json) VALUES (?,?)',
      id,
      json,
    )
  }
  confirm(intent: NativeFileIntent, file: SavedFile) {
    if (
      file.botId !== intent.scope.botId ||
      (intent.scope.conversationId !== undefined &&
        file.conversationId !== intent.scope.conversationId) ||
      file.state !== 'ready' ||
      (intent.kind !== 'reference' && file.source !== 'assistant') ||
      Object.entries(intent.expected).some(
        ([key, value]) => file[key as keyof SavedFile] !== value,
      )
    )
      throw new Error('The saved file did not match its native save intent.')
    const receipt = fileDeliverySchema.parse({
      kind:
        intent.kind === 'reference'
          ? 'file-reference'
          : intent.kind === 'copy'
            ? 'file-copy'
            : 'file',
      workspaceId: intent.scope.workspaceId,
      toolCallId: intent.toolCallId,
      file,
    })
    // A reset deletes the intent. An in-flight recovery must never recreate it.
    this.sql.exec(
      'UPDATE native_file_deliveries SET receipt=? WHERE id=? AND json=?',
      JSON.stringify(receipt),
      this.key(intent),
      JSON.stringify(intent),
    )
  }
  overlay(messages: UIMessage[]) {
    const byMessage = new Map<string, FileDelivery[]>()
    for (const row of this.sql
      .exec<Row>('SELECT * FROM native_file_deliveries')
      .toArray()) {
      const intent = JSON.parse(row.json) as NativeFileIntent
      if (!messages.some((message) => message.id === intent.messageId)) {
        const start = messages.findIndex(
          (message) => message.id === intent.turnId && message.role === 'user',
        )
        if (start >= 0) {
          let end = start + 1
          while (end < messages.length && messages[end].role !== 'user') end++
          const replacement = messages
            .slice(start + 1, end)
            .reverse()
            .find(
              (message) =>
                message.role === 'assistant' &&
                !message.metadata?.gumInherited &&
                message.parts.some(
                  (part) =>
                    part.type === 'tool-call' &&
                    part.name ===
                      (intent.kind === 'reference'
                        ? 'present_file'
                        : intent.kind === 'copy'
                          ? 'copy_file'
                          : 'save_file') &&
                    part.id === intent.toolCallId,
                ),
            )
          if (replacement) {
            intent.messageId = replacement.id
            this.sql.exec(
              'UPDATE native_file_deliveries SET json=? WHERE id=?',
              JSON.stringify(intent),
              row.id,
            )
          }
        }
      }
      if (!row.receipt) continue
      const receipt = fileDeliverySchema.parse(JSON.parse(row.receipt!))
      const values = byMessage.get(intent.messageId) ?? []
      values.push(receipt)
      byMessage.set(intent.messageId, values)
    }
    return messages.map((message) => {
      const additions = byMessage.get(message.id)
      if (!additions || message.role !== 'assistant') return message
      const valid = additions.filter((receipt) =>
        message.parts.some(
          (part) =>
            part.type === 'tool-call' &&
            part.name === fileDeliveryToolName(receipt) &&
            part.id === receipt.toolCallId,
        ),
      )
      if (!valid.length) return message
      const receipts = [
        ...new Map(
          [...readFileDeliveries(message), ...valid].map((receipt) => [
            receipt.toolCallId,
            receipt,
          ]),
        ).values(),
      ]
      return {
        ...message,
        metadata: { ...message.metadata, gumFileDeliveries: receipts },
      }
    })
  }
  prune(messages: UIMessage[]) {
    const live = new Set(messages.map((message) => message.id))
    for (const row of this.sql
      .exec<Row>('SELECT * FROM native_file_deliveries')
      .toArray()) {
      if (!live.has((JSON.parse(row.json) as NativeFileIntent).messageId))
        this.sql.exec('DELETE FROM native_file_deliveries WHERE id=?', row.id)
    }
  }
  async reconcile(
    read: (intent: NativeFileIntent) => Promise<SavedFile>,
    now = Date.now(),
  ) {
    const rows = this.sql
      .exec<Row>(
        'SELECT * FROM native_file_deliveries WHERE receipt IS NULL AND retry_at<=? ORDER BY retry_at,id LIMIT 8',
        now,
      )
      .toArray()
    for (const row of rows) {
      const intent = JSON.parse(row.json) as NativeFileIntent
      try {
        this.confirm(intent, await read(intent))
      } catch {
        this.sql.exec(
          'UPDATE native_file_deliveries SET attempts=attempts+1,retry_at=? WHERE id=? AND receipt IS NULL',
          now + Math.min(3600000, 5000 * 2 ** Math.min(row.attempts, 10)),
          row.id,
        )
      }
    }
    return (
      this.sql
        .exec<{ next: number | null }>(
          'SELECT min(retry_at) AS next FROM native_file_deliveries WHERE receipt IS NULL',
        )
        .toArray()[0]?.next ?? undefined
    )
  }
  reset() {
    this.sql.exec('DELETE FROM native_file_deliveries')
  }
}
