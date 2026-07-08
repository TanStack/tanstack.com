import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { BlobStorage } from '../src/server/runtime/blob-storage.server'
import type {
  BuilderLocalFileBlob,
  BuilderManifest,
} from '../src/builder/schema'
import type { LocalBuilderTimelineEvent } from '../src/builder/projection'

const wranglerConfig = readFileSync(
  new URL('../wrangler.jsonc', import.meta.url),
  'utf8',
)
const serverEntry = readFileSync(
  new URL('../src/server.ts', import.meta.url),
  'utf8',
)

assert.ok(wranglerConfig.includes('"binding": "FORGE_RUNTIME"'))
assert.ok(wranglerConfig.includes('"bucket_name": "tanstack-forge-runtime"'))
assert.ok(wranglerConfig.includes('"name": "FORGE_SESSIONS"'))
assert.ok(wranglerConfig.includes('"class_name": "ForgeSessionDurableObject"'))
assert.ok(wranglerConfig.includes('"new_sqlite_classes"'))
assert.ok(serverEntry.includes('export { ForgeSessionDurableObject }'))

const {
  getForgeCloudBlobKey,
  getForgeCloudManifestKey,
  getForgeCloudStateSnapshotKey,
  getForgeCloudTimelineSnapshotKey,
  persistForgeCloudBlob,
  persistForgeCloudManifestBundle,
  persistForgeCloudStateSnapshot,
  persistForgeCloudTimelineSnapshot,
  readForgeCloudBlob,
  readForgeCloudManifest,
} = await import('../src/builder/runtime/forge-cloud-store.server')
const { ForgeSessionDurableObject } =
  await import('../src/builder/runtime/forge-session-do.server')

const scope = {
  projectId: 'project/with unsafe chars',
  sessionId: 'session:with unsafe chars',
}
const blob: BuilderLocalFileBlob = {
  blobRef: 'sha256:fixture/blob',
  content: '# Fixture\n',
  contentType: 'text/markdown',
  encoding: 'utf8',
  kind: 'file',
  sha256: 'fixture-sha',
  size: 10,
}
const manifest: BuilderManifest = {
  app: {
    framework: 'react',
    name: 'Fixture',
    packageManager: 'pnpm',
    tailwind: true,
    uiFramework: 'react',
  },
  commands: [],
  createdAt: '2026-06-22T00:00:00.000Z',
  dependencies: {},
  devDependencies: {},
  envVars: [],
  files: {
    'README.md': {
      blobRef: blob.blobRef,
      contentType: blob.contentType,
      encoding: blob.encoding,
      path: 'README.md',
      sha256: blob.sha256,
      size: blob.size,
      source: 'builder-definition',
    },
  },
  manifestVersionId: 'manifest:fixture/version',
  sandbox: {
    devCommand: 'pnpm dev',
    installCommand: 'pnpm install',
    previewPort: 5173,
    workdir: '/workspace',
  },
  schemaVersion: 1,
  scripts: {},
  source: {
    compileVersion: 1,
    kind: 'builder-definition',
    selectedFeatures: [],
  },
  warnings: [],
}
const storage = createMemoryBlobStorage()

assert.equal(
  getForgeCloudBlobKey(blob.blobRef),
  'forge/v1/blobs/sha256%3Afixture%2Fblob.json',
)
assert.equal(
  getForgeCloudManifestKey(manifest.manifestVersionId),
  'forge/v1/manifests/manifest%3Afixture%2Fversion.json',
)
assert.equal(
  getForgeCloudTimelineSnapshotKey(scope),
  'forge/v1/projects/project%2Fwith%20unsafe%20chars/sessions/session%3Awith%20unsafe%20chars/timeline-snapshot.json',
)
assert.equal(
  getForgeCloudStateSnapshotKey(scope),
  'forge/v1/projects/project%2Fwith%20unsafe%20chars/sessions/session%3Awith%20unsafe%20chars/state-snapshot.json',
)

assert.equal(
  await persistForgeCloudManifestBundle({
    bundle: {
      blobs: {
        [blob.blobRef]: blob,
      },
      manifest,
    },
    scope,
    storage,
  }),
  true,
)
assert.equal(await persistForgeCloudBlob({ blob, scope, storage }), true)
assert.equal(
  await persistForgeCloudTimelineSnapshot({
    events: [],
    scope,
    storage,
  }),
  true,
)
assert.equal(
  await persistForgeCloudStateSnapshot({
    events: [],
    scope,
    storage,
    timelineOffset: 0,
  }),
  true,
)

assert.deepEqual(
  await readForgeCloudBlob({
    blobRef: blob.blobRef,
    storage,
  }),
  blob,
)
assert.deepEqual(
  await readForgeCloudManifest({
    manifestVersionId: manifest.manifestVersionId,
    storage,
  }),
  manifest,
)

const durableObjectStorage = createMemoryDurableObjectStorage()
const durableObject = new ForgeSessionDurableObject({
  storage: durableObjectStorage,
})
const firstTimelineEvent = createInputEvent({
  eventId: 'event-1',
  messageId: 'message-1',
  seq: 99,
  text: 'first',
})
const duplicateTimelineEvent = createInputEvent({
  eventId: 'event-1',
  messageId: 'message-duplicate',
  seq: 99,
  text: 'duplicate',
})
const secondTimelineEvent = createInputEvent({
  eventId: 'event-2',
  messageId: 'message-2',
  seq: 99,
  text: 'second',
})

const appendResponse = await durableObject.fetch(
  new Request('https://forge-session.local/timeline/append', {
    body: JSON.stringify({
      events: [firstTimelineEvent, duplicateTimelineEvent, secondTimelineEvent],
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  }),
)

assert.equal(appendResponse.status, 200)

const timelineResponse = await durableObject.fetch(
  new Request('https://forge-session.local/timeline'),
)
const timelineBody: unknown = await timelineResponse.json()

assert.ok(isRecord(timelineBody))
assert.equal(timelineBody.timelineOffset, 2)
assert.ok(Array.isArray(timelineBody.events))
assert.deepEqual(
  timelineBody.events.map((event) =>
    isRecord(event.producer) ? event.producer.seq : undefined,
  ),
  [1, 2],
)

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(
  path.join(os.tmpdir(), 'forge-cloud-runtime-'),
)

try {
  const { setHostRuntimeEnvOverrideForTest } =
    await import('../src/server/runtime/host.server')
  const runtimeBucket = createMemoryRuntimeBlobBucket()
  const sessionNamespace = createMemoryDurableObjectNamespace()

  setHostRuntimeEnvOverrideForTest({
    FORGE_RUNTIME: runtimeBucket,
    FORGE_SESSIONS: sessionNamespace,
  })
  process.chdir(runtimeRoot)

  const {
    appendLocalForgeManifestTimeline,
    appendLocalForgeTimelineEvents,
    initializeLocalForgeRuntimeSession,
    persistLocalForgeManifestBundle,
    readLocalForgeBlob,
    readLocalForgeManifest,
    readLocalForgeSnapshotForRuntimeSession,
    readLocalForgeStateEvents,
    readLocalForgeTimeline,
    withLocalForgeRuntimeSession,
  } = await import('../src/builder/runtime/local-store.server')
  const runtimeSessionId = 'cloud-adapter-session'
  const createdAt = '2026-06-22T00:00:00.000Z'

  await withLocalForgeRuntimeSession(runtimeSessionId, async () => {
    await initializeLocalForgeRuntimeSession(runtimeSessionId)
    await appendLocalForgeTimelineEvents([
      createInputEvent({
        eventId: 'cloud-adapter-event-1',
        messageId: 'cloud-adapter-message-1',
        seq: 999,
        sessionId: runtimeSessionId,
        text: 'prove cloud adapter',
      }),
    ])
    const bundle = {
      blobs: {
        [blob.blobRef]: blob,
      },
      manifest,
    }

    await persistLocalForgeManifestBundle({
      blobs: {
        [blob.blobRef]: blob,
      },
      manifest,
    })
    await appendLocalForgeManifestTimeline({
      bundle,
      createdAt,
      producerId: 'cloud-adapter-verifier',
      producerKind: 'system',
      runId: undefined,
    })

    const timeline = await readLocalForgeTimeline()

    assert.equal(timeline.length, 3)
    assert.deepEqual(
      timeline.map((event) => event.producer.seq),
      [1, 2, 3],
    )
    assert.ok((await readLocalForgeStateEvents()).length > 0)
    assert.deepEqual(await readLocalForgeBlob(blob.blobRef), blob)
    assert.deepEqual(
      await readLocalForgeManifest(manifest.manifestVersionId),
      manifest,
    )

    const snapshot = await readLocalForgeSnapshotForRuntimeSession({
      activeChatId: runtimeSessionId,
      chats: [
        {
          createdAt,
          id: runtimeSessionId,
          title: 'Cloud adapter',
          updatedAt: createdAt,
        },
      ],
      runtimeSessionId,
    })

    assert.equal(snapshot.timelineEventCount, 3)
    assert.equal(
      snapshot.currentManifest?.manifestVersionId,
      manifest.manifestVersionId,
    )
    assert.equal(snapshot.files['README.md'], blob.content)
  })

  setHostRuntimeEnvOverrideForTest(undefined)
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge Cloudflare runtime verifier passed')

function createMemoryBlobStorage(): BlobStorage {
  const entries = new Map<
    string,
    {
      metadata?: Record<string, string>
      text: string
    }
  >()

  return {
    async delete(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        entries.delete(key)
      }
    },
    async get(key) {
      const entry = entries.get(key)

      if (!entry) {
        return null
      }

      return {
        key,
        metadata: entry.metadata,
        text: async () => entry.text,
      }
    },
    async list(options) {
      const objects = Array.from(entries.keys())
        .filter((key) => !options?.prefix || key.startsWith(options.prefix))
        .sort()
        .slice(0, options?.limit)
        .map((key) => ({
          key,
          metadata: entries.get(key)?.metadata,
        }))

      return {
        objects,
        truncated: false,
      }
    },
    async put(key, value, options) {
      entries.set(key, {
        metadata: options?.metadata,
        text: value,
      })
    },
  }
}

function createMemoryDurableObjectStorage() {
  const entries = new Map<string, unknown>()

  return {
    async delete(key: string) {
      entries.delete(key)
    },
    async get(key: string) {
      return entries.get(key)
    },
    async put(key: string, value: unknown) {
      entries.set(key, value)
    },
  }
}

function createMemoryDurableObjectNamespace() {
  const objects = new Map<
    string,
    {
      fetch(request: Request): Promise<Response>
    }
  >()

  return {
    get(id: unknown) {
      const key = typeof id === 'string' ? id : 'default'
      const existing = objects.get(key)

      if (existing) {
        return createMemoryDurableObjectStub(existing)
      }

      const durableObject = new ForgeSessionDurableObject({
        storage: createMemoryDurableObjectStorage(),
      })

      objects.set(key, durableObject)

      return createMemoryDurableObjectStub(durableObject)
    },
    idFromName(name: string) {
      return name
    },
  }
}

function createMemoryDurableObjectStub(durableObject: {
  fetch(request: Request): Promise<Response>
}) {
  return {
    fetch(input: RequestInfo | URL, init?: RequestInit) {
      return durableObject.fetch(new Request(input, init))
    },
  }
}

function createMemoryRuntimeBlobBucket() {
  const entries = new Map<
    string,
    {
      customMetadata?: Record<string, string>
      text: string
      uploaded: Date
    }
  >()

  return {
    async delete(keys: string | Array<string>) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        entries.delete(key)
      }
    },
    async get(key: string) {
      const entry = entries.get(key)

      if (!entry) {
        return null
      }

      return {
        customMetadata: entry.customMetadata,
        key,
        text: async () => entry.text,
        uploaded: entry.uploaded,
      }
    },
    async list(options?: {
      cursor?: string
      include?: Array<'customMetadata'>
      limit?: number
      prefix?: string
    }) {
      const objects = Array.from(entries.keys())
        .filter((key) => !options?.prefix || key.startsWith(options.prefix))
        .sort()
        .slice(0, options?.limit)
        .map((key) => {
          const entry = entries.get(key)

          return {
            customMetadata: entry?.customMetadata,
            key,
            uploaded: entry?.uploaded,
          }
        })

      return {
        cursor: undefined,
        objects,
        truncated: false,
      }
    },
    async put(
      key: string,
      value: string,
      options?: {
        customMetadata?: Record<string, string>
        httpMetadata?: {
          contentType?: string
        }
      },
    ) {
      entries.set(key, {
        customMetadata: options?.customMetadata,
        text: value,
        uploaded: new Date(),
      })
    },
  }
}

function createInputEvent({
  eventId,
  messageId,
  seq,
  sessionId = 'fixture-session',
  text,
}: {
  eventId: string
  messageId: string
  seq: number
  sessionId?: string
  text: string
}): LocalBuilderTimelineEvent {
  return {
    createdAt: '2026-06-22T00:00:00.000Z',
    eventId,
    producer: {
      epoch: 'fixture-epoch',
      id: 'fixture-ui',
      kind: 'ui',
      seq,
    },
    schemaVersion: 1,
    sessionId,
    type: 'session.input.received',
    payload: {
      clientRequestId: `fixture-request-${messageId}`,
      messageId,
      text,
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
