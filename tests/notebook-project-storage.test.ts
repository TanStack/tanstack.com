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
  getNotebookProjectObject,
  NotebookProjectQuarantinedError,
  parseStoredNotebookProject,
  quarantineNotebookProject,
  storeNotebookProject,
} from '../src/utils/notebook-project-storage.server'
import {
  createStoredNotebookRecord,
  deleteStoredNotebookRecord,
  getStoredNotebookRecord,
  listStoredNotebookRecords,
  NotebookRecordConflictError,
  NotebookRecordLimitError,
  NotebookRecordOwnershipError,
  NotebookRecordQuarantinedError,
  quarantineStoredNotebookRecordsByProjectHash,
  updateStoredNotebookRecord,
} from '../src/utils/notebook-record-storage.server'

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
    { NOTEBOOK_PROJECTS: mock.bucket },
    () => storeNotebookProject(firstProject),
  )
  const second = await runWithHostRuntimeEnv(
    { NOTEBOOK_PROJECTS: mock.bucket },
    () => storeNotebookProject(secondProject),
  )

  assert.equal(first.created, true)
  assert.equal(second.created, false)
  assert.equal(second.hash, first.hash)

  const projectObjects = Array.from(mock.objects.entries()).filter(([key]) =>
    key.startsWith('projects/'),
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
  assert.deepEqual(parseStoredNotebookProject(JSON.parse(source)), firstProject)
})

test('only-if-absent writes never replace an immutable object', async () => {
  const mock = createMockR2Bucket()
  const storage = await runWithHostRuntimeEnv(
    { NOTEBOOK_PROJECTS: mock.bucket },
    () => getBlobStorage('notebookProjects'),
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
    { NOTEBOOK_PROJECTS: mock.bucket },
    () => storeNotebookProject(project),
  )

  await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
    quarantineNotebookProject(stored.hash, 'user-id'),
  )

  const object = await runWithHostRuntimeEnv(
    { NOTEBOOK_PROJECTS: mock.bucket },
    () => getNotebookProjectObject(stored.hash),
  )
  assert.equal(object, null)
  assert.equal(
    Array.from(mock.objects.keys()).some((key) => key.startsWith('projects/')),
    false,
  )
  assert.equal(
    Array.from(mock.objects.keys()).some((key) =>
      key.startsWith('quarantine/'),
    ),
    true,
  )

  await assert.rejects(
    runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      storeNotebookProject(project),
    ),
    NotebookProjectQuarantinedError,
  )
})

test('rejects projects over the per-file byte limit', () => {
  const project = createProject({
    '/src/index.tsx': 'a'.repeat(512 * 1024 + 1),
  })

  assert.throws(
    () => parseStoredNotebookProject(project),
    /Notebook file exceeds 512 KiB/,
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
    () => parseStoredNotebookProject(project),
    /Notebook file exceeds 512 KiB: \/public\/favicon\.ico/,
  )
})

test('creates, lists, updates, and deletes stable notebook records', async () => {
  const mock = createMockR2Bucket()
  const ownerId = '11111111-1111-4111-8111-111111111111'
  const projectHash = 'a'.repeat(64)
  const nextProjectHash = 'b'.repeat(64)
  const author = { name: 'Notebook author', image: null }

  const created = await runWithHostRuntimeEnv(
    { NOTEBOOK_PROJECTS: mock.bucket },
    () =>
      createStoredNotebookRecord({
        author,
        description: 'First revision',
        ownerId,
        projectHash,
        title: 'Stable notebook',
      }),
  )

  assert.equal(created.ownerId, ownerId)
  assert.equal(created.projectHash, projectHash)
  assert.equal(
    mock.objects.has(`record-project-index/v1/${projectHash}/${created.id}`),
    true,
  )
  assert.deepEqual(
    await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      getStoredNotebookRecord(created.id),
    ),
    created,
  )
  assert.deepEqual(
    await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      listStoredNotebookRecords(ownerId),
    ),
    [created],
  )

  const updated = await runWithHostRuntimeEnv(
    { NOTEBOOK_PROJECTS: mock.bucket },
    () =>
      updateStoredNotebookRecord({
        author,
        description: 'Second revision',
        expectedUpdatedAt: created.updatedAt,
        id: created.id,
        ownerId,
        projectHash: nextProjectHash,
        title: 'Stable notebook',
      }),
  )
  if (!updated) throw new Error('Expected notebook record update')
  assert.equal(updated.createdAt, created.createdAt)
  assert.equal(updated.projectHash, nextProjectHash)
  assert.equal(updated.description, 'Second revision')
  assert.equal(
    mock.objects.has(`record-project-index/v1/${projectHash}/${created.id}`),
    true,
  )
  assert.equal(
    mock.objects.has(
      `record-project-index/v1/${nextProjectHash}/${created.id}`,
    ),
    true,
  )

  assert.equal(
    await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      deleteStoredNotebookRecord(created.id, ownerId),
    ),
    true,
  )
  assert.equal(
    await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      getStoredNotebookRecord(created.id),
    ),
    null,
  )
  assert.deepEqual(
    await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      listStoredNotebookRecords(ownerId),
    ),
    [],
  )
  assert.equal(
    mock.objects.has(`record-project-index/v1/${projectHash}/${created.id}`),
    true,
  )
  assert.equal(
    mock.objects.has(
      `record-project-index/v1/${nextProjectHash}/${created.id}`,
    ),
    true,
  )
})

test('rejects a stale notebook record update', async () => {
  const mock = createMockR2Bucket()
  const ownerId = '11111111-1111-4111-8111-111111111111'
  const author = { name: 'Notebook author', image: null }
  const created = await runWithHostRuntimeEnv(
    { NOTEBOOK_PROJECTS: mock.bucket },
    () =>
      createStoredNotebookRecord({
        author,
        description: '',
        ownerId,
        projectHash: 'a'.repeat(64),
        title: 'Conflict test',
      }),
  )
  const updated = await runWithHostRuntimeEnv(
    { NOTEBOOK_PROJECTS: mock.bucket },
    () =>
      updateStoredNotebookRecord({
        author,
        description: 'First update',
        expectedUpdatedAt: created.updatedAt,
        id: created.id,
        ownerId,
        projectHash: 'b'.repeat(64),
        title: 'Conflict test',
      }),
  )

  await assert.rejects(
    runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      updateStoredNotebookRecord({
        author,
        description: 'Stale update',
        expectedUpdatedAt: created.updatedAt,
        id: created.id,
        ownerId,
        projectHash: 'c'.repeat(64),
        title: 'Conflict test',
      }),
    ),
    NotebookRecordConflictError,
  )
  assert.notEqual(updated?.updatedAt, created.updatedAt)
  assert.deepEqual(
    await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      getStoredNotebookRecord(created.id),
    ),
    updated,
  )
})

test('allows only one simultaneous conditional notebook update', async () => {
  const mock = createMockR2Bucket()
  const ownerId = '11111111-1111-4111-8111-111111111111'
  const author = { name: 'Notebook author', image: null }
  const created = await runWithHostRuntimeEnv(
    { NOTEBOOK_PROJECTS: mock.bucket },
    () =>
      createStoredNotebookRecord({
        author,
        description: '',
        ownerId,
        projectHash: 'a'.repeat(64),
        title: 'Conditional update test',
      }),
  )
  const recordKey = `records/v1/${created.id}.json`
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
    if (key !== recordKey || options?.onlyIf?.etagMatches === undefined) return
    waitingWrites += 1
    if (waitingWrites === 2) reportBothWritesReady()
    await writesReleased
  })

  const resultsPromise = runWithHostRuntimeEnv(
    { NOTEBOOK_PROJECTS: mock.bucket },
    () =>
      Promise.allSettled([
        updateStoredNotebookRecord({
          author,
          description: 'First contender',
          expectedUpdatedAt: created.updatedAt,
          id: created.id,
          ownerId,
          projectHash: 'b'.repeat(64),
          title: 'Conditional update test',
        }),
        updateStoredNotebookRecord({
          author,
          description: 'Second contender',
          expectedUpdatedAt: created.updatedAt,
          id: created.id,
          ownerId,
          projectHash: 'c'.repeat(64),
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
  assert.equal(rejected[0]?.reason instanceof NotebookRecordConflictError, true)
  assert.deepEqual(
    await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      getStoredNotebookRecord(created.id),
    ),
    fulfilled[0]?.value,
  )
})

test('does not resurrect a notebook updated while it is deleted', async () => {
  const mock = createMockR2Bucket()
  const ownerId = '11111111-1111-4111-8111-111111111111'
  const author = { name: 'Notebook author', image: null }
  const created = await runWithHostRuntimeEnv(
    { NOTEBOOK_PROJECTS: mock.bucket },
    () =>
      createStoredNotebookRecord({
        author,
        description: '',
        ownerId,
        projectHash: 'a'.repeat(64),
        title: 'Delete race test',
      }),
  )
  const recordKey = `records/v1/${created.id}.json`
  let releaseUpdate = () => {}
  const updateReleased = new Promise<void>((resolve) => {
    releaseUpdate = () => resolve()
  })
  let reportUpdateReady = () => {}
  const updateReady = new Promise<void>((resolve) => {
    reportUpdateReady = () => resolve()
  })

  mock.setBeforePut(async (key, options) => {
    if (key !== recordKey || options?.onlyIf?.etagMatches === undefined) return
    reportUpdateReady()
    await updateReleased
  })

  const updatePromise = runWithHostRuntimeEnv(
    { NOTEBOOK_PROJECTS: mock.bucket },
    () =>
      updateStoredNotebookRecord({
        author,
        description: 'In-flight update',
        expectedUpdatedAt: created.updatedAt,
        id: created.id,
        ownerId,
        projectHash: 'b'.repeat(64),
        title: 'Delete race test',
      }),
  )
  const updateRejected = assert.rejects(
    updatePromise,
    NotebookRecordQuarantinedError,
  )

  await updateReady
  assert.equal(
    await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      deleteStoredNotebookRecord(created.id, ownerId),
    ),
    true,
  )
  releaseUpdate()
  await updateRejected

  assert.equal(
    await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      getStoredNotebookRecord(created.id),
    ),
    null,
  )
  assert.equal(mock.objects.has(recordKey), false)
  assert.equal(
    mock.objects.has(`record-index/v1/${ownerId}/${created.id}`),
    false,
  )
  assert.equal(
    mock.objects.has(`record-quarantine/v1/${created.id}.json`),
    true,
  )
})

test('quarantines records by every historical project association', async () => {
  const mock = createMockR2Bucket()
  const firstOwnerId = '11111111-1111-4111-8111-111111111111'
  const secondOwnerId = '22222222-2222-4222-8222-222222222222'
  const adminUserId = '33333333-3333-4333-8333-333333333333'
  const quarantinedHash = 'a'.repeat(64)
  const currentHash = 'b'.repeat(64)
  const author = { name: 'Notebook author', image: null }

  const historicalRecord = await runWithHostRuntimeEnv(
    { NOTEBOOK_PROJECTS: mock.bucket },
    () =>
      createStoredNotebookRecord({
        author,
        description: '',
        ownerId: firstOwnerId,
        projectHash: quarantinedHash,
        title: 'Historical match',
      }),
  )
  await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
    updateStoredNotebookRecord({
      author,
      description: '',
      expectedUpdatedAt: historicalRecord.updatedAt,
      id: historicalRecord.id,
      ownerId: firstOwnerId,
      projectHash: currentHash,
      title: 'Historical match',
    }),
  )
  const currentRecord = await runWithHostRuntimeEnv(
    { NOTEBOOK_PROJECTS: mock.bucket },
    () =>
      createStoredNotebookRecord({
        author,
        description: '',
        ownerId: secondOwnerId,
        projectHash: quarantinedHash,
        title: 'Current match',
      }),
  )
  const unaffectedRecord = await runWithHostRuntimeEnv(
    { NOTEBOOK_PROJECTS: mock.bucket },
    () =>
      createStoredNotebookRecord({
        author,
        description: '',
        ownerId: firstOwnerId,
        projectHash: currentHash,
        title: 'Unaffected',
      }),
  )

  await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
    quarantineNotebookProject(quarantinedHash, adminUserId),
  )
  assert.equal(
    await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      quarantineStoredNotebookRecordsByProjectHash(
        quarantinedHash,
        adminUserId,
      ),
    ),
    2,
  )

  assert.equal(
    await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      getStoredNotebookRecord(historicalRecord.id),
    ),
    null,
  )
  assert.equal(
    await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      getStoredNotebookRecord(currentRecord.id),
    ),
    null,
  )
  assert.deepEqual(
    await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      listStoredNotebookRecords(firstOwnerId),
    ),
    [unaffectedRecord],
  )
  assert.deepEqual(
    await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      listStoredNotebookRecords(secondOwnerId),
    ),
    [],
  )
  await assert.rejects(
    runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      updateStoredNotebookRecord({
        author,
        description: '',
        expectedUpdatedAt: historicalRecord.updatedAt,
        id: historicalRecord.id,
        ownerId: firstOwnerId,
        projectHash: currentHash,
        title: 'Cannot revive',
      }),
    ),
    NotebookRecordQuarantinedError,
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

test('removes a record quarantined during its final update write', async () => {
  const mock = createMockR2Bucket()
  const ownerId = '11111111-1111-4111-8111-111111111111'
  const projectHash = 'a'.repeat(64)
  const nextProjectHash = 'b'.repeat(64)
  const author = { name: 'Notebook author', image: null }
  const created = await runWithHostRuntimeEnv(
    { NOTEBOOK_PROJECTS: mock.bucket },
    () =>
      createStoredNotebookRecord({
        author,
        description: '',
        ownerId,
        projectHash,
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
    runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      updateStoredNotebookRecord({
        author,
        description: 'Updated during quarantine',
        expectedUpdatedAt: created.updatedAt,
        id: created.id,
        ownerId,
        projectHash: nextProjectHash,
        title: 'Race test',
      }),
    ),
    NotebookRecordQuarantinedError,
  )
  assert.equal(insertedTombstone, true)
  assert.equal(
    await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      getStoredNotebookRecord(created.id),
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
      `record-project-index/v1/${nextProjectHash}/${created.id}`,
    ),
    true,
  )
})

test('keeps notebook record mutations owner-only', async () => {
  const mock = createMockR2Bucket()
  const ownerId = '11111111-1111-4111-8111-111111111111'
  const otherOwnerId = '22222222-2222-4222-8222-222222222222'
  const author = { name: null, image: null }
  const created = await runWithHostRuntimeEnv(
    { NOTEBOOK_PROJECTS: mock.bucket },
    () =>
      createStoredNotebookRecord({
        author,
        description: '',
        ownerId,
        projectHash: 'a'.repeat(64),
        title: 'Owned notebook',
      }),
  )

  await assert.rejects(
    runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      updateStoredNotebookRecord({
        author,
        description: '',
        expectedUpdatedAt: created.updatedAt,
        id: created.id,
        ownerId: otherOwnerId,
        projectHash: 'b'.repeat(64),
        title: 'Changed notebook',
      }),
    ),
    NotebookRecordOwnershipError,
  )
  await assert.rejects(
    runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      deleteStoredNotebookRecord(created.id, otherOwnerId),
    ),
    NotebookRecordOwnershipError,
  )

  assert.deepEqual(
    await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      listStoredNotebookRecords(otherOwnerId),
    ),
    [],
  )
  assert.deepEqual(
    await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
      getStoredNotebookRecord(created.id),
    ),
    created,
  )
})

test('preserves notebook fork lineage', async () => {
  const mock = createMockR2Bucket()
  const ownerId = '11111111-1111-4111-8111-111111111111'
  const author = { name: 'Notebook author', image: null }
  const source = await runWithHostRuntimeEnv(
    { NOTEBOOK_PROJECTS: mock.bucket },
    () =>
      createStoredNotebookRecord({
        author,
        description: '',
        ownerId,
        projectHash: 'a'.repeat(64),
        title: 'Source notebook',
      }),
  )
  const fork = await runWithHostRuntimeEnv(
    { NOTEBOOK_PROJECTS: mock.bucket },
    () =>
      createStoredNotebookRecord({
        author,
        description: '',
        forkedFromId: source.id,
        ownerId,
        projectHash: 'b'.repeat(64),
        title: 'Forked notebook',
      }),
  )

  assert.equal(fork.forkedFromId, source.id)
  assert.equal(
    (
      await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, () =>
        getStoredNotebookRecord(fork.id),
      )
    )?.forkedFromId,
    source.id,
  )
})

test('caps notebook records per owner', async () => {
  const mock = createMockR2Bucket()
  const ownerId = '11111111-1111-4111-8111-111111111111'
  const input = {
    author: { name: 'Notebook author', image: null },
    description: '',
    ownerId,
    projectHash: 'a'.repeat(64),
    title: 'Notebook',
  }

  await runWithHostRuntimeEnv({ NOTEBOOK_PROJECTS: mock.bucket }, async () => {
    for (let index = 0; index < 100; index += 1) {
      await createStoredNotebookRecord(input)
    }

    await assert.rejects(
      createStoredNotebookRecord(input),
      NotebookRecordLimitError,
    )
    assert.equal((await listStoredNotebookRecords(ownerId)).length, 100)
  })
})
