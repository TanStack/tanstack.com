import type {
  BuilderLocalFileBlob,
  BuilderLocalManifestBundle,
  BuilderManifest,
  BuilderStateEvent,
  BuilderTimelineEvent,
} from '~/builder/schema'
import {
  getBlobStorage,
  type BlobStorage,
} from '~/server/runtime/blob-storage.server'

const FORGE_RUNTIME_PREFIX = 'forge/v1'

export type ForgeCloudRuntimeScope = {
  projectId: string
  sessionId: string
}

export type ForgeCloudTimelineSnapshot = {
  createdAt: string
  events: Array<BuilderTimelineEvent>
  projectId: string
  schemaVersion: 1
  sessionId: string
  timelineOffset: number
}

export type ForgeCloudStateSnapshot = {
  createdAt: string
  events: Array<BuilderStateEvent>
  projectId: string
  schemaVersion: 1
  sessionId: string
  stateOffset: number
  timelineOffset: number
}

export async function getForgeCloudRuntimeStorage() {
  return getBlobStorage('forgeRuntime')
}

export async function hasForgeCloudRuntimeStorage() {
  return Boolean(await getForgeCloudRuntimeStorage())
}

export function getForgeCloudBlobKey(blobRef: string) {
  return `${FORGE_RUNTIME_PREFIX}/blobs/${encodeForgeRuntimeKeyComponent(
    blobRef,
  )}.json`
}

export function getForgeCloudManifestKey(manifestVersionId: string) {
  return `${FORGE_RUNTIME_PREFIX}/manifests/${encodeForgeRuntimeKeyComponent(
    manifestVersionId,
  )}.json`
}

export function getForgeCloudStateSnapshotKey(scope: ForgeCloudRuntimeScope) {
  return `${getForgeCloudSessionPrefix(scope)}/state-snapshot.json`
}

export function getForgeCloudTimelineSnapshotKey(
  scope: ForgeCloudRuntimeScope,
) {
  return `${getForgeCloudSessionPrefix(scope)}/timeline-snapshot.json`
}

export async function persistForgeCloudManifestBundle({
  bundle,
  scope,
  storage,
}: {
  bundle: BuilderLocalManifestBundle
  scope?: ForgeCloudRuntimeScope
  storage?: BlobStorage
}) {
  const runtimeStorage = storage ?? (await getForgeCloudRuntimeStorage())

  if (!runtimeStorage) {
    return false
  }

  await runtimeStorage.put(
    getForgeCloudManifestKey(bundle.manifest.manifestVersionId),
    JSON.stringify(bundle.manifest),
    {
      contentType: 'application/json',
      metadata: {
        kind: 'manifest',
        manifestVersionId: bundle.manifest.manifestVersionId,
        projectId: scope?.projectId ?? bundle.manifest.projectId ?? '',
        sessionId: scope?.sessionId ?? bundle.manifest.sessionId ?? '',
      },
    },
  )

  for (const blob of Object.values(bundle.blobs)) {
    await persistForgeCloudBlob({
      blob,
      scope,
      storage: runtimeStorage,
    })
  }

  return true
}

export async function persistForgeCloudBlob({
  blob,
  scope,
  storage,
}: {
  blob: BuilderLocalFileBlob
  scope?: ForgeCloudRuntimeScope
  storage?: BlobStorage
}) {
  const runtimeStorage = storage ?? (await getForgeCloudRuntimeStorage())

  if (!runtimeStorage) {
    return false
  }

  await runtimeStorage.put(
    getForgeCloudBlobKey(blob.blobRef),
    JSON.stringify(blob),
    {
      contentType: 'application/json',
      metadata: {
        blobRef: blob.blobRef,
        contentType: blob.contentType,
        kind: blob.kind,
        projectId: scope?.projectId ?? '',
        sessionId: scope?.sessionId ?? '',
        sha256: blob.sha256,
      },
    },
  )

  return true
}

export async function readForgeCloudManifest({
  manifestVersionId,
  storage,
}: {
  manifestVersionId: string
  storage?: BlobStorage
}) {
  const runtimeStorage = storage ?? (await getForgeCloudRuntimeStorage())

  if (!runtimeStorage) {
    return undefined
  }

  const object = await runtimeStorage.get(
    getForgeCloudManifestKey(manifestVersionId),
  )

  if (!object) {
    return null
  }

  const parsed: unknown = JSON.parse(await object.text())

  if (!isBuilderManifest(parsed)) {
    throw new Error(`Forge R2 manifest ${manifestVersionId} is invalid.`)
  }

  return parsed
}

export async function readForgeCloudBlob({
  blobRef,
  storage,
}: {
  blobRef: string
  storage?: BlobStorage
}) {
  const runtimeStorage = storage ?? (await getForgeCloudRuntimeStorage())

  if (!runtimeStorage) {
    return undefined
  }

  const object = await runtimeStorage.get(getForgeCloudBlobKey(blobRef))

  if (!object) {
    return null
  }

  const parsed: unknown = JSON.parse(await object.text())

  if (!isBuilderLocalFileBlob(parsed)) {
    throw new Error(`Forge R2 blob ${blobRef} is invalid.`)
  }

  return parsed
}

export async function persistForgeCloudTimelineSnapshot({
  events,
  scope,
  storage,
}: {
  events: Array<BuilderTimelineEvent>
  scope: ForgeCloudRuntimeScope
  storage?: BlobStorage
}) {
  const runtimeStorage = storage ?? (await getForgeCloudRuntimeStorage())

  if (!runtimeStorage) {
    return false
  }

  const snapshot: ForgeCloudTimelineSnapshot = {
    createdAt: new Date().toISOString(),
    events,
    projectId: scope.projectId,
    schemaVersion: 1,
    sessionId: scope.sessionId,
    timelineOffset: events.length,
  }

  await runtimeStorage.put(
    getForgeCloudTimelineSnapshotKey(scope),
    JSON.stringify(snapshot),
    {
      contentType: 'application/json',
      metadata: {
        kind: 'timeline-snapshot',
        projectId: scope.projectId,
        sessionId: scope.sessionId,
        timelineOffset: String(snapshot.timelineOffset),
      },
    },
  )

  return true
}

export async function persistForgeCloudStateSnapshot({
  events,
  scope,
  storage,
  timelineOffset,
}: {
  events: Array<BuilderStateEvent>
  scope: ForgeCloudRuntimeScope
  storage?: BlobStorage
  timelineOffset: number
}) {
  const runtimeStorage = storage ?? (await getForgeCloudRuntimeStorage())

  if (!runtimeStorage) {
    return false
  }

  const snapshot: ForgeCloudStateSnapshot = {
    createdAt: new Date().toISOString(),
    events,
    projectId: scope.projectId,
    schemaVersion: 1,
    sessionId: scope.sessionId,
    stateOffset: events.length,
    timelineOffset,
  }

  await runtimeStorage.put(
    getForgeCloudStateSnapshotKey(scope),
    JSON.stringify(snapshot),
    {
      contentType: 'application/json',
      metadata: {
        kind: 'state-snapshot',
        projectId: scope.projectId,
        sessionId: scope.sessionId,
        stateOffset: String(snapshot.stateOffset),
        timelineOffset: String(snapshot.timelineOffset),
      },
    },
  )

  return true
}

function getForgeCloudSessionPrefix(scope: ForgeCloudRuntimeScope) {
  return [
    FORGE_RUNTIME_PREFIX,
    'projects',
    encodeForgeRuntimeKeyComponent(scope.projectId),
    'sessions',
    encodeForgeRuntimeKeyComponent(scope.sessionId),
  ].join('/')
}

function encodeForgeRuntimeKeyComponent(value: string) {
  return encodeURIComponent(value)
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isBuilderManifest(value: unknown): value is BuilderManifest {
  return (
    isRecord(value) &&
    value.schemaVersion === 1 &&
    typeof value.manifestVersionId === 'string' &&
    typeof value.createdAt === 'string' &&
    isRecord(value.app) &&
    isRecord(value.files) &&
    isRecord(value.sandbox) &&
    isRecord(value.source)
  )
}

function isBuilderLocalFileBlob(value: unknown): value is BuilderLocalFileBlob {
  return (
    isRecord(value) &&
    value.kind === 'file' &&
    typeof value.blobRef === 'string' &&
    typeof value.content === 'string' &&
    typeof value.contentType === 'string' &&
    (value.encoding === 'utf8' || value.encoding === 'base64') &&
    typeof value.sha256 === 'string' &&
    typeof value.size === 'number'
  )
}
