import assert from 'node:assert/strict'
import test from 'node:test'
import { parseChartsCatalogManifest } from '../src/utils/charts-catalog'
import {
  ChartsCatalogIntegrityError,
  getChartsCatalogAuthoredSource,
} from '../src/utils/charts-catalog.server'
import { resetGitHubContentCacheForTest } from '../src/utils/github-content-cache.server'
import {
  catalogSources,
  createChartsCatalogManifest,
  createChartsCatalogV2Manifest,
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

test('catalog v2 source loading preserves its entry-only fallback', async () => {
  const manifest = parseChartsCatalogManifest(createChartsCatalogV2Manifest())
  const requests = new Array<string>()
  const originalFetch = globalThis.fetch
  resetGitHubContentCacheForTest()
  globalThis.fetch = async (input) => {
    const url = String(input)
    requests.push(url)
    return new Response(catalogSources['cases/01-line/tanstack.ts'])
  }

  try {
    const source = await getChartsCatalogAuthoredSource(
      manifest,
      '01-line',
      'tanstack',
    )

    assert.equal(source.totalFiles, 1)
    assert.deepEqual(
      source.files.map((file) => file.path),
      ['benchmarks/conformance/cases/01-line/tanstack.ts'],
    )
    assert.deepEqual(source.datasets, [])
    assert.deepEqual(source.excludedHarness.paths, [])
    assert.deepEqual(requests, [
      `https://raw.githubusercontent.com/tanstack/charts/${sourceRevision}/benchmarks/conformance/cases/01-line/tanstack.ts`,
    ])
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
