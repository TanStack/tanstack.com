import {
  executionBridgeErrorSchema,
  executionConnectSchema,
  executionDeliverySchema,
  executionStopDeliverySchema,
  type ExecutionBridgeFailure,
  type ExecutionCommandOutcome,
  type ExecutionDelivery,
  type ExecutionShutdownOutcome,
} from '../core/execution-bridge'
import {
  executionResultSchema,
  maxExecutionCommands,
  type ExecutionResult,
} from '../core/execution-sessions'
import { inspectProjectSnapshot } from '../core/execution-project-snapshot'
import { z } from 'zod'

export class ExecutionBridgeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ExecutionBridgeError'
  }
}

// Only an adapter which observed a terminal failure may use this class.
export class ConfirmedExecutionFailure extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ConfirmedExecutionFailure'
  }
}

export class UnknownExecutionOutcome extends Error {
  constructor(
    public readonly code = 'OUTCOME_UNKNOWN',
    message = 'The runtime did not confirm the outcome. Close it before starting new work.',
  ) {
    super(message)
    this.name = 'UnknownExecutionOutcome'
  }
}

export type ExecutionCommandAdapter = {
  execute(delivery: ExecutionDelivery): Promise<ExecutionResult>
  close(): Promise<void>
  stopCommand?(delivery: ExecutionDelivery): Promise<void>
  readSnapshot?(
    commandId: string,
    digest: string,
  ): Promise<Uint8Array<ArrayBuffer>>
}
export type ExecutionRegistryScope = {
  sessionId: string
  hostGeneration: number
  runtimeId: string
}
type Entry = {
  fingerprint: string
  delivery: ExecutionDelivery
  promise: Promise<ExecutionCommandOutcome>
  resolve(value: ExecutionCommandOutcome): void
  outcome?: ExecutionCommandOutcome
  stopWork?: Promise<void>
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${JSON.stringify(key)}:${canonical(value)}`)
      .join(',')}}`
  return JSON.stringify(value)
}
function immutable<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const part of Object.values(value)) immutable(part)
    Object.freeze(value)
  }
  return value
}
function safeFailure(error: unknown): ExecutionBridgeFailure {
  if (
    error instanceof ConfirmedExecutionFailure ||
    error instanceof UnknownExecutionOutcome
  ) {
    const parsed = executionBridgeErrorSchema.safeParse({
      code: error.code,
      message: error.message,
    })
    if (parsed.success) return parsed.data
  }
  // Raw SDK errors can contain URLs, credentials, or guest content.
  return {
    code: 'OUTCOME_UNKNOWN',
    message:
      'The runtime did not confirm the outcome. Close it before starting new work.',
  }
}
async function validateResult(delivery: ExecutionDelivery, value: unknown) {
  const parsed = executionResultSchema.safeParse(value)
  if (!parsed.success)
    throw new UnknownExecutionOutcome(
      'INVALID_RESULT',
      'The runtime returned an invalid result.',
    )
  const result = parsed.data
  const operation = delivery.operation
  if (
    result.type !== operation.type ||
    (result.type === 'save_snapshot' && result.snapshotId !== delivery.id) ||
    (result.type === 'spawn' && result.processId !== delivery.processId) ||
    (result.type === 'preview_open' &&
      result.previewId !== delivery.previewId) ||
    ('processId' in result &&
      'processId' in operation &&
      result.processId !== operation.processId) ||
    ('previewId' in result &&
      'previewId' in operation &&
      result.previewId !== operation.previewId)
  )
    throw new UnknownExecutionOutcome(
      'INVALID_RESULT',
      'The runtime result does not match this command.',
    )
  if (result.type === 'read_file' || result.type === 'write_file') {
    const text =
      result.type === 'read_file'
        ? result.text
        : operation.type === 'write_file'
          ? operation.text
          : ''
    const bytes = new TextEncoder().encode(text)
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    const sha256 = Array.from(hash, (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
    if (result.byteLength !== bytes.byteLength || result.sha256 !== sha256)
      throw new UnknownExecutionOutcome(
        'INVALID_RESULT',
        'The runtime result does not match the file bytes.',
      )
  }
  return immutable(result)
}

export class ExecutionCommandRegistry {
  private readonly scope: ExecutionRegistryScope
  private readonly entries = new Map<string, Entry>()
  private ordinaryId?: string
  private readonly stopping = new Set<string>()
  private uncertain = false
  private closing = false
  private closeEntry?: Entry
  private shutdownPromise?: Promise<ExecutionShutdownOutcome>

  get isClosing() {
    return this.closing
  }

  stopCommand(value: unknown): Promise<ExecutionCommandOutcome> {
    const parsed = executionStopDeliverySchema.safeParse(value)
    if (!parsed.success)
      return Promise.reject(
        new ExecutionBridgeError(
          'INVALID_STOP',
          'This stop control does not match a stopped model command.',
        ),
      )
    return this.execute(parsed.data)
  }

  private settle(entry: Entry, outcome: ExecutionCommandOutcome) {
    if (entry.outcome) return
    entry.outcome = immutable(outcome)
    if (this.ordinaryId === entry.delivery.id) this.ordinaryId = undefined
    entry.resolve(entry.outcome)
  }

  private requestStop(entry: Entry, delivery: ExecutionDelivery) {
    if (entry.outcome || entry.stopWork || this.closing) return
    if (!this.adapter.stopCommand) {
      this.uncertain = true
      this.settle(entry, {
        commandId: delivery.id,
        digest: delivery.digest,
        outcome: 'unknown',
        error: {
          code: 'STOP_UNAVAILABLE',
          message: 'The runtime could not confirm this command stopped.',
        },
      })
      return
    }
    // Set the marker before invoking adapter code, including synchronous callbacks.
    let resolve!: () => void, reject!: (error: unknown) => void
    entry.stopWork = new Promise<void>((yes, no) => {
      resolve = yes
      reject = no
    })
    void entry.stopWork.catch((error) => {
      this.uncertain = true
      this.settle(entry, {
        commandId: delivery.id,
        digest: delivery.digest,
        outcome: 'unknown',
        error: safeFailure(error),
      })
    })
    try {
      Promise.resolve(this.adapter.stopCommand(delivery)).then(resolve, reject)
    } catch (error) {
      reject(error)
    }
  }

  async readSnapshot(
    commandId: string,
    digest: string,
  ): Promise<Uint8Array<ArrayBuffer>> {
    const entry = this.entries.get(commandId)
    if (
      !entry ||
      entry.delivery.digest !== digest ||
      entry.delivery.operation.type !== 'save_snapshot' ||
      this.closing ||
      this.uncertain ||
      !this.adapter.readSnapshot
    )
      throw new ExecutionBridgeError(
        'SNAPSHOT_UNAVAILABLE',
        'This runtime has no confirmed snapshot for this command.',
      )
    const outcome = await entry.promise
    if (
      outcome.outcome !== 'succeeded' ||
      outcome.result.type !== 'save_snapshot' ||
      this.closing ||
      this.uncertain
    )
      throw new ExecutionBridgeError(
        'SNAPSHOT_UNAVAILABLE',
        'This runtime has no confirmed snapshot for this command.',
      )
    const result = outcome.result
    const bytes = await this.adapter.readSnapshot(commandId, digest)
    const metadata = await inspectProjectSnapshot(bytes)
    if (
      this.closing ||
      this.uncertain ||
      Object.entries(metadata).some(
        ([key, value]) => result[key as keyof typeof result] !== value,
      )
    )
      throw new ExecutionBridgeError(
        'SNAPSHOT_UNAVAILABLE',
        'The retained snapshot does not match this command.',
      )
    return bytes
  }

  constructor(
    scope: ExecutionRegistryScope,
    private readonly adapter: ExecutionCommandAdapter,
  ) {
    this.scope = immutable(
      z
        .object({
          sessionId: executionConnectSchema.shape.sessionId,
          hostGeneration: executionConnectSchema.shape.hostGeneration,
          runtimeId: executionConnectSchema.shape.runtimeId,
        })
        .strict()
        .parse(scope),
    )
  }

  execute(value: unknown): Promise<ExecutionCommandOutcome> {
    try {
      const parsed = executionDeliverySchema.safeParse(value)
      if (!parsed.success)
        throw new ExecutionBridgeError(
          'INVALID_DELIVERY',
          'The command is not a valid committed delivery.',
        )
      const delivery = immutable(parsed.data)
      if (
        delivery.sessionId !== this.scope.sessionId ||
        delivery.hostGeneration !== this.scope.hostGeneration ||
        delivery.runtimeId !== this.scope.runtimeId
      )
        throw new ExecutionBridgeError(
          'WRONG_RUNTIME',
          'This command belongs to another runtime.',
        )
      // The server digest is opaque here. Bind every immutable delivered field as
      // well, so a forged same-digest payload cannot reuse a registered command.
      const {
        state: _state,
        stopRequested: _stopRequested,
        ...fixed
      } = delivery
      const fingerprint = canonical(fixed)
      const existing = this.entries.get(delivery.id)
      if (existing) {
        if (existing.fingerprint !== fingerprint)
          throw new ExecutionBridgeError(
            'COMMAND_CONFLICT',
            'This command was already registered with different contents.',
          )
        if (delivery.stopRequested && delivery.origin.kind === 'run')
          this.requestStop(existing, delivery)
        return existing.promise
      }
      const operation = delivery.operation
      const isClose = operation.type === 'close'
      const isStop = operation.type === 'stop_process'
      if (this.closing)
        throw new ExecutionBridgeError(
          'RUNTIME_CLOSING',
          'The runtime is closing and cannot accept another command.',
        )
      if (this.uncertain && !isClose)
        throw new ExecutionBridgeError(
          'OUTCOME_UNKNOWN',
          'Close this runtime before starting more work.',
        )
      const cancelledBeforeStart =
        delivery.stopRequested && delivery.origin.kind === 'run'
      if (!cancelledBeforeStart && !isClose && !isStop && this.ordinaryId)
        throw new ExecutionBridgeError(
          'COMMAND_IN_FLIGHT',
          'Another operation is still running.',
        )
      if (isStop && this.stopping.has(operation.processId))
        throw new ExecutionBridgeError(
          'STOP_ALREADY_REGISTERED',
          'A stop command is already registered for this process.',
        )
      // Match the ledger's reserved control capacity. No entry is ever evicted.
      const limit = isClose
        ? maxExecutionCommands
        : isStop
          ? maxExecutionCommands - 1
          : maxExecutionCommands - 2
      if (this.entries.size >= limit)
        throw new ExecutionBridgeError(
          'COMMAND_LIMIT',
          'The runtime command limit has been reached. Close this runtime.',
        )

      let resolve!: (value: ExecutionCommandOutcome) => void
      const promise = new Promise<ExecutionCommandOutcome>((done) => {
        resolve = done
      })
      const entry: Entry = { delivery, fingerprint, promise, resolve }
      this.entries.set(delivery.id, entry)
      if (cancelledBeforeStart) {
        this.settle(entry, {
          commandId: delivery.id,
          digest: delivery.digest,
          outcome: 'failed',
          error: {
            code: 'COMMAND_CANCELLED_BEFORE_START',
            message:
              'The command was cancelled before this runtime started it.',
          },
        })
        return promise
      }
      if (isClose) {
        this.closing = true
        this.closeEntry = entry
      } else if (isStop) this.stopping.add(operation.processId)
      else this.ordinaryId = delivery.id
      // Registration and fencing above happen before even synchronous adapter code.
      void this.invoke(entry).then((outcome) => this.settle(entry, outcome))
      return promise
    } catch (error) {
      return Promise.reject(error)
    }
  }

  private async invoke(entry: Entry): Promise<ExecutionCommandOutcome> {
    const delivery = entry.delivery
    const identity = { commandId: delivery.id, digest: delivery.digest }
    try {
      const result = await validateResult(
        delivery,
        await this.adapter.execute(delivery),
      )
      if (entry.stopWork) await entry.stopWork
      if (this.closing && delivery.operation.type !== 'close')
        throw new UnknownExecutionOutcome(
          'CLOSED_DURING_OPERATION',
          'Shutdown began before this operation was confirmed.',
        )
      return { ...identity, outcome: 'succeeded', result }
    } catch (error) {
      const failure = safeFailure(error)
      if (
        error instanceof ConfirmedExecutionFailure &&
        executionBridgeErrorSchema.safeParse({
          code: error.code,
          message: error.message,
        }).success
      )
        return { ...identity, outcome: 'failed', error: failure }
      this.uncertain = true
      return { ...identity, outcome: 'unknown', error: failure }
    }
  }

  shutdown(): Promise<ExecutionShutdownOutcome> {
    if (this.shutdownPromise) return this.shutdownPromise
    this.closing = true
    // Retain the first close outcome. Retrying once-only SDK cleanup can hide a
    // previous rejection by returning success without repeating the cleanup.
    if (this.closeEntry) {
      this.shutdownPromise = this.closeEntry.promise.then((outcome) =>
        immutable(
          outcome.outcome === 'succeeded'
            ? { confirmed: true as const }
            : { confirmed: false as const, error: outcome.error },
        ),
      )
    } else {
      let resolve!: (value: ExecutionShutdownOutcome) => void
      this.shutdownPromise = new Promise((done) => {
        resolve = done
      })
      void (async () => {
        try {
          await this.adapter.close()
          resolve(immutable({ confirmed: true }))
        } catch (error) {
          this.uncertain = true
          resolve(immutable({ confirmed: false, error: safeFailure(error) }))
        }
      })()
    }
    return this.shutdownPromise
  }
}
