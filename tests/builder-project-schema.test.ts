import assert from 'node:assert/strict'
import test from 'node:test'
import { getTableConfig } from 'drizzle-orm/pg-core'
import {
  builderProjectEvents,
  builderProjectMessages,
  builderProjectMutationReceipts,
  builderProjectRevisions,
  builderProjectRuns,
  builderProjectTombstones,
  builderProjects,
  builderProjectThreads,
} from '../src/db/schema'

const builderProjectForeignKeys = [
  ...getTableConfig(builderProjectRevisions).foreignKeys,
  ...getTableConfig(builderProjectThreads).foreignKeys,
  ...getTableConfig(builderProjectRuns).foreignKeys,
  ...getTableConfig(builderProjectMessages).foreignKeys,
  ...getTableConfig(builderProjectEvents).foreignKeys,
]

test('project-owned Builder records cascade with their referenced component', () => {
  const cascadingForeignKeys = [
    'builder_project_revisions_project_owner_fk',
    'builder_project_revisions_parent_fk',
    'builder_project_threads_project_owner_fk',
    'builder_project_runs_project_owner_fk',
    'builder_project_runs_thread_fk',
    'builder_project_runs_base_revision_fk',
    'builder_project_runs_result_revision_fk',
    'builder_project_messages_project_owner_fk',
    'builder_project_messages_thread_fk',
    'builder_project_messages_run_fk',
    'builder_project_events_project_owner_fk',
    'builder_project_events_thread_fk',
    'builder_project_events_revision_fk',
    'builder_project_events_message_fk',
    'builder_project_events_run_fk',
  ]

  for (const name of cascadingForeignKeys) {
    const foreignKey = builderProjectForeignKeys.find(
      (candidate) => candidate.getName() === name,
    )

    assert.ok(foreignKey, `${name} must exist`)
    assert.equal(foreignKey.onDelete, 'cascade', `${name} must cascade`)
  }
})

test('a fork source remains independently owned', () => {
  const foreignKey = getTableConfig(builderProjects).foreignKeys.find(
    (candidate) => candidate.getName() === 'builder_projects_forked_from_fk',
  )

  assert.ok(foreignKey)
  assert.equal(foreignKey.onDelete, 'set null')
})

test('project ID reservations survive owner deletion', () => {
  const table = getTableConfig(builderProjectTombstones)
  const ownerColumn = table.columns.find((column) => column.name === 'owner_id')
  const ownerForeignKey = table.foreignKeys.find(
    (candidate) =>
      candidate.getName() === 'builder_project_tombstones_owner_id_users_id_fk',
  )

  assert.ok(ownerColumn)
  assert.equal(ownerColumn.notNull, false)
  assert.ok(ownerForeignKey)
  assert.equal(ownerForeignKey.onDelete, 'set null')
})

test('owner deletion cannot bypass project tombstoning', () => {
  const ownerForeignKey = getTableConfig(builderProjects).foreignKeys.find(
    (candidate) =>
      candidate.getName() === 'builder_projects_owner_id_users_id_fk',
  )

  assert.ok(ownerForeignKey)
  assert.equal(ownerForeignKey.onDelete, 'restrict')
})

test('mutation receipts are unique per project and follow project retention', () => {
  const table = getTableConfig(builderProjectMutationReceipts)
  const projectForeignKey = table.foreignKeys.find(
    (candidate) =>
      candidate.getName() === 'builder_project_mutation_receipts_project_fk',
  )
  const receiptPrimaryKey = table.primaryKeys.find(
    (candidate) =>
      candidate.getName() === 'builder_project_mutation_receipts_pk',
  )

  assert.ok(projectForeignKey)
  assert.equal(projectForeignKey.onDelete, 'cascade')
  assert.ok(receiptPrimaryKey)
  assert.deepEqual(
    receiptPrimaryKey.columns.map((column) => column.name),
    ['project_id', 'client_mutation_id'],
  )
})

test('independently owned snapshots cannot be deleted while referenced', () => {
  for (const name of [
    'builder_projects_snapshot_hash_fk',
    'builder_project_revisions_snapshot_hash_fk',
  ]) {
    const foreignKey = [
      ...getTableConfig(builderProjects).foreignKeys,
      ...getTableConfig(builderProjectRevisions).foreignKeys,
    ].find((candidate) => candidate.getName() === name)

    assert.ok(foreignKey, `${name} must exist`)
    assert.equal(foreignKey.onDelete, 'restrict', `${name} must restrict`)
  }
})

test('a message run must belong to the same project and thread', () => {
  const runForeignKey = getTableConfig(builderProjectMessages).foreignKeys.find(
    (candidate) => candidate.getName() === 'builder_project_messages_run_fk',
  )
  assert.ok(runForeignKey)

  const reference = runForeignKey.reference()
  assert.deepEqual(
    reference.columns.map((column) => column.name),
    ['project_id', 'thread_id', 'run_id'],
  )
  assert.deepEqual(
    reference.foreignColumns.map((column) => column.name),
    ['project_id', 'thread_id', 'id'],
  )

  const runIdentity = getTableConfig(builderProjectRuns).uniqueConstraints.find(
    (candidate) =>
      candidate.getName() === 'builder_project_runs_project_thread_id_unique',
  )
  assert.ok(runIdentity)
})
