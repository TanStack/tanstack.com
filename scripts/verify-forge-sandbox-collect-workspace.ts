import assert from 'node:assert/strict'
import type { SandboxHandle } from '@tanstack/ai-sandbox'

// `sandbox-r2-persistence.server.ts` itself does NOT statically import the
// Workers-runtime-only `@tanstack/ai-sandbox-cloudflare` chain (it only pulls
// in `@tanstack/ai-sandbox` types + forge store helpers), so it loads under
// plain `tsx` — the existing `verify-forge-sandbox-materialize` verifier
// imports it directly. We still guard the import with the established
// CF-fallback wrapper (see `verify-forge-sandbox-definition.ts`): if a future
// change makes the module transitively touch `cloudflare:`, this verifier
// degrades to asserting the known import gap instead of a spurious failure.
let importError: unknown
let forgePersistenceHooks:
  | typeof import('../src/builder/runtime/sandbox-r2-persistence.server').forgePersistenceHooks
  | undefined
try {
  ;({ forgePersistenceHooks } =
    await import('../src/builder/runtime/sandbox-r2-persistence.server'))
} catch (error) {
  importError = error
}

if (importError || !forgePersistenceHooks) {
  assert.ok(
    importError instanceof Error &&
      /cloudflare:|@cloudflare\/containers/.test(importError.message),
    `expected the only possible import failure to be the known Workers-runtime-only gap, got: ${String(importError)}`,
  )
  console.log(
    '[verify-forge-sandbox-collect-workspace] sandbox-r2-persistence.server cannot load under plain tsx (Workers-runtime-only import chain) — collectWorkspaceFiles logic not exercised.',
  )
} else {
  // --- collectWorkspaceFiles walks the tree and applies the ignore rules ----
  const tree: Record<string, string> = {
    '/workspace/app/.forge-manifest': 'manifest-version-abc',
    '/workspace/app/README.md': '# Fixture\n',
    '/workspace/app/dist/bundle.js': 'BUILD OUTPUT — must be ignored',
    '/workspace/app/node_modules/left-pad/index.js': 'dep — must be ignored',
    '/workspace/app/.git/config': 'vcs — must be ignored',
    '/workspace/app/src/main.tsx': 'export const main = () => {}\n',
    '/workspace/app/src/routes/index.tsx':
      'export default function Index() {}\n',
    '/workspace/app/public/favicon.svg': '<svg/>\n',
  }

  const handle = createFakeSandboxHandle(tree)
  const hooks = forgePersistenceHooks({
    env: {},
    manifestVersionId: 'manifest:fixture/current',
    runId: 'run-fixture',
  })

  assert.ok(hooks.onReady)
  // Capture the handle the same way the real lifecycle does (onReady). We use
  // a manifest-less env so materialize is a no-op and only the handle capture
  // matters here.
  await hooks.onReady(handle)

  const files = await hooks.collectWorkspaceFiles()

  assert.deepEqual(
    Object.keys(files).sort(),
    ['README.md', 'public/favicon.svg', 'src/main.tsx', 'src/routes/index.tsx'],
    `collectWorkspaceFiles must return workspace-relative paths with node_modules/.git/dist/.forge-manifest ignored, got ${JSON.stringify(
      Object.keys(files).sort(),
    )}`,
  )
  assert.equal(files['README.md'], '# Fixture\n')
  assert.equal(files['src/main.tsx'], 'export const main = () => {}\n')
  assert.equal(files['public/favicon.svg'], '<svg/>\n')

  assert.ok(
    !Object.keys(files).some(
      (path) =>
        path.includes('node_modules') ||
        path.includes('.git') ||
        path.startsWith('dist/') ||
        path === '.forge-manifest',
    ),
    'ignored directories/marker must never appear in collectWorkspaceFiles output',
  )

  console.log(
    '[verify-forge-sandbox-collect-workspace] collectWorkspaceFiles walked the tree and applied ignore rules',
  )

  // --- No captured handle (onReady never fired) returns {} ------------------
  const noReadyHooks = forgePersistenceHooks({
    env: {},
    manifestVersionId: 'manifest:fixture/current',
    runId: 'run-fixture',
  })
  const emptyFiles = await noReadyHooks.collectWorkspaceFiles()
  assert.deepEqual(
    emptyFiles,
    {},
    'collectWorkspaceFiles must return {} when onReady never captured a handle',
  )

  console.log(
    '[verify-forge-sandbox-collect-workspace] collectWorkspaceFiles returned {} with no captured handle',
  )
}

console.log('Forge sandbox collect-workspace verifier passed')

/**
 * A fake `SandboxHandle` backed by a flat `{ absolutePath: content }` map.
 * `fs.list` synthesizes directory entries from the flat map so the recursive
 * tree-walk in `collectWorkspaceFiles` can be exercised for real.
 */
function createFakeSandboxHandle(tree: Record<string, string>): SandboxHandle {
  const list = async (dirPath: string) => {
    const prefix = dirPath.endsWith('/') ? dirPath : `${dirPath}/`
    const names = new Map<string, 'dir' | 'file'>()

    for (const absolutePath of Object.keys(tree)) {
      if (!absolutePath.startsWith(prefix)) {
        continue
      }

      const remainder = absolutePath.slice(prefix.length)
      const slashIndex = remainder.indexOf('/')

      if (slashIndex === -1) {
        names.set(remainder, 'file')
      } else {
        names.set(remainder.slice(0, slashIndex), 'dir')
      }
    }

    return Array.from(names, ([name, type]) => ({
      name,
      path: `${prefix}${name}`,
      type,
    }))
  }

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
      exists: async (filePath: string) => filePath in tree,
      list,
      mkdir: async () => {},
      read: async (filePath: string) => {
        const content = tree[filePath]

        if (content === undefined) {
          throw new Error(`fixture fs: ${filePath} does not exist`)
        }

        return content
      },
      readBytes: async () => new Uint8Array(),
      remove: async () => {},
      rename: async () => {},
      write: async () => {},
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
  }
}
