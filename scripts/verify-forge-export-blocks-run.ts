import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createLocalBuilderManifestBundleFromFiles } from '../src/builder/manifest'
import type { CompileResponse, ProjectDefinition } from '../src/builder/api'
import type { LocalForgeGitHubClient } from '../src/builder/runtime/local-export.server'

type CreateRepositoryOptions = Parameters<
  LocalForgeGitHubClient['createRepository']
>[1]
type PushFilesOptions = Parameters<LocalForgeGitHubClient['pushFiles']>[1]

const originalAnthropicApiKey = process.env.ANTHROPIC_API_KEY
const originalCwd = process.cwd()
const originalOpenAiApiKey = process.env.OPENAI_API_KEY
const runtimeRoot = await mkdtemp(
  path.join(os.tmpdir(), 'forge-export-blocks-run-'),
)

delete process.env.ANTHROPIC_API_KEY
delete process.env.OPENAI_API_KEY
process.chdir(runtimeRoot)

let releaseCreateRepository = () => {}
let exportPromise: Promise<unknown> | undefined

try {
  const { startLocalForgeAgentRun } =
    await import('../src/builder/runtime/local-agent.server')
  const {
    appendLocalForgeManifestTimeline,
    LOCAL_FORGE_PROJECT_ID,
    LOCAL_FORGE_SESSION_ID,
    persistLocalForgeManifestBundle,
    readLocalForgeTimeline,
    resetLocalForgeRuntime,
  } = await import('../src/builder/runtime/local-store.server')
  const { createLocalForgeGitHubExport } =
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
    producerId: 'export-blocks-run-fixture',
    producerKind: 'system',
    runId: undefined,
  })

  let createRepositoryStarted = false
  const github = {
    async createRepository(
      _accessToken: string,
      options: CreateRepositoryOptions,
    ) {
      createRepositoryStarted = true
      await new Promise<void>((resolve) => {
        releaseCreateRepository = resolve
      })

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
  } satisfies LocalForgeGitHubClient

  exportPromise = createLocalForgeGitHubExport({
    accessToken: 'fixture-token',
    github,
    isPrivate: true,
    manifestVersionId: bundle.manifest.manifestVersionId,
    repoName: 'fixture-app',
  })

  while (!createRepositoryStarted) {
    await delay(5)
  }

  const timelineBeforeRejectedRun = await readLocalForgeTimeline()

  await assert.rejects(
    startLocalForgeAgentRun({
      clientRequestId: 'blocked-run-request',
      prompt: 'Build while export is active',
    }),
    /A local Forge workflow is already active\./,
  )
  assert.deepEqual(
    await readLocalForgeTimeline(),
    timelineBeforeRejectedRun,
    'run rejected by active export must not append input or run events',
  )

  releaseCreateRepository()

  await exportPromise

  const finalTimeline = await readLocalForgeTimeline()
  const blockedInputEventIds = new Set(
    finalTimeline
      .filter(
        (event) =>
          event.type === 'session.input.received' &&
          event.payload.clientRequestId === 'blocked-run-request',
      )
      .map((event) => event.eventId),
  )

  assert.equal(
    blockedInputEventIds.size,
    0,
    'blocked run input must never be persisted',
  )
  assert.equal(
    finalTimeline.some(
      (event) =>
        (event.type === 'run.queued' || event.type === 'run.started') &&
        blockedInputEventIds.has(event.payload.inputEventId),
    ),
    false,
    'blocked run boundaries must never be persisted',
  )
} finally {
  releaseCreateRepository()

  if (exportPromise) {
    await exportPromise.catch(() => {})
  }

  process.chdir(originalCwd)

  restoreEnvVar('ANTHROPIC_API_KEY', originalAnthropicApiKey)
  restoreEnvVar('OPENAI_API_KEY', originalOpenAiApiKey)

  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge export blocks run verifier passed')

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

function delay(delayMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

function restoreEnvVar(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}
