import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { CompileResponse, ProjectDefinition } from '../src/builder/api'
import type { LocalBuilderTimelineEvent } from '../src/builder/projection'
import type { LocalForgeGitHubClient } from '../src/builder/runtime/local-export.server'

type CreateRepositoryOptions = Parameters<
  LocalForgeGitHubClient['createRepository']
>[1]
type PushFilesOptions = Parameters<LocalForgeGitHubClient['pushFiles']>[1]

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(
  path.join(os.tmpdir(), 'forge-github-export-active-run-'),
)

process.chdir(runtimeRoot)

try {
  const { createLocalBuilderManifestBundleFromFiles } =
    await import('../src/builder/manifest/local')
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
  const { createLocalForgeGitHubExport } =
    await import('../src/builder/runtime/local-export.server')

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
    'README.md': '# Fixture App\n',
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
    producerId: 'github-export-active-run-fixture-runtime',
    producerKind: 'system',
    runId: undefined,
  })

  const activeRunId = 'github-export-active-run'

  await appendLocalForgeTimelineEvents([
    createRunEvent({
      eventId: 'github-export-active-run-input',
      projectId: LOCAL_FORGE_PROJECT_ID,
      runId: activeRunId,
      sessionId: LOCAL_FORGE_SESSION_ID,
      type: 'run.queued',
    }),
    createRunEvent({
      eventId: 'github-export-active-run-started',
      projectId: LOCAL_FORGE_PROJECT_ID,
      runId: activeRunId,
      sessionId: LOCAL_FORGE_SESSION_ID,
      type: 'run.started',
    }),
  ])

  let createRepositoryCount = 0
  let pushFilesCount = 0
  const github = {
    async createRepository(
      _accessToken: string,
      options: CreateRepositoryOptions,
    ) {
      createRepositoryCount += 1

      return {
        name: options.name,
        owner: 'fixture-owner',
        repoUrl: `https://github.com/fixture-owner/${options.name}`,
        success: true,
      }
    },
    async pushFiles(_accessToken: string, _options: PushFilesOptions) {
      pushFilesCount += 1

      return {
        commitSha: 'fixture-commit-sha',
        success: true,
      }
    },
  } satisfies LocalForgeGitHubClient

  const timelineBeforeExport = await readLocalForgeTimeline()
  const snapshotBeforeExport = await readLocalForgeSnapshot()

  await assert.rejects(
    createLocalForgeGitHubExport({
      accessToken: 'fixture-token',
      github,
      isPrivate: true,
      manifestVersionId: bundle.manifest.manifestVersionId,
      repoName: 'fixture-app',
    }),
    /Cannot export the local Forge workspace to GitHub while Forge run github-export-active-run is running\./,
  )

  assert.equal(
    createRepositoryCount,
    0,
    'rejected GitHub export must not create a repository',
  )
  assert.equal(pushFilesCount, 0, 'rejected GitHub export must not push files')
  assert.deepEqual(
    await readLocalForgeTimeline(),
    timelineBeforeExport,
    'rejected GitHub export must not append timeline events',
  )
  assert.deepEqual(
    await readLocalForgeSnapshot(),
    snapshotBeforeExport,
    'rejected GitHub export must not append projected state',
  )
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge GitHub export active run verifier passed')

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
    producer: {
      epoch: 'github-export-active-run-fixture-epoch',
      id: 'github-export-active-run-fixture-runtime',
      kind: 'system',
      seq: 1,
    },
    projectId,
    runId,
    schemaVersion: 1,
    sessionId,
    type,
    payload: {
      inputEventId: 'github-export-active-run-input',
      runId,
    },
  }
}
