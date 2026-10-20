import {
  indexedDBPersistence,
  type ChatPersistedState,
  type MessagePart,
} from '@tanstack/ai-client'
import {
  parseBuilderAiActivity,
  type BuilderAiActivity,
} from './builder-ai-activity'

const metadataStorageKey = 'tanstack-builder-ai:threads:v1'
const maxThreadCount = 50
const maxStoredBytes = 50 * 1024 * 1024
const activityPartName = 'tanstack_builder_activity'
const persistenceLockName = 'tanstack-builder-ai:persistence'
let localPersistenceQueue: Promise<void> = Promise.resolve()

const transcriptStorage = indexedDBPersistence({
  databaseName: 'tanstack-builder-ai',
  objectStoreName: 'transcripts',
  keyPrefix: 'thread:',
})

export type BuilderAiTranscriptMessage = {
  id: string
  role: 'assistant' | 'user'
  content: string
  activity?: BuilderAiActivity
}

export type BuilderAiThread = {
  id: string
  title: string
  createdAt: number
  lastAccessedAt: number
  sizeBytes: number
}

export type BuilderAiTranscriptScopeSnapshot = {
  scope: string
  version: string
  threads: Array<{
    id: string
    title: string
    createdAt: number
    messages: Array<BuilderAiTranscriptMessage>
  }>
}

type StoredThread = BuilderAiThread & {
  scope: string
}

export function createBuilderAiThreadId() {
  return crypto.randomUUID()
}

export function replaceBuilderAiTranscriptMessage(
  messages: ReadonlyArray<BuilderAiTranscriptMessage>,
  message: BuilderAiTranscriptMessage,
) {
  return [
    ...messages.filter((candidate) => candidate.id !== message.id),
    message,
  ]
}

export function listBuilderAiThreads(scope: string) {
  return readThreadIndex()
    .filter((thread) => thread.scope === scope)
    .sort((left, right) => right.lastAccessedAt - left.lastAccessedAt)
    .map(({ id, title, createdAt, lastAccessedAt, sizeBytes }) => ({
      id,
      title,
      createdAt,
      lastAccessedAt,
      sizeBytes,
    }))
}

export async function loadBuilderAiTranscript(scope: string, threadId: string) {
  return withBuilderAiPersistenceLock(() =>
    loadBuilderAiTranscriptUnlocked(scope, threadId),
  )
}

async function loadBuilderAiTranscriptUnlocked(
  scope: string,
  threadId: string,
) {
  let stored: ChatPersistedState | null | undefined

  try {
    stored = await transcriptStorage.getItem(storageId(scope, threadId))
  } catch {
    return undefined
  }

  const messages = parseTranscript(stored)
  if (!messages) {
    removeThreadFromIndex(scope, threadId)
    if (stored !== null && stored !== undefined) {
      await removeTranscriptBlob(scope, threadId)
    }
    return undefined
  }

  const state = createPersistedState(messages)
  await recordThread({
    scope,
    id: threadId,
    messages,
    sizeBytes: getUtf8ByteLength(state),
  })
  return messages
}

export function touchBuilderAiThread(scope: string, threadId: string) {
  return withBuilderAiPersistenceLock(async () => {
    const threads = readThreadIndex()
    const thread = threads.find(
      (candidate) => candidate.scope === scope && candidate.id === threadId,
    )
    if (!thread) return

    writeThreadIndex([
      { ...thread, lastAccessedAt: Date.now() },
      ...threads.filter(
        (candidate) => candidate.scope !== scope || candidate.id !== threadId,
      ),
    ])
  })
}

export async function saveBuilderAiTranscript(
  scope: string,
  threadId: string,
  messages: ReadonlyArray<BuilderAiTranscriptMessage>,
) {
  if (!messages.every(isTranscriptMessage)) return false

  const transcript = messages.map((message) => ({ ...message }))
  return withBuilderAiPersistenceLock(async () => {
    const state = createPersistedState(transcript)

    try {
      await transcriptStorage.setItem(storageId(scope, threadId), state)
    } catch {
      return false
    }

    return recordThread({
      scope,
      id: threadId,
      messages: transcript,
      sizeBytes: getUtf8ByteLength(state),
    })
  })
}

export async function removeBuilderAiThread(scope: string, threadId: string) {
  return withBuilderAiPersistenceLock(async () => {
    removeThreadFromIndex(scope, threadId)
    await removeTranscriptBlob(scope, threadId)
  })
}

export async function readBuilderAiTranscriptScopeSnapshot(scope: string) {
  return withBuilderAiPersistenceLock(() =>
    readBuilderAiTranscriptScopeSnapshotUnlocked(scope),
  )
}

export async function removeBuilderAiTranscriptScopeSnapshot(
  snapshot: BuilderAiTranscriptScopeSnapshot,
) {
  return withBuilderAiPersistenceLock(async () => {
    const current = await readBuilderAiTranscriptScopeSnapshotUnlocked(
      snapshot.scope,
    )
    if (current.version !== snapshot.version) return false

    const threadIds = new Set(snapshot.threads.map((thread) => thread.id))
    const retained = readThreadIndex().filter(
      (thread) => thread.scope !== snapshot.scope || !threadIds.has(thread.id),
    )
    if (!writeThreadIndex(retained)) return false
    await Promise.all(
      [...threadIds].map((threadId) =>
        removeTranscriptBlob(snapshot.scope, threadId),
      ),
    )
    return true
  })
}

async function recordThread({
  scope,
  id,
  messages,
  sizeBytes,
}: {
  scope: string
  id: string
  messages: ReadonlyArray<BuilderAiTranscriptMessage>
  sizeBytes: number
}) {
  const threads = readThreadIndex()
  const existing = threads.find(
    (thread) => thread.scope === scope && thread.id === id,
  )
  const now = Date.now()
  const updated: StoredThread = {
    scope,
    id,
    title: getThreadTitle(messages),
    createdAt: existing?.createdAt ?? now,
    lastAccessedAt: now,
    sizeBytes,
  }
  const byMostRecent = [
    updated,
    ...threads.filter((thread) => thread.scope !== scope || thread.id !== id),
  ].sort((left, right) => right.lastAccessedAt - left.lastAccessedAt)

  const retained: Array<StoredThread> = []
  const evicted: Array<StoredThread> = []
  let retainedBytes = 0

  for (const thread of byMostRecent) {
    if (
      retained.length >= maxThreadCount ||
      retainedBytes + thread.sizeBytes > maxStoredBytes
    ) {
      evicted.push(thread)
      continue
    }

    retained.push(thread)
    retainedBytes += thread.sizeBytes
  }

  if (!writeThreadIndex(retained)) return false

  await Promise.all(
    evicted.map((thread) => removeTranscriptBlob(thread.scope, thread.id)),
  )
  return true
}

function createPersistedState(
  messages: ReadonlyArray<BuilderAiTranscriptMessage>,
): ChatPersistedState {
  return {
    messages: messages.map(createPersistedMessage),
  }
}

async function readBuilderAiTranscriptScopeSnapshotUnlocked(
  scope: string,
): Promise<BuilderAiTranscriptScopeSnapshot> {
  const storedThreads = readThreadIndex()
    .filter((thread) => thread.scope === scope)
    .sort((left, right) => left.id.localeCompare(right.id))
  const threads: BuilderAiTranscriptScopeSnapshot['threads'] = []

  for (const storedThread of storedThreads) {
    let state: ChatPersistedState | null | undefined
    try {
      state = await transcriptStorage.getItem(storageId(scope, storedThread.id))
    } catch {
      continue
    }
    const messages = parseTranscript(state)
    if (!messages) continue
    threads.push({
      id: storedThread.id,
      title: getThreadTitle(messages),
      createdAt: storedThread.createdAt,
      messages,
    })
  }

  return {
    scope,
    version: await getBuilderAiTranscriptScopeVersion(threads),
    threads,
  }
}

async function getBuilderAiTranscriptScopeVersion(
  threads: BuilderAiTranscriptScopeSnapshot['threads'],
) {
  const canonical = canonicalJson(
    threads.map((thread) => ({
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt,
      messages: thread.messages,
    })),
  )
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical)),
  )
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  if (!isRecord(value)) {
    throw new Error('Builder transcript contains non-JSON data')
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(',')}}`
}

function withBuilderAiPersistenceLock<TResult>(
  operation: () => Promise<TResult>,
) {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(persistenceLockName, operation)
  }

  const result = localPersistenceQueue.then(operation)
  localPersistenceQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

function createPersistedMessage(
  message: BuilderAiTranscriptMessage,
): ChatPersistedState['messages'][number] {
  return {
    id: message.id,
    role: message.role,
    parts: [
      { type: 'text', content: message.content },
      ...(message.activity
        ? [createActivityPart(message.id, message.activity)]
        : []),
    ],
  }
}

function createActivityPart(
  messageId: string,
  activity: BuilderAiActivity,
): MessagePart {
  return {
    type: 'tool-call',
    id: `${activityPartName}:${messageId}`,
    name: activityPartName,
    arguments: JSON.stringify(activity),
    state: 'complete',
  }
}

function parseTranscript(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.messages)) return undefined

  const messages: Array<BuilderAiTranscriptMessage> = []
  for (const candidate of value.messages) {
    const message = parseTranscriptMessage(candidate)
    if (!message) return undefined
    messages.push(message)
  }
  return messages
}

function parseTranscriptMessage(
  value: unknown,
): BuilderAiTranscriptMessage | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    (value.role !== 'assistant' && value.role !== 'user') ||
    !Array.isArray(value.parts) ||
    (value.parts.length !== 1 && value.parts.length !== 2)
  ) {
    return undefined
  }

  const part: unknown = value.parts[0]
  if (
    !isRecord(part) ||
    part.type !== 'text' ||
    typeof part.content !== 'string'
  ) {
    return undefined
  }

  const activity = parsePersistedActivity(value.parts[1])
  if (value.parts.length === 2 && !activity) return undefined
  if (activity && value.role !== 'assistant') return undefined

  return {
    id: value.id,
    role: value.role,
    content: part.content,
    ...(activity ? { activity } : {}),
  }
}

function isTranscriptMessage(
  value: unknown,
): value is BuilderAiTranscriptMessage {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    (value.role === 'assistant' || value.role === 'user') &&
    typeof value.content === 'string' &&
    isOptionalActivity(value.activity) &&
    (value.activity === undefined || value.role === 'assistant')
  )
}

function parsePersistedActivity(value: unknown) {
  if (value === undefined) return undefined
  if (
    !isRecord(value) ||
    value.type !== 'tool-call' ||
    value.name !== activityPartName ||
    typeof value.arguments !== 'string'
  ) {
    return undefined
  }

  try {
    return parseBuilderAiActivity(JSON.parse(value.arguments))
  } catch {
    return undefined
  }
}

function isOptionalActivity(value: unknown) {
  if (value === undefined) return true
  try {
    parseBuilderAiActivity(value)
    return true
  } catch {
    return false
  }
}

function getThreadTitle(messages: ReadonlyArray<BuilderAiTranscriptMessage>) {
  const title =
    messages
      .find((message) => message.role === 'user')
      ?.content.trim()
      .replace(/\s+/g, ' ') || 'New conversation'
  return title.length > 72 ? `${title.slice(0, 71)}…` : title
}

function getUtf8ByteLength(state: ChatPersistedState) {
  return new TextEncoder().encode(JSON.stringify(state)).byteLength
}

function storageId(scope: string, threadId: string) {
  return JSON.stringify([scope, threadId])
}

async function removeTranscriptBlob(scope: string, threadId: string) {
  try {
    await transcriptStorage.removeItem(storageId(scope, threadId))
  } catch {
    // Browser storage is best-effort and must not interrupt builder editing.
  }
}

function removeThreadFromIndex(scope: string, threadId: string) {
  const threads = readThreadIndex()
  writeThreadIndex(
    threads.filter(
      (thread) => thread.scope !== scope || thread.id !== threadId,
    ),
  )
}

function readThreadIndex() {
  const storage = getLocalStorage()
  if (!storage) return []

  try {
    const serialized = storage.getItem(metadataStorageKey)
    if (!serialized) return []

    const value: unknown = JSON.parse(serialized)
    if (
      !isRecord(value) ||
      value.version !== 1 ||
      !Array.isArray(value.threads) ||
      !value.threads.every(isStoredThread)
    ) {
      storage.removeItem(metadataStorageKey)
      return []
    }

    const deduplicated = new Map<string, StoredThread>()
    for (const thread of value.threads) {
      const key = storageId(thread.scope, thread.id)
      const current = deduplicated.get(key)
      if (!current || current.lastAccessedAt < thread.lastAccessedAt) {
        deduplicated.set(key, thread)
      }
    }
    return [...deduplicated.values()]
  } catch {
    try {
      storage.removeItem(metadataStorageKey)
    } catch {
      // Browser storage is best-effort and must not interrupt builder editing.
    }
    return []
  }
}

function writeThreadIndex(threads: ReadonlyArray<StoredThread>) {
  const storage = getLocalStorage()
  if (!storage) return false

  try {
    storage.setItem(metadataStorageKey, JSON.stringify({ version: 1, threads }))
    return true
  } catch {
    return false
  }
}

function getLocalStorage() {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

function isStoredThread(value: unknown): value is StoredThread {
  return (
    isRecord(value) &&
    typeof value.scope === 'string' &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.createdAt === 'number' &&
    Number.isFinite(value.createdAt) &&
    typeof value.lastAccessedAt === 'number' &&
    Number.isFinite(value.lastAccessedAt) &&
    typeof value.sizeBytes === 'number' &&
    Number.isFinite(value.sizeBytes) &&
    value.sizeBytes >= 0
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
