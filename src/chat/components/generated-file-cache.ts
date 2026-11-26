import { maxFileBytes } from '../core/files'

const databaseName = 'gum-generated-files'
const storeName = 'files'
const maxEntries = 100
const maxBytes = 50 * 1024 * 1024
const retentionMs = 7 * 24 * 60 * 60 * 1000
// A supported 1,000-character conversation ID can occupy 9,000 characters
// after URI encoding. Leave bounded room for the JSON account/workspace tuple
// and resource prefix, retaining the entire identity without truncation.
export const maxGeneratedFileScopeLength = 64 * 1024
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const hash = /^[0-9a-f]{64}$/
const mediaType = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/

interface CachedFile {
  scopeKey: string
  fileId: string
  blob: Blob
  name: string
  type: string
  size: number
  sha256: string
  lastModified: number
  createdAt: number
}

function storageError(cause?: unknown) {
  return new Error(
    cause instanceof DOMException && cause.name === 'QuotaExceededError'
      ? 'This browser has no space to save the sketch for retry. Free some browser storage and try again.'
      : 'This browser could not access saved sketches. Allow browser storage and try again.',
    { cause },
  )
}

function validateKey(scopeKey: string, fileId: string) {
  if (
    typeof scopeKey !== 'string' ||
    !scopeKey.trim() ||
    scopeKey.length > maxGeneratedFileScopeLength ||
    /[\x00-\x1f\x7f]/.test(scopeKey) ||
    typeof fileId !== 'string' ||
    !uuid.test(fileId)
  )
    throw new Error('The sketch attachment has an invalid storage identity.')
}

function validMetadata(value: CachedFile) {
  return (
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    value.name.length <= 255 &&
    !/[\x00-\x1f\x7f/\\]/.test(value.name) &&
    typeof value.type === 'string' &&
    value.type.length <= 200 &&
    mediaType.test(value.type) &&
    Number.isSafeInteger(value.size) &&
    value.size > 0 &&
    value.size <= maxFileBytes &&
    typeof value.sha256 === 'string' &&
    hash.test(value.sha256) &&
    Number.isSafeInteger(value.lastModified) &&
    value.lastModified >= 0 &&
    Number.isSafeInteger(value.createdAt) &&
    value.createdAt >= 0
  )
}

function validateRecord(value: unknown): CachedFile {
  if (!value || typeof value !== 'object')
    throw new Error('The saved sketch could not be verified. Attach it again.')
  const record = value as CachedFile
  validateKey(record.scopeKey, record.fileId)
  if (
    !validMetadata(record) ||
    !(record.blob instanceof Blob) ||
    record.blob.size !== record.size ||
    record.blob.type !== record.type
  )
    throw new Error('The saved sketch could not be verified. Attach it again.')
  return record
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest
    let blocked = false
    try {
      if (typeof indexedDB === 'undefined') throw storageError()
      request = indexedDB.open(databaseName, 1)
    } catch (error) {
      reject(storageError(error))
      return
    }
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName, {
        keyPath: ['scopeKey', 'fileId'],
      })
    }
    request.onblocked = () => {
      blocked = true
      reject(
        new Error(
          'Close other TanChat tabs, then try saving the sketch again.',
        ),
      )
    }
    request.onerror = () => reject(storageError(request.error))
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      if (blocked) database.close()
      else resolve(database)
    }
  })
}

// Queue every request inside an IndexedDB callback so the transaction stays
// active. Resolve only after commit, including when a request itself succeeded.
async function transact<T>(
  mode: IDBTransactionMode,
  action: (
    store: IDBObjectStore,
    finish: (value: T) => void,
    fail: (error: Error) => void,
  ) => void,
): Promise<T> {
  const database = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      let transaction: IDBTransaction
      try {
        transaction = database.transaction(storeName, mode)
      } catch (error) {
        reject(storageError(error))
        return
      }
      let result: T
      let failure: Error | undefined
      transaction.oncomplete = () => resolve(result)
      transaction.onabort = () =>
        reject(failure ?? storageError(transaction.error))
      const fail = (error: Error) => {
        failure = error
        transaction.abort()
      }
      try {
        action(
          transaction.objectStore(storeName),
          (value) => (result = value),
          fail,
        )
      } catch (error) {
        fail(storageError(error))
      }
    })
  } finally {
    database.close()
  }
}

/** Save a pending generated attachment before adding it to the composer. */
export async function persistGeneratedFile(
  scopeKey: string,
  id: string,
  file: File,
  sha256: string,
): Promise<void> {
  validateKey(scopeKey, id)
  if (typeof File === 'undefined' || !(file instanceof File))
    throw new Error('The sketch attachment must be a file.')
  if (file.size > maxFileBytes)
    throw new Error('Each sketch must be 2 MB or smaller.')
  const record: CachedFile = {
    scopeKey,
    fileId: id,
    blob: file.slice(0, file.size, file.type),
    name: file.name,
    type: file.type,
    size: file.size,
    sha256,
    lastModified: file.lastModified,
    createdAt: Date.now(),
  }
  if (!validMetadata(record))
    throw new Error('The sketch attachment has invalid file details.')

  await transact<void>('readwrite', (store, finish, fail) => {
    let entries = 0
    let bytes = 0
    let existing = false
    const request = store.openCursor()
    request.onsuccess = () => {
      try {
        const cursor = request.result
        if (!cursor) {
          if (!existing) {
            if (entries >= maxEntries || bytes + record.size > maxBytes) {
              fail(
                new Error(
                  'Too many sketches are waiting to upload in this browser. Upload or remove a pending sketch, then try again.',
                ),
              )
              return
            }
            store.add(record)
          }
          finish(undefined)
          return
        }
        const saved = validateRecord(cursor.value)
        if (saved.createdAt < record.createdAt - retentionMs) {
          cursor.delete()
        } else {
          entries++
          bytes += saved.blob.size
          if (saved.scopeKey === scopeKey && saved.fileId === id) {
            if (
              saved.sha256 !== sha256 ||
              saved.name !== file.name ||
              saved.type !== file.type ||
              saved.size !== file.size
            ) {
              fail(
                new Error(
                  'A different sketch already uses this attachment identity. Attach it again.',
                ),
              )
              return
            }
            // Retrying the same attachment must not extend its retention time.
            existing = true
          }
        }
        cursor.continue()
      } catch (error) {
        fail(error instanceof Error ? error : storageError(error))
      }
    }
  })
}

/** Restore only the exact account, workspace, and conversation scope requested. */
export async function readGeneratedFile(
  scopeKey: string,
  id: string,
): Promise<File | undefined> {
  validateKey(scopeKey, id)
  const saved = await transact<CachedFile | undefined>(
    'readwrite',
    (store, finish, fail) => {
      const request = store.get([scopeKey, id])
      request.onsuccess = () => {
        try {
          if (request.result === undefined) {
            finish(undefined)
            return
          }
          const record = validateRecord(request.result)
          if (record.scopeKey !== scopeKey || record.fileId !== id)
            throw new Error(
              'The saved sketch belongs to a different attachment.',
            )
          if (record.createdAt < Date.now() - retentionMs) {
            store.delete([scopeKey, id])
            finish(undefined)
          } else finish(record)
        } catch (error) {
          fail(error instanceof Error ? error : storageError(error))
        }
      }
    },
  )
  if (!saved) return undefined
  const bytes = await saved.blob.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const sha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  if (bytes.byteLength !== saved.size || sha256 !== saved.sha256)
    throw new Error(
      'The saved sketch bytes could not be verified. Attach it again.',
    )
  return new File([bytes], saved.name, {
    type: saved.type,
    lastModified: saved.lastModified,
  })
}

/** Removing an absent attachment is safe; other scopes are never removed. */
export async function removeGeneratedFile(
  scopeKey: string,
  id: string,
): Promise<void> {
  validateKey(scopeKey, id)
  await transact<void>('readwrite', (store, finish) => {
    store.delete([scopeKey, id])
    finish(undefined)
  })
}
