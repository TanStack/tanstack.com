import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import type { CompileResponse, ProjectDefinition } from '../src/builder/api'

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-zip-download-'))

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
    readLocalForgeTimeline,
    resetLocalForgeRuntime,
  } = await import('../src/builder/runtime/local-store.server')
  const { createLocalForgeZipArchive, createLocalForgeZipExport } =
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
    producerId: 'zip-download-fixture-runtime',
    producerKind: 'system',
    runId: undefined,
  })

  const timelineBeforeDownload = await readLocalForgeTimeline()
  const snapshotBeforeDownload = await readLocalForgeSnapshot()
  const archive = await createLocalForgeZipArchive({
    manifestVersionId: bundle.manifest.manifestVersionId,
  })
  const zip = await JSZip.loadAsync(archive.zip)

  assert.equal(archive.fileName, 'fixture-app.zip')
  assert.equal(archive.manifestVersionId, bundle.manifest.manifestVersionId)
  assert.ok(zip.file('fixture-app/README.md'), 'ZIP should include README.md')
  assert.deepEqual(
    await readLocalForgeTimeline(),
    timelineBeforeDownload,
    'manifest ZIP download should not append timeline events',
  )
  assert.deepEqual(
    await readLocalForgeSnapshot(),
    snapshotBeforeDownload,
    'manifest ZIP download should not append projected export state',
  )

  const exportResult = await createLocalForgeZipExport({
    manifestVersionId: bundle.manifest.manifestVersionId,
  })
  const snapshotAfterExport = await readLocalForgeSnapshot()
  const latestExport = snapshotAfterExport.exports.at(-1)

  assert.equal(exportResult.fileName, 'fixture-app.zip')
  assert.equal(latestExport?.kind, 'zip')
  assert.equal(latestExport?.status, 'completed')
  assert.equal(
    latestExport?.manifestVersionId,
    bundle.manifest.manifestVersionId,
  )
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge ZIP download purity verifier passed')
