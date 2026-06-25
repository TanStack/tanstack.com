import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createLocalBuilderManifestBundleFromFiles } from '../src/builder/manifest'
import type { CompileResponse, ProjectDefinition } from '../src/builder/api'
import type { LocalBuilderTimelineEvent } from '../src/builder/projection'

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(
  path.join(os.tmpdir(), 'forge-zip-export-active-run-'),
)

process.chdir(runtimeRoot)

try {
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
  const { createLocalForgeZipExport } =
    await import('../src/builder/runtime/local-export.server')

  await resetLocalForgeRuntime()

  const files = {
    'README.md': '# Fixture App\n',
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
    producerId: 'zip-export-active-run-fixture',
    producerKind: 'system',
    runId: undefined,
  })

  const activeRunId = 'zip-export-active-run'
  await appendLocalForgeTimelineEvents([
    createRunEvent({
      eventId: 'zip-export-active-run-queued',
      projectId: LOCAL_FORGE_PROJECT_ID,
      runId: activeRunId,
      sessionId: LOCAL_FORGE_SESSION_ID,
      type: 'run.queued',
    }),
    createRunEvent({
      eventId: 'zip-export-active-run-started',
      projectId: LOCAL_FORGE_PROJECT_ID,
      runId: activeRunId,
      sessionId: LOCAL_FORGE_SESSION_ID,
      type: 'run.started',
    }),
  ])

  const timelineBeforeExport = await readLocalForgeTimeline()
  const snapshotBeforeExport = await readLocalForgeSnapshot()

  await assert.rejects(
    createLocalForgeZipExport({
      manifestVersionId: bundle.manifest.manifestVersionId,
    }),
    /Cannot export the local Forge workspace as a ZIP while Forge run zip-export-active-run is running\./,
  )
  assert.deepEqual(
    await readLocalForgeTimeline(),
    timelineBeforeExport,
    'rejected ZIP export must not append timeline events',
  )
  assert.deepEqual(
    await readLocalForgeSnapshot(),
    snapshotBeforeExport,
    'rejected ZIP export must not append projected state',
  )
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge ZIP export active run verifier passed')

function createCompile(files: Record<string, string>): CompileResponse {
  return {
    commands: [],
    envVars: [],
    files,
    packages: {
      dependencies: {},
      devDependencies: {},
      scripts: {},
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
      inputEventId: 'zip-export-active-run-input',
      runId,
    },
    producer: {
      epoch: 'zip-export-active-run-epoch',
      id: 'zip-export-active-run-fixture',
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
