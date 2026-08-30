import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { getBlobStorage } from '../src/server/runtime/blob-storage.server'
import { runWithHostRuntimeEnv } from '../src/server/runtime/host.server'
import { createSharedExampleProject } from '../src/utils/example-project'
import {
  createExampleWorkspace,
  encodeExampleBinaryFile,
} from '../src/utils/example-workspace'
import {
  getBuilderProjectSnapshotObject,
  BuilderProjectSnapshotQuarantinedError,
  hasLegacyBuilderProjectSnapshotReference,
  parseStoredBuilderProjectSnapshot,
  quarantineBuilderProjectSnapshot,
  storeBuilderProjectSnapshot,
} from '../src/utils/builder-project-snapshot-storage.server'
import {
  createStoredBuilderProject,
  deleteStoredBuilderProject,
  getStoredBuilderProject,
  getStoredBuilderProjectIdReservation,
  listStoredBuilderProjects,
  BuilderProjectConflictError,
  BuilderProjectLimitError,
  BuilderProjectOwnershipError,
  BuilderProjectQuarantinedError,
  quarantineStoredBuilderProjectsBySnapshotHash,
  updateStoredBuilderProject,
} from '../src/utils/builder-project-storage.server'

type StoredObject = {
  customMetadata?: Record<string, string>
  etag: string
  httpMetadata?: {
    contentEncoding?: string
    contentType?: string
  }
  uploaded: Date
  value: ArrayBuffer
}

type MockPutOptions = {
  customMetadata?: Record<string, string>
  httpMetadata?: {
    contentEncoding?: string
    contentType?: string
  }
  onlyIf?: { etagDoesNotMatch?: string; etagMatches?: string }
}

function createMockR2Bucket() {
  const objects = new Map<string, StoredObject>()
  let nextEtag = 1
  let beforePut:
    | ((
        key: string,
        options: MockPutOptions | undefined,
      ) => Promise<void> | void)
    | undefined
  let afterPut: ((key: string) => Promise<void> | void) | undefined
  let beforeList:
    | ((options?: { limit?: number; prefix?: string }) => Promise<void> | void)
    | undefined

  function getObject(key: string, object: StoredObject) {
    const value = object.value.slice(0)
    return {
      arrayBuffer: async () => value.slice(0),
      body: new Blob([value]).stream(),
      customMetadata: object.customMetadata,
      etag: object.etag,
      key,
      text: async () => new TextDecoder().decode(value),
      uploaded: object.uploaded,
    }
  }

  return {
    bucket: {
      async delete(keys: string | Array<string>) {
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          objects.delete(key)
        }
      },
      async get(key: string) {
        const object = objects.get(key)
        return object ? getObject(key, object) : null
      },
      async list(options?: { limit?: number; prefix?: string }) {
        await beforeList?.(options)
        const entries = Array.from(objects.entries()).filter(([key]) =>
          key.startsWith(options?.prefix ?? ''),
        )
        const limit = options?.limit ?? 1_000
        return {
          objects: entries.slice(0, limit).map(([key, object]) => ({
            customMetadata: object.customMetadata,
            etag: object.etag,
            key,
            uploaded: object.uploaded,
          })),
          truncated: entries.length > limit,
        }
      },
      async put(
        key: string,
        value:
          | string
          | ArrayBuffer
          | ArrayBufferView
          | ReadableStream<Uint8Array>,
        options?: MockPutOptions,
      ) {
        await beforePut?.(key, options)
        const bytes = await readValue(value)
        const existing = objects.get(key)
        if (options?.onlyIf?.etagDoesNotMatch === '*' && existing) {
          return null
        }
        if (
          options?.onlyIf?.etagMatches !== undefined &&
          existing?.etag !== options.onlyIf.etagMatches
        ) {
          return null
        }

        const object = {
          customMetadata: options?.customMetadata,
          etag: String(nextEtag),
          httpMetadata: options?.httpMetadata,
          uploaded: new Date(),
          value: bytes,
        }
        nextEtag += 1
        objects.set(key, object)
        await afterPut?.(key)
        return getObject(key, object)
      },
    },
    objects,
    setBeforeList(
      handler: (options?: {
        limit?: number
        prefix?: string
      }) => Promise<void> | void,
    ) {
      beforeList = handler
    },
    setBeforePut(
      handler: (
        key: string,
        options: MockPutOptions | undefined,
      ) => Promise<void> | void,
    ) {
      beforePut = handler
    },
    setAfterPut(handler: (key: string) => Promise<void> | void) {
      afterPut = handler
    },
  }
}

async function readValue(
  value: string | ArrayBuffer | ArrayBufferView | ReadableStream<Uint8Array>,
) {
  if (typeof value === 'string') {
    return new TextEncoder().encode(value).buffer
  }
  if (value instanceof ArrayBuffer) return value.slice(0)
  if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(value.byteLength)
    bytes.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
    return bytes.buffer
  }
  return new Response(value).arrayBuffer()
}

function createProject(files: Record<string, string>) {
  return createSharedExampleProject({
    title: 'Storage test',
    workspace: createExampleWorkspace({
      entry: '/src/index.tsx',
      files,
    }),
  })
}

test('stores one canonical gzip object for equivalent projects', async () => {
  const mock = createMockR2Bucket()
  const firstProject = createProject({
    '/src/index.tsx': "import './styles.css'",
    '/src/styles.css': 'body { color: red }',
  })
  const secondProject = createProject({
    '/src/styles.css': 'body { color: red }',
    '/src/index.tsx': "import './styles.css'",
  })

  const first = await runWithHostRuntimeEnv(
    { BUILDER_PROJECTS: mock.bucket },
    () => storeBuilderProjectSnapshot(firstProject),
  )
  const second = await runWithHostRuntimeEnv(
    { BUILDER_PROJECTS: mock.bucket },
    () => storeBuilderProjectSnapshot(secondProject),
  )

  assert.equal(first.created, true)
  assert.equal(second.created, false)
  assert.equal(second.hash, first.hash)

  const projectObjects = Array.from(mock.objects.entries()).filter(([key]) =>
    key.startsWith('projects/v1/'),
  )
  assert.equal(projectObjects.length, 1)
  const stored = projectObjects[0]?.[1]
  assert.ok(stored)
  assert.equal(stored.httpMetadata?.contentEncoding, 'gzip')
  assert.equal(
    stored.httpMetadata?.contentType,
    'application/json; charset=utf-8',
  )

  const source = gunzipSync(new Uint8Array(stored.value)).toString('utf8')
  assert.deepEqual(
    parseStoredBuilderProjectSnapshot(JSON.parse(source)),
    firstProject,
  )
})

test('only-if-absent writes never replace an immutable object', async () => {
  const mock = createMockR2Bucket()
  const storage = await runWithHostRuntimeEnv(
    { BUILDER_PROJECTS: mock.bucket },
    () => getBlobStorage('builderProjects'),
  )
  assert.ok(storage)

  assert.equal(
    await storage.put('immutable', 'first', { onlyIfAbsent: true }),
    true,
  )
  assert.equal(
    await storage.put('immutable', 'second', { onlyIfAbsent: true }),
    false,
  )
  const first = await storage.get('immutable')
  assert.ok(first)
  assert.equal(await first.text(), 'first')
  assert.equal(
    await storage.put('immutable', 'replaced', { etagMatches: first.etag }),
    true,
  )
  assert.equal(
    await storage.put('immutable', 'stale', { etagMatches: first.etag }),
    false,
  )
  assert.equal(await (await storage.get('immutable'))?.text(), 'replaced')
})

test('quarantine deletes and permanently blocks a project hash', async () => {
  const mock = createMockR2Bucket()
  const project = createProject({ '/src/index.tsx': 'export default 42' })
  const stored = await runWithHostRuntimeEnv(
    { BUILDER_PROJECTS: mock.bucket },
    () => storeBuilderProjectSnapshot(project),
  )

  await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
    quarantineBuilderProjectSnapshot(stored.hash, 'user-id'),
  )

  const object = await runWithHostRuntimeEnv(
    { BUILDER_PROJECTS: mock.bucket },
    () => getBuilderProjectSnapshotObject(stored.hash),
  )
  assert.equal(object, null)
  assert.equal(
    Array.from(mock.objects.keys()).some((key) =>
      key.startsWith('projects/v1/'),
    ),
    false,
  )
  assert.equal(
    Array.from(mock.objects.keys()).some((key) =>
      key.startsWith('quarantine/'),
    ),
    true,
  )

  await assert.rejects(
    runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      storeBuilderProjectSnapshot(project),
    ),
    BuilderProjectSnapshotQuarantinedError,
  )
})

test('reads legacy Notebook records and snapshots from their original keys', async () => {
  const mock = createMockR2Bucket()
  const id = '22222222-2222-4222-8222-222222222222'
  const ownerId = '11111111-1111-4111-8111-111111111111'
  const snapshotHash = 'a'.repeat(64)
  const timestamp = '2026-08-01T12:00:00.000Z'

  await mock.bucket.put(
    `records/v1/${id}.json`,
    JSON.stringify({
      version: 1,
      id,
      ownerId,
      projectHash: snapshotHash,
      title: 'Legacy notebook',
      description: 'Stored before the Builder rename',
      author: { name: 'Notebook author', image: null },
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  )
  await mock.bucket.put(`record-index/v1/${ownerId}/${id}`, id)
  await mock.bucket.put(
    `projects/v1/${snapshotHash.slice(0, 2)}/${snapshotHash}.json.gz`,
    'legacy snapshot',
  )

  await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, async () => {
    const project = await getStoredBuilderProject(id)
    assert.equal(project?.snapshotHash, snapshotHash)
    assert.equal(project?.title, 'Legacy notebook')
    assert.deepEqual(await listStoredBuilderProjects(ownerId), [project])

    const snapshot = await getBuilderProjectSnapshotObject(snapshotHash)
    assert.ok(snapshot)
    assert.equal(await snapshot.text(), 'legacy snapshot')
  })
})

test('detects legacy snapshot references with a bounded index lookup', async () => {
  const mock = createMockR2Bucket()
  const referencedHash = 'a'.repeat(64)
  const unreferencedHash = 'b'.repeat(64)
  const lookups: Array<{ limit?: number; prefix?: string }> = []

  mock.setBeforeList((options) => {
    lookups.push({ limit: options?.limit, prefix: options?.prefix })
  })
  await mock.bucket.put(
    `record-project-index/v1/${referencedHash}/22222222-2222-4222-8222-222222222222`,
    '',
  )

  await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, async () => {
    assert.equal(
      await hasLegacyBuilderProjectSnapshotReference(referencedHash),
      true,
    )
    assert.equal(
      await hasLegacyBuilderProjectSnapshotReference(unreferencedHash),
      false,
    )
  })

  assert.deepEqual(lookups, [
    {
      limit: 1,
      prefix: `record-project-index/v1/${referencedHash}/`,
    },
    {
      limit: 1,
      prefix: `record-project-index/v1/${unreferencedHash}/`,
    },
  ])
})

test('fails closed when the legacy snapshot reference lookup fails', async () => {
  const mock = createMockR2Bucket()
  const hash = 'a'.repeat(64)
  mock.setBeforeList(() => {
    throw new Error('R2 lookup failed')
  })

  await assert.rejects(
    runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      hasLegacyBuilderProjectSnapshotReference(hash),
    ),
    /R2 lookup failed/,
  )
})

test('rejects projects over the per-file byte limit', () => {
  const project = createProject({
    '/src/index.tsx': 'a'.repeat(512 * 1024 + 1),
  })

  assert.throws(
    () => parseStoredBuilderProjectSnapshot(project),
    /Builder file exceeds 512 KiB/,
  )
})

test('applies the per-file byte limit to decoded binary files', () => {
  const project = createSharedExampleProject({
    title: 'Storage test',
    workspace: createExampleWorkspace({
      binaryFiles: {
        '/public/favicon.ico': encodeExampleBinaryFile(
          new Uint8Array(512 * 1024 + 1),
        ),
      },
      entry: '/src/index.tsx',
      files: { '/src/index.tsx': 'export default 42' },
    }),
  })

  assert.throws(
    () => parseStoredBuilderProjectSnapshot(project),
    /Builder file exceeds 512 KiB: \/public\/favicon\.ico/,
  )
})

test('creates, lists, updates, and deletes stable builder projects', async () => {
  const mock = createMockR2Bucket()
  const ownerId = '11111111-1111-4111-8111-111111111111'
  const snapshotHash = 'a'.repeat(64)
  const nextSnapshotHash = 'b'.repeat(64)
  const author = { name: 'Builder author', image: null }

  assert.deepEqual(
    await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      getStoredBuilderProjectIdReservation(
        '22222222-2222-4222-8222-222222222222',
      ),
    ),
    { reserved: false, project: null },
  )

  const created = await runWithHostRuntimeEnv(
    { BUILDER_PROJECTS: mock.bucket },
    () =>
      createStoredBuilderProject({
        author,
        description: 'First revision',
        ownerId,
        snapshotHash,
        title: 'Stable builder',
      }),
  )

  assert.equal(created.ownerId, ownerId)
  assert.equal(created.snapshotHash, snapshotHash)
  assert.equal(
    mock.objects.has(`record-project-index/v1/${snapshotHash}/${created.id}`),
    true,
  )
  assert.deepEqual(
    await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      getStoredBuilderProject(created.id),
    ),
    created,
  )
  assert.deepEqual(
    await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      getStoredBuilderProjectIdReservation(created.id),
    ),
    { reserved: true, project: created },
  )
  assert.deepEqual(
    await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      listStoredBuilderProjects(ownerId),
    ),
    [created],
  )

  const updated = await runWithHostRuntimeEnv(
    { BUILDER_PROJECTS: mock.bucket },
    () =>
      updateStoredBuilderProject({
        author,
        description: 'Second revision',
        expectedUpdatedAt: created.updatedAt,
        id: created.id,
        ownerId,
        snapshotHash: nextSnapshotHash,
        title: 'Stable builder',
      }),
  )
  if (!updated) throw new Error('Expected builder project update')
  assert.equal(updated.createdAt, created.createdAt)
  assert.equal(updated.snapshotHash, nextSnapshotHash)
  assert.equal(updated.description, 'Second revision')
  assert.equal(
    mock.objects.has(`record-project-index/v1/${snapshotHash}/${created.id}`),
    true,
  )
  assert.equal(
    mock.objects.has(
      `record-project-index/v1/${nextSnapshotHash}/${created.id}`,
    ),
    true,
  )

  assert.equal(
    await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      deleteStoredBuilderProject(created.id, ownerId),
    ),
    true,
  )
  assert.equal(
    await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      getStoredBuilderProject(created.id),
    ),
    null,
  )
  assert.deepEqual(
    await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      getStoredBuilderProjectIdReservation(created.id),
    ),
    { reserved: true, project: null },
  )
  assert.deepEqual(
    await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      listStoredBuilderProjects(ownerId),
    ),
    [],
  )
  assert.equal(
    mock.objects.has(`record-project-index/v1/${snapshotHash}/${created.id}`),
    true,
  )
  assert.equal(
    mock.objects.has(
      `record-project-index/v1/${nextSnapshotHash}/${created.id}`,
    ),
    true,
  )
})

test('rejects a stale builder project update', async () => {
  const mock = createMockR2Bucket()
  const ownerId = '11111111-1111-4111-8111-111111111111'
  const author = { name: 'Builder author', image: null }
  const created = await runWithHostRuntimeEnv(
    { BUILDER_PROJECTS: mock.bucket },
    () =>
      createStoredBuilderProject({
        author,
        description: '',
        ownerId,
        snapshotHash: 'a'.repeat(64),
        title: 'Conflict test',
      }),
  )
  const updated = await runWithHostRuntimeEnv(
    { BUILDER_PROJECTS: mock.bucket },
    () =>
      updateStoredBuilderProject({
        author,
        description: 'First update',
        expectedUpdatedAt: created.updatedAt,
        id: created.id,
        ownerId,
        snapshotHash: 'b'.repeat(64),
        title: 'Conflict test',
      }),
  )

  await assert.rejects(
    runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      updateStoredBuilderProject({
        author,
        description: 'Stale update',
        expectedUpdatedAt: created.updatedAt,
        id: created.id,
        ownerId,
        snapshotHash: 'c'.repeat(64),
        title: 'Conflict test',
      }),
    ),
    BuilderProjectConflictError,
  )
  assert.notEqual(updated?.updatedAt, created.updatedAt)
  assert.deepEqual(
    await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      getStoredBuilderProject(created.id),
    ),
    updated,
  )
})

test('allows only one simultaneous conditional builder update', async () => {
  const mock = createMockR2Bucket()
  const ownerId = '11111111-1111-4111-8111-111111111111'
  const author = { name: 'Builder author', image: null }
  const created = await runWithHostRuntimeEnv(
    { BUILDER_PROJECTS: mock.bucket },
    () =>
      createStoredBuilderProject({
        author,
        description: '',
        ownerId,
        snapshotHash: 'a'.repeat(64),
        title: 'Conditional update test',
      }),
  )
  const projectKey = `records/v1/${created.id}.json`
  let releaseWrites = () => {}
  const writesReleased = new Promise<void>((resolve) => {
    releaseWrites = () => resolve()
  })
  let reportBothWritesReady = () => {}
  const bothWritesReady = new Promise<void>((resolve) => {
    reportBothWritesReady = () => resolve()
  })
  let waitingWrites = 0

  mock.setBeforePut(async (key, options) => {
    if (key !== projectKey || options?.onlyIf?.etagMatches === undefined) return
    waitingWrites += 1
    if (waitingWrites === 2) reportBothWritesReady()
    await writesReleased
  })

  const resultsPromise = runWithHostRuntimeEnv(
    { BUILDER_PROJECTS: mock.bucket },
    () =>
      Promise.allSettled([
        updateStoredBuilderProject({
          author,
          description: 'First contender',
          expectedUpdatedAt: created.updatedAt,
          id: created.id,
          ownerId,
          snapshotHash: 'b'.repeat(64),
          title: 'Conditional update test',
        }),
        updateStoredBuilderProject({
          author,
          description: 'Second contender',
          expectedUpdatedAt: created.updatedAt,
          id: created.id,
          ownerId,
          snapshotHash: 'c'.repeat(64),
          title: 'Conditional update test',
        }),
      ]),
  )

  await bothWritesReady
  releaseWrites()
  const results = await resultsPromise
  const fulfilled = results.filter((result) => result.status === 'fulfilled')
  const rejected = results.filter((result) => result.status === 'rejected')

  assert.equal(fulfilled.length, 1)
  assert.equal(rejected.length, 1)
  assert.equal(rejected[0]?.reason instanceof BuilderProjectConflictError, true)
  assert.deepEqual(
    await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      getStoredBuilderProject(created.id),
    ),
    fulfilled[0]?.value,
  )
})

test('does not resurrect a builder updated while it is deleted', async () => {
  const mock = createMockR2Bucket()
  const ownerId = '11111111-1111-4111-8111-111111111111'
  const author = { name: 'Builder author', image: null }
  const created = await runWithHostRuntimeEnv(
    { BUILDER_PROJECTS: mock.bucket },
    () =>
      createStoredBuilderProject({
        author,
        description: '',
        ownerId,
        snapshotHash: 'a'.repeat(64),
        title: 'Delete race test',
      }),
  )
  const projectKey = `records/v1/${created.id}.json`
  let releaseUpdate = () => {}
  const updateReleased = new Promise<void>((resolve) => {
    releaseUpdate = () => resolve()
  })
  let reportUpdateReady = () => {}
  const updateReady = new Promise<void>((resolve) => {
    reportUpdateReady = () => resolve()
  })

  mock.setBeforePut(async (key, options) => {
    if (key !== projectKey || options?.onlyIf?.etagMatches === undefined) return
    reportUpdateReady()
    await updateReleased
  })

  const updatePromise = runWithHostRuntimeEnv(
    { BUILDER_PROJECTS: mock.bucket },
    () =>
      updateStoredBuilderProject({
        author,
        description: 'In-flight update',
        expectedUpdatedAt: created.updatedAt,
        id: created.id,
        ownerId,
        snapshotHash: 'b'.repeat(64),
        title: 'Delete race test',
      }),
  )
  const updateRejected = assert.rejects(
    updatePromise,
    BuilderProjectQuarantinedError,
  )

  await updateReady
  assert.equal(
    await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      deleteStoredBuilderProject(created.id, ownerId),
    ),
    true,
  )
  releaseUpdate()
  await updateRejected

  assert.equal(
    await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      getStoredBuilderProject(created.id),
    ),
    null,
  )
  assert.equal(mock.objects.has(projectKey), false)
  assert.equal(
    mock.objects.has(`record-index/v1/${ownerId}/${created.id}`),
    false,
  )
  assert.equal(
    mock.objects.has(`record-quarantine/v1/${created.id}.json`),
    true,
  )
})

test('quarantines projects by every historical project association', async () => {
  const mock = createMockR2Bucket()
  const firstOwnerId = '11111111-1111-4111-8111-111111111111'
  const secondOwnerId = '22222222-2222-4222-8222-222222222222'
  const adminUserId = '33333333-3333-4333-8333-333333333333'
  const quarantinedHash = 'a'.repeat(64)
  const currentHash = 'b'.repeat(64)
  const author = { name: 'Builder author', image: null }

  const historicalProject = await runWithHostRuntimeEnv(
    { BUILDER_PROJECTS: mock.bucket },
    () =>
      createStoredBuilderProject({
        author,
        description: '',
        ownerId: firstOwnerId,
        snapshotHash: quarantinedHash,
        title: 'Historical match',
      }),
  )
  await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
    updateStoredBuilderProject({
      author,
      description: '',
      expectedUpdatedAt: historicalProject.updatedAt,
      id: historicalProject.id,
      ownerId: firstOwnerId,
      snapshotHash: currentHash,
      title: 'Historical match',
    }),
  )
  const currentProject = await runWithHostRuntimeEnv(
    { BUILDER_PROJECTS: mock.bucket },
    () =>
      createStoredBuilderProject({
        author,
        description: '',
        ownerId: secondOwnerId,
        snapshotHash: quarantinedHash,
        title: 'Current match',
      }),
  )
  const unaffectedProject = await runWithHostRuntimeEnv(
    { BUILDER_PROJECTS: mock.bucket },
    () =>
      createStoredBuilderProject({
        author,
        description: '',
        ownerId: firstOwnerId,
        snapshotHash: currentHash,
        title: 'Unaffected',
      }),
  )

  await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
    quarantineBuilderProjectSnapshot(quarantinedHash, adminUserId),
  )
  assert.equal(
    await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      quarantineStoredBuilderProjectsBySnapshotHash(
        quarantinedHash,
        adminUserId,
      ),
    ),
    2,
  )

  assert.equal(
    await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      getStoredBuilderProject(historicalProject.id),
    ),
    null,
  )
  assert.equal(
    await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      getStoredBuilderProject(currentProject.id),
    ),
    null,
  )
  assert.deepEqual(
    await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      listStoredBuilderProjects(firstOwnerId),
    ),
    [unaffectedProject],
  )
  assert.deepEqual(
    await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      listStoredBuilderProjects(secondOwnerId),
    ),
    [],
  )
  await assert.rejects(
    runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      updateStoredBuilderProject({
        author,
        description: '',
        expectedUpdatedAt: historicalProject.updatedAt,
        id: historicalProject.id,
        ownerId: firstOwnerId,
        snapshotHash: currentHash,
        title: 'Cannot revive',
      }),
    ),
    BuilderProjectQuarantinedError,
  )
  assert.equal(
    Array.from(mock.objects.keys()).filter((key) =>
      key.startsWith('record-quarantine/v1/'),
    ).length,
    2,
  )
  assert.equal(
    Array.from(mock.objects.keys()).filter((key) =>
      key.startsWith(`record-project-index/v1/${quarantinedHash}/`),
    ).length,
    2,
  )
})

test('removes a project quarantined during its final update write', async () => {
  const mock = createMockR2Bucket()
  const ownerId = '11111111-1111-4111-8111-111111111111'
  const snapshotHash = 'a'.repeat(64)
  const nextSnapshotHash = 'b'.repeat(64)
  const author = { name: 'Builder author', image: null }
  const created = await runWithHostRuntimeEnv(
    { BUILDER_PROJECTS: mock.bucket },
    () =>
      createStoredBuilderProject({
        author,
        description: '',
        ownerId,
        snapshotHash,
        title: 'Race test',
      }),
  )
  let insertedTombstone = false

  mock.setAfterPut((key) => {
    if (insertedTombstone || key !== `records/v1/${created.id}.json`) return
    insertedTombstone = true
    mock.objects.set(`record-quarantine/v1/${created.id}.json`, {
      etag: 'injected-tombstone',
      uploaded: new Date(),
      value: new TextEncoder().encode('{}').buffer,
    })
  })

  await assert.rejects(
    runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      updateStoredBuilderProject({
        author,
        description: 'Updated during quarantine',
        expectedUpdatedAt: created.updatedAt,
        id: created.id,
        ownerId,
        snapshotHash: nextSnapshotHash,
        title: 'Race test',
      }),
    ),
    BuilderProjectQuarantinedError,
  )
  assert.equal(insertedTombstone, true)
  assert.equal(
    await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      getStoredBuilderProject(created.id),
    ),
    null,
  )
  assert.equal(mock.objects.has(`records/v1/${created.id}.json`), false)
  assert.equal(
    mock.objects.has(`record-index/v1/${ownerId}/${created.id}`),
    false,
  )
  assert.equal(
    mock.objects.has(
      `record-project-index/v1/${nextSnapshotHash}/${created.id}`,
    ),
    true,
  )
})

test('keeps builder project mutations owner-only', async () => {
  const mock = createMockR2Bucket()
  const ownerId = '11111111-1111-4111-8111-111111111111'
  const otherOwnerId = '22222222-2222-4222-8222-222222222222'
  const author = { name: null, image: null }
  const created = await runWithHostRuntimeEnv(
    { BUILDER_PROJECTS: mock.bucket },
    () =>
      createStoredBuilderProject({
        author,
        description: '',
        ownerId,
        snapshotHash: 'a'.repeat(64),
        title: 'Owned builder',
      }),
  )

  await assert.rejects(
    runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      updateStoredBuilderProject({
        author,
        description: '',
        expectedUpdatedAt: created.updatedAt,
        id: created.id,
        ownerId: otherOwnerId,
        snapshotHash: 'b'.repeat(64),
        title: 'Changed builder',
      }),
    ),
    BuilderProjectOwnershipError,
  )
  await assert.rejects(
    runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      deleteStoredBuilderProject(created.id, otherOwnerId),
    ),
    BuilderProjectOwnershipError,
  )

  assert.deepEqual(
    await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      listStoredBuilderProjects(otherOwnerId),
    ),
    [],
  )
  assert.deepEqual(
    await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      getStoredBuilderProject(created.id),
    ),
    created,
  )
})

test('preserves builder fork lineage', async () => {
  const mock = createMockR2Bucket()
  const ownerId = '11111111-1111-4111-8111-111111111111'
  const author = { name: 'Builder author', image: null }
  const source = await runWithHostRuntimeEnv(
    { BUILDER_PROJECTS: mock.bucket },
    () =>
      createStoredBuilderProject({
        author,
        description: '',
        ownerId,
        snapshotHash: 'a'.repeat(64),
        title: 'Source builder',
      }),
  )
  const fork = await runWithHostRuntimeEnv(
    { BUILDER_PROJECTS: mock.bucket },
    () =>
      createStoredBuilderProject({
        author,
        description: '',
        forkedFromId: source.id,
        ownerId,
        snapshotHash: 'b'.repeat(64),
        title: 'Forked builder',
      }),
  )

  assert.equal(fork.forkedFromId, source.id)
  assert.equal(
    (
      await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
        getStoredBuilderProject(fork.id),
      )
    )?.forkedFromId,
    source.id,
  )
})

test('caps builder projects per owner', async () => {
  const mock = createMockR2Bucket()
  const ownerId = '11111111-1111-4111-8111-111111111111'
  const input = {
    author: { name: 'Builder author', image: null },
    description: '',
    ownerId,
    snapshotHash: 'a'.repeat(64),
    title: 'Builder',
  }

  await runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, async () => {
    for (let index = 0; index < 100; index += 1) {
      await createStoredBuilderProject(input)
    }

    await assert.rejects(
      createStoredBuilderProject(input),
      BuilderProjectLimitError,
    )
    assert.equal((await listStoredBuilderProjects(ownerId)).length, 100)
  })
})

test('rejects an over-cap legacy owner set instead of importing it partially', async () => {
  const mock = createMockR2Bucket()
  const ownerId = '11111111-1111-4111-8111-111111111111'

  for (let index = 0; index <= 100; index += 1) {
    const id = `22222222-2222-4222-8222-${index.toString(16).padStart(12, '0')}`
    await mock.bucket.put(`record-index/v1/${ownerId}/${id}`, id)
  }

  await assert.rejects(
    runWithHostRuntimeEnv({ BUILDER_PROJECTS: mock.bucket }, () =>
      listStoredBuilderProjects(ownerId),
    ),
    BuilderProjectLimitError,
  )
})
