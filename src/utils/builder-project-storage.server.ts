import { getBlobStorage } from '~/server/runtime/blob-storage.server'
import {
  isBuilderProjectId,
  builderProjectVersion,
  parseBuilderProject,
  type BuilderAuthor,
  type BuilderProject,
} from './builder-project'
import {
  isBuilderProjectSnapshotHash,
  isBuilderProjectSnapshotQuarantined,
  BuilderProjectSnapshotQuarantinedError,
} from './builder-project-snapshot-storage.server'

const storageName = 'builderProjects'
const maxProjectsPerOwner = 100
const snapshotProjectIndexPageSize = 100

export class BuilderProjectStorageUnavailableError extends Error {
  constructor() {
    super('Builder project storage is unavailable')
    this.name = 'BuilderProjectStorageUnavailableError'
  }
}

export class BuilderProjectOwnershipError extends Error {
  constructor() {
    super('Builder project is owned by another user')
    this.name = 'BuilderProjectOwnershipError'
  }
}

export class BuilderProjectConflictError extends Error {
  constructor() {
    super('Project was updated elsewhere')
    this.name = 'BuilderProjectConflictError'
  }
}

export class BuilderProjectLimitError extends Error {
  constructor() {
    super(`Project limit reached (${maxProjectsPerOwner})`)
    this.name = 'BuilderProjectLimitError'
  }
}

export class BuilderProjectQuarantinedError extends Error {
  constructor() {
    super('Builder project is unavailable')
    this.name = 'BuilderProjectQuarantinedError'
  }
}

export async function createStoredBuilderProject({
  author,
  description,
  forkedFromId,
  ownerId,
  snapshotHash,
  title,
}: {
  author: BuilderAuthor
  description: string
  forkedFromId?: string
  ownerId: string
  snapshotHash: string
  title: string
}) {
  const storage = await requireStorage()
  await assertOwnerHasProjectCapacity(storage, ownerId)
  await assertSnapshotIsAvailable(snapshotHash)

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const id = crypto.randomUUID()
    const timestamp = new Date().toISOString()
    const project = parseBuilderProject({
      version: builderProjectVersion,
      id,
      ownerId,
      snapshotHash,
      ...(forkedFromId ? { forkedFromId } : {}),
      title,
      description,
      author,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    const created = await storage.put(
      getProjectKey(id),
      JSON.stringify(project),
      {
        contentType: 'application/json; charset=utf-8',
        metadata: { ownerId, snapshotHash },
        onlyIfAbsent: true,
      },
    )
    if (!created) continue

    try {
      await storage.put(getOwnerIndexKey(ownerId, id), id, {
        contentType: 'text/plain; charset=utf-8',
        onlyIfAbsent: true,
      })
      await indexSnapshotProject(storage, project)
      await assertProjectIsAvailableAfterWrite(storage, project)
    } catch (error) {
      await storage.delete([getProjectKey(id), getOwnerIndexKey(ownerId, id)])
      throw error
    }

    return project
  }

  throw new Error('Could not allocate a builder project ID')
}

export async function assertBuilderProjectCapacity(ownerId: string) {
  const storage = await requireStorage()
  await assertOwnerHasProjectCapacity(storage, ownerId)
}

export async function getStoredBuilderProject(id: string) {
  if (!isBuilderProjectId(id)) return null
  const storage = await requireStorage()
  return readVisibleProject(storage, id)
}

export type StoredBuilderProjectIdReservation =
  | { reserved: false; project: null }
  | { reserved: true; project: BuilderProject | null }

export async function getStoredBuilderProjectIdReservation(
  id: string,
): Promise<StoredBuilderProjectIdReservation> {
  if (!isBuilderProjectId(id)) {
    return { reserved: false, project: null }
  }

  const storage = await requireStorage()
  if (await isProjectQuarantined(storage, id)) {
    return { reserved: true, project: null }
  }

  const project = await readProject(storage, id)
  if (await isProjectQuarantined(storage, id)) {
    return { reserved: true, project: null }
  }
  return project
    ? { reserved: true, project }
    : { reserved: false, project: null }
}

export async function listStoredBuilderProjects(ownerId: string) {
  if (!isBuilderProjectId(ownerId)) return []
  const storage = await requireStorage()
  const prefix = getOwnerIndexPrefix(ownerId)
  const projects: Array<BuilderProject> = []

  const page = await storage.list({
    limit: maxProjectsPerOwner,
    prefix,
  })
  if (page.truncated) throw new BuilderProjectLimitError()

  const pageProjects = await Promise.all(
    page.objects.map(async (object) => {
      const id = getIndexedProjectId(object.key, prefix)
      return id ? readVisibleProject(storage, id) : null
    }),
  )

  for (const project of pageProjects) {
    if (project?.ownerId === ownerId) projects.push(project)
  }

  return projects.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )
}

export async function updateStoredBuilderProject({
  author,
  description,
  expectedUpdatedAt,
  id,
  ownerId,
  snapshotHash,
  title,
}: {
  author: BuilderAuthor
  description: string
  expectedUpdatedAt: string
  id: string
  ownerId: string
  snapshotHash: string
  title: string
}) {
  if (!isBuilderProjectId(id)) return null
  const storage = await requireStorage()
  await assertProjectIsNotQuarantined(storage, id)
  const existingObject = await readProjectObject(storage, id)
  if (!existingObject) return null
  const existing = existingObject.project
  if (existing.ownerId !== ownerId) throw new BuilderProjectOwnershipError()
  if (existing.updatedAt !== expectedUpdatedAt) {
    throw new BuilderProjectConflictError()
  }
  await assertSnapshotIsAvailable(snapshotHash)

  const project = parseBuilderProject({
    ...existing,
    snapshotHash,
    title,
    description,
    author,
    updatedAt: getNextUpdatedAt(existing.updatedAt),
  })
  await assertProjectIsNotQuarantined(storage, id)

  const stored = await storage.put(getProjectKey(id), JSON.stringify(project), {
    contentType: 'application/json; charset=utf-8',
    etagMatches: existingObject.etag,
    metadata: { ownerId, snapshotHash },
  })
  if (!stored) {
    await assertProjectIsNotQuarantined(storage, id)
    throw new BuilderProjectConflictError()
  }

  let indexError: unknown
  try {
    await storage.put(getOwnerIndexKey(ownerId, id), id, {
      contentType: 'text/plain; charset=utf-8',
      onlyIfAbsent: true,
    })
    await indexSnapshotProject(storage, project)
  } catch (error) {
    indexError = error
  }

  await assertProjectIsAvailableAfterWrite(storage, project)
  if (indexError) throw indexError

  return project
}

export async function quarantineStoredBuilderProjectsBySnapshotHash(
  snapshotHash: string,
  userId: string,
) {
  if (!isBuilderProjectSnapshotHash(snapshotHash)) return 0
  const storage = await requireStorage()
  const prefix = getSnapshotProjectIndexPrefix(snapshotHash)
  let cursor: string | undefined
  let quarantined = 0

  while (true) {
    const page = await storage.list({
      cursor,
      limit: snapshotProjectIndexPageSize,
      prefix,
    })
    const deleteKeys: Array<string> = []

    for (const object of page.objects) {
      const id = getIndexedProjectId(object.key, prefix)
      if (!id) continue

      const ownerId = object.metadata?.ownerId
      await putProjectQuarantine(storage, {
        id,
        snapshotHash,
        userId,
      })
      deleteKeys.push(getProjectKey(id))
      if (ownerId && isBuilderProjectId(ownerId)) {
        deleteKeys.push(getOwnerIndexKey(ownerId, id))
      }
      quarantined += 1
    }

    if (deleteKeys.length) await storage.delete(deleteKeys)
    if (!page.truncated) break
    if (!page.cursor || page.cursor === cursor) {
      throw new Error(
        'Builder project snapshot index pagination did not advance',
      )
    }
    cursor = page.cursor
  }

  return quarantined
}

export async function deleteStoredBuilderProject(id: string, ownerId: string) {
  if (!isBuilderProjectId(id)) return false
  const storage = await requireStorage()
  const existing = await readProject(storage, id)
  if (!existing) return false
  if (existing.ownerId !== ownerId) throw new BuilderProjectOwnershipError()

  await putProjectQuarantine(storage, {
    id: existing.id,
    snapshotHash: existing.snapshotHash,
    userId: ownerId,
  })
  await storage.delete([
    getProjectKey(existing.id),
    getOwnerIndexKey(existing.ownerId, existing.id),
  ])
  return true
}

async function requireStorage() {
  const storage = await getBlobStorage(storageName)
  if (!storage) throw new BuilderProjectStorageUnavailableError()
  return storage
}

async function assertOwnerHasProjectCapacity(
  storage: Awaited<ReturnType<typeof requireStorage>>,
  ownerId: string,
) {
  const ownerProjects = await storage.list({
    limit: maxProjectsPerOwner,
    prefix: getOwnerIndexPrefix(ownerId),
  })
  if (ownerProjects.objects.length >= maxProjectsPerOwner) {
    throw new BuilderProjectLimitError()
  }
}

async function readProject(
  storage: Awaited<ReturnType<typeof requireStorage>>,
  id: string,
) {
  return (await readProjectObject(storage, id))?.project ?? null
}

async function readProjectObject(
  storage: Awaited<ReturnType<typeof requireStorage>>,
  id: string,
) {
  const object = await storage.get(getProjectKey(id))
  if (!object) return null

  let value: unknown
  try {
    value = JSON.parse(await object.text())
  } catch {
    throw new Error(`Invalid stored builder project: ${id}`)
  }

  return { etag: object.etag, project: parseStoredBuilderProject(value) }
}

function parseStoredBuilderProject(value: unknown) {
  if (!isRecord(value) || !Object.hasOwn(value, 'projectHash')) {
    return parseBuilderProject(value)
  }

  const { projectHash, ...project } = value
  return parseBuilderProject({ ...project, snapshotHash: projectHash })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readVisibleProject(
  storage: Awaited<ReturnType<typeof requireStorage>>,
  id: string,
) {
  const project = await readProject(storage, id)
  if (!project || (await isProjectQuarantined(storage, id))) return null
  return project
}

async function indexSnapshotProject(
  storage: Awaited<ReturnType<typeof requireStorage>>,
  project: BuilderProject,
) {
  await storage.put(
    getSnapshotProjectIndexKey(project.snapshotHash, project.id),
    project.id,
    {
      contentType: 'text/plain; charset=utf-8',
      metadata: {
        ownerId: project.ownerId,
        snapshotHash: project.snapshotHash,
      },
      onlyIfAbsent: true,
    },
  )
}

async function assertSnapshotIsAvailable(snapshotHash: string) {
  if (await isBuilderProjectSnapshotQuarantined(snapshotHash)) {
    throw new BuilderProjectSnapshotQuarantinedError()
  }
}

async function assertProjectIsNotQuarantined(
  storage: Awaited<ReturnType<typeof requireStorage>>,
  id: string,
) {
  if (await isProjectQuarantined(storage, id)) {
    throw new BuilderProjectQuarantinedError()
  }
}

async function assertProjectIsAvailableAfterWrite(
  storage: Awaited<ReturnType<typeof requireStorage>>,
  project: BuilderProject,
) {
  const [projectQuarantined, snapshotQuarantined] = await Promise.all([
    isProjectQuarantined(storage, project.id),
    isBuilderProjectSnapshotQuarantined(project.snapshotHash),
  ])
  if (!projectQuarantined && !snapshotQuarantined) return

  if (snapshotQuarantined) {
    await putProjectQuarantine(storage, {
      id: project.id,
      snapshotHash: project.snapshotHash,
    })
  }
  await storage.delete([
    getProjectKey(project.id),
    getOwnerIndexKey(project.ownerId, project.id),
  ])

  if (snapshotQuarantined) throw new BuilderProjectSnapshotQuarantinedError()
  throw new BuilderProjectQuarantinedError()
}

async function isProjectQuarantined(
  storage: Awaited<ReturnType<typeof requireStorage>>,
  id: string,
) {
  return Boolean(await storage.get(getProjectQuarantineKey(id)))
}

async function putProjectQuarantine(
  storage: Awaited<ReturnType<typeof requireStorage>>,
  {
    id,
    snapshotHash,
    userId,
  }: { id: string; snapshotHash: string; userId?: string },
) {
  await storage.put(
    getProjectQuarantineKey(id),
    JSON.stringify({
      version: 1,
      id,
      snapshotHash,
      quarantinedAt: new Date().toISOString(),
      ...(userId ? { userId } : {}),
    }),
    {
      contentType: 'application/json; charset=utf-8',
      metadata: {
        snapshotHash,
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

function getProjectKey(id: string) {
  return `records/v1/${id}.json`
}

function getOwnerIndexPrefix(ownerId: string) {
  return `record-index/v1/${ownerId}/`
}

function getOwnerIndexKey(ownerId: string, id: string) {
  return `${getOwnerIndexPrefix(ownerId)}${id}`
}

function getSnapshotProjectIndexPrefix(snapshotHash: string) {
  return `record-project-index/v1/${snapshotHash}/`
}

function getSnapshotProjectIndexKey(snapshotHash: string, id: string) {
  return `${getSnapshotProjectIndexPrefix(snapshotHash)}${id}`
}

function getProjectQuarantineKey(id: string) {
  return `record-quarantine/v1/${id}.json`
}

function getIndexedProjectId(key: string, prefix: string) {
  if (!key.startsWith(prefix)) return undefined
  const id = key.slice(prefix.length)
  return isBuilderProjectId(id) ? id : undefined
}
