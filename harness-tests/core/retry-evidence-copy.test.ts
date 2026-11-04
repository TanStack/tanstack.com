import type { DurableObjectStorage } from '@cloudflare/workers-types'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import type { UIMessage } from '@tanstack/ai'
import {
  canonicalCopyJson,
  copyMessage,
  type BranchRecord,
  type CopyExportRequest,
  type CopyManifest,
  type CopyPage,
} from '../../src/chat/core/conversation-copy'
import {
  actionEvidenceInventory,
  projectRetryTurn,
  retryReviewPayload,
  retryTurnSource,
  type ActionEvidence,
  type RetrySource,
} from '../../src/chat/core/retry-source'
import type { ArchivedTurn } from '../../src/chat/core/transcript'
import type { Approval } from '../../src/chat/core/types'
import {
  initializeCopyStorage,
  freezeCopyExport,
  advanceCopyExport,
  readCopyExportPage,
  stageCopyPage,
  advanceCopyImport,
  importedRetrySource,
  importedActionEvidence,
  type CopyHistory,
} from '../../src/chat/server/conversation-copy-storage'
import {
  archiveEarlierTurns,
  initializeTranscriptArchive,
  readArchivedTurn,
} from '../../src/chat/server/transcript-archive'
import {
  durableResultStore,
  initializeResultStorage,
} from '../../src/chat/server/durable-results'
import { hash } from '../../src/chat/server/crypto'

const databases: DatabaseSync[] = []
afterEach(() => {
  for (const db of databases.splice(0)) db.close()
})
function store() {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  const storage = {
    sql: {
      exec: (query: string, ...values: any[]) => {
        const args = values.map((value) =>
          value instanceof ArrayBuffer ? new Uint8Array(value) : value,
        )
        const statement = db.prepare(query)
        const rows = statement.columns().length
          ? statement.all(...args)
          : (statement.run(...args), [])
        return { toArray: () => rows }
      },
    },
    transactionSync: (operation: () => unknown) => {
      db.exec('SAVEPOINT retry_copy_test')
      try {
        const result = operation()
        db.exec('RELEASE retry_copy_test')
        return result
      } catch (error) {
        db.exec('ROLLBACK TO retry_copy_test')
        db.exec('RELEASE retry_copy_test')
        throw error
      }
    },
  } as unknown as Pick<DurableObjectStorage, 'sql' | 'transactionSync'>
  initializeCopyStorage(storage.sql)
  initializeTranscriptArchive(storage.sql)
  initializeResultStorage(storage.sql)
  return { db, storage }
}
const message = (id: string, role: 'user' | 'assistant'): UIMessage => ({
  id,
  role,
  parts: [{ type: 'text', content: id }],
})
function selectedTurn(withResults = false): ArchivedTurn {
  return {
    id: 'request',
    messages: [
      message('request', 'user'),
      {
        ...message('answer', 'assistant'),
        parts: [
          { type: 'thinking', content: 'Private reasoning is not evidence' },
          {
            type: 'tool-call',
            id: 'read',
            name: 'read_document',
            arguments: '{}',
            state: 'complete',
            output: withResults
              ? { kind: 'stored-tool-result', resultId: 'read-result' }
              : { text: 'Document' },
          },
          { type: 'text', content: 'Done' },
        ],
      },
    ],
    approvals: [
      {
        id: 'action',
        messageId: 'request',
        title: 'Update document',
        code: '',
        status: 'done',
        executionOutcome: 'succeeded',
        resumeRequest: 'Must not transfer',
        assistantTaskId: 'old-task',
        result: withResults
          ? JSON.stringify({
              kind: 'stored-tool-result',
              resultId: 'receipt-result',
            })
          : 'Saved',
      },
    ],
    outcome: { status: 'done', answerId: 'answer' },
  }
}
async function review(
  turn: ArchivedTurn,
  ancestors?: ActionEvidence[],
): Promise<RetrySource> {
  const projection = projectRetryTurn(turn)
  const source: RetrySource = {
    ...projection,
    boundary: {
      kind: 'message',
      side: 'before',
      epoch: 'epoch',
      messageId: turn.id,
      expectedDigest: await hash(
        canonicalCopyJson(copyMessage(turn.messages[0])),
      ),
    },
    evidenceDigest: await hash(canonicalCopyJson(projection)),
  }
  if (ancestors !== undefined) {
    source.inheritedEvidence = actionEvidenceInventory(ancestors)
    source.reviewDigest = await hash(retryReviewPayload(source))
  }
  return source
}
const request = (
  source: RetrySource,
  operationId = 'operation',
): CopyExportRequest => ({
  operationId,
  kind: 'fork',
  botId: 'source',
  userId: 'viewer',
  workspaceId: 'workspace',
  targetConversationId: 'target:conversation',
  boundary: source.boundary,
  retry: source,
})
const history = (turn: ArchivedTurn) =>
  ({
    messages: structuredClone(turn.messages),
    approvals: structuredClone(turn.approvals),
    toolReceipts: turn.receipts ? { [turn.id]: turn.receipts } : undefined,
    turnOutcomes: turn.outcome ? { [turn.id]: turn.outcome } : undefined,
  }) satisfies CopyHistory
async function seal(
  storage: ReturnType<typeof store>['storage'],
  operationId = 'operation',
): Promise<CopyManifest> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await advanceCopyExport(storage, operationId)
    if (result.status === 'sealed') return result.manifest
  }
  throw new Error('Copy did not seal')
}
const targetIdentity = {
  botId: 'target',
  conversationId: 'target:conversation',
  userId: 'viewer',
  workspaceId: 'workspace',
}
async function transfer(
  target: ReturnType<typeof store>,
  manifest: CopyManifest,
  pages: CopyPage[],
) {
  const operationId = manifest.operationId
  for (const page of pages) {
    await stageCopyPage(
      target.storage,
      operationId,
      manifest,
      page,
      targetIdentity,
    )
    await stageCopyPage(
      target.storage,
      operationId,
      manifest,
      page,
      targetIdentity,
    )
  }
  for (let attempt = 0; attempt < 100; attempt++) {
    expect(importedRetrySource(target.storage.sql, operationId)).toBeUndefined()
    expect(
      importedActionEvidence(target.storage.sql, operationId),
    ).toBeUndefined()
    const result = await advanceCopyImport(
      target.storage,
      operationId,
      manifest.digest,
    )
    if (result.status === 'ready') return
    initializeCopyStorage(target.storage.sql)
  }
  throw new Error('Copy did not become ready')
}
function pages(source: ReturnType<typeof store>, manifest: CopyManifest) {
  return Array.from({ length: manifest.pageCount }, (_, ordinal) =>
    readCopyExportPage(source.storage.sql, manifest.operationId, ordinal),
  )
}
async function packet(
  records: BranchRecord[],
  source: RetrySource,
  changes: Partial<CopyManifest> = {},
) {
  const pages: CopyPage[] = []
  let digest = ''
  for (const [index, record] of records.entries()) {
    const payload = canonicalCopyJson({
      record: index,
      chunk: 0,
      chunks: 1,
      data: Buffer.from(canonicalCopyJson(record)).toString('base64'),
    })
    const page = { ordinal: index, payload, digest: await hash(payload) }
    pages.push(page)
    digest = await hash(digest + page.digest)
  }
  const manifest: CopyManifest = {
    schemaVersion: 1,
    operationId: 'operation',
    digest,
    pageCount: pages.length,
    messageCount: 0,
    sourceEpoch: source.boundary.epoch,
    sourceRevision: 1,
    sourceMessageId: source.boundary.messageId,
    sourceMessageDigest: source.boundary.expectedDigest,
    sourceMessagePosition: 'before',
    retryEvidenceDigest: source.evidenceDigest,
    ...changes,
  }
  return { manifest, pages }
}

describe('retry evidence in a verified conversation copy', () => {
  it('preserves a flat owned evidence chain through retry, duplicate, retry, and an empty ordinary fork', async () => {
    const original = store(),
      first = store(),
      duplicate = store(),
      retried = store(),
      final = store()
    const turn = selectedTurn(true)
    const reviewed = await review(turn, [])
    const results = durableResultStore(original.storage, 'old-task')
    await results.put('read-result', { text: 'Read document' })
    await results.put('receipt-result', {
      nested: { kind: 'stored-tool-result', resultId: 'receipt-details' },
    })
    await results.put('receipt-details', { applied: true })
    freezeCopyExport(
      original.storage,
      request(reviewed, 'first-retry'),
      history(turn),
      'epoch',
      1,
    )
    const firstManifest = await seal(original.storage, 'first-retry')
    expect(firstManifest.schemaVersion).toBe(2)
    await transfer(first, firstManifest, pages(original, firstManifest))
    const firstEvidence = importedActionEvidence(
      first.storage.sql,
      'first-retry',
    )!
    expect(firstEvidence).toEqual([
      { id: 'first-retry', source: retryTurnSource(reviewed) },
    ])
    original.db.exec('DELETE FROM task_result_chunks')

    const next: ArchivedTurn = {
      id: 'next-request',
      messages: [
        message('next-request', 'user'),
        message('next-answer', 'assistant'),
      ],
      approvals: [
        {
          ...turn.approvals[0],
          id: 'next-action',
          messageId: 'next-request',
          status: 'error',
          executionOutcome: 'unknown',
          result: 'The outcome is unknown',
        },
      ],
      outcome: { status: 'error' },
    }
    const duplicateRequest: CopyExportRequest = {
      ...request(reviewed, 'ordinary-duplicate'),
      kind: 'duplicate',
      boundary: { kind: 'end', epoch: 'epoch', expectedRevision: 1 },
      retry: undefined,
    }
    freezeCopyExport(
      first.storage,
      duplicateRequest,
      { ...history(next), actionEvidence: firstEvidence },
      'epoch',
      2,
    )
    // Mutation of the source array after freeze cannot rewrite inherited bytes.
    firstEvidence[0].source.evidence.receipts[0].result =
      'Changed after freezing'
    const duplicated = await seal(first.storage, 'ordinary-duplicate')
    await transfer(duplicate, duplicated, pages(first, duplicated))
    const inherited = importedActionEvidence(
      duplicate.storage.sql,
      'ordinary-duplicate',
    )!
    expect(inherited).toEqual([
      { id: 'first-retry', source: retryTurnSource(reviewed) },
    ])
    expect(
      importedRetrySource(duplicate.storage.sql, 'ordinary-duplicate'),
    ).toBeUndefined()
    first.db.exec('DELETE FROM task_result_chunks')

    const nextReview = await review(next, inherited)
    freezeCopyExport(
      duplicate.storage,
      request(nextReview, 'second-retry'),
      { messages: [], approvals: [], actionEvidence: inherited },
      'epoch',
      3,
    )
    const secondManifest = await seal(duplicate.storage, 'second-retry')
    expect(secondManifest.messageCount).toBe(0)
    expect(secondManifest.actionEvidence?.map((entry) => entry.id)).toEqual([
      'first-retry',
      'second-retry',
    ])
    await transfer(retried, secondManifest, pages(duplicate, secondManifest))
    const twice = importedActionEvidence(retried.storage.sql, 'second-retry')!
    expect(twice.map((entry) => entry.id)).toEqual([
      'first-retry',
      'second-retry',
    ])
    expect(twice[1].source.evidence.receipts[0]).toMatchObject({
      executionOutcome: 'unknown',
      result: 'The outcome is unknown',
    })
    expect(
      twice.every(
        (entry) =>
          !('inheritedEvidence' in entry.source) &&
          !('reviewDigest' in entry.source),
      ),
    ).toBe(true)
    expect(importedRetrySource(retried.storage.sql, 'second-retry')).toEqual(
      nextReview,
    )
    expect(readArchivedTurn(retried.storage.sql).turn).toBeNull()
    duplicate.db.exec('DELETE FROM task_result_chunks')

    freezeCopyExport(
      retried.storage,
      { ...duplicateRequest, kind: 'fork', operationId: 'last-copy' },
      { messages: [], approvals: [], actionEvidence: twice },
      'epoch',
      4,
    )
    const lastManifest = await seal(retried.storage, 'last-copy')
    await transfer(final, lastManifest, pages(retried, lastManifest))
    expect(importedActionEvidence(final.storage.sql, 'last-copy')).toEqual(
      twice,
    )
    expect(importedRetrySource(final.storage.sql, 'last-copy')).toBeUndefined()
    expect(readArchivedTurn(final.storage.sql).turn).toBeNull()
    expect(
      await durableResultStore(final.storage, 'assistant').get(
        'receipt-details',
      ),
    ).toEqual({ applied: true })
    expect(canonicalCopyJson(twice)).not.toContain('resumeRequest')
    expect(canonicalCopyJson(twice)).not.toContain('Private reasoning')
  })

  it('normalizes a frozen version-1 retry into one stable ancestor without changing its stored bytes', async () => {
    const source = store(),
      target = store(),
      turn = selectedTurn()
    const reviewed = await review(turn)
    freezeCopyExport(
      source.storage,
      request(reviewed),
      history(turn),
      'epoch',
      1,
    )
    const state = JSON.parse(
      (
        source.db
          .prepare('SELECT json FROM copy_exports WHERE id=?')
          .get('operation') as { json: string }
      ).json,
    )
    delete state.formatVersion
    delete state.actionEvidence
    delete state.actionEvidenceCursor
    source.db
      .prepare('UPDATE copy_exports SET json=? WHERE id=?')
      .run(JSON.stringify(state), 'operation')
    await advanceCopyExport(source.storage, 'operation')
    await advanceCopyExport(source.storage, 'operation')
    const emitted = source.db
      .prepare('SELECT ordinal,digest,payload FROM copy_pages ORDER BY ordinal')
      .all()
    initializeCopyStorage(source.storage.sql)
    const manifest = await seal(source.storage)
    expect(manifest.schemaVersion).toBe(1)
    expect(manifest).not.toHaveProperty('actionEvidence')
    expect(pages(source, manifest)).toEqual(emitted)
    await transfer(target, manifest, pages(source, manifest))
    expect(importedRetrySource(target.storage.sql, 'operation')).toEqual(
      reviewed,
    )
    expect(importedActionEvidence(target.storage.sql, 'operation')).toEqual([
      { id: 'operation', source: retryTurnSource(reviewed) },
    ])
  })

  it.each([
    'missing pair',
    'unknown inventory field',
    'wrong review digest',
  ] as const)(
    'rejects %s in a newly declared review even with matching transport checksums',
    async (failure) => {
      const target = store(),
        reviewed = await review(selectedTurn(), [])
      if (failure === 'missing pair') delete reviewed.reviewDigest
      else if (failure === 'unknown inventory field') {
        reviewed.inheritedEvidence = [
          {
            id: 'ancestor',
            evidenceDigest: reviewed.evidenceDigest,
            authority: 'execute',
          } as never,
        ]
        reviewed.reviewDigest = await hash(retryReviewPayload(reviewed))
      } else reviewed.reviewDigest = '0'.repeat(43)
      const forged = await packet(
        [{ kind: 'retry', source: reviewed }],
        reviewed,
      )
      await expect(
        transfer(target, forged.manifest, forged.pages),
      ).rejects.toMatchObject({
        code:
          failure === 'wrong review digest'
            ? 'retry_review_digest'
            : 'invalid_retry_evidence',
      })
      expect(
        importedActionEvidence(target.storage.sql, 'operation'),
      ).toBeUndefined()
    },
  )

  it('rejects an obsolete inherited inventory at freeze and requires paired commitment for nonempty legacy reviews', async () => {
    const source = store(),
      turn = selectedTurn()
    const ancestor = {
      id: 'ancestor',
      source: retryTurnSource(await review(turn)),
    }
    for (const reviewed of [await review(turn), await review(turn, [])]) {
      expect(() =>
        freezeCopyExport(
          source.storage,
          request(reviewed),
          { ...history(turn), actionEvidence: [ancestor] },
          'epoch',
          1,
        ),
      ).toThrow('inherited action evidence changed')
    }
    expect(
      source.db.prepare('SELECT count(*) AS n FROM copy_exports').get()!.n,
    ).toBe(0)
  })

  it('checks inherited content digests before exposing a frozen export', async () => {
    const source = store(),
      reviewed = await review(selectedTurn())
    const inherited = { id: 'ancestor', source: retryTurnSource(reviewed) }
    inherited.source.evidence.receipts[0].result =
      'Tampered but still structurally valid'
    const req: CopyExportRequest = {
      ...request(reviewed),
      kind: 'duplicate',
      retry: undefined,
      boundary: { kind: 'end', epoch: 'epoch', expectedRevision: 1 },
    }
    freezeCopyExport(
      source.storage,
      req,
      { messages: [], approvals: [], actionEvidence: [inherited] },
      'epoch',
      1,
    )
    await expect(seal(source.storage)).rejects.toMatchObject({
      code: 'retry_evidence_digest',
    })
    expect(() =>
      readCopyExportPage(source.storage.sql, 'operation', 0),
    ).toThrow('not sealed')
  })

  it.each(['missing', 'reordered', 'duplicate', 'conflicting'] as const)(
    'fails closed for %s inherited records independently of transport checksums',
    async (failure) => {
      const target = store(),
        reviewed = await review(selectedTurn())
      const first = { id: 'ancestor-one', source: retryTurnSource(reviewed) }
      const second = { id: 'ancestor-two', source: retryTurnSource(reviewed) }
      let records: BranchRecord[] = [first, second].map((entry) => ({
        kind: 'action-evidence',
        ...entry,
      }))
      if (failure === 'missing') records.pop()
      if (failure === 'reordered') records.reverse()
      if (failure === 'duplicate') records = [records[0], records[0]]
      if (failure === 'conflicting') {
        const changed = selectedTurn()
        changed.approvals[0].result = 'Another known result'
        records[1] = {
          kind: 'action-evidence',
          id: first.id,
          source: retryTurnSource(await review(changed)),
        }
      }
      const forged = await packet(records, reviewed, {
        schemaVersion: 2,
        retryEvidenceDigest: undefined,
        actionEvidence: actionEvidenceInventory([first, second]),
      })
      await expect(
        transfer(target, forged.manifest, forged.pages),
      ).rejects.toBeInstanceOf(Error)
      expect(
        importedActionEvidence(target.storage.sql, 'operation'),
      ).toBeUndefined()
    },
  )

  it('requires the full recursive result closure before publishing an otherwise valid inherited collection', async () => {
    const target = store(),
      reviewed = await review(selectedTurn(true))
    const inherited = { id: 'ancestor', source: retryTurnSource(reviewed) }
    const forged = await packet(
      [
        { kind: 'action-evidence', ...inherited },
        {
          kind: 'evidence',
          taskId: 'assistant',
          resultId: 'read-result',
          value: { text: 'Read document' },
        },
        {
          kind: 'evidence',
          taskId: 'assistant',
          resultId: 'receipt-result',
          value: { kind: 'stored-tool-result', resultId: 'missing-nested' },
        },
      ],
      reviewed,
      {
        schemaVersion: 2,
        retryEvidenceDigest: undefined,
        actionEvidence: actionEvidenceInventory([inherited]),
      },
    )
    await expect(
      transfer(target, forged.manifest, forged.pages),
    ).rejects.toMatchObject({ code: 'missing_reference' })
    expect(
      importedActionEvidence(target.storage.sql, 'operation'),
    ).toBeUndefined()
  })

  it('accepts exactly 64 flat records and rejects a 65th current retry before freezing any pages', async () => {
    const source = store(),
      target = store(),
      turn = selectedTurn()
    const base = retryTurnSource(await review(turn))
    const ancestors = Array.from({ length: 64 }, (_, index) => ({
      id: `ancestor-${index}`,
      source: base,
    }))
    const ordinary: CopyExportRequest = {
      ...request(await review(turn)),
      kind: 'duplicate',
      retry: undefined,
      boundary: { kind: 'end', epoch: 'epoch', expectedRevision: 1 },
    }
    freezeCopyExport(
      source.storage,
      ordinary,
      { messages: [], approvals: [], actionEvidence: ancestors },
      'epoch',
      1,
    )
    const manifest = await seal(source.storage)
    await transfer(target, manifest, pages(source, manifest))
    expect(
      importedActionEvidence(target.storage.sql, 'operation'),
    ).toHaveLength(64)
    const reviewed = await review(turn, ancestors)
    expect(() =>
      freezeCopyExport(
        target.storage,
        request(reviewed, 'overflow'),
        { ...history(turn), actionEvidence: ancestors },
        'epoch',
        1,
      ),
    ).toThrow('64 action evidence')
    expect(
      target.db.prepare('SELECT count(*) AS n FROM copy_exports').get()!.n,
    ).toBe(0)
  })

  it('rejects an oversized aggregate instead of truncating any inherited turn', async () => {
    const source = store(),
      turn = selectedTurn()
    turn.messages[1].parts.push({ type: 'text', content: 'x'.repeat(290000) })
    const base = retryTurnSource(await review(turn))
    const ancestors = Array.from({ length: 8 }, (_, index) => ({
      id: `ancestor-${index}`,
      source: base,
    }))
    const ordinary: CopyExportRequest = {
      ...request(base),
      kind: 'duplicate',
      retry: undefined,
      boundary: { kind: 'end', epoch: 'epoch', expectedRevision: 1 },
    }
    expect(() =>
      freezeCopyExport(
        source.storage,
        ordinary,
        { messages: [], approvals: [], actionEvidence: ancestors },
        'epoch',
        1,
      ),
    ).toThrow('2 MiB')
    expect(
      source.db.prepare('SELECT count(*) AS n FROM copy_exports').get()!.n,
    ).toBe(0)
  })

  it.each(['duplicate ancestors', 'reused copy identity'] as const)(
    'rejects %s before allocating an export snapshot',
    async (failure) => {
      const source = store(),
        reviewed = await review(selectedTurn())
      const ancestor = {
        id: failure === 'reused copy identity' ? 'operation' : 'ancestor',
        source: retryTurnSource(reviewed),
      }
      const ordinary: CopyExportRequest = {
        ...request(reviewed),
        kind: 'duplicate',
        retry: undefined,
        boundary: { kind: 'end', epoch: 'epoch', expectedRevision: 1 },
      }
      expect(() =>
        freezeCopyExport(
          source.storage,
          ordinary,
          {
            messages: [],
            approvals: [],
            actionEvidence:
              failure === 'duplicate ancestors'
                ? [ancestor, ancestor]
                : [ancestor],
          },
          'epoch',
          1,
        ),
      ).toThrow()
      expect(
        source.db.prepare('SELECT count(*) AS n FROM copy_exports').get()!.n,
      ).toBe(0)
    },
  )

  it('rejects undeclared fields on the retry record itself without changing legacy record bytes', async () => {
    const target = store(),
      reviewed = await review(selectedTurn())
    const forged = await packet(
      [
        {
          kind: 'retry',
          source: reviewed,
          authority: { resume: true },
        } as never,
      ],
      reviewed,
    )
    await expect(
      transfer(target, forged.manifest, forged.pages),
    ).rejects.toMatchObject({ code: 'invalid_retry_evidence' })
    expect(
      importedActionEvidence(target.storage.sql, 'operation'),
    ).toBeUndefined()
  })

  it('verifies interrupted tool evidence without rewriting its original historical state', async () => {
    const source = store(),
      target = store()
    const turn = selectedTurn()
    const call = turn.messages[1].parts.find(
      (part) => part.type === 'tool-call',
    )!
    call.state = 'input-streaming'
    delete call.output
    turn.outcome = { status: 'error' }
    const reviewed = await review(turn)
    freezeCopyExport(
      source.storage,
      request(reviewed),
      history(turn),
      'epoch',
      1,
    )
    const manifest = await seal(source.storage)
    await transfer(target, manifest, pages(source, manifest))
    const imported = importedRetrySource(target.storage.sql, 'operation')!
    expect(imported).toEqual(reviewed)
    expect(imported.evidence.messages[1].parts[0]).toMatchObject({
      type: 'tool-call',
      state: 'error',
      metadata: { gumHistoricalState: 'input-streaming' },
    })
    expect(readArchivedTurn(target.storage.sql).turn).toBeNull()
  })
  it.each(['live', 'archived'] as const)(
    'freezes a %s selected turn and its full result dependencies separately from branch history',
    async (location) => {
      const source = store(),
        target = store()
      const turn = selectedTurn(true),
        reviewed = await review(turn)
      const original = history(turn)
      original.messages.unshift(
        message('earlier', 'user'),
        message('earlier-answer', 'assistant'),
      )
      original.messages.push(
        message('later', 'user'),
        message('later-answer', 'assistant'),
      )
      if (location === 'archived')
        archiveEarlierTurns(source.storage.sql, original, 300000, 1)
      const results = durableResultStore(source.storage, 'old-task')
      const readResult = {
        text: '😀'.repeat(40000),
        nested: { kind: 'stored-tool-result', resultId: 'context_original' },
      }
      const context = [
        {
          role: 'assistant',
          content: [
            { type: 'thinking', content: 'Private archived reasoning' },
            { type: 'text', content: 'Retained context' },
          ],
        },
      ]
      await results.put('read-result', readResult)
      await results.put('receipt-result', { confirmed: true })
      await results.put('context_original', context)
      const req = request(reviewed)
      freezeCopyExport(source.storage, req, original, 'epoch', 4)
      // Later source changes cannot replace bytes in an already frozen operation.
      await results.put('read-result', { text: 'Changed after freeze' })
      initializeCopyStorage(source.storage.sql)
      freezeCopyExport(
        source.storage,
        req,
        { messages: [], approvals: [] },
        'another-epoch',
        10,
      )
      const manifest = await seal(source.storage)
      expect(manifest).toMatchObject({
        messageCount: 2,
        retryEvidenceDigest: reviewed.evidenceDigest,
      })
      expect(manifest.pageCount).toBeGreaterThan(4)
      await transfer(target, manifest, pages(source, manifest))
      expect(importedRetrySource(target.storage.sql, 'operation')).toEqual(
        reviewed,
      )
      const copied = readArchivedTurn(target.storage.sql).turn!
      expect(copied.messages.map((item) => item.id)).toEqual([
        'earlier',
        'earlier-answer',
      ])
      expect(copied.approvals).toEqual([])
      expect(
        target.db
          .prepare(
            'SELECT message_id FROM transcript_messages WHERE message_id=?',
          )
          .get('request'),
      ).toBeUndefined()
      const importedResults = durableResultStore(target.storage, 'assistant')
      expect(await importedResults.get('read-result')).toEqual(readResult)
      expect(await importedResults.get('receipt-result')).toEqual({
        confirmed: true,
      })
      expect(await importedResults.get('context_original')).toEqual([
        {
          role: 'assistant',
          content: [{ type: 'text', content: 'Retained context' }],
        },
      ])
      expect(
        canonicalCopyJson(importedRetrySource(target.storage.sql, 'operation')),
      ).not.toContain('resumeRequest')
      expect(
        await advanceCopyImport(target.storage, 'operation', manifest.digest),
      ).toMatchObject({ status: 'ready' })
      expect(
        target.db
          .prepare(
            "SELECT count(*) AS n FROM copy_import_records WHERE kind='retry'",
          )
          .get()!.n,
      ).toBe(1)
    },
  )

  it('transfers first-request evidence without adding any prompt or response to the empty branch', async () => {
    const source = store(),
      target = store(),
      turn = selectedTurn()
    const reviewed = await review(turn)
    freezeCopyExport(
      source.storage,
      request(reviewed),
      history(turn),
      'epoch',
      1,
    )
    const manifest = await seal(source.storage)
    expect(manifest.messageCount).toBe(0)
    await transfer(target, manifest, pages(source, manifest))
    expect(readArchivedTurn(target.storage.sql).turn).toBeNull()
    expect(importedRetrySource(target.storage.sql, 'operation')).toEqual(
      reviewed,
    )
  })

  it('rejects a late archived approval change at snapshot freeze and accepts an updated review', async () => {
    const source = store(),
      turn = selectedTurn()
    turn.approvals[0] = {
      ...turn.approvals[0],
      status: 'error',
      executionOutcome: 'unknown',
      result: 'Not confirmed',
    }
    const previousReview = await review(turn)
    const original = history(turn)
    original.messages.push(
      message('later', 'user'),
      message('later-answer', 'assistant'),
    )
    archiveEarlierTurns(source.storage.sql, original, 300000, 1)
    const confirmed: Approval = {
      ...turn.approvals[0],
      status: 'done',
      executionOutcome: 'succeeded',
      result: 'Later receipt confirmed the action',
    }
    original.approvals = [confirmed]
    expect(() =>
      freezeCopyExport(
        source.storage,
        request(previousReview),
        original,
        'epoch',
        2,
      ),
    ).toThrow('actions changed')
    expect(
      source.db.prepare('SELECT count(*) AS n FROM copy_exports').get()!.n,
    ).toBe(0)
    const latest = await review({ ...turn, approvals: [confirmed] })
    freezeCopyExport(source.storage, request(latest), original, 'epoch', 2)
    expect((await seal(source.storage)).retryEvidenceDigest).toBe(
      latest.evidenceDigest,
    )
  })

  it('rejects rebinding a frozen operation to another action review', async () => {
    const source = store(),
      turn = selectedTurn(),
      original = history(turn)
    const reviewed = await review(turn)
    freezeCopyExport(source.storage, request(reviewed), original, 'epoch', 1)
    const changed = await review({
      ...turn,
      approvals: [{ ...turn.approvals[0], result: 'Different result' }],
    })
    expect(() =>
      freezeCopyExport(source.storage, request(changed), original, 'epoch', 1),
    ).toThrow('different inputs')
  })

  it('requires the exclusive reviewed boundary and the current source epoch', async () => {
    const source = store(),
      turn = selectedTurn(),
      reviewed = await review(turn)
    const req = request(reviewed)
    expect(() =>
      freezeCopyExport(
        source.storage,
        { ...req, boundary: { ...reviewed.boundary, side: undefined } },
        history(turn),
        'epoch',
        1,
      ),
    ).toThrow('exclusive branch boundary')
    expect(() =>
      freezeCopyExport(source.storage, req, history(turn), 'reset', 1),
    ).toThrow('exclusive branch boundary')
    expect(
      source.db.prepare('SELECT count(*) AS n FROM copy_exports').get()!.n,
    ).toBe(0)
  })

  it.each(['missing', 'ambiguous'] as const)(
    'fails the whole export for a %s referenced result, including receipt-only results',
    async (failure) => {
      const source = store(),
        turn = selectedTurn(true),
        reviewed = await review(turn)
      await durableResultStore(source.storage, 'old-task').put('read-result', {
        text: 'Read evidence',
      })
      if (failure === 'ambiguous') {
        await durableResultStore(source.storage, 'first-task').put(
          'receipt-result',
          { result: 'first' },
        )
        await durableResultStore(source.storage, 'second-task').put(
          'receipt-result',
          { result: 'second' },
        )
      }
      freezeCopyExport(
        source.storage,
        request(reviewed),
        history(turn),
        'epoch',
        1,
      )
      await expect(seal(source.storage)).rejects.toMatchObject({
        code:
          failure === 'missing' ? 'missing_reference' : 'ambiguous_reference',
      })
      expect(() =>
        readCopyExportPage(source.storage.sql, 'operation', 0),
      ).toThrow('not sealed')
    },
  )

  it('checks the actual retry evidence digest before sealing', async () => {
    const source = store(),
      turn = selectedTurn(),
      reviewed = await review(turn)
    freezeCopyExport(
      source.storage,
      request({ ...reviewed, evidenceDigest: '0'.repeat(43) }),
      history(turn),
      'epoch',
      1,
    )
    await expect(seal(source.storage)).rejects.toMatchObject({
      code: 'retry_evidence_digest',
    })
  })

  it.each(['duplicate', 'missing', 'undeclared', 'wrong digest'] as const)(
    'does not publish a copy with %s retry evidence',
    async (failure) => {
      const target = store(),
        reviewed = await review(selectedTurn())
      const retry: BranchRecord = { kind: 'retry', source: reviewed }
      const records: BranchRecord[] =
        failure === 'missing'
          ? [
              {
                kind: 'turn',
                id: 'empty',
                messages: [],
                receipts: [],
                partial: false,
              },
            ]
          : failure === 'duplicate'
            ? [retry, retry]
            : [retry]
      const forged = await packet(
        records,
        reviewed,
        failure === 'undeclared'
          ? { retryEvidenceDigest: undefined }
          : failure === 'wrong digest'
            ? { retryEvidenceDigest: '0'.repeat(43) }
            : {},
      )
      await expect(
        transfer(target, forged.manifest, forged.pages),
      ).rejects.toBeInstanceOf(Error)
      expect(
        importedRetrySource(target.storage.sql, 'operation'),
      ).toBeUndefined()
      expect(readArchivedTurn(target.storage.sql).turn).toBeNull()
    },
  )

  it('rejects executable fields smuggled into retry evidence even when the transfer checksum matches', async () => {
    const target = store(),
      reviewed = await review(selectedTurn())
    const forged = structuredClone(reviewed)
    Object.assign(forged.evidence.receipts[0], {
      assistantTaskId: 'revive-old-task',
      resumeRequest: 'Run it again',
    })
    forged.evidenceDigest = await hash(
      canonicalCopyJson({ request: forged.request, evidence: forged.evidence }),
    )
    const value = await packet([{ kind: 'retry', source: forged }], forged)
    await expect(
      transfer(target, value.manifest, value.pages),
    ).rejects.toMatchObject({ code: 'invalid_retry_evidence' })
    expect(importedRetrySource(target.storage.sql, 'operation')).toBeUndefined()
  })
})
