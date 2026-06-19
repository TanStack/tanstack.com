import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createLocalBuilderManifestBundleFromFiles } from '../src/builder/manifest'
import type { CompileResponse, ProjectDefinition } from '../src/builder/api'

const originalCwd = process.cwd()
const originalPath = process.env.PATH
const runtimeRoot = await mkdtemp(
  path.join(os.tmpdir(), 'forge-materialize-diagnostics-'),
)
const fakeBinDir = path.join(runtimeRoot, 'bin')
const fakePnpmPath = path.join(fakeBinDir, 'pnpm')

process.chdir(runtimeRoot)

try {
  await mkdir(fakeBinDir, { recursive: true })
  await writeFile(
    fakePnpmPath,
    [
      '#!/usr/bin/env sh',
      'if [ "$1" = "exec" ] && [ "$2" = "tsc" ]; then',
      '  printf "%s\\n" "fixture typecheck failure" >&2',
      '  exit 1',
      'fi',
      'exit 0',
      '',
    ].join('\n'),
    'utf8',
  )
  await chmod(fakePnpmPath, 0o755)

  process.env.PATH = `${fakeBinDir}${path.delimiter}${originalPath ?? ''}`

  const {
    appendLocalForgeManifestTimeline,
    LOCAL_FORGE_PROJECT_ID,
    LOCAL_FORGE_SESSION_ID,
    persistLocalForgeManifestBundle,
    readLocalForgeSnapshot,
    resetLocalForgeRuntime,
  } = await import('../src/builder/runtime/local-store.server')
  const { materializeLatestLocalForgeManifest } =
    await import('../src/builder/runtime/local-materialize.server')

  await resetLocalForgeRuntime()

  const files = {
    'package.json': `${JSON.stringify(
      {
        scripts: {
          build: 'vite build',
        },
      },
      null,
      2,
    )}\n`,
    'src/routes/index.tsx':
      "import { createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('/')({ component: () => null })\n",
  }
  const bundle = await createLocalBuilderManifestBundleFromFiles({
    compile: createCompile(files),
    createdAt: '2026-06-19T00:00:00.000Z',
    definition: {
      featureOptions: {},
      features: [],
      framework: 'react',
      name: 'diagnostics-app',
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
    producerId: 'diagnostics-fixture',
    producerKind: 'system',
    runId: undefined,
  })

  const result = await materializeLatestLocalForgeManifest()
  const snapshot = await readLocalForgeSnapshot()
  const failedCommand = result.commands.find((command) =>
    command.commandLine.includes('tsc --noEmit'),
  )

  assert.equal(result.success, false)
  assert.equal(failedCommand?.exitCode, 1)
  assert.equal(
    result.commands.some((command) => command.commandLine === 'pnpm run build'),
    false,
    'build should not run after a failed typecheck diagnostic',
  )
  assert.equal(snapshot.manifestVersionId, result.manifestVersionId)
  assert.equal(
    snapshot.workflowEvents.some(
      (event) =>
        event.name === 'workflow.validation.failed' &&
        event.status === 'failed' &&
        event.detail?.includes('pnpm exec tsc --noEmit failed'),
    ),
    true,
    'typecheck diagnostics should be visible without throwing',
  )
} finally {
  process.chdir(originalCwd)
  restoreEnvVar('PATH', originalPath)

  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge materialize diagnostics nonfatal verifier passed')

function createCompile(files: Record<string, string>): CompileResponse {
  return {
    commands: [],
    envVars: [],
    files,
    packages: {
      dependencies: {},
      devDependencies: {},
      scripts: {
        build: 'vite build',
      },
    },
    warnings: [],
  }
}

function restoreEnvVar(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}
