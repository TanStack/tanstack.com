import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  createChartsCatalogExampleDefinition,
  type ChartsCatalogExampleVersions,
} from '../src/utils/charts-catalog-example'

const revision = 'b8690671d677244848cff0eebd3d5dd0d5825b18'
const versions: ChartsCatalogExampleVersions = {
  charts: '0.9.0',
  react: '19.2.3',
  reactDom: '19.2.3',
  dependencies: {
    'd3-scale': '4.0.2',
    'topojson-client': '3.1.0',
    'world-atlas': '2.0.2',
    'us-atlas': '3.0.1',
  },
}

describe('Charts catalog example workspaces', () => {
  test('preserves Git source files and generates a runnable workspace', () => {
    const entrySource = `import { tanstackMount } from '../../shared/mount'\nexport const mount = tanstackMount(() => ({}), 'Sorted bars')`
    const mountSource = `export function tanstackMount() {}`
    const typesSource = `export interface ConformanceInput { width: number }`
    const definition = createChartsCatalogExampleDefinition({
      caseId: 'bar-vertical-sorted',
      title: 'Sorted vertical bars',
      description: 'Compare English letter frequencies.',
      revision,
      entryPath: 'benchmarks/conformance/cases/bar-vertical-sorted/tanstack.ts',
      files: {
        'benchmarks/conformance/cases/bar-vertical-sorted/tanstack.ts':
          entrySource,
        'benchmarks/conformance/shared/mount.ts': mountSource,
        'benchmarks/conformance/types.ts': typesSource,
      },
      versions,
    })

    assert.equal(definition.id, 'bar-vertical-sorted')
    assert.equal(
      definition.initialFile,
      '/cases/bar-vertical-sorted/tanstack.ts',
    )
    assert.equal(definition.workspace.entry, '/__catalog.ts')
    assert.equal(
      definition.workspace.files['/cases/bar-vertical-sorted/tanstack.ts'],
      entrySource,
    )
    assert.equal(definition.workspace.files['/shared/mount.ts'], mountSource)
    assert.equal(definition.workspace.files['/types.ts'], typesSource)
    assert.equal(definition.workspace.files['/package.json'], undefined)
    assert.match(
      definition.workspace.files['/__catalog.ts'] ?? '',
      /import \{ mount \} from "\/cases\/bar-vertical-sorted\/tanstack\.ts"/,
    )
    assert.match(
      definition.workspace.files['/__catalog.ts'] ?? '',
      /new ResizeObserver/,
    )
    assert.match(
      definition.workspace.files['/index.html'] ?? '',
      /<div id="root"><\/div>/,
    )
  })

  test('pins framework, dependency, atlas, and dataset imports', () => {
    const definition = createChartsCatalogExampleDefinition({
      caseId: 'bar-vertical-sorted',
      title: 'Sorted vertical bars',
      revision,
      entryPath: 'cases/bar-vertical-sorted/tanstack.ts',
      files: {
        '/cases/bar-vertical-sorted/tanstack.ts': 'export function mount() {}',
      },
      versions,
    })
    const imports = definition.workspace.imports

    assert.deepEqual(imports, {
      '@charts-poc/demo-data/': `https://esm.sh/gh/TanStack/charts@${revision}/packages/charts-demo-data/src/`,
      '@tanstack/charts': 'https://esm.sh/@tanstack/charts@0.9.0',
      '@tanstack/charts/': 'https://esm.sh/@tanstack/charts@0.9.0/',
      '@tanstack/charts/react':
        'https://esm.sh/@tanstack/charts@0.9.0/react?external=react',
      '@tanstack/charts/react/core':
        'https://esm.sh/@tanstack/charts@0.9.0/react/core?external=react',
      '@tanstack/charts/react/tooltip':
        'https://esm.sh/@tanstack/charts@0.9.0/react/tooltip?external=react,react-dom',
      '@tanstack/charts-data/': `https://esm.sh/gh/TanStack/charts@${revision}/packages/charts-demo-data/src/`,
      'd3-scale': 'https://esm.sh/d3-scale@4.0.2',
      'd3-scale/': 'https://esm.sh/d3-scale@4.0.2/',
      react: 'https://esm.sh/react@19.2.3',
      'react/': 'https://esm.sh/react@19.2.3/',
      'react/jsx-dev-runtime': 'https://esm.sh/react@19.2.3/jsx-dev-runtime',
      'react/jsx-runtime': 'https://esm.sh/react@19.2.3/jsx-runtime',
      'react-dom': 'https://esm.sh/react-dom@19.2.3',
      'react-dom/': 'https://esm.sh/react-dom@19.2.3/',
      'react-dom/client': 'https://esm.sh/react-dom@19.2.3/client',
      'topojson-client': 'https://esm.sh/topojson-client@3.1.0',
      'topojson-client/': 'https://esm.sh/topojson-client@3.1.0/',
      'us-atlas': 'https://esm.sh/us-atlas@3.0.1',
      'us-atlas/': 'https://esm.sh/us-atlas@3.0.1/',
      'world-atlas': 'https://esm.sh/world-atlas@2.0.2',
      'world-atlas/': 'https://esm.sh/world-atlas@2.0.2/',
    })
  })

  test('configures embed height and render revision without compiled assets', () => {
    const definition = createChartsCatalogExampleDefinition({
      caseId: 'bar-vertical-sorted',
      title: 'Sorted vertical bars',
      chartHeight: 640,
      renderRevision: 42,
      revision,
      entryPath: 'cases/bar-vertical-sorted/tanstack.ts',
      files: {
        '/cases/bar-vertical-sorted/tanstack.ts': 'export function mount() {}',
      },
      versions,
    })

    assert.match(
      definition.workspace.files['/__catalog.ts'] ?? '',
      /const height = 640/,
    )
    assert.match(
      definition.workspace.files['/__catalog.ts'] ?? '',
      /revision: 42/,
    )
    assert.match(
      definition.workspace.files['/index.html'] ?? '',
      /#root \{ width: 100%; height: 640px;/,
    )
  })

  test('rejects missing, mismatched, duplicate, or unsafe source paths', () => {
    const base = {
      caseId: 'bar-vertical-sorted',
      title: 'Sorted vertical bars',
      revision,
      entryPath: 'cases/bar-vertical-sorted/tanstack.ts',
      versions,
    }

    assert.throws(() =>
      createChartsCatalogExampleDefinition({ ...base, files: {} }),
    )
    assert.throws(() =>
      createChartsCatalogExampleDefinition({
        ...base,
        entryPath: 'cases/another-case/tanstack.ts',
        files: {
          'cases/another-case/tanstack.ts': 'export function mount() {}',
        },
      }),
    )
    assert.throws(() =>
      createChartsCatalogExampleDefinition({
        ...base,
        files: {
          'cases/bar-vertical-sorted/tanstack.ts': 'first',
          'benchmarks/conformance/cases/bar-vertical-sorted/tanstack.ts':
            'second',
        },
      }),
    )
    assert.throws(() =>
      createChartsCatalogExampleDefinition({
        ...base,
        files: {
          'cases/bar-vertical-sorted/tanstack.ts': 'entry',
          'cases/bar-vertical-sorted/../other.ts': 'unsafe',
        },
      }),
    )
  })
})
