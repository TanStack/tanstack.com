import assert from 'node:assert/strict'
import test from 'node:test'
import type { BuilderProject } from '../src/utils/builder-project'
import { orderLegacyBuilderProjectsForImport } from '../src/utils/builder-project-state.server'

function legacyProject(id: string, forkedFromId?: string): BuilderProject {
  return {
    version: 1,
    id,
    ownerId: '11111111-1111-4111-8111-111111111111',
    snapshotHash: 'a'.repeat(64),
    ...(forkedFromId ? { forkedFromId } : {}),
    title: id,
    description: '',
    author: { name: null, image: null },
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
  }
}

test('imports a complete legacy owner set source before fork', () => {
  const source = legacyProject('22222222-2222-4222-8222-222222222222')
  const fork = legacyProject('33333333-3333-4333-8333-333333333333', source.id)

  assert.deepEqual(orderLegacyBuilderProjectsForImport([fork, source]), [
    source,
    fork,
  ])
})

test('rejects a legacy fork cycle before marking an owner import complete', () => {
  const firstId = '22222222-2222-4222-8222-222222222222'
  const secondId = '33333333-3333-4333-8333-333333333333'

  assert.throws(() =>
    orderLegacyBuilderProjectsForImport([
      legacyProject(firstId, secondId),
      legacyProject(secondId, firstId),
    ]),
  )
})
