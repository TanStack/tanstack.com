import assert from 'node:assert/strict'
import test from 'node:test'
import type { ChartPoint } from '@tanstack/charts'
import { getNpmChartTooltipContent } from '../src/components/npm-stats/npmChartTooltip'
import { getBaselineDisplayName } from '../src/components/npm-stats/shared'

type TooltipInput = Parameters<typeof getNpmChartTooltipContent>[2]
type TooltipDatum = Parameters<
  typeof getNpmChartTooltipContent
>[0][number]['datum']

const date = new Date('2026-10-01T00:00:00Z')
const input: TooltipInput = {
  barOrientation: 'vertical',
  viewMode: 'history',
}
const context = {
  pinned: false,
  xLabel: 'Date',
  yLabel: 'Downloads',
  formatX: () => 'Oct 1, 2026',
  formatY: String,
}

function point(
  seriesName: string,
  value: number,
  seriesLabel?: string,
): ChartPoint<TooltipDatum> {
  return {
    key: seriesName,
    markId: 'npm-history-complete',
    group: seriesName,
    groupLabel: seriesName,
    datum: {
      color: '#888',
      date,
      id: seriesName,
      label: `${seriesLabel ?? seriesName}: ${value}`,
      seriesName,
      seriesLabel,
      value,
    },
    datumIndex: 0,
    xValue: date,
    yValue: value,
    x: 0,
    y: 0,
    color: '#888',
  }
}

for (const normalized of [false, true]) {
  for (const labels of [['React'], ['Custom baseline'], ['React', 'Vue']]) {
    const name = getBaselineDisplayName(
      labels.map((label) => ({
        packages: [{ name: label.toLowerCase() }],
        baseline: true,
        hidden: true,
        baselineLabel: label,
      })),
    )
    test(`${normalized ? 'percentage' : 'absolute'} tooltips display ${name} while preserving baseline identity`, () => {
      const baseline = point('__baseline__', normalized ? 1 : 1000000, name)
      const options = {
        ...input,
        yLabel: normalized ? 'Downloads (% of baseline)' : 'Downloads',
        yFormat: normalized ? (value: number) => `${value * 100}%` : String,
      }
      const expectedValue = normalized ? '100%' : '1000000'
      const single = getNpmChartTooltipContent([baseline], context, options)
      assert.equal(single.title, name)
      assert.deepEqual(single.rows, [
        { label: 'Date', value: 'Oct 1, 2026' },
        { label: options.yLabel, value: expectedValue },
      ])

      const tracked = point('@tanstack/react-query', 0.5)
      const grouped = getNpmChartTooltipContent(
        [tracked, baseline],
        {
          ...context,
          primaryPoint: baseline,
        },
        options,
      )
      assert.equal(grouped.title, 'Date: Oct 1, 2026')
      assert.deepEqual(
        grouped.rows.map((row) => row.label),
        ['@tanstack/react-query', name],
      )
      assert.equal(grouped.rows[1]?.value, expectedValue)
      assert.equal(baseline.group, '__baseline__')
      assert.equal(baseline.datum.seriesName, '__baseline__')
      assert.ok(!JSON.stringify(grouped).includes('__baseline__'))
    })
  }
}

test('ordinary single-series tooltips keep the chart group label', () => {
  const content = getNpmChartTooltipContent(
    [point('react', 100)],
    context,
    input,
  )
  assert.equal(content.title, 'react')
})
