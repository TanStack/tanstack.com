import {
  browserExecutionRuntime,
  executionLeaseMs,
  executionOperationSchema,
  type ExecutionIdentity,
  type ExecutionOperation,
  type ExecutionSessionCommand,
  type ExecutionSessionSnapshot,
} from '../core/execution-sessions'
import {
  executionDeliverySchema,
  type ExecutionBridgeConnect,
  type ExecutionCommandOutcome,
  type ExecutionDelivery,
} from '../core/execution-bridge'
import { createExecutionHttp, ExecutionHttpError } from './execution-http'
import { parseExecutionSnapshot } from '../core/execution-snapshot'
import { openExecutionPreview } from '../core/execution-preview'
import {
  decodeExecutionBytes,
  encodeExecutionBytes,
  executionEventPageSchema,
  executionEventSchema,
  maxExecutionEventBatchBytes,
  maxExecutionEventBatchCount,
  maxExecutionEvents,
  maxExecutionOutputBytes,
  maxExecutionOutputEvents,
  type ExecutionEvent,
  type ExecutionEventSummary,
} from '../core/execution-events'
import type {
  ExecutionHostBridge,
  ExecutionHostEvent,
  ExecutionPreviewBounds,
} from './execution-browser-bridge'
import {
  executionProjectSchema,
  inspectProjectSnapshot,
  type ExecutionProject,
} from '../core/execution-project-snapshot'

export const trustedExecutionProject = {
  source: 'trusted-fixture',
  digest: '8fac8ee516e38a7e2d771ba565dc7f2db66a2bb50569fa82fb5ac98bd9d576f1',
} as const
const safetyMarginMs = 5_000
const pollMs = 750
const renewMs = 15_000
const maxPendingOutputBytes = 256 * 1024

type Http = Pick<
  ReturnType<typeof createExecutionHttp>,
  | 'command'
  | 'snapshot'
  | 'events'
  | 'uploadSnapshot'
  | 'projectSnapshot'
  | 'snapshotBytes'
>
type HostFields = Pick<
  Extract<ExecutionSessionCommand, { type: 'dispatch' }>,
  | 'sessionId'
  | 'hostGeneration'
  | 'ownerInstanceId'
  | 'runtimeId'
  | 'leaseProof'
>
export type ExecutionOwnerView = {
  key: string
  identity: ExecutionIdentity
  phase:
    | 'idle'
    | 'creating'
    | 'connecting'
    | 'claiming'
    | 'ready'
    | 'closing'
    | 'closed'
    | 'abandoned'
    | 'disconnected'
  /** This document owns startup or a live runtime, rather than a remote receipt. */
  localOwner: boolean
  snapshot: ExecutionSessionSnapshot | null
  error?: string
  cleanup: 'not_requested' | 'pending' | 'confirmed' | 'unknown'
  /** Ordered durable records plus this owner's pending records, with no duplicates. */
  events: readonly ExecutionHostEvent[]
  droppedBytes: number
  eventStatus: {
    persistedThrough: number
    receivedThrough: number
    pendingEvents: number
    loading: boolean
    error?: string
  }
  /** Valid committed deliveries observed here, including identical redelivery. */
  deliveryObservations: Readonly<Record<string, number>>
}
type Entry = {
  view: ExecutionOwnerView
  identity: ExecutionIdentity
  accountGeneration: number
  http: Http
  abort: AbortController
  live: boolean
  closing: boolean
  project: ExecutionProject
  host?: HostFields
  bridge?: ExecutionHostBridge
  presentation?: { previewId: string; bounds: ExecutionPreviewBounds | null }
  deadline: number
  timers: Set<ReturnType<typeof setTimeout>>
  deliveries: Map<
    string,
    {
      delivery: ExecutionDelivery
      outcome?: ExecutionCommandOutcome
      stopSent?: boolean
    }
  >
  enqueuePending: boolean
  eventLog: ExecutionEvent[]
  pendingEvents: ExecutionEvent[]
  pendingBytes: number
  eventBytes: number
  outputEvents: number
  persistedThrough: number
  upload?: Promise<void>
  uploadError?: Error
  start?: Promise<ExecutionOwnerView>
  recovery?: {
    kind: 'inspect' | 'abandon'
    abort: AbortController
    promise: Promise<ExecutionOwnerView>
  }
}
export type ExecutionOwnerOptions = {
  openBridge: (
    connect: ExecutionBridgeConnect,
    onEvent: (event: ExecutionHostEvent) => void,
    signal: AbortSignal,
  ) => Promise<ExecutionHostBridge>
  http?: (identity: ExecutionIdentity) => Http
  now?: () => number
  uuid?: () => string
  randomSecret?: () => string
}

export function executionOwnerKey(identity: ExecutionIdentity) {
  return JSON.stringify([
    identity.userId,
    identity.workspaceId,
    identity.botId,
    identity.conversationId,
  ])
}
function randomSecret() {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
  )
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}
function sameRuntime(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** The document owns runtimes. Routes and panes only subscribe to this service.
 * Lease proofs are private memory, never part of the observable store or bridge.
 */
export class ExecutionOwners {
  private readonly entries = new Map<string, Entry>()
  private readonly listeners = new Set<() => void>()
  private views: readonly ExecutionOwnerView[] = []
  private userId: string | null = null
  private generation = 0
  private sealed = false
  private readonly now: () => number
  private readonly uuid: () => string
  private readonly secret: () => string
  private readonly ownerInstanceId: string

  constructor(private readonly options: ExecutionOwnerOptions) {
    this.now = options.now ?? (() => performance.now())
    this.uuid = options.uuid ?? (() => crypto.randomUUID())
    this.secret = options.randomSecret ?? randomSecret
    this.ownerInstanceId = this.uuid()
  }

  getSnapshot = () => this.views
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** A view lease only. It cannot create, adopt, or send commands to a runtime. */
  attachPreviewViewport(identity: ExecutionIdentity, previewId: string) {
    const entry = this.entries.get(executionOwnerKey(identity))
    if (!entry || !this.known(entry))
      return {
        update: (_bounds: ExecutionPreviewBounds | null) => false,
        release() {},
      }
    const presentation = {
      previewId,
      bounds: null as ExecutionPreviewBounds | null,
    }
    entry.presentation = presentation
    this.refreshPreviewViewport(entry)
    return {
      update: (bounds: ExecutionPreviewBounds | null) => {
        if (entry.presentation !== presentation || !this.known(entry))
          return false
        presentation.bounds = bounds
        return this.refreshPreviewViewport(entry)
      },
      release: () => {
        if (entry.presentation !== presentation) return
        entry.presentation = undefined
        entry.bridge?.setPreviewViewport(null)
      },
    }
  }

  private refreshPreviewViewport(entry: Entry) {
    const { presentation, host, bridge } = entry
    if (!bridge) return false
    const session = entry.view.snapshot?.session
    const exited = new Set(
      entry.view.events.flatMap((event) =>
        event.type === 'process-exit' ? [event.processId] : [],
      ),
    )
    const eligible =
      presentation &&
      host &&
      session &&
      this.current(entry) &&
      !entry.closing &&
      entry.view.localOwner &&
      entry.view.phase === 'ready' &&
      this.now() < entry.deadline &&
      session.id === host.sessionId &&
      session.runtimeId === host.runtimeId &&
      session.hostGeneration === host.hostGeneration &&
      openExecutionPreview(entry.view.snapshot, presentation.previewId, exited)
    return bridge.setPreviewViewport(eligible ? presentation.bounds : null)
  }

  setAccount(userId: string | null) {
    if (this.userId === userId) return
    this.generation++
    this.userId = userId
    for (const entry of this.entries.values()) {
      entry.recovery?.abort.abort()
      this.fence(
        entry,
        'The signed-in account changed. Start a new workspace after signing in.',
      )
    }
    // Do not expose the previous account's filenames or output to the next one.
    this.entries.clear()
    this.emit()
  }

  shutdownAll(
    message = 'The workspace owner closed. Its last result may be unknown.',
  ) {
    for (const entry of this.entries.values()) {
      entry.recovery?.abort.abort()
      this.fence(entry, message)
    }
  }

  pageHidden() {
    // BFCache restoration cannot revive a document whose authority was released.
    this.dispose(
      'The owner page left. Reload before starting another workspace.',
    )
  }

  /** Permanently retire this service, including instances with no entries yet.
   * Local cleanup does not acknowledge a durable Close or transfer ownership.
   * A successor can inspect receipts, but must acquire its own runtime explicitly.
   */
  dispose(
    message = 'The workspace owner closed. Its last result may be unknown.',
  ) {
    if (this.sealed) return
    this.sealed = true
    this.shutdownAll(message)
  }

  start(
    identity: ExecutionIdentity,
    input: ExecutionProject = trustedExecutionProject,
  ): Promise<ExecutionOwnerView> {
    const parsedProject = executionProjectSchema.safeParse(input)
    if (!parsedProject.success)
      return Promise.reject(new Error('The project source is invalid.'))
    const project = parsedProject.data
    if (this.sealed || this.userId !== identity.userId)
      return Promise.reject(
        new Error('Sign in and reload before starting a workspace.'),
      )
    const key = executionOwnerKey(identity)
    const previous = this.entries.get(key)
    if (previous?.recovery)
      return Promise.reject(new Error('Wait for the session check to finish.'))
    if (previous?.live)
      return sameRuntime(previous.project, project)
        ? (previous.start ?? Promise.resolve(previous.view))
        : Promise.reject(
            new Error('Close this workspace before restoring another project.'),
          )
    if (
      previous &&
      !['idle', 'closed', 'abandoned'].includes(previous.view.phase)
    )
      return Promise.reject(
        new Error(
          'The previous workspace needs reconciliation before starting another.',
        ),
      )
    if ([...this.entries.values()].filter((entry) => entry.live).length >= 4)
      return Promise.reject(
        new Error('Close a workspace before starting another.'),
      )
    if (this.entries.size >= 32 && !previous)
      return Promise.reject(
        new Error(
          'Reload after closing your workspaces to clear local session history.',
        ),
      )
    const entry = this.makeEntry(identity, true)
    entry.project = project
    this.entries.set(key, entry)
    this.emit()
    entry.start = this.startEntry(entry)
    return entry.start
  }

  /** Reads durable evidence only. A remote runtime never becomes a local owner. */
  inspect(identity: ExecutionIdentity): Promise<ExecutionOwnerView> {
    if (this.sealed || this.userId !== identity.userId)
      return Promise.reject(
        new Error('Sign in and reload before inspecting a workspace.'),
      )
    const key = executionOwnerKey(identity)
    let entry = this.entries.get(key)
    if (!entry) {
      if (this.entries.size >= 32)
        return Promise.reject(
          new Error(
            'Reload after closing your workspaces to clear local session history.',
          ),
        )
      entry = this.makeEntry(identity, false)
      this.entries.set(key, entry)
      this.emit()
    }
    if (entry.recovery)
      return entry.recovery.kind === 'inspect'
        ? entry.recovery.promise
        : Promise.reject(
            new Error('Wait for the current session action to finish.'),
          )
    if (entry.live && !entry.host)
      return Promise.reject(new Error('Wait for workspace startup to finish.'))
    const captured = entry
    return this.recover(captured, 'inspect', async (signal) => {
      const snapshot = parseExecutionSnapshot(
        await captured.http.snapshot(signal),
        captured.identity,
      )
      this.requireKnown(captured)
      if (captured.live && this.authorized(captured)) {
        try {
          this.acceptSnapshot(captured, snapshot)
        } catch {
          this.fence(
            captured,
            'The execution authority changed. Its last result may be unknown.',
          )
        }
        if (captured.live) {
          await this.readEvents(captured, captured.view.snapshot!, signal)
          this.publish(captured, { error: undefined })
          return captured.view
        }
      }
      this.acceptInspectedSnapshot(captured, snapshot)
      await this.readEvents(captured, snapshot, signal)
      return captured.view
    })
  }

  /** Abandonment retains unknown receipts. It is not a shutdown acknowledgment. */
  abandon(identity: ExecutionIdentity): Promise<ExecutionOwnerView> {
    if (this.sealed || this.userId !== identity.userId)
      return Promise.reject(
        new Error('Sign in and reload before abandoning a workspace.'),
      )
    const entry = this.entries.get(executionOwnerKey(identity))
    if (!entry || !this.known(entry))
      return Promise.reject(
        new Error('Inspect the session before abandoning it.'),
      )
    if (entry.live)
      return Promise.reject(
        new Error('Close the local owner before abandoning its session.'),
      )
    if (entry.recovery)
      return Promise.reject(
        new Error('Wait for the current session action to finish.'),
      )
    const session = entry.view.snapshot?.session
    if (!session || !['awaiting_host', 'disconnected'].includes(session.status))
      return Promise.reject(
        new Error(
          'Only an unclaimed or disconnected session can be abandoned.',
        ),
      )
    const command: ExecutionSessionCommand = {
      type: 'abandon',
      commandId: this.uuid(),
      sessionId: session.id,
      expectedVersion: session.version,
    }
    return this.recover(entry, 'abandon', async (signal) => {
      const snapshot = parseExecutionSnapshot(
        await entry.http.command(command, signal),
        entry.identity,
      )
      this.requireKnown(entry)
      if (
        snapshot.session?.id !== session.id ||
        snapshot.session.status !== 'abandoned'
      )
        throw new Error('Abandonment was not confirmed.')
      this.acceptInspectedSnapshot(entry, snapshot)
      await this.readEvents(entry, snapshot, signal)
      return entry.view
    })
  }

  private makeEntry(identity: ExecutionIdentity, live: boolean): Entry {
    const captured = Object.freeze({ ...identity })
    return {
      identity: captured,
      accountGeneration: this.generation,
      http: (this.options.http ?? createExecutionHttp)(captured),
      abort: new AbortController(),
      live,
      closing: false,
      project: trustedExecutionProject,
      deadline: 0,
      timers: new Set(),
      deliveries: new Map(),
      enqueuePending: false,
      eventLog: [],
      pendingEvents: [],
      pendingBytes: 0,
      eventBytes: 0,
      outputEvents: 0,
      persistedThrough: 0,
      view: {
        key: executionOwnerKey(captured),
        identity: captured,
        phase: live ? 'creating' : 'disconnected',
        localOwner: live,
        snapshot: null,
        cleanup: 'not_requested',
        events: [],
        droppedBytes: 0,
        eventStatus: {
          persistedThrough: 0,
          receivedThrough: 0,
          pendingEvents: 0,
          loading: false,
        },
        deliveryObservations: Object.freeze({}),
      },
    }
  }

  private recover(
    entry: Entry,
    kind: 'inspect' | 'abandon',
    operation: (signal: AbortSignal) => Promise<ExecutionOwnerView>,
  ): Promise<ExecutionOwnerView> {
    const abort = new AbortController()
    // Install the pending action before invoking injected I/O or notifying views.
    const promise = Promise.resolve()
      .then(() => {
        this.requireKnown(entry)
        if (abort.signal.aborted) throw new Error('Session action cancelled.')
        return operation(abort.signal)
      })
      .catch((error: unknown) => {
        if (this.known(entry)) {
          if (error instanceof ExecutionHttpError && error.status === 401)
            this.setAccount(null)
          else {
            if (entry.live) this.failed(entry, error)
            this.publish(entry, {
              error:
                kind === 'inspect'
                  ? 'The session could not be inspected. Its last known state is shown.'
                  : 'Abandonment could not be confirmed. Inspect the session before trying again.',
            })
          }
        }
        throw new Error(
          kind === 'inspect'
            ? 'The session could not be inspected. Try again after checking your account.'
            : 'Abandonment could not be confirmed. Inspect the session before trying again.',
        )
      })
      .finally(() => {
        if (entry.recovery?.promise === promise) entry.recovery = undefined
      })
    entry.recovery = { kind, abort, promise }
    return promise
  }

  private acceptInspectedSnapshot(
    entry: Entry,
    snapshot: ExecutionSessionSnapshot,
  ) {
    this.requireKnown(entry)
    const previous = entry.view.snapshot?.session
    if (
      previous &&
      previous.id === snapshot.session?.id &&
      snapshot.session &&
      snapshot.session.version < previous.version
    )
      return
    if (previous?.id !== snapshot.session?.id) this.resetEvents(entry)
    snapshot = this.monotonicEvents(entry, snapshot)
    this.confirmEvents(entry, snapshot.events.lastSequence)
    const status = snapshot.session?.status
    this.publish(entry, {
      snapshot,
      localOwner: false,
      error: undefined,
      phase: !snapshot.session
        ? 'idle'
        : status === 'closed'
          ? 'closed'
          : status === 'abandoned'
            ? 'abandoned'
            : 'disconnected',
    })
    this.publishEvents(entry)
  }

  async enqueue(identity: ExecutionIdentity, operation: ExecutionOperation) {
    const entry = this.entries.get(executionOwnerKey(identity))
    if (
      !entry ||
      !this.authorized(entry) ||
      !entry.host ||
      !entry.view.snapshot?.session
    )
      throw new Error('This workspace is not connected.')
    if (entry.enqueuePending)
      throw new Error('Wait for the current command to be accepted.')
    const parsed = executionOperationSchema.parse(operation)
    if (entry.closing) throw new Error('This workspace is closing.')
    entry.enqueuePending = true
    if (parsed.type === 'close') {
      entry.closing = true
      this.publish(entry, { phase: 'closing' })
    }
    try {
      const snapshot = await entry.http.command(
        {
          type: 'enqueue',
          commandId: this.uuid(),
          sessionId: entry.host.sessionId,
          expectedVersion: entry.view.snapshot.session.version,
          operation: parsed,
        },
        entry.abort.signal,
      )
      if (!this.authorized(entry))
        throw new Error('The workspace owner changed.')
      this.acceptSnapshot(entry, snapshot)
      return snapshot
    } catch (error) {
      if (
        error instanceof ExecutionHttpError &&
        error.status === 429 &&
        !error.uncertain &&
        this.authorized(entry)
      ) {
        // Ordinary admission has a lower cap than Stop/Close. A definite limit
        // rejection must preserve the live owner and its reserved cleanup slots.
        entry.closing = entry.view.snapshot?.session?.status === 'closing'
        this.publish(entry, { phase: entry.closing ? 'closing' : 'ready' })
        throw new Error(
          'The command limit was reached. Stop processes or close this workspace.',
        )
      }
      if (
        error instanceof ExecutionHttpError &&
        error.status === 409 &&
        !error.uncertain &&
        this.current(entry)
      ) {
        // A user CAS conflict did not admit this command. Refresh without a new ID
        // or a hidden second attempt. Host dispatch/renew 409s are never treated so.
        try {
          const snapshot = await entry.http.snapshot(entry.abort.signal)
          if (this.authorized(entry)) {
            entry.closing = snapshot.session?.status === 'closing'
            this.acceptSnapshot(entry, snapshot)
          }
        } catch (refreshError) {
          this.failed(entry, refreshError)
        }
        throw new Error(
          'The workspace changed. Review its current state before trying again.',
        )
      }
      this.failed(entry, error)
      throw new Error(
        'The command could not be confirmed. The workspace has stopped accepting work.',
      )
    } finally {
      entry.enqueuePending = false
    }
  }

  private known(entry: Entry) {
    return (
      !this.sealed &&
      entry.accountGeneration === this.generation &&
      this.userId === entry.identity.userId &&
      this.entries.get(entry.view.key) === entry
    )
  }
  private requireKnown(entry: Entry) {
    if (!this.known(entry))
      throw new Error('The signed-in account or session changed.')
  }
  private current(entry: Entry) {
    return entry.live && this.known(entry)
  }
  private authorized(entry: Entry) {
    if (!this.current(entry)) return false
    if (entry.host && this.now() >= entry.deadline) {
      this.fence(
        entry,
        'The workspace lease expired. The last result may be unknown.',
      )
      return false
    }
    return true
  }
  private publish(entry: Entry, patch: Partial<ExecutionOwnerView>) {
    entry.view = { ...entry.view, ...patch }
    this.refreshPreviewViewport(entry)
    if (this.entries.get(entry.view.key) === entry) this.emit()
  }
  private emit() {
    this.views = [...this.entries.values()].map((entry) => entry.view)
    for (const listener of this.listeners) listener()
  }
  private timer(entry: Entry, delay: number, callback: () => void) {
    const timer = setTimeout(() => {
      entry.timers.delete(timer)
      if (this.authorized(entry)) callback()
    }, delay)
    entry.timers.add(timer)
  }
  private clearTimers(entry: Entry) {
    for (const timer of entry.timers) clearTimeout(timer)
    entry.timers.clear()
  }

  private async startEntry(entry: Entry) {
    try {
      let snapshotBytes: Uint8Array<ArrayBuffer> | undefined
      if (entry.project.source === 'snapshot') {
        const saved = await entry.http.projectSnapshot(
          entry.project.snapshotId,
          entry.abort.signal,
        )
        this.requireKnown(entry)
        if (
          saved.state !== 'ready' ||
          saved.snapshotId !== entry.project.snapshotId ||
          saved.sha256 !== entry.project.digest ||
          executionOwnerKey(saved.identity) !== entry.view.key
        )
          throw new Error('Saved project source changed')
        snapshotBytes = await entry.http.snapshotBytes(
          saved,
          entry.abort.signal,
        )
        this.requireKnown(entry)
        if (
          !this.current(entry) ||
          (await inspectProjectSnapshot(snapshotBytes)).sha256 !==
            entry.project.digest
        )
          throw new Error('Saved project bytes changed')
        this.requireKnown(entry)
      }
      const created = await entry.http.command(
        {
          type: 'create',
          commandId: this.uuid(),
          runtime: browserExecutionRuntime,
          project: entry.project,
        },
        entry.abort.signal,
      )
      if (!this.current(entry)) throw new Error('Owner changed')
      const session = created.session
      if (
        !session ||
        session.status !== 'awaiting_host' ||
        executionOwnerKey(session.identity) !== entry.view.key ||
        !sameRuntime(session.runtime, browserExecutionRuntime) ||
        !sameRuntime(session.project, entry.project)
      )
        throw new Error('Invalid session')
      this.publish(entry, { snapshot: created, phase: 'connecting' })
      const runtimeId = this.uuid()
      const bridge = await this.options.openBridge(
        {
          type: 'gum-execution-connect',
          version: 1,
          nonce: this.secret(),
          sessionId: session.id,
          hostGeneration: session.hostGeneration + 1,
          runtimeId,
          project: entry.project,
          ...(snapshotBytes ? { snapshotBytes } : {}),
        },
        (event) => this.event(entry, event),
        entry.abort.signal,
      )
      entry.bridge = bridge
      if (!this.current(entry)) {
        void this.cleanup(entry)
        throw new Error('Owner changed')
      }
      if (!sameRuntime(bridge.runtime, browserExecutionRuntime))
        throw new Error('Runtime changed')
      this.publish(entry, { phase: 'claiming' })
      const host: HostFields = {
        sessionId: session.id,
        hostGeneration: session.hostGeneration + 1,
        ownerInstanceId: this.ownerInstanceId,
        runtimeId,
        leaseProof: this.secret(),
      }
      const startedAt = this.now()
      const claimed = await entry.http.command(
        {
          type: 'claim',
          commandId: this.uuid(),
          sessionId: session.id,
          expectedVersion: session.version,
          ownerInstanceId: host.ownerInstanceId,
          runtimeId,
          leaseProof: host.leaseProof,
          runtime: browserExecutionRuntime,
        },
        entry.abort.signal,
      )
      if (!this.current(entry)) throw new Error('Owner changed')
      entry.host = host
      entry.deadline = startedAt + executionLeaseMs - safetyMarginMs
      if (!this.authorized(entry)) throw new Error('Lease expired')
      this.acceptSnapshot(entry, claimed)
      if (!this.current(entry)) throw new Error('Session changed')
      this.timer(entry, renewMs, () => {
        void this.renew(entry)
      })
      this.timer(entry, 0, () => {
        void this.poll(entry)
      })
      this.watchDeadline(entry)
      return entry.view
    } catch (error) {
      this.failed(entry, error)
      throw new Error(
        'The workspace could not start. Review its session before trying again.',
      )
    }
  }

  private requireSnapshotOwner(
    entry: Entry,
    snapshot: ExecutionSessionSnapshot,
  ) {
    const session = snapshot.session
    const host = entry.host
    if (
      !session ||
      !host ||
      session.id !== host.sessionId ||
      executionOwnerKey(session.identity) !== entry.view.key ||
      session.hostGeneration !== host.hostGeneration ||
      session.runtimeId !== host.runtimeId ||
      session.ownerInstanceId !== host.ownerInstanceId ||
      !sameRuntime(session.runtime, browserExecutionRuntime) ||
      !sameRuntime(session.project, entry.project) ||
      !sameRuntime(session.authority, entry.view.snapshot?.session?.authority)
    )
      throw new Error('The execution authority changed.')
    return session
  }

  private acceptSnapshot(entry: Entry, snapshot: ExecutionSessionSnapshot) {
    const session = this.requireSnapshotOwner(entry, snapshot)
    const previous = entry.view.snapshot?.session
    if (!['ready', 'closing', 'closed'].includes(session.status))
      throw new Error('The session disconnected.')
    if (previous && session.version < previous.version) return
    snapshot = this.monotonicEvents(entry, snapshot)
    this.confirmEvents(entry, snapshot.events.lastSequence)
    entry.closing = entry.closing || session.status === 'closing'
    this.publish(entry, {
      snapshot,
      phase:
        session.status === 'closed'
          ? 'closed'
          : entry.closing
            ? 'closing'
            : 'ready',
    })
    this.publishEvents(entry)
    if (session.status === 'ready' && this.authorized(entry)) {
      for (const command of snapshot.commands) {
        if (
          command.origin.kind !== 'run' ||
          !command.stopRequested ||
          !['unknown', 'dispatched', 'running'].includes(command.state)
        )
          continue
        const {
          id,
          sessionId,
          digest,
          hostGeneration,
          runtimeId,
          origin,
          operation,
          state,
          stopRequested,
          createdAt,
          dispatchedAt,
          processId,
          previewId,
        } = command
        this.deliver(
          entry,
          executionDeliverySchema.parse({
            id,
            sessionId,
            digest,
            hostGeneration,
            runtimeId,
            origin,
            operation,
            state,
            stopRequested,
            createdAt,
            dispatchedAt,
            ...(processId ? { processId } : {}),
            ...(previewId ? { previewId } : {}),
          }),
        )
      }
    }
    if (session.status === 'closed') {
      entry.live = false
      this.clearTimers(entry)
      this.publish(entry, { cleanup: 'confirmed', localOwner: false })
      // Only the server's acknowledged Close establishes confirmed closure.
      entry.bridge?.dispose()
    }
  }
  private watchDeadline(entry: Entry) {
    this.timer(
      entry,
      Math.min(1000, Math.max(1, entry.deadline - this.now())),
      () => this.watchDeadline(entry),
    )
  }
  private async renew(entry: Entry) {
    if (!this.authorized(entry) || !entry.host) return
    const startedAt = this.now()
    try {
      const snapshot = await entry.http.command(
        { type: 'renew', ...entry.host },
        entry.abort.signal,
      )
      if (!this.authorized(entry)) return
      this.acceptSnapshot(entry, snapshot)
      if (!this.current(entry)) return
      entry.deadline = startedAt + executionLeaseMs - safetyMarginMs
      if (!this.authorized(entry)) return
      this.timer(entry, renewMs, () => {
        void this.renew(entry)
      })
    } catch (error) {
      this.failed(entry, error)
    }
  }
  private async poll(entry: Entry) {
    if (!this.authorized(entry) || !entry.host) return
    try {
      const snapshot = await entry.http.command(
        { type: 'dispatch', ...entry.host },
        entry.abort.signal,
      )
      if (!this.authorized(entry)) return
      this.acceptSnapshot(entry, snapshot)
      if (!this.current(entry)) return
      if (snapshot.delivery)
        this.deliver(entry, executionDeliverySchema.parse(snapshot.delivery))
      if (this.current(entry))
        this.timer(entry, pollMs, () => {
          void this.poll(entry)
        })
    } catch (error) {
      this.failed(entry, error)
    }
  }
  private deliver(entry: Entry, delivery: ExecutionDelivery) {
    if (!this.authorized(entry) || !entry.bridge || !entry.host) return
    if (
      delivery.sessionId !== entry.host.sessionId ||
      delivery.hostGeneration !== entry.host.hostGeneration ||
      delivery.runtimeId !== entry.host.runtimeId
    )
      throw new Error('Delivery owner changed')
    const previous = entry.deliveries.get(delivery.id)
    if (previous) {
      // Mutable status/stop metadata may advance while the immutable effect is unchanged.
      const fingerprint = (item: ExecutionDelivery) => {
        const { state: _state, stopRequested: _stopRequested, ...fixed } = item
        return JSON.stringify(fixed)
      }
      if (fingerprint(previous.delivery) !== fingerprint(delivery))
        throw new Error('Delivery changed')
      this.observeDelivery(entry, delivery.id)
      if (
        delivery.origin.kind === 'run' &&
        delivery.stopRequested &&
        !previous.stopSent &&
        !previous.outcome
      ) {
        previous.stopSent = true
        void entry.bridge
          .stopCommand(delivery)
          .then((outcome) => {
            if (
              outcome.commandId !== delivery.id ||
              outcome.digest !== delivery.digest ||
              outcome.outcome === 'unknown'
            )
              throw new Error('The model command stop was not confirmed.')
          })
          .catch((error) => this.failed(entry, error))
      }
      return
    }
    if (entry.deliveries.size >= 32) throw new Error('Command limit reached')
    if (
      entry.closing &&
      delivery.operation.type !== 'close' &&
      delivery.operation.type !== 'stop_process'
    )
      return
    const record = {
      delivery,
      outcome: undefined as ExecutionCommandOutcome | undefined,
      stopSent: delivery.origin.kind === 'run' && delivery.stopRequested,
    }
    entry.deliveries.set(delivery.id, record)
    this.observeDelivery(entry, delivery.id)
    if (delivery.operation.type === 'close') {
      entry.closing = true
      this.publish(entry, { phase: 'closing' })
    }
    // Admission is synchronous. Polling and lease renewal never wait for the SDK.
    void (async () => {
      try {
        if (!this.authorized(entry)) return
        const outcome = await (record.stopSent
          ? entry.bridge!.stopCommand(delivery)
          : entry.bridge!.execute(delivery))
        record.outcome = outcome
        if (!this.authorized(entry)) return
        if (
          outcome.commandId !== delivery.id ||
          outcome.digest !== delivery.digest
        )
          throw new Error('Result identity changed')
        if (outcome.outcome === 'unknown') {
          if (
            entry.closing &&
            delivery.operation.type !== 'close' &&
            ['CLOSED_DURING_OPERATION', 'runtime_closing'].includes(
              outcome.error.code,
            )
          )
            return
          throw new Error('Execution outcome unknown')
        }
        if (
          outcome.outcome === 'succeeded' &&
          outcome.result.type === 'save_snapshot'
        ) {
          const result = outcome.result
          if (
            delivery.operation.type !== 'save_snapshot' ||
            outcome.result.snapshotId !== delivery.id
          )
            throw new Error('Saved project identity changed')
          const bytes = await entry.bridge!.readSnapshot(
            delivery.id,
            delivery.digest,
          )
          if (!this.authorized(entry)) return
          const metadata = await inspectProjectSnapshot(bytes)
          if (
            Object.entries(metadata).some(
              ([key, value]) => result[key as keyof typeof result] !== value,
            )
          )
            throw new Error('Saved project bytes changed')
          if (!this.authorized(entry)) return
          const { type: _type, ...saved } = outcome.result
          const uploaded = await entry.http.uploadSnapshot(
            {
              ...entry.host!,
              commandId: delivery.id,
              digest: delivery.digest,
              snapshot: saved,
            },
            bytes,
            entry.abort.signal,
          )
          this.requireKnown(entry)
          this.requireSnapshotOwner(entry, uploaded)
          const receipt = uploaded.savedSnapshots.find(
            (item) => item.snapshotId === delivery.id,
          )
          if (
            !receipt ||
            receipt.state !== 'ready' ||
            receipt.commandDigest !== delivery.digest ||
            receipt.runtimeId !== entry.host!.runtimeId ||
            receipt.sessionId !== entry.host!.sessionId ||
            receipt.hostGeneration !== entry.host!.hostGeneration ||
            executionOwnerKey(receipt.identity) !== entry.view.key ||
            Object.entries(saved).some(
              ([key, value]) => receipt[key as keyof typeof receipt] !== value,
            )
          )
            throw new Error('Saved project publication could not be confirmed')
          if (!this.authorized(entry)) return
          this.acceptSnapshot(entry, uploaded)
        }
        // Capture a fixed barrier after the SDK settles. New output from other
        // processes cannot make this command wait for an ever-moving target.
        const eventsThrough = entry.eventLog.length
        await this.flushThrough(entry, eventsThrough)
        if (!this.authorized(entry)) return
        const snapshot = await entry.http.command(
          {
            type: 'acknowledge',
            ...entry.host!,
            commandId: delivery.id,
            digest: delivery.digest,
            eventsThrough,
            ...(outcome.outcome === 'succeeded'
              ? { outcome: 'succeeded', result: outcome.result }
              : { outcome: 'failed', error: outcome.error }),
          },
          entry.abort.signal,
        )
        if (this.authorized(entry)) {
          this.acceptSnapshot(entry, snapshot)
          if (
            delivery.operation.type === 'close' &&
            outcome.outcome !== 'succeeded'
          )
            this.fence(entry, 'Workspace shutdown could not be confirmed.')
        }
      } catch (error) {
        this.failed(entry, error)
      }
    })()
  }
  private observeDelivery(entry: Entry, commandId: string) {
    const counts = entry.view.deliveryObservations
    this.publish(entry, {
      deliveryObservations: Object.freeze({
        ...counts,
        [commandId]: Math.min(1_000_000, (counts[commandId] ?? 0) + 1),
      }),
    })
  }
  private event(entry: Entry, event: ExecutionHostEvent) {
    if (!this.authorized(entry)) return
    if (event.type === 'fault') {
      this.fence(
        entry,
        'The runtime could not confirm its state. Its last result may be unknown.',
      )
      return
    }
    const record = entry.deliveries.get(event.commandId)
    if (
      !record ||
      !['run', 'spawn'].includes(record.delivery.operation.type) ||
      event.processId !== record.delivery.processId
    ) {
      this.fence(entry, 'The runtime reported an event for an unknown command.')
      return
    }
    try {
      // Base64 captures the exact bytes before any async work or caller mutation.
      const {
        sequence: _wireSequence,
        bytes: _bytes,
        ...rest
      } = event as Extract<ExecutionHostEvent, { type: 'output' }>
      const durable = executionEventSchema.parse({
        ...rest,
        sequence: entry.eventLog.length + 1,
        digest: record.delivery.digest,
        ...(event.type === 'output'
          ? { dataBase64: encodeExecutionBytes(event.bytes) }
          : {}),
      })
      const bytes = event.type === 'output' ? event.bytes.byteLength : 0
      if (
        entry.pendingBytes + bytes > maxPendingOutputBytes ||
        entry.eventLog.length >= maxExecutionEvents ||
        entry.eventBytes + bytes > maxExecutionOutputBytes ||
        (event.type === 'output' &&
          entry.outputEvents >= maxExecutionOutputEvents)
      )
        throw new Error('Execution output capacity exceeded.')
      entry.eventLog.push(durable)
      entry.pendingEvents.push(durable)
      entry.pendingBytes += bytes
      entry.eventBytes += bytes
      if (event.type === 'output') entry.outputEvents++
      this.publishEvents(entry)
      void this.uploadNext(entry).catch(() => {})
    } catch {
      entry.uploadError = new Error(
        'Output could not be retained within its limits. The workspace stopped accepting work.',
      )
      this.publishEvents(entry)
      this.fence(entry, entry.uploadError.message)
    }
  }

  private resetEvents(entry: Entry) {
    entry.eventLog = []
    entry.pendingEvents = []
    entry.pendingBytes = 0
    entry.eventBytes = 0
    entry.outputEvents = 0
    entry.persistedThrough = 0
    entry.uploadError = undefined
    this.publish(entry, {
      events: [],
      droppedBytes: 0,
      eventStatus: {
        persistedThrough: 0,
        receivedThrough: 0,
        pendingEvents: 0,
        loading: false,
      },
    })
  }

  private publishEvents(entry: Entry) {
    this.publish(entry, {
      events:
        entry.view.eventStatus.receivedThrough === entry.eventLog.length
          ? entry.view.events
          : entry.eventLog.map((event): ExecutionHostEvent => {
              const { digest: _digest, sequence, ...rest } = event
              if (rest.type === 'output') {
                const { dataBase64, ...output } = rest
                return {
                  ...output,
                  sequence,
                  bytes: new Uint8Array(decodeExecutionBytes(dataBase64)),
                }
              }
              return rest
            }),
      droppedBytes: entry.eventLog.reduce(
        (sum, event) =>
          sum + (event.type === 'output-gap' ? event.droppedBytes : 0),
        0,
      ),
      eventStatus: {
        ...entry.view.eventStatus,
        persistedThrough: entry.persistedThrough,
        receivedThrough: entry.eventLog.length,
        pendingEvents: entry.pendingEvents.filter(
          (event) => event.sequence > entry.persistedThrough,
        ).length,
        error: entry.uploadError?.message ?? entry.view.eventStatus.error,
      },
    })
  }

  private confirmEvents(entry: Entry, through: number) {
    entry.persistedThrough = Math.max(entry.persistedThrough, through)
    // Any validated owner snapshot can confirm an append whose response is
    // delayed. Confirmed bytes must not remain charged to the unsaved spool.
    entry.pendingEvents = entry.pendingEvents.filter(
      (event) => event.sequence > entry.persistedThrough,
    )
    entry.pendingBytes = entry.pendingEvents.reduce(
      (sum, event) =>
        sum +
        (event.type === 'output'
          ? decodeExecutionBytes(event.dataBase64).length
          : 0),
      0,
    )
  }

  private confirmedClosedUpload(
    entry: Entry,
    host: HostFields | undefined,
    through: number | undefined,
  ) {
    const session = entry.view.snapshot?.session
    return (
      host !== undefined &&
      through !== undefined &&
      this.known(entry) &&
      entry.view.phase === 'closed' &&
      entry.view.cleanup === 'confirmed' &&
      session?.status === 'closed' &&
      session.id === host.sessionId &&
      session.hostGeneration === host.hostGeneration &&
      session.runtimeId === host.runtimeId &&
      session.ownerInstanceId === host.ownerInstanceId &&
      entry.persistedThrough >= through &&
      session !== undefined &&
      entry.view.snapshot!.events.lastSequence >= through
    )
  }

  private uploadNext(entry: Entry): Promise<void> {
    if (entry.upload) return entry.upload
    if (entry.uploadError) return Promise.reject(entry.uploadError)
    if (!entry.pendingEvents.length) return Promise.resolve()
    // Serialize append batches. HTTP retries preserve these exact records.
    let batchHost: HostFields | undefined
    let batchThrough: number | undefined
    const promise = Promise.resolve()
      .then(async () => {
        if (!entry.pendingEvents.length) return
        if (!this.authorized(entry) || !entry.host)
          throw new Error('Output owner changed.')
        const batch: ExecutionEvent[] = []
        let bytes = 0
        for (const event of entry.pendingEvents) {
          const size =
            event.type === 'output'
              ? decodeExecutionBytes(event.dataBase64).length
              : 0
          if (
            batch.length >= maxExecutionEventBatchCount ||
            bytes + size > maxExecutionEventBatchBytes
          )
            break
          batch.push(event)
          bytes += size
        }
        const through = batch.at(-1)!.sequence
        batchHost = entry.host
        batchThrough = through
        const snapshot = await entry.http.command(
          { type: 'append_events', ...entry.host, events: batch },
          entry.abort.signal,
        )
        // Validate a response even when it is obsolete. A closed owner cannot
        // accept a different account, session, runtime, authority, or byte log.
        this.requireKnown(entry)
        this.requireSnapshotOwner(entry, snapshot)
        if (
          snapshot.events.lastSequence < through ||
          snapshot.events.lastSequence > entry.eventLog.length
        )
          throw new Error('Output persistence was not confirmed.')
        if (
          JSON.stringify(
            this.summaryAt(entry, snapshot.events.lastSequence),
          ) !== JSON.stringify(snapshot.events)
        )
          throw new Error('Output persistence does not match retained bytes.')
        if (!this.authorized(entry)) {
          if (this.confirmedClosedUpload(entry, batchHost, batchThrough)) return
          throw new Error('Output owner changed.')
        }
        this.acceptSnapshot(entry, snapshot)
      })
      .catch((error: unknown) => {
        // A lost append response may be retried after Close removed its lease.
        // Independent validated snapshots already prove this exact batch saved.
        // Only obsolete transport/lease failures are irrelevant here, never an
        // invalid response, command conflict, or authorization failure while live.
        if (
          error instanceof ExecutionHttpError &&
          error.uncertain &&
          (error.status === null ||
            error.status === 403 ||
            (error.status >= 500 && error.status <= 599)) &&
          this.confirmedClosedUpload(entry, batchHost, batchThrough)
        )
          return
        if (this.known(entry)) {
          entry.uploadError ??= new Error(
            'Output could not be saved. Unsaved output is available only in this page.',
          )
          this.publishEvents(entry)
          this.failed(entry, error)
        }
        throw error
      })
      .finally(() => {
        if (entry.upload === promise) entry.upload = undefined
        if (
          this.authorized(entry) &&
          !entry.uploadError &&
          entry.pendingEvents.length
        )
          void this.uploadNext(entry).catch(() => {})
      })
    entry.upload = promise
    return promise
  }

  private async flushThrough(entry: Entry, through: number) {
    while (entry.pendingEvents.some((event) => event.sequence <= through)) {
      if (!this.authorized(entry)) throw new Error('Output owner changed.')
      await this.uploadNext(entry)
    }
    if (entry.uploadError) throw entry.uploadError
    if (entry.persistedThrough < through)
      throw new Error('Output persistence was not confirmed.')
  }

  private summaryAt(entry: Entry, through: number): ExecutionEventSummary {
    return this.summarizeEvents(entry.eventLog.slice(0, through))
  }

  private summarizeEvents(
    events: readonly ExecutionEvent[],
  ): ExecutionEventSummary {
    const summary = {
      lastSequence: events.length,
      outputBytes: 0,
      outputEvents: 0,
      droppedBytes: 0,
    }
    for (const event of events) {
      if (event.type === 'output') {
        summary.outputBytes += decodeExecutionBytes(event.dataBase64).length
        summary.outputEvents++
      } else if (event.type === 'output-gap') {
        summary.droppedBytes += event.droppedBytes
        if (!Number.isSafeInteger(summary.droppedBytes))
          throw new Error('Execution output totals exceed their limit.')
      }
    }
    return summary
  }

  private monotonicEvents(entry: Entry, snapshot: ExecutionSessionSnapshot) {
    const previous = entry.view.snapshot
    if (previous && previous.session?.id === snapshot.session?.id) {
      const old = previous.events,
        next = snapshot.events
      // Independent renewal and append requests may finish out of order.
      if (next.lastSequence < old.lastSequence)
        return { ...snapshot, events: old }
      if (
        next.outputBytes < old.outputBytes ||
        next.outputEvents < old.outputEvents ||
        next.droppedBytes < old.droppedBytes ||
        (next.lastSequence === old.lastSequence &&
          JSON.stringify(next) !== JSON.stringify(old))
      )
        throw new Error('Execution output totals changed.')
    }
    if (
      snapshot.events.lastSequence <= entry.eventLog.length &&
      JSON.stringify(this.summaryAt(entry, snapshot.events.lastSequence)) !==
        JSON.stringify(snapshot.events)
    )
      throw new Error('Execution output totals do not match retained bytes.')
    return snapshot
  }

  private async readEvents(
    entry: Entry,
    snapshot: ExecutionSessionSnapshot,
    signal: AbortSignal,
  ) {
    const session = snapshot.session
    if (!session || snapshot.events.lastSequence <= entry.eventLog.length)
      return
    const through = snapshot.events.lastSequence
    let previousSummary = snapshot.events
    this.publish(entry, {
      eventStatus: {
        ...entry.view.eventStatus,
        loading: true,
        error: undefined,
      },
    })
    try {
      while (entry.eventLog.length < through) {
        const after = entry.eventLog.length
        const page = executionEventPageSchema.parse(
          await entry.http.events({ sessionId: session.id, after }, signal),
        )
        this.requireKnown(entry)
        if (
          signal.aborted ||
          entry.view.snapshot?.session?.id !== session.id ||
          page.sessionId !== session.id ||
          page.after !== after ||
          page.hostGeneration !== session.hostGeneration ||
          page.runtimeId !== session.runtimeId ||
          page.summary.lastSequence < through ||
          page.nextSequence <= after
        )
          throw new Error('Execution output scope changed.')
        if (
          page.summary.lastSequence < previousSummary.lastSequence ||
          page.summary.outputBytes < previousSummary.outputBytes ||
          page.summary.outputEvents < previousSummary.outputEvents ||
          page.summary.droppedBytes < previousSummary.droppedBytes
        )
          throw new Error('Execution output totals regressed.')
        previousSummary = page.summary
        // A live remote owner can append after our snapshot. Read only through
        // this snapshot's fixed watermark; a later inspection can read more.
        const candidateEvents = [...entry.eventLog]
        let candidateBytes = entry.eventBytes,
          candidateOutputs = entry.outputEvents
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
            event.processId !== command.processId
          )
            throw new Error('Execution output command changed.')
          const prior = candidateEvents[event.sequence - 1]
          if (prior) {
            if (JSON.stringify(prior) !== JSON.stringify(event))
              throw new Error('Execution output changed.')
            continue
          }
          if (event.sequence !== candidateEvents.length + 1)
            throw new Error('Execution output is missing.')
          const bytes =
            event.type === 'output'
              ? decodeExecutionBytes(event.dataBase64).length
              : 0
          if (
            candidateBytes + bytes > maxExecutionOutputBytes ||
            candidateEvents.length >= maxExecutionEvents ||
            (event.type === 'output' &&
              candidateOutputs >= maxExecutionOutputEvents)
          )
            throw new Error('Execution output exceeds its limit.')
          candidateEvents.push(event)
          candidateBytes += bytes
          if (event.type === 'output') candidateOutputs++
        }
        const loaded = this.summarizeEvents(candidateEvents)
        if (
          loaded.outputBytes > page.summary.outputBytes ||
          loaded.outputEvents > page.summary.outputEvents ||
          loaded.droppedBytes > page.summary.droppedBytes ||
          (candidateEvents.length === through &&
            JSON.stringify(loaded) !== JSON.stringify(snapshot.events))
        )
          throw new Error('Execution output totals do not match loaded bytes.')
        entry.eventLog = candidateEvents
        entry.eventBytes = candidateBytes
        entry.outputEvents = candidateOutputs
        this.publishEvents(entry)
      }
      this.publish(entry, {
        eventStatus: {
          ...entry.view.eventStatus,
          loading: false,
          error: undefined,
        },
      })
    } catch (error) {
      if (this.known(entry) && entry.view.snapshot?.session?.id === session.id)
        this.publish(entry, {
          eventStatus: {
            ...entry.view.eventStatus,
            loading: false,
            error: 'Saved output could not be loaded. Refresh to try again.',
          },
        })
      throw error
    }
  }
  private failed(entry: Entry, error: unknown) {
    // A late response from the previous account must not sign out its successor.
    if (!this.current(entry)) return
    if (error instanceof ExecutionHttpError && error.status === 401) {
      this.setAccount(null)
      return
    }
    this.fence(
      entry,
      'The workspace connection or permission changed. Its last result may be unknown.',
    )
  }
  private fence(entry: Entry, message: string) {
    if (!entry.live) return
    entry.live = false
    this.clearTimers(entry)
    entry.abort.abort()
    this.publish(entry, {
      phase: 'disconnected',
      error: message,
      localOwner: false,
    })
    void this.cleanup(entry)
  }
  private async cleanup(entry: Entry) {
    if (!entry.bridge) return
    this.publish(entry, { cleanup: 'pending' })
    try {
      const outcome = await entry.bridge.shutdown()
      this.publish(entry, {
        cleanup: outcome.confirmed ? 'confirmed' : 'unknown',
      })
    } catch {
      this.publish(entry, { cleanup: 'unknown' })
    } finally {
      entry.bridge.dispose()
    }
  }
}
