import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { SandboxHandle } from '@tanstack/ai-sandbox'
import type { BlobStorage } from '../src/server/runtime/blob-storage.server'
import type { BuilderLocalFileBlob, BuilderManifest } from '../src/builder/schema'

const { forgePersistenceHooks } = await import(
  '../src/builder/runtime/sandbox-r2-persistence.server'
)

const projectId = 'manifest:fixture/current'
const blob: BuilderLocalFileBlob = {
  blobRef: 'sha256:fixture/readme-blob',
  content: '# Fixture\n',
  contentType: 'text/markdown',
  encoding: 'utf8',
  kind: 'file',
  sha256: 'fixture-sha',
  size: 10,
}
const manifest: BuilderManifest = {
  app: {
    framework: 'react',
    name: 'Fixture',
    packageManager: 'pnpm',
    tailwind: true,
    uiFramework: 'react',
  },
  commands: [],
  createdAt: '2026-07-01T00:00:00.000Z',
  dependencies: {},
  devDependencies: {},
  envVars: [],
  files: {
    'README.md': {
      blobRef: blob.blobRef,
      contentType: blob.contentType,
      encoding: blob.encoding,
      path: 'README.md',
      sha256: blob.sha256,
      size: blob.size,
      source: 'builder-definition',
    },
  },
  manifestVersionId: projectId,
  sandbox: {
    devCommand: 'pnpm dev',
    installCommand: 'pnpm install',
    previewPort: 3000,
    workdir: '/workspace',
  },
  schemaVersion: 1,
  scripts: {},
  source: {
    compileVersion: 1,
    kind: 'builder-definition',
    selectedFeatures: [],
  },
  warnings: [],
}

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(
  path.join(os.tmpdir(), 'forge-sandbox-materialize-'),
)

process.chdir(runtimeRoot)

try {
  // 1) Stale/absent marker: onReady must write every manifest file plus the
  // marker itself.
  {
    const storage = createMemoryBlobStorage()
    await storage.put(
      `forge/v1/manifests/${encodeURIComponent(manifest.manifestVersionId)}.json`,
      JSON.stringify(manifest),
      { contentType: 'application/json' },
    )
    await storage.put(
      `forge/v1/blobs/${encodeURIComponent(blob.blobRef)}.json`,
      JSON.stringify(blob),
      { contentType: 'application/json' },
    )

    const handle = createFakeSandboxHandle()
    const hooks = forgePersistenceHooks({
      env: { FORGE_RUNTIME: storage },
      manifestVersionId: projectId,
      runId: 'run-fixture',
    })

    assert.ok(hooks.onReady)
    await hooks.onReady(handle)

    assert.equal(
      handle.writeCalls.length,
      2,
      `expected 2 fs.write calls (file + marker), got ${handle.writeCalls.length}`,
    )
    assert.equal(
      await handle.fs.read('/workspace/app/README.md'),
      blob.content,
    )
    assert.equal(
      await handle.fs.read('/workspace/app/.forge-manifest'),
      manifest.manifestVersionId,
    )

    console.log(
      '[verify-forge-sandbox-materialize] stale/absent marker materialized files + marker',
    )
  }

  // 2) Matching marker: onReady must perform ZERO fs.write calls (warm no-op).
  {
    const storage = createMemoryBlobStorage()
    await storage.put(
      `forge/v1/manifests/${encodeURIComponent(manifest.manifestVersionId)}.json`,
      JSON.stringify(manifest),
      { contentType: 'application/json' },
    )
    await storage.put(
      `forge/v1/blobs/${encodeURIComponent(blob.blobRef)}.json`,
      JSON.stringify(blob),
      { contentType: 'application/json' },
    )

    const handle = createFakeSandboxHandle()
    // Pre-seed the marker as if a prior onReady already materialized it.
    await handle.fs.write('/workspace/app/.forge-manifest', projectId)
    handle.writeCalls.length = 0

    const hooks = forgePersistenceHooks({
      env: { FORGE_RUNTIME: storage },
      manifestVersionId: projectId,
      runId: 'run-fixture',
    })

    assert.ok(hooks.onReady)
    await hooks.onReady(handle)

    assert.equal(
      handle.writeCalls.length,
      0,
      `expected 0 fs.write calls for a matching marker (warm no-op), got ${handle.writeCalls.length}: ${JSON.stringify(
        handle.writeCalls,
      )}`,
    )

    console.log(
      '[verify-forge-sandbox-materialize] matching marker performed zero fs.write calls',
    )
  }

  // 3) onFile mirrors a create/change event to R2 (debounced) using the
  // handle captured from onReady, and leaves an activity-feed event.
  {
    const storage = createMemoryBlobStorage()
    await storage.put(
      `forge/v1/manifests/${encodeURIComponent(manifest.manifestVersionId)}.json`,
      JSON.stringify(manifest),
      { contentType: 'application/json' },
    )
    await storage.put(
      `forge/v1/blobs/${encodeURIComponent(blob.blobRef)}.json`,
      JSON.stringify(blob),
      { contentType: 'application/json' },
    )

    const { resetLocalForgeRuntime, readLocalForgeTimeline } = await import(
      '../src/builder/runtime/local-store.server'
    )
    await resetLocalForgeRuntime()

    const handle = createFakeSandboxHandle()
    const hooks = forgePersistenceHooks({
      env: { FORGE_RUNTIME: storage },
      manifestVersionId: projectId,
      runId: 'run-fixture',
    })

    assert.ok(hooks.onReady && hooks.onFile)
    await hooks.onReady(handle)
    await handle.fs.write('/workspace/app/README.md', '# Fixture changed\n')

    hooks.onFile({
      path: '/workspace/app/README.md',
      timestamp: Date.now(),
      type: 'change',
    })

    // `flush()` fires the pending debounced mirror immediately and awaits it,
    // so no wall-clock delay is needed for the mirror + activity event to land.
    await hooks.flush()

    const mirroredKeys = (await storage.list({ prefix: 'forge/v1/blobs/' }))
      .objects.map((object) => object.key)
    assert.ok(
      mirroredKeys.some((key) => key.includes('forge-sandbox-mirror')),
      `expected a mirrored blob key, got ${JSON.stringify(mirroredKeys)}`,
    )

    const timeline = await readLocalForgeTimeline()
    assert.ok(
      timeline.some(
        (event) =>
          event.type === 'workflow.event.recorded' &&
          event.payload.name === 'workflow.sandbox.file.change',
      ),
      'expected a workflow.sandbox.file.change activity-feed event',
    )

    console.log(
      '[verify-forge-sandbox-materialize] onFile mirrored the changed file to R2 and recorded an activity event',
    )
  }
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, { force: true, recursive: true })
}

console.log('Forge sandbox materialize verifier passed')

function createFakeSandboxHandle(): SandboxHandle & {
  writeCalls: Array<{ data: string; path: string }>
} {
  const files = new Map<string, string>()
  const writeCalls: Array<{ data: string; path: string }> = []

  return {
    capabilities: {
      backgroundProcesses: false,
      durableFilesystem: true,
      env: false,
      exec: false,
      fork: false,
      fs: true,
      networkPolicy: false,
      ports: false,
      snapshots: false,
      writableStdin: false,
    },
    destroy: async () => {},
    env: {
      set: async () => {},
    },
    fs: {
      exists: async (filePath: string) => files.has(filePath),
      list: async () => [],
      mkdir: async () => {},
      read: async (filePath: string) => {
        const content = files.get(filePath)

        if (content === undefined) {
          throw new Error(`fixture fs: ${filePath} does not exist`)
        }

        return content
      },
      readBytes: async () => new Uint8Array(),
      remove: async (filePath: string) => {
        files.delete(filePath)
      },
      rename: async (from: string, to: string) => {
        const content = files.get(from)

        if (content !== undefined) {
          files.set(to, content)
          files.delete(from)
        }
      },
      write: async (filePath: string, data: string | Uint8Array) => {
        const text = typeof data === 'string' ? data : Buffer.from(data).toString('utf8')
        writeCalls.push({ data: text, path: filePath })
        files.set(filePath, text)
      },
    },
    git: {
      add: async () => {},
      branch: async () => 'main',
      clone: async () => {},
      commit: async () => {},
      pull: async () => {},
      push: async () => {},
      status: async () => '',
    },
    id: 'fixture-sandbox',
    ports: {
      connect: async () => ({ url: 'http://fixture.local' }),
    },
    process: {
      exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
      spawn: async () => {
        throw new Error('not exercised by this verifier')
      },
    },
    provider: 'fixture',
    writeCalls,
  }
}

function createMemoryBlobStorage(): BlobStorage {
  const entries = new Map<
    string,
    {
      metadata?: Record<string, string>
      text: string
    }
  >()

  return {
    async delete(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        entries.delete(key)
      }
    },
    async get(key) {
      const entry = entries.get(key)

      if (!entry) {
        return null
      }

      return {
        key,
        metadata: entry.metadata,
        text: async () => entry.text,
      }
    },
    async list(options) {
      const objects = Array.from(entries.keys())
        .filter((key) => !options?.prefix || key.startsWith(options.prefix))
        .sort()
        .slice(0, options?.limit)
        .map((key) => ({
          key,
          metadata: entries.get(key)?.metadata,
        }))

      return {
        objects,
        truncated: false,
      }
    },
    async put(key, value, options) {
      entries.set(key, {
        metadata: options?.metadata,
        text: value,
      })
    },
  }
}
