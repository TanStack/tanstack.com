import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { scaleLinear } from '@tanstack/charts/scales/linear'
import { curveMonotoneX, curveStepAfter } from 'd3-shape'

import {
  areaY,
  createChartScene,
  d3Curve,
  defineChart,
  dot,
  lineY,
  renderChartSvg,
} from '@tanstack/charts'
import { activationChart } from './charts-landing/activation-chart'
import { kineticBarChart } from './charts-landing/kinetic-bar-chart'
import { kineticDonutChart } from './charts-landing/kinetic-donut-chart'
import { kineticHeatmapChart } from './charts-landing/kinetic-heatmap-chart'
import { kineticLayeredChart } from './charts-landing/kinetic-layered-chart'
import { kineticRadarChart } from './charts-landing/kinetic-radar-chart'
import { kineticScatterChart } from './charts-landing/kinetic-scatter-chart'

const outputFile = resolve(
  process.cwd(),
  'src/components/landing/chartsCommonSvg.ts',
)
const activationOutputFile = resolve(
  process.cwd(),
  'src/components/landing/chartsActivationSvg.ts',
)
const kineticOutputFile = resolve(
  process.cwd(),
  'src/components/landing/chartsKineticSvg.ts',
)
const checkOnly = process.argv.includes('--check')
const activationAriaLabel =
  'Weekly activation rate with expected range, 70 percent goal, and two product release events'
const activationAriaDescription =
  'Illustrative weekly activation data from January through May 2026. The actual rate rises from 48 to 78 percent, compared with an expected range and a 70 percent goal. Onboarding v2 and Invite flow are marked as release events.'

const themeBaseline = 40
const themeDomain: [number, number] = [40, 105]
const themeSeries = [48, 52, 57, 55, 64, 71, 78, 86, 91, 98].map(
  (value, index) => ({
    month: index + 1,
    phase: ['Pulse', 'Volt', 'Flare', 'Acid'][index % 4]!,
    value,
  }),
)

const editorialTheme = defineChart({
  marks: [
    areaY(themeSeries, {
      x: 'month',
      y: 'value',
      y1: themeBaseline,
      key: 'month',
      fill: '#d3481b',
      fillOpacity: 0.12,
      curve: d3Curve(curveMonotoneX),
    }),
    lineY(themeSeries, {
      x: 'month',
      y: 'value',
      key: 'month',
      stroke: '#3e3529',
      strokeWidth: 3,
      curve: d3Curve(curveMonotoneX),
    }),
  ],
  x: {
    scale: scaleLinear().domain([1, 10]),
    axis: { ticks: { count: 4, format: (month) => `M${month}` } },
  },
  y: {
    scale: scaleLinear().domain(themeDomain).nice(),
    axis: { ticks: { count: 3 } },
  },
  theme: {
    foreground: '#3e3529',
    muted: '#756c5b',
    grid: '#aea691',
    background: 'transparent',
    palette: ['#d3481b'],
  },
})

const productTheme = defineChart({
  marks: [
    lineY(themeSeries, {
      x: 'month',
      y: 'value',
      key: 'month',
      stroke: '#3aa3c4',
      strokeWidth: 4,
      curve: d3Curve(curveMonotoneX),
    }),
    dot(themeSeries, {
      x: 'month',
      y: 'value',
      key: 'month',
      fill: '#d8f0f3',
      stroke: '#3aa3c4',
      strokeWidth: 2,
      r: 4,
    }),
  ],
  x: {
    scale: scaleLinear().domain([1, 10]),
    axis: { ticks: { count: 4, format: (month) => `M${month}` } },
  },
  y: {
    scale: scaleLinear().domain(themeDomain).nice(),
    axis: { ticks: { count: 4 } },
    grid: true,
  },
  theme: {
    foreground: '#003e53',
    muted: '#756c5b',
    grid: '#9cd5e2',
    background: 'transparent',
    palette: ['#3aa3c4'],
  },
})

const terminalTheme = defineChart({
  marks: [
    areaY(themeSeries, {
      x: 'month',
      y: 'value',
      y1: themeBaseline,
      key: 'month',
      fill: '#39af46',
      fillOpacity: 0.1,
      curve: d3Curve(curveStepAfter),
    }),
    lineY(themeSeries, {
      x: 'month',
      y: 'value',
      key: 'month',
      stroke: '#69bc75',
      strokeWidth: 2,
      strokeDasharray: '6 3',
      curve: d3Curve(curveStepAfter),
    }),
  ],
  x: {
    scale: scaleLinear().domain([1, 10]),
    axis: {
      ticks: { count: 4, format: (month) => String(month).padStart(2, '0') },
    },
  },
  y: {
    scale: scaleLinear().domain(themeDomain).nice(),
    axis: { ticks: { count: 4 } },
    grid: true,
  },
  theme: {
    foreground: '#a2e1a9',
    muted: '#69bc75',
    grid: '#1d4226',
    background: 'transparent',
    palette: ['#69bc75'],
  },
})

const monokaiTheme = defineChart({
  marks: [
    areaY(themeSeries, {
      x: 'month',
      y: 'value',
      y1: themeBaseline,
      key: 'month',
      fill: '#66d9ef',
      fillOpacity: 0.16,
      curve: d3Curve(curveMonotoneX),
    }),
    lineY(themeSeries, {
      x: 'month',
      y: 'value',
      key: 'month',
      stroke: '#f92672',
      strokeWidth: 5,
      curve: d3Curve(curveMonotoneX),
    }),
    dot(themeSeries, {
      x: 'month',
      y: 'value',
      z: 'phase',
      key: 'month',
      r: 7,
      stroke: '#272822',
      strokeWidth: 3,
    }),
  ],
  x: {
    scale: scaleLinear().domain([1, 10]),
    ticks: 4,
    format: (month: number) => `M${month}`,
  },
  y: {
    scale: scaleLinear().domain(themeDomain).nice(),
    ticks: 4,
    grid: true,
  },
  theme: {
    foreground: '#f8f8f2',
    muted: '#a4a59b',
    grid: '#75715e',
    background: 'transparent',
    palette: ['#a6e22e', '#66d9ef', '#fd971f', '#ae81ff'],
  },
})

const charts = {
  chartsThemeEditorialSvg: render(
    editorialTheme,
    'Monthly active teams in an editorial theme',
  ),
  chartsThemeProductSvg: render(
    productTheme,
    'Monthly active teams in a product theme',
  ),
  chartsThemeTerminalSvg: render(
    terminalTheme,
    'Monthly active teams in a terminal theme',
  ),
  chartsThemeMonokaiSvg: render(
    monokaiTheme,
    'Monthly active teams in a Monokai theme',
  ),
}

const activationCharts = {
  chartsActivationSvg: render(
    activationChart,
    activationAriaLabel,
    1200,
    620,
    activationAriaDescription,
    -1,
  ),
  chartsActivationCompactSvg: render(
    activationChart,
    activationAriaLabel,
    520,
    560,
    activationAriaDescription,
    -1,
  ),
}

const kineticCharts = {
  chartsKineticBarSvg: render(
    kineticBarChart,
    'Product signals as rounded vertical bars',
    920,
    520,
  ),
  chartsKineticDonutSvg: render(
    kineticDonutChart,
    'Product activity share as a rounded donut chart',
    920,
    520,
  ),
  chartsKineticHeatmapSvg: render(
    kineticHeatmapChart,
    'Product health across four dimensions as a heatmap',
    920,
    520,
  ),
  chartsKineticLayeredSvg: render(
    kineticLayeredChart,
    'Layered product signal with forecast range and release labels',
    920,
    520,
  ),
  chartsKineticRadarSvg: render(
    kineticRadarChart,
    'Chart capability profile as a radar chart',
    920,
    520,
  ),
  chartsKineticScatterSvg: render(
    kineticScatterChart,
    'Product impact compared with implementation effort',
    920,
    520,
  ),
}

verifyAreaBounds(charts.chartsThemeEditorialSvg, 'Editorial')
verifyAreaBounds(charts.chartsThemeTerminalSvg, 'Terminal')

const generatedModules = [
  {
    file: outputFile,
    source: createGeneratedModule(
      charts,
      'scripts/generate-charts-landing-svg.ts',
    ),
  },
  {
    file: activationOutputFile,
    source: createGeneratedModule(
      activationCharts,
      'scripts/charts-landing/activation-chart.ts',
    ),
  },
  {
    file: kineticOutputFile,
    source: createGeneratedModule(
      kineticCharts,
      'scripts/charts-landing/kinetic-*-chart.ts',
    ),
  },
]

if (checkOnly) {
  for (const generatedModule of generatedModules) {
    if (readFileSync(generatedModule.file, 'utf8') !== generatedModule.source) {
      throw new Error(
        'Charts landing SVG assets are stale. Run pnpm charts:generate-landing-svg.',
      )
    }
  }
} else {
  for (const generatedModule of generatedModules) {
    writeFileSync(generatedModule.file, generatedModule.source)
  }
}

function render(
  definition: Parameters<typeof createChartScene>[0],
  ariaLabel: string,
  width = 520,
  height = 320,
  ariaDescription?: string,
  tabIndex?: number,
) {
  return renderChartSvg(createChartScene(definition, { width, height }), {
    ariaDescription,
    ariaLabel,
    tabIndex,
  })
}

function createGeneratedModule(
  renderedCharts: Record<string, string>,
  sourceFile: string,
) {
  return [
    '// Generated by pnpm charts:generate-landing-svg.',
    `// Source: ${sourceFile}`,
    '',
    ...Object.entries(renderedCharts).map(
      ([name, svg]) =>
        `export const ${name} =\n  ${quoteTypeScriptString(svg)}`,
    ),
    '',
  ].join('\n')
}

function verifyAreaBounds(svg: string, label: string) {
  const plotBottom = Number(
    svg.match(/data-ts-key="x-axis"[^>]* y1="([^"]+)"/)?.[1],
  )
  const pathData = svg.match(
    /class="ts-chart__area"[\s\S]*?<path[^>]* d="([^"]+)"/,
  )?.[1]

  if (!Number.isFinite(plotBottom) || !pathData) {
    throw new Error(`Could not verify the ${label} theme area bounds.`)
  }

  const coordinates = [...pathData.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) =>
    Number(match[0]),
  )
  const maximumY = Math.max(
    ...coordinates.filter((_coordinate, index) => index % 2 === 1),
  )

  if (maximumY > plotBottom) {
    throw new Error(
      `${label} theme area extends below the plot: ${maximumY} > ${plotBottom}.`,
    )
  }
}

function quoteTypeScriptString(value: string) {
  return `'${value
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')}'`
}
