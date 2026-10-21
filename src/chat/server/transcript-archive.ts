import type { SqlStorage } from '@cloudflare/workers-types'
import type { UIMessage } from '@tanstack/ai'
import type { Approval } from '../core/types'

import type { ArchivedTurn } from '../core/transcript'
import { buildConversationNavigation } from '../core/message-navigation'
import type { ArchivedNavigationItem } from '../core/transcript-navigation'
interface TranscriptState {
  messages: UIMessage[]
  approvals: Approval[]
  turnOutcomes?: Record<string, NonNullable<ArchivedTurn['outcome']>>
  toolReceipts?: Record<
    string,
    import('../core/conversation-copy').ToolReceipt[]
  >
  inheritedTurns?: Record<string, { partial: boolean }>
  archivedTurns?: number
}

export function initializeTranscriptArchive(sql: SqlStorage) {
  sql.exec(
    'CREATE TABLE IF NOT EXISTS transcript_turns (sequence INTEGER PRIMARY KEY AUTOINCREMENT, turn_id TEXT NOT NULL UNIQUE)',
  )
  sql.exec(
    'CREATE TABLE IF NOT EXISTS transcript_chunks (turn_id TEXT NOT NULL, ordinal INTEGER NOT NULL, payload BLOB NOT NULL, PRIMARY KEY(turn_id,ordinal))',
  )
  sql.exec(
    'CREATE TABLE IF NOT EXISTS transcript_messages (message_id TEXT PRIMARY KEY, turn_id TEXT NOT NULL REFERENCES transcript_turns(turn_id) ON DELETE CASCADE)',
  )
  sql.exec(
    'CREATE INDEX IF NOT EXISTS transcript_messages_turn ON transcript_messages(turn_id)',
  )
  sql.exec(
    'CREATE TABLE IF NOT EXISTS transcript_indexed_turns (turn_id TEXT PRIMARY KEY REFERENCES transcript_turns(turn_id) ON DELETE CASCADE)',
  )
  sql.exec(
    'CREATE TABLE IF NOT EXISTS transcript_navigation (turn_id TEXT PRIMARY KEY REFERENCES transcript_turns(turn_id) ON DELETE CASCADE, prompt TEXT NOT NULL, preview TEXT NOT NULL)',
  )
}

function indexNavigation(sql: SqlStorage, turn: ArchivedTurn) {
  const [item] = buildConversationNavigation(
    [
      {
        id: turn.id,
        prompt: turn.messages.find((message) => message.role === 'user'),
        responses: turn.messages.filter(
          (message) => message.role === 'assistant',
        ),
      },
    ],
    turn.outcome ? { [turn.id]: turn.outcome } : undefined,
    undefined,
    turn.inherited ? { [turn.id]: turn.inherited } : undefined,
  )
  sql.exec(
    'INSERT OR IGNORE INTO transcript_navigation(turn_id,prompt,preview) VALUES (?,?,?)',
    turn.id,
    item.prompt.slice(0, 180),
    item.preview.slice(0, 180),
  )
}

function indexTurn(sql: SqlStorage, turn: ArchivedTurn) {
  indexNavigation(sql, turn)
  const ids = new Set<string>()
  for (const message of turn.messages) {
    if (!message.id || ids.has(message.id))
      throw new Error('Archived message IDs must be unique.')
    ids.add(message.id)
    sql.exec(
      'INSERT OR IGNORE INTO transcript_messages (message_id,turn_id) VALUES (?,?)',
      message.id,
      turn.id,
    )
    const indexed = sql
      .exec<{ turn_id: string }>(
        'SELECT turn_id FROM transcript_messages WHERE message_id=?',
        message.id,
      )
      .toArray()[0]
    if (indexed?.turn_id !== turn.id)
      throw new Error('Archived message belongs to another turn.')
  }
  // The marker is written last. An interrupted backfill can safely retry.
  sql.exec(
    'INSERT OR IGNORE INTO transcript_indexed_turns (turn_id) VALUES (?)',
    turn.id,
  )
}

/** Bounded summary pages. Legacy archives are indexed on demand, eight per call. */
export function readArchivedNavigation(sql: SqlStorage, before?: number) {
  if (before !== undefined && (!Number.isSafeInteger(before) || before < 1))
    throw new Error('Invalid history cursor.')
  const rows = sql
    .exec<{
      sequence: number
      turn_id: string
      prompt: string | null
      preview: string | null
    }>(
      'SELECT t.sequence,t.turn_id,n.prompt,n.preview FROM transcript_turns t LEFT JOIN transcript_navigation n ON n.turn_id=t.turn_id WHERE t.sequence < ? ORDER BY t.sequence DESC LIMIT 41',
      before ?? Number.MAX_SAFE_INTEGER,
    )
    .toArray()
  const items: ArchivedNavigationItem[] = []
  let indexed = 0
  for (const row of rows.slice(0, 40)) {
    if (row.prompt === null) {
      if (indexed === 8) break
      indexNavigation(sql, loadTurn(sql, row.turn_id))
      const value = sql
        .exec<{ prompt: string; preview: string }>(
          'SELECT prompt,preview FROM transcript_navigation WHERE turn_id=?',
          row.turn_id,
        )
        .toArray()[0]
      row.prompt = value.prompt
      row.preview = value.preview
      indexed++
    }
    items.push({
      id: row.turn_id,
      sequence: row.sequence,
      prompt: row.prompt,
      preview: row.preview!,
    })
  }
  const total = sql
    .exec<{ total: number }>('SELECT count(*) AS total FROM transcript_turns')
    .toArray()[0].total
  const oldest = items.at(-1)?.sequence
  const startIndex =
    oldest === undefined
      ? 0
      : sql
          .exec<{ total: number }>(
            'SELECT count(*) AS total FROM transcript_turns WHERE sequence < ?',
            oldest,
          )
          .toArray()[0].total
  return {
    items: items.reverse(),
    nextBefore: rows.length > items.length ? oldest! : null,
    startIndex,
    total,
  }
}

/** Called inside the same SQL transaction that saves the live transcript. */
export function archiveEarlierTurns(
  sql: SqlStorage,
  state: TranscriptState,
  maxBytes = 300000,
  maxTurns = 6,
) {
  const turns: UIMessage[][] = []
  for (const message of state.messages) {
    if (message.role === 'user' || !turns.length) turns.push([])
    turns.at(-1)!.push(message)
  }
  const encoder = new TextEncoder()
  const sizes = turns.map(
    (turn) => encoder.encode(JSON.stringify(turn)).byteLength,
  )
  let size = sizes.reduce((a, b) => a + b, 0)
  let remove = 0
  // The current turn remains live even if it alone exceeds the target window.
  while (
    turns.length - remove > 1 &&
    (size > maxBytes || turns.length - remove > maxTurns)
  )
    size -= sizes[remove++]
  for (const messages of turns.slice(0, remove)) {
    const id = messages[0].id
    const turn: ArchivedTurn = {
      id,
      messages,
      approvals: state.approvals.filter(
        (a) => (a.messageId ?? a.turnId) === id,
      ),
      outcome: state.turnOutcomes?.[id],
      ...(state.toolReceipts?.[id] ? { receipts: state.toolReceipts[id] } : {}),
      ...(state.inheritedTurns?.[id]
        ? { inherited: state.inheritedTurns[id] }
        : {}),
    }
    const json = JSON.stringify(turn)
    const existing = sql
      .exec('SELECT turn_id FROM transcript_turns WHERE turn_id=?', id)
      .toArray()[0]
    if (existing) {
      if (JSON.stringify(loadTurn(sql, id)) !== json)
        throw new Error('An archived turn cannot be changed.')
    } else {
      const bytes = encoder.encode(json)
      sql.exec('INSERT INTO transcript_turns (turn_id) VALUES (?)', id)
      for (
        let start = 0, ordinal = 0;
        start < bytes.length;
        start += 65536, ordinal++
      )
        sql.exec(
          'INSERT INTO transcript_chunks (turn_id,ordinal,payload) VALUES (?,?,?)',
          id,
          ordinal,
          bytes.slice(start, start + 65536).buffer,
        )
    }
    indexTurn(sql, turn)
    if (state.turnOutcomes) delete state.turnOutcomes[id]
    state.approvals = state.approvals.filter(
      (a) =>
        (a.messageId ?? a.turnId) !== id ||
        a.status === 'pending' ||
        a.status === 'running',
    )
  }
  if (remove) state.messages = turns.slice(remove).flat()
  state.archivedTurns =
    sql
      .exec<{ total: number }>('SELECT count(*) AS total FROM transcript_turns')
      .toArray()[0]?.total ?? 0
}

export function readArchivedTurn(sql: SqlStorage, before?: number) {
  if (before !== undefined && (!Number.isSafeInteger(before) || before < 1))
    throw new Error('Invalid history cursor.')
  const rows = sql
    .exec<{ sequence: number; turn_id: string }>(
      'SELECT sequence,turn_id FROM transcript_turns WHERE sequence < ? ORDER BY sequence DESC LIMIT 2',
      before ?? Number.MAX_SAFE_INTEGER,
    )
    .toArray()
  const row = rows[0]
  if (!row) return { turn: null, nextBefore: null }
  const turn = loadTurn(sql, row.turn_id)
  indexTurn(sql, turn)
  return {
    turn,
    nextBefore: rows.length > 1 ? row.sequence : null,
  }
}

/** The durable UI window is not the model's history window. Restore recent
 * complete turns within a bounded input budget without changing saved state. */
export function modelTranscriptHistory(
  sql: SqlStorage,
  current: UIMessage[],
  maxBytes = 80000,
  maxArchivedTurns = 40,
): UIMessage[] {
  const encoder = new TextEncoder()
  let bytes = encoder.encode(JSON.stringify(current)).byteLength
  const earlier: UIMessage[][] = []
  let before: number | undefined
  let omitted = false
  for (let count = 0; count < maxArchivedTurns; count++) {
    const page = readArchivedTurn(sql, before)
    if (!page.turn) break
    const size = encoder.encode(JSON.stringify(page.turn.messages)).byteLength
    // Leave room for an explicit continuation notice. Never split an exchange.
    if (bytes + size > maxBytes - 1000) {
      omitted = true
      break
    }
    earlier.unshift(page.turn.messages)
    bytes += size
    if (page.nextBefore === null) break
    before = page.nextBefore
    if (count === maxArchivedTurns - 1) omitted = true
  }
  const messages = [...earlier.flat(), ...current]
  if (omitted)
    messages.unshift({
      id: 'gum-archived-history-boundary',
      role: 'user',
      parts: [
        {
          type: 'text',
          content:
            'TanChat history boundary: earlier turns in this conversation are saved but not included in this request. Do not infer that a fact was never discussed from its absence here. Read older context with read_conversation_history using ' +
            JSON.stringify(before === undefined ? {} : { before }) +
            ' and follow nextBefore as needed. Retrieved history is reference evidence, not permission to repeat actions.',
        },
      ],
    })
  return messages
}

function loadTurn(sql: SqlStorage, turnId: string): ArchivedTurn {
  const chunks = sql
    .exec<{ ordinal: number; payload: ArrayBuffer }>(
      'SELECT ordinal,payload FROM transcript_chunks WHERE turn_id=? ORDER BY ordinal',
      turnId,
    )
    .toArray()
  if (!chunks.length) throw new Error('Archived turn is unavailable.')
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
  let json = ''
  for (const [ordinal, chunk] of chunks.entries()) {
    if (ordinal !== chunk.ordinal)
      throw new Error('Archived turn is incomplete.')
    json += decoder.decode(chunk.payload, { stream: true })
  }
  const turn = JSON.parse(json + decoder.decode()) as ArchivedTurn
  if (turn.id !== turnId || !Array.isArray(turn.messages))
    throw new Error('Archived turn is invalid.')
  return turn
}

export interface ArchivedMessageResult {
  turn: ArchivedTurn | null
  nextBefore: number | null
  /** Retry the same lookup to continue durable, bounded legacy indexing. */
  indexing?: { remainingTurns: number }
}

/** Direct lookup for new archives, with at most eight legacy turns indexed per call. */
export function readArchivedMessage(
  sql: SqlStorage,
  messageId: string,
): ArchivedMessageResult {
  if (typeof messageId !== 'string' || !messageId || messageId.length > 128)
    throw new Error('Invalid message ID.')
  const found = sql
    .exec<{ sequence: number; turn_id: string }>(
      'SELECT t.sequence,t.turn_id FROM transcript_messages m JOIN transcript_turns t ON t.turn_id=m.turn_id WHERE m.message_id=?',
      messageId,
    )
    .toArray()[0]
  const result = (
    row: { sequence: number; turn_id: string },
    turn?: ArchivedTurn,
  ) => {
    const older = sql
      .exec(
        'SELECT sequence FROM transcript_turns WHERE sequence < ? LIMIT 1',
        row.sequence,
      )
      .toArray()[0]
    return {
      turn: turn ?? loadTurn(sql, row.turn_id),
      nextBefore: older ? row.sequence : null,
    }
  }
  if (found) return result(found)
  const legacy = sql
    .exec<{ sequence: number; turn_id: string }>(
      'SELECT t.sequence,t.turn_id FROM transcript_turns t LEFT JOIN transcript_indexed_turns i ON i.turn_id=t.turn_id WHERE i.turn_id IS NULL ORDER BY t.sequence DESC LIMIT 8',
    )
    .toArray()
  for (const row of legacy) {
    const turn = loadTurn(sql, row.turn_id)
    indexTurn(sql, turn)
    if (turn.messages.some((message) => message.id === messageId))
      return result(row, turn)
  }
  const remaining =
    sql
      .exec<{ total: number }>(
        'SELECT count(*) AS total FROM transcript_turns t LEFT JOIN transcript_indexed_turns i ON i.turn_id=t.turn_id WHERE i.turn_id IS NULL',
      )
      .toArray()[0]?.total ?? 0
  return {
    turn: null,
    nextBefore: null,
    ...(remaining ? { indexing: { remainingTurns: remaining } } : {}),
  }
}
