import {
  parseNotebookAiExecution,
  serializeNotebookAiExecution,
  type NotebookAiExecution,
} from './notebook-ai'

const metadataStorageKey = 'tanstack-notebook-ai:checkpoints:v1'
const databaseName = 'tanstack-notebook-ai-checkpoints'
const objectStoreName = 'executions'
const maxCheckpointCount = 50
const maxStoredBytes = 50 * 1024 * 1024
const executionIdPattern = /^[0-9a-f]{64}$/

let databasePromise: Promise<IDBDatabase> | undefined

export type NotebookAiCheckpoint = {
  id: string
  createdAt: number
  lastAccessedAt: number
  sizeBytes: number
  executionId: string
  expectedExecutionId: string
}

export type NotebookAiCheckpointSnapshot = {
  checkpoint: NotebookAiCheckpoint
  execution: NotebookAiExecution
}

type StoredCheckpoint = NotebookAiCheckpoint & {
  scope: string
}

export function listNotebookAiCheckpoints(scope: string) {
  return readCheckpointIndex()
    .filter((checkpoint) => checkpoint.scope === scope)
    .sort((left, right) => right.createdAt - left.createdAt)
    .map(toCheckpoint)
}

export async function createNotebookAiCheckpoint(
  scope: string,
  checkpointId: string,
  execution: NotebookAiExecution,
) {
  if (!scope || !checkpointId) return undefined

  let serialized: string
  let executionId: string

  try {
    serialized = serializeCanonicalExecution(execution)
    executionId = await createExecutionId(serialized)
    await writeExecution(executionId, serialized)
  } catch {
    return undefined
  }

  const checkpoints = readCheckpointIndex()
  const existing = checkpoints.find(
    (checkpoint) =>
      checkpoint.scope === scope && checkpoint.id === checkpointId,
  )
  const now = Date.now()
  const updated: StoredCheckpoint = {
    scope,
    id: checkpointId,
    createdAt: existing?.createdAt ?? now,
    lastAccessedAt: now,
    sizeBytes: getUtf8ByteLength(serialized),
    executionId,
    expectedExecutionId: executionId,
  }
  const candidates = [
    updated,
    ...checkpoints.filter(
      (checkpoint) =>
        checkpoint.scope !== scope || checkpoint.id !== checkpointId,
    ),
  ].sort((left, right) => right.lastAccessedAt - left.lastAccessedAt)
  const retained: Array<StoredCheckpoint> = []
  const retainedExecutionIds = new Set<string>()
  let retainedBytes = 0

  for (const checkpoint of candidates) {
    const addsExecution = !retainedExecutionIds.has(checkpoint.executionId)
    const nextBytes = retainedBytes + (addsExecution ? checkpoint.sizeBytes : 0)

    if (retained.length >= maxCheckpointCount || nextBytes > maxStoredBytes) {
      continue
    }

    retained.push(checkpoint)
    retainedExecutionIds.add(checkpoint.executionId)
    retainedBytes = nextBytes
  }

  if (!writeCheckpointIndex(retained)) {
    if (!checkpoints.some((item) => item.executionId === executionId)) {
      await removeExecution(executionId)
    }
    return undefined
  }

  await removeUnreferencedExecutions([updated, ...checkpoints], retained)
  return retained.some(
    (checkpoint) =>
      checkpoint.scope === scope && checkpoint.id === checkpointId,
  )
    ? toCheckpoint(updated)
    : undefined
}

export async function updateNotebookAiCheckpointExpectedExecution(
  scope: string,
  checkpointId: string,
  execution: NotebookAiExecution,
) {
  if (!scope || !checkpointId) return undefined

  let expectedExecutionId: string
  try {
    expectedExecutionId = await createExecutionId(
      serializeCanonicalExecution(execution),
    )
  } catch {
    return undefined
  }

  const checkpoints = readCheckpointIndex()
  const checkpoint = checkpoints.find(
    (candidate) => candidate.scope === scope && candidate.id === checkpointId,
  )
  if (!checkpoint) return undefined

  const updated: StoredCheckpoint = {
    ...checkpoint,
    expectedExecutionId,
    lastAccessedAt: Date.now(),
  }
  if (
    !writeCheckpointIndex([
      updated,
      ...checkpoints.filter(
        (candidate) =>
          candidate.scope !== scope || candidate.id !== checkpointId,
      ),
    ])
  ) {
    return undefined
  }

  return toCheckpoint(updated)
}

export async function notebookAiCheckpointMatchesExecution(
  checkpoint: NotebookAiCheckpoint,
  execution: NotebookAiExecution,
) {
  try {
    return (
      checkpoint.expectedExecutionId ===
      (await createExecutionId(serializeCanonicalExecution(execution)))
    )
  } catch {
    return false
  }
}

export async function loadNotebookAiCheckpoint(
  scope: string,
  checkpointId: string,
) {
  const checkpoints = readCheckpointIndex()
  const checkpoint = checkpoints.find(
    (candidate) => candidate.scope === scope && candidate.id === checkpointId,
  )
  if (!checkpoint) return undefined

  const execution = await loadCheckpointExecution(checkpoint)
  if (!execution) {
    await removeCorruptExecution(checkpoint.executionId)
    return undefined
  }

  touchCheckpoint(checkpoints, checkpoint)
  return execution
}

export async function loadLatestNotebookAiCheckpoint(
  scope: string,
): Promise<NotebookAiCheckpointSnapshot | undefined> {
  const checkpoints = listNotebookAiCheckpoints(scope)

  for (const checkpoint of checkpoints) {
    const execution = await loadNotebookAiCheckpoint(scope, checkpoint.id)
    if (execution) return { checkpoint, execution }
  }

  return undefined
}

export async function removeNotebookAiCheckpoint(
  scope: string,
  checkpointId: string,
) {
  const checkpoints = readCheckpointIndex()
  const checkpoint = checkpoints.find(
    (candidate) => candidate.scope === scope && candidate.id === checkpointId,
  )
  if (!checkpoint) return

  const retained = checkpoints.filter(
    (candidate) => candidate.scope !== scope || candidate.id !== checkpointId,
  )
  if (!writeCheckpointIndex(retained)) return
  if (
    !retained.some(
      (candidate) => candidate.executionId === checkpoint.executionId,
    )
  ) {
    await removeExecution(checkpoint.executionId)
  }
}

async function loadCheckpointExecution(checkpoint: StoredCheckpoint) {
  let value: unknown

  try {
    value = await readExecution(checkpoint.executionId)
    if (typeof value !== 'string') return undefined

    const execution = parseNotebookAiExecution(JSON.parse(value))
    const serialized = serializeNotebookAiExecution(execution)
    if (
      getUtf8ByteLength(serialized) !== checkpoint.sizeBytes ||
      (await createExecutionId(serialized)) !== checkpoint.executionId
    ) {
      return undefined
    }
    return execution
  } catch {
    return undefined
  }
}

function touchCheckpoint(
  checkpoints: ReadonlyArray<StoredCheckpoint>,
  checkpoint: StoredCheckpoint,
) {
  writeCheckpointIndex([
    { ...checkpoint, lastAccessedAt: Date.now() },
    ...checkpoints.filter(
      (candidate) =>
        candidate.scope !== checkpoint.scope || candidate.id !== checkpoint.id,
    ),
  ])
}

async function removeCorruptExecution(executionId: string) {
  const retained = readCheckpointIndex().filter(
    (checkpoint) => checkpoint.executionId !== executionId,
  )
  if (writeCheckpointIndex(retained)) await removeExecution(executionId)
}

async function removeUnreferencedExecutions(
  candidates: ReadonlyArray<StoredCheckpoint>,
  retained: ReadonlyArray<StoredCheckpoint>,
) {
  const retainedExecutionIds = new Set(
    retained.map((checkpoint) => checkpoint.executionId),
  )
  const unreferencedExecutionIds = new Set(
    candidates
      .filter((checkpoint) => !retainedExecutionIds.has(checkpoint.executionId))
      .map((checkpoint) => checkpoint.executionId),
  )

  await Promise.all(
    Array.from(unreferencedExecutionIds, (executionId) =>
      removeExecution(executionId),
    ),
  )
}

function readCheckpointIndex() {
  const storage = getLocalStorage()
  if (!storage) return []

  try {
    const serialized = storage.getItem(metadataStorageKey)
    if (!serialized) return []

    const value: unknown = JSON.parse(serialized)
    if (
      !isRecord(value) ||
      value.version !== 1 ||
      !Array.isArray(value.checkpoints) ||
      !value.checkpoints.every(isStoredCheckpoint)
    ) {
      storage.removeItem(metadataStorageKey)
      return []
    }

    const deduplicated = new Map<string, StoredCheckpoint>()
    for (const checkpoint of value.checkpoints) {
      const key = JSON.stringify([checkpoint.scope, checkpoint.id])
      const current = deduplicated.get(key)
      if (!current || current.lastAccessedAt < checkpoint.lastAccessedAt) {
        deduplicated.set(key, checkpoint)
      }
    }
    return Array.from(deduplicated.values())
  } catch {
    try {
      storage.removeItem(metadataStorageKey)
    } catch {
      // Browser storage is best-effort and must not interrupt notebook editing.
    }
    return []
  }
}

function writeCheckpointIndex(checkpoints: ReadonlyArray<StoredCheckpoint>) {
  const storage = getLocalStorage()
  if (!storage) return false

  try {
    storage.setItem(
      metadataStorageKey,
      JSON.stringify({ version: 1, checkpoints }),
    )
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

async function createExecutionId(serialized: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(serialized),
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength
}

function serializeCanonicalExecution(execution: NotebookAiExecution) {
  return serializeNotebookAiExecution(
    parseNotebookAiExecution(
      JSON.parse(serializeNotebookAiExecution(execution)),
    ),
  )
}

function toCheckpoint(checkpoint: StoredCheckpoint): NotebookAiCheckpoint {
  return {
    id: checkpoint.id,
    createdAt: checkpoint.createdAt,
    lastAccessedAt: checkpoint.lastAccessedAt,
    sizeBytes: checkpoint.sizeBytes,
    executionId: checkpoint.executionId,
    expectedExecutionId: checkpoint.expectedExecutionId,
  }
}

function isStoredCheckpoint(value: unknown): value is StoredCheckpoint {
  return (
    isRecord(value) &&
    typeof value.scope === 'string' &&
    typeof value.id === 'string' &&
    typeof value.createdAt === 'number' &&
    Number.isFinite(value.createdAt) &&
    typeof value.lastAccessedAt === 'number' &&
    Number.isFinite(value.lastAccessedAt) &&
    typeof value.sizeBytes === 'number' &&
    Number.isInteger(value.sizeBytes) &&
    value.sizeBytes >= 0 &&
    typeof value.executionId === 'string' &&
    executionIdPattern.test(value.executionId) &&
    typeof value.expectedExecutionId === 'string' &&
    executionIdPattern.test(value.expectedExecutionId) &&
    hasOnlyKeys(value, [
      'scope',
      'id',
      'createdAt',
      'lastAccessedAt',
      'sizeBytes',
      'executionId',
      'expectedExecutionId',
    ])
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  return Object.keys(value).every((key) => keys.includes(key))
}

function readExecution(executionId: string) {
  return runExecutionRequest('readonly', (store) => store.get(executionId))
}

function writeExecution(executionId: string, serialized: string) {
  return runExecutionRequest('readwrite', (store) =>
    store.put(serialized, executionId),
  )
}

async function removeExecution(executionId: string) {
  try {
    await runExecutionRequest('readwrite', (store) => store.delete(executionId))
  } catch {
    // Browser storage is best-effort and must not interrupt notebook editing.
  }
}

async function runExecutionRequest<TResult>(
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest<TResult>,
) {
  const database = await getCheckpointDatabase()
  return new Promise<TResult>((resolve, reject) => {
    let result: TResult

    try {
      const transaction = database.transaction(objectStoreName, mode)
      const request = createRequest(transaction.objectStore(objectStoreName))
      request.onsuccess = () => {
        result = request.result
      }
      request.onerror = () => {
        reject(request.error ?? new Error('IndexedDB request failed.'))
      }
      transaction.oncomplete = () => {
        resolve(result)
      }
      transaction.onerror = () => {
        reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
      }
      transaction.onabort = () => {
        reject(transaction.error ?? new Error('IndexedDB transaction aborted.'))
      }
    } catch (error) {
      reject(error)
    }
  })
}

function getCheckpointDatabase() {
  if (databasePromise) return databasePromise

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const factory = globalThis.indexedDB
    if (!factory) {
      reject(new Error('indexedDB is not available in this environment.'))
      return
    }

    let openFailed = false
    const request = factory.open(databaseName, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(objectStoreName)) {
        request.result.createObjectStore(objectStoreName)
      }
    }
    request.onerror = () => {
      openFailed = true
      reject(request.error ?? new Error(`Failed to open ${databaseName}.`))
    }
    request.onblocked = () => {
      openFailed = true
      reject(
        new Error(`Opening IndexedDB database "${databaseName}" was blocked.`),
      )
    }
    request.onsuccess = () => {
      const database = request.result
      if (openFailed) {
        database.close()
        return
      }
      database.onversionchange = () => {
        database.close()
        databasePromise = undefined
      }
      resolve(database)
    }
  }).catch((error: unknown) => {
    databasePromise = undefined
    throw error
  })

  return databasePromise
}
