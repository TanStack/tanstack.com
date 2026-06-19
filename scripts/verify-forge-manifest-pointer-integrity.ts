import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { CompileResponse, ProjectDefinition } from '../src/builder/api'
import type { LocalBuilderTimelineEvent } from '../src/builder/projection'
import type { BuilderManifest } from '../src/builder/schema'

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(
  path.join(os.tmpdir(), 'forge-manifest-pointer-integrity-'),
)
const definition = {
  featureOptions: {},
  features: [],
  framework: 'react',
  name: 'fixture-app',
  packageManager: 'pnpm',
  tailwind: true,
} satisfies ProjectDefinition

process.chdir(runtimeRoot)

try {
  const {
    createLocalBuilderManifestBundleFromFiles,
    createLocalBuilderManifestBundleFromManifestFiles,
  } = await import('../src/builder/manifest/local')
  const {
    appendLocalForgeManifestTimeline,
    appendLocalForgeTimelineEvents,
    LOCAL_FORGE_PROJECT_ID,
    LOCAL_FORGE_SESSION_ID,
    persistLocalForgeManifestBundle,
    readLocalForgeSnapshot,
    resetLocalForgeRuntime,
  } = await import('../src/builder/runtime/local-store.server')

  await resetLocalForgeRuntime()

  const missingManifestVersionId = 'local-manifest-sha256:missing-current'

  await appendLocalForgeTimelineEvents([
    createManifestSnapshotEvent({
      eventId: 'missing-current-manifest-event',
      index: 0,
      manifestVersionId: missingManifestVersionId,
      totalBytes: 0,
    }),
  ])

  await assert.rejects(
    readLocalForgeSnapshot(),
    new RegExp(
      `Local Forge current manifest pointer references missing manifest ${escapeRegExp(
        missingManifestVersionId,
      )}`,
    ),
  )

  await resetLocalForgeRuntime()

  const parentFiles = {
    'README.md': '# Fixture App\n',
  }
  const parentBundle = await createLocalBuilderManifestBundleFromFiles({
    compile: createCompile(parentFiles),
    createdAt: '2026-06-18T00:00:00.000Z',
    definition,
    fileSource: 'builder-definition',
    files: parentFiles,
    projectId: LOCAL_FORGE_PROJECT_ID,
    sessionId: LOCAL_FORGE_SESSION_ID,
  })
  const childFiles = {
    'README.md': '# Fixture App\n\nChanged.\n',
  }
  const childBundle = await createLocalBuilderManifestBundleFromManifestFiles({
    createdAt: '2026-06-18T00:00:01.000Z',
    createdByRunId: 'manifest-pointer-integrity-run',
    fileSource: 'agent',
    files: childFiles,
    manifest: parentBundle.manifest,
  })

  await assert.rejects(
    appendLocalForgeManifestTimeline({
      bundle: childBundle,
      createdAt: childBundle.manifest.createdAt,
      producerId: 'manifest-pointer-integrity-fixture',
      producerKind: 'system',
      runId: undefined,
    }),
    new RegExp(
      `manifest ${escapeRegExp(
        childBundle.manifest.manifestVersionId,
      )} parent pointer references missing manifest ${escapeRegExp(
        parentBundle.manifest.manifestVersionId,
      )}`,
    ),
  )

  await persistLocalForgeManifestBundle(childBundle)
  await appendLocalForgeTimelineEvents([
    createManifestSnapshotEvent({
      eventId: 'missing-parent-manifest-event',
      index: 0,
      manifest: childBundle.manifest,
    }),
  ])

  await assert.rejects(
    readLocalForgeSnapshot(),
    new RegExp(
      `manifest ${escapeRegExp(
        childBundle.manifest.manifestVersionId,
      )} parent pointer references missing manifest ${escapeRegExp(
        parentBundle.manifest.manifestVersionId,
      )}`,
    ),
  )
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge manifest pointer integrity verifier passed')

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

function createManifestSnapshotEvent({
  eventId,
  index,
  manifest,
  manifestVersionId,
  totalBytes,
}: {
  eventId: string
  index: number
  manifest?: BuilderManifest
  manifestVersionId?: string
  totalBytes?: number
}): LocalBuilderTimelineEvent {
  const resolvedManifestVersionId =
    manifest?.manifestVersionId ?? manifestVersionId

  assert.ok(resolvedManifestVersionId)

  return {
    createdAt: '2026-06-18T00:00:00.000Z',
    eventId,
    producer: {
      epoch: 'local-session',
      id: 'manifest-pointer-integrity-fixture',
      kind: 'system',
      seq: index + 1,
    },
    projectId: 'local-project',
    schemaVersion: 1,
    sessionId: 'local-session',
    type: 'manifest.snapshotted',
    payload: {
      blobRef: resolvedManifestVersionId,
      fileCount: manifest ? Object.keys(manifest.files).length : 0,
      manifestVersionId: resolvedManifestVersionId,
      totalBytes: manifest
        ? getManifestTotalBytes(manifest)
        : (totalBytes ?? 0),
    },
  }
}

function getManifestTotalBytes(manifest: BuilderManifest) {
  return Object.values(manifest.files).reduce((sum, file) => sum + file.size, 0)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
