import assert from 'node:assert/strict'
import test from 'node:test'
import { rewriteWorkspaceProtocolDependencies } from '../src/utils/repository-example'

test('rewrites @tanstack/ai workspace:* versions to latest', () => {
  const packageJson = JSON.stringify({
    dependencies: {
      '@tanstack/ai': 'workspace:*',
      '@tanstack/ai-react': 'workspace:*',
      '@tanstack/ai-solid': 'workspace:^',
      react: '^19.2.3',
    },
    devDependencies: {
      '@tanstack/ai-devtools': 'workspace:*',
    },
    peerDependencies: {
      '@tanstack/react-query': 'workspace:*',
    },
  })
  const expectedManifest = {
    dependencies: {
      '@tanstack/ai': 'latest',
      '@tanstack/ai-react': 'latest',
      '@tanstack/ai-solid': 'workspace:^',
      react: '^19.2.3',
    },
    devDependencies: {
      '@tanstack/ai-devtools': 'latest',
    },
    peerDependencies: {
      '@tanstack/react-query': 'workspace:*',
    },
  }

  for (const path of ['package.json', '/package.json']) {
    const files = {
      [path]: packageJson,
      '/src/main.ts': 'export const value = 1',
    }

    const result = rewriteWorkspaceProtocolDependencies(files)

    assert.deepEqual(JSON.parse(result[path]), expectedManifest)
    assert.equal(result['/src/main.ts'], 'export const value = 1')
    assert.equal(files[path], packageJson)
  }
})

test('leaves files unchanged when package.json is missing', () => {
  const files = {
    '/src/main.ts': 'export const value = 1',
  }

  const result = rewriteWorkspaceProtocolDependencies(files)

  assert.deepEqual(result, {
    '/src/main.ts': 'export const value = 1',
  })
})

test('leaves files unchanged when package.json is invalid JSON', () => {
  const files = {
    '/package.json': '{ not-json',
    '/src/main.ts': 'export const value = 1',
  }

  const result = rewriteWorkspaceProtocolDependencies(files)

  assert.deepEqual(result, {
    '/package.json': '{ not-json',
    '/src/main.ts': 'export const value = 1',
  })
  assert.equal(result['/package.json'], files['/package.json'])
  assert.equal(result['/src/main.ts'], files['/src/main.ts'])
})
