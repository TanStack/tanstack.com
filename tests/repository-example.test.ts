import assert from 'node:assert/strict'
import test from 'node:test'
import { getClientExampleConfig } from '../src/utils/client-example-config'
import { getExampleWorkspaceImports } from '../src/utils/example-imports'
import { createRepositoryExampleDefinition } from '../src/utils/repository-example'

const packageSource = JSON.stringify({
  dependencies: {
    '@tanstack/react-store': '^0.11.1',
    react: '^19.2.5',
    'react-dom': '^19.2.5',
  },
})

test('selects only verified current client examples', () => {
  for (const slug of [
    'simple',
    'atoms',
    'stores',
    'store-actions',
    'store-context',
  ]) {
    assert.ok(
      getClientExampleConfig({
        framework: 'react',
        libraryId: 'store',
        slug,
        version: 'latest',
      }),
    )
  }

  assert.deepEqual(
    getClientExampleConfig({
      framework: 'react',
      libraryId: 'virtual',
      slug: 'fixed',
      version: 'latest',
    }),
    {
      entry: '/src/main.tsx',
      framework: 'react',
      libraryId: 'virtual',
      slug: 'fixed',
    },
  )
  assert.equal(
    getClientExampleConfig({
      framework: 'react',
      libraryId: 'table',
      slug: 'basic-use-table',
      version: 'latest',
    })?.entry,
    '/src/main.tsx',
  )
  assert.equal(
    getClientExampleConfig({
      framework: 'vanilla',
      libraryId: 'pacer',
      slug: 'liteDebounce',
      version: 'latest',
    })?.entry,
    '/src/index.ts',
  )

  for (const [libraryId, framework, slug, entry] of [
    ['virtual', 'lit', 'fixed', '/src/main.ts'],
    ['hotkeys', 'react', 'useHotkeys', '/src/index.tsx'],
    ['ranger', 'react', 'basic', '/src/main.tsx'],
    ['query', 'react', 'simple', '/src/index.tsx'],
    ['form', 'react', 'simple', '/src/index.tsx'],
    ['db', 'react', 'paced-mutations-demo', '/src/main.tsx'],
  ]) {
    assert.equal(
      getClientExampleConfig({
        framework,
        libraryId,
        slug,
        version: 'latest',
      })?.entry,
      entry,
    )
  }

  assert.equal(
    getClientExampleConfig({
      framework: 'preact',
      libraryId: 'store',
      slug: 'simple',
      version: 'latest',
    }),
    undefined,
  )
  assert.equal(
    getClientExampleConfig({
      framework: 'react',
      libraryId: 'store',
      slug: 'future-example',
      version: 'latest',
    }),
    undefined,
  )
  assert.equal(
    getClientExampleConfig({
      framework: 'react',
      libraryId: 'query',
      slug: 'simple',
      version: 'v4',
    }),
    undefined,
  )
  assert.equal(
    getClientExampleConfig({
      framework: 'react',
      libraryId: 'pacer',
      slug: 'useRateLimiterWithPersister',
      version: 'latest',
    }),
    undefined,
  )
  assert.equal(
    getClientExampleConfig({
      framework: 'react',
      libraryId: 'form',
      slug: 'array',
      version: 'latest',
    }),
    undefined,
  )
  assert.equal(
    getClientExampleConfig({
      framework: 'react',
      libraryId: 'table',
      slug: 'cell-selection',
      version: 'latest',
    }),
    undefined,
  )
})

test('creates a repository-backed workspace with canonical paths', () => {
  const definition = createRepositoryExampleDefinition({
    entry: 'src/index.tsx',
    files: {
      'index.html': '<div id="root"></div>',
      'package.json': packageSource,
      'src/index.tsx': 'export const value = 1',
    },
    id: 'store-react-simple',
    initialFile: 'package.json',
    title: 'Simple',
  })

  assert.equal(definition.workspace.entry, '/src/index.tsx')
  assert.equal(definition.initialFile, '/package.json')
  assert.equal(
    definition.workspace.files['/src/index.tsx'],
    'export const value = 1',
  )
})

test('falls back to the entry when the requested file is absent', () => {
  const definition = createRepositoryExampleDefinition({
    entry: '/src/index.tsx',
    files: { 'src/index.tsx': 'export {}' },
    id: 'store-react-simple',
    initialFile: '/missing.ts',
    title: 'Simple',
  })

  assert.equal(definition.initialFile, '/src/index.tsx')
})

test('package dependencies replace built-in React aliases consistently', () => {
  const definition = createRepositoryExampleDefinition({
    entry: '/src/index.tsx',
    files: {
      'package.json': packageSource,
      'src/index.tsx': 'export {}',
    },
    id: 'store-react-simple',
    title: 'Simple',
  })
  const imports = getExampleWorkspaceImports(
    definition.workspace,
    definition.workspace.files,
    new Set([
      '@tanstack/react-store/helpers',
      'react/jsx-runtime',
      'react-dom/client',
    ]),
  )

  assert.equal(imports.react, 'https://esm.sh/react@^19.2.5')
  assert.equal(
    imports['react/jsx-runtime'],
    'https://esm.sh/react@^19.2.5/jsx-runtime',
  )
  assert.equal(
    imports['react-dom/client'],
    'https://esm.sh/react-dom@^19.2.5/client?external=react',
  )
  assert.equal(
    imports['@tanstack/react-store'],
    'https://esm.sh/@tanstack/react-store@^0.11.1?external=react,react-dom',
  )
  assert.equal(
    imports['@tanstack/react-store/helpers'],
    'https://esm.sh/@tanstack/react-store@^0.11.1/helpers?external=react,react-dom',
  )
})

test('workspace imports remain the final override', () => {
  const definition = createRepositoryExampleDefinition({
    entry: '/src/index.tsx',
    files: {
      'package.json': packageSource,
      'src/index.tsx': 'export {}',
    },
    id: 'store-react-simple',
    title: 'Simple',
  })
  definition.workspace.imports = {
    react: 'https://example.com/react.js',
  }

  const imports = getExampleWorkspaceImports(
    definition.workspace,
    definition.workspace.files,
  )

  assert.equal(imports.react, 'https://example.com/react.js')
})
