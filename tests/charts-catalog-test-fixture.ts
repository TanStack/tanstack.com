export const sourceRevision = '1'.repeat(40)
export const artifactRevision = '2'.repeat(40)
export const tanstackAsset = 'assets/tanstack-AbC_1.js'
export const sharedAsset = 'assets/shared-XyZ_2.js'
export const comparisonAsset = 'assets/plot-QrS_3.js'
export const datasetId = 'aapl'

export const catalogSources: Record<string, string> = {
  'cases/01-line/tanstack.ts':
    "import { rows } from './data'\nimport { normalize } from '../../shared/transforms/normalize'\nexport { normalize, rows }\n",
  'cases/01-line/plot.ts':
    "import { rows } from './data'\nexport const chart = rows\n",
  'cases/01-line/data.ts':
    "import { aapl } from '@charts-poc/demo-data/aapl'\nexport const rows = aapl\n",
  'shared/transforms/normalize.ts':
    'export const normalize = (value: number) => value\n',
  'shared/mount.ts': 'export const mount = () => undefined\n',
}

export function createChartsCatalogManifest(): Record<string, any> {
  return {
    schemaVersion: 4,
    revision: sourceRevision,
    source: {
      repo: 'tanstack/charts',
      ref: sourceRevision,
      pathRoot: 'benchmarks/conformance/',
    },
    runtime: {
      contractVersion: 1,
      export: 'mount',
    },
    site: {
      origin: 'https://tanstack.com',
      basePath: '/charts/catalog/',
      assetBasePath: '/charts/catalog/assets/',
    },
    embed: {
      protocol: {
        type: 'tanstack-charts:embed',
        version: 1,
        statuses: ['ready', 'resize', 'error'],
        commands: ['set-theme'],
      },
      parameters: {
        theme: {
          values: ['system', 'light', 'dark'],
          default: 'system',
        },
        height: {
          minimum: 120,
          maximum: 1_200,
          default: 480,
        },
        revision: {
          minimum: 0,
          maximum: 10_000,
          default: 0,
        },
      },
    },
    datasets: {
      [datasetId]: {
        id: datasetId,
        title: 'Apple daily stock prices',
        specifier: '@charts-poc/demo-data/aapl',
        format: 'CSV',
        records: 1_260,
        fields: ['Date', 'Close'],
        schema: [
          { name: 'Date', types: ['Date'] },
          { name: 'Close', types: ['number'] },
        ],
        bytes: 92_399,
        sha256: 'd'.repeat(64),
        selection: 'Complete published snapshot',
        source: 'Yahoo! Finance',
        sourceUrl: 'https://finance.yahoo.com/lookup',
        observablePackage: '@observablehq/sample-datasets@1.0.1',
        observableRevision: '3'.repeat(40),
        observableFile: 'aapl.csv',
        observableUrl: `https://github.com/observablehq/sample-datasets/blob/${'3'.repeat(40)}/aapl.csv`,
        license: 'ISC distribution; upstream source credited',
      },
    },
    assets: {
      [tanstackAsset]: {
        bytes: 21,
        sha256: 'a'.repeat(64),
        imports: [sharedAsset],
        dynamicImports: [],
      },
      [sharedAsset]: {
        bytes: 13,
        sha256: 'b'.repeat(64),
        imports: [],
        dynamicImports: [],
      },
      [comparisonAsset]: {
        bytes: 17,
        sha256: 'c'.repeat(64),
        imports: [],
        dynamicImports: [],
      },
    },
    cases: [
      {
        schemaVersion: 1,
        referenceRenderer: 'observable-plot',
        order: 10,
        id: '01-line',
        title: 'Line',
        family: 'cartesian',
        intent: 'Show a line.',
        support: 'native',
        features: [],
        geometry: [],
        source: {
          title: 'Observable Plot line',
          url: 'https://observablehq.com/plot/marks/line',
        },
        ai: {
          create: 'Create a line.',
          maintain: 'Keep the line stable.',
        },
        routes: {
          page: '/charts/catalog/charts/01-line/',
          embed: '/charts/catalog/embed/01-line/',
        },
        code: {
          tanstack: 'benchmarks/conformance/cases/01-line/tanstack.ts',
          reference: 'benchmarks/conformance/cases/01-line/plot.ts',
        },
        authoredSource: {
          tanstack: createSourceClosure({
            entry: ['cases/01-line/tanstack.ts'],
            support: ['shared/transforms/normalize.ts'],
            fixture: ['cases/01-line/data.ts'],
            harness: ['shared/mount.ts'],
          }),
          reference: createSourceClosure({
            entry: ['cases/01-line/plot.ts'],
            support: [],
            fixture: ['cases/01-line/data.ts'],
            harness: ['shared/mount.ts'],
          }),
        },
        modules: {
          tanstack: {
            path: tanstackAsset,
            preload: [sharedAsset],
          },
          comparison: {
            renderer: 'observable-plot',
            path: comparisonAsset,
            preload: [],
            visibility: 'debug',
          },
        },
      },
    ],
  }
}

function createSourceClosure(paths: {
  entry: Array<string>
  support: Array<string>
  fixture: Array<string>
  harness: Array<string>
}) {
  const roles = {
    entry: createSourceRole(paths.entry),
    support: createSourceRole(paths.support),
    fixture: createSourceRole(paths.fixture),
    harness: createSourceRole(paths.harness),
  }
  return {
    totalFiles: roles.entry.files + roles.support.files + roles.fixture.files,
    totalLines: roles.entry.lines + roles.support.lines + roles.fixture.lines,
    totalBytes: roles.entry.bytes + roles.support.bytes + roles.fixture.bytes,
    datasetIds: [datasetId],
    roles,
  }
}

function createSourceRole(paths: Array<string>) {
  return paths.reduce(
    (metrics, path) => {
      const source = catalogSources[path]
      return {
        files: metrics.files + 1,
        lines: metrics.lines + countLines(source),
        bytes: metrics.bytes + new TextEncoder().encode(source).byteLength,
        paths: [...metrics.paths, path],
      }
    },
    { files: 0, lines: 0, bytes: 0, paths: new Array<string>() },
  )
}

function countLines(source: string) {
  if (source.length === 0) return 0
  const lineBreaks = source.match(/\r\n|\r|\n/g)?.length ?? 0
  return lineBreaks + (/(?:\r\n|\r|\n)$/.test(source) ? 0 : 1)
}
