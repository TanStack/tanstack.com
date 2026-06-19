import assert from 'node:assert/strict'
import { deleteLocalForgeWorkspaceFile } from '../src/builder/runtime/local-agent.server'

const workspace = new Map<string, string>([
  [
    'src/components/obsolete.tsx',
    'export function Obsolete() { return null }\n',
  ],
  ['public/manifest.json', '{}\n'],
  ['package.json', '{}\n'],
  ['README.md', '# App\n'],
  ['src/styles.css', '@import "tailwindcss";\n'],
  ['src/routes/__root.tsx', 'export const Route = null\n'],
  ['src/routes/index.tsx', 'export const Route = null\n'],
])

const deleted = deleteLocalForgeWorkspaceFile({
  path: 'src/components/obsolete.tsx',
  workspace,
})

assert.deepEqual(deleted, {
  found: true,
  ok: true,
  path: 'src/components/obsolete.tsx',
  problems: [],
})
assert.equal(workspace.has('src/components/obsolete.tsx'), false)

const missing = deleteLocalForgeWorkspaceFile({
  path: 'src/components/already-gone.tsx',
  workspace,
})

assert.deepEqual(missing, {
  found: false,
  ok: true,
  path: 'src/components/already-gone.tsx',
  problems: [],
})

const deletedRootStyle = deleteLocalForgeWorkspaceFile({
  path: 'src/styles.css',
  workspace,
})

assert.deepEqual(deletedRootStyle, {
  found: true,
  ok: true,
  path: 'src/styles.css',
  problems: [],
})
assert.equal(workspace.has('src/styles.css'), false)

const deletedPublicFile = deleteLocalForgeWorkspaceFile({
  path: 'public/manifest.json',
  workspace,
})

assert.deepEqual(deletedPublicFile, {
  found: true,
  ok: true,
  path: 'public/manifest.json',
  problems: [],
})
assert.equal(workspace.has('public/manifest.json'), false)

const deletedRootMarkdown = deleteLocalForgeWorkspaceFile({
  path: 'README.md',
  workspace,
})

assert.deepEqual(deletedRootMarkdown, {
  found: true,
  ok: true,
  path: 'README.md',
  problems: [],
})
assert.equal(workspace.has('README.md'), false)

const rejected = deleteLocalForgeWorkspaceFile({
  path: 'package.json',
  workspace,
})

assert.equal(rejected.ok, false)
assert.equal(rejected.found, false)
assert.deepEqual(rejected.problems, [
  'package.json is required workspace scaffolding and cannot be deleted by Forge',
])
assert.equal(workspace.has('package.json'), true)

const protectedDelete = deleteLocalForgeWorkspaceFile({
  path: 'src/routes/__root.tsx',
  workspace,
})

assert.equal(protectedDelete.ok, false)
assert.equal(protectedDelete.found, false)
assert.deepEqual(protectedDelete.problems, [
  'src/routes/__root.tsx is required workspace scaffolding and cannot be deleted by Forge',
])
assert.equal(workspace.has('src/routes/__root.tsx'), true)

console.log('Forge delete tool verifier passed')
