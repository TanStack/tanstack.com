import { getBlobStorage } from '~/server/runtime/blob-storage.server'
import {
  parseSharedExampleProject,
  serializeSharedExampleProject,
  type SharedExampleProject,
} from './example-project'
import { sha256Hex } from './hash'
import { decodeExampleBinaryFile } from './example-workspace'

const storageName = 'notebookProjects'
const projectHashPattern = /^[a-f0-9]{64}$/
const maxCanonicalBytes = 1024 * 1024
const maxFileBytes = 512 * 1024
const maxFiles = 128
const maxPathBytes = 512
const maxTitleCharacters = 160
const maxDescriptionCharacters = 1_000

export class NotebookProjectStorageUnavailableError extends Error {
  constructor() {
    super('Notebook project storage is unavailable')
    this.name = 'NotebookProjectStorageUnavailableError'
  }
}

export class NotebookProjectQuarantinedError extends Error {
  constructor() {
    super('Notebook project is unavailable')
    this.name = 'NotebookProjectQuarantinedError'
  }
}

export function parseStoredNotebookProject(value: unknown) {
  const project = parseSharedExampleProject(value)
  validateProjectLimits(project)
  return project
}

export async function storeNotebookProject(project: SharedExampleProject) {
  validateProjectLimits(project)
  const source = serializeSharedExampleProject(project)
  const hash = await sha256Hex(source)
  const storage = await requireStorage()

  if (await storage.get(getQuarantineKey(hash))) {
    throw new NotebookProjectQuarantinedError()
  }

  const key = getProjectKey(hash)
  if (await storage.get(key)) return { created: false, hash }

  const bytes = await gzip(source)
  const created = await storage.put(key, bytes, {
    contentEncoding: 'gzip',
    contentType: 'application/json; charset=utf-8',
    metadata: {
      hash,
      version: String(project.version),
    },
    onlyIfAbsent: true,
  })

  if (await storage.get(getQuarantineKey(hash))) {
    if (created) await storage.delete(key)
    throw new NotebookProjectQuarantinedError()
  }

  return { created, hash }
}

export async function getNotebookProjectObject(hash: string) {
  if (!isNotebookProjectHash(hash)) return null
  const storage = await requireStorage()
  if (await storage.get(getQuarantineKey(hash))) return null
  return storage.get(getProjectKey(hash))
}

export async function quarantineNotebookProject(hash: string, userId: string) {
  if (!isNotebookProjectHash(hash)) return false
  const storage = await requireStorage()
  await storage.put(
    getQuarantineKey(hash),
    JSON.stringify({ hash, quarantinedAt: new Date().toISOString(), userId }),
    {
      contentType: 'application/json; charset=utf-8',
      onlyIfAbsent: true,
    },
  )
  await storage.delete(getProjectKey(hash))
  return true
}

export function isNotebookProjectHash(value: string) {
  return projectHashPattern.test(value)
}

export function getNotebookProjectCacheTag(hash: string) {
  return `notebook-project:${hash}`
}

function getProjectKey(hash: string) {
  return `projects/v1/${hash.slice(0, 2)}/${hash}.json.gz`
}

function getQuarantineKey(hash: string) {
  return `quarantine/v1/${hash}.json`
}

async function requireStorage() {
  const storage = await getBlobStorage(storageName)
  if (!storage) throw new NotebookProjectStorageUnavailableError()
  return storage
}

function validateProjectLimits(project: SharedExampleProject) {
  if (project.title.length === 0 || project.title.length > maxTitleCharacters) {
    throw new Error('Notebook title must be between 1 and 160 characters')
  }
  if (project.description.length > maxDescriptionCharacters) {
    throw new Error('Notebook description exceeds 1,000 characters')
  }

  const encoder = new TextEncoder()
  const files = [
    ...Object.entries(project.workspace.files).map(([path, source]) => ({
      byteLength: encoder.encode(source).byteLength,
      path,
    })),
    ...Object.entries(project.workspace.binaryFiles ?? {}).map(
      ([path, source]) => ({
        byteLength: decodeExampleBinaryFile(source).byteLength,
        path,
      }),
    ),
  ]
  if (files.length === 0 || files.length > maxFiles) {
    throw new Error('Notebook projects must contain between 1 and 128 files')
  }

  for (const { byteLength, path } of files) {
    if (encoder.encode(path).byteLength > maxPathBytes) {
      throw new Error(`Notebook path exceeds 512 bytes: ${path}`)
    }
    if (byteLength > maxFileBytes) {
      throw new Error(`Notebook file exceeds 512 KiB: ${path}`)
    }
  }

  if (
    encoder.encode(serializeSharedExampleProject(project)).byteLength >
    maxCanonicalBytes
  ) {
    throw new Error('Notebook project exceeds 1 MiB')
  }
}

async function gzip(source: string) {
  const stream = new Blob([source])
    .stream()
    .pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
