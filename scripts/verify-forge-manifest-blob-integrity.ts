import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { CompileResponse, ProjectDefinition } from '../src/builder/api'

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(
  path.join(os.tmpdir(), 'forge-blob-integrity-'),
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

  await persistLocalForgeManifestBundle({
    blobs: {},
    manifest: bundle.manifest,
  })
  await appendLocalForgeManifestTimeline({
    bundle,
    createdAt: bundle.manifest.createdAt,
    producerId: 'blob-integrity-fixture-runtime',
    producerKind: 'system',
    runId: undefined,
  })

  await assert.rejects(
    readLocalForgeSnapshot(),
    new RegExp(
      `Local Forge manifest ${escapeRegExp(
        bundle.manifest.manifestVersionId,
      )} is missing blob .* for README\\.md`,
    ),
  )
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge manifest blob integrity verifier passed')

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
