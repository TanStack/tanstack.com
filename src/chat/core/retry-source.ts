import {
  canonicalCopyJson,
  copyMessage,
  copyReceipt,
  copyBoundarySchema,
  type BranchBoundary,
  type BranchTranscriptRecord,
  type ToolReceipt,
} from './conversation-copy'
import { parseRetryRequest, type RetryRequest } from './retry-request'
import type { ArchivedTurn } from './transcript'

export const maxRetrySourceBytes = 1024 * 1024
export const maxActionEvidenceRecords = 64
export const maxActionEvidenceBytes = 2 * 1024 * 1024

export interface RetryTurnSource {
  boundary: Extract<BranchBoundary, { kind: 'message' }> & { side: 'before' }
  request: RetryRequest
  evidence: BranchTranscriptRecord
  evidenceDigest: string
}
export interface ActionEvidence {
  id: string
  source: RetryTurnSource
}
export interface ActionEvidenceRef {
  id: string
  evidenceDigest: string
}
export interface RetrySource extends RetryTurnSource {
  /** Paired fields on new reviews. Omission is the legacy empty-inventory form. */
  inheritedEvidence?: ActionEvidenceRef[]
  reviewDigest?: string
}
export type RetrySourceResult =
  | { ok: true; source: RetrySource }
  | { ok: false; status: number; code: string; error: string }

export type RetryTurnProjection = Pick<RetrySource, 'request' | 'evidence'>

const validDigest = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)
const validEvidenceId = (value: unknown): value is string =>
  typeof value === 'string' && /^[^\s\u0000-\u001f\u007f]{1,128}$/u.test(value)

export function parseRetryTurnSource(value: unknown): RetryTurnSource {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('The action evidence is invalid.')
  const source = value as RetryTurnSource
  const boundary = copyBoundarySchema.parse(source.boundary)
  if (
    boundary.kind !== 'message' ||
    boundary.side !== 'before' ||
    source.evidence?.kind !== 'turn' ||
    source.evidence.id !== boundary.messageId ||
    !validDigest(source.evidenceDigest) ||
    !validDigest(boundary.expectedDigest) ||
    boundary.epoch.length > 128
  )
    throw new Error('The action evidence is invalid.')
  const projection = projectRetryTurn({
    id: source.evidence.id,
    messages: source.evidence.messages,
    approvals: [],
    receipts: source.evidence.receipts,
    outcome: source.evidence.outcome,
    inherited: { partial: source.evidence.partial },
  })
  const normalized = {
    ...projection,
    boundary: { ...boundary, side: 'before' as const },
    evidenceDigest: source.evidenceDigest,
  }
  if (canonicalCopyJson(normalized) !== canonicalCopyJson(value))
    throw new Error('The action evidence contains unsupported data.')
  return normalized
}

/** Strip review commitments when an immutable turn becomes inherited evidence. */
export function retryTurnSource(source: RetrySource): RetryTurnSource {
  return parseRetryTurnSource({
    boundary: source.boundary,
    request: source.request,
    evidence: source.evidence,
    evidenceDigest: source.evidenceDigest,
  })
}

export function parseActionEvidenceInventory(
  value: unknown,
): ActionEvidenceRef[] {
  if (!Array.isArray(value) || value.length > maxActionEvidenceRecords)
    throw new Error(
      'A conversation can retain up to 64 action evidence records.',
    )
  const seen = new Set<string>()
  return value.map((entry) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      !validEvidenceId(entry.id) ||
      !validDigest(entry.evidenceDigest)
    )
      throw new Error('The action evidence inventory is invalid.')
    const normalized = { id: entry.id, evidenceDigest: entry.evidenceDigest }
    if (seen.has(entry.id))
      throw new Error(
        'The action evidence inventory contains duplicate identities.',
      )
    if (canonicalCopyJson(normalized) !== canonicalCopyJson(entry))
      throw new Error(
        'The action evidence inventory contains unsupported data.',
      )
    seen.add(entry.id)
    return normalized
  })
}

/** Ordered, bounded inventory. Same-ID records are rejected rather than merged. */
export function actionEvidenceInventory(
  records: readonly ActionEvidence[],
): ActionEvidenceRef[] {
  if (!Array.isArray(records) || records.length > maxActionEvidenceRecords)
    throw new Error(
      'A conversation can retain up to 64 action evidence records.',
    )
  const sources: RetryTurnSource[] = []
  const inventory = records.map((record) => {
    if (!record || typeof record !== 'object' || !validEvidenceId(record.id))
      throw new Error('The action evidence identity is invalid.')
    const source = parseRetryTurnSource(record.source)
    if (
      canonicalCopyJson({ id: record.id, source }) !== canonicalCopyJson(record)
    )
      throw new Error('The action evidence contains unsupported data.')
    sources.push(source)
    return { id: record.id, evidenceDigest: source.evidenceDigest }
  })
  if (
    new TextEncoder().encode(canonicalCopyJson(sources)).byteLength >
    maxActionEvidenceBytes
  )
    throw new Error('The retained action evidence exceeds the 2 MiB limit.')
  return parseActionEvidenceInventory(inventory)
}

/** Call hash(retryReviewPayload(source)) before assigning source.reviewDigest. */
export function retryReviewPayload(source: RetrySource): string {
  return canonicalCopyJson({
    boundary: source.boundary,
    evidenceDigest: source.evidenceDigest,
    inheritedEvidence: source.inheritedEvidence ?? [],
  })
}

export function parseRetrySource(value: unknown): RetrySource {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('The retry review is invalid.')
  const source = value as RetrySource
  const normalized: RetrySource = retryTurnSource(source)
  if (
    source.inheritedEvidence !== undefined ||
    source.reviewDigest !== undefined
  ) {
    if (
      source.inheritedEvidence === undefined ||
      !validDigest(source.reviewDigest)
    )
      throw new Error('The retry review is missing its evidence commitment.')
    normalized.inheritedEvidence = parseActionEvidenceInventory(
      source.inheritedEvidence,
    )
    normalized.reviewDigest = source.reviewDigest
  }
  if (canonicalCopyJson(normalized) !== canonicalCopyJson(value))
    throw new Error('The retry review contains unsupported data.')
  return normalized
}

/** A detached inspection snapshot. Stored-result references still belong to the source. */
export function projectRetryTurn(turn: ArchivedTurn): RetryTurnProjection {
  const prompt = turn.messages[0]
  if (
    !prompt ||
    prompt.role !== 'user' ||
    prompt.id !== turn.id ||
    turn.messages.slice(1).some((message) => message.role === 'user') ||
    turn.messages.some((message) => !message.id) ||
    new Set(turn.messages.map((message) => message.id)).size !==
      turn.messages.length
  )
    throw new Error('Choose one complete user request and its responses.')
  if (
    turn.outcome?.status === 'waiting' ||
    turn.approvals.some(
      (approval) =>
        approval.status === 'pending' || approval.status === 'running',
    )
  )
    throw new Error('Finish or cancel the pending action before trying again.')
  if (
    turn.outcome?.answerId &&
    !turn.messages.some(
      (message) =>
        message.id === turn.outcome!.answerId && message.role === 'assistant',
    )
  )
    throw new Error('The saved response outcome could not be verified.')

  const request = parseRetryRequest(prompt)
  const receipts = new Map<string, ToolReceipt>()
  for (const source of [...(turn.receipts ?? []), ...turn.approvals]) {
    // Project inherited records too, so no unknown executable fields survive.
    const receipt = copyReceipt(source)
    const previous = receipts.get(receipt.id)
    if (previous && canonicalCopyJson(previous) !== canonicalCopyJson(receipt))
      throw new Error('The saved action evidence has conflicting results.')
    receipts.set(receipt.id, receipt)
  }

  const evidence: BranchTranscriptRecord = {
    kind: 'turn',
    id: turn.id,
    messages: turn.messages.map(copyMessage),
    receipts: [...receipts.values()],
    partial:
      !!turn.inherited?.partial ||
      !(
        turn.outcome?.status === 'error' ||
        (turn.outcome?.status === 'done' && turn.outcome.answerId)
      ),
    ...(turn.outcome
      ? {
          outcome: {
            status: turn.outcome.status,
            ...(turn.outcome.answerId
              ? { answerId: turn.outcome.answerId }
              : {}),
          },
        }
      : {}),
  }
  const serialized = canonicalCopyJson({ request, evidence })
  if (new TextEncoder().encode(serialized).byteLength > maxRetrySourceBytes)
    throw new Error(
      'This request and its action evidence are too large to restore.',
    )
  // Detach nested outputs as well as top-level parts before an async caller yields.
  return JSON.parse(serialized) as RetryTurnProjection
}
