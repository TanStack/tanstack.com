import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { getBlobStorage } from '../src/server/runtime/blob-storage.server'
import { runWithHostRuntimeEnv } from '../src/server/runtime/host.server'
import { createSharedExampleProject } from '../src/utils/example-project'
import { createExampleWorkspace } from '../src/utils/example-workspace'
import {
  getNotebookProjectObject,
  NotebookProjectQuarantinedError,
  parseStoredNotebookProject,
  quarantineNotebookProject,
  storeNotebookProject,
} from '../src/utils/notebook-project-storage.server'

type StoredObject = {
  customMetadata?: Record<string, string>
  httpMetadata?: {
    contentEncoding?: string
    contentType?: string
  }
  uploaded: Date
  value: ArrayBuffer
}

function createMockR2Bucket() {
  const objects = new Map<string, StoredObject>()

  function getObject(key: string, object: StoredObject) {
    const value = object.value.slice(0)
    return {
      arrayBuffer: async () => value.slice(0),
      body: new Blob([value]).stream(),
      customMetadata: object.customMetadata,
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
        options?: {
          customMetadata?: Record<string, string>
          httpMetadata?: {
            contentEncoding?: string
            contentType?: string
          }
          onlyIf?: { etagDoesNotMatch: string }
        },
      ) {
        if (options?.onlyIf?.etagDoesNotMatch === '*' && objects.has(key)) {
          return null
        }

        const bytes = await readValue(value)
        const object = {
          customMetadata: options?.customMetadata,
          httpMetadata: options?.httpMetadata,
          uploaded: new Date(),
          value: bytes,
        }
        objects.set(key, object)
        return getObject(key, object)
      },
    },
    objects,
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
  assert.equal(await (await storage.get('immutable'))?.text(), 'first')
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
