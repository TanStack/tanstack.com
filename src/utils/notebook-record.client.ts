import {
  parseDeleteNotebookRecordResponse,
  parseNotebookRecordListResponse,
  parseNotebookRecordResponse,
  type NotebookRecord,
} from './notebook-record'
import {
  parseSharedExampleProject,
  type SharedExampleProject,
} from './example-project'

export class NotebookRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'NotebookRequestError'
  }
}

export async function listNotebookRecords() {
  const response = await fetch('/api/notebook/records', {
    credentials: 'same-origin',
  })
  return parseNotebookRecordListResponse(await readResponse(response))
}

export async function createNotebookRecord(
  project: SharedExampleProject,
  forkedFromId?: string,
) {
  const response = await fetch('/api/notebook/records', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      project,
      ...(forkedFromId ? { forkedFromId } : {}),
    }),
  })
  return parseNotebookRecordResponse(await readResponse(response))
}

export async function getNotebookRecord(id: string) {
  const response = await fetch(`/api/notebook/records/${id}`, {
    credentials: 'same-origin',
  })
  return parseNotebookRecordResponse(await readResponse(response))
}

export async function updateNotebookRecord(
  record: NotebookRecord,
  project: SharedExampleProject,
) {
  const response = await fetch(`/api/notebook/records/${record.id}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ expectedUpdatedAt: record.updatedAt, project }),
  })
  return parseNotebookRecordResponse(await readResponse(response))
}

export async function deleteNotebookRecord(record: NotebookRecord) {
  const response = await fetch(`/api/notebook/records/${record.id}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  return parseDeleteNotebookRecordResponse(await readResponse(response))
}

export async function getNotebookRecordProject(record: NotebookRecord) {
  const response = await fetch(`/api/notebook/projects/${record.projectHash}`)
  return parseSharedExampleProject(await readResponse(response))
}

async function readResponse(response: Response) {
  const value: unknown = await response.json().catch(() => undefined)
  if (response.ok) return value

  if (isRecord(value) && typeof value.error === 'string') {
    throw new NotebookRequestError(value.error, response.status)
  }

  throw new NotebookRequestError('Unable to load notebook.', response.status)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
