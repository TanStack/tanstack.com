import { LoadingState } from './ui/LoadingState'
import { useMemo } from 'react'
import type { ExecutionHostEvent } from '../client/execution-browser-bridge'
import type { ExecutionOwnerView } from '../client/execution-owner'
import type {
  ExecutionOperation,
  ExecutionReceipt,
  ExecutionSessionSnapshot,
} from '../core/execution-sessions'

type OutputPart = {
  key: string
  commandId: string
  stream: 'stdout' | 'stderr'
  text: string
}

/** Each command and stream has its own decoder. Pending UTF-8 bytes are flushed
 * only when observed process completion or a confirmed run receipt proves EOF. */
export function decodeExecutionOutput(
  events: readonly ExecutionHostEvent[],
  completedCommands: ReadonlySet<string> = new Set(),
): OutputPart[] {
  const decoders = new Map<
    string,
    { decoder: TextDecoder; commandId: string; stream: 'stdout' | 'stderr' }
  >()
  const output: OutputPart[] = []
  const append = (
    commandId: string,
    stream: 'stdout' | 'stderr',
    text: string,
    key: string,
  ) => {
    if (!text) return
    const previous = output.at(-1)
    if (previous?.commandId === commandId && previous.stream === stream)
      previous.text += text
    else output.push({ key, commandId, stream, text })
  }
  const finish = (commandId: string) => {
    for (const [key, entry] of decoders) {
      if (entry.commandId !== commandId) continue
      append(commandId, entry.stream, entry.decoder.decode(), `end:${key}`)
      decoders.delete(key)
    }
  }
  for (const event of events) {
    if (event.type === 'process-exit') {
      finish(event.commandId)
      continue
    }
    if (event.type === 'output-gap') {
      // Missing bytes invalidate pending code points. The panel reports the
      // recorded gap; never splice bytes from opposite sides into one character.
      for (const [key, entry] of decoders)
        if (entry.commandId === event.commandId) decoders.delete(key)
      continue
    }
    if (event.type !== 'output') continue
    const key = JSON.stringify([
      event.commandId,
      event.processId ?? null,
      event.stream,
    ])
    let entry = decoders.get(key)
    if (!entry) {
      entry = {
        commandId: event.commandId,
        stream: event.stream,
        decoder: new TextDecoder('utf-8', { fatal: false, ignoreBOM: true }),
      }
      decoders.set(key, entry)
    }
    append(
      event.commandId,
      event.stream,
      entry.decoder.decode(event.bytes, { stream: true }),
      `${event.commandId}:${event.sequence}`,
    )
  }
  for (const commandId of completedCommands) finish(commandId)
  return output
}

const operationNames: Record<ExecutionOperation['type'], string> = {
  read_file: 'Read file',
  write_file: 'Write file',
  run: 'Run',
  spawn: 'Start process',
  stop_process: 'Stop process',
  close: 'Close workspace',
  preview_open: 'Open preview',
  preview_inspect: 'Inspect preview',
  preview_click: 'Click preview element',
  preview_close: 'Close preview',
  save_snapshot: 'Save snapshot',
}
function shortId(id: string) {
  return id.slice(0, 8)
}
function receiptTitle(receipt: ExecutionReceipt) {
  const operation = receipt.operation
  const name = operationNames[operation.type]
  return 'path' in operation && operation.type !== 'preview_open'
    ? `${name}: ${operation.path}`
    : name
}
function receiptStatus(receipt: ExecutionReceipt) {
  if (receipt.state === 'succeeded' && receipt.result?.type === 'run') {
    if (receipt.result.signal) return `Stopped: ${receipt.result.signal}`
    if (receipt.result.exitCode !== null)
      return `Exit ${receipt.result.exitCode}`
  }
  return receipt.state
}

export type ExecutionEvidenceData = {
  snapshot: ExecutionSessionSnapshot | null
  events: readonly ExecutionHostEvent[]
  droppedBytes: number
  eventStatus: ExecutionOwnerView['eventStatus']
  deliveryObservations?: Readonly<Record<string, number>>
}
export function ExecutionEvidence({
  evidence,
}: {
  evidence: ExecutionEvidenceData
}) {
  const receipts = evidence.snapshot?.commands ?? []
  const session = evidence.snapshot?.session
  const finished = useMemo(
    () =>
      new Set(
        receipts
          .filter(
            (item) =>
              item.operation.type === 'run' &&
              item.state === 'succeeded' &&
              item.result?.type === 'run' &&
              item.eventsThrough !== undefined &&
              item.eventsThrough <= evidence.eventStatus.receivedThrough,
          )
          .map((item) => item.id),
      ),
    [receipts, evidence.eventStatus.receivedThrough],
  )
  const output = useMemo(
    () => decodeExecutionOutput(evidence.events, finished),
    [evidence.events, finished],
  )
  return (
    <>
      {(output.length > 0 ||
        Boolean(evidence.droppedBytes) ||
        evidence.eventStatus.loading ||
        evidence.eventStatus.error ||
        Boolean(evidence.eventStatus.pendingEvents)) && (
        <section aria-label="Process output">
          <h4>Output</h4>
          {evidence.eventStatus.loading && (
            <LoadingState>Loading saved output…</LoadingState>
          )}
          {Boolean(evidence.eventStatus.pendingEvents) && (
            <small role="status">
              {evidence.eventStatus.error
                ? 'Some output has not been saved.'
                : 'Saving output…'}
            </small>
          )}
          {evidence.eventStatus.error && (
            <p role="alert">{evidence.eventStatus.error}</p>
          )}
          {Boolean(evidence.droppedBytes) && (
            <p>
              {evidence.droppedBytes.toLocaleString()} output bytes were not
              retained.
            </p>
          )}
          <div className="execution-panel-output">
            {output.map((part) => (
              <div key={part.key}>
                <small>
                  {part.stream} · {shortId(part.commandId)}
                </small>
                <pre>{part.text}</pre>
              </div>
            ))}
          </div>
        </section>
      )}

      {receipts.length > 0 && (
        <section aria-label="Execution receipts">
          <h4>Receipts</h4>
          {receipts.map((receipt) => (
            <details className="execution-panel-receipt" key={receipt.id}>
              <summary>
                <span>{receiptTitle(receipt)}</span>
                <span>{receiptStatus(receipt)}</span>
              </summary>
              <pre>
                {JSON.stringify(
                  {
                    ...receipt,
                    ...(evidence.deliveryObservations
                      ? {
                          deliveryObservations:
                            evidence.deliveryObservations[receipt.id] ?? 0,
                        }
                      : {}),
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          ))}
        </section>
      )}
      {session && (
        <details className="execution-panel-receipt">
          <summary>Session details</summary>
          <pre>{JSON.stringify(session, null, 2)}</pre>
        </details>
      )}
    </>
  )
}
