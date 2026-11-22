import type { ExecutionHttp } from './execution-http'
import type { ExecutionHostEvent } from './execution-browser-bridge'
import type { ExecutionIdentity } from '../core/execution-sessions'
import { parseExecutionSnapshot } from '../core/execution-snapshot'
import {
  decodeExecutionBytes,
  emptyExecutionEventSummary,
  executionEventPageSchema,
  maxExecutionEvents,
} from '../core/execution-events'

/** Read a fixed output watermark. This reader has no command or runtime authority. */
export async function readExecutionHistory(
  http: Pick<ExecutionHttp, 'session' | 'events'>,
  identity: ExecutionIdentity,
  sessionId: string,
  signal: AbortSignal,
) {
  signal.throwIfAborted()
  const snapshot = parseExecutionSnapshot(
    await http.session(sessionId, signal),
    identity,
  )
  signal.throwIfAborted()
  const session = snapshot.session
  if (!session || session.id !== sessionId)
    throw new Error('The saved workspace does not match this session.')
  const through = snapshot.events.lastSequence
  const summary = emptyExecutionEventSummary()
  const events: ExecutionHostEvent[] = []
  let previous = snapshot.events
  while (summary.lastSequence < through) {
    const after = summary.lastSequence
    const page = executionEventPageSchema.parse(
      await http.events({ sessionId, after }, signal),
    )
    signal.throwIfAborted()
    if (
      page.sessionId !== sessionId ||
      page.after !== after ||
      page.hostGeneration !== session.hostGeneration ||
      page.runtimeId !== session.runtimeId ||
      page.summary.lastSequence < previous.lastSequence ||
      page.summary.outputBytes < previous.outputBytes ||
      page.summary.outputEvents < previous.outputEvents ||
      page.summary.droppedBytes < previous.droppedBytes ||
      page.nextSequence <= after
    )
      throw new Error('Saved output changed scope or is incomplete.')
    previous = page.summary
    for (const event of page.events.filter(
      (item) => item.sequence <= through,
    )) {
      const command = snapshot.commands.find(
        (item) => item.id === event.commandId,
      )
      if (
        !command ||
        command.digest !== event.digest ||
        !['run', 'spawn'].includes(command.operation.type) ||
        command.dispatchedAt === undefined ||
        event.processId !== command.processId ||
        event.sequence !== summary.lastSequence + 1 ||
        summary.lastSequence >= maxExecutionEvents
      )
        throw new Error('Saved output does not match its command receipt.')
      summary.lastSequence = event.sequence
      const { digest: _digest, sequence, ...rest } = event
      if (rest.type === 'output') {
        const { dataBase64, ...output } = rest
        const bytes = decodeExecutionBytes(dataBase64)
        summary.outputBytes += bytes.byteLength
        summary.outputEvents++
        events.push({ ...output, sequence, bytes })
      } else {
        if (rest.type === 'output-gap')
          summary.droppedBytes += rest.droppedBytes
        events.push(rest)
      }
    }
    if (
      summary.outputBytes > snapshot.events.outputBytes ||
      summary.outputEvents > snapshot.events.outputEvents ||
      summary.droppedBytes > snapshot.events.droppedBytes
    )
      throw new Error('Saved output exceeds its recorded totals.')
  }
  if (
    Object.keys(summary).some(
      (key) =>
        summary[key as keyof typeof summary] !==
        snapshot.events[key as keyof typeof summary],
    )
  )
    throw new Error('Saved output is incomplete.')
  signal.throwIfAborted()
  return {
    snapshot,
    events,
    droppedBytes: summary.droppedBytes,
    eventStatus: {
      persistedThrough: through,
      receivedThrough: through,
      pendingEvents: 0,
      loading: false,
    },
  }
}
