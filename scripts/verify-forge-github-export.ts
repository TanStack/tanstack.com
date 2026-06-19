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
const runtimeCwd = await mkdtemp(path.join(os.tmpdir(), 'forge-github-export-'))

try {
  process.chdir(runtimeCwd)

  const { createLocalBuilderManifestBundleFromFiles } =
    await import('../src/builder/manifest/local')
  const {
    appendLocalForgeTimelineEvents,
    createLocalForgeProducer,
    LOCAL_FORGE_PROJECT_ID,
    LOCAL_FORGE_SESSION_ID,
    persistLocalForgeManifestBundle,
    readLocalForgeSnapshot,
  } = await import('../src/builder/runtime/local-store.server')
  const { createLocalForgeGitHubExport } =
    await import('../src/builder/runtime/local-export.server')

  const definition = {
    featureOptions: {},
    features: [],
    framework: 'react',
    name: 'fixture-app',
    packageManager: 'pnpm',
    tailwind: true,
  } satisfies ProjectDefinition

  const compile = {
    commands: [],
    envVars: [],
    files: {
      'README.md': '# Fixture App\n',
      'src/routes/index.tsx': "export const Route = 'fixture'\n",
    },
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
    files: compile.files,
    projectId: LOCAL_FORGE_PROJECT_ID,
    sessionId: LOCAL_FORGE_SESSION_ID,
  })
  await persistLocalForgeManifestBundle(bundle)

  let totalBytes = 0
  for (const filePath of Object.keys(bundle.manifest.files)) {
    totalBytes += bundle.manifest.files[filePath].size
  }

  const manifestEvent: LocalBuilderTimelineEvent = {
    createdAt: bundle.manifest.createdAt,
    eventId: 'fixture-manifest-event',
    projectId: LOCAL_FORGE_PROJECT_ID,
    producer: createLocalForgeProducer({
      index: 0,
      kind: 'system',
      producerId: 'fixture',
    }),
    schemaVersion: 1,
    sessionId: LOCAL_FORGE_SESSION_ID,
    type: 'manifest.snapshotted',
    payload: {
      blobRef: 'fixture-manifest-ref',
      fileCount: Object.keys(bundle.manifest.files).length,
      manifestVersionId: bundle.manifest.manifestVersionId,
      totalBytes,
    },
  }
  await appendLocalForgeTimelineEvents([manifestEvent])

  let pushedFiles: Record<string, string> | undefined
  const github = {
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
    async pushFiles(_accessToken: string, options: PushFilesOptions) {
      pushedFiles = options.files

      return {
        commitSha: 'fixture-commit-sha',
        success: true,
      }
    },
  } satisfies LocalForgeGitHubClient

  const result = await createLocalForgeGitHubExport({
    accessToken: 'fixture-token',
    github,
    isPrivate: true,
    repoName: 'fixture-app',
  })
  const snapshot = await readLocalForgeSnapshot()
  const latestExport = snapshot.exports.at(-1)

  assert.deepEqual(pushedFiles, compile.files)
  assert.equal(result.repoUrl, 'https://github.com/fixture-owner/fixture-app')
  assert.equal(result.commitSha, 'fixture-commit-sha')
  assert.equal(latestExport?.kind, 'github')
  assert.equal(latestExport?.status, 'completed')
  assert.equal(latestExport?.repoUrl, result.repoUrl)
  assert.equal(latestExport?.commitSha, result.commitSha)

  let releaseRepositoryCreate = () => {}
  let repositoryCreateStarted = false
  let repositoryCreateCount = 0
  const lockedGithub = {
    async createRepository(
      _accessToken: string,
      options: CreateRepositoryOptions,
    ) {
      repositoryCreateStarted = true
      repositoryCreateCount += 1

      await new Promise<void>((resolve) => {
        releaseRepositoryCreate = resolve
      })

      return {
        name: options.name,
        owner: 'fixture-owner',
        repoUrl: `https://github.com/fixture-owner/${options.name}`,
        success: true,
      }
    },
    async pushFiles(_accessToken: string, options: PushFilesOptions) {
      pushedFiles = options.files

      return {
        commitSha: 'fixture-lock-commit-sha',
        success: true,
      }
    },
  } satisfies LocalForgeGitHubClient
  const firstLockedExport = createLocalForgeGitHubExport({
    accessToken: 'fixture-token',
    github: lockedGithub,
    isPrivate: true,
    manifestVersionId: bundle.manifest.manifestVersionId,
    repoName: 'fixture-app-locked',
  })

  while (!repositoryCreateStarted) {
    await delay(5)
  }

  await assert.rejects(
    createLocalForgeGitHubExport({
      accessToken: 'fixture-token',
      github: lockedGithub,
      isPrivate: true,
      manifestVersionId: bundle.manifest.manifestVersionId,
      repoName: 'fixture-app-locked',
    }),
    /A local Forge GitHub export is already active/,
  )
  assert.equal(repositoryCreateCount, 1)

  releaseRepositoryCreate()

  const lockedResult = await firstLockedExport

  assert.equal(lockedResult.commitSha, 'fixture-lock-commit-sha')
  assert.equal(repositoryCreateCount, 1)

  console.log('Forge GitHub export verifier passed')
} finally {
  process.chdir(originalCwd)
  await rm(runtimeCwd, { force: true, recursive: true })
}

function delay(delayMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}
