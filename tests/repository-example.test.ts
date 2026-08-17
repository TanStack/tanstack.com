import assert from 'node:assert/strict'
import test from 'node:test'
import { getClientExampleConfig } from '../src/utils/client-example-config'
import { getExampleWorkspaceImports } from '../src/utils/example-imports'
import { createRepositoryExampleDefinition } from '../src/utils/repository-example'
import { getExampleRuntimeHeaders } from '../src/utils/stackblitz-embed'
import type { ExampleRuntime } from '../src/utils/example-workspace'

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
  for (const [libraryId, slug] of [
    ['query', 'basic-graphql-request'],
    ['query', 'default-query-function'],
    ['virtual', 'dynamic'],
    ['virtual', 'infinite-scroll'],
    ['virtual', 'padding'],
    ['virtual', 'scroll-padding'],
    ['virtual', 'smooth-scroll'],
    ['virtual', 'sticky'],
    ['virtual', 'variable'],
    ['pacer', 'useAsyncQueuedState'],
    ['pacer', 'useQueuedState'],
    ['table', 'basic-use-legacy-table'],
  ]) {
    assert.equal(
      getClientExampleConfig({
        framework: 'react',
        libraryId,
        slug,
        version: 'latest',
      }),
      undefined,
    )
  }
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
  assert.deepEqual(
    getClientExampleConfig({
      framework: 'react',
      libraryId: 'router',
      slug: 'basic-ssr-file-based',
      version: 'latest',
    }),
    {
      autoStart: true,
      entry: '/src/routes/index.tsx',
      framework: 'react',
      libraryId: 'router',
      runtime: {
        type: 'webcontainer',
        install: { command: 'pnpm', args: ['install'] },
        start: { command: 'pnpm', args: ['run', 'dev'] },
      },
      slug: 'basic-ssr-file-based',
    },
  )
  assert.equal(
    getClientExampleConfig({
      framework: 'react',
      libraryId: 'router',
      slug: 'basic-ssr-file-based',
      version: 'v0',
    }),
    undefined,
  )
  assert.equal(
    getClientExampleConfig({
      framework: 'vue',
      libraryId: 'router',
      slug: 'basic-ssr-file-based',
      version: 'latest',
    }),
    undefined,
  )
  assert.deepEqual(
    getClientExampleConfig({
      framework: 'react',
      libraryId: 'start',
      slug: 'start-counter',
      version: 'latest',
    }),
    {
      autoStart: true,
      entry: '/src/routes/index.tsx',
      framework: 'react',
      libraryId: 'start',
      runtime: {
        type: 'webcontainer',
        compatibility: 'tanstack-start-async-context',
        install: { command: 'pnpm', args: ['install'] },
        start: { command: 'pnpm', args: ['run', 'dev'] },
      },
      slug: 'start-counter',
    },
  )
  assert.deepEqual(
    getClientExampleConfig({
      framework: 'react',
      libraryId: 'start',
      slug: 'start-basic',
      version: 'latest',
    }),
    {
      autoStart: true,
      entry: '/src/routes/index.tsx',
      framework: 'react',
      libraryId: 'start',
      runtime: {
        type: 'webcontainer',
        compatibility: 'tanstack-start-async-context',
        install: { command: 'pnpm', args: ['install'] },
        start: { command: 'pnpm', args: ['run', 'dev'] },
      },
      slug: 'start-basic',
    },
  )
  assert.deepEqual(
    getClientExampleConfig({
      framework: 'react',
      libraryId: 'start',
      slug: 'start-streaming-data-from-server-functions',
      version: 'latest',
    }),
    {
      autoStart: true,
      entry: '/src/routes/index.tsx',
      framework: 'react',
      libraryId: 'start',
      runtime: {
        type: 'webcontainer',
        compatibility: 'tanstack-start-async-context',
        install: { command: 'pnpm', args: ['install'] },
        start: { command: 'pnpm', args: ['run', 'dev'] },
      },
      slug: 'start-streaming-data-from-server-functions',
    },
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

test('carries runtime metadata without changing the workspace contract', () => {
  const runtime: ExampleRuntime = {
    type: 'webcontainer',
    install: { command: 'npm', args: ['install'] },
    start: { command: 'npm', args: ['run', 'dev'] },
  }
  const definition = createRepositoryExampleDefinition({
    entry: '/src/routes/index.tsx',
    files: { 'src/routes/index.tsx': 'export const Route = null' },
    id: 'router-react-basic-ssr-file-based',
    runtime,
    title: 'Basic SSR File Based',
  })

  assert.equal(definition.runtime, runtime)
  assert.deepEqual(Object.keys(definition.workspace).sort(), [
    'entry',
    'files',
    'version',
  ])
})

test('selects isolation headers by runtime', () => {
  assert.deepEqual(getExampleRuntimeHeaders('esbuild'), {})
  assert.deepEqual(getExampleRuntimeHeaders('webcontainer'), {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless',
  })
  assert.deepEqual(getExampleRuntimeHeaders('external'), {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless',
  })
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

test('keeps repository binary files separate and canonical', () => {
  const definition = createRepositoryExampleDefinition({
    binaryFiles: { 'public/../favicon.ico': 'AAECA/8=' },
    entry: 'src/index.tsx',
    files: { 'src/index.tsx': 'export const value = 1' },
    id: 'router-react-basic-ssr-file-based',
    title: 'Basic SSR File Based',
  })

  assert.deepEqual(definition.workspace.binaryFiles, {
    '/favicon.ico': 'AAECA/8=',
  })
  assert.equal(definition.workspace.files['/favicon.ico'], undefined)
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
