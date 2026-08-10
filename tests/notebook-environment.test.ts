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
    'https://esm.sh/@tanstack/charts@0.9.0',
  )
  assert.equal(
    notebookImports['@tanstack/charts/'],
    'https://esm.sh/@tanstack/charts@0.9.0/',
  )

  assert.equal(
    notebookImports['@tanstack/charts/react'],
    'https://esm.sh/@tanstack/charts@0.9.0/react?external=react,react-dom',
  )
  assert.equal(
    notebookImports['@tanstack/charts/react/canvas'],
    'https://esm.sh/@tanstack/charts@0.9.0/react/canvas?external=react,react-dom',
  )
  assert.equal(
    notebookImports['@tanstack/charts/react/core'],
    'https://esm.sh/@tanstack/charts@0.9.0/react/core?external=react,react-dom',
  )
  assert.equal(
    notebookImports['@tanstack/charts/react/tooltip'],
    'https://esm.sh/@tanstack/charts@0.9.0/react/tooltip?external=react,react-dom',
  )
  assert.equal(
    notebookImports['@tanstack/charts/octane'],
    'https://esm.sh/@tanstack/charts@0.9.0/octane?external=octane',
  )
  assert.equal(
    notebookImports['@tanstack/charts/octane/canvas'],
    'https://esm.sh/@tanstack/charts@0.9.0/octane/canvas?external=octane',
  )
  assert.equal(
    notebookImports['@tanstack/charts/octane/core'],
    'https://esm.sh/@tanstack/charts@0.9.0/octane/core?external=octane',
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

test('provides hidden entry modules for every Charts environment', () => {
  for (const environment of exampleEnvironmentNames) {
    const profile = exampleEnvironmentProfiles[environment]
    assert.ok(profile)
    assert.equal(typeof profile.createEntrySource, 'function')
    assert.equal(profile.entryPath, '/__tanstack-example-entry.ts')
  }

  const charts =
    exampleEnvironmentProfiles.charts.createEntrySource('/src/chart.ts')
  assert.match(charts, /mountChart/)
  assert.match(charts, /import definition from "\/src\/chart\.ts"/)

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
