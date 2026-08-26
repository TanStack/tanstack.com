import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getExampleWorkspaceImports,
  resolveExampleWorkspaceImports as resolveExampleWorkspaceImportsImpl,
  type ExampleImportMetadataFetch,
} from '../src/utils/example-imports'
import { createExampleWorkspace } from '../src/utils/example-workspace'

test('resolves imported development dependencies without exposing unused ones', () => {
  const workspace = createExampleWorkspace({
    entry: '/index.ts',
    files: {
      '/index.ts': 'export {}',
      '/package.json': JSON.stringify({
        devDependencies: {
          '@example/devtools': '1.2.3',
          vite: '8.0.0',
        },
      }),
    },
  })

  const imports = getExampleWorkspaceImports(
    workspace,
    workspace.files,
    new Set(['@example/devtools', '@example/devtools/panel']),
  )

  assert.equal(
    imports['@example/devtools'],
    'https://esm.sh/@example/devtools@1.2.3',
  )
  assert.equal(
    imports['@example/devtools/panel'],
    'https://esm.sh/@example/devtools@1.2.3/panel',
  )
  assert.equal(imports.vite, undefined)
})

test('prefers dependency versions when a package is listed in both sections', () => {
  const workspace = createExampleWorkspace({
    entry: '/index.ts',
    files: {
      '/index.ts': 'export {}',
      '/package.json': JSON.stringify({
        dependencies: { '@example/shared': '2.0.0' },
        devDependencies: { '@example/shared': '1.0.0' },
      }),
    },
  })

  const imports = getExampleWorkspaceImports(
    workspace,
    workspace.files,
    new Set(['@example/shared']),
  )

  assert.equal(
    imports['@example/shared'],
    'https://esm.sh/@example/shared@2.0.0',
  )
})

test('resolves undeclared imported packages to an exact latest version', async () => {
  const workspace = createExampleWorkspace({
    entry: '/index.ts',
    files: { '/index.ts': 'export {}' },
  })
  const requests: Array<string> = []
  const metadataFetch = createMetadataFetch(requests, () => ({
    version: '5.1.6',
  }))

  const imports = await resolveExampleWorkspaceImports(
    workspace,
    workspace.files,
    new Set(['nanoid/non-secure']),
    { fetch: metadataFetch },
  )

  assert.deepEqual(imports, {
    'nanoid/non-secure': 'https://esm.sh/nanoid@5.1.6/non-secure',
  })
  assert.deepEqual(requests, [
    'https://esm.sh/nanoid@latest/non-secure?meta',
    'https://unpkg.com/nanoid@5.1.6/package.json',
  ])
})

test('uses package ranges while mapping only observed root and subpath imports', async () => {
  const workspace = createExampleWorkspace({
    entry: '/index.ts',
    files: {
      '/index.ts': 'export {}',
      '/package.json': JSON.stringify({
        dependencies: { '@example/data': '^2.0.0', unused: '^1.0.0' },
      }),
    },
  })
  const requests: Array<string> = []

  const imports = await resolveExampleWorkspaceImports(
    workspace,
    workspace.files,
    new Set(['@example/data', '@example/data/values.json?module']),
    {
      fetch: createMetadataFetch(requests, () => ({ version: '2.4.1' })),
    },
  )

  assert.deepEqual(imports, {
    '@example/data': 'https://esm.sh/@example/data@2.4.1',
    '@example/data/values.json?module':
      'https://esm.sh/@example/data@2.4.1/values.json?module',
  })
  assert.ok(requests.includes('https://esm.sh/@example/data@%5E2.0.0?meta'))
  assert.equal(
    Object.keys(imports).some((key) => key === 'unused'),
    false,
  )
})

test('externalizes peer packages discovered from exact subpath metadata', async () => {
  const workspace = createExampleWorkspace({
    entry: '/index.ts',
    files: {
      '/index.ts': 'export {}',
      '/package.json': JSON.stringify({
        dependencies: {
          '@example/ui': '^3.0.0',
          react: '^19.0.0',
        },
      }),
    },
  })
  const requests: Array<string> = []
  const metadataFetch = createMetadataFetch(requests, (url) =>
    url.includes('@example/ui')
      ? {
          version: '3.2.1',
          peerImports: ['/react@^19.0.0/jsx-runtime?target=es2022'],
        }
      : { version: '19.2.3' },
  )

  const imports = await resolveExampleWorkspaceImports(
    workspace,
    workspace.files,
    new Set(['@example/ui/button', 'react']),
    { fetch: metadataFetch },
  )

  assert.deepEqual(imports, {
    '@example/ui/button':
      'https://esm.sh/@example/ui@3.2.1/button?external=react',
    react: 'https://esm.sh/react@19.2.3',
    'react/': 'https://esm.sh/react@19.2.3/',
    'react/jsx-runtime': 'https://esm.sh/react@19.2.3/jsx-runtime',
  })
})

test('externalizes package manifest peers omitted from esm.sh metadata', async () => {
  const workspace = createExampleWorkspace({
    entry: '/index.tsx',
    files: {
      '/index.tsx': 'export {}',
      '/package.json': JSON.stringify({
        dependencies: {
          '@example/charts': '3.2.1',
          react: '19.2.3',
          'react-dom': '19.2.3',
        },
      }),
    },
  })
  const requests: Array<string> = []
  const metadataFetch = createMetadataFetch(
    requests,
    (url) => {
      if (url.includes('@example/charts')) return { version: '3.2.1' }
      return { version: '19.2.3' }
    },
    (url): Record<string, string> => {
      if (url.includes('@example/charts')) {
        return { react: '^19.0.0', 'react-dom': '^19.0.0' }
      }
      if (url.includes('react-dom')) return { react: '^19.0.0' }
      return {}
    },
  )

  const imports = await resolveExampleWorkspaceImports(
    workspace,
    workspace.files,
    new Set([
      '@example/charts/react',
      'react',
      'react-dom/client',
      'react/jsx-runtime',
    ]),
    { fetch: metadataFetch },
  )

  assert.deepEqual(imports, {
    '@example/charts/react':
      'https://esm.sh/@example/charts@3.2.1/react?external=react,react-dom',
    react: 'https://esm.sh/react@19.2.3',
    'react/': 'https://esm.sh/react@19.2.3/',
    'react-dom': 'https://esm.sh/react-dom@19.2.3?external=react',
    'react-dom/': 'https://esm.sh/react-dom@19.2.3/',
    'react-dom/client': 'https://esm.sh/react-dom@19.2.3/client?external=react',
    'react/jsx-runtime': 'https://esm.sh/react@19.2.3/jsx-runtime',
  })
  assert.ok(
    requests.includes('https://unpkg.com/@example/charts@3.2.1/package.json'),
  )
})

test('rejects incomplete explicit package version families', async () => {
  const metadataFetch: ExampleImportMetadataFetch = async () => {
    throw new Error('Unexpected metadata request')
  }

  const incompleteImports: Array<Record<string, string>> = [
    { react: 'https://esm.sh/react@18.3.1' },
    { 'react/': 'https://esm.sh/react@18.3.1/' },
    { 'react/jsx-runtime': 'https://esm.sh/react@18.3.1/jsx-runtime' },
  ]

  for (const imports of incompleteImports) {
    const workspace = createExampleWorkspace({
      entry: '/index.tsx',
      files: { '/index.tsx': 'export {}' },
      imports,
    })

    await assert.rejects(
      resolveExampleWorkspaceImports(
        workspace,
        workspace.files,
        new Set(['react', 'react/jsx-runtime']),
        { fetch: metadataFetch },
      ),
      /does not cover react/,
    )
  }
})

test('requires explicit peer mappings to cover root and subpaths', async () => {
  const workspace = createExampleWorkspace({
    entry: '/index.tsx',
    files: { '/index.tsx': 'export {}' },
    imports: { react: 'https://esm.sh/react@19.2.3' },
  })
  const metadataFetch = createMetadataFetch(
    [],
    () => ({ version: '3.2.1' }),
    () => ({ react: '^19.0.0' }),
  )

  await assert.rejects(
    resolveExampleWorkspaceImports(
      workspace,
      workspace.files,
      new Set(['@example/ui', 'react']),
      { fetch: metadataFetch },
    ),
    /must map both react and react\//,
  )
})

test('externalizes complete explicit peers that source code does not import', async () => {
  const workspace = createExampleWorkspace({
    entry: '/index.ts',
    files: { '/index.ts': 'export {}' },
    imports: {
      react: 'https://esm.sh/react@18.3.1',
      'react/': 'https://esm.sh/react@18.3.1/',
    },
  })
  const metadataFetch = createMetadataFetch(
    [],
    () => ({ version: '3.2.1' }),
    () => ({ react: '^18.0.0' }),
  )

  const imports = await resolveExampleWorkspaceImports(
    workspace,
    workspace.files,
    new Set(['@example/ui']),
    { fetch: metadataFetch },
  )

  assert.deepEqual(imports, {
    '@example/ui': 'https://esm.sh/@example/ui@3.2.1?external=react',
    react: 'https://esm.sh/react@18.3.1',
    'react/': 'https://esm.sh/react@18.3.1/',
  })
})

test('resolves declared peers that source code does not import', async () => {
  const workspace = createExampleWorkspace({
    entry: '/index.ts',
    files: {
      '/index.ts': 'export {}',
      '/package.json': JSON.stringify({
        dependencies: {
          '@example/ui': '3.2.1',
          react: '18.3.1',
        },
      }),
    },
  })
  const metadataFetch = createMetadataFetch(
    [],
    (url) => ({
      version: url.includes('@example/ui') ? '3.2.1' : '18.3.1',
    }),
    (url): Record<string, string> =>
      url.includes('@example/ui') ? { react: '^18.0.0' } : {},
  )

  const imports = await resolveExampleWorkspaceImports(
    workspace,
    workspace.files,
    new Set(['@example/ui']),
    { fetch: metadataFetch },
  )

  assert.deepEqual(imports, {
    '@example/ui': 'https://esm.sh/@example/ui@3.2.1?external=react',
    react: 'https://esm.sh/react@18.3.1',
    'react/': 'https://esm.sh/react@18.3.1/',
  })
})

test('stops before resolving packages when already aborted', async () => {
  const workspace = createExampleWorkspace({
    entry: '/index.ts',
    files: { '/index.ts': 'export {}' },
  })
  const controller = new AbortController()
  controller.abort()
  const metadataFetch: ExampleImportMetadataFetch = async () => {
    throw new Error('Unexpected metadata request')
  }

  await assert.rejects(
    resolveExampleWorkspaceImports(
      workspace,
      workspace.files,
      new Set(['nanoid']),
      { fetch: metadataFetch, signal: controller.signal },
    ),
    (error) => error instanceof DOMException && error.name === 'AbortError',
  )
})

test('aborts an in-flight package metadata request', async () => {
  const workspace = createExampleWorkspace({
    entry: '/index.ts',
    files: { '/index.ts': 'export {}' },
  })
  const controller = new AbortController()
  let requestStarted: (() => void) | undefined
  const started = new Promise<void>((resolve) => {
    requestStarted = resolve
  })
  const metadataFetch: ExampleImportMetadataFetch = async (_input, init) => {
    requestStarted?.()
    return new Promise((_resolve, reject) => {
      const signal = init?.signal
      if (!signal) {
        reject(new Error('Missing request signal'))
        return
      }
      signal.addEventListener('abort', () => reject(signal.reason), {
        once: true,
      })
    })
  }
  const resolution = resolveExampleWorkspaceImports(
    workspace,
    workspace.files,
    new Set(['nanoid']),
    { fetch: metadataFetch, signal: controller.signal },
  )

  await started
  controller.abort()
  await assert.rejects(
    resolution,
    (error) => error instanceof DOMException && error.name === 'AbortError',
  )
})

test('preserves special and explicit mappings without resolving them', async () => {
  const workspace = createExampleWorkspace({
    entry: '/index.ts',
    files: { '/index.ts': 'export {}' },
    imports: { react: 'https://example.com/react.js' },
  })
  const metadataFetch: ExampleImportMetadataFetch = async () => {
    throw new Error('Unexpected metadata request')
  }

  const imports = await resolveExampleWorkspaceImports(
    workspace,
    workspace.files,
    new Set(['@tanstack/charts-data/alphabet', 'react']),
    { fetch: metadataFetch },
  )

  assert.equal(
    imports['@tanstack/charts-data/'],
    'https://esm.sh/gh/TanStack/charts@b8690671d677244848cff0eebd3d5dd0d5825b18/packages/charts-demo-data/src/',
  )
  assert.equal(imports.react, 'https://example.com/react.js')
})

test('ignores direct URLs and rejects unsafe package subpaths', async () => {
  const workspace = createExampleWorkspace({
    entry: '/index.ts',
    files: { '/index.ts': 'export {}' },
  })
  const metadataFetch: ExampleImportMetadataFetch = async () => {
    throw new Error('Unexpected metadata request')
  }

  assert.deepEqual(
    await resolveExampleWorkspaceImports(
      workspace,
      workspace.files,
      new Set(['https://example.com/module.js']),
      { fetch: metadataFetch },
    ),
    {},
  )
  await assert.rejects(
    resolveExampleWorkspaceImports(
      workspace,
      workspace.files,
      new Set(['example/%2e%2e/secret']),
      { fetch: metadataFetch },
    ),
    /Unsupported external module specifier/,
  )
  await assert.rejects(
    resolveExampleWorkspaceImports(
      workspace,
      workspace.files,
      new Set(['@tanstack/charts-data/../package.json']),
      { fetch: metadataFetch },
    ),
    /Unsupported external module specifier/,
  )
  await assert.rejects(
    resolveExampleWorkspaceImports(
      workspace,
      workspace.files,
      new Set(['node:fs']),
      { fetch: metadataFetch },
    ),
    /Unsupported external module specifier/,
  )
})

async function withExampleImportFetch<T>(
  fetch: ExampleImportMetadataFetch,
  run: () => Promise<T>,
) {
  const previous = globalThis.fetch
  globalThis.fetch = fetch as typeof globalThis.fetch
  try {
    return await run()
  } finally {
    globalThis.fetch = previous
  }
}

async function resolveExampleWorkspaceImports(
  workspace: Parameters<typeof resolveExampleWorkspaceImportsImpl>[0],
  files: Parameters<typeof resolveExampleWorkspaceImportsImpl>[1],
  specifiers?: Parameters<typeof resolveExampleWorkspaceImportsImpl>[2],
  options: {
    fetch?: ExampleImportMetadataFetch
    signal?: AbortSignal
  } = {},
) {
  const run = () =>
    resolveExampleWorkspaceImportsImpl(workspace, files, specifiers, {
      signal: options.signal ?? new AbortController().signal,
    })
  return options.fetch ? withExampleImportFetch(options.fetch, run) : run()
}

function createMetadataFetch(
  requests: Array<string>,
  getMetadata: (url: string) => {
    peerImports?: Array<string>
    version: string
  },
  getPeerDependencies: (url: string) => Record<string, string> = () => ({}),
): ExampleImportMetadataFetch {
  return async (input) => {
    const url = getRequestUrl(input)
    requests.push(url)
    if (url.startsWith('https://unpkg.com/')) {
      return new Response(
        JSON.stringify({ peerDependencies: getPeerDependencies(url) }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }
    return new Response(JSON.stringify(getMetadata(url)), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}
