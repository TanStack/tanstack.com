import type { DurableObjectStorage } from '@cloudflare/workers-types'
import { DatabaseSync } from 'node:sqlite'
import { performance } from 'node:perf_hooks'
import {
  initializeCopyStorage,
  freezeCopyExport,
  advanceCopyExportBatch,
  readCopyExportPage,
  stageCopyPage,
  advanceCopyImportBatch,
  type CopyHistory,
} from '../../src/chat/server/conversation-copy-storage'
import {
  initializeTranscriptArchive,
  archiveEarlierTurns,
  readArchivedTurn,
} from '../../src/chat/server/transcript-archive'
import { initializeResultStorage } from '../../src/chat/server/durable-results'
import type { CopyExportRequest } from '../../src/chat/core/conversation-copy'

function store() {
  const db = new DatabaseSync(':memory:')
  const storage = {
    sql: {
      exec(query: string, ...values: any[]) {
        const stmt = db.prepare(query)
        const args = values.map((value) =>
          value instanceof ArrayBuffer ? new Uint8Array(value) : value,
        )
        const rows = stmt.columns().length
          ? stmt.all(...args)
          : (stmt.run(...args), [])
        return { toArray: () => rows }
      },
    },
    transactionSync<T>(fn: () => T) {
      db.exec('SAVEPOINT benchmark')
      try {
        const result = fn()
        db.exec('RELEASE benchmark')
        return result
      } catch (error) {
        db.exec('ROLLBACK TO benchmark')
        db.exec('RELEASE benchmark')
        throw error
      }
    },
  } as unknown as Pick<DurableObjectStorage, 'sql' | 'transactionSync'>
  initializeTranscriptArchive(storage.sql)
  initializeResultStorage(storage.sql)
  initializeCopyStorage(storage.sql)
  return { db, storage }
}
const results = []
for (const turns of [100, 1_000, 10_000]) {
  for (const kind of ['early-fork', 'duplicate'] as const) {
    const source = store(),
      target = store()
    const history = {
      messages: Array.from({ length: turns }, (_, i) => [
        {
          id: `u${i}`,
          role: 'user' as const,
          parts: [{ type: 'text' as const, content: 'Question '.repeat(16) }],
        },
        {
          id: `a${i}`,
          role: 'assistant' as const,
          parts: [{ type: 'text' as const, content: 'Answer '.repeat(32) }],
        },
      ]).flat(),
      approvals: [],
    } satisfies CopyHistory
    archiveEarlierTurns(source.storage.sql, history)
    const request: CopyExportRequest = {
      operationId: 'benchmark',
      botId: 'source',
      userId: 'user',
      workspaceId: 'workspace',
      targetConversationId: 'target',
      kind: kind === 'early-fork' ? 'fork' : 'duplicate',
      boundary:
        kind === 'early-fork'
          ? {
              kind: 'message',
              epoch: 'epoch',
              messageId: 'a2',
              expectedDigest: 'synthetic',
            }
          : { kind: 'end', epoch: 'epoch', expectedRevision: 1 },
    }
    const started = performance.now()
    freezeCopyExport(source.storage, request, history, 'epoch', 1)
    const frozen = performance.now()
    let exportBursts = 1
    let result = await advanceCopyExportBatch(source.storage, 'benchmark')
    while (result.status !== 'sealed') {
      exportBursts++
      result = await advanceCopyExportBatch(source.storage, 'benchmark')
    }
    const exported = performance.now(),
      manifest = result.manifest
    let wireBytes = 0
    for (let ordinal = 0; ordinal < manifest.pageCount; ordinal++) {
      const page = readCopyExportPage(source.storage.sql, 'benchmark', ordinal)
      wireBytes += Buffer.byteLength(page.payload)
      await stageCopyPage(target.storage, 'benchmark', manifest, page, {
        botId: 'target',
        userId: 'user',
        workspaceId: 'workspace',
      })
    }
    const transferred = performance.now()
    let importBursts = 1
    let imported = await advanceCopyImportBatch(
      target.storage,
      'benchmark',
      manifest.digest,
    )
    while (imported.status !== 'ready') {
      importBursts++
      imported = await advanceCopyImportBatch(
        target.storage,
        'benchmark',
        manifest.digest,
      )
    }
    const finished = performance.now()
    const expected = kind === 'early-fork' ? 3 : turns
    if (
      manifest.messageCount !== expected * 2 ||
      readArchivedTurn(target.storage.sql).turn?.messages.at(-1)?.id !==
        `a${expected - 1}`
    )
      throw new Error('Invalid copy')
    results.push({
      turns,
      kind,
      messages: manifest.messageCount,
      pages: manifest.pageCount,
      wireBytes,
      exportBursts,
      importBursts,
      freezeMs: +(frozen - started).toFixed(2),
      exportMs: +(exported - frozen).toFixed(2),
      stageMs: +(transferred - exported).toFixed(2),
      importMs: +(finished - transferred).toFixed(2),
      totalMs: +(finished - started).toFixed(2),
    })
    source.db.close()
    target.db.close()
  }
}
console.log(
  JSON.stringify(
    {
      scope:
        'Real copy storage protocol on local SQLite. No D1, network, alarm delay, browser, model or external services.',
      results,
    },
    null,
    2,
  ),
)
