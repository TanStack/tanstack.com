import { DbClient } from '@tanstack/react-db'
import {
  builderProjectSyncCommandSchema,
  builderProjectSyncEventSchema,
  builderProjectSyncMessageSchema,
  builderProjectSyncProjectSchema,
  builderProjectSyncResponseSchema,
  builderProjectSyncRunSchema,
  builderProjectSyncSnapshotPageSchema,
  builderProjectSyncSnapshotSchema,
  builderProjectSyncThreadSchema,
  isBuilderProjectSyncCommandRejection,
  type BuilderProjectSyncCommand,
  type BuilderProjectSyncCommandOutcome,
  type BuilderProjectSyncCommandResult,
  type BuilderProjectSyncEvent,
  type BuilderProjectSyncMessage,
  type BuilderProjectSyncProject,
  type BuilderProjectSyncRun,
  type BuilderProjectSyncSnapshot,
  type BuilderProjectSyncThread,
} from './builder-project-sync'
import {
  BuilderProjectSyncCommandRejectedError,
  enqueueBuilderProjectSyncCommands,
  replayBuilderProjectSyncOutbox,
  sendBuilderProjectSyncCommandFromOutbox,
} from './builder-project-sync-outbox.client'
import {
  createReplayableCollectionOptions,
  openReplayableEventSource,
  type ReplayableRowChange,
  type ReplayableStreamContext,
} from './replayable-collection.client'
const browserSessionStorageKey = 'tanstack-builder-browser-session-id'
const browserSessionLockPrefix = 'tanstack-builder-browser-session:'
const commandRequestTimeoutMs = 20_000
const heartbeatRequestTimeoutMs = 8_000
const outboxRetryInitialDelayMs = 500
const outboxRetryMaxDelayMs = 30_000
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type BuilderProjectSyncRow =
  | {
      key: string
      kind: 'project'
      value: BuilderProjectSyncProject
    }
  | {
      key: string
      kind: 'thread'
      value: BuilderProjectSyncThread
    }
  | {
      key: string
      kind: 'message'
      value: BuilderProjectSyncMessage
    }
  | {
      key: string
      kind: 'run'
      value: BuilderProjectSyncRun
    }

type BuilderProjectSyncRowChange = ReplayableRowChange<
  BuilderProjectSyncRow,
  string
>

interface EventSourceLike {
  readonly readyState: number
  addEventListener: (
    type: string,
    listener: (event: MessageEvent<string>) => void,
  ) => void
  removeEventListener: (
    type: string,
    listener: (event: MessageEvent<string>) => void,
  ) => void
  close: () => void
}

export interface BuilderProjectBrowserSessionLockManager {
  request: (
    name: string,
    options: { ifAvailable: true; mode: 'exclusive' },
    callback: (lock: object | null) => Promise<void>,
  ) => Promise<void>
}

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export interface CreateBuilderProjectSyncClientOptions {
  projectId: string
  fetch?: FetchLike
  createEventSource?: (url: string) => EventSourceLike
  sessionStorage?: Pick<Storage, 'getItem' | 'setItem'>
  browserSessionLockManager?: BuilderProjectBrowserSessionLockManager
  createBrowserSessionId?: () => string
  onBackgroundError?: (error: unknown) => void
}

export interface BuilderProjectSyncClient {
  readonly projectId: string
  readonly browserSessionId: string
  readonly db: DbClient
  readonly collection: BuilderProjectSyncCollection
  executeCommand: (
    command: BuilderProjectSyncCommand,
    optimistic?: (collection: BuilderProjectSyncCollection) => void,
  ) => Promise<BuilderProjectSyncCommandResult>
  executeRunEnqueue: (
    commands: BuilderProjectSyncRunEnqueueCommands,
  ) => Promise<BuilderProjectSyncCommandResult>
  flushOutbox: () => Promise<ReadonlyArray<BuilderProjectSyncCommandResult>>
  cleanup: () => Promise<void>
}

export type BuilderProjectSyncRunEnqueueCommands = {
  thread?: Extract<BuilderProjectSyncCommand, { type: 'thread.create' }>
  run: Extract<BuilderProjectSyncCommand, { type: 'run.enqueue' }>
}

export class BuilderProjectSyncHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'BuilderProjectSyncHttpError'
  }
}

export class BuilderProjectSyncStoppedError extends Error {
  constructor() {
    super('Builder project sync client has stopped')
    this.name = 'BuilderProjectSyncStoppedError'
  }
}

function isRetryableBuilderProjectSyncError(error: unknown) {
  if (
    error instanceof BuilderProjectSyncCommandRejectedError ||
    error instanceof BuilderProjectSyncStoppedError
  ) {
    return false
  }
  if (error instanceof BuilderProjectSyncHttpError) {
    return error.status === 408 || error.status === 429 || error.status >= 500
  }
  return true
}

export async function createBuilderProjectSyncClient(
  options: CreateBuilderProjectSyncClientOptions,
): Promise<BuilderProjectSyncClient> {
  if (!isUuid(options.projectId)) {
    throw new Error('Invalid Builder project ID')
  }

  const fetchRequest = options.fetch ?? globalThis.fetch
  const syncUrl = `/api/builder/projects/${options.projectId}/sync`
  const bootstrap = await fetchBuilderProjectSyncSnapshot(
    syncUrl,
    fetchRequest,
    options.projectId,
  )
  const snapshot = bootstrap.snapshot
  if (
    snapshot.project.id !== options.projectId ||
    snapshot.project.lastEventSequence !== snapshot.cursor
  ) {
    throw new Error('Invalid Builder project sync snapshot')
  }

  const abortController = new AbortController()
  const db = new DbClient()
  const browserSession = await claimBuilderProjectBrowserSession({
    ...(options.sessionStorage ? { storage: options.sessionStorage } : {}),
    ...(options.browserSessionLockManager
      ? { lockManager: options.browserSessionLockManager }
      : {}),
    ...(options.createBrowserSessionId
      ? { createId: options.createBrowserSessionId }
      : {}),
  })
  const browserSessionId = browserSession.id
  const collection = createBuilderProjectCollection({
    db,
    syncUrl,
    snapshot,
    headCursor: bootstrap.headCursor,
    fetchRequest,
    ...(options.onBackgroundError
      ? { onStreamError: options.onBackgroundError }
      : {}),
    ...(options.createEventSource
      ? { createEventSource: options.createEventSource }
      : {}),
  })
  try {
    await collection.preload()
  } catch (error) {
    await Promise.allSettled([db.cleanup(), browserSession.release()])
    throw error
  }

  let stopped = false
  let sendQueue: Promise<void> = Promise.resolve()
  let outboxRetryDelayMs = outboxRetryInitialDelayMs
  let outboxRetryTimer: ReturnType<typeof setTimeout> | undefined
  let backgroundOutboxFlush: Promise<void> | undefined
  const onlineTarget =
    typeof globalThis.addEventListener === 'function' ? globalThis : undefined

  const postCommand = (command: BuilderProjectSyncCommand) =>
    postBuilderProjectSyncCommandRequest({
      url: syncUrl,
      command,
      fetchRequest,
      signal: abortController.signal,
    })

  const sendCommand = (command: BuilderProjectSyncCommand) =>
    sendBuilderProjectSyncCommandFromOutbox(
      options.projectId,
      command,
      (queuedCommand) => postCommand(queuedCommand),
    )

  const serialize = <TResult>(operation: () => Promise<TResult>) => {
    if (stopped) return Promise.reject(new BuilderProjectSyncStoppedError())

    const result = sendQueue.then(operation)
    sendQueue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  const clearOutboxRetryTimer = () => {
    if (outboxRetryTimer === undefined) return
    clearTimeout(outboxRetryTimer)
    outboxRetryTimer = undefined
  }

  const resetOutboxRetry = () => {
    clearOutboxRetryTimer()
    outboxRetryDelayMs = outboxRetryInitialDelayMs
  }

  const scheduleOutboxRetry = () => {
    if (stopped || outboxRetryTimer !== undefined) return

    const delayMs = outboxRetryDelayMs
    outboxRetryDelayMs = Math.min(outboxRetryDelayMs * 2, outboxRetryMaxDelayMs)
    outboxRetryTimer = setTimeout(() => {
      outboxRetryTimer = undefined
      flushOutboxInBackground()
    }, delayMs)
  }

  const persistCommand = (command: BuilderProjectSyncCommand) => {
    if (command.type === 'run.heartbeat' || command.type === 'run.claim') {
      if (stopped) {
        return Promise.reject(new BuilderProjectSyncStoppedError())
      }
      return postCommand(command).then(requireBuilderProjectSyncCommandResult)
    }

    return serialize(async () => {
      let result: BuilderProjectSyncCommandResult
      try {
        result = await sendCommand(command)
      } catch (error) {
        if (
          error instanceof BuilderProjectSyncCommandRejectedError &&
          error.rejection.sequence !== undefined
        ) {
          await collection.utils.waitForSequence(error.rejection.sequence)
        }
        if (isRetryableBuilderProjectSyncError(error)) scheduleOutboxRetry()
        throw error
      }
      resetOutboxRetry()
      await collection.utils.waitForSequence(result.sequence)
      return result
    })
  }

  const persistRunEnqueue = ({
    thread,
    run,
  }: BuilderProjectSyncRunEnqueueCommands) =>
    serialize(async () => {
      if (thread && thread.thread.id !== run.run.threadId) {
        throw new Error(
          'Builder run thread does not match its creation command',
        )
      }

      const commands = thread ? [thread, run] : [run]
      await enqueueBuilderProjectSyncCommands(options.projectId, commands)
      let replay
      try {
        replay = await replayBuilderProjectSyncOutbox(
          options.projectId,
          (queuedCommand) => postCommand(queuedCommand),
        )
      } catch (error) {
        if (!isRetryableBuilderProjectSyncError(error)) throw error
        scheduleOutboxRetry()
        return {
          clientMutationId: run.clientMutationId,
          sequence: getProjectValue(collection).lastEventSequence,
          events: [],
        }
      }
      resetOutboxRetry()
      const [rejection] = replay.rejections
      if (rejection) {
        throw new BuilderProjectSyncCommandRejectedError(rejection)
      }
      const acknowledgement = replay.acknowledgements.find(
        (candidate) => candidate.clientMutationId === run.clientMutationId,
      )
      if (!acknowledgement) {
        throw new Error('Builder pending run was not acknowledged')
      }
      await collection.utils.waitForSequence(acknowledgement.sequence)
      return acknowledgement
    })

  const flushOutbox = () =>
    serialize(async () => {
      let replay
      try {
        replay = await replayBuilderProjectSyncOutbox(
          options.projectId,
          (queuedCommand) => postCommand(queuedCommand),
        )
      } catch (error) {
        if (isRetryableBuilderProjectSyncError(error)) scheduleOutboxRetry()
        throw error
      }
      resetOutboxRetry()
      await Promise.all(
        replay.acknowledgements.map((result) =>
          collection.utils.waitForSequence(result.sequence),
        ),
      )
      const [rejection] = replay.rejections
      if (rejection) {
        throw new BuilderProjectSyncCommandRejectedError(rejection)
      }
      return replay.acknowledgements
    })

  const flushOutboxInBackground = () => {
    if (stopped || backgroundOutboxFlush) return

    const flush = flushOutbox().then(() => undefined)
    backgroundOutboxFlush = flush
    void flush.then(
      () => {
        if (backgroundOutboxFlush === flush) backgroundOutboxFlush = undefined
      },
      (error: unknown) => {
        if (backgroundOutboxFlush === flush) backgroundOutboxFlush = undefined
        if (!stopped) options.onBackgroundError?.(error)
      },
    )
  }

  const controller: BuilderProjectSyncClient = {
    projectId: options.projectId,
    browserSessionId,
    db,
    collection,
    executeCommand: async (command, optimistic) => {
      const parsedCommand = builderProjectSyncCommandSchema.parse(command)
      const applyOptimistic =
        optimistic ?? getDefaultOptimisticCommand(parsedCommand)
      if (!applyOptimistic) return persistCommand(parsedCommand)

      let result: BuilderProjectSyncCommandResult | undefined
      const transaction = db.createTransaction({
        mutationFn: async () => {
          result = await persistCommand(parsedCommand)
        },
      })
      transaction.mutate(() => applyOptimistic(collection))
      await transaction.isPersisted.promise

      if (!result) {
        throw new Error('Builder project command was not acknowledged')
      }
      return result
    },
    executeRunEnqueue: async (commands) => {
      const { thread, run } = parseBuilderProjectRunEnqueueCommands(commands)
      let result: BuilderProjectSyncCommandResult | undefined
      const transaction = db.createTransaction({
        mutationFn: async () => {
          result = await persistRunEnqueue({
            ...(thread ? { thread } : {}),
            run,
          })
        },
      })
      transaction.mutate(() => {
        if (thread) {
          applyOptimisticBuilderProjectSyncCommand(collection, thread)
        }
        applyOptimisticBuilderProjectSyncCommand(collection, run)
      })
      await transaction.isPersisted.promise

      if (!result) {
        throw new Error('Builder pending run was not acknowledged')
      }
      return result
    },
    flushOutbox,
    cleanup: async () => {
      if (stopped) return
      stopped = true
      clearOutboxRetryTimer()
      onlineTarget?.removeEventListener('online', flushAfterReconnect)
      abortController.abort()
      try {
        await db.cleanup()
      } finally {
        await browserSession.release()
      }
    },
  }

  const flushAfterReconnect = () => {
    resetOutboxRetry()
    flushOutboxInBackground()
  }
  onlineTarget?.addEventListener('online', flushAfterReconnect)
  flushOutboxInBackground()

  return controller
}

function parseBuilderProjectRunEnqueueCommands({
  thread,
  run,
}: BuilderProjectSyncRunEnqueueCommands): BuilderProjectSyncRunEnqueueCommands {
  const parsedRun = builderProjectSyncCommandSchema.parse(run)
  if (parsedRun.type !== 'run.enqueue') {
    throw new Error('Invalid Builder run enqueue command')
  }
  if (!thread) return { run: parsedRun }

  const parsedThread = builderProjectSyncCommandSchema.parse(thread)
  if (parsedThread.type !== 'thread.create') {
    throw new Error('Invalid Builder thread creation command')
  }
  if (parsedThread.thread.id !== parsedRun.run.threadId) {
    throw new Error('Builder run thread does not match its creation command')
  }
  return { thread: parsedThread, run: parsedRun }
}

export async function postBuilderProjectSyncCommand(
  projectId: string,
  command: BuilderProjectSyncCommand,
  signal?: AbortSignal,
) {
  if (!isUuid(projectId)) throw new Error('Invalid Builder project ID')
  return requireBuilderProjectSyncCommandResult(
    await postBuilderProjectSyncCommandRequest({
      url: `/api/builder/projects/${projectId}/sync`,
      command,
      fetchRequest: globalThis.fetch,
      ...(signal ? { signal } : {}),
    }),
  )
}

export type BuilderProjectSyncCollection = ReturnType<
  typeof createBuilderProjectCollection
>

export function getBuilderProjectBrowserSessionId({
  storage = getSessionStorage(),
  createId = crypto.randomUUID,
}: {
  storage?: Pick<Storage, 'getItem' | 'setItem'>
  createId?: () => string
} = {}) {
  const current = storage.getItem(browserSessionStorageKey)
  if (current && isUuid(current)) return current

  const created = createId()
  if (!isUuid(created)) throw new Error('Invalid Builder browser session ID')
  storage.setItem(browserSessionStorageKey, created)
  return created
}

async function claimBuilderProjectBrowserSession({
  storage = getSessionStorage(),
  lockManager = getBrowserSessionLockManager(),
  createId = crypto.randomUUID,
}: {
  storage?: Pick<Storage, 'getItem' | 'setItem'>
  lockManager?: BuilderProjectBrowserSessionLockManager
  createId?: () => string
} = {}) {
  const stored = storage.getItem(browserSessionStorageKey)
  const preferredId =
    stored && isUuid(stored)
      ? stored
      : createBuilderProjectBrowserSessionId(createId)
  if (preferredId !== stored) {
    storage.setItem(browserSessionStorageKey, preferredId)
  }

  if (!lockManager) {
    const id =
      stored && isUuid(stored)
        ? createDistinctBuilderProjectBrowserSessionId(createId, preferredId)
        : preferredId
    storage.setItem(browserSessionStorageKey, id)
    return { id, release: async () => undefined }
  }

  const preferredClaim = await tryClaimBuilderProjectBrowserSession(
    lockManager,
    preferredId,
  )
  if (preferredClaim) return preferredClaim

  const id = createDistinctBuilderProjectBrowserSessionId(createId, preferredId)
  storage.setItem(browserSessionStorageKey, id)
  const claim = await tryClaimBuilderProjectBrowserSession(lockManager, id)
  if (!claim) {
    throw new Error('Generated Builder browser session is already active')
  }
  return claim
}

function tryClaimBuilderProjectBrowserSession(
  lockManager: BuilderProjectBrowserSessionLockManager,
  id: string,
) {
  let request: Promise<void>
  return new Promise<{ id: string; release: () => Promise<void> } | undefined>(
    (resolve, reject) => {
      request = lockManager.request(
        `${browserSessionLockPrefix}${id}`,
        { ifAvailable: true, mode: 'exclusive' },
        async (lock) => {
          if (!lock) {
            resolve(undefined)
            return
          }

          let releaseLock: (() => void) | undefined
          const released = new Promise<void>((release) => {
            releaseLock = release
          })
          let releaseRequested = false
          resolve({
            id,
            release: async () => {
              if (!releaseRequested) {
                releaseRequested = true
                releaseLock?.()
              }
              await request
            },
          })
          await released
        },
      )
      void request.catch(reject)
    },
  )
}

function createDistinctBuilderProjectBrowserSessionId(
  createId: () => string,
  currentId: string,
) {
  const id = createBuilderProjectBrowserSessionId(createId)
  if (id === currentId) {
    throw new Error('Builder browser session ID was reused')
  }
  return id
}

function createBuilderProjectBrowserSessionId(createId: () => string) {
  const id = createId()
  if (!isUuid(id)) throw new Error('Invalid Builder browser session ID')
  return id
}

function getBrowserSessionLockManager():
  | BuilderProjectBrowserSessionLockManager
  | undefined {
  if (typeof navigator === 'undefined' || !navigator.locks) return undefined
  return {
    request: (name, options, callback) =>
      navigator.locks.request(name, options, (lock) => callback(lock)),
  }
}

export function builderProjectSyncRowKey(
  kind: BuilderProjectSyncRow['kind'],
  id: string,
) {
  return `${kind}:${id}`
}

export function builderProjectSyncProjectRow(
  value: BuilderProjectSyncProject,
): BuilderProjectSyncRow {
  return {
    key: builderProjectSyncRowKey('project', value.id),
    kind: 'project',
    value,
  }
}

export function builderProjectSyncThreadRow(
  value: BuilderProjectSyncThread,
): BuilderProjectSyncRow {
  return {
    key: builderProjectSyncRowKey('thread', value.id),
    kind: 'thread',
    value,
  }
}

export function builderProjectSyncMessageRow(
  value: BuilderProjectSyncMessage,
): BuilderProjectSyncRow {
  return {
    key: builderProjectSyncRowKey('message', value.id),
    kind: 'message',
    value,
  }
}

export function builderProjectSyncRunRow(
  value: BuilderProjectSyncRun,
): BuilderProjectSyncRow {
  return {
    key: builderProjectSyncRowKey('run', value.id),
    kind: 'run',
    value,
  }
}

export function getBuilderProjectSyncSnapshotChanges(
  snapshot: BuilderProjectSyncSnapshot,
): ReadonlyArray<BuilderProjectSyncRowChange> {
  return [
    { type: 'insert', value: builderProjectSyncProjectRow(snapshot.project) },
    ...snapshot.threads.map(
      (thread): BuilderProjectSyncRowChange => ({
        type: 'insert',
        value: builderProjectSyncThreadRow(thread),
      }),
    ),
    ...snapshot.messages.map(
      (message): BuilderProjectSyncRowChange => ({
        type: 'insert',
        value: builderProjectSyncMessageRow(message),
      }),
    ),
    ...snapshot.runs.map(
      (run): BuilderProjectSyncRowChange => ({
        type: 'insert',
        value: builderProjectSyncRunRow(run),
      }),
    ),
  ]
}

export function getBuilderProjectSyncEventChanges(
  currentProject: BuilderProjectSyncProject,
  event: BuilderProjectSyncEvent,
): {
  project: BuilderProjectSyncProject | undefined
  changes: ReadonlyArray<BuilderProjectSyncRowChange>
} {
  assertEventProject(currentProject, event)
  const changes: Array<BuilderProjectSyncRowChange> = []
  let nextProject = currentProject

  switch (event.type) {
    case 'project.created':
    case 'project.updated': {
      const project = builderProjectSyncProjectSchema.parse(
        event.payload.project,
      )
      assertEventProject(project, event)
      nextProject = { ...project, lastEventSequence: event.sequence }
      break
    }
    case 'project.deleted':
      return {
        project: undefined,
        changes: [
          {
            type: 'delete',
            key: builderProjectSyncRowKey('project', currentProject.id),
          },
        ],
      }
    case 'thread.created':
    case 'thread.updated':
    case 'thread.archived': {
      const thread = builderProjectSyncThreadSchema.parse(event.payload.thread)
      assertEventEntity(thread, event, event.threadId)
      changes.push({
        type: 'update',
        value: builderProjectSyncThreadRow(thread),
      })
      break
    }
    case 'message.created':
    case 'message.updated': {
      const message = builderProjectSyncMessageSchema.parse(
        event.payload.message,
      )
      assertEventEntity(message, event, event.messageId)
      changes.push({
        type: 'update',
        value: builderProjectSyncMessageRow(message),
      })
      break
    }
    case 'message.deleted':
      if (!event.messageId) throw new Error('Invalid Builder message event')
      changes.push({
        type: 'delete',
        key: builderProjectSyncRowKey('message', event.messageId),
      })
      break
    case 'run.created':
    case 'run.started':
    case 'run.activity':
    case 'run.interrupted':
    case 'run.completed':
    case 'run.failed':
    case 'run.cancelled': {
      const run = builderProjectSyncRunSchema.parse(event.payload.run)
      assertEventEntity(run, event, event.runId)
      changes.push({
        type: 'update',
        value: builderProjectSyncRunRow(run),
      })
      break
    }
    case 'revision.created':
      break
  }

  nextProject = {
    ...nextProject,
    lastEventSequence: event.sequence,
  }
  changes.push({
    type: 'update',
    value: builderProjectSyncProjectRow(nextProject),
  })
  return { project: nextProject, changes }
}

export function applyOptimisticBuilderProjectSyncCommand(
  collection: BuilderProjectSyncCollection,
  command: BuilderProjectSyncCommand,
) {
  const project = getProjectValue(collection)
  const now = new Date().toISOString()

  switch (command.type) {
    case 'project.revise': {
      setProjectValue(collection, {
        ...project,
        title: command.project.title,
        description: command.project.description,
        updatedAt: now,
      })
      break
    }
    case 'thread.create': {
      const createdAt = command.thread.createdAt ?? now
      setThreadValue(collection, {
        id: command.thread.id,
        projectId: project.id,
        ownerId: project.ownerId,
        clientMutationId: command.clientMutationId,
        title: command.thread.title,
        lastMessagePosition: 0,
        createdAt,
        updatedAt: createdAt,
        archivedAt: null,
      })
      break
    }
    case 'run.enqueue': {
      const thread = getThreadValue(collection, command.run.threadId)
      const createdAt = command.userMessage.createdAt ?? now
      const position = (thread?.lastMessagePosition ?? 0) + 1
      setMessageValue(collection, {
        id: command.userMessage.id,
        projectId: project.id,
        ownerId: project.ownerId,
        threadId: command.run.threadId,
        runId: command.run.id,
        clientMutationId: command.userMessage.clientMutationId,
        role: 'user',
        content: command.userMessage.content,
        parts: command.userMessage.parts,
        position,
        createdAt,
        updatedAt: createdAt,
      })
      setRunValue(collection, {
        id: command.run.id,
        projectId: project.id,
        ownerId: project.ownerId,
        threadId: command.run.threadId,
        clientMutationId: command.clientMutationId,
        status: 'pending',
        queueKind: command.run.queueKind,
        provider: command.run.provider,
        model: command.run.model,
        baseRevisionId: null,
        resultRevisionId: null,
        leaseOwnerId: null,
        leaseFencingToken: 0,
        leaseExpiresAt: null,
        lastHeartbeatAt: null,
        activity: null,
        error: null,
        startedAt: null,
        completedAt: null,
        createdAt,
        updatedAt: createdAt,
      })
      if (thread) {
        setThreadValue(collection, {
          ...thread,
          lastMessagePosition: position,
          updatedAt: createdAt,
        })
      }
      break
    }
    case 'run.claim': {
      const run = getRunValue(collection, command.runId)
      if (!run) break
      setRunValue(collection, {
        ...run,
        status: 'running',
        baseRevisionId: project.currentRevisionId,
        leaseOwnerId: command.leaseOwnerId,
        leaseExpiresAt: null,
        lastHeartbeatAt: now,
        startedAt: now,
        updatedAt: now,
      })
      break
    }
    case 'run.cancel': {
      const run = getRunValue(collection, command.runId)
      if (!run) break
      setRunValue(collection, {
        ...run,
        status: 'cancelled',
        completedAt: now,
        updatedAt: now,
      })
      break
    }
    case 'run.finish': {
      const run = getRunValue(collection, command.runId)
      if (!run) break

      setRunValue(collection, {
        ...run,
        status: command.status,
        resultRevisionId: command.revision?.id ?? null,
        leaseOwnerId: null,
        leaseExpiresAt: null,
        lastHeartbeatAt: now,
        activity: command.activity ?? null,
        error: command.error ?? null,
        completedAt: now,
        updatedAt: now,
      })

      const thread = getThreadValue(collection, run.threadId)
      if (command.assistantMessage) {
        const createdAt = command.assistantMessage.createdAt ?? now
        const position = (thread?.lastMessagePosition ?? 0) + 1
        setMessageValue(collection, {
          id: command.assistantMessage.id,
          projectId: project.id,
          ownerId: project.ownerId,
          threadId: run.threadId,
          runId: run.id,
          clientMutationId: command.assistantMessage.clientMutationId,
          role: 'assistant',
          content: command.assistantMessage.content,
          parts: command.assistantMessage.parts,
          position,
          createdAt,
          updatedAt: now,
        })
        if (thread) {
          setThreadValue(collection, {
            ...thread,
            lastMessagePosition: position,
            updatedAt: now,
          })
        }
      }

      if (command.revision) {
        setProjectValue(collection, {
          ...project,
          title: command.revision.title,
          description: command.revision.description,
          snapshotHash: command.revision.snapshotHash,
          currentRevisionId: command.revision.id,
          currentRevisionNumber: command.revision.expectedRevisionNumber + 1,
          updatedAt: now,
        })
      }
      break
    }
    case 'transcript.import': {
      const highestPositions = new Map<string, number>()
      for (const message of command.messages) {
        highestPositions.set(
          message.threadId,
          Math.max(
            highestPositions.get(message.threadId) ?? 0,
            message.position,
          ),
        )
      }

      for (const thread of command.threads) {
        setThreadValue(collection, {
          id: thread.id,
          projectId: project.id,
          ownerId: project.ownerId,
          clientMutationId: command.clientMutationId,
          title: thread.title,
          lastMessagePosition: highestPositions.get(thread.id) ?? 0,
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
          archivedAt: thread.archivedAt ?? null,
        })
      }
      for (const run of command.runs) {
        setRunValue(collection, {
          id: run.id,
          projectId: project.id,
          ownerId: project.ownerId,
          threadId: run.threadId,
          clientMutationId: command.clientMutationId,
          status: run.status,
          queueKind: 'queue',
          provider: run.provider,
          model: run.model,
          baseRevisionId: null,
          resultRevisionId: null,
          leaseOwnerId: null,
          leaseFencingToken: 0,
          leaseExpiresAt: null,
          lastHeartbeatAt: null,
          activity: run.activity ?? null,
          error: run.error ?? null,
          startedAt: run.startedAt ?? null,
          completedAt: run.completedAt,
          createdAt: run.startedAt ?? run.completedAt,
          updatedAt: run.completedAt,
        })
      }
      for (const message of command.messages) {
        setMessageValue(collection, {
          id: message.id,
          projectId: project.id,
          ownerId: project.ownerId,
          threadId: message.threadId,
          runId: message.runId ?? null,
          clientMutationId: command.clientMutationId,
          role: message.role,
          content: message.content,
          parts: message.parts,
          position: message.position,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        })
      }
      break
    }
    case 'run.heartbeat':
      break
  }
}

function getDefaultOptimisticCommand(command: BuilderProjectSyncCommand) {
  if (command.type === 'run.heartbeat') return undefined
  return (collection: BuilderProjectSyncCollection) =>
    applyOptimisticBuilderProjectSyncCommand(collection, command)
}

function getProjectValue(collection: BuilderProjectSyncCollection) {
  for (const row of collection.values()) {
    if (row.kind === 'project') return row.value
  }
  throw new Error('Builder project sync collection has no project')
}

function getThreadValue(
  collection: BuilderProjectSyncCollection,
  threadId: string,
) {
  const row = collection.get(builderProjectSyncRowKey('thread', threadId))
  return row?.kind === 'thread' ? row.value : undefined
}

function getRunValue(collection: BuilderProjectSyncCollection, runId: string) {
  const row = collection.get(builderProjectSyncRowKey('run', runId))
  return row?.kind === 'run' ? row.value : undefined
}

function setProjectValue(
  collection: BuilderProjectSyncCollection,
  project: BuilderProjectSyncProject,
) {
  const key = builderProjectSyncRowKey('project', project.id)
  if (!collection.has(key)) {
    collection.insert(builderProjectSyncProjectRow(project))
    return
  }
  collection.update(key, (draft) => {
    if (draft.kind === 'project') draft.value = project
  })
}

function setThreadValue(
  collection: BuilderProjectSyncCollection,
  thread: BuilderProjectSyncThread,
) {
  const key = builderProjectSyncRowKey('thread', thread.id)
  if (!collection.has(key)) {
    collection.insert(builderProjectSyncThreadRow(thread))
    return
  }
  collection.update(key, (draft) => {
    if (draft.kind === 'thread') draft.value = thread
  })
}

function setMessageValue(
  collection: BuilderProjectSyncCollection,
  message: BuilderProjectSyncMessage,
) {
  const key = builderProjectSyncRowKey('message', message.id)
  if (!collection.has(key)) {
    collection.insert(builderProjectSyncMessageRow(message))
    return
  }
  collection.update(key, (draft) => {
    if (draft.kind === 'message') draft.value = message
  })
}

function setRunValue(
  collection: BuilderProjectSyncCollection,
  run: BuilderProjectSyncRun,
) {
  const key = builderProjectSyncRowKey('run', run.id)
  if (!collection.has(key)) {
    collection.insert(builderProjectSyncRunRow(run))
    return
  }
  collection.update(key, (draft) => {
    if (draft.kind === 'run') draft.value = run
  })
}

function createBuilderProjectCollection({
  db,
  syncUrl,
  snapshot,
  headCursor,
  fetchRequest,
  createEventSource,
  onStreamError,
}: {
  db: DbClient
  syncUrl: string
  snapshot: BuilderProjectSyncSnapshot
  headCursor: number
  fetchRequest: FetchLike
  createEventSource?: (url: string) => EventSourceLike
  onStreamError?: (error: unknown) => void
}) {
  return db.collection(
    createReplayableCollectionOptions<BuilderProjectSyncRow, string>({
      id: `builder-project-sync:${snapshot.project.id}`,
      getKey: (row) => row.key,
      openStream: (context) =>
        openBuilderProjectStream({
          context,
          syncUrl,
          snapshot,
          headCursor,
          fetchRequest,
          ...(onStreamError ? { onStreamError } : {}),
          ...(createEventSource ? { createEventSource } : {}),
        }),
    }),
  )
}

function openBuilderProjectStream({
  context,
  syncUrl,
  snapshot,
  headCursor,
  fetchRequest,
  createEventSource,
  onStreamError,
}: {
  context: ReplayableStreamContext<BuilderProjectSyncRow, string>
  syncUrl: string
  snapshot: BuilderProjectSyncSnapshot
  headCursor: number
  fetchRequest: FetchLike
  createEventSource?: (url: string) => EventSourceLike
  onStreamError?: (error: unknown) => void
}) {
  if (context.after > snapshot.cursor) {
    throw new Error('Builder project sync cursor is ahead of the snapshot')
  }

  let cursor = context.after
  let project = snapshot.project
  let knownKeys = getBuilderProjectSyncSnapshotKeys(snapshot)
  let readyCursor = headCursor
  if (cursor < snapshot.cursor) {
    context.publish({
      sequence: snapshot.cursor,
      changes: getBuilderProjectSyncSnapshotChanges(snapshot),
    })
    cursor = snapshot.cursor
  }

  let stopped = false
  let recovering = false
  let closeSource: (() => void) | undefined

  const markCaughtUpIfReady = () => {
    if (cursor >= readyCursor) context.markCaughtUp()
  }

  const reportStreamError = (error: unknown) => {
    try {
      onStreamError?.(error)
    } catch {
      // Error reporting must not stop authoritative recovery.
    }
  }

  const recover = (streamError: unknown) => {
    reportStreamError(streamError)
    if (recovering || stopped || context.signal.aborted) return
    recovering = true

    void (async () => {
      while (!stopped && !context.signal.aborted) {
        try {
          const authoritative = await fetchBuilderProjectSyncSnapshot(
            syncUrl,
            fetchRequest,
            snapshot.project.id,
            context.signal,
          )
          if (stopped || context.signal.aborted) return

          const replacement = getBuilderProjectSyncSnapshotReplacementChanges(
            knownKeys,
            authoritative.snapshot,
          )
          context.replace({
            sequence: authoritative.snapshot.cursor,
            changes: replacement.changes,
          })
          cursor = authoritative.snapshot.cursor
          project = authoritative.snapshot.project
          knownKeys = replacement.keys
          readyCursor = authoritative.headCursor
          recovering = false
          closeSource?.()
          openSource()
          return
        } catch (error) {
          if (stopped || context.signal.aborted) return
          reportStreamError(error)
          await waitForBuilderProjectSyncRetry(context.signal)
        }
      }
    })()
  }

  const openSource = () => {
    if (stopped || recovering || context.signal.aborted) return
    markCaughtUpIfReady()
    closeSource = openReplayableEventSource({
      url: syncUrl,
      after: cursor,
      signal: context.signal,
      eventType: 'project-event',
      parse: (value) => builderProjectSyncEventSchema.parse(value),
      onError: recover,
      onEvent: (event) => {
        if (event.sequence <= cursor) return
        if (event.sequence !== cursor + 1) {
          throw new Error(`Builder project event sequence gap after ${cursor}`)
        }

        const mapped = getBuilderProjectSyncEventChanges(project, event)
        context.publish({ sequence: event.sequence, changes: mapped.changes })
        rememberBuilderProjectSyncChanges(knownKeys, mapped.changes)
        cursor = event.sequence
        if (mapped.project) project = mapped.project
        markCaughtUpIfReady()
      },
      ...(createEventSource ? { createEventSource } : {}),
    })
  }

  openSource()
  return () => {
    stopped = true
    closeSource?.()
  }
}

async function fetchBuilderProjectSyncSnapshot(
  url: string,
  fetchRequest: FetchLike,
  expectedProjectId: string,
  signal?: AbortSignal,
) {
  let project: BuilderProjectSyncProject | undefined
  let cursor: number | undefined
  let headCursor: number | undefined
  let continuation: string | null = null
  const seenContinuations = new Set<string>()
  const threadIds = new Set<string>()
  const messageIds = new Set<string>()
  const runIds = new Set<string>()
  const threads: Array<BuilderProjectSyncThread> = []
  const messages: Array<BuilderProjectSyncMessage> = []
  const runs: Array<BuilderProjectSyncRun> = []

  do {
    if (continuation) {
      if (seenContinuations.has(continuation)) {
        throw new Error('Builder project sync continuation did not advance')
      }
      seenContinuations.add(continuation)
    }

    const pageUrl = continuation
      ? `${url}?continuation=${encodeURIComponent(continuation)}`
      : url
    const response = await fetchRequest(pageUrl, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      ...(signal ? { signal } : {}),
    })
    if (!response.ok) throw await createHttpError(response)
    const page = builderProjectSyncSnapshotPageSchema.parse(
      await response.json(),
    )

    if (!project) {
      if (
        !page.project ||
        page.project.id !== expectedProjectId ||
        page.project.lastEventSequence !== page.cursor
      ) {
        throw new Error('Invalid Builder project sync snapshot first page')
      }
      project = page.project
      cursor = page.cursor
      headCursor = page.headCursor
    } else if (
      page.project ||
      page.cursor !== cursor ||
      (headCursor !== undefined && page.headCursor < headCursor)
    ) {
      throw new Error('Builder project sync snapshot barrier changed')
    } else {
      headCursor = page.headCursor
    }

    appendBuilderProjectSyncSnapshotEntities(
      threads,
      page.threads,
      threadIds,
      project,
    )
    appendBuilderProjectSyncSnapshotEntities(
      messages,
      page.messages,
      messageIds,
      project,
    )
    appendBuilderProjectSyncSnapshotEntities(runs, page.runs, runIds, project)
    continuation = page.continuation
  } while (continuation)

  if (!project || cursor === undefined || headCursor === undefined) {
    throw new Error('Invalid Builder project sync snapshot')
  }
  return {
    snapshot: builderProjectSyncSnapshotSchema.parse({
      project,
      cursor,
      threads,
      messages,
      runs,
    }),
    headCursor,
  }
}

function appendBuilderProjectSyncSnapshotEntities<
  TEntity extends {
    id: string
    projectId: string
    ownerId: string
  },
>(
  target: Array<TEntity>,
  entities: ReadonlyArray<TEntity>,
  entityIds: Set<string>,
  project: BuilderProjectSyncProject,
) {
  for (const entity of entities) {
    if (
      entity.projectId !== project.id ||
      entity.ownerId !== project.ownerId ||
      entityIds.has(entity.id)
    ) {
      throw new Error('Invalid Builder project sync snapshot entity')
    }
    entityIds.add(entity.id)
    target.push(entity)
  }
}

function getBuilderProjectSyncSnapshotKeys(
  snapshot: BuilderProjectSyncSnapshot,
) {
  return new Set(
    getBuilderProjectSyncSnapshotChanges(snapshot).flatMap((change) =>
      change.type === 'delete' ? [] : [change.value.key],
    ),
  )
}

function getBuilderProjectSyncSnapshotReplacementChanges(
  currentKeys: ReadonlySet<string>,
  snapshot: BuilderProjectSyncSnapshot,
) {
  const rows: Array<BuilderProjectSyncRow> = [
    builderProjectSyncProjectRow(snapshot.project),
    ...snapshot.threads.map(builderProjectSyncThreadRow),
    ...snapshot.messages.map(builderProjectSyncMessageRow),
    ...snapshot.runs.map(builderProjectSyncRunRow),
  ]
  const keys = new Set(rows.map((row) => row.key))
  const changes: Array<BuilderProjectSyncRowChange> = []

  for (const key of currentKeys) {
    if (!keys.has(key)) changes.push({ type: 'delete', key })
  }
  for (const row of rows) {
    changes.push({
      type: currentKeys.has(row.key) ? 'update' : 'insert',
      value: row,
    })
  }
  return { changes, keys }
}

function rememberBuilderProjectSyncChanges(
  keys: Set<string>,
  changes: ReadonlyArray<BuilderProjectSyncRowChange>,
) {
  for (const change of changes) {
    if (change.type === 'delete') keys.delete(change.key)
    else keys.add(change.value.key)
  }
}

function waitForBuilderProjectSyncRetry(signal: AbortSignal) {
  if (signal.aborted) return Promise.resolve()

  return new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timeout)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const timeout = setTimeout(finish, 500)
    signal.addEventListener('abort', finish, { once: true })
  })
}

async function postBuilderProjectSyncCommandRequest({
  url,
  command,
  fetchRequest,
  signal,
}: {
  url: string
  command: BuilderProjectSyncCommand
  fetchRequest: FetchLike
  signal?: AbortSignal
}) {
  const timeoutSignal = AbortSignal.timeout(
    command.type === 'run.heartbeat'
      ? heartbeatRequestTimeoutMs
      : commandRequestTimeoutMs,
  )
  const response = await fetchRequest(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ commands: [command] }),
    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
  })
  if (!response.ok) throw await createHttpError(response)

  const body = builderProjectSyncResponseSchema.parse(await response.json())
  const [result] = body.results
  if (
    body.results.length !== 1 ||
    !result ||
    result.clientMutationId !== command.clientMutationId ||
    (!isBuilderProjectSyncCommandRejection(result) &&
      body.cursor < result.sequence)
  ) {
    throw new Error('Invalid Builder project sync acknowledgement')
  }
  return result
}

function requireBuilderProjectSyncCommandResult(
  outcome: BuilderProjectSyncCommandOutcome,
) {
  if (isBuilderProjectSyncCommandRejection(outcome)) {
    throw new BuilderProjectSyncCommandRejectedError(outcome)
  }
  return outcome
}

async function createHttpError(response: Response) {
  const contentType = response.headers.get('content-type')
  let message = `Builder project sync failed with status ${response.status}`
  if (contentType?.includes('application/json')) {
    const value: unknown = await response.json()
    if (
      typeof value === 'object' &&
      value !== null &&
      'error' in value &&
      typeof value.error === 'string'
    ) {
      message = value.error
    }
  }
  return new BuilderProjectSyncHttpError(response.status, message)
}

function assertEventProject(
  project: BuilderProjectSyncProject,
  event: BuilderProjectSyncEvent,
) {
  if (project.id !== event.projectId || project.ownerId !== event.ownerId) {
    throw new Error('Builder project event belongs to another project')
  }
}

function assertEventEntity(
  entity: { id: string; projectId: string; ownerId: string },
  event: BuilderProjectSyncEvent,
  eventEntityId: string | null,
) {
  if (
    entity.id !== eventEntityId ||
    entity.projectId !== event.projectId ||
    entity.ownerId !== event.ownerId
  ) {
    throw new Error('Builder project event contains the wrong entity')
  }
}

function getSessionStorage() {
  if (typeof globalThis.sessionStorage === 'undefined') {
    throw new Error('Builder browser session storage is unavailable')
  }
  return globalThis.sessionStorage
}

function isUuid(value: string) {
  return uuidPattern.test(value)
}
