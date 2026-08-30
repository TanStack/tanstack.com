import {
  parseSharedExampleProject,
  serializeSharedExampleProject,
  type SharedExampleProject,
} from './example-project'

const databaseName = 'tanstack-builder-project-working-copies'
const databaseVersion = 1
const objectStoreName = 'working-copies'
const storedWorkingCopyVersion = 1
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type BuilderProjectWorkingCopy = {
  projectId: string
  clientMutationId: string
  revisionId: string
  baseRevisionId: string
  expectedRevisionNumber: number
  project: SharedExampleProject
  updatedAt: number
}

export type BuilderProjectWorkingCopyIdentity = Pick<
  BuilderProjectWorkingCopy,
  'projectId' | 'clientMutationId' | 'revisionId'
>

export type BuilderProjectWorkingCopyReconciliation =
  | { status: 'none' }
  | { status: 'acknowledged' }
  | { status: 'ready'; workingCopy: BuilderProjectWorkingCopy }
  | { status: 'conflict'; workingCopy: BuilderProjectWorkingCopy }

type StoredBuilderProjectWorkingCopy = BuilderProjectWorkingCopy & {
  version: typeof storedWorkingCopyVersion
}

export class BuilderProjectWorkingCopyUnavailableError extends Error {
  override readonly name = 'BuilderProjectWorkingCopyUnavailableError'
}

export async function saveBuilderProjectWorkingCopy(
  workingCopy: BuilderProjectWorkingCopy,
) {
  const parsed = parseWorkingCopy({
    ...workingCopy,
    version: storedWorkingCopyVersion,
  })
  if (!parsed) throw new Error('Invalid Builder project working copy')

  await withWorkingCopyStore('readwrite', (store, finish, fail) => {
    const request = store.put(
      toStoredWorkingCopy(parsed),
      workingCopyStorageKey(parsed),
    )
    request.onsuccess = () => finish(undefined)
    request.onerror = () => fail(request.error)
  })
  return parsed
}

export async function loadBuilderProjectWorkingCopy(projectId: string) {
  return (await listBuilderProjectWorkingCopies(projectId))[0]
}

export async function listBuilderProjectWorkingCopies(projectId: string) {
  assertUuid(projectId, 'Builder project ID')

  return withWorkingCopyStore<Array<BuilderProjectWorkingCopy>>(
    'readwrite',
    (store, finish, fail) => {
      readWorkingCopyRecords(store, fail, (records) => {
        finish(
          records
            .map((record) => record.workingCopy)
            .filter((workingCopy) => workingCopy.projectId === projectId)
            .sort(compareWorkingCopies),
        )
      })
    },
  )
}

export async function clearBuilderProjectWorkingCopy(
  identity: BuilderProjectWorkingCopyIdentity,
) {
  assertUuid(identity.projectId, 'Builder project ID')
  assertUuid(identity.clientMutationId, 'Builder client mutation ID')
  assertUuid(identity.revisionId, 'Builder revision ID')

  return withWorkingCopyStore<boolean>('readwrite', (store, finish, fail) => {
    readWorkingCopyRecords(store, fail, (records) => {
      const record = records.find(
        ({ workingCopy }) =>
          workingCopy.projectId === identity.projectId &&
          workingCopy.clientMutationId === identity.clientMutationId &&
          workingCopy.revisionId === identity.revisionId,
      )
      if (record) {
        store.delete(record.key)
      }
      finish(record !== undefined)
    })
  })
}

export async function reconcileBuilderProjectWorkingCopy({
  projectId,
  currentRevisionId,
  currentRevisionNumber,
}: {
  projectId: string
  currentRevisionId: string
  currentRevisionNumber: number
}): Promise<BuilderProjectWorkingCopyReconciliation> {
  assertUuid(projectId, 'Builder project ID')
  assertUuid(currentRevisionId, 'Builder revision ID')
  if (
    !Number.isSafeInteger(currentRevisionNumber) ||
    currentRevisionNumber < 1
  ) {
    throw new Error('Invalid Builder project revision number')
  }

  return withWorkingCopyStore<BuilderProjectWorkingCopyReconciliation>(
    'readwrite',
    (store, finish, fail) => {
      readWorkingCopyRecords(store, fail, (records) => {
        const projectRecords = records
          .filter(({ workingCopy }) => workingCopy.projectId === projectId)
          .sort((left, right) =>
            compareWorkingCopies(left.workingCopy, right.workingCopy),
          )
        if (projectRecords.length === 0) {
          finish({ status: 'none' })
          return
        }

        for (const record of projectRecords) {
          if (record.workingCopy.revisionId === currentRevisionId) {
            store.delete(record.key)
          }
        }

        const unacknowledged = projectRecords
          .map((record) => record.workingCopy)
          .filter((candidate) => candidate.revisionId !== currentRevisionId)
        const workingCopy =
          unacknowledged.find(
            (candidate) =>
              candidate.baseRevisionId === currentRevisionId &&
              candidate.expectedRevisionNumber === currentRevisionNumber,
          ) ?? unacknowledged[0]
        if (!workingCopy) {
          finish({ status: 'acknowledged' })
          return
        }

        finish(
          workingCopy.baseRevisionId === currentRevisionId &&
            workingCopy.expectedRevisionNumber === currentRevisionNumber
            ? { status: 'ready', workingCopy }
            : { status: 'conflict', workingCopy },
        )
      })
    },
  )
}

function toStoredWorkingCopy(
  workingCopy: BuilderProjectWorkingCopy,
): StoredBuilderProjectWorkingCopy {
  return { version: storedWorkingCopyVersion, ...workingCopy }
}

type WorkingCopyRecord = {
  key: IDBValidKey
  workingCopy: BuilderProjectWorkingCopy
}

function readWorkingCopyRecords(
  store: IDBObjectStore,
  fail: (error: unknown) => void,
  finish: (records: Array<WorkingCopyRecord>) => void,
) {
  const valuesRequest = store.getAll()
  const keysRequest = store.getAllKeys()
  let values: Array<unknown> | undefined
  let keys: Array<IDBValidKey> | undefined

  const read = () => {
    if (!values || !keys) return

    const recordsByStorageKey = new Map<string, WorkingCopyRecord>()
    const recordCount = Math.max(values.length, keys.length)
    for (let index = 0; index < recordCount; index += 1) {
      const key = keys[index]
      const workingCopy = parseWorkingCopy(values[index])
      if (key === undefined || !workingCopy) continue

      const storageKey = workingCopyStorageKey(workingCopy)
      const existing = recordsByStorageKey.get(storageKey)
      if (
        !existing ||
        compareWorkingCopies(workingCopy, existing.workingCopy) < 0
      ) {
        recordsByStorageKey.set(storageKey, { key: storageKey, workingCopy })
      }
    }

    for (const record of recordsByStorageKey.values()) {
      store.put(toStoredWorkingCopy(record.workingCopy), record.key)
    }
    for (const key of keys) {
      if (typeof key !== 'string' || !recordsByStorageKey.has(key)) {
        store.delete(key)
      }
    }

    finish([...recordsByStorageKey.values()])
  }

  valuesRequest.onsuccess = () => {
    values = valuesRequest.result
    read()
  }
  valuesRequest.onerror = () => fail(valuesRequest.error)
  keysRequest.onsuccess = () => {
    keys = keysRequest.result
    read()
  }
  keysRequest.onerror = () => fail(keysRequest.error)
}

function workingCopyStorageKey(
  workingCopy: Pick<
    BuilderProjectWorkingCopy,
    'projectId' | 'clientMutationId'
  >,
) {
  return JSON.stringify([workingCopy.projectId, workingCopy.clientMutationId])
}

function compareWorkingCopies(
  left: BuilderProjectWorkingCopy,
  right: BuilderProjectWorkingCopy,
) {
  return (
    right.updatedAt - left.updatedAt ||
    left.clientMutationId.localeCompare(right.clientMutationId)
  )
}

function parseWorkingCopy(
  value: unknown,
): BuilderProjectWorkingCopy | undefined {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'version',
      'projectId',
      'clientMutationId',
      'revisionId',
      'baseRevisionId',
      'expectedRevisionNumber',
      'project',
      'updatedAt',
    ]) ||
    value.version !== storedWorkingCopyVersion ||
    !isUuid(value.projectId) ||
    !isUuid(value.clientMutationId) ||
    !isUuid(value.revisionId) ||
    !isUuid(value.baseRevisionId) ||
    typeof value.expectedRevisionNumber !== 'number' ||
    !Number.isSafeInteger(value.expectedRevisionNumber) ||
    value.expectedRevisionNumber < 1 ||
    typeof value.updatedAt !== 'number' ||
    !Number.isSafeInteger(value.updatedAt) ||
    value.updatedAt < 0
  ) {
    return undefined
  }

  try {
    const project = parseSharedExampleProject(value.project)
    const canonicalProject: unknown = JSON.parse(
      serializeSharedExampleProject(project),
    )
    return {
      projectId: value.projectId,
      clientMutationId: value.clientMutationId,
      revisionId: value.revisionId,
      baseRevisionId: value.baseRevisionId,
      expectedRevisionNumber: value.expectedRevisionNumber,
      project: parseSharedExampleProject(canonicalProject),
      updatedAt: value.updatedAt,
    }
  } catch {
    return undefined
  }
}

function assertUuid(value: string, label: string) {
  if (!isUuid(value)) throw new Error(`Invalid ${label}`)
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  return Object.keys(value).every((key) => keys.includes(key))
}

function withWorkingCopyStore<TResult>(
  mode: IDBTransactionMode,
  operation: (
    store: IDBObjectStore,
    finish: (value: TResult) => void,
    fail: (error: unknown) => void,
  ) => void,
) {
  return openWorkingCopyDatabase().then((database) =>
    new Promise<TResult>((resolve, reject) => {
      const transaction = database.transaction(objectStoreName, mode)
      const store = transaction.objectStore(objectStoreName)
      let result: { ready: false } | { ready: true; value: TResult } = {
        ready: false,
      }
      let failed = false

      const fail = (error: unknown) => {
        if (failed) return
        failed = true
        try {
          transaction.abort()
        } catch {
          // The transaction may already be complete.
        }
        reject(
          error ??
            transaction.error ??
            new BuilderProjectWorkingCopyUnavailableError(
              'Builder project working copy storage failed',
            ),
        )
      }
      const finish = (value: TResult) => {
        if (failed || result.ready) return
        result = { ready: true, value }
      }

      transaction.oncomplete = () => {
        if (failed) return
        if (!result.ready) {
          reject(
            new BuilderProjectWorkingCopyUnavailableError(
              'Builder project working copy storage did not complete',
            ),
          )
          return
        }
        resolve(result.value)
      }
      transaction.onerror = () => fail(transaction.error)
      transaction.onabort = () => fail(transaction.error)

      try {
        operation(store, finish, fail)
      } catch (error) {
        fail(error)
      }
    }).finally(() => database.close()),
  )
}

function openWorkingCopyDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof globalThis.indexedDB === 'undefined') {
      reject(
        new BuilderProjectWorkingCopyUnavailableError(
          'IndexedDB is unavailable for Builder project working copies',
        ),
      )
      return
    }

    const request = globalThis.indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(objectStoreName)) {
        request.result.createObjectStore(objectStoreName)
      }
    }
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
    request.onerror = () =>
      reject(
        request.error ??
          new BuilderProjectWorkingCopyUnavailableError(
            'Unable to open Builder project working copy storage',
          ),
      )
    request.onblocked = () =>
      reject(
        new BuilderProjectWorkingCopyUnavailableError(
          'Builder project working copy storage is blocked',
        ),
      )
  })
}
