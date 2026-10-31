import assert from 'node:assert/strict'
import test from 'node:test'
import {
  settleBuilderProjectBootstrap,
  settleBuilderProjectRevisionHydration,
} from '../src/utils/builder-project-bootstrap.client'
import type { BuilderProjectSyncProject } from '../src/utils/builder-project-sync'

const projectId = '11111111-1111-4111-8111-111111111111'

function createSyncedProject(
  revision: number,
  snapshotHash: string,
): BuilderProjectSyncProject {
  return {
    id: projectId,
    ownerId: '22222222-2222-4222-8222-222222222222',
    forkedFromId: null,
    title: `Revision ${revision}`,
    description: '',
    snapshotHash,
    currentRevisionId:
      revision === 2
        ? '33333333-3333-4333-8333-333333333333'
        : '44444444-4444-4444-8444-444444444444',
    currentRevisionNumber: revision,
    lastEventSequence: revision,
    createdAt: '2026-08-20T12:00:00.000Z',
    updatedAt: `2026-08-20T12:00:0${revision}.000Z`,
  }
}

test('Builder bootstrap commits only a snapshot paired with the settled synced revision', async () => {
  const revisionB = createSyncedProject(2, 'b'.repeat(64))
  const revisionC = createSyncedProject(3, 'c'.repeat(64))
  let syncedProject = revisionB
  const loadedRevisions: number[] = []
  const reconciledRevisions: number[] = []
  const commits: Array<{ revision: number; snapshot: string }> = []

  await settleBuilderProjectBootstrap({
    getSyncedProject: () => syncedProject,
    getLocalVersion: () => 0,
    isActive: () => true,
    async loadSnapshot(project) {
      loadedRevisions.push(project.currentRevisionNumber)
      if (project === revisionB) syncedProject = revisionC
      return `snapshot-${project.snapshotHash}`
    },
    async reconcileWorkingCopy(project) {
      reconciledRevisions.push(project.currentRevisionNumber)
      return { status: 'none' as const }
    },
    commit({ project, snapshot }) {
      commits.push({
        revision: project.currentRevisionNumber,
        snapshot,
      })
    },
  })

  assert.deepEqual(loadedRevisions, [2, 3])
  assert.deepEqual(reconciledRevisions, [2, 3])
  assert.deepEqual(commits, [
    { revision: 3, snapshot: `snapshot-${revisionC.snapshotHash}` },
  ])
})

test('Builder bootstrap re-reconciles when a local edit lands during hydration', async () => {
  const syncedProject = createSyncedProject(2, 'b'.repeat(64))
  let localVersion = 0
  let reconciliationCount = 0
  const commits: string[] = []

  await settleBuilderProjectBootstrap({
    getSyncedProject: () => syncedProject,
    getLocalVersion: () => localVersion,
    isActive: () => true,
    async loadSnapshot(project) {
      return `snapshot-${project.snapshotHash}`
    },
    async reconcileWorkingCopy() {
      reconciliationCount += 1
      if (reconciliationCount === 1) {
        localVersion += 1
        return { status: 'none' as const }
      }
      return { status: 'ready' as const }
    },
    commit({ workingCopy }) {
      commits.push(workingCopy.status)
    },
  })

  assert.equal(reconciliationCount, 2)
  assert.deepEqual(commits, ['ready'])
})

test('live revision hydration retains an edit made while its snapshot loads', async () => {
  const syncedProject = createSyncedProject(2, 'b'.repeat(64))
  let localVersion = 0
  let visibleSnapshot = 'local edit'
  let releaseSnapshot: (() => void) | undefined
  const snapshotReady = new Promise<void>((resolve) => {
    releaseSnapshot = resolve
  })
  let conflict = false

  const hydration = settleBuilderProjectRevisionHydration({
    project: syncedProject,
    getLocalVersion: () => localVersion,
    getSyncedProject: () => syncedProject,
    isActive: () => true,
    async loadSnapshot() {
      await snapshotReady
      return 'remote snapshot'
    },
    onLocalChange() {
      conflict = true
    },
    commit({ snapshot }) {
      visibleSnapshot = snapshot
    },
  })

  localVersion += 1
  releaseSnapshot?.()
  await hydration

  assert.equal(conflict, true)
  assert.equal(visibleSnapshot, 'local edit')
})

test('live revision hydration retains the workspace when an AI transaction starts', async () => {
  const syncedProject = createSyncedProject(2, 'b'.repeat(64))
  let localWorkspaceVersion = 0
  let visibleSnapshot = 'AI working snapshot'
  let releaseSnapshot: (() => void) | undefined
  const snapshotReady = new Promise<void>((resolve) => {
    releaseSnapshot = resolve
  })
  let conflict = false

  const hydration = settleBuilderProjectRevisionHydration({
    project: syncedProject,
    getLocalVersion: () => localWorkspaceVersion,
    getSyncedProject: () => syncedProject,
    isActive: () => true,
    async loadSnapshot() {
      await snapshotReady
      return 'remote snapshot'
    },
    onLocalChange() {
      conflict = true
    },
    commit({ snapshot }) {
      visibleSnapshot = snapshot
    },
  })

  localWorkspaceVersion += 1
  releaseSnapshot?.()
  await hydration

  assert.equal(conflict, true)
  assert.equal(visibleSnapshot, 'AI working snapshot')
})
