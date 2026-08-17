import assert from 'node:assert/strict'
import test from 'node:test'
import { createExampleWorkspace } from '../src/utils/example-workspace'
import type { NotebookAiExecution } from '../src/utils/notebook-ai'
import {
  inspectNotebookAiModule,
  readNotebookAiPackageResource,
  resolveNotebookAiModule,
  searchNotebookAiPackageResources,
} from '../src/utils/notebook-ai-package-resources'

const clientExecution: NotebookAiExecution = {
  runtime: null,
  workspace: createExampleWorkspace({
    entry: '/index.tsx',
    files: { '/index.tsx': 'export default 1' },
  }),
}

test('resolves exact built-in and installed package versions', () => {
  assert.deepEqual(
    resolveNotebookAiModule(clientExecution, '@tanstack/charts/scales/band'),
    {
      specifier: '@tanstack/charts/scales/band',
      packageName: '@tanstack/charts',
      packageVersion: '0.13.0',
      exportKey: './scales/band',
    },
  )

  const installed: NotebookAiExecution = {
    runtime: {
      type: 'webcontainer',
      install: { command: 'pnpm', args: ['install'] },
      start: { command: 'pnpm', args: ['run', 'dev'] },
    },
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      files: {
        '/index.tsx': 'export default 1',
        '/package.json': JSON.stringify({
          dependencies: { '@tanstack/charts': '0.14.0' },
        }),
      },
    }),
  }
  assert.equal(
    resolveNotebookAiModule(installed, '@tanstack/charts/react').packageVersion,
    '0.14.0',
  )

  const ranged: NotebookAiExecution = {
    ...installed,
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      files: {
        '/index.tsx': 'export default 1',
        '/package.json': JSON.stringify({
          dependencies: { '@tanstack/charts': '^0.14.0' },
        }),
      },
    }),
  }
  assert.throws(
    () => resolveNotebookAiModule(ranged, '@tanstack/charts'),
    /must use an exact version/,
  )
})

test('inspects exact module exports and declarations', async () => {
  const fetcher = createFetcher({
    'https://unpkg.com/@tanstack/charts@0.13.0/package.json': JSON.stringify({
      exports: {
        './scales/band': {
          types: './dist/scales/band.d.ts',
          import: './dist/scales/band.js',
        },
      },
    }),
    'https://unpkg.com/@tanstack/charts@0.13.0/dist/scales/band.d.ts':
      'export declare function scaleBand(): BandScale;\nexport type { BandScale };',
    'https://unpkg.com/@tanstack/charts@0.13.0/dist/scales/band.js':
      'function scaleBand() {}\nexport { scaleBand };',
  })

  const result = await inspectNotebookAiModule(
    clientExecution,
    '@tanstack/charts/scales/band',
    { fetcher },
  )

  assert.deepEqual(result.detectedRuntimeExports, ['scaleBand'])
  assert.deepEqual(result.detectedDeclarationExports, [
    'BandScale',
    'scaleBand',
  ])
  assert.equal(result.typesPath, '/dist/scales/band.d.ts')
  assert.equal(result.sourcePath, '/dist/scales/band.js')
  assert.match(result.declarations ?? '', /scaleBand/)
  assert.doesNotMatch(result.declarations ?? '', /function band/)
})

test('matches the exports shipped by the pinned Charts package', async () => {
  const bandModule = await import('@tanstack/charts/scales/band')

  assert.deepEqual(Object.keys(bandModule), ['scaleBand'])
})

test('searches bounded docs, declarations, and trusted TanStack skills', async () => {
  const metadata = JSON.stringify({
    files: [
      {
        path: '/skills/debug-charts/SKILL.md',
        size: 120,
        type: 'text/markdown',
      },
      {
        path: '/docs/scales/band.md',
        size: 80,
        type: 'text/markdown',
      },
      {
        path: '/dist/scales/band.d.ts',
        size: 40,
        type: 'text/typescript',
      },
      { path: '/LICENSE', size: 20, type: 'text/plain' },
    ],
  })
  const fetcher = createFetcher({
    'https://unpkg.com/@tanstack/charts@0.13.0/?meta': metadata,
  })

  const result = await searchNotebookAiPackageResources(
    clientExecution,
    '@tanstack/charts',
    'band',
    { fetcher },
  )
  assert.deepEqual(
    result.resources.map(({ path }) => path),
    ['/docs/scales/band.md', '/dist/scales/band.d.ts'],
  )

  const all = await searchNotebookAiPackageResources(
    clientExecution,
    '@tanstack/charts',
    '',
    { fetcher },
  )
  assert.equal(all.resources[0]?.path, '/skills/debug-charts/SKILL.md')
  assert.equal(
    all.resources.some(({ path }) => path === '/LICENSE'),
    false,
  )
})

test('reads package resources in chunks and trusts only TanStack skills', async () => {
  const skill = 'Use scaleBand from the exact scale subpath.'
  const fetcher = createFetcher({
    'https://unpkg.com/@tanstack/charts@0.13.0/skills/design/SKILL.md': skill,
  })
  const result = await readNotebookAiPackageResource(
    clientExecution,
    '@tanstack/charts',
    '/skills/design/SKILL.md',
    4,
    { fetcher },
  )
  assert.equal(result.content, skill.slice(4))
  assert.equal(result.offset, 4)
  assert.equal(result.nextOffset, null)

  const reactExecution: NotebookAiExecution = {
    runtime: null,
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      files: { '/index.tsx': 'export default 1' },
    }),
  }
  await assert.rejects(
    readNotebookAiPackageResource(
      reactExecution,
      'react',
      '/skills/untrusted/SKILL.md',
      0,
      { fetcher },
    ),
    /not readable/,
  )
  await assert.rejects(
    readNotebookAiPackageResource(
      clientExecution,
      '@tanstack/charts',
      '/docs/../package.json',
      0,
      { fetcher },
    ),
    /Invalid package resource path/,
  )
  await assert.rejects(
    readNotebookAiPackageResource(
      clientExecution,
      '@tanstack/charts',
      '/skills/%2e%2e/%2e%2e/@evil/package/skills/SKILL.md',
      0,
      { fetcher },
    ),
    /Invalid package resource path/,
  )
})

test('rejects oversized package responses before reading them', async () => {
  const fetcher: typeof fetch = async () =>
    new Response('small', {
      headers: { 'content-length': String(3 * 1024 * 1024) },
    })

  await assert.rejects(
    searchNotebookAiPackageResources(clientExecution, '@tanstack/charts', '', {
      fetcher,
    }),
    /exceeds/,
  )
})

function createFetcher(responses: Record<string, string>): typeof fetch {
  return async (input) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    const body = responses[url]
    if (body === undefined) return new Response('Not found', { status: 404 })
    return new Response(body, {
      headers: {
        'content-type':
          url.endsWith('package.json') || url.endsWith('?meta')
            ? 'application/json'
            : 'text/plain',
      },
    })
  }
}
