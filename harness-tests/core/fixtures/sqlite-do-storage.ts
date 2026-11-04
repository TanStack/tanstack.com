import type { DatabaseSync } from 'node:sqlite'
import { vi } from 'vitest'

/** Persistent alarms participate in the same SQLite rollback as fixture DO data.
 * Async transactions are serialized; synchronous nested writes use savepoints. */
export function sqliteDoTransactions(db: DatabaseSync) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS test_alarm (id INTEGER PRIMARY KEY CHECK(id=1), time INTEGER NOT NULL)',
  )
  let sequence = 0
  let tail: Promise<unknown> = Promise.resolve()
  return {
    transactionSync<T>(work: () => T): T {
      const name = 'fixture_sync_' + sequence++
      db.exec('SAVEPOINT ' + name)
      try {
        const value = work()
        db.exec('RELEASE ' + name)
        return value
      } catch (error) {
        db.exec('ROLLBACK TO ' + name)
        db.exec('RELEASE ' + name)
        throw error
      }
    },
    transaction<T>(work: () => Promise<T>): Promise<T> {
      const next = tail.then(async () => {
        const name = 'fixture_async_' + sequence++
        db.exec('SAVEPOINT ' + name)
        try {
          const result = await work()
          db.exec('RELEASE ' + name)
          return result
        } catch (error) {
          db.exec('ROLLBACK TO ' + name)
          db.exec('RELEASE ' + name)
          throw error
        }
      })
      tail = next.catch(() => {})
      return next
    },
    getAlarm: async () =>
      (db.prepare('SELECT time FROM test_alarm WHERE id=1').get()?.time as
        | number
        | undefined) ?? null,
    setAlarm: vi.fn(async (time: number | Date) => {
      db.prepare(
        'INSERT INTO test_alarm VALUES(1,?) ON CONFLICT(id) DO UPDATE SET time=excluded.time',
      ).run(Number(time))
    }),
    deleteAlarm: async () => {
      db.prepare('DELETE FROM test_alarm WHERE id=1').run()
    },
  }
}
