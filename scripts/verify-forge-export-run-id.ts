import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createLocalBuilderManifestBundleFromFiles } from '../src/builder/manifest'
import type { CompileResponse, ProjectDefinition } from '../src/builder/api'
import type { LocalBuilderTimelineEvent } from '../src/builder/projection'
import type { LocalForgeGitHubClient } from '../src/builder/runtime/local-export.server'

type CreateRepositoryOptions = Parameters<
  LocalForgeGitHubClient['createRepository']
>[1]
type PushFilesOptions = Parameters<LocalForgeGitHubClient['pushFiles']>[1]

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(
  path.join(os.tmpdir(), 'forge-export-run-id-'),
)
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
  const {
    appendLocalForgeManifestTimeline,
    appendLocalForgeTimelineEvents,
    LOCAL_FORGE_PROJECT_ID,
    LOCAL_FORGE_SESSION_ID,
    persistLocalForgeManifestBundle,
    readLocalForgeTimeline,
    resetLocalForgeRuntime,
  } = await import('../src/builder/runtime/local-store.server')
  const { createLocalForgeGitHubExport, createLocalForgeZipExport } =
    await import('../src/builder/runtime/local-export.server')

  await resetLocalForgeRuntime()

  const completedRunId = 'export-source-agent-run'
  const files = {
    'README.md': '# Fixture App\n',
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
      eventId: 'export-source-run-queued',
      runId: completedRunId,
      type: 'run.queued',
    }),
    createRunEvent({
      eventId: 'export-source-run-started',
      runId: completedRunId,
      type: 'run.started',
    }),
    createRunFinishedEvent({
      eventId: 'export-source-run-finished',
      runId: completedRunId,
    }),
  ])
  await appendLocalForgeManifestTimeline({
    bundle,
    createdAt: bundle.manifest.createdAt,
    producerId: 'export-run-id-fixture',
    producerKind: 'agent',
    runId: completedRunId,
  })

  const beforeZipExport = await readLocalForgeTimeline()
  const zipResult = await createLocalForgeZipExport({
    manifestVersionId: bundle.manifest.manifestVersionId,
  })
  const zipEvents = (await readLocalForgeTimeline()).slice(
    beforeZipExport.length,
  )
  const zipRunIds = new Set(
    zipEvents
      .map((event) => event.runId)
      .filter((runId): runId is string => typeof runId === 'string'),
  )

  assert.equal(zipResult.manifestVersionId, bundle.manifest.manifestVersionId)
  assert.equal(
    zipRunIds.has(completedRunId),
    false,
    'ZIP export must not append events to the terminal agent run',
  )
  assert.equal(zipRunIds.size, 1)
  assert.match([...zipRunIds][0] ?? '', /^local-export-/)

  const beforeGitHubExport = await readLocalForgeTimeline()
  const github = createFixtureGitHubClient()
  const githubResult = await createLocalForgeGitHubExport({
    accessToken: 'fixture-token',
    github,
    isPrivate: true,
    manifestVersionId: bundle.manifest.manifestVersionId,
    repoName: 'fixture-app',
  })
  const githubEvents = (await readLocalForgeTimeline()).slice(
    beforeGitHubExport.length,
  )
  const githubRunIds = new Set(
    githubEvents
      .map((event) => event.runId)
      .filter((runId): runId is string => typeof runId === 'string'),
  )

  assert.equal(
    githubResult.manifestVersionId,
    bundle.manifest.manifestVersionId,
  )
  assert.equal(githubResult.commitSha, 'fixture-commit-sha')
  assert.equal(
    githubRunIds.has(completedRunId),
    false,
    'GitHub export must not append events to the terminal agent run',
  )
  assert.equal(githubRunIds.size, 1)
  assert.match([...githubRunIds][0] ?? '', /^local-export-/)
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge export run id verifier passed')

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

function createFixtureGitHubClient(): LocalForgeGitHubClient {
  return {
    async createRepository(
      _accessToken: string,
      options: CreateRepositoryOptions,
    ) {
      return {
        name: options.name,
        owner: 'fixture-owner',
        repoUrl: `https://github.com/fixture-owner/${options.name}`,
        success: true,
      }
    },
    async pushFiles(_accessToken: string, _options: PushFilesOptions) {
      return {
        commitSha: 'fixture-commit-sha',
        success: true,
      }
    },
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
    createdAt: new Date().toISOString(),
    eventId,
    producer: producer(type === 'run.queued' ? 0 : 1),
    projectId: 'local-project',
    runId,
    schemaVersion: 1,
    sessionId: 'local-session',
    type,
    payload: {
      inputEventId: 'export-source-input',
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
    epoch: 'export-run-id-fixture',
    id: 'export-run-id-fixture',
    kind: 'system' as const,
    seq: index + 1,
  }
}
