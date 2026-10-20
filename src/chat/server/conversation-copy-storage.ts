import type {
  SqlStorage,
  DurableObjectStorage,
} from '@cloudflare/workers-types'
import type { UIMessage } from '@tanstack/ai'
import type { Approval } from '../core/types'
import type { ArchivedTurn } from '../core/transcript'
import {
  projectRetryTurn,
  parseRetrySource,
  parseRetryTurnSource,
  actionEvidenceInventory,
  parseActionEvidenceInventory,
  retryReviewPayload,
  retryTurnSource,
  type RetrySource,
  type RetryTurnSource,
  type ActionEvidence,
  type ActionEvidenceRef,
} from '../core/retry-source'
import { readArchivedMessage } from './transcript-archive'
import {
  canonicalCopyJson,
  copyMessage,
  copyBoundaryMessage,
  copyContextEvidence,
  copyLegacyContextEvidence,
  copyReceipt,
  copyEvidenceReferences,
  type BranchRecord,
  type BranchTranscriptRecord,
  type CopyExportRequest,
  type CopyManifest,
  type CopyPage,
  type CopyIdentity,
  toolReceiptReferences,
} from '../core/conversation-copy'
import { hash } from './crypto'
export class CopyProtocolError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}
export interface CopyHistory {
  messages: UIMessage[]
  approvals: Approval[]
  turnOutcomes?: Record<
    string,
    {
      status: string
      answerId?: string
      termination?: 'incomplete' | 'interrupted'
    }
  >
  toolReceipts?: Record<string, BranchTranscriptRecord['receipts']>
  inheritedTurns?: Record<string, { partial: boolean }>
  /** Loaded from this source's ready import by the authorized host, never a client. */
  actionEvidence?: ActionEvidence[]
}
interface ExportState {
  /** Missing means the original version-1 projection for a frozen operation. */
  projectionVersion?: 2
  formatVersion?: 2
  actionEvidence?: ActionEvidenceRef[]
  actionEvidenceCursor?: number
  request: CopyExportRequest
  epoch: string
  revision: number
  cursor: number
  ended: boolean
  pages: number
  records: number
  messages: number
  chain: string
  sealed?: CopyManifest
  retryWritten?: boolean
}
interface ImportState {
  manifest: CopyManifest
  identity: CopyIdentity
  pageCursor: number
  recordCursor: number
  messages: number
  chain: string
  ready: boolean
  retryReceived?: boolean
}
const encode = (text: string) => new TextEncoder().encode(text)
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const unb64 = (text: string) =>
  Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
export function initializeCopyStorage(sql: SqlStorage) {
  for (const query of [
    'CREATE TABLE IF NOT EXISTS copy_exports (id TEXT PRIMARY KEY,json TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS copy_raw (operation_id TEXT,kind TEXT,key TEXT,sequence INTEGER,ordinal INTEGER,payload BLOB,PRIMARY KEY(operation_id,kind,key,ordinal))',
    'CREATE INDEX IF NOT EXISTS copy_raw_sequence ON copy_raw(operation_id,kind,sequence) WHERE ordinal=0',
    'CREATE TABLE IF NOT EXISTS copy_pages (operation_id TEXT,ordinal INTEGER,digest TEXT,payload TEXT,PRIMARY KEY(operation_id,ordinal))',
    'CREATE TABLE IF NOT EXISTS copy_dependencies (operation_id TEXT,result_id TEXT,done INTEGER DEFAULT 0,PRIMARY KEY(operation_id,result_id))',
    'CREATE TABLE IF NOT EXISTS copy_imports (id TEXT PRIMARY KEY,json TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS copy_staged_pages (operation_id TEXT,ordinal INTEGER,digest TEXT,payload TEXT,PRIMARY KEY(operation_id,ordinal))',
    'CREATE TABLE IF NOT EXISTS copy_import_records (operation_id TEXT,ordinal INTEGER,kind TEXT,key TEXT,json TEXT,PRIMARY KEY(operation_id,ordinal))',
    'CREATE TABLE IF NOT EXISTS copy_import_messages (operation_id TEXT,message_id TEXT,PRIMARY KEY(operation_id,message_id))',
    'CREATE TABLE IF NOT EXISTS copy_import_dependencies (operation_id TEXT,result_id TEXT,PRIMARY KEY(operation_id,result_id))',
    'CREATE TABLE IF NOT EXISTS copy_wakes (operation_id TEXT PRIMARY KEY,until_time INTEGER NOT NULL)',
  ])
    sql.exec(query)
}
function row<T>(sql: SqlStorage, table: string, id: string): T | undefined {
  const found = sql
    .exec<{ json: string }>(`SELECT json FROM ${table} WHERE id=?`, id)
    .toArray()[0]
  return found ? JSON.parse(found.json) : undefined
}
function save(sql: SqlStorage, table: string, id: string, value: unknown) {
  sql.exec(
    `INSERT INTO ${table} VALUES (?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json`,
    id,
    JSON.stringify(value),
  )
}
function loadRaw(
  sql: SqlStorage,
  operationId: string,
  kind: string,
  key: string,
) {
  const rows = sql
    .exec<{ ordinal: number; payload: ArrayBuffer }>(
      'SELECT ordinal,payload FROM copy_raw WHERE operation_id=? AND kind=? AND key=? ORDER BY ordinal',
      operationId,
      kind,
      key,
    )
    .toArray()
  if (!rows.length)
    throw new CopyProtocolError(
      'missing_reference',
      'Required historical content is unavailable.',
    )
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
  let text = ''
  for (const [i, r] of rows.entries()) {
    if (r.ordinal !== i)
      throw new CopyProtocolError(
        'corrupt_history',
        'Historical content is incomplete.',
      )
    text += decoder.decode(r.payload, { stream: true })
  }
  return JSON.parse(text + decoder.decode())
}
function writeRaw(
  sql: SqlStorage,
  operationId: string,
  kind: string,
  key: string,
  sequence: number,
  value: unknown,
) {
  const bytes = encode(JSON.stringify(value))
  for (
    let start = 0, ordinal = 0;
    start < bytes.length;
    start += 65536, ordinal++
  )
    sql.exec(
      'INSERT INTO copy_raw VALUES (?,?,?,?,?,?)',
      operationId,
      kind,
      key,
      sequence,
      ordinal,
      bytes.slice(start, start + 65536).buffer,
    )
}
function refs(value: unknown): string[] {
  const found = new Set(copyEvidenceReferences(value))
  // Tool-result and compacted-context content is JSON carried in a typed content field.
  const walk = (v: unknown, depth: number) => {
    if (depth > 64)
      throw new CopyProtocolError(
        'too_deep',
        'Historical evidence is nested too deeply.',
      )
    if (!v || typeof v !== 'object') return
    for (const [key, child] of Object.entries(v)) {
      if (
        (key === 'content' || key === 'output') &&
        typeof child === 'string' &&
        child.trim().startsWith('{')
      ) {
        try {
          for (const id of copyEvidenceReferences(JSON.parse(child)))
            found.add(id)
        } catch {}
      }
      if (typeof child === 'object') walk(child, depth + 1)
    }
  }
  walk(value, 0)
  return [...found]
}

function turnReferences(
  turn: BranchTranscriptRecord,
  includeReceipts: boolean,
) {
  const found = new Set(
    refs(
      turn.messages.flatMap((message) =>
        message.parts.filter(
          (part) => part.type !== 'text' && part.type !== 'thinking',
        ),
      ),
    ),
  )
  for (const receipt of includeReceipts ? turn.receipts : []) {
    if (typeof receipt.result !== 'string') continue
    let result: unknown
    try {
      result = JSON.parse(receipt.result)
    } catch {
      continue
    }
    for (const id of refs(result)) found.add(id)
  }
  return [...found]
}

function readRetryTurn(
  sql: SqlStorage,
  history: CopyHistory,
  messageId: string,
): ArchivedTurn {
  const start = history.messages.findIndex(
    (message) => message.id === messageId,
  )
  const current = history.approvals.filter(
    (approval) => (approval.messageId ?? approval.turnId) === messageId,
  )
  if (start >= 0) {
    const end = history.messages.findIndex(
      (message, index) => index > start && message.role === 'user',
    )
    return {
      id: messageId,
      messages: history.messages.slice(start, end < 0 ? undefined : end),
      approvals: current,
      receipts: history.toolReceipts?.[messageId],
      inherited: history.inheritedTurns?.[messageId],
      outcome: history.turnOutcomes?.[messageId] as ArchivedTurn['outcome'],
    }
  }
  const archived = readArchivedMessage(sql, messageId)
  if (archived.indexing || !archived.turn || archived.turn.id !== messageId)
    throw new CopyProtocolError(
      'retry_source_unavailable',
      'The original request could not be frozen. Review it again.',
    )
  return {
    ...archived.turn,
    approvals: [
      ...new Map(
        [...archived.turn.approvals, ...current].map((approval) => [
          approval.id,
          approval,
        ]),
      ).values(),
    ],
  }
}

/** Validate the inert envelope independently of trust in a transfer page's shape. */
function retrySourceProjection(source: RetrySource): RetrySource {
  try {
    return parseRetrySource(source)
  } catch {
    throw new CopyProtocolError(
      'invalid_retry_evidence',
      'The original request evidence could not be verified.',
    )
  }
}

async function verifyRetryDigests(source: RetryTurnSource) {
  const [evidenceDigest, messageDigest] = await Promise.all([
    hash(
      canonicalCopyJson({ request: source.request, evidence: source.evidence }),
    ),
    hash(canonicalCopyJson(copyBoundaryMessage(source.evidence.messages[0]))),
  ])
  if (
    evidenceDigest !== source.evidenceDigest ||
    messageDigest !== source.boundary.expectedDigest
  )
    throw new CopyProtocolError(
      'retry_evidence_digest',
      'The original request evidence changed. Review it again.',
    )
}
async function verifyReviewDigest(source: RetrySource) {
  if (
    source.reviewDigest !== undefined &&
    (await hash(retryReviewPayload(source))) !== source.reviewDigest
  )
    throw new CopyProtocolError(
      'retry_review_digest',
      'The reviewed action evidence inventory changed. Review it again.',
    )
}
function evidenceInventory(records: readonly ActionEvidence[]) {
  try {
    return actionEvidenceInventory(records)
  } catch (error) {
    throw new CopyProtocolError(
      'invalid_action_evidence',
      error instanceof Error
        ? error.message
        : 'The action evidence is invalid.',
    )
  }
}
function manifestInventory(manifest: CopyManifest): ActionEvidenceRef[] {
  try {
    if (manifest.schemaVersion === 1) {
      if (manifest.actionEvidence !== undefined)
        throw new Error('Unexpected evidence inventory')
      return manifest.retryEvidenceDigest
        ? parseActionEvidenceInventory([
            {
              id: manifest.operationId,
              evidenceDigest: manifest.retryEvidenceDigest,
            },
          ])
        : []
    }
    if (manifest.schemaVersion !== 2) throw new Error('Unknown copy version')
    const inventory = parseActionEvidenceInventory(manifest.actionEvidence)
    const current = inventory.find((item) => item.id === manifest.operationId)
    if (
      manifest.retryEvidenceDigest
        ? current?.evidenceDigest !== manifest.retryEvidenceDigest ||
          inventory.at(-1)?.id !== manifest.operationId
        : current !== undefined
    )
      throw new Error('Invalid current retry identity')
    return inventory
  } catch {
    throw new CopyProtocolError(
      'action_evidence_manifest',
      'The action evidence inventory is invalid.',
    )
  }
}
function recordReferences(record: BranchRecord, includeReceipts: boolean) {
  return record.kind === 'evidence'
    ? refs(record.value)
    : turnReferences(
        record.kind === 'retry' || record.kind === 'action-evidence'
          ? record.source.evidence
          : record,
        includeReceipts,
      )
}
export function freezeCopyExport(
  storage: Pick<DurableObjectStorage, 'sql' | 'transactionSync'>,
  request: CopyExportRequest,
  history: CopyHistory,
  epoch: string,
  revision: number,
) {
  const sql = storage.sql,
    existing = row<ExportState>(sql, 'copy_exports', request.operationId)
  if (existing) {
    if (canonicalCopyJson(existing.request) !== canonicalCopyJson(request))
      throw new CopyProtocolError(
        'operation_conflict',
        'This copy operation has different inputs.',
      )
    return
  }
  let retry: RetrySource | undefined
  const inherited = history.actionEvidence ?? []
  const inheritedInventory = evidenceInventory(inherited)
  if (
    !request.retry &&
    inheritedInventory.some((entry) => entry.id === request.operationId)
  )
    throw new CopyProtocolError(
      'action_evidence_identity',
      'A copy must have a different identity from its inherited evidence.',
    )
  if (request.retry) {
    retry = retrySourceProjection(request.retry)
    if (
      request.kind !== 'fork' ||
      retry.boundary.epoch !== epoch ||
      canonicalCopyJson(retry.boundary) !== canonicalCopyJson(request.boundary)
    )
      throw new CopyProtocolError(
        'retry_boundary',
        'Retry evidence must belong to this exclusive branch boundary.',
      )
    if (
      canonicalCopyJson(retry.inheritedEvidence ?? []) !==
      canonicalCopyJson(inheritedInventory)
    )
      throw new CopyProtocolError(
        'retry_source_changed',
        'The inherited action evidence changed. Review this request again.',
      )
    let current: ReturnType<typeof projectRetryTurn>
    try {
      current = projectRetryTurn(
        readRetryTurn(sql, history, retry.boundary.messageId),
      )
    } catch (error) {
      if (error instanceof CopyProtocolError) throw error
      throw new CopyProtocolError(
        'retry_source_changed',
        'The original request or its actions changed. Review it again.',
      )
    }
    // No await between this comparison and the frozen SQL snapshot. A prompt-only
    // boundary digest cannot detect a newer approval outcome on an archived turn.
    if (
      canonicalCopyJson(current) !==
      canonicalCopyJson({ request: retry.request, evidence: retry.evidence })
    )
      throw new CopyProtocolError(
        'retry_source_changed',
        'The original request or its actions changed. Review it again.',
      )
  }
  const inventory = evidenceInventory([
    ...inherited,
    ...(retry
      ? [{ id: request.operationId, source: retryTurnSource(retry) }]
      : []),
  ])
  // A message branch never needs later turns. Use the archive's message index
  // when present; legacy unindexed archives retain the verified export path.
  const boundary = request.boundary
  const archivedBoundary =
    boundary.kind === 'message'
      ? sql
          .exec<{ sequence: number }>(
            'SELECT t.sequence FROM transcript_messages m JOIN transcript_turns t ON t.turn_id=m.turn_id WHERE m.message_id=?',
            boundary.messageId,
          )
          .toArray()[0]?.sequence
      : undefined
  const archiveEnd = archivedBoundary ?? Number.MAX_SAFE_INTEGER
  let currentMessages = archivedBoundary === undefined ? history.messages : []
  if (boundary.kind === 'message' && archivedBoundary === undefined) {
    const at = currentMessages.findIndex(
      (message) => message.id === boundary.messageId,
    )
    if (at >= 0) {
      const end = currentMessages.findIndex(
        (message, index) => index > at && message.role === 'user',
      )
      if (end >= 0) currentMessages = currentMessages.slice(0, end)
    }
  }
  const total =
    sql
      .exec<{ bytes: number }>(
        'SELECT COALESCE(sum(length(payload)),0) AS bytes FROM (SELECT c.payload FROM transcript_chunks c JOIN transcript_turns t ON t.turn_id=c.turn_id WHERE t.sequence<=? UNION ALL SELECT payload FROM task_result_chunks)',
        archiveEnd,
      )
      .toArray()[0]?.bytes ?? 0
  if (
    total +
      encode(JSON.stringify({ ...history, messages: currentMessages })).length +
      (retry ? encode(canonicalCopyJson(retry)).length : 0) >
    64 * 1024 * 1024
  )
    throw new CopyProtocolError(
      'copy_too_large',
      'This conversation exceeds the 64 MiB copy limit.',
    )
  storage.transactionSync(() => {
    for (const [index, record] of inherited.entries())
      writeRaw(
        sql,
        request.operationId,
        'action-evidence',
        record.id,
        index + 1,
        record,
      )
    if (retry) writeRaw(sql, request.operationId, 'retry', 'source', 0, retry)
    sql.exec(
      "INSERT INTO copy_raw SELECT ?, 'turn', c.turn_id,t.sequence,c.ordinal,c.payload FROM transcript_chunks c JOIN transcript_turns t ON t.turn_id=c.turn_id WHERE t.sequence<=?",
      request.operationId,
      archiveEnd,
    )
    sql.exec(
      "INSERT INTO copy_raw SELECT ?, 'evidence',task_id || char(31) || result_id,0,ordinal,payload FROM task_result_chunks",
      request.operationId,
    )
    let sequence =
      sql
        .exec<{ n: number }>(
          'SELECT COALESCE(max(sequence),0) AS n FROM transcript_turns',
        )
        .toArray()[0]?.n ?? 0
    const turns: UIMessage[][] = []
    for (const message of currentMessages) {
      if (message.role === 'user' || !turns.length) turns.push([])
      turns.at(-1)!.push(message)
    }
    for (const messages of turns) {
      const id = messages[0].id
      writeRaw(sql, request.operationId, 'turn', id, ++sequence, {
        id,
        messages,
        approvals: history.approvals.filter(
          (a) => (a.messageId ?? a.turnId) === id,
        ),
        outcome: history.turnOutcomes?.[id],
        receipts: history.toolReceipts?.[id],
        inherited: history.inheritedTurns?.[id],
      })
    }
    save(sql, 'copy_exports', request.operationId, {
      projectionVersion: 2,
      formatVersion: 2,
      actionEvidence: inventory,
      actionEvidenceCursor: 0,
      request,
      epoch,
      revision,
      cursor: 0,
      ended: false,
      pages: 0,
      records: 0,
      messages: 0,
      chain: '',
    } satisfies ExportState)
  })
}
async function appendRecord(
  storage: Pick<DurableObjectStorage, 'sql' | 'transactionSync'>,
  id: string,
  state: ExportState,
  record: BranchRecord,
) {
  const bytes = encode(canonicalCopyJson(record)),
    pages: CopyPage[] = []
  if (bytes.length > 16 * 1024 * 1024)
    throw new CopyProtocolError(
      'record_too_large',
      'A historical record exceeds the 16 MiB copy limit.',
    )
  for (
    let start = 0, chunk = 0;
    start < bytes.length;
    start += 32768, chunk++
  ) {
    const payload = canonicalCopyJson({
      record: state.records,
      chunk,
      chunks: Math.ceil(bytes.length / 32768),
      data: b64(bytes.slice(start, start + 32768)),
    })
    const digest = await hash(payload)
    pages.push({ ordinal: state.pages + pages.length, digest, payload })
  }
  let chain = state.chain
  for (const page of pages) chain = await hash(chain + page.digest)
  storage.transactionSync(() => {
    for (const page of pages) {
      const prior = storage.sql
        .exec<{ digest: string }>(
          'SELECT digest FROM copy_pages WHERE operation_id=? AND ordinal=?',
          id,
          page.ordinal,
        )
        .toArray()[0]
      if (prior && prior.digest !== page.digest)
        throw new CopyProtocolError(
          'export_conflict',
          'The sealed copy changed unexpectedly.',
        )
      storage.sql.exec(
        'INSERT OR IGNORE INTO copy_pages VALUES (?,?,?,?)',
        id,
        page.ordinal,
        page.digest,
        page.payload,
      )
    }
    state.pages += pages.length
    state.records++
    state.chain = chain
    for (const resultId of recordReferences(
      record,
      state.projectionVersion === 2 || record.kind === 'retry',
    ))
      storage.sql.exec(
        'INSERT OR IGNORE INTO copy_dependencies(operation_id,result_id) VALUES (?,?)',
        id,
        resultId,
      )
    if (record.kind === 'evidence')
      storage.sql.exec(
        'UPDATE copy_dependencies SET done=1 WHERE operation_id=? AND result_id=?',
        id,
        record.resultId,
      )
    save(storage.sql, 'copy_exports', id, state)
  })
}
export async function advanceCopyExport(
  storage: Pick<DurableObjectStorage, 'sql' | 'transactionSync'>,
  id: string,
) {
  const sql = storage.sql,
    state = row<ExportState>(sql, 'copy_exports', id)
  if (!state)
    throw new CopyProtocolError(
      'missing_export',
      'The copy export is unavailable.',
    )
  if (state.sealed) return { status: 'sealed' as const, manifest: state.sealed }
  if (!state.ended) {
    const next = sql
      .exec<{ key: string; sequence: number }>(
        "SELECT key,sequence FROM copy_raw WHERE operation_id=? AND kind='turn' AND ordinal=0 AND sequence>? ORDER BY sequence LIMIT 1",
        id,
        state.cursor,
      )
      .toArray()[0]
    if (next) {
      const turn = loadRaw(sql, id, 'turn', next.key) as {
        id: string
        messages: UIMessage[]
        approvals: Approval[]
        outcome?: {
          status: string
          answerId?: string
          termination?: 'incomplete' | 'interrupted'
        }
        receipts?: BranchTranscriptRecord['receipts']
        inherited?: { partial: boolean }
      }
      const boundary = state.request.boundary
      const cut =
        boundary.kind === 'message'
          ? turn.messages.findIndex((m) => m.id === boundary.messageId)
          : -1
      const end =
        cut >= 0
          ? cut +
            (boundary.kind === 'message' && boundary.side === 'before' ? 0 : 1)
          : turn.messages.length
      const selected = turn.messages.slice(0, end)
      const messages = selected.map(
        state.projectionVersion === 2 ? copyMessage : copyBoundaryMessage,
      )
      const endedByBoundary = end === turn.messages.length
      const complete =
        endedByBoundary &&
        turn.outcome?.status === 'done' &&
        !!turn.outcome.answerId &&
        messages.some((m) => m.id === turn.outcome!.answerId)
      const partial =
        !!turn.inherited?.partial ||
        !endedByBoundary ||
        (!complete && turn.outcome?.status !== 'error')
      const calls = selected.flatMap((m) =>
        m.parts.filter((p) => p.type === 'tool-call'),
      )
      const legacyAllowed = new Set(
        calls.flatMap((p) => [
          p.id,
          ...(p.approval?.id ? [p.approval.id] : []),
        ]),
      )
      const legacyObserved = new Set(
        calls
          .filter(
            (p) =>
              (p.state === 'complete' || p.state === 'error') &&
              p.output !== undefined,
          )
          .flatMap((p) => [p.id, ...(p.approval?.id ? [p.approval.id] : [])]),
      )
      const associations =
        state.projectionVersion === 2
          ? selected.flatMap((message) =>
              message.parts.map(toolReceiptReferences),
            )
          : []
      const allowed =
        state.projectionVersion === 2
          ? new Set(associations.flatMap((entry) => entry.ids))
          : legacyAllowed
      const observed =
        state.projectionVersion === 2
          ? new Set(
              associations.flatMap((entry) =>
                entry.observed ? entry.ids : [],
              ),
            )
          : legacyObserved
      const receipts = [
        ...(turn.receipts ?? []),
        ...(turn.approvals ?? []).map(copyReceipt),
      ]
        .filter((receipt) => cut < 0 || allowed.has(receipt.id))
        .map((receipt) =>
          cut >= 0 && !observed.has(receipt.id)
            ? {
                id: receipt.id,
                title: receipt.title,
                code: receipt.code,
                status: 'pending' as const,
              }
            : receipt,
        )
      const record: BranchTranscriptRecord = {
        kind: 'turn',
        id: turn.id,
        messages,
        receipts,
        partial,
        outcome: complete
          ? { status: 'done', answerId: turn.outcome!.answerId }
          : turn.outcome?.status === 'error' && cut < 0
            ? {
                status: 'error',
                ...(['incomplete', 'interrupted'].includes(
                  turn.outcome.termination ?? '',
                )
                  ? { termination: turn.outcome.termination }
                  : {}),
              }
            : undefined,
      }
      state.cursor = next.sequence
      state.messages += messages.length
      if (cut >= 0) state.ended = true
      if (!messages.length) {
        save(sql, 'copy_exports', id, state)
        return { status: 'building' as const }
      }
      await appendRecord(storage, id, state, record)
      return { status: 'building' as const }
    }
    if (state.request.boundary.kind === 'message')
      throw new CopyProtocolError(
        'message_not_found',
        'The selected message was not found in the sealed history.',
      )
    state.ended = true
    save(sql, 'copy_exports', id, state)
  }
  if (state.formatVersion === 2) {
    const next = sql
      .exec<{ key: string; sequence: number }>(
        "SELECT key,sequence FROM copy_raw WHERE operation_id=? AND kind='action-evidence' AND ordinal=0 AND sequence>? ORDER BY sequence LIMIT 1",
        id,
        state.actionEvidenceCursor ?? 0,
      )
      .toArray()[0]
    if (next) {
      const record = loadRaw(
        sql,
        id,
        'action-evidence',
        next.key,
      ) as ActionEvidence
      evidenceInventory([record])
      await verifyRetryDigests(record.source)
      state.actionEvidenceCursor = next.sequence
      await appendRecord(storage, id, state, {
        kind: 'action-evidence',
        ...record,
      })
      return { status: 'building' as const }
    }
  }
  if (state.request.retry && !state.retryWritten) {
    const source = retrySourceProjection(
      loadRaw(sql, id, 'retry', 'source') as RetrySource,
    )
    await verifyRetryDigests(source)
    await verifyReviewDigest(source)
    state.retryWritten = true
    await appendRecord(storage, id, state, { kind: 'retry', source })
    return { status: 'building' as const }
  }
  const dependency = sql
    .exec<{ result_id: string }>(
      'SELECT result_id FROM copy_dependencies WHERE operation_id=? AND done=0 LIMIT 1',
      id,
    )
    .toArray()[0]
  if (dependency) {
    const matches = sql
      .exec<{ key: string }>(
        "SELECT DISTINCT key FROM copy_raw WHERE operation_id=? AND kind='evidence' AND substr(key,instr(key,char(31))+1)=?",
        id,
        dependency.result_id,
      )
      .toArray()
    if (!matches.length)
      throw new CopyProtocolError(
        'missing_reference',
        'Required historical result ' +
          dependency.result_id +
          ' is unavailable.',
      )
    const values = matches.map((match) => ({
      key: match.key,
      value: loadRaw(sql, id, 'evidence', match.key),
    }))
    if (
      values.some(
        (v) =>
          canonicalCopyJson(v.value) !== canonicalCopyJson(values[0].value),
      )
    )
      throw new CopyProtocolError(
        'ambiguous_reference',
        'A historical result has conflicting versions.',
      )
    await appendRecord(storage, id, state, {
      kind: 'evidence',
      taskId: 'assistant',
      resultId: dependency.result_id,
      value: dependency.result_id.startsWith('context_')
        ? (state.projectionVersion === 2
            ? copyContextEvidence
            : copyLegacyContextEvidence)(values[0].value)
        : values[0].value,
    })
    sql.exec(
      'UPDATE copy_dependencies SET done=1 WHERE operation_id=? AND result_id=?',
      id,
      dependency.result_id,
    )
    return { status: 'building' as const }
  }
  if (!state.pages) {
    await appendRecord(storage, id, state, {
      kind: 'turn',
      id: 'empty',
      messages: [],
      receipts: [],
      partial: false,
    })
    return { status: 'building' as const }
  }
  state.sealed = {
    schemaVersion: state.formatVersion ?? 1,
    operationId: id,
    digest: state.chain,
    pageCount: state.pages,
    sourceEpoch: state.epoch,
    sourceRevision: state.revision,
    sourceMessageId:
      state.request.boundary.kind === 'message'
        ? state.request.boundary.messageId
        : null,
    ...(state.request.boundary.kind === 'message' && state.request.boundary.side
      ? { sourceMessagePosition: state.request.boundary.side }
      : {}),
    sourceMessageDigest:
      state.request.boundary.kind === 'message'
        ? state.request.boundary.expectedDigest
        : null,
    messageCount: state.messages,
    ...(state.formatVersion === 2
      ? { actionEvidence: state.actionEvidence! }
      : {}),
    ...(state.request.retry
      ? { retryEvidenceDigest: state.request.retry.evidenceDigest }
      : {}),
  }
  save(sql, 'copy_exports', id, state)
  return { status: 'sealed' as const, manifest: state.sealed }
}
export function readCopyExportPage(
  sql: SqlStorage,
  id: string,
  ordinal: number,
): CopyPage {
  const state = row<ExportState>(sql, 'copy_exports', id)
  if (!state?.sealed)
    throw new CopyProtocolError(
      'unsealed_export',
      'The copy is not sealed yet.',
    )
  const page = sql
    .exec<{ ordinal: number; digest: string; payload: string }>(
      'SELECT ordinal,digest,payload FROM copy_pages WHERE operation_id=? AND ordinal=?',
      id,
      ordinal,
    )
    .toArray()[0]
  if (!page)
    throw new CopyProtocolError('missing_page', 'A copy page is unavailable.')
  return page
}
export async function stageCopyPage(
  storage: Pick<DurableObjectStorage, 'sql' | 'transactionSync'>,
  id: string,
  manifest: CopyManifest,
  page: CopyPage,
  identity: CopyIdentity,
) {
  manifestInventory(manifest)
  if (
    manifest.operationId !== id ||
    (manifest.schemaVersion !== 1 && manifest.schemaVersion !== 2) ||
    page.ordinal < 0 ||
    page.ordinal >= manifest.pageCount ||
    !Number.isSafeInteger(page.ordinal) ||
    encode(page.payload).length > 48000 ||
    (await hash(page.payload)) !== page.digest
  )
    throw new CopyProtocolError(
      'invalid_page',
      'The copy page failed verification.',
    )
  const old = row<ImportState>(storage.sql, 'copy_imports', id)
  if (
    old &&
    (canonicalCopyJson(old.manifest) !== canonicalCopyJson(manifest) ||
      old.identity.botId !== identity.botId ||
      old.identity.userId !== identity.userId ||
      old.identity.workspaceId !== identity.workspaceId ||
      (old.identity.conversationId !== undefined &&
        identity.conversationId !== undefined &&
        old.identity.conversationId !== identity.conversationId))
  )
    throw new CopyProtocolError(
      'import_conflict',
      'This target is bound to a different copy.',
    )
  const existing = storage.sql
    .exec<{ digest: string }>(
      'SELECT digest FROM copy_staged_pages WHERE operation_id=? AND ordinal=?',
      id,
      page.ordinal,
    )
    .toArray()[0]
  if (existing && existing.digest !== page.digest)
    throw new CopyProtocolError(
      'page_conflict',
      'A previously copied page has changed.',
    )
  storage.transactionSync(() => {
    if (!old)
      save(storage.sql, 'copy_imports', id, {
        manifest,
        identity,
        pageCursor: 0,
        recordCursor: 0,
        messages: 0,
        chain: '',
        ready: false,
      } satisfies ImportState)
    else if (
      old.identity.conversationId === undefined &&
      identity.conversationId !== undefined
    )
      save(storage.sql, 'copy_imports', id, {
        ...old,
        identity: { ...old.identity, conversationId: identity.conversationId },
      } satisfies ImportState)
    storage.sql.exec(
      'INSERT OR IGNORE INTO copy_staged_pages VALUES (?,?,?,?)',
      id,
      page.ordinal,
      page.digest,
      page.payload,
    )
  })
}
export async function advanceCopyImport(
  storage: Pick<DurableObjectStorage, 'sql' | 'transactionSync'>,
  id: string,
  digest: string,
) {
  const sql = storage.sql,
    state = row<ImportState>(sql, 'copy_imports', id)
  if (!state || state.manifest.digest !== digest)
    throw new CopyProtocolError(
      'import_conflict',
      'The target copy does not match this manifest.',
    )
  if (state.ready) return { status: 'ready' as const, operationId: id, digest }
  if (state.pageCursor === state.manifest.pageCount) {
    if (
      state.chain !== digest ||
      state.messages !== state.manifest.messageCount ||
      !!state.retryReceived !== !!state.manifest.retryEvidenceDigest
    )
      throw new CopyProtocolError(
        'import_digest',
        'The complete copied history failed verification.',
      )
    verifyImportedCollection(sql, id, state.manifest)
    if (
      state.manifest.schemaVersion === 2 &&
      sql
        .exec(
          "SELECT d.result_id FROM copy_import_dependencies d WHERE d.operation_id=? AND NOT EXISTS(SELECT 1 FROM copy_import_records r WHERE r.operation_id=d.operation_id AND r.kind='evidence' AND r.key=d.result_id) LIMIT 1",
          id,
        )
        .toArray().length
    )
      throw new CopyProtocolError(
        'missing_reference',
        'Required historical results are missing from the copied evidence.',
      )
    state.ready = true
    save(sql, 'copy_imports', id, state)
    return { status: 'ready' as const, operationId: id, digest }
  }
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
  let text = '',
    chain = state.chain,
    expectedChunks = 0
  for (let chunk = 0; ; chunk++) {
    const page = sql
      .exec<{ digest: string; payload: string }>(
        'SELECT digest,payload FROM copy_staged_pages WHERE operation_id=? AND ordinal=?',
        id,
        state.pageCursor + chunk,
      )
      .toArray()[0]
    if (!page)
      throw new CopyProtocolError(
        'missing_page',
        'The target copy is missing a page.',
      )
    if ((await hash(page.payload)) !== page.digest)
      throw new CopyProtocolError('page_digest', 'The copied page is corrupt.')
    const envelope = JSON.parse(page.payload) as {
      record: number
      chunk: number
      chunks: number
      data: string
    }
    if (
      envelope.record !== state.recordCursor ||
      envelope.chunk !== chunk ||
      envelope.chunks < 1 ||
      envelope.chunks > 4096 ||
      (chunk && envelope.chunks !== expectedChunks)
    )
      throw new CopyProtocolError(
        'page_order',
        'The copied pages are out of order.',
      )
    expectedChunks = envelope.chunks
    text += decoder.decode(unb64(envelope.data), { stream: true })
    chain = await hash(chain + page.digest)
    if (encode(text).length > 16 * 1024 * 1024)
      throw new CopyProtocolError(
        'record_too_large',
        'A copied record exceeds the supported size.',
      )
    if (chunk + 1 === expectedChunks) break
  }
  const record = JSON.parse(text + decoder.decode()) as BranchRecord
  if (
    record.kind !== 'turn' &&
    record.kind !== 'evidence' &&
    record.kind !== 'retry' &&
    record.kind !== 'action-evidence'
  )
    throw new CopyProtocolError('record_type', 'Unknown copied record type.')
  if (record.kind === 'retry') {
    if (state.retryReceived || !state.manifest.retryEvidenceDigest)
      throw new CopyProtocolError(
        'unexpected_retry_evidence',
        'The copy contains unexpected or duplicate retry evidence.',
      )
    const source = retrySourceProjection(record.source)
    if (
      canonicalCopyJson({ kind: 'retry', source }) !== canonicalCopyJson(record)
    )
      throw new CopyProtocolError(
        'invalid_retry_evidence',
        'The copied retry record contains unsupported data.',
      )
    record.source = source
    if (
      record.source.evidenceDigest !== state.manifest.retryEvidenceDigest ||
      record.source.boundary.epoch !== state.manifest.sourceEpoch ||
      record.source.boundary.messageId !== state.manifest.sourceMessageId ||
      record.source.boundary.expectedDigest !==
        state.manifest.sourceMessageDigest ||
      state.manifest.sourceMessagePosition !== 'before'
    )
      throw new CopyProtocolError(
        'retry_evidence_manifest',
        'The retry evidence does not match this copy.',
      )
    await verifyRetryDigests(record.source)
    await verifyReviewDigest(record.source)
    const ancestors = manifestInventory(state.manifest).filter(
      (entry) => entry.id !== id,
    )
    if (
      canonicalCopyJson(record.source.inheritedEvidence ?? []) !==
      canonicalCopyJson(ancestors)
    )
      throw new CopyProtocolError(
        'retry_evidence_manifest',
        'The inherited evidence does not match this retry review.',
      )
  }
  if (record.kind === 'action-evidence') {
    if (state.manifest.schemaVersion !== 2 || record.id === id)
      throw new CopyProtocolError(
        'unexpected_action_evidence',
        'This copy contains unexpected inherited evidence.',
      )
    try {
      const source = parseRetryTurnSource(record.source)
      if (
        canonicalCopyJson({
          kind: 'action-evidence',
          id: record.id,
          source,
        }) !== canonicalCopyJson(record)
      )
        throw new Error('Unsupported evidence fields')
      record.source = source
    } catch {
      throw new CopyProtocolError(
        'invalid_action_evidence',
        'The inherited action evidence is invalid.',
      )
    }
    await verifyRetryDigests(record.source)
  }
  if (record.kind === 'action-evidence' || record.kind === 'retry') {
    const carried = readActionEvidence(sql, id)
    const next = {
      id: record.kind === 'retry' ? id : record.id,
      source: retryTurnSource(record.source),
    }
    const inventory = evidenceInventory([...carried, next])
    const expected = manifestInventory(state.manifest).slice(
      0,
      inventory.length,
    )
    if (canonicalCopyJson(inventory) !== canonicalCopyJson(expected))
      throw new CopyProtocolError(
        'action_evidence_manifest',
        'The copied action evidence is unexpected, duplicated or out of order.',
      )
  }
  storage.transactionSync(() => {
    if (
      record.kind === 'evidence' &&
      sql
        .exec(
          "SELECT key FROM copy_import_records WHERE operation_id=? AND kind='evidence' AND key=?",
          id,
          record.resultId,
        )
        .toArray().length
    )
      throw new CopyProtocolError(
        'duplicate_reference',
        'A historical result was copied more than once.',
      )
    if (state.manifest.schemaVersion === 2)
      for (const resultId of recordReferences(record, true))
        sql.exec(
          'INSERT OR IGNORE INTO copy_import_dependencies VALUES (?,?)',
          id,
          resultId,
        )
    if (record.kind === 'turn') {
      for (const message of record.messages) {
        if (
          sql
            .exec(
              'SELECT message_id FROM copy_import_messages WHERE operation_id=? AND message_id=?',
              id,
              message.id,
            )
            .toArray().length
        )
          throw new CopyProtocolError(
            'duplicate_message',
            'Copied message IDs must be unique.',
          )
        sql.exec(
          'INSERT INTO copy_import_messages VALUES (?,?)',
          id,
          message.id,
        )
      }
      state.messages += record.messages.length
    }
    if (record.kind === 'turn' && record.messages.length) {
      const turn = {
        id: record.id,
        messages: record.messages,
        approvals: [],
        receipts: record.receipts,
        outcome: record.outcome,
        inherited: { partial: record.partial },
      }
      const bytes = encode(JSON.stringify(turn))
      sql.exec('INSERT INTO transcript_turns(turn_id) VALUES (?)', record.id)
      for (
        let start = 0, ordinal = 0;
        start < bytes.length;
        start += 65536, ordinal++
      )
        sql.exec(
          'INSERT INTO transcript_chunks VALUES (?,?,?)',
          record.id,
          ordinal,
          bytes.slice(start, start + 65536).buffer,
        )
      for (const message of record.messages)
        sql.exec(
          'INSERT INTO transcript_messages VALUES (?,?)',
          message.id,
          record.id,
        )
      sql.exec('INSERT INTO transcript_indexed_turns VALUES (?)', record.id)
    } else if (record.kind === 'evidence') {
      const bytes = encode(JSON.stringify(record.value))
      for (
        let start = 0, ordinal = 0;
        start < bytes.length;
        start += 65536, ordinal++
      )
        sql.exec(
          'INSERT INTO task_result_chunks VALUES (?,?,?,?)',
          'assistant',
          record.resultId,
          ordinal,
          bytes.slice(start, start + 65536).buffer,
        )
    } else if (record.kind === 'retry') {
      state.retryReceived = true
    }
    sql.exec(
      'INSERT INTO copy_import_records VALUES (?,?,?,?,?)',
      id,
      state.recordCursor,
      record.kind,
      record.kind === 'turn'
        ? record.id
        : record.kind === 'evidence'
          ? record.resultId
          : record.kind === 'action-evidence'
            ? record.id
            : record.source.boundary.messageId,
      record.kind === 'retry' || record.kind === 'action-evidence'
        ? canonicalCopyJson(record.source)
        : '{}',
    )
    state.pageCursor += expectedChunks
    state.recordCursor++
    state.chain = chain
    save(sql, 'copy_imports', id, state)
  })
  return { status: 'importing' as const }
}
export function importedState(sql: SqlStorage, id: string) {
  return row<ImportState>(sql, 'copy_imports', id)
}
function readActionEvidence(sql: SqlStorage, id: string): ActionEvidence[] {
  return sql
    .exec<{ kind: string; key: string; json: string }>(
      "SELECT kind,key,json FROM copy_import_records WHERE operation_id=? AND kind IN ('retry','action-evidence') ORDER BY ordinal",
      id,
    )
    .toArray()
    .map((record) => ({
      id: record.kind === 'retry' ? id : record.key,
      source:
        record.kind === 'retry'
          ? retryTurnSource(retrySourceProjection(JSON.parse(record.json)))
          : parseRetryTurnSource(JSON.parse(record.json)),
    }))
}
function verifyImportedCollection(
  sql: SqlStorage,
  id: string,
  manifest: CopyManifest,
) {
  const records = readActionEvidence(sql, id)
  if (
    canonicalCopyJson(evidenceInventory(records)) !==
    canonicalCopyJson(manifestInventory(manifest))
  )
    throw new CopyProtocolError(
      'action_evidence_missing',
      'The copied action evidence collection is incomplete.',
    )
  return records
}
/** All inherited records, plus this operation's current retry, after full import. */
export function importedActionEvidence(
  sql: SqlStorage,
  id: string,
): ActionEvidence[] | undefined {
  const state = importedState(sql, id)
  if (!state?.ready) return
  return verifyImportedCollection(sql, id, state.manifest)
}
/** Available only after the entire prefix, retry record and result payloads verify. */
export function importedRetrySource(
  sql: SqlStorage,
  id: string,
): RetrySource | undefined {
  const state = importedState(sql, id)
  if (
    !state?.ready ||
    !state.retryReceived ||
    !state.manifest.retryEvidenceDigest
  )
    return
  verifyImportedCollection(sql, id, state.manifest)
  const record = sql
    .exec<{ json: string }>(
      'SELECT json FROM copy_import_records WHERE operation_id=? AND kind=?',
      id,
      'retry',
    )
    .toArray()
  if (record.length !== 1)
    throw new CopyProtocolError(
      'retry_evidence_missing',
      'The copied retry evidence is unavailable.',
    )
  return retrySourceProjection(JSON.parse(record[0].json))
}
export function releaseExport(sql: SqlStorage, id: string) {
  for (const table of ['copy_raw', 'copy_pages', 'copy_dependencies'])
    sql.exec(`DELETE FROM ${table} WHERE operation_id=?`, id)
  sql.exec('DELETE FROM copy_exports WHERE id=?', id)
}
export function discardImport(sql: SqlStorage, id: string) {
  for (const table of [
    'copy_staged_pages',
    'copy_import_records',
    'copy_import_messages',
    'copy_import_dependencies',
  ])
    sql.exec(`DELETE FROM ${table} WHERE operation_id=?`, id)
  sql.exec('DELETE FROM copy_imports WHERE id=?', id)
}

/** Process a bounded burst while retaining a durable checkpoint per record. */
export async function advanceCopyExportBatch(
  storage: Pick<DurableObjectStorage, 'sql' | 'transactionSync'>,
  id: string,
) {
  const deadline = performance.now() + 25
  for (let count = 0; ; count++) {
    const progress = await advanceCopyExport(storage, id)
    if (
      progress.status === 'sealed' ||
      count >= 15 ||
      performance.now() >= deadline
    )
      return progress
  }
}

export async function advanceCopyImportBatch(
  storage: Pick<DurableObjectStorage, 'sql' | 'transactionSync'>,
  id: string,
  digest: string,
) {
  const deadline = performance.now() + 25
  for (let count = 0; ; count++) {
    const progress = await advanceCopyImport(storage, id, digest)
    if (
      progress.status === 'ready' ||
      count >= 15 ||
      performance.now() >= deadline
    )
      return progress
  }
}
