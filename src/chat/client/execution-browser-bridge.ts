import {
  executionBridgeResponseSchema,
  executionConnectSchema,
  executionDeliverySchema,
  executionStopDeliverySchema,
  maxExecutionOutputChunkBytes,
  type ExecutionBridgeConnect,
  type ExecutionBridgeFailure,
  type ExecutionBridgeResponse,
  type ExecutionCommandOutcome,
  type ExecutionDelivery,
  type ExecutionShutdownOutcome,
} from '../core/execution-bridge'
import {
  browserExecutionRuntime,
  maxExecutionCommands,
} from '../core/execution-sessions'
import {
  ExecutionBridgeError,
  UnknownExecutionOutcome,
} from './execution-command-registry'
import { maxProjectSnapshotBytes } from '../core/execution-project-snapshot'

export type ExecutionHostEvent = Extract<
  ExecutionBridgeResponse,
  {
    type: 'output' | 'output-gap' | 'process-exit' | 'fault'
  }
>
export type ExecutionPreviewBounds = {
  left: number
  top: number
  width: number
  height: number
  clip: { top: number; right: number; bottom: number; left: number }
}
export interface ExecutionHostBridge {
  readonly runtime: typeof browserExecutionRuntime
  /** Presentation only. The authenticated owner separately validates the preview. */
  setPreviewViewport(bounds: ExecutionPreviewBounds | null): boolean
  execute(delivery: ExecutionDelivery): Promise<ExecutionCommandOutcome>
  stopCommand(delivery: ExecutionDelivery): Promise<ExecutionCommandOutcome>
  readSnapshot(
    commandId: string,
    digest: string,
  ): Promise<Uint8Array<ArrayBuffer>>
  shutdown(): Promise<ExecutionShutdownOutcome>
  dispose(): void
}

const ownerOrigin = 'http://127.0.0.1:3002'
const brokerOrigin = 'http://127.0.0.1:4320'
const setupTimeoutMs = 45_000
const operationTimeoutMs = 45_000
const shutdownTimeoutMs = 35_000
const failure = (code: string, message: string): ExecutionBridgeFailure => ({
  code,
  message,
})

// Bound traversal before passing untrusted structured-clone data to Zod. A tiny
// view of a huge backing buffer is not a bounded output chunk.
function bounded(value: unknown, snapshot = true): boolean {
  if (
    snapshot &&
    value &&
    typeof value === 'object' &&
    'type' in value &&
    value.type === 'snapshot_data'
  ) {
    const { bytes, ...envelope } = value as Record<string, unknown>
    return (
      bytes instanceof Uint8Array &&
      bytes.buffer instanceof ArrayBuffer &&
      bytes.byteLength > 0 &&
      bytes.buffer.byteLength <= maxProjectSnapshotBytes &&
      bounded(envelope, false)
    )
  }
  let remaining = 32_768
  let nodes = 256
  const visit = (part: unknown, depth: number): boolean => {
    if (--nodes < 0 || depth > 12) return false
    if (part instanceof Uint8Array) {
      if (
        !(part.buffer instanceof ArrayBuffer) ||
        part.buffer.byteLength > maxExecutionOutputChunkBytes
      )
        return false
      remaining -= part.byteLength
    } else if (typeof part === 'string') {
      if (part.length > remaining) return false
      remaining -= new TextEncoder().encode(part).byteLength
    } else if (part === null || typeof part === 'boolean') remaining -= 4
    else if (typeof part === 'number') {
      if (!Number.isFinite(part)) return false
      remaining -= 8
    } else if (typeof part === 'object') {
      const prototype = Object.getPrototypeOf(part)
      if (
        prototype !== Object.prototype &&
        prototype !== Array.prototype &&
        prototype !== null
      )
        return false
      const entries = Object.entries(part)
      if (entries.length > 64) return false
      for (const [key, child] of entries) {
        remaining -= key.length
        if (remaining < 0 || !visit(child, depth + 1)) return false
      }
    } else return false
    return remaining >= 0
  }
  return visit(value, 0)
}
function fingerprint(delivery: ExecutionDelivery) {
  const { state: _state, stopRequested: _stopRequested, ...fixed } = delivery
  // Zod emits a fixed property order for these closed object schemas.
  return JSON.stringify(fixed)
}
function matchesResult(
  delivery: ExecutionDelivery,
  outcome: ExecutionCommandOutcome,
) {
  if (outcome.commandId !== delivery.id || outcome.digest !== delivery.digest)
    return false
  if (outcome.outcome !== 'succeeded') return true
  const { result } = outcome
  const operation = delivery.operation
  return (
    result.type === operation.type &&
    !(result.type === 'save_snapshot' && result.snapshotId !== delivery.id) &&
    !(result.type === 'spawn' && result.processId !== delivery.processId) &&
    !(
      result.type === 'preview_open' && result.previewId !== delivery.previewId
    ) &&
    !(
      'processId' in result &&
      'processId' in operation &&
      result.processId !== operation.processId
    ) &&
    !(
      'previewId' in result &&
      'previewId' in operation &&
      result.previewId !== operation.previewId
    )
  )
}
type ExecuteCall = {
  kind: 'execute'
  delivery: ExecutionDelivery
  fingerprint: string
  promise: Promise<ExecutionCommandOutcome>
  resolve(value: ExecutionCommandOutcome): void
  settled: boolean
  stopSent?: boolean
  timer?: ReturnType<typeof setTimeout>
}
type ShutdownCall = {
  kind: 'shutdown'
  promise: Promise<ExecutionShutdownOutcome>
  resolve(value: ExecutionShutdownOutcome): void
  settled: boolean
  timer?: ReturnType<typeof setTimeout>
}
type SnapshotCall = {
  kind: 'snapshot'
  commandId: string
  digest: string
  promise: Promise<Uint8Array<ArrayBuffer>>
  resolve(value: Uint8Array<ArrayBuffer>): void
  reject(error: Error): void
  settled: boolean
  timer?: ReturnType<typeof setTimeout>
}

/** One bridge belongs to one owner implementation and is never hot-swapped. */
export async function openExecutionBrowserBridge(
  value: ExecutionBridgeConnect,
  onEvent: (event: ExecutionHostEvent) => void,
  signal: AbortSignal,
  container: HTMLElement,
): Promise<ExecutionHostBridge> {
  if (!import.meta.env.DEV || window.location.origin !== ownerOrigin)
    throw new ExecutionBridgeError(
      'HOST_UNAVAILABLE',
      'Local execution is unavailable in this environment.',
    )
  const connect = executionConnectSchema.parse(value)
  if (signal.aborted)
    throw new ExecutionBridgeError(
      'SETUP_ABORTED',
      'Runtime setup was cancelled before it started.',
    )
  const frame = document.createElement('iframe')
  if (!('credentialless' in frame))
    throw new ExecutionBridgeError(
      'CREDENTIALLESS_UNAVAILABLE',
      'This browser does not support credentialless execution.',
    )
  ;(frame as HTMLIFrameElement & { credentialless: boolean }).credentialless =
    true
  frame.title = 'Local execution runtime'
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin')
  frame.referrerPolicy = 'no-referrer'
  frame.style.width = '1024px'
  frame.style.height = '768px'
  frame.style.border = '0'
  frame.style.position = 'fixed'
  frame.style.zIndex = '1'
  const present = (bounds: ExecutionPreviewBounds | null) => {
    const valid =
      bounds &&
      [
        bounds.left,
        bounds.top,
        bounds.width,
        bounds.height,
        ...Object.values(bounds.clip),
      ].every(Number.isFinite) &&
      bounds.width > 0 &&
      bounds.height > 0 &&
      bounds.width <= 32_768 &&
      bounds.height <= 32_768 &&
      Object.values(bounds.clip).every((value) => value >= 0) &&
      bounds.clip.left + bounds.clip.right < bounds.width &&
      bounds.clip.top + bounds.clip.bottom < bounds.height &&
      (!document.fullscreenElement ||
        document.fullscreenElement.contains(frame))
    frame.inert = !valid
    frame.title = valid ? 'Workspace preview' : 'Local execution runtime'
    frame.tabIndex = valid ? 0 : -1
    frame.setAttribute('aria-hidden', valid ? 'false' : 'true')
    Object.assign(
      frame.style,
      valid
        ? {
            left: `${bounds.left}px`,
            top: `${bounds.top}px`,
            width: `${bounds.width}px`,
            height: `${bounds.height}px`,
            clipPath: `inset(${bounds.clip.top}px ${bounds.clip.right}px ${bounds.clip.bottom}px ${bounds.clip.left}px)`,
            visibility: 'visible',
            pointerEvents: 'auto',
          }
        : {
            left: '-10000px',
            top: '0',
            clipPath: 'none',
            visibility: 'hidden',
            pointerEvents: 'none',
          },
    )
    return !!valid
  }
  present(null)
  const channel = new MessageChannel()
  const requests = new Map<string, ExecuteCall | ShutdownCall | SnapshotCall>()
  const commands = new Map<string, ExecuteCall>()
  let shutdownCall: ShutdownCall | undefined
  let runtime = structuredClone(browserExecutionRuntime)
  let ready = false
  let transferred = false
  let disposed = false
  let fenced = false
  let closing = false
  let faultReported = false
  let lastSequence = 0
  let resolveSetup!: (bridge: ExecutionHostBridge) => void
  let rejectSetup!: (error: unknown) => void
  const opening = new Promise<ExecutionHostBridge>((resolve, reject) => {
    resolveSetup = resolve
    rejectSetup = reject
  })

  const settle = (
    call: ExecuteCall | ShutdownCall | SnapshotCall,
    error: ExecutionBridgeFailure,
  ) => {
    if (call.settled) return
    call.settled = true
    clearTimeout(call.timer)
    if (call.kind === 'execute')
      call.resolve({
        commandId: call.delivery.id,
        digest: call.delivery.digest,
        outcome: 'unknown',
        error,
      })
    else if (call.kind === 'snapshot')
      call.reject(new ExecutionBridgeError(error.code, error.message))
    else call.resolve({ confirmed: false, error })
  }
  const emit = (event: ExecutionHostEvent) => {
    try {
      onEvent(event)
    } catch {
      fence(
        failure(
          'OBSERVER_FAILED',
          'Execution evidence could not be delivered to its owner.',
        ),
      )
    }
  }
  const fence = (error: ExecutionBridgeFailure) => {
    fenced = true
    present(null)
    for (const call of requests.values())
      if (call.kind !== 'shutdown') settle(call, error)
    if (!ready) {
      clearTimeout(setupTimer)
      rejectSetup(new UnknownExecutionOutcome(error.code, error.message))
      dispose()
    }
    if (!faultReported) {
      faultReported = true
      emit({ type: 'fault', error })
    }
  }
  const dispose = () => {
    if (disposed) return
    disposed = true
    fenced = true
    present(null)
    clearTimeout(setupTimer)
    const error = failure(
      'BRIDGE_DISPOSED',
      'The browser connection closed without confirming this operation.',
    )
    for (const call of requests.values()) settle(call, error)
    if (!ready)
      rejectSetup(new UnknownExecutionOutcome(error.code, error.message))
    signal.removeEventListener('abort', abort)
    frame.removeEventListener('load', loaded)
    frame.removeEventListener('error', loadFailed)
    channel.port1.onmessage = null
    channel.port1.onmessageerror = null
    channel.port1.close()
    channel.port2.close()
    frame.remove()
  }
  const send = (message: unknown) => {
    try {
      channel.port1.postMessage(message)
      return true
    } catch {
      fence(
        failure(
          'BRIDGE_SEND_FAILED',
          'The runtime did not receive a confirmed request.',
        ),
      )
      return false
    }
  }
  const shutdown = (): Promise<ExecutionShutdownOutcome> => {
    if (shutdownCall) return shutdownCall.promise
    closing = true
    present(null)
    let resolve!: (value: ExecutionShutdownOutcome) => void
    const promise = new Promise<ExecutionShutdownOutcome>((done) => {
      resolve = done
    })
    shutdownCall = { kind: 'shutdown', promise, resolve, settled: false }
    if (disposed || !ready) {
      settle(
        shutdownCall,
        failure(
          'SHUTDOWN_UNAVAILABLE',
          'Runtime shutdown could not be confirmed.',
        ),
      )
      return promise
    }
    const requestId = crypto.randomUUID()
    requests.set(requestId, shutdownCall)
    shutdownCall.timer = setTimeout(() => {
      settle(
        shutdownCall!,
        failure(
          'SHUTDOWN_TIMEOUT',
          'Runtime shutdown did not finish within the time limit.',
        ),
      )
    }, shutdownTimeoutMs)
    if (!send({ type: 'shutdown', requestId }))
      settle(
        shutdownCall,
        failure(
          'SHUTDOWN_UNAVAILABLE',
          'Runtime shutdown could not be confirmed.',
        ),
      )
    return promise
  }
  const execute = (
    input: ExecutionDelivery,
    stop = false,
  ): Promise<ExecutionCommandOutcome> => {
    const parsed = executionDeliverySchema.safeParse(input)
    if (!parsed.success)
      return Promise.reject(
        new ExecutionBridgeError(
          'INVALID_DELIVERY',
          'The execution delivery is invalid.',
        ),
      )
    const delivery = parsed.data
    if (
      delivery.sessionId !== connect.sessionId ||
      delivery.runtimeId !== connect.runtimeId ||
      delivery.hostGeneration !== connect.hostGeneration
    )
      return Promise.reject(
        new ExecutionBridgeError(
          'WRONG_RUNTIME',
          'This command belongs to another runtime.',
        ),
      )
    const key = fingerprint(delivery)
    const previous = commands.get(delivery.id)
    if (previous) {
      if (previous.fingerprint !== key)
        return Promise.reject(
          new ExecutionBridgeError(
            'COMMAND_CONFLICT',
            'This command was already delivered with different contents.',
          ),
        )
      if (
        stop &&
        !previous.stopSent &&
        !previous.settled &&
        !disposed &&
        !fenced &&
        !closing
      ) {
        previous.stopSent = true
        const requestId = crypto.randomUUID()
        requests.set(requestId, previous)
        send({ type: 'stop_command', requestId, delivery })
      }
      return previous.promise
    }
    if (
      disposed ||
      !ready ||
      closing ||
      (fenced && delivery.operation.type !== 'close')
    )
      return Promise.reject(
        new ExecutionBridgeError(
          'BRIDGE_FENCED',
          'This runtime cannot accept new work.',
        ),
      )
    if (
      commands.size >= maxExecutionCommands ||
      [...requests.values()].filter((call) => !call.settled).length >=
        maxExecutionCommands - 1
    )
      return Promise.reject(
        new ExecutionBridgeError(
          'COMMAND_LIMIT',
          'The runtime command limit has been reached.',
        ),
      )
    const requestId = crypto.randomUUID()
    let resolve!: (value: ExecutionCommandOutcome) => void
    const promise = new Promise<ExecutionCommandOutcome>((done) => {
      resolve = done
    })
    const call: ExecuteCall = {
      kind: 'execute',
      delivery,
      fingerprint: key,
      promise,
      resolve,
      settled: false,
      stopSent: stop,
    }
    commands.set(delivery.id, call)
    requests.set(requestId, call)
    if (delivery.operation.type === 'close') {
      closing = true
      present(null)
    }
    call.timer = setTimeout(() => {
      const error = failure(
        'COMMAND_TIMEOUT',
        'The runtime did not confirm this command within the time limit.',
      )
      settle(call, error)
      fence(error)
    }, operationTimeoutMs)
    send({ type: stop ? 'stop_command' : 'execute', requestId, delivery })
    return promise
  }
  const bridge: ExecutionHostBridge = {
    get runtime() {
      return runtime
    },
    setPreviewViewport(bounds) {
      return present(disposed || !ready || fenced || closing ? null : bounds)
    },
    execute: (input) => execute(input),
    stopCommand(input) {
      const parsed = executionStopDeliverySchema.safeParse(input)
      if (!parsed.success)
        return Promise.reject(
          new ExecutionBridgeError(
            'INVALID_STOP',
            'This stop control does not match a stopped model command.',
          ),
        )
      return execute(parsed.data, true)
    },
    readSnapshot(commandId, digest) {
      const command = commands.get(commandId)
      if (
        disposed ||
        fenced ||
        closing ||
        !ready ||
        !command ||
        !command.settled ||
        command.delivery.operation.type !== 'save_snapshot' ||
        command.delivery.digest !== digest
      )
        return Promise.reject(
          new ExecutionBridgeError(
            'SNAPSHOT_UNAVAILABLE',
            'This runtime has no confirmed snapshot for this command.',
          ),
        )
      if (
        [...requests.values()].some(
          (call) => call.kind === 'snapshot' && !call.settled,
        )
      )
        return Promise.reject(
          new ExecutionBridgeError(
            'SNAPSHOT_PENDING',
            'Wait for the current snapshot transfer.',
          ),
        )
      let resolve!: SnapshotCall['resolve'], reject!: SnapshotCall['reject']
      const promise = new Promise<Uint8Array<ArrayBuffer>>((yes, no) => {
        resolve = yes
        reject = no
      })
      const call: SnapshotCall = {
        kind: 'snapshot',
        commandId,
        digest,
        promise,
        resolve,
        reject,
        settled: false,
      }
      const requestId = crypto.randomUUID()
      requests.set(requestId, call)
      call.timer = setTimeout(
        () =>
          settle(
            call,
            failure(
              'SNAPSHOT_TIMEOUT',
              'The saved project could not be transferred within the time limit.',
            ),
          ),
        operationTimeoutMs,
      )
      send({ type: 'read_snapshot', requestId, commandId, digest })
      void promise.finally(() => requests.delete(requestId)).catch(() => {})
      return promise
    },
    shutdown,
    dispose,
  }

  const invalid = () =>
    fence(
      failure(
        'INVALID_RESPONSE',
        'The runtime sent invalid or mismatched execution evidence.',
      ),
    )
  channel.port1.onmessage = (event) => {
    if (disposed) return
    if (!bounded(event.data)) {
      invalid()
      return
    }
    const parsed = executionBridgeResponseSchema.safeParse(event.data)
    if (!parsed.success) {
      invalid()
      return
    }
    const response = parsed.data
    if (response.type === 'ready') {
      if (
        ready ||
        response.nonce !== connect.nonce ||
        response.runtime.capabilities.length !==
          browserExecutionRuntime.capabilities.length ||
        browserExecutionRuntime.capabilities.some(
          (item) => !response.runtime.capabilities.includes(item),
        )
      ) {
        invalid()
        return
      }
      ready = true
      runtime = response.runtime
      clearTimeout(setupTimer)
      resolveSetup(bridge)
      return
    }
    if (!ready) {
      invalid()
      return
    }
    if (response.type === 'fault') {
      fence(response.error)
      return
    }
    if (
      response.type === 'output' ||
      response.type === 'output-gap' ||
      response.type === 'process-exit'
    ) {
      const call = commands.get(response.commandId)
      if (
        !call ||
        !['run', 'spawn'].includes(call.delivery.operation.type) ||
        response.processId !== call.delivery.processId
      ) {
        invalid()
        return
      }
      if (response.type === 'output') {
        if (response.sequence !== lastSequence + 1) {
          invalid()
          return
        }
        lastSequence = response.sequence
      }
      emit(response)
      return
    }
    const call = requests.get(response.requestId)
    if (!call) {
      invalid()
      return
    }
    if (response.type === 'rejected') {
      if (call.settled) return
      settle(call, response.error)
      fence(response.error)
      return
    }
    if (response.type === 'shutdown-result') {
      if (call.kind !== 'shutdown') {
        invalid()
        return
      }
      if (call.settled) return
      call.settled = true
      clearTimeout(call.timer)
      call.resolve(
        response.confirmed
          ? { confirmed: true }
          : { confirmed: false, error: response.error },
      )
      return
    }
    if (response.type === 'snapshot_data') {
      if (
        call.kind !== 'snapshot' ||
        response.commandId !== call.commandId ||
        response.digest !== call.digest
      ) {
        invalid()
        return
      }
      if (call.settled) return
      call.settled = true
      clearTimeout(call.timer)
      call.resolve(response.bytes)
      return
    }
    if (call.kind !== 'execute' || !matchesResult(call.delivery, response)) {
      invalid()
      return
    }
    if (call.settled) return
    call.settled = true
    clearTimeout(call.timer)
    const { type: _type, requestId: _requestId, ...outcome } = response
    call.resolve(outcome)
    if (outcome.outcome === 'unknown') {
      const interruptedByClose =
        closing &&
        call.delivery.operation.type !== 'close' &&
        ['CLOSED_DURING_OPERATION', 'runtime_closing'].includes(
          outcome.error.code,
        )
      if (!interruptedByClose) fence(outcome.error)
    }
  }
  channel.port1.onmessageerror = () =>
    fence(
      failure('MESSAGE_UNREADABLE', 'The runtime response could not be read.'),
    )
  channel.port1.start()
  const loaded = () => {
    if (transferred) {
      invalid()
      return
    }
    if (disposed || signal.aborted) return
    transferred = true
    try {
      if (!frame.contentWindow) throw new Error('Missing frame window')
      frame.contentWindow.postMessage(connect, brokerOrigin, [
        channel.port2,
        ...(connect.snapshotBytes
          ? [connect.snapshotBytes.buffer as ArrayBuffer]
          : []),
      ])
    } catch {
      fence(
        failure(
          'SETUP_UNKNOWN',
          'Runtime setup did not complete. Cleanup is not confirmed.',
        ),
      )
    }
  }
  const loadFailed = () =>
    fence(
      failure(
        'SETUP_UNKNOWN',
        'The local execution host could not be loaded. Cleanup is not confirmed.',
      ),
    )
  const abort = () => {
    if (!ready) {
      fence(
        failure(
          'SETUP_ABORTED',
          'Runtime setup was interrupted. Cleanup is not confirmed.',
        ),
      )
      return
    }
    fence(
      failure(
        'OWNER_ABORTED',
        'The execution owner stopped waiting for this runtime.',
      ),
    )
    void shutdown().finally(dispose)
  }
  frame.addEventListener('load', loaded)
  frame.addEventListener('error', loadFailed)
  signal.addEventListener('abort', abort, { once: true })
  const setupTimer = setTimeout(
    () =>
      fence(
        failure(
          'SETUP_TIMEOUT',
          'Runtime setup did not finish within the time limit. Cleanup is not confirmed.',
        ),
      ),
    setupTimeoutMs,
  )
  frame.src = `${brokerOrigin}/gum-broker.html?nonce=${encodeURIComponent(connect.nonce)}`
  container.append(frame)
  return opening
}
