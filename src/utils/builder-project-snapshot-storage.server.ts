import { getBlobStorage } from '~/server/runtime/blob-storage.server'
import {
  parseSharedExampleProject,
  serializeSharedExampleProject,
  type SharedExampleProject,
} from './example-project'
import { sha256Hex } from './hash'
import {
  maxCanonicalBytes,
  validateBuilderProjectSnapshot,
} from './builder-project-snapshot'

const storageName = 'builderProjects'
const snapshotHashPattern = /^[a-f0-9]{64}$/

export class BuilderProjectSnapshotStorageUnavailableError extends Error {
  constructor() {
    super('Builder project snapshot storage is unavailable')
    this.name = 'BuilderProjectSnapshotStorageUnavailableError'
  }
}

export class BuilderProjectSnapshotQuarantinedError extends Error {
  constructor() {
    super('Builder project snapshot is unavailable')
    this.name = 'BuilderProjectSnapshotQuarantinedError'
  }
}

export type PreparedBuilderProjectSnapshot = {
  hash: string
  source: string
  sourceBytes: number
  version: number
}

export function parseStoredBuilderProjectSnapshot(value: unknown) {
  const project = parseSharedExampleProject(value)
  validateBuilderProjectSnapshot(project)
  return project
}

export async function storeBuilderProjectSnapshot(
  project: SharedExampleProject,
) {
  return storePreparedBuilderProjectSnapshot(
    await prepareBuilderProjectSnapshot(project),
  )
}

export async function prepareBuilderProjectSnapshot(
  project: SharedExampleProject,
): Promise<PreparedBuilderProjectSnapshot> {
  validateBuilderProjectSnapshot(project)
  const source = serializeSharedExampleProject(project)
  const hash = await sha256Hex(source)
  return {
    hash,
    source,
    sourceBytes: new TextEncoder().encode(source).byteLength,
    version: project.version,
  }
}

export async function storePreparedBuilderProjectSnapshot(
  snapshot: PreparedBuilderProjectSnapshot,
) {
  const { hash, source } = snapshot
  const storage = await requireStorage()

  if (await storage.get(getQuarantineKey(hash))) {
    throw new BuilderProjectSnapshotQuarantinedError()
  }

  const key = getSnapshotKey(hash)
  if (await storage.get(key)) return { created: false, hash }

  const bytes = await gzip(source)
  const created = await storage.put(key, bytes, {
    contentEncoding: 'gzip',
    contentType: 'application/json; charset=utf-8',
    metadata: {
      hash,
      version: String(snapshot.version),
    },
    onlyIfAbsent: true,
  })

  if (await storage.get(getQuarantineKey(hash))) {
    if (created) await storage.delete(key)
    throw new BuilderProjectSnapshotQuarantinedError()
  }

  return { created, hash }
}

export async function getBuilderProjectSnapshotHash(
  project: SharedExampleProject,
) {
  return (await prepareBuilderProjectSnapshot(project)).hash
}

export async function getBuilderProjectSnapshotObject(hash: string) {
  if (!isBuilderProjectSnapshotHash(hash)) return null
  const storage = await requireStorage()
  if (await storage.get(getQuarantineKey(hash))) return null
  return storage.get(getSnapshotKey(hash))
}

export async function deleteBuilderProjectSnapshotObject(hash: string) {
  if (!isBuilderProjectSnapshotHash(hash)) return false
  const storage = await requireStorage()
  await storage.delete(getSnapshotKey(hash))
  return true
}

export async function hasLegacyBuilderProjectSnapshotReference(hash: string) {
  if (!isBuilderProjectSnapshotHash(hash)) return false
  const storage = await requireStorage()
  const page = await storage.list({
    limit: 1,
    prefix: `record-project-index/v1/${hash}/`,
  })
  return page.objects.length > 0
}

export async function isBuilderProjectSnapshotQuarantined(hash: string) {
  if (!isBuilderProjectSnapshotHash(hash)) return false
  const storage = await requireStorage()
  return Boolean(await storage.get(getQuarantineKey(hash)))
}

export async function quarantineBuilderProjectSnapshot(
  hash: string,
  userId: string,
) {
  if (!isBuilderProjectSnapshotHash(hash)) return false
  const storage = await requireStorage()
  await storage.put(
    getQuarantineKey(hash),
    JSON.stringify({ hash, quarantinedAt: new Date().toISOString(), userId }),
    {
      contentType: 'application/json; charset=utf-8',
      onlyIfAbsent: true,
    },
  )
  await storage.delete(getSnapshotKey(hash))
  return true
}

export function isBuilderProjectSnapshotHash(value: string) {
  return snapshotHashPattern.test(value)
}

export function getBuilderProjectSnapshotCacheTag(hash: string) {
  return `builder-project-snapshot:${hash}`
}

function getSnapshotKey(hash: string) {
  return `projects/v1/${hash.slice(0, 2)}/${hash}.json.gz`
}

function getQuarantineKey(hash: string) {
  return `quarantine/v1/${hash}.json`
}

async function requireStorage() {
  const storage = await getBlobStorage(storageName)
  if (!storage) throw new BuilderProjectSnapshotStorageUnavailableError()
  return storage
}

async function gzip(source: string) {
  const stream = new Blob([source])
    .stream()
    .pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Read the same compressed snapshot used by the Builder, with its canonical byte limit. */
export async function readBuilderProjectSnapshot(hash: string) {
  const object = await getBuilderProjectSnapshotObject(hash)
  if (!object) return null
  if (!object.body) throw new Error('Project snapshot contents are unavailable')
  const bytesStream = object.body.pipeThrough(
    new TransformStream<Uint8Array, BufferSource>({
      transform(chunk, controller) {
        controller.enqueue(new Uint8Array(chunk).buffer)
      },
    }),
  )
  const reader = bytesStream
    .pipeThrough(new DecompressionStream('gzip'))
    .getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let source = ''
  let bytes = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > maxCanonicalBytes)
        throw new Error('Project snapshot exceeds 1 MiB')
      source += decoder.decode(chunk.value, { stream: true })
    }
    source += decoder.decode()
    if ((await sha256Hex(source)) !== hash)
      throw new Error('Project snapshot integrity check failed')
    return parseStoredBuilderProjectSnapshot(JSON.parse(source))
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }
}
