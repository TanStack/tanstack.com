import {
  indexedDBPersistence,
  type ChatPersistedState,
  type MessagePart,
} from '@tanstack/ai-client'
import {
  parseNotebookAiActivity,
  type NotebookAiActivity,
} from './notebook-ai-activity'

const metadataStorageKey = 'tanstack-notebook-ai:threads:v1'
const maxThreadCount = 50
const maxStoredBytes = 50 * 1024 * 1024
const activityPartName = 'tanstack_notebook_activity'

const transcriptStorage = indexedDBPersistence({
  databaseName: 'tanstack-notebook-ai',
  objectStoreName: 'transcripts',
  keyPrefix: 'thread:',
})

export type NotebookAiTranscriptMessage = {
  id: string
  role: 'assistant' | 'user'
  content: string
  activity?: NotebookAiActivity
}

export type NotebookAiThread = {
  id: string
  title: string
  createdAt: number
  lastAccessedAt: number
  sizeBytes: number
}

type StoredThread = NotebookAiThread & {
  scope: string
}

export function createNotebookAiThreadId() {
  return crypto.randomUUID()
}

export function listNotebookAiThreads(scope: string) {
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

export async function loadNotebookAiTranscript(
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

export function touchNotebookAiThread(scope: string, threadId: string) {
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
}

export async function saveNotebookAiTranscript(
  scope: string,
  threadId: string,
  messages: ReadonlyArray<NotebookAiTranscriptMessage>,
) {
  if (!messages.every(isTranscriptMessage)) return

  const transcript = messages.map((message) => ({ ...message }))
  const state = createPersistedState(transcript)

  try {
    await transcriptStorage.setItem(storageId(scope, threadId), state)
  } catch {
    return
  }

  await recordThread({
    scope,
    id: threadId,
    messages: transcript,
    sizeBytes: getUtf8ByteLength(state),
  })
}

export async function removeNotebookAiThread(scope: string, threadId: string) {
  removeThreadFromIndex(scope, threadId)
  await removeTranscriptBlob(scope, threadId)
}

async function recordThread({
  scope,
  id,
  messages,
  sizeBytes,
}: {
  scope: string
  id: string
  messages: ReadonlyArray<NotebookAiTranscriptMessage>
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

  if (!writeThreadIndex(retained)) return

  await Promise.all(
    evicted.map((thread) => removeTranscriptBlob(thread.scope, thread.id)),
  )
}

function createPersistedState(
  messages: ReadonlyArray<NotebookAiTranscriptMessage>,
): ChatPersistedState {
  return {
    messages: messages.map(createPersistedMessage),
  }
}

function createPersistedMessage(
  message: NotebookAiTranscriptMessage,
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
  activity: NotebookAiActivity,
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

  const messages: Array<NotebookAiTranscriptMessage> = []
  for (const candidate of value.messages) {
    const message = parseTranscriptMessage(candidate)
    if (!message) return undefined
    messages.push(message)
  }
  return messages
}

function parseTranscriptMessage(
  value: unknown,
): NotebookAiTranscriptMessage | undefined {
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
): value is NotebookAiTranscriptMessage {
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
    return parseNotebookAiActivity(JSON.parse(value.arguments))
  } catch {
    return undefined
  }
}

function isOptionalActivity(value: unknown) {
  if (value === undefined) return true
  try {
    parseNotebookAiActivity(value)
    return true
  } catch {
    return false
  }
}

function getThreadTitle(messages: ReadonlyArray<NotebookAiTranscriptMessage>) {
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
    // Browser storage is best-effort and must not interrupt notebook editing.
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
      // Browser storage is best-effort and must not interrupt notebook editing.
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
