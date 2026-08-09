import assert from 'node:assert/strict'
import test from 'node:test'
import { parseChartsCatalogManifest } from '../src/utils/charts-catalog'
import {
  ChartsCatalogIntegrityError,
  getChartsCatalogAuthoredSource,
  getChartsCatalogExampleDefinition,
} from '../src/utils/charts-catalog.server'
import { resetGitHubContentCacheForTest } from '../src/utils/github-content-cache.server'
import {
  catalogSources,
  createChartsCatalogManifest,
  datasetId,
  sourceRevision,
} from './charts-catalog-test-fixture'

test('catalog v4 loads complete authored source roles without harness code', async () => {
  const manifest = parseChartsCatalogManifest(createChartsCatalogManifest())
  const requests = new Array<string>()
  const originalFetch = globalThis.fetch
  resetGitHubContentCacheForTest()
  globalThis.fetch = createSourceFetch(requests)

  try {
    const tanstack = await getChartsCatalogAuthoredSource(
      manifest,
      '01-line',
      'tanstack',
    )
    const reference = await getChartsCatalogAuthoredSource(
      manifest,
      '01-line',
      'reference',
    )

    assert.deepEqual(
      tanstack.files.map((file) => [file.kind, file.path]),
      [
        ['entry', 'cases/01-line/tanstack.ts'],
        ['support', 'shared/transforms/normalize.ts'],
        ['fixture', 'cases/01-line/data.ts'],
      ],
    )
    assert.deepEqual(
      reference.files.map((file) => [file.kind, file.path]),
      [
        ['entry', 'cases/01-line/plot.ts'],
        ['fixture', 'cases/01-line/data.ts'],
      ],
    )
    assert.deepEqual(tanstack.excludedHarness.paths, ['shared/mount.ts'])
    const dataset = tanstack.datasets[0]
    assert.ok(dataset)
    assert.equal(dataset.id, datasetId)
    assert.equal('rows' in dataset, false)
    assert.equal(
      requests.some((url) => url.endsWith('/shared/mount.ts')),
      false,
    )
  } finally {
    globalThis.fetch = originalFetch
    resetGitHubContentCacheForTest()
  }
})

test('catalog source loading verifies v4 role metrics against immutable files', async () => {
  const manifest = parseChartsCatalogManifest(createChartsCatalogManifest())
  const originalFetch = globalThis.fetch
  resetGitHubContentCacheForTest()
  globalThis.fetch = async (input) => {
    const url = String(input)
    const path = url.split('/benchmarks/conformance/')[1]
    const source = catalogSources[path]
    return new Response(
      path === 'shared/transforms/normalize.ts' ? `${source} ` : source,
    )
  }

  try {
    await assert.rejects(
      getChartsCatalogAuthoredSource(manifest, '01-line', 'tanstack'),
      ChartsCatalogIntegrityError,
    )
  } finally {
    globalThis.fetch = originalFetch
    resetGitHubContentCacheForTest()
  }
})

test('catalog examples follow the runnable source graph without a case package manifest', async () => {
  const manifest = parseChartsCatalogManifest(createChartsCatalogManifest())
  const originalFetch = globalThis.fetch
  const sources: Record<string, string> = {
    ...catalogSources,
    'cases/01-line/tanstack.ts': [
      "import { rows } from './data'",
      "import { normalize } from '../../shared/transforms/normalize'",
      "import { tanstackMount } from '../../shared/mount'",
      'export const mount = tanstackMount(() => ({ rows, normalize }))',
    ].join('\n'),
    'shared/mount.ts': [
      "import type { ConformanceInput } from '../types'",
      'export const tanstackMount =',
      '  (create: (input: ConformanceInput) => unknown) => () => ({',
      '    update: create,',
      '    destroy() {},',
      '  })',
    ].join('\n'),
    'types.ts': 'export type ConformanceInput = { width: number }',
    'packages/charts-core/package.json': JSON.stringify({ version: '0.7.2' }),
    'packages/react-charts/package.json': JSON.stringify({ version: '0.7.2' }),
    'packages/react-charts-catalog/package.json': JSON.stringify({
      dependencies: {
        '@tanstack/charts': 'workspace:*',
        'd3-scale': '4.0.2',
      },
    }),
    'package.json': JSON.stringify({
      devDependencies: {
        react: '19.2.3',
        'react-dom': '19.2.3',
        'topojson-client': '3.1.0',
        'us-atlas': '3.0.1',
        'world-atlas': '2.0.2',
      },
    }),
  }
  resetGitHubContentCacheForTest()
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.includes('/git/trees/')) {
      return Response.json({
        tree: Object.keys(sources).map((path) => ({
          path:
            path === 'package.json' || path.startsWith('packages/')
              ? path
              : `benchmarks/conformance/${path}`,
          sha: '4'.repeat(40),
          type: 'blob',
          url: `https://api.github.com/blob/${path}`,
        })),
      })
    }

    const path = url.split(`/${sourceRevision}/`)[1]
    const relativePath = path?.startsWith('benchmarks/conformance/')
      ? path.slice('benchmarks/conformance/'.length)
      : path
    const source = relativePath ? sources[relativePath] : undefined
    return source === undefined
      ? new Response('Not found', { status: 404 })
      : new Response(source)
  }

  try {
    const definition = await getChartsCatalogExampleDefinition(
      manifest,
      '01-line',
    )

    assert.equal(definition.initialFile, '/cases/01-line/tanstack.ts')
    assert.deepEqual(Object.keys(definition.workspace.files).sort(), [
      '/__catalog.ts',
      '/cases/01-line/data.ts',
      '/cases/01-line/tanstack.ts',
      '/index.html',
      '/shared/mount.ts',
      '/shared/transforms/normalize.ts',
      '/types.ts',
    ])
    assert.equal(definition.workspace.files['/package.json'], undefined)
    assert.equal(
      definition.workspace.imports?.['d3-scale'],
      'https://esm.sh/d3-scale@4.0.2',
    )
  } finally {
    globalThis.fetch = originalFetch
    resetGitHubContentCacheForTest()
  }
})

function createSourceFetch(requests: Array<string>) {
  return async (input: string | URL | Request) => {
    const url = String(input)
    requests.push(url)
    const path = url.split('/benchmarks/conformance/')[1]
    const source = catalogSources[path]
    return source === undefined
      ? new Response('Not found', { status: 404 })
      : new Response(source)
  }
}
