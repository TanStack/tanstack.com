import assert from 'node:assert/strict'
import test from 'node:test'
import { getChartsCatalogExample } from '../src/utils/charts-catalog.server'
import { parseChartsCatalogIndexPublication } from '../src/utils/charts-catalog-index'
import { resetGitHubContentCacheForTest } from '../src/utils/github-content-cache.server'

const revision = '4'.repeat(40)
const entryPath = 'benchmarks/conformance/cases/01-line/tanstack.ts'
const dependencyVersions = Object.fromEntries(
  [
    'd3-array',
    'd3-brush',
    'd3-contour',
    'd3-delaunay',
    'd3-force',
    'd3-format',
    'd3-geo',
    'd3-hexbin',
    'd3-hierarchy',
    'd3-interpolate',
    'd3-sankey',
    'd3-scale',
    'd3-selection',
    'd3-shape',
    'd3-time',
    'd3-zoom',
    'topojson-client',
    'us-atlas',
    'world-atlas',
  ].map((name) => [name, '1.2.3']),
)

const publication = parseChartsCatalogIndexPublication({
  revision,
  sourceKind: 'remote',
  index: {
    schemaVersion: 1,
    source: {
      repo: 'tanstack/charts',
      pathRoot: 'benchmarks/conformance/',
    },
    cases: [
      {
        schemaVersion: 1,
        order: 1,
        id: '01-line',
        title: 'Line chart',
        family: 'trend',
        intent: 'Show a line.',
        support: 'native',
        features: ['line'],
        source: {
          title: 'Source',
          url: 'https://example.com/source',
        },
        ai: {
          create: 'Create a line chart.',
          maintain: 'Keep the line visible.',
        },
        entries: {
          tanstack: entryPath,
          reference: {
            renderer: 'observable-plot',
            path: 'benchmarks/conformance/cases/01-line/plot.ts',
          },
        },
      },
    ],
  },
})

const sources: Record<string, string> = {
  [entryPath]: [
    "import { rows } from './data'",
    "import { tanstackMount } from '../../shared/mount'",
    'export const mount = tanstackMount(() => rows)',
  ].join('\n'),
  'benchmarks/conformance/cases/01-line/data.ts':
    'export const rows = [{ x: 1, y: 2 }]',
  'benchmarks/conformance/shared/mount.ts': [
    "import type { ConformanceInput } from '../types'",
    'export const tanstackMount =',
    '  (create: (input: ConformanceInput) => unknown) => () => ({',
    '    update: create,',
    '    destroy() {},',
    '  })',
  ].join('\n'),
  'benchmarks/conformance/types.ts':
    'export type ConformanceInput = { width: number }',
  'packages/charts-core/package.json': JSON.stringify({ version: '0.7.2' }),
  'packages/react-charts/package.json': JSON.stringify({ version: '0.7.2' }),
  'package.json': JSON.stringify({
    devDependencies: {
      ...dependencyVersions,
      react: '19.2.3',
      'react-dom': '19.2.3',
    },
  }),
}

test('catalog example follows Git source without a catalog package or build output', async () => {
  const originalFetch = globalThis.fetch
  resetGitHubContentCacheForTest()
  globalThis.fetch = createSourceFetch(sources)

  try {
    const { authoredSource, example } = await getChartsCatalogExample(
      publication,
      '01-line',
    )

    assert.equal(example.initialFile, '/cases/01-line/tanstack.ts')
    assert.deepEqual(Object.keys(example.workspace.files).sort(), [
      '/__catalog.ts',
      '/cases/01-line/data.ts',
      '/cases/01-line/tanstack.ts',
      '/index.html',
      '/shared/mount.ts',
      '/types.ts',
    ])
    assert.equal(example.workspace.files['/package.json'], undefined)
    assert.equal(
      example.workspace.imports?.['d3-scale'],
      'https://esm.sh/d3-scale@1.2.3',
    )
    assert.deepEqual(
      authoredSource.files.map((file) => [file.kind, file.path]),
      [
        ['dependency', 'cases/01-line/data.ts'],
        ['entry', 'cases/01-line/tanstack.ts'],
        ['dependency', 'shared/mount.ts'],
        ['dependency', 'types.ts'],
      ],
    )
  } finally {
    globalThis.fetch = originalFetch
    resetGitHubContentCacheForTest()
  }
})

test('catalog example rejects an unresolved relative source import', async () => {
  const originalFetch = globalThis.fetch
  resetGitHubContentCacheForTest()
  globalThis.fetch = createSourceFetch({
    ...sources,
    [entryPath]: "import './missing'\nexport function mount() {}",
  })

  try {
    await assert.rejects(getChartsCatalogExample(publication, '01-line'))
  } finally {
    globalThis.fetch = originalFetch
    resetGitHubContentCacheForTest()
  }
})

function createSourceFetch(files: Record<string, string>) {
  return async (input: string | URL | Request) => {
    const url = String(input)
    if (url.includes('/git/trees/')) {
      return Response.json({
        tree: Object.keys(files).map((path) => ({
          path,
          sha: '5'.repeat(40),
          type: 'blob',
          url: `https://api.github.com/blob/${path}`,
        })),
      })
    }

    const path = url.split(`/${revision}/`)[1]
    const source = path ? files[path] : undefined
    return source === undefined
      ? new Response('Not found', { status: 404 })
      : new Response(source)
  }
}
