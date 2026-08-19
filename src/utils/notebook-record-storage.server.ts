import { getBlobStorage } from '~/server/runtime/blob-storage.server'
import {
  isNotebookRecordId,
  notebookRecordVersion,
  parseNotebookRecord,
  type NotebookAuthor,
  type NotebookRecord,
} from './notebook-record'
import {
  isNotebookProjectHash,
  isNotebookProjectQuarantined,
  NotebookProjectQuarantinedError,
} from './notebook-project-storage.server'

const storageName = 'notebookProjects'
const maxRecordsPerOwner = 100
const projectRecordIndexPageSize = 100

export class NotebookRecordStorageUnavailableError extends Error {
  constructor() {
    super('Notebook record storage is unavailable')
    this.name = 'NotebookRecordStorageUnavailableError'
  }
}

export class NotebookRecordOwnershipError extends Error {
  constructor() {
    super('Notebook record is owned by another user')
    this.name = 'NotebookRecordOwnershipError'
  }
}

export class NotebookRecordConflictError extends Error {
  constructor() {
    super('Notebook was updated elsewhere')
    this.name = 'NotebookRecordConflictError'
  }
}

export class NotebookRecordLimitError extends Error {
  constructor() {
    super(`Notebook limit reached (${maxRecordsPerOwner})`)
    this.name = 'NotebookRecordLimitError'
  }
}

export class NotebookRecordQuarantinedError extends Error {
  constructor() {
    super('Notebook record is unavailable')
    this.name = 'NotebookRecordQuarantinedError'
  }
}

export async function createStoredNotebookRecord({
  author,
  description,
  forkedFromId,
  ownerId,
  projectHash,
  title,
}: {
  author: NotebookAuthor
  description: string
  forkedFromId?: string
  ownerId: string
  projectHash: string
  title: string
}) {
  const storage = await requireStorage()
  await assertOwnerHasRecordCapacity(storage, ownerId)
  await assertProjectIsAvailable(projectHash)

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const id = crypto.randomUUID()
    const timestamp = new Date().toISOString()
    const record = parseNotebookRecord({
      version: notebookRecordVersion,
      id,
      ownerId,
      projectHash,
      ...(forkedFromId ? { forkedFromId } : {}),
      title,
      description,
      author,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    const created = await storage.put(
      getRecordKey(id),
      JSON.stringify(record),
      {
        contentType: 'application/json; charset=utf-8',
        metadata: { ownerId, projectHash },
        onlyIfAbsent: true,
      },
    )
    if (!created) continue

    try {
      await storage.put(getOwnerIndexKey(ownerId, id), id, {
        contentType: 'text/plain; charset=utf-8',
        onlyIfAbsent: true,
      })
      await indexRecordProject(storage, record)
      await assertRecordIsAvailableAfterWrite(storage, record)
    } catch (error) {
      await storage.delete([getRecordKey(id), getOwnerIndexKey(ownerId, id)])
      throw error
    }

    return record
  }

  throw new Error('Could not allocate a notebook record ID')
}

export async function assertNotebookRecordCapacity(ownerId: string) {
  const storage = await requireStorage()
  await assertOwnerHasRecordCapacity(storage, ownerId)
}

export async function getStoredNotebookRecord(id: string) {
  if (!isNotebookRecordId(id)) return null
  const storage = await requireStorage()
  return readVisibleRecord(storage, id)
}

export async function listStoredNotebookRecords(ownerId: string) {
  if (!isNotebookRecordId(ownerId)) return []
  const storage = await requireStorage()
  const prefix = getOwnerIndexPrefix(ownerId)
  const records: Array<NotebookRecord> = []

  const page = await storage.list({
    limit: maxRecordsPerOwner,
    prefix,
  })
  const pageRecords = await Promise.all(
    page.objects.map(async (object) => {
      const id = getIndexedRecordId(object.key, prefix)
      return id ? readVisibleRecord(storage, id) : null
    }),
  )

  for (const record of pageRecords) {
    if (record?.ownerId === ownerId) records.push(record)
  }

  return records.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )
}

export async function updateStoredNotebookRecord({
  author,
  description,
  expectedUpdatedAt,
  id,
  ownerId,
  projectHash,
  title,
}: {
  author: NotebookAuthor
  description: string
  expectedUpdatedAt: string
  id: string
  ownerId: string
  projectHash: string
  title: string
}) {
  if (!isNotebookRecordId(id)) return null
  const storage = await requireStorage()
  await assertRecordIsNotQuarantined(storage, id)
  const existingObject = await readRecordObject(storage, id)
  if (!existingObject) return null
  const existing = existingObject.record
  if (existing.ownerId !== ownerId) throw new NotebookRecordOwnershipError()
  if (existing.updatedAt !== expectedUpdatedAt) {
    throw new NotebookRecordConflictError()
  }
  await assertProjectIsAvailable(projectHash)

  const record = parseNotebookRecord({
    ...existing,
    projectHash,
    title,
    description,
    author,
    updatedAt: getNextUpdatedAt(existing.updatedAt),
  })
  await assertRecordIsNotQuarantined(storage, id)

  const stored = await storage.put(getRecordKey(id), JSON.stringify(record), {
    contentType: 'application/json; charset=utf-8',
    etagMatches: existingObject.etag,
    metadata: { ownerId, projectHash },
  })
  if (!stored) {
    await assertRecordIsNotQuarantined(storage, id)
    throw new NotebookRecordConflictError()
  }

  let indexError: unknown
  try {
    await storage.put(getOwnerIndexKey(ownerId, id), id, {
      contentType: 'text/plain; charset=utf-8',
      onlyIfAbsent: true,
    })
    await indexRecordProject(storage, record)
  } catch (error) {
    indexError = error
  }

  await assertRecordIsAvailableAfterWrite(storage, record)
  if (indexError) throw indexError

  return record
}

export async function quarantineStoredNotebookRecordsByProjectHash(
  projectHash: string,
  userId: string,
) {
  if (!isNotebookProjectHash(projectHash)) return 0
  const storage = await requireStorage()
  const prefix = getProjectRecordIndexPrefix(projectHash)
  let cursor: string | undefined
  let quarantined = 0

  while (true) {
    const page = await storage.list({
      cursor,
      limit: projectRecordIndexPageSize,
      prefix,
    })
    const deleteKeys: Array<string> = []

    for (const object of page.objects) {
      const id = getIndexedRecordId(object.key, prefix)
      if (!id) continue

      const ownerId = object.metadata?.ownerId
      await putRecordQuarantine(storage, {
        id,
        projectHash,
        userId,
      })
      deleteKeys.push(getRecordKey(id))
      if (ownerId && isNotebookRecordId(ownerId)) {
        deleteKeys.push(getOwnerIndexKey(ownerId, id))
      }
      quarantined += 1
    }

    if (deleteKeys.length) await storage.delete(deleteKeys)
    if (!page.truncated) break
    if (!page.cursor || page.cursor === cursor) {
      throw new Error(
        'Notebook project record index pagination did not advance',
      )
    }
    cursor = page.cursor
  }

  return quarantined
}

export async function deleteStoredNotebookRecord(id: string, ownerId: string) {
  if (!isNotebookRecordId(id)) return false
  const storage = await requireStorage()
  const existing = await readRecord(storage, id)
  if (!existing) return false
  if (existing.ownerId !== ownerId) throw new NotebookRecordOwnershipError()

  await putRecordQuarantine(storage, {
    id: existing.id,
    projectHash: existing.projectHash,
    userId: ownerId,
  })
  await storage.delete([
    getRecordKey(existing.id),
    getOwnerIndexKey(existing.ownerId, existing.id),
  ])
  return true
}

async function requireStorage() {
  const storage = await getBlobStorage(storageName)
  if (!storage) throw new NotebookRecordStorageUnavailableError()
  return storage
}

async function assertOwnerHasRecordCapacity(
  storage: Awaited<ReturnType<typeof requireStorage>>,
  ownerId: string,
) {
  const ownerRecords = await storage.list({
    limit: maxRecordsPerOwner,
    prefix: getOwnerIndexPrefix(ownerId),
  })
  if (ownerRecords.objects.length >= maxRecordsPerOwner) {
    throw new NotebookRecordLimitError()
  }
}

async function readRecord(
  storage: Awaited<ReturnType<typeof requireStorage>>,
  id: string,
) {
  return (await readRecordObject(storage, id))?.record ?? null
}

async function readRecordObject(
  storage: Awaited<ReturnType<typeof requireStorage>>,
  id: string,
) {
  const object = await storage.get(getRecordKey(id))
  if (!object) return null

  let value: unknown
  try {
    value = JSON.parse(await object.text())
  } catch {
    throw new Error(`Invalid stored notebook record: ${id}`)
  }

  return { etag: object.etag, record: parseNotebookRecord(value) }
}

async function readVisibleRecord(
  storage: Awaited<ReturnType<typeof requireStorage>>,
  id: string,
) {
  const record = await readRecord(storage, id)
  if (!record || (await isRecordQuarantined(storage, id))) return null
  return record
}

async function indexRecordProject(
  storage: Awaited<ReturnType<typeof requireStorage>>,
  record: NotebookRecord,
) {
  await storage.put(
    getProjectRecordIndexKey(record.projectHash, record.id),
    record.id,
    {
      contentType: 'text/plain; charset=utf-8',
      metadata: {
        ownerId: record.ownerId,
        projectHash: record.projectHash,
      },
      onlyIfAbsent: true,
    },
  )
}

async function assertProjectIsAvailable(projectHash: string) {
  if (await isNotebookProjectQuarantined(projectHash)) {
    throw new NotebookProjectQuarantinedError()
  }
}

async function assertRecordIsNotQuarantined(
  storage: Awaited<ReturnType<typeof requireStorage>>,
  id: string,
) {
  if (await isRecordQuarantined(storage, id)) {
    throw new NotebookRecordQuarantinedError()
  }
}

async function assertRecordIsAvailableAfterWrite(
  storage: Awaited<ReturnType<typeof requireStorage>>,
  record: NotebookRecord,
) {
  const [recordQuarantined, projectQuarantined] = await Promise.all([
    isRecordQuarantined(storage, record.id),
    isNotebookProjectQuarantined(record.projectHash),
  ])
  if (!recordQuarantined && !projectQuarantined) return

  if (projectQuarantined) {
    await putRecordQuarantine(storage, {
      id: record.id,
      projectHash: record.projectHash,
    })
  }
  await storage.delete([
    getRecordKey(record.id),
    getOwnerIndexKey(record.ownerId, record.id),
  ])

  if (projectQuarantined) throw new NotebookProjectQuarantinedError()
  throw new NotebookRecordQuarantinedError()
}

async function isRecordQuarantined(
  storage: Awaited<ReturnType<typeof requireStorage>>,
  id: string,
) {
  return Boolean(await storage.get(getRecordQuarantineKey(id)))
}

async function putRecordQuarantine(
  storage: Awaited<ReturnType<typeof requireStorage>>,
  {
    id,
    projectHash,
    userId,
  }: { id: string; projectHash: string; userId?: string },
) {
  await storage.put(
    getRecordQuarantineKey(id),
    JSON.stringify({
      version: 1,
      id,
      projectHash,
      quarantinedAt: new Date().toISOString(),
      ...(userId ? { userId } : {}),
    }),
    {
      contentType: 'application/json; charset=utf-8',
      metadata: {
        projectHash,
        ...(userId ? { userId } : {}),
      },
      onlyIfAbsent: true,
    },
  )
}

function getNextUpdatedAt(previousUpdatedAt: string) {
  return new Date(
    Math.max(Date.now(), new Date(previousUpdatedAt).getTime() + 1),
  ).toISOString()
}

function getRecordKey(id: string) {
  return `records/v1/${id}.json`
}

function getOwnerIndexPrefix(ownerId: string) {
  return `record-index/v1/${ownerId}/`
}

function getOwnerIndexKey(ownerId: string, id: string) {
  return `${getOwnerIndexPrefix(ownerId)}${id}`
}

function getProjectRecordIndexPrefix(projectHash: string) {
  return `record-project-index/v1/${projectHash}/`
}

function getProjectRecordIndexKey(projectHash: string, id: string) {
  return `${getProjectRecordIndexPrefix(projectHash)}${id}`
}

function getRecordQuarantineKey(id: string) {
  return `record-quarantine/v1/${id}.json`
}

function getIndexedRecordId(key: string, prefix: string) {
  if (!key.startsWith(prefix)) return undefined
  const id = key.slice(prefix.length)
  return isNotebookRecordId(id) ? id : undefined
}
