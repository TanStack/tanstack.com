import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createLocalBuilderManifestBundleFromFiles } from '../src/builder/manifest'
import type { CompileResponse, ProjectDefinition } from '../src/builder/api'
import type { LocalBuilderTimelineEvent } from '../src/builder/projection'

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(
  path.join(os.tmpdir(), 'forge-baseline-active-run-'),
)

process.chdir(runtimeRoot)

try {
  const { ensureLocalForgeBaseline } =
    await import('../src/builder/runtime/local-agent.server')
  const {
    appendLocalForgeManifestTimeline,
    appendLocalForgeTimelineEvents,
    LOCAL_FORGE_PROJECT_ID,
    LOCAL_FORGE_SESSION_ID,
    persistLocalForgeManifestBundle,
    readLocalForgeSnapshot,
    readLocalForgeTimeline,
    resetLocalForgeRuntime,
  } = await import('../src/builder/runtime/local-store.server')

  await resetLocalForgeRuntime()

  const files = {
    'package.json': `${JSON.stringify(
      {
        devDependencies: {},
        pnpm: {
          onlyBuiltDependencies: ['esbuild'],
        },
        scripts: {
          build: 'vite build',
        },
      },
      null,
      2,
    )}\n`,
    'src/routes/index.tsx':
      "import { createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('/')({ component: () => null })\n",
  }
  const bundle = await createLocalBuilderManifestBundleFromFiles({
    compile: createCompile(files),
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
    files,
    projectId: LOCAL_FORGE_PROJECT_ID,
    sessionId: LOCAL_FORGE_SESSION_ID,
  })

  await persistLocalForgeManifestBundle(bundle)
  await appendLocalForgeManifestTimeline({
    bundle,
    createdAt: bundle.manifest.createdAt,
    producerId: 'baseline-active-fixture',
    producerKind: 'system',
    runId: undefined,
  })

  const activeRunId = 'baseline-active-run'
  await appendLocalForgeTimelineEvents([
    createRunEvent({
      eventId: 'baseline-active-run-queued',
      projectId: LOCAL_FORGE_PROJECT_ID,
      runId: activeRunId,
      sessionId: LOCAL_FORGE_SESSION_ID,
      type: 'run.queued',
    }),
    createRunEvent({
      eventId: 'baseline-active-run-started',
      projectId: LOCAL_FORGE_PROJECT_ID,
      runId: activeRunId,
      sessionId: LOCAL_FORGE_SESSION_ID,
      type: 'run.started',
    }),
  ])

  const snapshotBefore = await readLocalForgeSnapshot()
  const timelineBefore = await readLocalForgeTimeline()

  assert.equal(snapshotBefore.latestRun?.status, 'running')
  assert.equal(
    snapshotBefore.files['package.json'],
    files['package.json'],
    'fixture package should require baseline support repair',
  )

  const ensuredSnapshot = await ensureLocalForgeBaseline()

  assert.equal(ensuredSnapshot.latestRun?.id, activeRunId)
  assert.deepEqual(
    await readLocalForgeTimeline(),
    timelineBefore,
    'baseline repair must not append manifest events while a run is active',
  )
  assert.equal(
    (await readLocalForgeSnapshot()).files['package.json'],
    snapshotBefore.files['package.json'],
    'baseline repair must not rewrite package.json while a run is active',
  )
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge baseline active run verifier passed')

function createCompile(files: Record<string, string>): CompileResponse {
  return {
    commands: [],
    envVars: [],
    files,
    packages: {
      dependencies: {},
      devDependencies: {},
      scripts: {
        build: 'vite build',
      },
    },
    warnings: [],
  }
}

function createRunEvent({
  eventId,
  projectId,
  runId,
  sessionId,
  type,
}: {
  eventId: string
  projectId: string
  runId: string
  sessionId: string
  type: 'run.queued' | 'run.started'
}): LocalBuilderTimelineEvent {
  return {
    createdAt: new Date().toISOString(),
    eventId,
    payload: {
      inputEventId: 'baseline-active-input',
      runId,
    },
    producer: {
      epoch: 'baseline-active-epoch',
      id: 'baseline-active-fixture',
      kind: 'system',
      seq: type === 'run.queued' ? 1 : 2,
    },
    projectId,
    runId,
    schemaVersion: 1,
    sessionId,
    type,
  }
}
