import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { CompileResponse, ProjectDefinition } from '../src/builder/api'

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(
  path.join(os.tmpdir(), 'forge-materialize-path-safety-'),
)

process.chdir(runtimeRoot)

try {
  const { createLocalBuilderManifestBundleFromFiles } =
    await import('../src/builder/manifest/local')
  const {
    LOCAL_FORGE_PROJECT_ID,
    LOCAL_FORGE_SESSION_ID,
    persistLocalForgeManifestBundle,
    readLocalForgeSnapshot,
    resetLocalForgeRuntime,
  } = await import('../src/builder/runtime/local-store.server')
  const { assertSafeManifestWorkspacePath, materializeLocalForgeManifest } =
    await import('../src/builder/runtime/local-materialize.server')

  await resetLocalForgeRuntime()

  assert.doesNotThrow(() =>
    assertSafeManifestWorkspacePath('src/routes/index.tsx'),
  )
  assert.throws(
    () => assertSafeManifestWorkspacePath('src/./routes/index.tsx'),
    /not a safe manifest path/,
  )
  assert.throws(
    () => assertSafeManifestWorkspacePath('src\\routes\\index.tsx'),
    /not a safe manifest path/,
  )

  const definition = {
    featureOptions: {},
    features: [],
    framework: 'react',
    name: 'unsafe-materialize-app',
    packageManager: 'pnpm',
    tailwind: true,
  } satisfies ProjectDefinition
  const files = {
    'src//routes/index.tsx':
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

  await assert.rejects(
    materializeLocalForgeManifest({
      manifest: bundle.manifest,
      runId: 'unsafe-materialize-run',
    }),
    /not a safe manifest path/,
  )

  const snapshot = await readLocalForgeSnapshot()

  assert.equal(
    snapshot.manifestVersionId,
    undefined,
    'failed materialization should not publish a current manifest',
  )
  assert.equal(
    snapshot.workflowEvents.some(
      (event) => event.name === 'workflow.materialize.finished',
    ),
    false,
    'unsafe manifest paths should not produce a materialized success event',
  )
  assert.equal(
    snapshot.workflowEvents.some(
      (event) =>
        event.name === 'workflow.validation.failed' &&
        event.status === 'failed' &&
        event.detail?.includes('not a safe manifest path'),
    ),
    true,
    'unsafe materialization failures should be visible in workflow state',
  )
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge materialize path safety verifier passed')
