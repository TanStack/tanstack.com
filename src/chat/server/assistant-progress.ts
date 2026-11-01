import { callKey, type AssistantTask } from '../core/assistant-task'
import { recordAssistantProgress } from '../core/assistant-progress'
import { hash } from './crypto'

type Scope = { workspaceId: string; userId: string; conversationId: string }
type ToolObservation = {
  scope: Scope
  name: string
  args: unknown
  ok: boolean
  result: unknown
}
const object = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
const knownKeys = (row: Record<string, unknown>, keys: string[]) =>
  Object.keys(row).every((key) => keys.includes(key))
function fileEvidence(value: unknown) {
  const file = object(value)
  if (
    !file ||
    !['id', 'sha256', 'botId', 'name', 'mediaType', 'state', 'source'].every(
      (key) => typeof file[key] === 'string',
    ) ||
    typeof file.size !== 'number'
  )
    return undefined
  return {
    id: file.id,
    botId: file.botId,
    conversationId: file.conversationId,
    name: file.name,
    mediaType: file.mediaType,
    size: file.size,
    sha256: file.sha256,
    state: file.state,
    source: file.source,
  }
}
function retained(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(retained)
  const row = object(value)
  return (
    !!row &&
    (row.kind === 'stored-tool-result' ||
      row.kind === 'stored-context' ||
      Object.values(row).some(retained))
  )
}
/** Native protocols have known stable fields. Unknown provider data stays intact. */
function evidence(name: string, args: unknown, result: unknown): unknown {
  const row = object(result),
    input = object(args)
  if (!row) return result
  if (
    (name === 'save_file' ||
      name === 'copy_file' ||
      name === 'present_file' ||
      name === 'read_file') &&
    row.ok === true
  ) {
    const file = fileEvidence(row.file)
    if (
      !file ||
      !knownKeys(row, [
        'ok',
        'outcome',
        'delivery',
        'file',
        'untrusted',
        'text',
        'offset',
        'nextOffset',
        'totalChars',
      ])
    )
      return result
    if (
      name === 'read_file' &&
      (typeof row.text !== 'string' ||
        typeof row.offset !== 'number' ||
        typeof row.totalChars !== 'number')
    )
      return result
    return name !== 'read_file'
      ? { file }
      : {
          file,
          offset: row.offset,
          nextOffset: row.nextOffset,
          totalChars: row.totalChars,
          text: row.text,
        }
  }
  if (
    name === 'list_files' &&
    row.ok === true &&
    Array.isArray(row.files) &&
    knownKeys(row, ['ok', 'files'])
  ) {
    const files = row.files.map(fileEvidence)
    if (files.every(Boolean))
      return {
        files: files.sort((a, b) => callKey(a).localeCompare(callKey(b))),
      }
  }
  if (
    name === 'read_skill' &&
    row.ok === true &&
    typeof row.id === 'string' &&
    typeof row.version === 'number' &&
    object(row.document) &&
    knownKeys(row, [
      'ok',
      'id',
      'version',
      'scope',
      'document',
      'origin',
      'authority',
    ])
  )
    return {
      id: row.id,
      version: row.version,
      document: row.document,
      origin: row.origin,
    }
  if (
    name === 'read_plugin_file' &&
    row.ok === true &&
    ['installationId', 'path', 'digest', 'text'].every(
      (key) => typeof row[key] === 'string',
    ) &&
    typeof row.version === 'number' &&
    knownKeys(row, [
      'ok',
      'untrusted',
      'installationId',
      'version',
      'path',
      'digest',
      'text',
      'nextOffset',
    ])
  )
    return {
      installationId: row.installationId,
      version: row.version,
      path: row.path,
      digest: row.digest,
      offset: input?.offset ?? 0,
      nextOffset: row.nextOffset,
      text: row.text,
    }
  return result
}
async function record(
  task: AssistantTask,
  call: unknown,
  result: unknown,
  advances: boolean,
) {
  // The caller must resolve retained data before recording it. A new wrapper ID
  // is neither evidence of change nor proof that an external result is identical.
  if (retained(result)) return undefined
  const [callDigest, outcomeDigest] = await Promise.all([
    hash(callKey(call)),
    hash(callKey(result)),
  ])
  task.progress ??= { version: 1, revision: 0, entries: [] }
  return recordAssistantProgress(task.progress, {
    call: callDigest,
    outcome: outcomeDigest,
    advances,
  })
}
export async function observeAssistantToolProgress(
  task: AssistantTask,
  observation: ToolObservation,
) {
  const { scope, name, args, ok, result } = observation
  const row = object(result)
  const failed =
    !ok ||
    row?.ok === false ||
    row?.isError === true ||
    [
      'failed',
      'invalid_arguments',
      'rejected',
      'unknown',
      'already_attempted',
    ].includes(typeof row?.status === 'string' ? row.status : '')
  // Proposal IDs and approval state are handled at the confirmed action boundary.
  if (
    [
      'pending',
      'approval_required',
      'awaiting_user_approval',
      'awaiting_user_step',
      'proposed',
    ].includes(typeof row?.status === 'string' ? row.status : '')
  )
    return undefined
  const semantic = evidence(name, args, result)
  const nativeFile =
    row?.ok === true &&
    ['save_file', 'copy_file', 'present_file'].includes(name)
      ? fileEvidence(row.file)
      : undefined
  return record(
    task,
    { scope, name, args: nativeFile ? { fileId: nativeFile.id } : args },
    semantic,
    !failed,
  )
}
export async function observeAssistantApprovalProgress(
  task: AssistantTask,
  observation: {
    scope: Scope
    actionIdentity: unknown
    outcome: 'succeeded' | 'failed' | 'unknown' | 'rejected'
    /** Actual durable execution receipt, only for a newly confirmed non-read effect. */
    confirmedEffect?: { receiptId: string }
    result: unknown
  },
) {
  return record(
    task,
    { scope: observation.scope, action: observation.actionIdentity },
    {
      outcome: observation.outcome,
      result: observation.result,
      ...(observation.outcome === 'succeeded' && observation.confirmedEffect
        ? { confirmedEffect: observation.confirmedEffect.receiptId }
        : {}),
    },
    observation.outcome === 'succeeded',
  )
}
