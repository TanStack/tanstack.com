import assert from 'node:assert/strict'
import {
  assertSafeForgeWebContainerPath,
  createForgeWebContainerFileTree,
  createForgeWebContainerPreviewFiles,
  getForgeWebContainerPreviewCommands,
  getForgeWebContainerWorkspaceName,
} from '../src/utils/forge-webcontainer'

const tree = createForgeWebContainerFileTree({
  'package.json': '{"scripts":{"dev":"vite dev"}}',
  'public/logo.png': 'base64::SGVsbG8=',
  'src/routes/index.tsx': 'export const Route = null\n',
})

const srcNode = tree.src
assert.ok(srcNode && 'directory' in srcNode)

const routesNode = srcNode.directory.routes
assert.ok(routesNode && 'directory' in routesNode)

const indexNode = routesNode.directory['index.tsx']
assert.ok(indexNode && 'file' in indexNode && 'contents' in indexNode.file)
assert.equal(indexNode.file.contents, 'export const Route = null\n')

const publicNode = tree.public
assert.ok(publicNode && 'directory' in publicNode)

const logoNode = publicNode.directory['logo.png']
assert.ok(logoNode && 'file' in logoNode && 'contents' in logoNode.file)
const logoContents = logoNode.file.contents
assert.ok(logoContents instanceof Uint8Array)
assert.deepEqual(Array.from(logoContents), [72, 101, 108, 108, 111])

const previewFiles = createForgeWebContainerPreviewFiles({
  'index.html': '<html><body><div id="root"></div></body></html>',
})
assert.match(
  previewFiles['index.html'] ?? '',
  /data-forge-preview-bridge/,
  'preview bridge should be injected into index.html',
)
assert.match(
  previewFiles['index.html'] ?? '',
  /first-contentful-paint/,
  'preview bridge should watch first contentful paint',
)
assert.match(
  previewFiles['index.html'] ?? '',
  /type: 'ready'/,
  'preview bridge should report readiness to the parent frame',
)
assert.match(
  previewFiles['index.html'] ?? '',
  /annotation\.set/,
  'preview bridge should accept annotation mode controls',
)
assert.match(
  previewFiles['index.html'] ?? '',
  /annotation\.submit/,
  'preview bridge should submit element annotations to the parent frame',
)

const bridgeSource = (previewFiles['index.html'] ?? '').match(
  /<script data-forge-preview-bridge>([\s\S]+)<\/script>/,
)?.[1]
assert.ok(bridgeSource, 'preview bridge script should be present')
new Function(bridgeSource)

assert.match(
  createForgeWebContainerPreviewFiles(previewFiles)['index.html'] ?? '',
  /data-forge-preview-bridge/,
  'preview bridge injection should be idempotent',
)

const startPreviewFiles = createForgeWebContainerPreviewFiles({
  'src/routes/__root.tsx': [
    "import { createRootRoute } from '@tanstack/react-router'",
    '',
    'export const Route = createRootRoute({})',
  ].join('\n'),
  'src/router.tsx': 'export function getRouter() {}\n',
})
assert.match(
  startPreviewFiles['src/routes/__root.tsx'] ?? '',
  /import '..\/forge-preview-bridge'/,
  'Start preview should import the preview bridge module from the root route',
)
assert.match(
  startPreviewFiles['src/forge-preview-bridge.ts'] ?? '',
  /annotation\.set/,
  'Start preview should include the preview bridge module',
)
new Function(startPreviewFiles['src/forge-preview-bridge.ts'])
assert.equal(
  createForgeWebContainerPreviewFiles(startPreviewFiles)[
    'src/routes/__root.tsx'
  ],
  startPreviewFiles['src/routes/__root.tsx'],
  'Start preview bridge import should be idempotent',
)

for (const unsafePath of [
  '',
  '/src/index.tsx',
  'C:/src/index.tsx',
  'src\\index.tsx',
  'src//index.tsx',
  'src/./index.tsx',
  'src/../index.tsx',
]) {
  assert.throws(
    () => assertSafeForgeWebContainerPath(unsafePath),
    /not a safe preview file path/,
  )
}

const pnpmCommands = getForgeWebContainerPreviewCommands('pnpm')
assert.deepEqual(pnpmCommands.install, {
  args: ['install'],
  command: 'pnpm',
  label: 'pnpm install',
})
assert.deepEqual(pnpmCommands.dev, {
  args: ['run', 'dev', '--', '--host', '0.0.0.0', '--port', '5173'],
  command: 'pnpm',
  label: 'pnpm run dev -- --host 0.0.0.0 --port 5173',
})

const npmCommands = getForgeWebContainerPreviewCommands('npm')
assert.deepEqual(npmCommands.dev, {
  args: ['run', 'dev', '--', '--host', '0.0.0.0', '--port', '5173'],
  command: 'npm',
  label: 'npm run dev -- --host 0.0.0.0 --port 5173',
})

assert.equal(
  getForgeWebContainerWorkspaceName('local-manifest-sha256:abc/123'),
  'forge-preview-local-manifest-sha256-abc-123',
)

console.log('Forge WebContainer preview verifier passed')
