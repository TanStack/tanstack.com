import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  createLocalBuilderManifestBundleFromFiles,
  getLocalManifestFiles,
} from '../src/builder/manifest'
import type { CompileResponse, ProjectDefinition } from '../src/builder/api'
import type { BuilderManifestFile } from '../src/builder/schema'

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-system-'))

process.chdir(runtimeRoot)

try {
  const {
    getLocalForgeCurrentWorkspaceDir,
    persistLocalForgeManifestBundle,
    readLocalForgeBlob,
    readLocalForgeManifest,
    readLocalForgeTimeline,
    resetLocalForgeRuntime,
  } = await import('../src/builder/runtime/local-store.server')
  const { snapshotLocalForgeSystemGeneratedFiles } =
    await import('../src/builder/runtime/local-materialize.server')

  await resetLocalForgeRuntime()
  const workspaceDir = getLocalForgeCurrentWorkspaceDir()

  const definition = {
    featureOptions: {},
    features: [],
    framework: 'react',
    name: 'fixture-app',
    packageManager: 'pnpm',
    tailwind: true,
  } satisfies ProjectDefinition
  const files = {
    'src/router.tsx': 'export const router = null\n',
    'src/routes/__root.tsx': 'export const Route = null\n',
    'src/routes/index.tsx': 'export const Route = null\n',
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
    projectId: 'fixture-project',
    sessionId: 'fixture-session',
  })

  await persistLocalForgeManifestBundle(bundle)
  await mkdir(path.join(workspaceDir, 'src'), {
    recursive: true,
  })
  await writeFile(
    path.join(workspaceDir, 'pnpm-workspace.yaml'),
    ['packages:', '  - .', 'onlyBuiltDependencies:', '  - esbuild', ''].join(
      '\n',
    ),
    'utf8',
  )
  await writeFile(
    path.join(workspaceDir, 'src/routeTree.gen.ts'),
    'export const routeTree = {};\n',
    'utf8',
  )

  const nextManifest = await snapshotLocalForgeSystemGeneratedFiles({
    manifest: bundle.manifest,
    runId: 'fixture-run',
    startedAt: Date.now(),
  })
  const persistedManifest = await readLocalForgeManifest(
    nextManifest.manifestVersionId,
  )
  const timeline = await readLocalForgeTimeline()
  const nextManifestFiles: Array<BuilderManifestFile> = Object.values(
    nextManifest.files,
  )
  const nextFiles = getLocalManifestFiles({
    blobs: Object.fromEntries(
      await Promise.all(
        nextManifestFiles.map(async (file) => {
          const blob = await readLocalForgeBlob(file.blobRef)
          return [blob.blobRef, blob] as const
        }),
      ),
    ),
    manifest: nextManifest,
  })

  assert.notEqual(
    nextManifest.manifestVersionId,
    bundle.manifest.manifestVersionId,
    'changed system files should create a new manifest version',
  )
  assert.equal(persistedManifest.files['pnpm-workspace.yaml']?.source, 'system')
  assert.equal(
    persistedManifest.files['src/routeTree.gen.ts']?.source,
    'system',
  )
  assert.equal(
    persistedManifest.files['src/routes/index.tsx']?.source,
    'builder-definition',
  )
  assert.equal(
    nextFiles['src/routeTree.gen.ts'],
    'export const routeTree = {};\n',
  )
  assert.equal(
    timeline.some((event) => event.type === 'manifest.snapshotted'),
    true,
    'system snapshot should append a manifest event',
  )
  assert.equal(
    timeline.filter(
      (event) =>
        event.type === 'file.upserted' &&
        (event.payload.file.path === 'pnpm-workspace.yaml' ||
          event.payload.file.path === 'src/routeTree.gen.ts') &&
        event.payload.file.source === 'system',
    ).length,
    2,
    'system files should be appended as system file events',
  )
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge system snapshot verifier passed')
