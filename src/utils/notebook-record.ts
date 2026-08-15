export const notebookRecordVersion = 1

export type NotebookAuthor = {
  name: string | null
  image: string | null
}

export type NotebookRecord = {
  version: typeof notebookRecordVersion
  id: string
  ownerId: string
  projectHash: string
  forkedFromId?: string
  title: string
  description: string
  author: NotebookAuthor
  createdAt: string
  updatedAt: string
}

export type NotebookRecordResponse = {
  record: NotebookRecord
}

export type NotebookRecordListResponse = {
  records: Array<NotebookRecord>
}

export type DeleteNotebookRecordResponse = {
  deleted: true
  id: string
}

const notebookRecordIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const notebookProjectHashPattern = /^[a-f0-9]{64}$/

export function isNotebookRecordId(value: string) {
  return notebookRecordIdPattern.test(value)
}

export function isNotebookRecordTimestamp(value: string) {
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.toISOString() === value
}

export function parseNotebookRecord(value: unknown): NotebookRecord {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'version',
      'id',
      'ownerId',
      'projectHash',
      'forkedFromId',
      'title',
      'description',
      'author',
      'createdAt',
      'updatedAt',
    ]) ||
    value.version !== notebookRecordVersion ||
    typeof value.id !== 'string' ||
    !isNotebookRecordId(value.id) ||
    typeof value.ownerId !== 'string' ||
    !isNotebookRecordId(value.ownerId) ||
    typeof value.projectHash !== 'string' ||
    !notebookProjectHashPattern.test(value.projectHash) ||
    (value.forkedFromId !== undefined &&
      (typeof value.forkedFromId !== 'string' ||
        !isNotebookRecordId(value.forkedFromId))) ||
    typeof value.title !== 'string' ||
    value.title.length === 0 ||
    value.title.length > 160 ||
    typeof value.description !== 'string' ||
    value.description.length > 1_000 ||
    !isNotebookAuthor(value.author) ||
    typeof value.createdAt !== 'string' ||
    !isNotebookRecordTimestamp(value.createdAt) ||
    typeof value.updatedAt !== 'string' ||
    !isNotebookRecordTimestamp(value.updatedAt)
  ) {
    throw new Error('Invalid notebook record')
  }

  return {
    version: notebookRecordVersion,
    id: value.id,
    ownerId: value.ownerId,
    projectHash: value.projectHash,
    ...(value.forkedFromId ? { forkedFromId: value.forkedFromId } : {}),
    title: value.title,
    description: value.description,
    author: value.author,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function parseNotebookRecordResponse(value: unknown): NotebookRecord {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['record']) ||
    !('record' in value)
  ) {
    throw new Error('Invalid notebook record response')
  }

  return parseNotebookRecord(value.record)
}

export function parseNotebookRecordListResponse(
  value: unknown,
): Array<NotebookRecord> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['records']) ||
    !Array.isArray(value.records)
  ) {
    throw new Error('Invalid notebook record list response')
  }

  return value.records.map(parseNotebookRecord)
}

export function parseDeleteNotebookRecordResponse(value: unknown): string {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['deleted', 'id']) ||
    value.deleted !== true ||
    typeof value.id !== 'string' ||
    !isNotebookRecordId(value.id)
  ) {
    throw new Error('Invalid delete notebook record response')
  }

  return value.id
}

function isNotebookAuthor(value: unknown): value is NotebookAuthor {
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
