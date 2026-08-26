import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import {
  BuilderProjectQuarantineCleanupError,
  builderProjectQuarantineOperations,
  quarantineBuilderProjectSnapshotForAdmin,
} from '../src/routes/api/builder/project-snapshots.$hash.quarantine'

const hash = 'a'.repeat(64)
const actorId = '00000000-0000-4000-8000-000000000001'

test('does not mutate database quarantine state when the R2 tombstone fails', async () => {
  const order: Array<string> = []
  const storageError = new Error('R2 unavailable')
  mock.method(
    builderProjectQuarantineOperations,
    'quarantineSnapshot',
    async () => {
      order.push('r2')
      throw storageError
    },
  )
  mock.method(
    builderProjectQuarantineOperations,
    'isSnapshotQuarantined',
    async () => {
      order.push('r2-status')
      return false
    },
  )
  mock.method(
    builderProjectQuarantineOperations,
    'purgeCacheTags',
    async (tags: Array<string>) => {
      order.push('purge')
      return { purged: true, tags }
    },
  )
  mock.method(
    builderProjectQuarantineOperations,
    'quarantineProjects',
    async () => {
      order.push('database')
      return []
    },
  )
  mock.method(
    builderProjectQuarantineOperations,
    'quarantineStableProjects',
    async () => {
      order.push('legacy')
      return 0
    },
  )

  try {
    await assert.rejects(
      quarantineBuilderProjectSnapshotForAdmin({ hash, actorId }),
      (error) =>
        error instanceof BuilderProjectQuarantineCleanupError &&
        error.failures.includes(storageError),
    )
    assert.deepEqual(order, ['r2', 'purge', 'r2-status'])
  } finally {
    mock.restoreAll()
  }
})

test('purges cache and advances database quarantine after a partial R2 delete failure', async () => {
  const order: Array<string> = []
  const deleteError = new Error('R2 delete unavailable')
  mock.method(
    builderProjectQuarantineOperations,
    'quarantineSnapshot',
    async () => {
      order.push('r2-tombstone')
      throw deleteError
    },
  )
  mock.method(
    builderProjectQuarantineOperations,
    'isSnapshotQuarantined',
    async () => {
      order.push('r2-status')
      return true
    },
  )
  mock.method(
    builderProjectQuarantineOperations,
    'purgeCacheTags',
    async (tags: Array<string>) => {
      order.push('purge')
      return { purged: true, tags }
    },
  )
  mock.method(
    builderProjectQuarantineOperations,
    'quarantineProjects',
    async () => {
      order.push('database')
      return []
    },
  )
  mock.method(
    builderProjectQuarantineOperations,
    'quarantineStableProjects',
    async () => {
      order.push('legacy')
      return 0
    },
  )

  try {
    await assert.rejects(
      quarantineBuilderProjectSnapshotForAdmin({ hash, actorId }),
      (error) =>
        error instanceof BuilderProjectQuarantineCleanupError &&
        error.failures.includes(deleteError),
    )
    assert.deepEqual(order, [
      'r2-tombstone',
      'purge',
      'r2-status',
      'database',
      'legacy',
    ])
  } finally {
    mock.restoreAll()
  }
})

test('keeps a snapshot unavailable and retryable when database quarantine fails', async () => {
  const order: Array<string> = []
  let databaseAttempts = 0
  let r2Blocked = false
  const databaseError = new Error('database unavailable')
  mock.method(
    builderProjectQuarantineOperations,
    'quarantineSnapshot',
    async () => {
      order.push('r2')
      r2Blocked = true
      return true
    },
  )
  mock.method(
    builderProjectQuarantineOperations,
    'isSnapshotQuarantined',
    async () => r2Blocked,
  )
  mock.method(
    builderProjectQuarantineOperations,
    'purgeCacheTags',
    async (tags: Array<string>) => {
      order.push('purge')
      return { purged: true, tags }
    },
  )
  mock.method(
    builderProjectQuarantineOperations,
    'quarantineProjects',
    async () => {
      order.push('database')
      databaseAttempts += 1
      if (databaseAttempts === 1) throw databaseError
      return ['00000000-0000-4000-8000-000000000002']
    },
  )
  mock.method(
    builderProjectQuarantineOperations,
    'quarantineStableProjects',
    async () => {
      order.push('legacy')
      return 1
    },
  )

  try {
    await assert.rejects(
      quarantineBuilderProjectSnapshotForAdmin({ hash, actorId }),
      (error) =>
        error instanceof BuilderProjectQuarantineCleanupError &&
        error.failures.includes(databaseError),
    )
    assert.equal(r2Blocked, true)
    assert.deepEqual(order, ['r2', 'purge', 'database', 'legacy'])

    const retried = await quarantineBuilderProjectSnapshotForAdmin({
      hash,
      actorId,
    })
    assert.equal(r2Blocked, true)
    assert.equal(databaseAttempts, 2)
    assert.deepEqual(retried.projectsQuarantined, [
      '00000000-0000-4000-8000-000000000002',
    ])
    assert.deepEqual(order, [
      'r2',
      'purge',
      'database',
      'legacy',
      'r2',
      'purge',
      'database',
      'legacy',
    ])
  } finally {
    mock.restoreAll()
  }
})
