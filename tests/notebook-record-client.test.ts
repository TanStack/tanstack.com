import assert from 'node:assert/strict'
import test from 'node:test'
import { createSharedExampleProject } from '../src/utils/example-project'
import { createExampleWorkspace } from '../src/utils/example-workspace'
import { parseNotebookRecord } from '../src/utils/notebook-record'
import {
  createNotebookRecord,
  listNotebookRecords,
  NotebookRequestError,
  updateNotebookRecord,
} from '../src/utils/notebook-record.client'

const record = parseNotebookRecord({
  version: 1,
  id: '11111111-1111-4111-8111-111111111111',
  ownerId: '22222222-2222-4222-8222-222222222222',
  projectHash: 'a'.repeat(64),
  forkedFromId: '33333333-3333-4333-8333-333333333333',
  title: 'Notebook record',
  description: 'A public notebook.',
  author: { name: 'Notebook author', image: null },
  createdAt: '2026-08-15T12:00:00.000Z',
  updatedAt: '2026-08-15T13:00:00.000Z',
})

const project = createSharedExampleProject({
  title: record.title,
  description: record.description,
  workspace: createExampleWorkspace({
    entry: '/src/main.ts',
    files: { '/src/main.ts': 'export default 42' },
  }),
})

test('notebook client helpers parse lists and send fork lineage', async (t) => {
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
  t.mock.method(
    globalThis,
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init })
      const body =
        init?.method === 'POST' || init?.method === 'PATCH'
          ? { record }
          : { records: [record] }
      return new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
      })
    },
  )

  assert.deepEqual(await listNotebookRecords(), [record])
  assert.deepEqual(
    await createNotebookRecord(project, record.forkedFromId),
    record,
  )
  assert.deepEqual(await updateNotebookRecord(record, project), record)
  assert.equal(requests[0]?.input, '/api/notebook/records')
  assert.equal(requests[1]?.input, '/api/notebook/records')
  assert.deepEqual(JSON.parse(String(requests[1]?.init?.body)), {
    project,
    forkedFromId: record.forkedFromId,
  })
  assert.equal(requests[2]?.input, `/api/notebook/records/${record.id}`)
  assert.equal(requests[2]?.init?.method, 'PATCH')
  assert.deepEqual(JSON.parse(String(requests[2]?.init?.body)), {
    expectedUpdatedAt: record.updatedAt,
    project,
  })
})

test('notebook client helpers surface API errors', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
  )

  await assert.rejects(listNotebookRecords(), (error: unknown) => {
    assert.ok(error instanceof NotebookRequestError)
    assert.equal(error.message, 'Not authenticated')
    assert.equal(error.status, 401)
    return true
  })
})
