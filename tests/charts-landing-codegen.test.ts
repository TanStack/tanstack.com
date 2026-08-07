import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { catalogCases } from '@tanstack/react-charts-catalog'

import { createChartsLandingCatalogSource } from '../scripts/generate-charts-landing-catalog'

test('the generated landing catalog matches package metadata', () => {
  assert.equal(catalogCases.length, 110)
  assert.ok(
    catalogCases.some(
      (catalogCase) => catalogCase.id === '119-stacked-bar-band-cursor',
    ),
  )

  const generatedFile = resolve(
    process.cwd(),
    'src/components/charts/ChartsLandingCatalogChart.tsx',
  )
  const expected = createChartsLandingCatalogSource(catalogCases)

  assert.equal(readFileSync(generatedFile, 'utf8'), expected)
})
