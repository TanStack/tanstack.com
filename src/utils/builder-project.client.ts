import {
  parseDeleteBuilderProjectResponse,
  parseBuilderProjectListResponse,
  parseBuilderProjectResponse,
  type BuilderProject,
} from './builder-project'
import {
  parseSharedExampleProject,
  type SharedExampleProject,
} from './example-project'

export class BuilderRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'BuilderRequestError'
  }
}

export async function listBuilderProjects() {
  const response = await fetch('/api/builder/projects', {
    credentials: 'same-origin',
  })
  return parseBuilderProjectListResponse(await readResponse(response))
}

export async function createBuilderProject(
  project: SharedExampleProject,
  options: {
    clientMutationId?: string
    forkedFromId?: string
    id?: string
    revisionId?: string
  } = {},
) {
  const response = await fetch('/api/builder/projects', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      clientMutationId: options.clientMutationId ?? crypto.randomUUID(),
      id: options.id ?? crypto.randomUUID(),
      project,
      revisionId: options.revisionId ?? crypto.randomUUID(),
      ...(options.forkedFromId ? { forkedFromId: options.forkedFromId } : {}),
    }),
  })
  return parseBuilderProjectResponse(await readResponse(response))
}

export async function getBuilderProject(id: string) {
  const response = await fetch(`/api/builder/projects/${id}`, {
    credentials: 'same-origin',
  })
  return parseBuilderProjectResponse(await readResponse(response))
}

export async function updateBuilderProject(
  builderProject: BuilderProject,
  project: SharedExampleProject,
  clientMutationId: string = crypto.randomUUID(),
) {
  const response = await fetch(`/api/builder/projects/${builderProject.id}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      clientMutationId,
      expectedRevisionNumber: builderProject.currentRevisionNumber ?? 1,
      project,
      revisionId: crypto.randomUUID(),
    }),
  })
  return parseBuilderProjectResponse(await readResponse(response))
}

export async function deleteBuilderProject(project: BuilderProject) {
  const response = await fetch(`/api/builder/projects/${project.id}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientMutationId: crypto.randomUUID() }),
  })
  return parseDeleteBuilderProjectResponse(await readResponse(response))
}

export async function storeBuilderProjectRevision(
  project: SharedExampleProject,
) {
  const response = await fetch('/api/builder/project-snapshots', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(project),
  })
  return parseBuilderProjectSnapshotResponse(await readResponse(response))
}

export async function getBuilderProjectSnapshot(
  project: Pick<BuilderProject, 'snapshotHash'>,
) {
  const response = await fetch(
    `/api/builder/project-snapshots/${project.snapshotHash}`,
  )
  return parseSharedExampleProject(await readResponse(response))
}

async function readResponse(response: Response) {
  const value: unknown = await response.json().catch(() => undefined)
  if (response.ok) return value

  if (isRecord(value) && typeof value.error === 'string') {
    throw new BuilderRequestError(value.error, response.status)
  }

  throw new BuilderRequestError('Unable to load builder.', response.status)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseBuilderProjectSnapshotResponse(value: unknown) {
  if (
    !isRecord(value) ||
    Object.keys(value).some(
      (key) => key !== 'hash' && key !== 'sourceUrl' && key !== 'url',
    ) ||
    typeof value.hash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.hash)
  ) {
    throw new Error('Invalid Builder project snapshot response')
  }
  return value.hash
}
