import type {
  SqlStorage,
  DurableObjectStorage,
} from '@cloudflare/workers-types'
import type { ResultStore } from './stored-results'

export function initializeResultStorage(sql: SqlStorage) {
  sql.exec(`CREATE TABLE IF NOT EXISTS task_result_chunks (
    task_id TEXT NOT NULL, result_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL, payload BLOB NOT NULL,
    PRIMARY KEY (task_id, result_id, ordinal)
  )`)
}

/** Each store is scoped to one task within its owning conversation. */
export function durableResultStore(
  storage: Pick<DurableObjectStorage, 'sql' | 'transactionSync'>,
  taskId: string,
  readableTaskIds: string[] = [],
): ResultStore {
  return {
    async put(id, value) {
      const encoded = new TextEncoder().encode(JSON.stringify(value))
      if (encoded.length > 4 * 1024 * 1024)
        throw new Error('Stored result exceeds the 4 MiB limit.')
      storage.transactionSync(() => {
        storage.sql.exec(
          'DELETE FROM task_result_chunks WHERE task_id=? AND result_id=?',
          taskId,
          id,
        )
        // Byte chunks preserve Unicode even when a character crosses a boundary.
        for (
          let start = 0, ordinal = 0;
          start < encoded.length;
          start += 65536, ordinal++
        )
          storage.sql.exec(
            'INSERT INTO task_result_chunks (task_id,result_id,ordinal,payload) VALUES (?,?,?,?)',
            taskId,
            id,
            ordinal,
            encoded.slice(start, start + 65536).buffer,
          )
      })
    },
    async get(id) {
      let rows: Array<{ ordinal: number; payload: ArrayBuffer }> = []
      for (const scope of new Set([taskId, ...readableTaskIds])) {
        rows = storage.sql
          .exec<{ ordinal: number; payload: ArrayBuffer }>(
            'SELECT ordinal,payload FROM task_result_chunks WHERE task_id=? AND result_id=? ORDER BY ordinal',
            scope,
            id,
          )
          .toArray()
        if (rows.length) break
      }
      if (!rows.length) return undefined
      const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
      let json = ''
      for (const [ordinal, row] of rows.entries()) {
        if (row.ordinal !== ordinal)
          throw new Error('Stored result is incomplete.')
        json += decoder.decode(row.payload, { stream: true })
      }
      return JSON.parse(json + decoder.decode())
    },
  }
}
