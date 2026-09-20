export const builderProjectVersion = 1

export type BuilderAuthor = {
  name: string | null
  image: string | null
}

export type BuilderProject = {
  version: typeof builderProjectVersion
  id: string
  ownerId: string
  snapshotHash: string
  currentRevisionId?: string
  currentRevisionNumber?: number
  forkedFromId?: string
  title: string
  description: string
  author: BuilderAuthor
  createdAt: string
  updatedAt: string
}

export type BuilderProjectResponse = {
  project: BuilderProject
}

export type BuilderProjectListResponse = {
  projects: Array<BuilderProject>
}

export type DeleteBuilderProjectResponse = {
  deleted: true
  id: string
}

const builderProjectIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const builderProjectHashPattern = /^[a-f0-9]{64}$/

export function isBuilderProjectId(value: string) {
  return builderProjectIdPattern.test(value)
}

export function isBuilderProjectTimestamp(value: string) {
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.toISOString() === value
}

export function parseBuilderProject(value: unknown): BuilderProject {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'version',
      'id',
      'ownerId',
      'snapshotHash',
      'currentRevisionId',
      'currentRevisionNumber',
      'forkedFromId',
      'title',
      'description',
      'author',
      'createdAt',
      'updatedAt',
    ]) ||
    value.version !== builderProjectVersion ||
    typeof value.id !== 'string' ||
    !isBuilderProjectId(value.id) ||
    typeof value.ownerId !== 'string' ||
    !isBuilderProjectId(value.ownerId) ||
    typeof value.snapshotHash !== 'string' ||
    !builderProjectHashPattern.test(value.snapshotHash) ||
    (value.currentRevisionId !== undefined &&
      (typeof value.currentRevisionId !== 'string' ||
        !isBuilderProjectId(value.currentRevisionId))) ||
    (value.currentRevisionNumber !== undefined &&
      (typeof value.currentRevisionNumber !== 'number' ||
        !Number.isSafeInteger(value.currentRevisionNumber) ||
        value.currentRevisionNumber < 1)) ||
    (value.currentRevisionId === undefined) !==
      (value.currentRevisionNumber === undefined) ||
    (value.forkedFromId !== undefined &&
      (typeof value.forkedFromId !== 'string' ||
        !isBuilderProjectId(value.forkedFromId))) ||
    typeof value.title !== 'string' ||
    value.title.length === 0 ||
    value.title.length > 160 ||
    typeof value.description !== 'string' ||
    value.description.length > 1_000 ||
    !isBuilderAuthor(value.author) ||
    typeof value.createdAt !== 'string' ||
    !isBuilderProjectTimestamp(value.createdAt) ||
    typeof value.updatedAt !== 'string' ||
    !isBuilderProjectTimestamp(value.updatedAt)
  ) {
    throw new Error('Invalid Builder project')
  }

  return {
    version: builderProjectVersion,
    id: value.id,
    ownerId: value.ownerId,
    snapshotHash: value.snapshotHash,
    ...(value.currentRevisionId
      ? {
          currentRevisionId: value.currentRevisionId,
          currentRevisionNumber: value.currentRevisionNumber,
        }
      : {}),
    ...(value.forkedFromId ? { forkedFromId: value.forkedFromId } : {}),
    title: value.title,
    description: value.description,
    author: value.author,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function parseBuilderProjectResponse(value: unknown): BuilderProject {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['project']) ||
    !('project' in value)
  ) {
    throw new Error('Invalid Builder project response')
  }

  return parseBuilderProject(value.project)
}

export function parseBuilderProjectListResponse(
  value: unknown,
): Array<BuilderProject> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['projects']) ||
    !Array.isArray(value.projects)
  ) {
    throw new Error('Invalid Builder project list response')
  }

  return value.projects.map(parseBuilderProject)
}

export function parseDeleteBuilderProjectResponse(value: unknown): string {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['deleted', 'id']) ||
    value.deleted !== true ||
    typeof value.id !== 'string' ||
    !isBuilderProjectId(value.id)
  ) {
    throw new Error('Invalid delete Builder project response')
  }

  return value.id
}

function isBuilderAuthor(value: unknown): value is BuilderAuthor {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['name', 'image']) &&
    (value.name === null || typeof value.name === 'string') &&
    (value.image === null || typeof value.image === 'string')
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  return Object.keys(value).every((key) => keys.includes(key))
}
