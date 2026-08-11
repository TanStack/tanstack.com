import assert from 'node:assert/strict'
import test from 'node:test'
import { exampleEnvironmentNames } from '../src/utils/example-workspace'
import {
  exampleEnvironmentProfiles,
  generateNotebookLlmsTxt,
  notebookImports,
} from '../src/utils/notebook-environment'

test('exposes unified Charts subpaths without duplicate framework runtimes', () => {
  assert.equal(
    notebookImports['@tanstack/charts'],
    'https://esm.sh/@tanstack/charts@0.10.0',
  )
  assert.equal(
    notebookImports['@tanstack/charts/'],
    'https://esm.sh/@tanstack/charts@0.10.0/',
  )

  assert.equal(
    notebookImports['@tanstack/charts/react'],
    'https://esm.sh/@tanstack/charts@0.10.0/react?external=react,react-dom',
  )
  assert.equal(
    notebookImports['@tanstack/charts/react/canvas'],
    'https://esm.sh/@tanstack/charts@0.10.0/react/canvas?external=react,react-dom',
  )
  assert.equal(
    notebookImports['@tanstack/charts/react/core'],
    'https://esm.sh/@tanstack/charts@0.10.0/react/core?external=react,react-dom',
  )
  assert.equal(
    notebookImports['@tanstack/charts/react/tooltip'],
    'https://esm.sh/@tanstack/charts@0.10.0/react/tooltip?external=react,react-dom',
  )
  assert.equal(
    notebookImports['@tanstack/charts/octane'],
    'https://esm.sh/@tanstack/charts@0.10.0/octane?external=octane',
  )
  assert.equal(
    notebookImports['@tanstack/charts/octane/canvas'],
    'https://esm.sh/@tanstack/charts@0.10.0/octane/canvas?external=octane',
  )
  assert.equal(
    notebookImports['@tanstack/charts/octane/core'],
    'https://esm.sh/@tanstack/charts@0.10.0/octane/core?external=octane',
  )

  assert.equal(
    notebookImports['octane/compiler'],
    'https://esm.sh/octane@0.1.13/compiler',
  )

  const guide = generateNotebookLlmsTxt()
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
    assert.equal(
      profile.imports['@tanstack/charts'],
      'https://esm.sh/@tanstack/charts@0.10.0',
    )

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

  assert.equal(
    exampleEnvironmentProfiles.react.imports.react,
    'https://esm.sh/react@19.2.3',
  )
  assert.equal(
    exampleEnvironmentProfiles['charts-react'].imports.react,
    'https://esm.sh/react@19.2.3',
  )
  assert.equal(
    exampleEnvironmentProfiles['charts-octane'].imports.octane,
    'https://esm.sh/octane@0.1.13',
  )

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
    notebookImports['@tanstack/highlight'],
    'https://esm.sh/@tanstack/highlight@0.0.10',
  )
  assert.equal(
    notebookImports['@tanstack/highlight/'],
    'https://esm.sh/@tanstack/highlight@0.0.10/',
  )
  assert.equal(
    notebookImports['@tanstack/markdown'],
    'https://esm.sh/@tanstack/markdown@0.0.13',
  )
  assert.equal(
    notebookImports['@tanstack/markdown/'],
    'https://esm.sh/@tanstack/markdown@0.0.13/',
  )
  assert.equal(
    notebookImports['@tanstack/markdown/react'],
    'https://esm.sh/@tanstack/markdown@0.0.13/react?external=react',
  )

  const guide = generateNotebookLlmsTxt()
  assert.match(guide, /`@tanstack\/highlight\/`/)
  assert.match(guide, /`@tanstack\/markdown\/`/)
  assert.match(guide, /`@tanstack\/markdown\/react`/)
})
