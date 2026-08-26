import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertBuilderProjectQuotaHardUsage,
  assertBuilderProjectQuotaUsage,
  builderProjectQuotaHardLimits,
  builderProjectQuotaLimits,
  BuilderProjectQuotaError,
} from '../src/utils/builder-project-events.server'
import {
  assertBuilderProjectSnapshotOwnerUsage,
  builderProjectSnapshotOwnerLimits,
  BuilderProjectSnapshotLimitError,
  deferLegacyReferencedBuilderProjectSnapshotGcCandidate,
  getBuilderProjectSnapshotGcCandidates,
  getBuilderProjectSnapshotReservationGcCandidates,
} from '../src/utils/builder-project-snapshot-registry.server'

test('accepts exact Builder project quotas and rejects the next entity', () => {
  assert.doesNotThrow(() =>
    assertBuilderProjectQuotaUsage({ ...builderProjectQuotaLimits }),
  )

  const resources = [
    'threads',
    'messages',
    'runs',
    'revisions',
    'events',
    'payloadBytes',
  ] satisfies Array<keyof typeof builderProjectQuotaLimits>
  for (const resource of resources) {
    assert.throws(
      () =>
        assertBuilderProjectQuotaUsage({
          ...builderProjectQuotaLimits,
          [resource]: builderProjectQuotaLimits[resource] + 1,
        }),
      (error) =>
        error instanceof BuilderProjectQuotaError &&
        error.resource === resource,
    )
  }
})

test('reserves bounded headroom for terminal lifecycle writes', () => {
  assert.doesNotThrow(() =>
    assertBuilderProjectQuotaHardUsage({
      ...builderProjectQuotaHardLimits,
    }),
  )
  assert.equal(
    builderProjectQuotaHardLimits.messages,
    builderProjectQuotaLimits.messages + 1,
  )
  assert.equal(
    builderProjectQuotaHardLimits.revisions,
    builderProjectQuotaLimits.revisions + 1,
  )
  assert.equal(
    builderProjectQuotaHardLimits.events,
    builderProjectQuotaLimits.events + 8,
  )
  assert.throws(
    () =>
      assertBuilderProjectQuotaHardUsage({
        ...builderProjectQuotaHardLimits,
        events: builderProjectQuotaHardLimits.events + 1,
      }),
    (error) =>
      error instanceof BuilderProjectQuotaError && error.resource === 'events',
  )
})

test('accepts the exact owner snapshot budget without resetting it', () => {
  assert.doesNotThrow(() =>
    assertBuilderProjectSnapshotOwnerUsage({
      ...builderProjectSnapshotOwnerLimits,
    }),
  )
  assert.throws(
    () =>
      assertBuilderProjectSnapshotOwnerUsage({
        ...builderProjectSnapshotOwnerLimits,
        snapshots: builderProjectSnapshotOwnerLimits.snapshots + 1,
      }),
    (error) =>
      error instanceof BuilderProjectSnapshotLimitError &&
      error.resource === 'snapshots',
  )
  assert.throws(
    () =>
      assertBuilderProjectSnapshotOwnerUsage({
        ...builderProjectSnapshotOwnerLimits,
        sourceBytes: builderProjectSnapshotOwnerLimits.sourceBytes + 1,
      }),
    (error) =>
      error instanceof BuilderProjectSnapshotLimitError &&
      error.resource === 'sourceBytes',
  )
})

test('referenced snapshot reservations are filtered before the GC batch limit', () => {
  process.env.DATABASE_URL ??= 'postgres://127.0.0.1:9/unused-signatures'
  const limit = 25
  const query = getBuilderProjectSnapshotReservationGcCandidates({
    cutoff: new Date(0),
    limit,
  }).toSQL()
  const eligibilityIndex = query.sql.indexOf('not exists')
  const limitIndex = query.sql.lastIndexOf('limit')

  assert.ok(eligibilityIndex >= 0)
  assert.ok(eligibilityIndex < limitIndex)
  assert.equal(query.params.at(-1), limit)
})

test('referenced snapshots are filtered before the GC batch limit', () => {
  process.env.DATABASE_URL ??= 'postgres://127.0.0.1:9/unused-signatures'
  const limit = 25
  const query = getBuilderProjectSnapshotGcCandidates({
    cutoff: new Date(0),
    limit,
  }).toSQL()
  const eligibilityMatches = query.sql.match(/not exists/g) ?? []
  const limitIndex = query.sql.lastIndexOf('limit')

  assert.equal(eligibilityMatches.length, 3)
  assert.ok(query.sql.lastIndexOf('not exists') < limitIndex)
  assert.ok(query.sql.indexOf('deleting_at is not null') < limitIndex)
  assert.equal(query.params.at(-1), limit)
})

test('legacy-referenced snapshots are deferred behind the next GC batch', () => {
  process.env.DATABASE_URL ??= 'postgres://127.0.0.1:9/unused-signatures'
  const occurredAt = new Date('2026-08-20T12:00:00.000Z')
  const deferred = deferLegacyReferencedBuilderProjectSnapshotGcCandidate({
    hash: 'a'.repeat(64),
    occurredAt,
  }).toSQL()
  const candidates = getBuilderProjectSnapshotGcCandidates({
    cutoff: new Date(0),
    limit: 25,
  }).toSQL()

  assert.match(deferred.sql, /set "deleting_at" = \$1, "updated_at" = \$2/)
  assert.deepEqual(deferred.params.slice(0, 2), [
    null,
    occurredAt.toISOString(),
  ])
  assert.match(
    candidates.sql,
    /order by "builder_project_snapshots"\."updated_at"/,
  )
  assert.ok(
    candidates.sql.indexOf('order by') < candidates.sql.lastIndexOf('limit'),
  )
})
