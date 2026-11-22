import type {
  ExecutionReceipt,
  ExecutionSession,
  ExecutionSessionSnapshot,
} from './execution-sessions'

export type ExecutionPreview = {
  id: string
  openCommandId: string
  processId: string
  port: number
  path: string
  data: { title: string; text: string; truncated: boolean }
  closed: boolean
  closing: boolean
  live: boolean
}
export type ExecutionPreviewOwner = {
  localOwner: boolean
  phase: string
  /** Locally observed EOF can precede the persisted process projection. */
  exitedProcessIds?: ReadonlySet<string>
}

function sameRuntime(
  item: { sessionId: string; runtimeId: string; hostGeneration: number },
  session: ExecutionSession,
) {
  return (
    item.sessionId === session.id &&
    item.runtimeId === session.runtimeId &&
    item.hostGeneration === session.hostGeneration
  )
}

/** The process is a required lifecycle association, not proof of port ownership.
 * The public SDK connects to the workspace's port and accepts no process ID. */
function retainedPreviews(
  snapshot: ExecutionSessionSnapshot | null | undefined,
) {
  const session = snapshot?.session
  if (!snapshot || !session?.runtimeId) return []
  const commands = snapshot.commands.filter((item) =>
    sameRuntime(item, session),
  )
  const result: ExecutionPreview[] = []
  for (const opened of commands) {
    if (
      opened.state !== 'succeeded' ||
      opened.operation.type !== 'preview_open' ||
      opened.result?.type !== 'preview_open' ||
      !opened.previewId ||
      opened.previewId !== opened.result.previewId ||
      opened.operation.processId !== opened.result.processId
    )
      continue
    // Ambiguous retained identities cannot select a live handle.
    if (
      commands.filter((item) => item.previewId === opened.previewId).length !==
      1
    )
      continue
    const id = opened.previewId
    const closes = commands.filter(
      (item) =>
        item.operation.type === 'preview_close' &&
        item.operation.previewId === id,
    )
    const closed =
      session.status === 'closed' ||
      closes.some(
        (item) =>
          item.state === 'succeeded' &&
          item.result?.type === 'preview_close' &&
          item.result.previewId === id &&
          item.result.closed,
      )
    const closing =
      !closed &&
      (session.status === 'closing' ||
        closes.some((item) =>
          ['queued', 'dispatched', 'running', 'unknown'].includes(item.state),
        ))
    let latest: ExecutionReceipt = opened
    for (const item of commands) {
      if (
        item.state !== 'succeeded' ||
        (item.operation.type !== 'preview_inspect' &&
          item.operation.type !== 'preview_click') ||
        item.result?.type !== item.operation.type ||
        item.operation.previewId !== id ||
        item.result.previewId !== id
      )
        continue
      if (
        (item.completedAt ?? item.createdAt) >=
        (latest.completedAt ?? latest.createdAt)
      )
        latest = item
    }
    const data = latest.result as {
      title: string
      text: string
      truncated: boolean
    }
    result.push({
      id,
      openCommandId: opened.id,
      processId: opened.operation.processId,
      port: opened.operation.port,
      path: opened.operation.path,
      data: { title: data.title, text: data.text, truncated: data.truncated },
      closed,
      closing,
      live: false,
    })
  }
  return result
}

function available(
  snapshot: ExecutionSessionSnapshot,
  preview: ExecutionPreview,
  exitedProcessIds?: ReadonlySet<string>,
) {
  const session = snapshot.session
  if (
    !session ||
    session.status !== 'ready' ||
    preview.closed ||
    preview.closing ||
    exitedProcessIds?.has(preview.processId)
  )
    return false
  const process = snapshot.processes.find(
    (item) => item.id === preview.processId,
  )
  if (!process || process.state !== 'running' || !sameRuntime(process, session))
    return false
  const spawn = snapshot.commands.find((item) => item.id === process.commandId)
  return (
    !!spawn &&
    sameRuntime(spawn, session) &&
    spawn.state === 'succeeded' &&
    spawn.operation.type === 'spawn' &&
    spawn.result?.type === 'spawn' &&
    spawn.processId === process.id &&
    spawn.result.processId === process.id &&
    spawn.result.pid === process.pid
  )
}

/** Current-session eligibility only. The owner must also check its own live
 * host/lease and account before presenting or interacting with the SDK frame. */
export function openExecutionPreview(
  snapshot: ExecutionSessionSnapshot | null | undefined,
  previewId: string,
  exitedProcessIds?: ReadonlySet<string>,
): ExecutionPreview | undefined {
  if (!snapshot) return undefined
  const preview = retainedPreviews(snapshot).find(
    (item) => item.id === previewId,
  )
  return preview && available(snapshot, preview, exitedProcessIds)
    ? { ...preview, live: true }
    : undefined
}

/** Keep historical inspected text as evidence without presenting it as a live page. */
export function deriveExecutionPreviews(
  snapshot: ExecutionSessionSnapshot | null | undefined,
  owner?: ExecutionPreviewOwner,
): ExecutionPreview[] {
  return retainedPreviews(snapshot).map((preview) => ({
    ...preview,
    live:
      !!snapshot &&
      owner?.localOwner === true &&
      owner.phase === 'ready' &&
      available(snapshot, preview, owner.exitedProcessIds),
  }))
}

export function canDisplayExecutionPreview(
  snapshot: ExecutionSessionSnapshot | null | undefined,
  previewId: string,
  owner: ExecutionPreviewOwner,
): boolean {
  return (
    owner.localOwner &&
    owner.phase === 'ready' &&
    !!openExecutionPreview(snapshot, previewId, owner.exitedProcessIds)
  )
}
