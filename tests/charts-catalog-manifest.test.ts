import assert from 'node:assert/strict'
import test from 'node:test'
import { parseChartsCatalogManifest } from '../src/utils/charts-catalog'
import {
  comparisonAsset,
  createChartsCatalogManifest,
  sharedAsset,
  sourceRevision,
  tanstackAsset,
} from './charts-catalog-test-fixture'

function expectRejected(
  label: string,
  mutate: (manifest: Record<string, any>) => void,
) {
  test(`catalog manifest rejects ${label}`, () => {
    const manifest = createChartsCatalogManifest()
    mutate(manifest)
    assert.throws(() => parseChartsCatalogManifest(manifest))
  })
}

test('catalog manifest accepts the generated v2 contract', () => {
  const manifest = parseChartsCatalogManifest(createChartsCatalogManifest())

  assert.equal(manifest.schemaVersion, 2)
  assert.equal(manifest.revision, sourceRevision)
  assert.equal(manifest.cases[0]?.id, '01-line')
  assert.equal(manifest.cases[0]?.modules.tanstack.path, tanstackAsset)
  assert.deepEqual(Object.keys(manifest.assets).sort(), [
    comparisonAsset,
    sharedAsset,
    tanstackAsset,
  ])
})

expectRejected('an unsupported schema version', (manifest) => {
  manifest.schemaVersion = 1
})

expectRejected('a mutable or malformed source revision', (manifest) => {
  manifest.revision = 'main'
  manifest.source.ref = 'main'
})

expectRejected('an untrusted source repository', (manifest) => {
  manifest.source.repo = 'someone/charts'
})

expectRejected('a source ref that differs from its revision', (manifest) => {
  manifest.source.ref = '2'.repeat(40)
})

expectRejected('a different runtime export', (manifest) => {
  manifest.runtime.export = 'default'
})

expectRejected('a different site origin', (manifest) => {
  manifest.site.origin = 'https://example.com'
})

expectRejected('a non-HTTPS source URL', (manifest) => {
  manifest.cases[0].source.url = 'http://observablehq.com/plot/marks/line'
})

expectRejected('an altered embed protocol', (manifest) => {
  manifest.embed.protocol.version = 2
})

expectRejected('asset traversal', (manifest) => {
  manifest.assets['assets/../catalog.json'] = manifest.assets[tanstackAsset]
  delete manifest.assets[tanstackAsset]
  manifest.cases[0].modules.tanstack.path = 'assets/../catalog.json'
})

expectRejected('an asset with a malformed digest', (manifest) => {
  manifest.assets[tanstackAsset].sha256 = 'not-a-sha256'
})

expectRejected('an import outside the asset allowlist', (manifest) => {
  manifest.assets[tanstackAsset].imports = ['assets/missing-AbC_4.js']
})

expectRejected('a case module outside the asset allowlist', (manifest) => {
  manifest.cases[0].modules.tanstack.path = 'assets/missing-AbC_4.js'
})

expectRejected('an invalid static preload closure', (manifest) => {
  manifest.cases[0].modules.tanstack.preload = []
})

expectRejected('a non-debug comparison module', (manifest) => {
  manifest.cases[0].modules.comparison.visibility = 'public'
})

expectRejected('source-code traversal', (manifest) => {
  manifest.cases[0].code.tanstack = '../private.ts'
})

expectRejected('duplicate case ids', (manifest) => {
  manifest.cases.push(structuredClone(manifest.cases[0]))
})

expectRejected('a case id outside the producer format', (manifest) => {
  manifest.cases[0].id = '01_line'
  manifest.cases[0].routes = {
    page: '/charts/catalog/charts/01_line/',
    embed: '/charts/catalog/embed/01_line/',
  }
})

expectRejected('a TanStack source path for another case', (manifest) => {
  manifest.cases[0].code.tanstack =
    'benchmarks/conformance/cases/02-area/tanstack.ts'
})

expectRejected('a source path that disagrees with its renderer', (manifest) => {
  manifest.cases[0].code.reference =
    'benchmarks/conformance/cases/01-line/recharts.ts'
})

expectRejected(
  'a comparison renderer that disagrees with metadata',
  (manifest) => {
    manifest.cases[0].modules.comparison.renderer = 'recharts'
  },
)

expectRejected('a missing debug comparison module', (manifest) => {
  delete manifest.cases[0].modules.comparison
})

expectRejected('an asset larger than the producer limit', (manifest) => {
  manifest.assets[tanstackAsset].bytes = 1024 * 1024 + 1
})

expectRejected('an asset outside every implementation closure', (manifest) => {
  manifest.assets['assets/orphan-AbC_4.js'] = {
    bytes: 1,
    sha256: 'd'.repeat(64),
    imports: [],
    dynamicImports: [],
  }
})
