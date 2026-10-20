import assert from 'node:assert/strict'
import test from 'node:test'
import { getChartsCatalogExample } from '../src/utils/charts-catalog.server'
import { parseChartsCatalogIndexPublication } from '../src/utils/charts-catalog-index'
import { resetGitHubContentCacheForTest } from '../src/utils/github-content-cache.server'

const revision = '4'.repeat(40)
const entryPath = 'benchmarks/conformance/cases/01-line/example.tsx'
const legacyEntryPath = 'benchmarks/conformance/cases/01-line/tanstack.ts'
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
    schemaVersion: 2,
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
          example: entryPath,
        },
      },
    ],
  },
})

const legacyPublication = parseChartsCatalogIndexPublication({
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
          tanstack: legacyEntryPath,
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
    'export default function Example() {',
    '  return <pre>{JSON.stringify(rows)}</pre>',
    '}',
  ].join('\n'),
  'benchmarks/conformance/cases/01-line/data.ts':
    'export const rows = [{ x: 1, y: 2 }]',
  'packages/charts-core/package.json': JSON.stringify({ version: '0.10.0' }),
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

    assert.equal(example.initialFile, '/cases/01-line/example.tsx')
    assert.deepEqual(Object.keys(example.workspace.files).sort(), [
      '/__catalog.tsx',
      '/cases/01-line/data.ts',
      '/cases/01-line/example.tsx',
      '/index.html',
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
        ['entry', 'cases/01-line/example.tsx'],
      ],
    )
  } finally {
    globalThis.fetch = originalFetch
    resetGitHubContentCacheForTest()
  }
})

test('catalog example follows a legacy adapter closure during rollout', async () => {
  const originalFetch = globalThis.fetch
  resetGitHubContentCacheForTest()
  globalThis.fetch = createSourceFetch({
    ...sources,
    [legacyEntryPath]:
      "import { mountExample } from '../../shared/mount'\nexport const mount = mountExample",
    'benchmarks/conformance/shared/mount.ts':
      'export function mountExample() {}',
  })

  try {
    const { authoredSource, example } = await getChartsCatalogExample(
      legacyPublication,
      '01-line',
    )

    assert.equal(example.initialFile, '/cases/01-line/tanstack.ts')
    assert.deepEqual(
      authoredSource.files.map((file) => file.path),
      ['cases/01-line/tanstack.ts', 'shared/mount.ts'],
    )
    assert.match(
      example.workspace.files['/__catalog.tsx'] ?? '',
      /import \{ mount \}/,
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

for (const prefix of ['@tanstack/charts-data/', '@charts-poc/demo-data/']) {
  test(`catalog example includes ${prefix} data and its source dependencies`, async () => {
    const originalFetch = globalThis.fetch
    const dataRoot = 'packages/charts-demo-data/src/'
    const entrySource = `import { rows } from '${prefix}shadcn'
export default function Example() { return <pre>{JSON.stringify(rows)}</pre> }`
    const dataSources = {
      [`${dataRoot}shadcn.ts`]: "export { rows } from './nested/rows'",
      [`${dataRoot}nested/rows.ts`]: [
        "import { value } from '@tanstack/charts-data/values'",
        "import { parse } from '../parse.js'",
        'export const rows = [parse(value)]',
      ].join('\n'),
      [`${dataRoot}values.js`]: 'export const value = "42"',
      [`${dataRoot}parse.js`]: 'export const parse = Number',
    }
    const requests: Array<string> = []
    const fetchSource = createSourceFetch({
      ...sources,
      ...dataSources,
      [entryPath]: entrySource,
    })
    resetGitHubContentCacheForTest()
    globalThis.fetch = (input) => {
      requests.push(String(input))
      return fetchSource(input)
    }

    try {
      const { authoredSource, example } = await getChartsCatalogExample(
        publication,
        '01-line',
      )

      assert.equal(
        example.workspace.files['/cases/01-line/example.tsx'],
        entrySource,
      )
      for (const [path, source] of Object.entries(dataSources)) {
        assert.equal(example.workspace.files[`/${path}`], source)
        assert.equal(
          authoredSource.files.find((file) => file.path === path)?.source,
          source,
        )
        assert.equal(
          requests.filter((url) => url.endsWith(`/${revision}/${path}`)).length,
          1,
        )
      }
      assert.equal(
        requests.some((url) => url.startsWith('https://esm.sh/')),
        false,
      )
    } finally {
      globalThis.fetch = originalFetch
      resetGitHubContentCacheForTest()
    }
  })
}

for (const scenario of [
  {
    name: 'example relative import',
    entrySource: "import '../../shared/data'",
    dataSource: '',
    outsidePath: 'benchmarks/conformance/shared/data.ts',
  },
  {
    name: 'data relative import',
    entrySource: "import '@tanstack/charts-data/shadcn'",
    dataSource: "import '../private'",
    outsidePath: 'packages/charts-demo-data/private.ts',
  },
  {
    name: 'data alias traversal',
    entrySource: "import '@tanstack/charts-data/../private'",
    dataSource: '',
    outsidePath: 'packages/charts-demo-data/private.ts',
  },
  {
    name: 'legacy data alias traversal',
    entrySource: "import '@charts-poc/demo-data/../private'",
    dataSource: '',
    outsidePath: 'packages/charts-demo-data/private.ts',
  },
]) {
  test(`catalog example rejects an escaping ${scenario.name} before fetching it`, async () => {
    const originalFetch = globalThis.fetch
    const requests: Array<string> = []
    const fetchSource = createSourceFetch({
      ...sources,
      [entryPath]: scenario.entrySource,
      'packages/charts-demo-data/src/shadcn.ts': scenario.dataSource,
      [scenario.outsidePath]: 'export const secret = true',
    })
    resetGitHubContentCacheForTest()
    globalThis.fetch = (input) => {
      requests.push(String(input))
      return fetchSource(input)
    }

    try {
      await assert.rejects(
        getChartsCatalogExample(publication, '01-line'),
        /import leaves its allowed directory/,
      )
      assert.equal(
        requests.some((url) => url.endsWith(`/${scenario.outsidePath}`)),
        false,
      )
    } finally {
      globalThis.fetch = originalFetch
      resetGitHubContentCacheForTest()
    }
  })
}

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
