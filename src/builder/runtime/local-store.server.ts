import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { AsyncLocalStorage } from 'node:async_hooks'
import os from 'node:os'
import path from 'node:path'
import type {
  BuilderExportKind,
  BuilderExportStatus,
  BuilderLocalFileBlob,
  BuilderLocalManifestBundle,
  BuilderManifestChangeSummary,
  BuilderManifest,
  BuilderMessageStatus,
  BuilderRunStatus,
  BuilderStateEvent,
  BuilderTimelineProducer,
} from '~/builder/schema'
import {
  getLocalManifestFiles,
  getLocalManifestTotalBytes,
  summarizeLocalManifestChanges,
} from '~/builder/manifest'
import {
  projectLocalBuilderTimeline,
  type LocalAgentEventRecordedPayload,
  type LocalBuilderTimelineEvent,
  type LocalWorkflowEventRecordedPayload,
} from '~/builder/projection'

export const LOCAL_FORGE_PROJECT_ID = 'local-project'
export const LOCAL_FORGE_SESSION_ID = 'local-session'
export const LOCAL_FORGE_WORKFLOW_LOCK_NAME = 'workflow'

const runtimeDir = path.join(process.cwd(), '.tanstack', 'forge-runtime')
const chatsPath = path.join(runtimeDir, 'chats.json')
const LOCK_POLL_MS = 25
const LOCK_REFRESH_MIN_MS = 25
const TIMELINE_APPEND_LOCK_STALE_MS = 60_000
const TIMELINE_APPEND_LOCK_WAIT_MS = 30_000
const workspaceRootId = Buffer.from(process.cwd()).toString('base64url')
const DEFAULT_LOCAL_FORGE_CHAT_TITLE = 'New chat'
let activeLocalForgeSessionId = LOCAL_FORGE_SESSION_ID
const localForgeSessionStorage = new AsyncLocalStorage<string>()

export interface LocalForgeChat {
  createdAt: string
  id: string
  title: string
  updatedAt: string
}

export interface LocalForgeSnapshot {
  activeChatId: string
  agentEvents: Array<LocalAgentEventRecordedPayload & { createdAt: string }>
  chats: Array<LocalForgeChat>
  currentManifest?: BuilderManifest
  exports: Array<{
    branch?: string
    byteLength?: number
    commitSha?: string
    completedAt?: string
    error?: string
    fileName?: string
    id: string
    kind: BuilderExportKind
    manifestVersionId: string
    repoName?: string
    repoOwner?: string
    repoUrl?: string
    runId?: string
    startedAt: string
    status: BuilderExportStatus
    visibility?: 'private' | 'public'
  }>
  fileCount: number
  files: Record<string, string>
  latestRun?: {
    createdAt?: string
    endedAt?: string
    error?: string
    id: string
    startedAt?: string
    status: string
  }
  manifestChange?: BuilderManifestChangeSummary
  manifestVersionId?: string
  messages: Array<{
    content?: string
    completedAt?: string
    createdAt: string
    id: string
    role: string
    runId?: string
    status: BuilderMessageStatus
  }>
  packageManager?: string
  framework?: string
  devCommand?: string
  stateEventCount: number
  timelineEventCount: number
  topFiles: Array<string>
  totalBytes: number
  warnings: Array<string>
  workflowEvents: Array<
    LocalWorkflowEventRecordedPayload & { createdAt: string }
  >
}

export interface LocalForgeSnapshotStreamEvent {
  snapshot: LocalForgeSnapshot
  stateOffset: number
  timelineOffset: number
  type: 'snapshot'
}

export interface LocalForgeStateStreamBatch {
  events: Array<BuilderStateEvent>
  stateOffset: number
  timelineOffset: number
  type: 'state-batch'
}

export interface LocalForgeLockLease {
  release: () => Promise<void>
}

type LocalForgeStateSubscriber = (
  event: LocalForgeStateStreamBatch,
  runtimeSessionId: string,
) => void
type LocalForgeChatIndex = {
  activeChatId: string
  chats: Array<LocalForgeChat>
}

const localForgeStateSubscribers = new Set<LocalForgeStateSubscriber>()

export async function readLocalForgeSnapshot(): Promise<LocalForgeSnapshot> {
  const chatIndex = await readLocalForgeChats()
  await ensureRuntimeDirs()

  return readLocalForgeSnapshotWithChatIndex(chatIndex)
}

export async function readLocalForgeSnapshotForRuntimeSession({
  activeChatId,
  chats,
  runtimeSessionId,
}: {
  activeChatId: string
  chats: Array<LocalForgeChat>
  runtimeSessionId: string
}) {
  return withLocalForgeRuntimeSession(runtimeSessionId, async () => {
    await ensureRuntimeDirs()

    return readLocalForgeSnapshotWithChatIndex({
      activeChatId,
      chats,
    })
  })
}

async function readLocalForgeSnapshotWithChatIndex(
  chatIndex: LocalForgeChatIndex,
): Promise<LocalForgeSnapshot> {
  const timelineEvents = await readLocalForgeTimeline()
  const stateEvents = projectLocalBuilderTimeline(timelineEvents)
  const currentManifest = await readCurrentManifest(timelineEvents)
  const files = currentManifest ? await readManifestFiles(currentManifest) : {}
  const manifestChange = currentManifest
    ? await readManifestChangeSummary(currentManifest, files)
    : undefined
  const filePaths = Object.keys(files).sort()
  const latestRun = readLatestRun(stateEvents)

  return {
    activeChatId: chatIndex.activeChatId,
    agentEvents: readAgentEvents(stateEvents),
    chats: chatIndex.chats,
    currentManifest,
    devCommand: currentManifest?.sandbox.devCommand,
    exports: readExports(stateEvents),
    fileCount: filePaths.length,
    files,
    framework: currentManifest?.app.framework,
    latestRun,
    manifestChange,
    manifestVersionId: currentManifest?.manifestVersionId,
    messages: readMessages(stateEvents),
    packageManager: currentManifest?.app.packageManager,
    stateEventCount: stateEvents.length,
    timelineEventCount: timelineEvents.length,
    topFiles: filePaths.slice(0, 12),
    totalBytes: currentManifest
      ? getLocalManifestTotalBytes(currentManifest)
      : 0,
    warnings: currentManifest?.warnings ?? [],
    workflowEvents: readWorkflowEvents(stateEvents),
  }
}

export async function readLocalForgeChats() {
  const chatIndex = await ensureLocalForgeChatIndex()

  return {
    activeChatId: chatIndex.activeChatId,
    chats: [...chatIndex.chats].sort((left, right) => {
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
    }),
  }
}

export async function createLocalForgeChat() {
  const chatIndex = await ensureLocalForgeChatIndex()
  await assertNoActiveLocalForgeRun('create a new chat')

  const now = new Date().toISOString()
  const chat: LocalForgeChat = {
    createdAt: now,
    id: `local-chat-${crypto.randomUUID()}`,
    title: DEFAULT_LOCAL_FORGE_CHAT_TITLE,
    updatedAt: now,
  }
  const nextIndex = {
    activeChatId: chat.id,
    chats: [chat, ...chatIndex.chats],
  }

  activeLocalForgeSessionId = chat.id
  await writeLocalForgeChatIndex(nextIndex)
  await ensureRuntimeDirs()
  await writeJsonLines(getTimelinePath(), [])
  await writeJsonLines(getStatePath(), [])

  return readLocalForgeSnapshot()
}

export async function selectLocalForgeChat(chatId: string) {
  const chatIndex = await ensureLocalForgeChatIndex()
  const chat = chatIndex.chats.find((item) => item.id === chatId)

  if (!chat) {
    throw new Error(`Forge chat ${chatId} was not found.`)
  }

  if (chat.id !== chatIndex.activeChatId) {
    await assertNoActiveLocalForgeRun('switch chats')
  }

  activeLocalForgeSessionId = chat.id
  await writeLocalForgeChatIndex({
    ...chatIndex,
    activeChatId: chat.id,
  })
  await ensureRuntimeDirs()

  return readLocalForgeSnapshot()
}

export async function deleteLocalForgeChat(chatId: string) {
  const chatIndex = await ensureLocalForgeChatIndex()
  const chat = chatIndex.chats.find((item) => item.id === chatId)

  if (!chat) {
    return readLocalForgeSnapshot()
  }

  if (chat.id === chatIndex.activeChatId) {
    await assertNoActiveLocalForgeRun('delete the active chat')
  }

  const remainingChats = chatIndex.chats.filter((item) => item.id !== chatId)
  const nextActiveChat =
    chatIndex.activeChatId === chatId
      ? [...remainingChats].sort((left, right) => {
          return Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
        })[0]
      : chatIndex.chats.find((item) => item.id === chatIndex.activeChatId)

  await rm(getLocalForgeSessionDir(chatId), { force: true, recursive: true })

  if (!nextActiveChat) {
    const now = new Date().toISOString()
    const replacementChat: LocalForgeChat = {
      createdAt: now,
      id: `local-chat-${crypto.randomUUID()}`,
      title: DEFAULT_LOCAL_FORGE_CHAT_TITLE,
      updatedAt: now,
    }

    activeLocalForgeSessionId = replacementChat.id
    await writeLocalForgeChatIndex({
      activeChatId: replacementChat.id,
      chats: [replacementChat],
    })
    await ensureRuntimeDirs()
    await writeJsonLines(getTimelinePath(), [])
    await writeJsonLines(getStatePath(), [])

    return readLocalForgeSnapshot()
  }

  activeLocalForgeSessionId = nextActiveChat.id
  await writeLocalForgeChatIndex({
    activeChatId: nextActiveChat.id,
    chats: remainingChats,
  })
  await ensureRuntimeDirs()

  return readLocalForgeSnapshot()
}

export async function updateActiveLocalForgeChatTitleFromPrompt(
  prompt: string,
) {
  const title = prompt.trim().replace(/\s+/g, ' ').slice(0, 64)

  if (!title) {
    return
  }

  await updateActiveLocalForgeChat({ title })
}

export function getActiveLocalForgeSessionId() {
  return getCurrentLocalForgeSessionId()
}

export function getLocalForgeWorkspaceDir(sessionId?: string) {
  return path.join(
    os.tmpdir(),
    'tanstack-forge-runtime',
    workspaceRootId,
    toSafeLocalForgeChatId(sessionId ?? getCurrentLocalForgeSessionId()),
    'workspace',
  )
}

export function getLocalForgeCurrentWorkspaceDir(sessionId?: string) {
  return path.join(getLocalForgeWorkspaceDir(sessionId), 'current')
}

export async function withLocalForgeRuntimeSession<T>(
  runtimeSessionId: string,
  task: () => Promise<T>,
) {
  return localForgeSessionStorage.run(
    toSafeLocalForgeChatId(runtimeSessionId),
    task,
  )
}

export async function initializeLocalForgeRuntimeSession(
  runtimeSessionId: string,
) {
  await withLocalForgeRuntimeSession(runtimeSessionId, async () => {
    await ensureRuntimeDirs()
    await writeJsonLines(getTimelinePath(), [])
    await writeJsonLines(getStatePath(), [])
  })
}

export async function deleteLocalForgeRuntimeSession(runtimeSessionId: string) {
  await rm(getLocalForgeSessionDir(runtimeSessionId), {
    force: true,
    recursive: true,
  })
}

export async function assertNoActiveLocalForgeRun(action: string) {
  const snapshot = await readLocalForgeSnapshot()
  const latestRun = snapshot.latestRun

  if (!latestRun || !isActiveLocalForgeRunStatus(latestRun.status)) {
    return
  }

  throw new Error(
    `Cannot ${action} while Forge run ${latestRun.id} is ${latestRun.status}.`,
  )
}

export function isActiveLocalForgeRunStatus(status: string) {
  switch (status) {
    case 'finishing':
    case 'paused':
    case 'queued':
    case 'running':
    case 'starting':
      return true
    default:
      return false
  }
}

export async function readLocalForgeSnapshotStreamEvent(): Promise<LocalForgeSnapshotStreamEvent> {
  const snapshot = await readLocalForgeSnapshot()

  return {
    snapshot,
    stateOffset: snapshot.stateEventCount,
    timelineOffset: snapshot.timelineEventCount,
    type: 'snapshot',
  }
}

export async function readLocalForgeSnapshotStreamEventForRuntimeSession({
  activeChatId,
  chats,
  runtimeSessionId,
}: {
  activeChatId: string
  chats: Array<LocalForgeChat>
  runtimeSessionId: string
}): Promise<LocalForgeSnapshotStreamEvent> {
  const snapshot = await readLocalForgeSnapshotForRuntimeSession({
    activeChatId,
    chats,
    runtimeSessionId,
  })

  return {
    snapshot,
    stateOffset: snapshot.stateEventCount,
    timelineOffset: snapshot.timelineEventCount,
    type: 'snapshot',
  }
}

export function subscribeLocalForgeStateStream(
  subscriber: LocalForgeStateSubscriber,
  {
    runtimeSessionId,
  }: {
    runtimeSessionId?: string
  } = {},
) {
  const scopedSubscriber: LocalForgeStateSubscriber = (
    event,
    eventRuntimeSessionId,
  ) => {
    if (runtimeSessionId && runtimeSessionId !== eventRuntimeSessionId) {
      return
    }

    subscriber(event, eventRuntimeSessionId)
  }

  localForgeStateSubscribers.add(scopedSubscriber)

  return () => {
    localForgeStateSubscribers.delete(scopedSubscriber)
  }
}

export async function readLocalForgeStateEvents({
  afterStateOffset = 0,
}: {
  afterStateOffset?: number
} = {}) {
  const stateEvents = await readAllLocalForgeStateEvents()

  return stateEvents.filter(
    (event) => Number(event.headers.stateOffset) > afterStateOffset,
  )
}

export function filterLocalForgeStateBatchAfterOffset(
  event: LocalForgeStateStreamBatch,
  afterStateOffset: number,
): LocalForgeStateStreamBatch | undefined {
  const events = event.events.filter((stateEvent) => {
    const stateOffset = Number(stateEvent.headers.stateOffset)

    return Number.isFinite(stateOffset) && stateOffset > afterStateOffset
  })

  const lastEvent = events.at(-1)

  if (!lastEvent) {
    return undefined
  }

  return {
    events,
    stateOffset: Number(lastEvent.headers.stateOffset),
    timelineOffset: Number(lastEvent.headers.timelineOffset),
    type: 'state-batch',
  }
}

export function localForgeStateBatchNeedsSnapshot(
  event: LocalForgeStateStreamBatch,
) {
  return event.events.some((stateEvent) => stateEvent.type === 'manifests')
}

export async function readLocalForgeTimeline() {
  await ensureRuntimeDirs()

  try {
    const raw = await readFile(getTimelinePath(), 'utf8')
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LocalBuilderTimelineEvent)
  } catch (error) {
    if (isMissingFileError(error)) {
      return []
    }

    throw error
  }
}

export async function appendLocalForgeTimelineEvents(
  events: Array<LocalBuilderTimelineEvent>,
) {
  if (events.length === 0) {
    return
  }

  return withLocalForgeLock({
    name: 'timeline-append',
    staleMs: TIMELINE_APPEND_LOCK_STALE_MS,
    task: async () => appendLocalForgeTimelineEventsUnlocked(events),
    waitMs: TIMELINE_APPEND_LOCK_WAIT_MS,
  })
}

async function appendLocalForgeTimelineEventsUnlocked(
  events: Array<LocalBuilderTimelineEvent>,
) {
  await ensureRuntimeDirs()
  const existing = await readLocalForgeTimeline()
  const existingEventIds = new Set(existing.map((event) => event.eventId))
  const acceptedEvents: Array<LocalBuilderTimelineEvent> = []

  for (const event of events) {
    if (existingEventIds.has(event.eventId)) {
      continue
    }

    existingEventIds.add(event.eventId)
    acceptedEvents.push(
      rebaseLocalForgeTimelineEvent(
        event,
        existing.length + acceptedEvents.length + 1,
      ),
    )
  }

  if (acceptedEvents.length === 0) {
    return
  }

  const existingStateEvents = projectLocalBuilderTimeline(existing)
  const next = [...existing, ...acceptedEvents]
  const nextStateEvents = projectLocalBuilderTimeline(next)
  await writeJsonLines(getTimelinePath(), next)
  await writeJsonLines(getStatePath(), nextStateEvents)
  await updateActiveLocalForgeChat()
  await notifyLocalForgeStateSubscribers({
    events: nextStateEvents.slice(existingStateEvents.length),
    stateOffset: nextStateEvents.length,
    timelineOffset: next.length,
    type: 'state-batch',
  })
}

function rebaseLocalForgeTimelineEvent(
  event: LocalBuilderTimelineEvent,
  seq: number,
): LocalBuilderTimelineEvent {
  return {
    ...event,
    producer: {
      ...event.producer,
      seq,
    },
  }
}

export async function appendLocalForgeRuntimeEvent({
  detail,
  message,
  name,
  path,
  producerId,
  runId,
  startedAt,
  status,
}: {
  detail?: string
  message?: string
  name: string
  path?: string
  producerId: string
  runId: string
  startedAt?: number
  status?: BuilderRunStatus
}) {
  const existing = await readLocalForgeTimeline()
  const event: LocalBuilderTimelineEvent = {
    createdAt: new Date().toISOString(),
    eventId: `local-runtime-event-${crypto.randomUUID()}`,
    projectId: LOCAL_FORGE_PROJECT_ID,
    producer: createLocalForgeProducer({
      index: existing.length,
      kind: 'system',
      producerId,
    }),
    runId,
    schemaVersion: 1,
    sessionId: getCurrentLocalForgeSessionId(),
    type: 'workflow.event.recorded',
    payload: {
      detail,
      elapsedMs: startedAt ? Date.now() - startedAt : undefined,
      id: `local-runtime-row-${crypto.randomUUID()}`,
      message,
      name,
      path,
      runId,
      status: normalizeLocalForgeEventStatus({ name, status }),
    },
  }

  await appendLocalForgeTimelineEvents([event])
}

export function normalizeLocalForgeEventStatus({
  name,
  status,
}: {
  name: string
  status?: BuilderRunStatus
}): BuilderRunStatus | undefined {
  if (name.endsWith('.finished') || name.endsWith('.completed')) {
    return 'finished'
  }

  if (name.endsWith('.failed')) {
    return 'failed'
  }

  if (name.endsWith('.cancelled')) {
    return 'cancelled'
  }

  return status
}

export async function withLocalForgeLock<T>({
  name,
  staleMs,
  task,
  waitMs,
}: {
  name: string
  staleMs: number
  task: () => Promise<T> | T
  waitMs: number
}) {
  const lease = await acquireLocalForgeLockLease({
    name,
    staleMs,
    waitMs,
  })

  try {
    return await task()
  } finally {
    await lease.release()
  }
}

export async function acquireLocalForgeLockLease({
  name,
  staleMs,
  waitMs,
}: {
  name: string
  staleMs: number
  waitMs: number
}): Promise<LocalForgeLockLease> {
  const ownerId = crypto.randomUUID()
  const lockPath = path.join(getLocksDir(), `${name}.lock`)

  await acquireLocalForgeLock({
    lockPath,
    ownerId,
    staleMs,
    waitMs,
  })

  const refreshIntervalMs = Math.max(
    LOCK_REFRESH_MIN_MS,
    Math.floor(staleMs / 3),
  )
  const refreshTimer = setInterval(() => {
    void refreshLocalForgeLock({
      lockPath,
      ownerId,
    }).catch(() => {})
  }, refreshIntervalMs)
  refreshTimer.unref?.()
  let released = false

  return {
    release: async () => {
      if (released) {
        return
      }

      released = true
      clearInterval(refreshTimer)

      await releaseLocalForgeLock({
        lockPath,
        ownerId,
      })
    },
  }
}

export async function resetLocalForgeRuntime() {
  await ensureLocalForgeChatIndex()
  await rm(getSessionDir(), { force: true, recursive: true })
  await rm(getLocalForgeWorkspaceDir(), { force: true, recursive: true })
  await ensureRuntimeDirs()
  await writeJsonLines(getTimelinePath(), [])
  await writeJsonLines(getStatePath(), [])
  await notifyLocalForgeStateSubscribers({
    events: [],
    stateOffset: 0,
    timelineOffset: 0,
    type: 'state-batch',
  })
}

export async function persistLocalForgeManifestBundle(
  bundle: BuilderLocalManifestBundle,
) {
  await ensureRuntimeDirs()

  await writeFile(
    path.join(getManifestsDir(), encodeRef(bundle.manifest.manifestVersionId)),
    JSON.stringify(bundle.manifest, null, 2),
  )

  for (const blob of Object.values(bundle.blobs)) {
    await persistLocalForgeBlob(blob)
  }
}

export async function appendLocalForgeManifestTimeline({
  bundle,
  createdAt,
  producerId,
  producerKind,
  runId,
}: {
  bundle: BuilderLocalManifestBundle
  createdAt: string
  producerId: string
  producerKind: BuilderTimelineProducer['kind']
  runId: string | undefined
}) {
  const existing = await readLocalForgeTimeline()
  const parentManifest = bundle.manifest.parentManifestVersionId
    ? await readManifestReference({
        context: `manifest ${bundle.manifest.manifestVersionId} parent pointer`,
        manifestVersionId: bundle.manifest.parentManifestVersionId,
      })
    : undefined
  const filePaths = Object.keys(bundle.manifest.files).sort()
  const deletedFileEvents: Array<LocalBuilderTimelineEvent> = []
  let eventIndex = 0

  if (parentManifest) {
    for (const filePath of Object.keys(parentManifest.files).sort()) {
      if (bundle.manifest.files[filePath]) {
        continue
      }

      const parentFile = parentManifest.files[filePath]

      if (!parentFile) {
        continue
      }

      deletedFileEvents.push({
        createdAt,
        eventId: `local-file-deleted-${crypto.randomUUID()}`,
        producer: createLocalForgeProducer({
          index: existing.length + eventIndex,
          kind: producerKind,
          producerId,
        }),
        projectId: LOCAL_FORGE_PROJECT_ID,
        runId,
        schemaVersion: 1,
        sessionId: getCurrentLocalForgeSessionId(),
        type: 'file.deleted',
        payload: {
          path: filePath,
          source: parentFile.source,
        },
      })
      eventIndex += 1
    }
  }

  const fileEvents: Array<LocalBuilderTimelineEvent> = filePaths.map(
    (filePath) => {
      const event: LocalBuilderTimelineEvent = {
        createdAt,
        eventId: `local-file-${crypto.randomUUID()}`,
        producer: createLocalForgeProducer({
          index: existing.length + eventIndex,
          kind: producerKind,
          producerId,
        }),
        projectId: LOCAL_FORGE_PROJECT_ID,
        runId,
        schemaVersion: 1,
        sessionId: getCurrentLocalForgeSessionId(),
        type: 'file.upserted',
        payload: {
          file: bundle.manifest.files[filePath],
        },
      }

      eventIndex += 1

      return event
    },
  )
  const manifestEvent: LocalBuilderTimelineEvent = {
    createdAt,
    eventId: `local-manifest-${crypto.randomUUID()}`,
    producer: createLocalForgeProducer({
      index: existing.length + eventIndex,
      kind: producerKind,
      producerId,
    }),
    projectId: LOCAL_FORGE_PROJECT_ID,
    runId,
    schemaVersion: 1,
    sessionId: getCurrentLocalForgeSessionId(),
    type: 'manifest.snapshotted',
    payload: {
      blobRef: bundle.manifest.manifestVersionId,
      fileCount: filePaths.length,
      manifestVersionId: bundle.manifest.manifestVersionId,
      totalBytes: getLocalManifestTotalBytes(bundle.manifest),
    },
  }

  await appendLocalForgeTimelineEvents([
    ...deletedFileEvents,
    ...fileEvents,
    manifestEvent,
  ])
}

export async function persistLocalForgeBlob(blob: BuilderLocalFileBlob) {
  await ensureRuntimeDirs()
  await writeFile(
    path.join(getBlobsDir(), encodeRef(blob.blobRef)),
    JSON.stringify(blob, null, 2),
  )
}

export async function readLocalForgeManifest(manifestVersionId: string) {
  await ensureRuntimeDirs()
  const raw = await readFile(
    path.join(getManifestsDir(), encodeRef(manifestVersionId)),
    'utf8',
  )
  return JSON.parse(raw) as BuilderManifest
}

export async function readLocalForgeBlob(blobRef: string) {
  await ensureRuntimeDirs()
  const raw = await readFile(
    path.join(getBlobsDir(), encodeRef(blobRef)),
    'utf8',
  )
  return JSON.parse(raw) as BuilderLocalFileBlob
}

export function createLocalForgeProducer({
  index,
  kind,
  producerId,
}: {
  index: number
  kind: BuilderTimelineProducer['kind']
  producerId: string
}): BuilderTimelineProducer {
  return {
    epoch: getCurrentLocalForgeSessionId(),
    id: producerId,
    kind,
    seq: index + 1,
  }
}

async function readCurrentManifest(events: Array<LocalBuilderTimelineEvent>) {
  const manifestEvent = events
    .filter((event) => event.type === 'manifest.snapshotted')
    .at(-1)

  if (!manifestEvent || manifestEvent.type !== 'manifest.snapshotted') {
    return undefined
  }

  return readManifestReference({
    context: 'current manifest pointer',
    manifestVersionId: manifestEvent.payload.manifestVersionId,
  })
}

async function readManifestFiles(manifest: BuilderManifest) {
  const bundle: BuilderLocalManifestBundle = {
    blobs: {},
    manifest,
  }

  for (const file of Object.values(manifest.files)) {
    const raw = await readFile(
      path.join(getBlobsDir(), encodeRef(file.blobRef)),
      'utf8',
    ).catch((error: unknown) => {
      if (isMissingFileError(error)) {
        throw new Error(
          `Local Forge manifest ${manifest.manifestVersionId} is missing blob ${file.blobRef} for ${file.path}.`,
        )
      }

      throw error
    })
    const blob = JSON.parse(raw) as BuilderLocalFileBlob
    bundle.blobs[blob.blobRef] = blob
  }

  return getLocalManifestFiles(bundle)
}

async function readManifestChangeSummary(
  manifest: BuilderManifest,
  files: Record<string, string>,
) {
  const parentManifest = manifest.parentManifestVersionId
    ? await readManifestReference({
        context: `manifest ${manifest.manifestVersionId} parent pointer`,
        manifestVersionId: manifest.parentManifestVersionId,
      })
    : undefined
  const parentFiles = parentManifest
    ? await readManifestFiles(parentManifest)
    : undefined

  return summarizeLocalManifestChanges({
    files,
    manifest,
    parentFiles,
    parentManifest,
  })
}

async function readManifestReference({
  context,
  manifestVersionId,
}: {
  context: string
  manifestVersionId: string
}) {
  try {
    const raw = await readFile(
      path.join(getManifestsDir(), encodeRef(manifestVersionId)),
      'utf8',
    )
    return JSON.parse(raw) as BuilderManifest
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error(
        `Local Forge ${context} references missing manifest ${manifestVersionId}.`,
      )
    }

    throw error
  }
}

function readLatestRun(stateEvents: Array<BuilderStateEvent>) {
  const runRows = new Map<string, Record<string, unknown>>()

  for (const event of stateEvents) {
    if (event.type !== 'runs' || !event.value) {
      continue
    }

    const row = event.value

    if (
      isProjectedRecord(row) &&
      typeof row.id === 'string' &&
      typeof row.status === 'string'
    ) {
      runRows.set(row.id, row)
    }
  }

  const row = Array.from(runRows.values()).sort(compareLatestRunRows).at(-1)

  if (!row || typeof row.id !== 'string' || typeof row.status !== 'string') {
    return undefined
  }

  return {
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
    endedAt: typeof row.endedAt === 'string' ? row.endedAt : undefined,
    error: typeof row.error === 'string' ? row.error : undefined,
    id: row.id,
    startedAt: typeof row.startedAt === 'string' ? row.startedAt : undefined,
    status: row.status,
  }
}

function compareLatestRunRows(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
) {
  return readRunRecencyMs(left) - readRunRecencyMs(right)
}

function readRunRecencyMs(row: Record<string, unknown>): number {
  const timestamp =
    typeof row.createdAt === 'string'
      ? row.createdAt
      : typeof row.startedAt === 'string'
        ? row.startedAt
        : undefined

  if (timestamp) {
    const parsed = Date.parse(timestamp)

    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  const timelineOffset =
    typeof row.lastTimelineOffset === 'string'
      ? Number(row.lastTimelineOffset)
      : undefined

  return timelineOffset !== undefined && Number.isFinite(timelineOffset)
    ? timelineOffset
    : 0
}

function readMessages(stateEvents: Array<BuilderStateEvent>) {
  const rows = new Map<string, LocalForgeSnapshot['messages'][number]>()

  for (const event of stateEvents) {
    if (event.type !== 'messages' || !event.value) {
      continue
    }

    const message = readMessageRow(event.value)

    if (message) {
      rows.set(message.id, message)
    }
  }

  return Array.from(rows.values())
}

function readMessageRow(
  value: unknown,
): LocalForgeSnapshot['messages'][number] | undefined {
  if (!isProjectedRecord(value)) {
    return undefined
  }

  const id = typeof value.id === 'string' ? value.id : undefined
  const role = typeof value.role === 'string' ? value.role : undefined
  const status = readBuilderMessageStatus(value.status)

  if (!id || !role || !status) {
    return undefined
  }

  return {
    completedAt:
      typeof value.completedAt === 'string' ? value.completedAt : undefined,
    content: typeof value.content === 'string' ? value.content : undefined,
    createdAt:
      typeof value.createdAt === 'string'
        ? value.createdAt
        : new Date(0).toISOString(),
    id,
    role,
    runId: typeof value.runId === 'string' ? value.runId : undefined,
    status,
  }
}

function readExports(stateEvents: Array<BuilderStateEvent>) {
  const rows = new Map<string, LocalForgeSnapshot['exports'][number]>()

  for (const event of stateEvents) {
    if (event.type !== 'exports' || !event.value) {
      continue
    }

    const exportRow = readExportRow(event.value)

    if (exportRow) {
      rows.set(exportRow.id, exportRow)
    }
  }

  return Array.from(rows.values())
}

function readExportRow(
  value: unknown,
): LocalForgeSnapshot['exports'][number] | undefined {
  if (!isProjectedRecord(value)) {
    return undefined
  }

  const id = typeof value.id === 'string' ? value.id : undefined
  const manifestVersionId =
    typeof value.manifestVersionId === 'string'
      ? value.manifestVersionId
      : undefined
  const status = readBuilderExportStatus(value.status)
  const startedAt =
    typeof value.startedAt === 'string' ? value.startedAt : undefined

  if (!id || !manifestVersionId || !status || !startedAt) {
    return undefined
  }

  const kind = readBuilderExportKind(value.kind)

  if (!kind) {
    return undefined
  }

  return {
    branch: typeof value.branch === 'string' ? value.branch : undefined,
    byteLength:
      typeof value.byteLength === 'number' ? value.byteLength : undefined,
    commitSha:
      typeof value.commitSha === 'string' ? value.commitSha : undefined,
    completedAt:
      typeof value.completedAt === 'string' ? value.completedAt : undefined,
    error: typeof value.error === 'string' ? value.error : undefined,
    fileName: typeof value.fileName === 'string' ? value.fileName : undefined,
    id,
    kind,
    manifestVersionId,
    repoName: typeof value.repoName === 'string' ? value.repoName : undefined,
    repoOwner:
      typeof value.repoOwner === 'string' ? value.repoOwner : undefined,
    repoUrl: typeof value.repoUrl === 'string' ? value.repoUrl : undefined,
    runId: typeof value.runId === 'string' ? value.runId : undefined,
    startedAt,
    status,
    visibility: readBuilderExportVisibility(value.visibility),
  }
}

function readAgentEvents(
  stateEvents: Array<BuilderStateEvent>,
): LocalForgeSnapshot['agentEvents'] {
  return stateEvents
    .filter((event) => event.type === 'agentEvents' && event.value)
    .map((event) => event.value)
    .filter(isProjectedRecord)
    .flatMap((value) => {
      const row = readRecordedEventRow(value)

      if (!row || row.name.startsWith('workflow.')) {
        return []
      }

      return [row]
    })
}

function readWorkflowEvents(
  stateEvents: Array<BuilderStateEvent>,
): LocalForgeSnapshot['workflowEvents'] {
  return stateEvents.flatMap((event) => {
    if (event.type !== 'workflowEvents' && event.type !== 'agentEvents') {
      return []
    }

    if (!event.value || !isProjectedRecord(event.value)) {
      return []
    }

    const row = readRecordedEventRow(event.value)

    if (!row) {
      return []
    }

    if (event.type === 'agentEvents' && !row.name.startsWith('workflow.')) {
      return []
    }

    return [row]
  })
}

function readRecordedEventRow(
  value: Record<string, unknown>,
): LocalForgeSnapshot['agentEvents'][number] | undefined {
  const createdAt =
    typeof value.createdAt === 'string' ? value.createdAt : undefined
  const id = typeof value.id === 'string' ? value.id : undefined
  const name = typeof value.name === 'string' ? value.name : undefined
  const runId = typeof value.runId === 'string' ? value.runId : undefined

  if (!createdAt || !id || !name || !runId) {
    return undefined
  }

  return {
    createdAt,
    detail: typeof value.detail === 'string' ? value.detail : undefined,
    elapsedMs:
      typeof value.elapsedMs === 'number' ? value.elapsedMs : undefined,
    id,
    message: typeof value.message === 'string' ? value.message : undefined,
    name,
    path: typeof value.path === 'string' ? value.path : undefined,
    runId,
    status: readBuilderRunStatus(value.status),
    toolCallId:
      typeof value.toolCallId === 'string' ? value.toolCallId : undefined,
  }
}

function readBuilderMessageStatus(
  value: unknown,
): BuilderMessageStatus | undefined {
  switch (value) {
    case 'cancelled':
    case 'complete':
    case 'failed':
    case 'streaming':
      return value
    default:
      return undefined
  }
}

async function ensureRuntimeDirs() {
  await mkdir(runtimeDir, { recursive: true })
  await mkdir(getBlobsDir(), { recursive: true })
  await mkdir(getLocksDir(), { recursive: true })
  await mkdir(getManifestsDir(), { recursive: true })
}

async function readAllLocalForgeStateEvents() {
  const stateEvents = projectLocalBuilderTimeline(
    await readLocalForgeTimeline(),
  )
  await writeJsonLines(getStatePath(), stateEvents)

  return stateEvents
}

async function ensureLocalForgeChatIndex(): Promise<LocalForgeChatIndex> {
  await mkdir(runtimeDir, { recursive: true })

  try {
    const raw = await readFile(chatsPath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<LocalForgeChatIndex>
    const normalized = normalizeLocalForgeChatIndex(parsed)
    activeLocalForgeSessionId = normalized.activeChatId

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await writeLocalForgeChatIndex(normalized)
    }

    return normalized
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error
    }

    const now = new Date().toISOString()
    const chatIndex = {
      activeChatId: LOCAL_FORGE_SESSION_ID,
      chats: [
        {
          createdAt: now,
          id: LOCAL_FORGE_SESSION_ID,
          title: DEFAULT_LOCAL_FORGE_CHAT_TITLE,
          updatedAt: now,
        },
      ],
    }
    activeLocalForgeSessionId = LOCAL_FORGE_SESSION_ID
    await writeLocalForgeChatIndex(chatIndex)

    return chatIndex
  }
}

function normalizeLocalForgeChatIndex(
  value: Partial<LocalForgeChatIndex>,
): LocalForgeChatIndex {
  const now = new Date().toISOString()
  const chats = Array.isArray(value.chats)
    ? value.chats
        .map((chat) => normalizeLocalForgeChat(chat, now))
        .filter((chat) => chat !== undefined)
    : []
  const fallbackChat =
    chats[0] ??
    ({
      createdAt: now,
      id: LOCAL_FORGE_SESSION_ID,
      title: DEFAULT_LOCAL_FORGE_CHAT_TITLE,
      updatedAt: now,
    } satisfies LocalForgeChat)
  const activeChatId =
    typeof value.activeChatId === 'string' &&
    chats.some((chat) => chat.id === value.activeChatId)
      ? value.activeChatId
      : fallbackChat.id

  return {
    activeChatId,
    chats: chats.length > 0 ? chats : [fallbackChat],
  }
}

function normalizeLocalForgeChat(
  value: unknown,
  fallbackTime: string,
): LocalForgeChat | undefined {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return undefined
  }

  const id = toSafeLocalForgeChatId(value.id)

  if (!id) {
    return undefined
  }

  return {
    createdAt:
      typeof value.createdAt === 'string' ? value.createdAt : fallbackTime,
    id,
    title:
      typeof value.title === 'string' && value.title.trim()
        ? value.title.trim().slice(0, 64)
        : DEFAULT_LOCAL_FORGE_CHAT_TITLE,
    updatedAt:
      typeof value.updatedAt === 'string' ? value.updatedAt : fallbackTime,
  }
}

async function updateActiveLocalForgeChat({
  title,
}: {
  title?: string
} = {}) {
  const chatIndex = await ensureLocalForgeChatIndex()
  const now = new Date().toISOString()
  const chats = chatIndex.chats.map((chat) => {
    if (chat.id !== chatIndex.activeChatId) {
      return chat
    }

    return {
      ...chat,
      title: title ?? chat.title,
      updatedAt: now,
    }
  })

  await writeLocalForgeChatIndex({
    ...chatIndex,
    chats,
  })
}

async function writeLocalForgeChatIndex(chatIndex: LocalForgeChatIndex) {
  await mkdir(runtimeDir, { recursive: true })
  await writeFile(chatsPath, JSON.stringify(chatIndex, null, 2), 'utf8')
}

function getSessionDir() {
  return getLocalForgeSessionDir(getCurrentLocalForgeSessionId())
}

function getLocalForgeSessionDir(sessionId: string) {
  return path.join(runtimeDir, toSafeLocalForgeChatId(sessionId))
}

function getBlobsDir() {
  return path.join(getSessionDir(), 'blobs')
}

function getLocksDir() {
  return path.join(getSessionDir(), 'locks')
}

function getManifestsDir() {
  return path.join(getSessionDir(), 'manifests')
}

function getTimelinePath() {
  return path.join(getSessionDir(), 'timeline.jsonl')
}

function getStatePath() {
  return path.join(getSessionDir(), 'state.jsonl')
}

function toSafeLocalForgeChatId(sessionId: string) {
  return sessionId.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 120)
}

function getCurrentLocalForgeSessionId() {
  return localForgeSessionStorage.getStore() ?? activeLocalForgeSessionId
}

async function notifyLocalForgeStateSubscribers(
  event: LocalForgeStateStreamBatch,
) {
  if (localForgeStateSubscribers.size === 0) {
    return
  }

  const runtimeSessionId = getCurrentLocalForgeSessionId()

  for (const subscriber of localForgeStateSubscribers) {
    subscriber(event, runtimeSessionId)
  }
}

async function acquireLocalForgeLock({
  lockPath,
  ownerId,
  staleMs,
  waitMs,
}: {
  lockPath: string
  ownerId: string
  staleMs: number
  waitMs: number
}) {
  const startedAt = Date.now()

  while (true) {
    await ensureRuntimeDirs()

    try {
      await writeLocalForgeLockMetadata({
        lockPath,
        ownerId,
        writeFlag: 'wx',
      })
      return
    } catch (error) {
      if (getErrorCode(error) !== 'EEXIST') {
        throw error
      }
    }

    const metadata = await readLocalForgeLockMetadata(lockPath)
    const now = Date.now()

    if (!metadata || now - metadata.acquiredAt > staleMs) {
      await rm(lockPath, { force: true })
      continue
    }

    if (now - startedAt >= waitMs) {
      throw new Error(`${path.basename(lockPath)} is already locked.`)
    }

    await delay(Math.min(LOCK_POLL_MS, waitMs - (now - startedAt)))
  }
}

async function releaseLocalForgeLock({
  lockPath,
  ownerId,
}: {
  lockPath: string
  ownerId: string
}) {
  const metadata = await readLocalForgeLockMetadata(lockPath)

  if (!metadata || metadata.ownerId !== ownerId) {
    return
  }

  await rm(lockPath, { force: true })
}

async function refreshLocalForgeLock({
  lockPath,
  ownerId,
}: {
  lockPath: string
  ownerId: string
}) {
  const metadata = await readLocalForgeLockMetadata(lockPath)

  if (!metadata || metadata.ownerId !== ownerId) {
    return
  }

  await writeLocalForgeLockMetadata({
    lockPath,
    ownerId,
  })
}

async function readLocalForgeLockMetadata(lockPath: string) {
  try {
    const value: unknown = JSON.parse(await readFile(lockPath, 'utf8'))

    if (
      isProjectedRecord(value) &&
      typeof value.acquiredAt === 'number' &&
      typeof value.ownerId === 'string'
    ) {
      return {
        acquiredAt: value.acquiredAt,
        ownerId: value.ownerId,
      }
    }

    return undefined
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined
    }

    throw error
  }
}

async function writeLocalForgeLockMetadata({
  lockPath,
  ownerId,
  writeFlag,
}: {
  lockPath: string
  ownerId: string
  writeFlag?: 'wx'
}) {
  const content = JSON.stringify(
    {
      acquiredAt: Date.now(),
      ownerId,
    },
    null,
    2,
  )

  if (writeFlag) {
    await writeFile(lockPath, content, {
      encoding: 'utf8',
      flag: writeFlag,
    })
    return
  }

  await writeFile(lockPath, content, 'utf8')
}

function delay(delayMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

async function writeJsonLines(filePath: string, records: Array<unknown>) {
  await writeFile(
    filePath,
    records.length > 0
      ? `${records.map((record) => JSON.stringify(record)).join('\n')}\n`
      : '',
  )
}

function encodeRef(ref: string) {
  return `${encodeURIComponent(ref)}.json`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isProjectedRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
}

function readBuilderExportStatus(
  value: unknown,
): BuilderExportStatus | undefined {
  switch (value) {
    case 'completed':
    case 'failed':
    case 'running':
      return value
    default:
      return undefined
  }
}

function readBuilderRunStatus(value: unknown): BuilderRunStatus | undefined {
  switch (value) {
    case 'cancelled':
    case 'failed':
    case 'finished':
    case 'finishing':
    case 'interrupted':
    case 'paused':
    case 'queued':
    case 'running':
    case 'starting':
      return value
    default:
      return undefined
  }
}

function readBuilderExportKind(value: unknown): BuilderExportKind | undefined {
  switch (value) {
    case 'github':
    case 'zip':
      return value
    default:
      return undefined
  }
}

function readBuilderExportVisibility(value: unknown) {
  switch (value) {
    case 'private':
    case 'public':
      return value
    default:
      return undefined
  }
}

function getErrorCode(error: unknown) {
  if (!isProjectedRecord(error) || typeof error.code !== 'string') {
    return undefined
  }

  return error.code
}

function isMissingFileError(error: unknown) {
  return getErrorCode(error) === 'ENOENT'
}
