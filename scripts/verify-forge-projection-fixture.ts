import assert from 'node:assert/strict'
import {
  createLocalProjectionFixtureState,
  createLocalProjectionFixtureTimeline,
} from '../src/builder/projection/local-fixture'
import { projectLocalBuilderTimeline } from '../src/builder/projection'

const timeline = createLocalProjectionFixtureTimeline()
const firstProjection = projectLocalBuilderTimeline(timeline)
const secondProjection = createLocalProjectionFixtureState()

assert.deepEqual(
  firstProjection,
  secondProjection,
  'local projection fixture must replay deterministically',
)

assert.deepEqual(
  firstProjection.map((event) => event.type),
  [
    'messages',
    'runs',
    'runs',
    'files',
    'files',
    'messages',
    'runs',
    'manifests',
    'exports',
    'exports',
    'exports',
    'exports',
  ],
  'fixture should cover transcript, run, file, manifest, and export rows',
)

firstProjection.forEach((event, index) => {
  const expectedOffset = String(index + 1)

  assert.equal(
    event.headers.stateOffset,
    expectedOffset,
    'state offsets must be deterministic and contiguous',
  )

  assert.ok(isRecord(event.value), 'projected row value must be an object')
  assert.equal(
    event.value.lastStateOffset,
    expectedOffset,
    'projected rows must carry their last state offset provenance',
  )
})

const runRows = firstProjection
  .filter((event) => event.type === 'runs')
  .map((event) => event.value)
  .filter(isRecord)

assert.equal(
  runRows.length,
  3,
  'fixture should project queued, running, finished run states',
)
assert.equal(runRows[0]?.status, 'queued')
assert.equal(runRows[1]?.status, 'running')
assert.equal(runRows[1]?.startedAt, '2026-06-18T00:00:02.000Z')
assert.equal(runRows[2]?.status, 'finished')
assert.equal(runRows[2]?.startedAt, '2026-06-18T00:00:02.000Z')
assert.equal(runRows[2]?.endedAt, '2026-06-18T00:00:05.000Z')

const fileRows = firstProjection
  .filter((event) => event.type === 'files')
  .map((event) => event.value)
  .filter(isRecord)

assert.equal(
  fileRows.length,
  2,
  'fixture should project upserted and deleted files',
)
assert.equal(fileRows[0]?.path, 'src/routes/index.tsx')
assert.equal(fileRows[0]?.status, 'active')
assert.equal(fileRows[1]?.path, 'src/old.ts')
assert.equal(fileRows[1]?.status, 'deleted')
assert.equal(fileRows[1]?.source, 'builder-definition')

const exportRows = firstProjection
  .filter((event) => event.type === 'exports')
  .map((event) => event.value)
  .filter(isRecord)

assert.equal(exportRows.length, 4, 'fixture should project four export states')
assert.equal(exportRows[0]?.status, 'running')
assert.equal(exportRows[1]?.status, 'completed')
assert.equal(exportRows[1]?.byteLength, 1234)
assert.equal(exportRows[1]?.kind, 'zip')
assert.equal(exportRows[1]?.manifestVersionId, 'local-manifest-sha256:fixture')
assert.equal(exportRows[2]?.status, 'running')
assert.equal(exportRows[2]?.kind, 'github')
assert.equal(exportRows[2]?.repoName, 'fixture-app')
assert.equal(exportRows[3]?.status, 'completed')
assert.equal(exportRows[3]?.kind, 'github')
assert.equal(exportRows[3]?.repoOwner, 'fixture-owner')
assert.equal(
  exportRows[3]?.repoUrl,
  'https://github.com/fixture-owner/fixture-app',
)
assert.equal(exportRows[3]?.commitSha, 'fixture-commit-sha')

console.log('Forge projection fixture passed')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
