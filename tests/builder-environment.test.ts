import assert from 'node:assert/strict'
import test from 'node:test'
import { exampleEnvironmentNames } from '../src/utils/example-workspace'
import {
  exampleEnvironmentProfiles,
  generateBuilderLlmsTxt,
  builderImports,
  builderStarterSource,
} from '../src/utils/builder-environment'

test('uses TanStack category colors in the starter sandbox', () => {
  assert.match(builderStarterSource, /TanStack Sandbox/)
  assert.match(builderStarterSource, /Ready to build\./)
  assert.match(builderStarterSource, /Edit <code>\/index\.tsx<\/code>/)

  for (const color of [
    '#3aa3c4',
    '#39af46',
    '#d3481b',
    '#ffa216',
    '#61adbf',
    '#69bc75',
    '#e06e49',
    '#f4d648',
  ]) {
    assert.ok(builderStarterSource.includes(color))
  }
})

test('exposes unified Charts subpaths without duplicate framework runtimes', () => {
  assert.equal(
    builderImports['@tanstack/charts'],
    'https://esm.sh/@tanstack/charts@0.16.0',
  )
  assert.equal(
    builderImports['@tanstack/charts/'],
    'https://esm.sh/@tanstack/charts@0.16.0/',
  )

  assert.equal(
    builderImports['@tanstack/charts/react'],
    'https://esm.sh/@tanstack/charts@0.16.0/react?external=react,react-dom',
  )
  assert.equal(
    builderImports['@tanstack/charts/react/canvas'],
    'https://esm.sh/@tanstack/charts@0.16.0/react/canvas?external=react,react-dom',
  )
  assert.equal(
    builderImports['@tanstack/charts/react/core'],
    'https://esm.sh/@tanstack/charts@0.16.0/react/core?external=react,react-dom',
  )
  assert.equal(
    builderImports['@tanstack/charts/react/tooltip'],
    'https://esm.sh/@tanstack/charts@0.16.0/react/tooltip?external=react,react-dom',
  )
  assert.equal(
    builderImports['@tanstack/charts/octane'],
    'https://esm.sh/@tanstack/charts@0.16.0/octane?external=octane',
  )
  assert.equal(
    builderImports['@tanstack/charts/octane/canvas'],
    'https://esm.sh/@tanstack/charts@0.16.0/octane/canvas?external=octane',
  )
  assert.equal(
    builderImports['@tanstack/charts/octane/core'],
    'https://esm.sh/@tanstack/charts@0.16.0/octane/core?external=octane',
  )

  assert.equal(
    builderImports['octane/compiler'],
    'https://esm.sh/octane@0.1.13/compiler',
  )

  const guide = generateBuilderLlmsTxt()
  assert.match(guide, /group=counter env=charts-react/)
  assert.doesNotMatch(guide, /@tanstack\/charts-scales/)
  assert.doesNotMatch(guide, /@tanstack\/react-charts/)
})

test('provides hidden entry modules for every example environment', () => {
  for (const environment of exampleEnvironmentNames) {
    const profile = exampleEnvironmentProfiles[environment]
    assert.ok(profile)
    assert.equal(typeof profile.createEntrySource, 'function')
    assert.equal(profile.entryPath, '/__tanstack-example-entry.ts')
    assert.equal(profile.outputSelector, '#root')

    const source = profile.createEntrySource('/src/example.ts')
    assert.match(
      source,
      /let output = document\.querySelector<HTMLElement>\("#root"\)/,
    )
    assert.match(source, /output = document\.createElement\('div'\)/)
    assert.match(source, /output\.id = "root"/)
    assert.match(source, /document\.body\.append\(output\)/)
    assert.doesNotMatch(source, /Example root not found/)
  }

  const charts =
    exampleEnvironmentProfiles.charts.createEntrySource('/src/chart.ts')
  assert.match(charts, /mountChart/)
  assert.match(charts, /import definition from "\/src\/chart\.ts"/)

  const client =
    exampleEnvironmentProfiles.client.createEntrySource('/src/example.ts')
  assert.match(client, /typeof value === 'function'/)
  assert.match(client, /await value\(output\)/)
  assert.match(client, /value instanceof Node/)

  const genericReact =
    exampleEnvironmentProfiles.react.createEntrySource('/src/App.tsx')
  assert.match(genericReact, /createRoot/)
  assert.match(genericReact, /createElement\(App\)/)

  const react =
    exampleEnvironmentProfiles['charts-react'].createEntrySource('/src/App.tsx')
  assert.match(react, /createRoot/)
  assert.match(react, /createElement\(App\)/)

  const octane =
    exampleEnvironmentProfiles['charts-octane'].createEntrySource(
      '/src/App.tsrx',
    )
  assert.match(octane, /import \{ createRoot \} from 'octane'/)
  assert.match(octane, /root\.render\(App\)/)
})

test('exposes current Highlight and Markdown modules', () => {
  assert.equal(
    builderImports['@tanstack/highlight'],
    'https://esm.sh/@tanstack/highlight@0.0.10',
  )
  assert.equal(
    builderImports['@tanstack/highlight/'],
    'https://esm.sh/@tanstack/highlight@0.0.10/',
  )
  assert.equal(
    builderImports['@tanstack/markdown'],
    'https://esm.sh/@tanstack/markdown@0.0.13',
  )
  assert.equal(
    builderImports['@tanstack/markdown/'],
    'https://esm.sh/@tanstack/markdown@0.0.13/',
  )
  assert.equal(
    builderImports['@tanstack/markdown/react'],
    'https://esm.sh/@tanstack/markdown@0.0.13/react?external=react',
  )

  const guide = generateBuilderLlmsTxt()
  assert.match(guide, /`@tanstack\/highlight\/`/)
  assert.match(guide, /`@tanstack\/markdown\/`/)
  assert.match(guide, /`@tanstack\/markdown\/react`/)
  assert.match(guide, /runs once visible and idle/)
})
