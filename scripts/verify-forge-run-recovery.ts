import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createLocalBuilderManifestBundleFromFiles } from '../src/builder/manifest'
import type { CompileResponse, ProjectDefinition } from '../src/builder/api'
import type { LocalBuilderTimelineEvent } from '../src/builder/projection'

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-run-recovery-'))

process.chdir(runtimeRoot)

try {
  const {
    appendLocalForgeManifestTimeline,
    appendLocalForgeTimelineEvents,
    isActiveLocalForgeRunStatus,
    LOCAL_FORGE_PROJECT_ID,
    LOCAL_FORGE_SESSION_ID,
    persistLocalForgeManifestBundle,
    readLocalForgeSnapshot,
    reconcileInterruptedLocalForgeRun,
    resetLocalForgeRuntime,
  } = await import('../src/builder/runtime/local-store.server')
  const { cancelLocalForgeAgentRun } =
    await import('../src/builder/runtime/local-agent.server')

  async function seedActiveRun({
    createdAt,
    runId,
  }: {
    createdAt: string
    runId: string
  }) {
    await resetLocalForgeRuntime()

    const bundle = await createLocalBuilderManifestBundleFromFiles({
      compile: createCompile(),
      createdAt: '2026-06-18T00:00:00.000Z',
      definition: {
        featureOptions: {},
        features: [],
        framework: 'react',
        name: 'fixture-app',
        packageManager: 'pnpm',
        tailwind: true,
      } satisfies ProjectDefinition,
      fileSource: 'builder-definition',
      files: createCompile().files,
      projectId: LOCAL_FORGE_PROJECT_ID,
      sessionId: LOCAL_FORGE_SESSION_ID,
    })

    await persistLocalForgeManifestBundle(bundle)
    await appendLocalForgeManifestTimeline({
      bundle,
      createdAt: bundle.manifest.createdAt,
      producerId: 'run-recovery-fixture',
      producerKind: 'system',
      runId: undefined,
    })

    await appendLocalForgeTimelineEvents([
      createRunEvent({
        createdAt,
        eventId: `${runId}-queued`,
        projectId: LOCAL_FORGE_PROJECT_ID,
        runId,
        seq: 1,
        sessionId: LOCAL_FORGE_SESSION_ID,
        type: 'run.queued',
      }),
      createRunEvent({
        createdAt,
        eventId: `${runId}-started`,
        projectId: LOCAL_FORGE_PROJECT_ID,
        runId,
        seq: 2,
        sessionId: LOCAL_FORGE_SESSION_ID,
        type: 'run.started',
      }),
    ])
  }

  // 1. A run started before this process booted is an orphan: reconcile fails it.
  await seedActiveRun({
    createdAt: '2026-06-18T00:00:10.000Z',
    runId: 'orphan-run',
  })
  assert.equal((await readLocalForgeSnapshot()).latestRun?.status, 'running')

  const reconciled = await reconcileInterruptedLocalForgeRun()
  assert.equal(
    isActiveLocalForgeRunStatus(reconciled.latestRun?.status ?? ''),
    false,
    'orphaned pre-boot run should be reconciled to a terminal status',
  )
  assert.equal(reconciled.latestRun?.id, 'orphan-run')

  // 2. A run started in this process is live: reconcile must leave it active.
  await seedActiveRun({
    createdAt: new Date().toISOString(),
    runId: 'live-run',
  })
  const afterLiveReconcile = await reconcileInterruptedLocalForgeRun()
  assert.equal(
    afterLiveReconcile.latestRun?.status,
    'running',
    'a freshly started run must not be reconciled away',
  )

  // 3. Force cancel writes a terminal cancelled status even with no live executor.
  await seedActiveRun({
    createdAt: new Date().toISOString(),
    runId: 'cancel-run',
  })
  const cancelled = await cancelLocalForgeAgentRun()
  assert.equal(
    cancelled.latestRun?.status,
    'cancelled',
    'cancelling an active run should mark it cancelled',
  )
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge run recovery verifier passed')

function createCompile(): CompileResponse {
  return {
    commands: [],
    envVars: [],
    files: {
      'src/routes/index.tsx':
        "import { createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('/')({ component: () => null })\n",
    },
    packages: {
      dependencies: {},
      devDependencies: {},
      scripts: {},
    },
    warnings: [],
  }
}

function createRunEvent({
  createdAt,
  eventId,
  projectId,
  runId,
  seq,
  sessionId,
  type,
}: {
  createdAt: string
  eventId: string
  projectId: string
  runId: string
  seq: number
  sessionId: string
  type: 'run.queued' | 'run.started'
}): LocalBuilderTimelineEvent {
  return {
    createdAt,
    eventId,
    producer: {
      epoch: 'run-recovery-fixture-epoch',
      id: 'run-recovery-fixture',
      kind: 'system',
      seq,
    },
    projectId,
    runId,
    schemaVersion: 1,
    sessionId,
    type,
    payload: {
      inputEventId: `${runId}-input`,
      runId,
    },
  }
}
