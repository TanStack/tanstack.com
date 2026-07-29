export const sourceRevision = '1'.repeat(40)
export const artifactRevision = '2'.repeat(40)
export const tanstackAsset = 'assets/tanstack-AbC_1.js'
export const sharedAsset = 'assets/shared-XyZ_2.js'
export const comparisonAsset = 'assets/plot-QrS_3.js'

export function createChartsCatalogManifest(): Record<string, any> {
  return {
    schemaVersion: 2,
    revision: sourceRevision,
    source: {
      repo: 'tanstack/charts',
      ref: sourceRevision,
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
          default: 360,
        },
        revision: {
          minimum: 0,
          maximum: 10_000,
          default: 0,
        },
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
