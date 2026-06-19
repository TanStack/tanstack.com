import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  createLocalBuilderManifestBundleFromFiles,
  createLocalBuilderManifestBundleFromManifestFiles,
} from '../src/builder/manifest'
import type { CompileResponse, ProjectDefinition } from '../src/builder/api'

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-tombstones-'))

process.chdir(runtimeRoot)

try {
  const { deleteLocalForgeWorkspaceFile } =
    await import('../src/builder/runtime/local-agent.server')
  const {
    appendLocalForgeManifestTimeline,
    persistLocalForgeManifestBundle,
    readLocalForgeStateEvents,
    readLocalForgeTimeline,
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
  const compile = {
    commands: [],
    envVars: [],
    files: {},
    packages: {
      dependencies: {},
      devDependencies: {},
      scripts: {},
    },
    warnings: [],
  } satisfies CompileResponse
  const parentFiles = {
    'src/components/keep.ts': 'export const keep = true\n',
    'src/components/remove.ts': 'export const remove = true\n',
  }
  const parentBundle = await createLocalBuilderManifestBundleFromFiles({
    compile: {
      ...compile,
      files: parentFiles,
    },
    createdAt: '2026-06-18T00:00:00.000Z',
    definition,
    fileSource: 'builder-definition',
    files: parentFiles,
    projectId: 'fixture-project',
    sessionId: 'fixture-session',
  })

  await persistLocalForgeManifestBundle(parentBundle)
  await appendLocalForgeManifestTimeline({
    bundle: parentBundle,
    createdAt: parentBundle.manifest.createdAt,
    producerId: 'fixture-runtime',
    producerKind: 'system',
    runId: undefined,
  })

  const childWorkspace = new Map(Object.entries(parentFiles))
  const deleteResult = deleteLocalForgeWorkspaceFile({
    path: 'src/components/remove.ts',
    workspace: childWorkspace,
  })

  assert.equal(deleteResult.ok, true)
  assert.equal(deleteResult.found, true)

  childWorkspace.set('src/components/keep.ts', 'export const keep = false\n')

  const childBundle = await createLocalBuilderManifestBundleFromManifestFiles({
    createdAt: '2026-06-18T00:00:01.000Z',
    createdByRunId: 'fixture-run',
    fileSource: 'agent',
    fileSources: {
      'src/components/keep.ts': 'agent',
    },
    files: Object.fromEntries(childWorkspace),
    manifest: parentBundle.manifest,
  })

  await persistLocalForgeManifestBundle(childBundle)
  await appendLocalForgeManifestTimeline({
    bundle: childBundle,
    createdAt: childBundle.manifest.createdAt,
    producerId: 'fixture-agent',
    producerKind: 'agent',
    runId: 'fixture-run',
  })

  const timeline = await readLocalForgeTimeline()
  let deletedTimelinePath: string | undefined
  let deletedTimelineSource: string | undefined

  for (const event of timeline) {
    if (event.type !== 'file.deleted') {
      continue
    }

    deletedTimelinePath = event.payload.path
    deletedTimelineSource = event.payload.source
  }

  assert.equal(deletedTimelinePath, 'src/components/remove.ts')
  assert.equal(deletedTimelineSource, 'builder-definition')

  const stateEvents = await readLocalForgeStateEvents()
  let deletedFileRow: Record<string, unknown> | undefined

  for (const event of stateEvents) {
    if (event.type !== 'files' || !isRecord(event.value)) {
      continue
    }

    if (event.value.path === 'src/components/remove.ts') {
      deletedFileRow = event.value
    }
  }

  assert.equal(deletedFileRow?.status, 'deleted')
  assert.equal(deletedFileRow?.source, 'builder-definition')
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge manifest tombstone verifier passed')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
