import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { CompileResponse, ProjectDefinition } from '../src/builder/api'
import type { LocalForgeGitHubClient } from '../src/builder/runtime/local-export.server'

type CreateRepositoryOptions = Parameters<
  LocalForgeGitHubClient['createRepository']
>[1]
type PushFilesOptions = Parameters<LocalForgeGitHubClient['pushFiles']>[1]

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(
  path.join(os.tmpdir(), 'forge-export-path-safety-'),
)

process.chdir(runtimeRoot)

try {
  const { createLocalBuilderManifestBundleFromFiles } =
    await import('../src/builder/manifest/local')
  const {
    appendLocalForgeManifestTimeline,
    LOCAL_FORGE_PROJECT_ID,
    LOCAL_FORGE_SESSION_ID,
    persistLocalForgeManifestBundle,
    readLocalForgeSnapshot,
    resetLocalForgeRuntime,
  } = await import('../src/builder/runtime/local-store.server')
  const {
    assertSafeManifestExportPath,
    createLocalForgeGitHubExport,
    createLocalForgeZipArchive,
  } = await import('../src/builder/runtime/local-export.server')

  await resetLocalForgeRuntime()

  assert.doesNotThrow(() =>
    assertSafeManifestExportPath('src/routes/index.tsx'),
  )
  assert.throws(
    () => assertSafeManifestExportPath('../escape.txt'),
    /not a safe manifest export path/,
  )
  assert.throws(
    () => assertSafeManifestExportPath('src//routes/index.tsx'),
    /not a safe manifest export path/,
  )

  const definition = {
    featureOptions: {},
    features: [],
    framework: 'react',
    name: 'unsafe-export-app',
    packageManager: 'pnpm',
    tailwind: true,
  } satisfies ProjectDefinition
  const files = {
    '../escape.txt': 'escape\n',
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
    producerId: 'export-path-safety-fixture',
    producerKind: 'system',
    runId: undefined,
  })

  await assert.rejects(
    createLocalForgeZipArchive({
      manifestVersionId: bundle.manifest.manifestVersionId,
    }),
    /not a safe manifest export path/,
  )

  let repositoryCreateCount = 0
  const github = {
    async createRepository(
      _accessToken: string,
      options: CreateRepositoryOptions,
    ) {
      repositoryCreateCount += 1

      return {
        name: options.name,
        owner: 'fixture-owner',
        repoUrl: `https://github.com/fixture-owner/${options.name}`,
        success: true,
      }
    },
    async pushFiles(_accessToken: string, _options: PushFilesOptions) {
      return {
        commitSha: 'unsafe-export-sha',
        success: true,
      }
    },
  } satisfies LocalForgeGitHubClient

  await assert.rejects(
    createLocalForgeGitHubExport({
      accessToken: 'fixture-token',
      github,
      isPrivate: true,
      manifestVersionId: bundle.manifest.manifestVersionId,
      repoName: 'unsafe-export-app',
    }),
    /not a safe manifest export path/,
  )

  const snapshot = await readLocalForgeSnapshot()
  const latestExport = snapshot.exports.at(-1)

  assert.equal(
    repositoryCreateCount,
    0,
    'GitHub repository should not be created for unsafe manifest paths',
  )
  assert.equal(latestExport?.kind, 'github')
  assert.equal(latestExport?.status, 'failed')
  assert.match(latestExport?.error ?? '', /not a safe manifest export path/)
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge export path safety verifier passed')
