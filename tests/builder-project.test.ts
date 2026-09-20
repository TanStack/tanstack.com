import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseDeleteBuilderProjectResponse,
  parseBuilderProject,
  parseBuilderProjectListResponse,
  parseBuilderProjectResponse,
} from '../src/utils/builder-project'

const project = {
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
}

test('parses builder projects and API response envelopes', () => {
  assert.deepEqual(parseBuilderProject(project), project)
  assert.deepEqual(parseBuilderProjectResponse({ project }), project)
  assert.deepEqual(parseBuilderProjectListResponse({ projects: [project] }), [
    project,
  ])
  assert.equal(
    parseDeleteBuilderProjectResponse({ deleted: true, id: project.id }),
    project.id,
  )
})

test('strictly rejects malformed builder projects and responses', () => {
  assert.throws(() => parseBuilderProject({ ...project, unknown: true }))
  assert.throws(() => parseBuilderProject({ ...project, id: 'not-a-uuid' }))
  assert.throws(() =>
    parseBuilderProject({ ...project, snapshotHash: 'not-a-hash' }),
  )
  assert.throws(() =>
    parseBuilderProject({ ...project, forkedFromId: 'not-a-uuid' }),
  )
  assert.throws(() => parseBuilderProjectResponse(project))
  assert.throws(() => parseBuilderProjectListResponse({ projects: [null] }))
  assert.throws(() =>
    parseDeleteBuilderProjectResponse({ deleted: false, id: project.id }),
  )
})
