import assert from 'node:assert/strict'
import test from 'node:test'
import { parseChartsCatalogManifest } from '../src/utils/charts-catalog'
import {
  comparisonAsset,
  createChartsCatalogManifest,
  datasetId,
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

test('catalog manifest accepts the generated v4 contract', () => {
  const manifest = parseChartsCatalogManifest(createChartsCatalogManifest())

  assert.equal(manifest.schemaVersion, 4)
  assert.equal(manifest.revision, sourceRevision)
  assert.equal(manifest.cases[0]?.id, '01-line')
  assert.equal(manifest.cases[0]?.modules.tanstack.path, tanstackAsset)
  assert.deepEqual(manifest.cases[0]?.authoredSource.tanstack.datasetIds, [
    datasetId,
  ])
  assert.equal(manifest.datasets[datasetId]?.records, 1_260)
  assert.deepEqual(Object.keys(manifest.assets).sort(), [
    comparisonAsset,
    sharedAsset,
    tanstackAsset,
  ])
})

test('catalog manifest rejects the retired v2 contract', () => {
  const manifest = createChartsCatalogManifest()
  manifest.schemaVersion = 2
  delete manifest.source.pathRoot
  delete manifest.datasets
  for (const catalogCase of manifest.cases) {
    delete catalogCase.authoredSource
  }

  assert.throws(() => parseChartsCatalogManifest(manifest))
})

expectRejected('an unsupported schema version', (manifest) => {
  manifest.schemaVersion = 3
})

expectRejected('a mutable or malformed source revision', (manifest) => {
  manifest.revision = 'main'
  manifest.source.ref = 'main'
})

expectRejected('an untrusted source repository', (manifest) => {
  manifest.source.repo = 'someone/charts'
})

expectRejected('a different authored source root', (manifest) => {
  manifest.source.pathRoot = 'examples/conformance/'
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

expectRejected('an unsafe case order', (manifest) => {
  manifest.cases[0].order = Number.MAX_SAFE_INTEGER + 1
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

expectRejected('a dataset key that differs from its id', (manifest) => {
  manifest.datasets[datasetId].id = 'different'
})

expectRejected('a dataset specifier that differs from its id', (manifest) => {
  manifest.datasets[datasetId].specifier = '@charts-poc/demo-data/different'
})

expectRejected('raw rows embedded in dataset metadata', (manifest) => {
  manifest.datasets[datasetId].rows = [{ Date: '2024-01-01', Close: 42 }]
})

expectRejected('source metadata for an unregistered dataset', (manifest) => {
  manifest.cases[0].authoredSource.tanstack.datasetIds = ['missing']
})

expectRejected('duplicate source dataset ids', (manifest) => {
  manifest.cases[0].authoredSource.tanstack.datasetIds = [datasetId, datasetId]
})

expectRejected('source totals that include harness code', (manifest) => {
  const closure = manifest.cases[0].authoredSource.tanstack
  closure.totalLines += closure.roles.harness.lines
})

expectRejected(
  'source role counts that differ from their paths',
  (manifest) => {
    manifest.cases[0].authoredSource.tanstack.roles.support.files += 1
  },
)

expectRejected('a harness path assigned to authored source', (manifest) => {
  manifest.cases[0].authoredSource.tanstack.roles.support.paths[0] =
    'shared/mount.ts'
})

expectRejected('a source path assigned to multiple roles', (manifest) => {
  manifest.cases[0].authoredSource.tanstack.roles.support.paths[0] =
    'cases/01-line/tanstack.ts'
})

expectRejected('authored source metadata with the wrong entry', (manifest) => {
  manifest.cases[0].authoredSource.tanstack.roles.entry.paths[0] =
    'cases/01-line/other.ts'
})

expectRejected(
  'a non-harness file assigned to the harness role',
  (manifest) => {
    manifest.cases[0].authoredSource.tanstack.roles.harness.paths[0] =
      'shared/helper.ts'
  },
)

test('catalog v4 accepts assets above 5 MiB through the 6 MiB limit', () => {
  const manifest = createChartsCatalogManifest()
  expandAssetClosureToSixMiB(manifest)

  assert.doesNotThrow(() => parseChartsCatalogManifest(manifest))
})

test('catalog v4 rejects assets above the 6 MiB limit', () => {
  const manifest = createChartsCatalogManifest()
  expandAssetClosureToSixMiB(manifest)
  const overflowAsset = 'assets/overflow-AbC_7.js'
  manifest.assets[overflowAsset] = {
    bytes: 1,
    sha256: 'f'.repeat(64),
    imports: [],
    dynamicImports: [],
  }
  manifest.assets[tanstackAsset].dynamicImports.push(overflowAsset)

  assert.throws(() => parseChartsCatalogManifest(manifest))
})

test('catalog v4 requires canonical preload order', () => {
  const manifest = createChartsCatalogManifest()
  const extraAsset = 'assets/extra-AbC_4.js'
  manifest.assets[extraAsset] = {
    bytes: 1,
    sha256: 'e'.repeat(64),
    imports: [],
    dynamicImports: [],
  }
  manifest.assets[tanstackAsset].imports.push(extraAsset)
  manifest.cases[0].modules.tanstack.preload = [sharedAsset, extraAsset]

  assert.throws(() => parseChartsCatalogManifest(manifest))
})

function expandAssetClosureToSixMiB(manifest: Record<string, any>) {
  const extraAssets = [
    'assets/extra-one-AbC_4.js',
    'assets/extra-two-AbC_5.js',
    'assets/extra-three-AbC_6.js',
  ]
  for (const assetPath of Object.keys(manifest.assets)) {
    manifest.assets[assetPath].bytes = 1024 * 1024
  }
  for (const [index, assetPath] of extraAssets.entries()) {
    manifest.assets[assetPath] = {
      bytes: 1024 * 1024,
      sha256: String(index + 4).repeat(64),
      imports: [],
      dynamicImports: [],
    }
  }
  manifest.assets[tanstackAsset].dynamicImports = extraAssets
}
