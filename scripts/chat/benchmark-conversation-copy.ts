import { DatabaseSync } from 'node:sqlite'
import { performance } from 'node:perf_hooks'
import { initializeCopyStorage } from '../../src/chat/server/conversation-copy-storage'

// Synthetic SQLite microbenchmark. Excludes network, alarms, hashing and payload transfer.
const results = []
for (const turns of [1_000, 10_000, 50_000]) {
  const db = new DatabaseSync(':memory:')
  const sql = {
    exec(query: string, ...args: any[]) {
      const rows = db.prepare(query).all(...args)
      return { toArray: () => rows }
    },
  }
  initializeCopyStorage(sql as any)
  db.exec('DROP INDEX copy_raw_sequence')
  const insert = db.prepare('INSERT INTO copy_raw VALUES (?,?,?,?,?,?)')
  db.exec('BEGIN')
  for (let sequence = 1; sequence <= turns; sequence++) {
    for (let ordinal = 0; ordinal < 2; ordinal++) {
      insert.run(
        'copy',
        'turn',
        `turn-${sequence}`,
        sequence,
        ordinal,
        new Uint8Array(16),
      )
    }
  }
  db.exec('COMMIT')
  const oldQuery =
    "SELECT key,sequence FROM copy_raw WHERE operation_id=? AND kind='turn' AND sequence>? GROUP BY key ORDER BY sequence LIMIT 1"
  const newQuery =
    "SELECT key,sequence FROM copy_raw WHERE operation_id=? AND kind='turn' AND ordinal=0 AND sequence>? ORDER BY sequence LIMIT 1"
  const measure = (query: string) => {
    const stmt = db.prepare(query)
    const start = performance.now()
    for (let i = 0; i < 100; i++) {
      const cursor = Math.floor((i * turns) / 100)
      const row = stmt.get('copy', cursor)
      if (row?.sequence !== cursor + 1)
        throw new Error('Incorrect copy ordering')
    }
    return Number((performance.now() - start).toFixed(3))
  }
  const beforeMs = measure(oldQuery)
  initializeCopyStorage(sql as any)
  const afterMs = measure(newQuery)
  results.push({
    turns,
    lookups: 100,
    beforeMs,
    afterMs,
    plan: db
      .prepare('EXPLAIN QUERY PLAN ' + newQuery)
      .all('copy', 0)
      .map((row) => row.detail),
  })
  db.close()
}
console.log(
  JSON.stringify(
    {
      benchmark: 'copy next-turn lookup, local SQLite, 2 chunks/turn',
      results,
    },
    null,
    2,
  ),
)
