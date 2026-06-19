import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createLocalBuilderManifestBundleFromFiles } from '../src/builder/manifest'
import type { CompileResponse, ProjectDefinition } from '../src/builder/api'
import type { LocalBuilderTimelineEvent } from '../src/builder/projection'

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-validation-'))

process.chdir(runtimeRoot)

try {
  const {
    appendLocalForgeManifestTimeline,
    appendLocalForgeTimelineEvents,
    LOCAL_FORGE_PROJECT_ID,
    LOCAL_FORGE_SESSION_ID,
    persistLocalForgeManifestBundle,
    readLocalForgeTimeline,
    resetLocalForgeRuntime,
  } = await import('../src/builder/runtime/local-store.server')
  const { materializeLatestLocalForgeManifest } =
    await import('../src/builder/runtime/local-materialize.server')

  await resetLocalForgeRuntime()

  const definition = {
    featureOptions: {},
    features: [],
    framework: 'react',
    name: 'fixture-app',
    packageManager: 'pnpm',
    tailwind: true,
  } satisfies ProjectDefinition
  const files = {
    'src/routes/index.tsx':
      "import { createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('/')({ component: () => null })\n",
  }
  const compile = {
    commands: [],
    envVars: [],
    files,
    packages: {
      dependencies: {},
      devDependencies: {},
      scripts: {},
    },
    warnings: [],
  } satisfies CompileResponse
  const bundle = await createLocalBuilderManifestBundleFromFiles({
    compile,
    createdAt: '2026-06-18T00:00:00.000Z',
    definition,
    fileSource: 'builder-definition',
    files,
    projectId: LOCAL_FORGE_PROJECT_ID,
    sessionId: LOCAL_FORGE_SESSION_ID,
  })

  await persistLocalForgeManifestBundle(bundle)
  await appendLocalForgeManifestTimeline({
    bundle,
    createdAt: bundle.manifest.createdAt,
    producerId: 'validation-fixture-runtime',
    producerKind: 'system',
    runId: undefined,
  })
  const activeRunId = 'validation-active-run'
  await appendLocalForgeTimelineEvents([
    createRunEvent({
      eventId: 'validation-active-run-input',
      projectId: LOCAL_FORGE_PROJECT_ID,
      runId: activeRunId,
      sessionId: LOCAL_FORGE_SESSION_ID,
      type: 'run.queued',
    }),
    createRunEvent({
      eventId: 'validation-active-run-started',
      projectId: LOCAL_FORGE_PROJECT_ID,
      runId: activeRunId,
      sessionId: LOCAL_FORGE_SESSION_ID,
      type: 'run.started',
    }),
  ])

  const timelineBeforeValidation = await readLocalForgeTimeline()

  await assert.rejects(
    materializeLatestLocalForgeManifest(),
    /Cannot validate the local Forge workspace while Forge run validation-active-run is running\./,
  )

  assert.deepEqual(
    await readLocalForgeTimeline(),
    timelineBeforeValidation,
    'rejected validation must not append workflow or manifest events',
  )
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge validation active run verifier passed')

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
    createdAt:
      type === 'run.queued'
        ? '2026-06-18T00:00:01.000Z'
        : '2026-06-18T00:00:02.000Z',
    eventId,
    producer: {
      epoch: 'validation-fixture-epoch',
      id: 'validation-fixture-runtime',
      kind: 'system',
      seq: 1,
    },
    projectId,
    runId,
    schemaVersion: 1,
    sessionId,
    type,
    payload: {
      inputEventId: 'validation-input',
      runId,
    },
  }
}
