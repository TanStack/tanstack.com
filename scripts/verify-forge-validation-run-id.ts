import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createLocalBuilderManifestBundleFromFiles } from '../src/builder/manifest'
import type { CompileResponse, ProjectDefinition } from '../src/builder/api'
import type { LocalBuilderTimelineEvent } from '../src/builder/projection'

const originalCwd = process.cwd()
const originalPath = process.env.PATH
const runtimeRoot = await mkdtemp(
  path.join(os.tmpdir(), 'forge-validation-run-id-'),
)
const fakeBinDir = path.join(runtimeRoot, 'bin')
const definition = {
  featureOptions: {},
  features: [],
  framework: 'react',
  name: 'fixture-app',
  packageManager: 'pnpm',
  tailwind: true,
} satisfies ProjectDefinition

process.chdir(runtimeRoot)

try {
  await mkdir(fakeBinDir, { recursive: true })
  await writeFile(
    path.join(fakeBinDir, 'pnpm'),
    ['#!/usr/bin/env sh', 'exit 0', ''].join('\n'),
    'utf8',
  )
  await chmod(path.join(fakeBinDir, 'pnpm'), 0o755)
  process.env.PATH = `${fakeBinDir}${path.delimiter}${originalPath ?? ''}`

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

  const completedRunId = 'validation-source-agent-run'
  const files = {
    'package.json': `${JSON.stringify(
      {
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
    createdByRunId: completedRunId,
    definition,
    fileSource: 'agent',
    files,
    projectId: LOCAL_FORGE_PROJECT_ID,
    sessionId: LOCAL_FORGE_SESSION_ID,
  })

  await persistLocalForgeManifestBundle(bundle)
  await appendLocalForgeTimelineEvents([
    createRunEvent({
      eventId: 'validation-source-run-queued',
      runId: completedRunId,
      type: 'run.queued',
    }),
    createRunEvent({
      eventId: 'validation-source-run-started',
      runId: completedRunId,
      type: 'run.started',
    }),
    createRunFinishedEvent({
      eventId: 'validation-source-run-finished',
      runId: completedRunId,
    }),
  ])
  await appendLocalForgeManifestTimeline({
    bundle,
    createdAt: bundle.manifest.createdAt,
    producerId: 'validation-run-id-fixture',
    producerKind: 'agent',
    runId: completedRunId,
  })

  const timelineBeforeValidation = await readLocalForgeTimeline()
  const result = await materializeLatestLocalForgeManifest()
  const appendedEvents = (await readLocalForgeTimeline()).slice(
    timelineBeforeValidation.length,
  )
  const appendedRunIds = new Set(
    appendedEvents
      .map((event) => event.runId)
      .filter((runId): runId is string => typeof runId === 'string'),
  )
  const validationRunId = result.runId

  assert.match(validationRunId, /^local-validation-/)
  assert.equal(
    appendedRunIds.has(completedRunId),
    false,
    'manual validation must not append new events to the terminal agent run',
  )
  assert.equal(
    appendedRunIds.has(validationRunId),
    true,
    'manual validation should append workflow events under its validation id',
  )
  assert.equal(
    appendedEvents.some(
      (event) =>
        event.type === 'manifest.snapshotted' &&
        event.runId === validationRunId,
    ),
    true,
    'system snapshot manifest should be attributed to the validation id',
  )
} finally {
  process.chdir(originalCwd)

  if (originalPath === undefined) {
    delete process.env.PATH
  } else {
    process.env.PATH = originalPath
  }

  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge validation run id verifier passed')

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
  runId,
  type,
}: {
  eventId: string
  runId: string
  type: 'run.queued' | 'run.started'
}): LocalBuilderTimelineEvent {
  return {
    createdAt:
      type === 'run.queued'
        ? '2026-06-18T00:00:01.000Z'
        : '2026-06-18T00:00:02.000Z',
    eventId,
    producer: producer(type === 'run.queued' ? 0 : 1),
    projectId: 'local-project',
    runId,
    schemaVersion: 1,
    sessionId: 'local-session',
    type,
    payload: {
      inputEventId: 'validation-source-input',
      runId,
    },
  }
}

function createRunFinishedEvent({
  eventId,
  runId,
}: {
  eventId: string
  runId: string
}): LocalBuilderTimelineEvent {
  return {
    createdAt: '2026-06-18T00:00:03.000Z',
    eventId,
    producer: producer(2),
    projectId: 'local-project',
    runId,
    schemaVersion: 1,
    sessionId: 'local-session',
    type: 'run.finished',
    payload: {
      runId,
      status: 'finished',
    },
  }
}

function producer(index: number) {
  return {
    epoch: 'validation-run-id-fixture',
    id: 'validation-run-id-fixture',
    kind: 'system' as const,
    seq: index + 1,
  }
}
