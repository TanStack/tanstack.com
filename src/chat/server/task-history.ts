import type { SqlStorage } from '@cloudflare/workers-types'
import type { TaskState } from './system-one-loop'

export function initializeTaskHistory(sql: SqlStorage) {
  sql.exec(`CREATE TABLE IF NOT EXISTS system_one_history (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL UNIQUE, json TEXT NOT NULL
  )`)
}

export function saveTaskHistory(
  sql: SqlStorage,
  taskId: string,
  state: TaskState,
) {
  // Do not recursively duplicate earlier context in every stored turn.
  const json = JSON.stringify({
    taskId,
    request: state.request,
    observations: state.observations,
  })
  sql.exec(
    'INSERT INTO system_one_history (task_id,json) VALUES (?,?) ON CONFLICT(task_id) DO UPDATE SET json=excluded.json',
    taskId,
    json,
  )
}

export function recentTaskContext(sql: SqlStorage, maxBytes = 24000) {
  const total =
    sql
      .exec<{ total: number }>(
        'SELECT count(*) AS total FROM system_one_history',
      )
      .toArray()[0]?.total ?? 0
  const rows = sql
    .exec<{ json: string }>(
      'SELECT json FROM system_one_history ORDER BY sequence DESC LIMIT 8',
    )
    .toArray()
  const context: NonNullable<TaskState['context']> = []
  let size = 2
  for (const row of rows) {
    const bytes = new TextEncoder().encode(row.json).byteLength + 1
    // Keep a contiguous recent window. Never skip the newest turn and present older evidence as current.
    if (size + bytes > maxBytes) break
    size += bytes
    context.unshift(JSON.parse(row.json))
  }
  return {
    context,
    contextWindow: { includedTurns: context.length, totalTurns: total },
  }
}

export function searchTaskHistory(
  sql: SqlStorage,
  query: string,
  before?: number,
) {
  const rows = sql
    .exec<{ sequence: number; json: string }>(
      "SELECT sequence,json FROM system_one_history WHERE instr(json_extract(json, '$.request'),?) > 0 AND sequence < ? ORDER BY sequence DESC LIMIT 11",
      query,
      before ?? Number.MAX_SAFE_INTEGER,
    )
    .toArray()
  return {
    matches: rows.slice(0, 10).map((row) => {
      const turn = JSON.parse(row.json) as NonNullable<
        TaskState['context']
      >[number]
      return {
        taskId: turn.taskId,
        sequence: row.sequence,
        request: turn.request,
        observations: turn.observations.map((o) => ({
          id: o.id,
          toolName: o.toolName,
          toolId: o.toolId,
          source: o.source,
          ok: o.ok,
        })),
      }
    }),
    nextBefore: rows.length > 10 ? rows[9].sequence : null,
    nextArguments:
      rows.length > 10 ? { query, before: rows[9].sequence } : null,
    complete: rows.length <= 10,
  }
}

export function readTaskObservation(
  sql: SqlStorage,
  taskId: string,
  observationId: string,
) {
  const row = sql
    .exec<{ json: string }>(
      'SELECT json FROM system_one_history WHERE task_id=?',
      taskId,
    )
    .toArray()[0]
  if (!row) throw new Error('Task history is unavailable in this conversation.')
  const turn = JSON.parse(row.json) as NonNullable<TaskState['context']>[number]
  const observation = turn.observations.find((o) => o.id === observationId)
  if (!observation) throw new Error('Observation was not found in this task.')
  return { request: turn.request, observation }
}

/** A conversation-scoped read cursor, not authorization or an MCP standard. */
export function historyCursor(query: string, before: number) {
  return (
    'history:' +
    btoa(
      String.fromCharCode(
        ...new TextEncoder().encode(JSON.stringify({ query, before })),
      ),
    )
  )
}

export function continueTaskHistory(sql: SqlStorage, cursor: string) {
  if (!cursor.startsWith('history:') || cursor.length > 4096)
    throw new Error('Invalid history cursor.')
  let value: unknown
  try {
    value = JSON.parse(
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(
        Uint8Array.from(atob(cursor.slice(8)), (character) =>
          character.charCodeAt(0),
        ),
      ),
    )
  } catch {
    throw new Error('Invalid history cursor.')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid history cursor.')
  const parsed = value as Record<string, unknown>
  if (
    Object.keys(parsed).length !== 2 ||
    typeof parsed.query !== 'string' ||
    parsed.query.length > 300 ||
    typeof parsed.before !== 'number' ||
    !Number.isSafeInteger(parsed.before) ||
    parsed.before < 1
  )
    throw new Error('Invalid history cursor.')
  return searchTaskHistory(sql, parsed.query, parsed.before)
}
