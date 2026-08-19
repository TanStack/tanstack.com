import assert from 'node:assert/strict'
import test from 'node:test'
import { getChartsCatalogIndexPublication } from '../src/utils/charts-catalog-index.server'
import {
  chartsCatalogIndexCacheHeaders,
  parseChartsCatalogIndex,
} from '../src/utils/charts-catalog-index'
import { resetGitHubContentCacheForTest } from '../src/utils/github-content-cache.server'

const revision = '1'.repeat(40)

function createCatalogCase(
  id = '01-line-gaps',
  order = 1,
  collection?: string,
) {
  return {
    schemaVersion: 1,
    order,
    id,
    ...(collection ? { collection } : {}),
    title: 'Apple stock line with seasonal gaps',
    family: 'trend',
    intent: 'Show gaps in a time series.',
    support: 'native',
    features: ['line', 'missing-values'],
    geometry: [{ role: 'line', count: 1 }],
    source: {
      title: 'Observable Plot line mark',
      url: 'https://observablehq.com/plot/marks/line',
    },
    ai: {
      create: 'Create the line chart.',
      maintain: 'Keep the gaps visible.',
    },
    entries: {
      example: `benchmarks/conformance/cases/${id}/example.tsx`,
    },
  }
}

function createCatalogIndex(collection?: string) {
  return {
    schemaVersion: 2,
    source: {
      repo: 'tanstack/charts',
      pathRoot: 'benchmarks/conformance/',
    },
    cases: [createCatalogCase('01-line-gaps', 1, collection)],
  }
}

function createLegacyCatalogIndex() {
  const catalogCase = createCatalogCase()
  return {
    schemaVersion: 1,
    source: {
      repo: 'tanstack/charts',
      pathRoot: 'benchmarks/conformance/',
    },
    cases: [
      {
        ...catalogCase,
        entries: {
          tanstack: 'benchmarks/conformance/cases/01-line-gaps/tanstack.ts',
          reference: {
            renderer: 'observable-plot',
            path: 'benchmarks/conformance/cases/01-line-gaps/plot.ts',
          },
        },
      },
    ],
  }
}

test('catalog index retains only the site-owned contract', () => {
  const index = parseChartsCatalogIndex(createCatalogIndex('shadcn'))

  assert.equal(index.cases[0]?.id, '01-line-gaps')
  assert.equal(index.cases[0]?.collection, 'shadcn')
  assert.equal('geometry' in (index.cases[0] ?? {}), false)
  assert.equal(
    chartsCatalogIndexCacheHeaders['Cache-Tag'],
    'docs:charts:branch:main',
  )
})

test('catalog index accepts the legacy adapter contract during rollout', () => {
  const index = parseChartsCatalogIndex(createLegacyCatalogIndex())

  assert.equal(index.schemaVersion, 1)
  assert.equal(index.cases[0]?.id, '01-line-gaps')
})

test('catalog index rejects broken case and ordering relationships', () => {
  const duplicate = createCatalogIndex()
  duplicate.cases.push(createCatalogCase('01-line-gaps', 2))
  assert.throws(() => parseChartsCatalogIndex(duplicate))

  const unsorted = createCatalogIndex()
  unsorted.cases.push(createCatalogCase('02-bars', 0))
  assert.throws(() => parseChartsCatalogIndex(unsorted))

  const mismatchedEntry = createCatalogIndex()
  mismatchedEntry.cases[0]!.entries.example =
    'benchmarks/conformance/cases/other/example.tsx'
  assert.throws(() => parseChartsCatalogIndex(mismatchedEntry))
})

test('catalog index publication resolves main and fetches the index at its exact SHA', async () => {
  resetGitHubContentCacheForTest()
  const originalFetch = globalThis.fetch
  const requests = new Array<string>()

  globalThis.fetch = async (input) => {
    const url = String(input)
    requests.push(url)

    if (
      url === 'https://api.github.com/repos/tanstack/charts/git/ref/heads/main'
    ) {
      return Response.json({ object: { sha: revision } })
    }

    if (
      url ===
      `https://raw.githubusercontent.com/tanstack/charts/${revision}/benchmarks/conformance/catalog-index.json`
    ) {
      return Response.json(createCatalogIndex())
    }

    return new Response('Not found', { status: 404 })
  }

  try {
    const first = await getChartsCatalogIndexPublication()
    const second = await getChartsCatalogIndexPublication()

    assert.equal(first.revision, revision)
    assert.equal(first.sourceKind, 'remote')
    assert.deepEqual(second, first)
    assert.equal(
      requests.filter((url) => url.includes('/git/ref/heads/main')).length,
      1,
    )
    assert.equal(
      requests.filter((url) => url.includes('/catalog-index.json')).length,
      1,
    )
    assert.equal(
      requests.some((url) => url.includes('/main/catalog-index.json')),
      false,
    )
  } finally {
    globalThis.fetch = originalFetch
    resetGitHubContentCacheForTest()
  }
})
