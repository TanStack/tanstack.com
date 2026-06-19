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
const runtimeCwd = await mkdtemp(
  path.join(os.tmpdir(), 'forge-github-export-branch-'),
)

try {
  process.chdir(runtimeCwd)

  const { createLocalBuilderManifestBundleFromFiles } =
    await import('../src/builder/manifest/local')
  const { validateBranchName, validateRepoName } =
    await import('../src/utils/github-validation')
  const {
    appendLocalForgeTimelineEvents,
    createLocalForgeProducer,
    LOCAL_FORGE_PROJECT_ID,
    LOCAL_FORGE_SESSION_ID,
    persistLocalForgeManifestBundle,
    readLocalForgeSnapshot,
    readLocalForgeTimeline,
  } = await import('../src/builder/runtime/local-store.server')
  const { createLocalForgeGitHubExport } =
    await import('../src/builder/runtime/local-export.server')

  for (const branch of [
    'main',
    'feature/forge-export',
    'release-2026.06',
    'tanner/fix_1',
  ]) {
    assert.equal(validateBranchName(branch).valid, true)
  }

  for (const branch of [
    '',
    'bad branch',
    'feature//empty',
    'feature/.hidden',
    'feature/locked.lock',
    'feature..double-dot',
    '@',
    'feature/@{reserved',
    'feature\\backslash',
    '-leading-hyphen',
    'trailing-period.',
  ]) {
    assert.equal(validateBranchName(branch).valid, false)
  }

  for (const repoName of [
    'forge-local-app',
    'tanstack_forge',
    'tanstack.forge',
    'tanstack-forge',
  ]) {
    assert.equal(validateRepoName(repoName).valid, true)
  }

  for (const repoName of [
    '',
    '.hidden',
    '-leading-hyphen',
    'bad repo',
    'owner/repo',
    'CON',
  ]) {
    assert.equal(validateRepoName(repoName).valid, false)
  }

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

  let createRepositoryCount = 0
  let pushFilesCount = 0
  let pushedBranch: string | undefined
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
    async pushFiles(_accessToken: string, options: PushFilesOptions) {
      pushFilesCount += 1
      pushedBranch = options.branch

      return {
        commitSha: 'fixture-commit-sha',
        success: true,
      }
    },
  } satisfies LocalForgeGitHubClient

  const beforeTimeline = await readLocalForgeTimeline()
  const beforeSnapshot = await readLocalForgeSnapshot()

  await assert.rejects(
    createLocalForgeGitHubExport({
      accessToken: 'fixture-token',
      branch: 'bad branch',
      github,
      isPrivate: true,
      repoName: 'fixture-app-invalid-branch',
    }),
    /Branch name/,
  )

  const afterRejectedTimeline = await readLocalForgeTimeline()
  const afterRejectedSnapshot = await readLocalForgeSnapshot()

  assert.equal(createRepositoryCount, 0)
  assert.equal(pushFilesCount, 0)
  assert.equal(afterRejectedTimeline.length, beforeTimeline.length)
  assert.equal(
    afterRejectedSnapshot.exports.length,
    beforeSnapshot.exports.length,
  )

  await assert.rejects(
    createLocalForgeGitHubExport({
      accessToken: 'fixture-token',
      branch: 'main',
      github,
      isPrivate: true,
      repoName: 'bad repo',
    }),
    /Repository name/,
  )

  const afterRejectedRepoTimeline = await readLocalForgeTimeline()
  const afterRejectedRepoSnapshot = await readLocalForgeSnapshot()

  assert.equal(createRepositoryCount, 0)
  assert.equal(pushFilesCount, 0)
  assert.equal(afterRejectedRepoTimeline.length, beforeTimeline.length)
  assert.equal(
    afterRejectedRepoSnapshot.exports.length,
    beforeSnapshot.exports.length,
  )

  const result = await createLocalForgeGitHubExport({
    accessToken: 'fixture-token',
    branch: 'feature/forge-export',
    github,
    isPrivate: true,
    repoName: 'fixture-app-valid-branch',
  })

  assert.equal(createRepositoryCount, 1)
  assert.equal(pushFilesCount, 1)
  assert.equal(pushedBranch, 'feature/forge-export')
  assert.equal(result.branch, 'feature/forge-export')
  assert.equal(
    result.repoUrl,
    'https://github.com/fixture-owner/fixture-app-valid-branch',
  )

  console.log('Forge GitHub export branch validation verifier passed')
} finally {
  process.chdir(originalCwd)
  await rm(runtimeCwd, { force: true, recursive: true })
}
