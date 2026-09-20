import assert from 'node:assert/strict'
import test from 'node:test'
import { createSharedExampleProject } from '../src/utils/example-project'
import { createExampleWorkspace } from '../src/utils/example-workspace'
import { parseBuilderProject } from '../src/utils/builder-project'
import {
  createBuilderProject,
  listBuilderProjects,
  BuilderRequestError,
  updateBuilderProject,
} from '../src/utils/builder-project.client'

const builderProject = parseBuilderProject({
  version: 1,
  id: '11111111-1111-4111-8111-111111111111',
  ownerId: '22222222-2222-4222-8222-222222222222',
  snapshotHash: 'a'.repeat(64),
  currentRevisionId: '44444444-4444-4444-8444-444444444444',
  currentRevisionNumber: 1,
  forkedFromId: '33333333-3333-4333-8333-333333333333',
  title: 'Builder project',
  description: 'A public builder.',
  author: { name: 'Builder author', image: null },
  createdAt: '2026-08-15T12:00:00.000Z',
  updatedAt: '2026-08-15T13:00:00.000Z',
})

const snapshot = createSharedExampleProject({
  title: builderProject.title,
  description: builderProject.description,
  workspace: createExampleWorkspace({
    entry: '/src/main.ts',
    files: { '/src/main.ts': 'export default 42' },
  }),
})

test('builder client helpers parse lists and send fork lineage', async (t) => {
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
  t.mock.method(
    globalThis,
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init })
      const body =
        init?.method === 'POST' || init?.method === 'PATCH'
          ? { project: builderProject }
          : { projects: [builderProject] }
      return new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
      })
    },
  )

  assert.deepEqual(await listBuilderProjects(), [builderProject])
  assert.deepEqual(
    await createBuilderProject(snapshot, {
      clientMutationId: '55555555-5555-4555-8555-555555555555',
      forkedFromId: builderProject.forkedFromId,
      id: '66666666-6666-4666-8666-666666666666',
      revisionId: '77777777-7777-4777-8777-777777777777',
    }),
    builderProject,
  )
  assert.deepEqual(
    await updateBuilderProject(
      builderProject,
      snapshot,
      '88888888-8888-4888-8888-888888888888',
    ),
    builderProject,
  )
  assert.equal(requests[0]?.input, '/api/builder/projects')
  assert.equal(requests[1]?.input, '/api/builder/projects')
  assert.deepEqual(JSON.parse(String(requests[1]?.init?.body)), {
    clientMutationId: '55555555-5555-4555-8555-555555555555',
    id: '66666666-6666-4666-8666-666666666666',
    project: snapshot,
    forkedFromId: builderProject.forkedFromId,
    revisionId: '77777777-7777-4777-8777-777777777777',
  })
  assert.equal(requests[2]?.input, `/api/builder/projects/${builderProject.id}`)
  assert.equal(requests[2]?.init?.method, 'PATCH')
  assert.deepEqual(JSON.parse(String(requests[2]?.init?.body)), {
    clientMutationId: '88888888-8888-4888-8888-888888888888',
    expectedRevisionNumber: 1,
    project: snapshot,
    revisionId: JSON.parse(String(requests[2]?.init?.body)).revisionId,
  })
  assert.match(
    JSON.parse(String(requests[2]?.init?.body)).revisionId,
    /^[0-9a-f-]{36}$/,
  )
})

test('builder client helpers surface API errors', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
  )

  await assert.rejects(listBuilderProjects(), (error: unknown) => {
    assert.ok(error instanceof BuilderRequestError)
    assert.equal(error.message, 'Not authenticated')
    assert.equal(error.status, 401)
    return true
  })
})
