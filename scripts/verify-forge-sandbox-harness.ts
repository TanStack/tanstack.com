import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  normalizeSandboxFileChunk,
  reconcileSandboxWorkspace,
  seedSandboxWorkspaceDir,
} from '../src/builder/runtime/forge-sandbox-adapter'

// normalizeSandboxFileChunk
assert.deepEqual(
  normalizeSandboxFileChunk({
    type: 'CUSTOM',
    name: 'sandbox.file',
    value: { type: 'change', path: 'src/a.tsx' },
  }),
  { kind: 'upsert', path: 'src/a.tsx' },
)
assert.deepEqual(
  normalizeSandboxFileChunk({
    type: 'CUSTOM',
    name: 'sandbox.file',
    value: { type: 'delete', path: 'src/b.tsx' },
  }),
  { kind: 'delete', path: 'src/b.tsx' },
)
assert.equal(
  normalizeSandboxFileChunk({ type: 'TEXT_MESSAGE_CONTENT', value: 'hi' }),
  null,
)
// file.changed is a whole-tree diff — must return null
assert.equal(
  normalizeSandboxFileChunk({
    type: 'CUSTOM',
    name: 'file.changed',
    value: { path: '.', diff: '...' },
  }),
  null,
)

// seed + reconcile round trip
const dir = await mkdtemp(path.join(os.tmpdir(), 'forge-sandbox-test-'))
try {
  const workspace = new Map([
    [
      'src/keep.tsx',
      { contents: 'old', path: 'src/keep.tsx', source: 'agent' as const },
    ],
    [
      'src/gone.tsx',
      { contents: 'bye', path: 'src/gone.tsx', source: 'agent' as const },
    ],
  ])
  await seedSandboxWorkspaceDir({ dir, workspace })
  assert.equal(await readFile(path.join(dir, 'src/keep.tsx'), 'utf8'), 'old')

  // simulate an agent editing keep.tsx, deleting gone.tsx, adding new.tsx, and creating node_modules junk
  await writeFile(path.join(dir, 'src/keep.tsx'), 'new', 'utf8')
  await rm(path.join(dir, 'src/gone.tsx'))
  await writeFile(path.join(dir, 'src/new.tsx'), 'fresh', 'utf8')
  await mkdir(path.join(dir, 'node_modules'), { recursive: true })
  await writeFile(path.join(dir, 'node_modules/junk.js'), 'noop', 'utf8')

  const result = await reconcileSandboxWorkspace({ dir, workspace })
  assert.deepEqual(result.changedPaths.sort(), ['src/keep.tsx', 'src/new.tsx'])
  assert.deepEqual(result.deletedPaths, ['src/gone.tsx'])
  assert.equal(workspace.get('src/keep.tsx')?.contents, 'new')
  assert.equal(workspace.get('src/new.tsx')?.contents, 'fresh')
  assert.equal(workspace.has('src/gone.tsx'), false)
  assert.equal(workspace.has('node_modules/junk.js'), false) // ignored
} finally {
  await rm(dir, { recursive: true, force: true })
}

console.log('Forge sandbox harness verifier passed')
