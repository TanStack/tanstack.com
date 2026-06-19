import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-baseline-'))

process.chdir(runtimeRoot)

try {
  const { ensureLocalForgeBaseline } =
    await import('../src/builder/runtime/local-agent.server')
  const { readLocalForgeTimeline, resetLocalForgeRuntime } =
    await import('../src/builder/runtime/local-store.server')

  await resetLocalForgeRuntime()

  const snapshots = await Promise.all(
    Array.from({ length: 8 }, () => ensureLocalForgeBaseline()),
  )
  const timeline = await readLocalForgeTimeline()
  const manifestEvents = timeline.filter(
    (event) => event.type === 'manifest.snapshotted',
  )
  const manifestVersionIds = new Set(
    snapshots.map((snapshot) => snapshot.manifestVersionId),
  )

  assert.equal(
    manifestEvents.length,
    1,
    'concurrent baseline initialization should append one manifest snapshot',
  )
  assert.equal(
    manifestVersionIds.size,
    1,
    'concurrent baseline callers should resolve the same manifest version',
  )
  assert.ok(
    snapshots[0]?.files['package.json']?.includes(
      '"@tanstack/router-generator"',
    ),
  )
  assert.ok(snapshots[0]?.files['AGENTS.md'])
  assert.ok(snapshots[0]?.files['src/generated/forge-context.ts'])

  await ensureLocalForgeBaseline()

  assert.equal(
    (await readLocalForgeTimeline()).filter(
      (event) => event.type === 'manifest.snapshotted',
    ).length,
    1,
    're-reading an initialized baseline should not append another manifest snapshot',
  )
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge baseline concurrency verifier passed')
