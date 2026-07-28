import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  curveMonotoneX,
  curveStepAfter,
  scaleBand,
  scaleLinear,
  scaleOrdinal,
} from 'd3'

import {
  areaY,
  barY,
  createChartScene,
  d3Curve,
  defineChart,
  dot,
  lineY,
  renderChartSvg,
} from '../../packages/charts-core/src/index.ts'

const outputFile = resolve(
  process.cwd(),
  'src/components/landing/chartsCommonSvg.ts',
)
const checkOnly = process.argv.includes('--check')

const darkTheme = {
  foreground: '#e2e8f0',
  muted: '#94a3b8',
  grid: '#f8fafc',
  background: 'transparent',
  palette: ['#60a5fa', '#fb923c', '#2dd4bf'],
}

const activeTeams = [72, 78, 83, 81, 92, 101, 108, 117, 124, 136, 142, 156].map(
  (teams, index) => ({ week: index + 1, teams }),
)

const channels = [
  { channel: 'Search', signups: 76 },
  { channel: 'Direct', signups: 58 },
  { channel: 'Partner', signups: 44 },
  { channel: 'Social', signups: 31 },
]

const apiRequests = [42, 48, 53, 61, 58, 74, 82, 91, 97, 112, 124, 138].map(
  (requests, index) => ({ week: index + 1, requests }),
)

const retention = [
  { id: 'a', setup: 12, retention: 91, segment: 'Enterprise' },
  { id: 'b', setup: 18, retention: 82, segment: 'Growth' },
  { id: 'c', setup: 24, retention: 77, segment: 'Growth' },
  { id: 'd', setup: 31, retention: 69, segment: 'SMB' },
  { id: 'e', setup: 16, retention: 87, segment: 'Enterprise' },
  { id: 'f', setup: 27, retention: 73, segment: 'SMB' },
  { id: 'g', setup: 10, retention: 94, segment: 'Enterprise' },
  { id: 'h', setup: 22, retention: 80, segment: 'Growth' },
]

const latency = [114, 108, 112, 99, 101, 92, 96, 88, 90, 81, 84, 76]

const themeBaseline = 40
const themeDomain: [number, number] = [40, 105]
const themeSeries = [48, 52, 57, 55, 64, 71, 78, 86, 91, 98].map(
  (value, index) => ({ month: index + 1, value }),
)

const commonLine = defineChart({
  marks: [
    lineY(activeTeams, {
      x: 'week',
      y: 'teams',
      key: 'week',
      stroke: '#60a5fa',
      strokeWidth: 3,
      curve: d3Curve(curveMonotoneX),
    }),
    dot(activeTeams, {
      x: 'week',
      y: 'teams',
      key: 'week',
      fill: '#0b1728',
      stroke: '#93c5fd',
      strokeWidth: 2,
      r: 3,
    }),
  ],
  x: {
    scale: scaleLinear().domain([1, 12]),
    ticks: 4,
    format: (week: number) => `W${week}`,
  },
  y: {
    scale: scaleLinear().domain([60, 160]).nice(),
    ticks: 4,
    grid: true,
  },
  theme: darkTheme,
})

const commonBar = defineChart({
  marks: [
    barY(channels, {
      x: 'channel',
      y: 'signups',
      key: 'channel',
      fill: (row) =>
        ({
          Search: '#60a5fa',
          Direct: '#fb923c',
          Partner: '#2dd4bf',
          Social: '#a78bfa',
        })[row.channel] ?? '#60a5fa',
      radius: 4,
      inset: 4,
    }),
  ],
  x: {
    scale: scaleBand<string>()
      .domain(channels.map((row) => row.channel))
      .padding(0.12),
  },
  y: {
    scale: scaleLinear().domain([0, 80]).nice(),
    ticks: 4,
    grid: true,
  },
  theme: darkTheme,
})

const commonArea = defineChart({
  marks: [
    areaY(apiRequests, {
      x: 'week',
      y: 'requests',
      key: 'week',
      fill: '#2563eb',
      fillOpacity: 0.28,
      curve: d3Curve(curveMonotoneX),
    }),
    lineY(apiRequests, {
      x: 'week',
      y: 'requests',
      key: 'week',
      stroke: '#60a5fa',
      strokeWidth: 3,
      curve: d3Curve(curveMonotoneX),
    }),
  ],
  x: {
    scale: scaleLinear().domain([1, 12]),
    ticks: 4,
    format: (week: number) => `W${week}`,
  },
  y: {
    scale: scaleLinear().domain([0, 150]).nice(),
    ticks: 4,
    grid: true,
  },
  theme: darkTheme,
})

const segmentColor = scaleOrdinal<string, string>()
  .domain(['Enterprise', 'Growth', 'SMB'])
  .range(['#2dd4bf', '#fb923c', '#60a5fa'])

const commonScatter = defineChart({
  marks: [
    dot(retention, {
      x: 'setup',
      y: 'retention',
      z: 'segment',
      key: 'id',
      fillOpacity: 0.9,
      stroke: '#f8fafc',
      strokeOpacity: 0.5,
      strokeWidth: 1.5,
      r: 7,
    }),
  ],
  x: {
    scale: scaleLinear().domain([8, 34]),
    ticks: 4,
  },
  y: {
    scale: scaleLinear().domain([65, 96]),
    ticks: 4,
    format: (value: number) => `${value}%`,
    grid: true,
  },
  color: { scale: segmentColor },
  theme: darkTheme,
})

const commonSparkline = defineChart({
  marks: [
    areaY(latency, {
      fill: '#14b8a6',
      fillOpacity: 0.18,
      curve: d3Curve(curveMonotoneX),
    }),
    lineY(latency, {
      stroke: '#2dd4bf',
      strokeWidth: 4,
      curve: d3Curve(curveMonotoneX),
    }),
  ],
  guides: false,
  margin: 12,
  x: { scale: scaleLinear().domain([0, latency.length - 1]) },
  y: { scale: scaleLinear().domain([70, 120]) },
  theme: darkTheme,
})

const editorialTheme = defineChart({
  marks: [
    areaY(themeSeries, {
      x: 'month',
      y: 'value',
      y1: themeBaseline,
      key: 'month',
      fill: '#df5a35',
      fillOpacity: 0.12,
      curve: d3Curve(curveMonotoneX),
    }),
    lineY(themeSeries, {
      x: 'month',
      y: 'value',
      key: 'month',
      stroke: '#211d18',
      strokeWidth: 3,
      curve: d3Curve(curveMonotoneX),
    }),
  ],
  x: {
    scale: scaleLinear().domain([1, 10]),
    ticks: 4,
    format: (month: number) => `M${month}`,
  },
  y: {
    scale: scaleLinear().domain(themeDomain).nice(),
    ticks: 3,
  },
  theme: {
    foreground: '#211d18',
    muted: '#756b60',
    grid: '#211d18',
    background: 'transparent',
    palette: ['#df5a35'],
  },
})

const productTheme = defineChart({
  marks: [
    lineY(themeSeries, {
      x: 'month',
      y: 'value',
      key: 'month',
      stroke: '#2563eb',
      strokeWidth: 4,
      curve: d3Curve(curveMonotoneX),
    }),
    dot(themeSeries, {
      x: 'month',
      y: 'value',
      key: 'month',
      fill: '#eff6ff',
      stroke: '#2563eb',
      strokeWidth: 2,
      r: 4,
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
    foreground: '#172554',
    muted: '#64748b',
    grid: '#bfdbfe',
    background: 'transparent',
    palette: ['#2563eb'],
  },
})

const terminalTheme = defineChart({
  marks: [
    areaY(themeSeries, {
      x: 'month',
      y: 'value',
      y1: themeBaseline,
      key: 'month',
      fill: '#22c55e',
      fillOpacity: 0.1,
      curve: d3Curve(curveStepAfter),
    }),
    lineY(themeSeries, {
      x: 'month',
      y: 'value',
      key: 'month',
      stroke: '#4ade80',
      strokeWidth: 2,
      strokeDasharray: '6 3',
      curve: d3Curve(curveStepAfter),
    }),
  ],
  x: {
    scale: scaleLinear().domain([1, 10]),
    ticks: 4,
    format: (month: number) => `0${month}`,
  },
  y: {
    scale: scaleLinear().domain(themeDomain).nice(),
    ticks: 4,
    grid: true,
  },
  theme: {
    foreground: '#bbf7d0',
    muted: '#86efac',
    grid: '#14532d',
    background: 'transparent',
    palette: ['#4ade80'],
  },
})

const charts = {
  chartsCommonAreaSvg: render(commonArea, 'Weekly API requests'),
  chartsCommonBarSvg: render(commonBar, 'Trial signups by channel'),
  chartsCommonLineSvg: render(commonLine, 'Weekly active teams'),
  chartsCommonScatterSvg: render(
    commonScatter,
    'Retention compared with setup time',
  ),
  chartsCommonSparklineSvg: render(
    commonSparkline,
    'API response time over the last twelve hours',
    520,
    180,
  ),
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
}

verifyAreaBounds(charts.chartsThemeEditorialSvg, 'Editorial')
verifyAreaBounds(charts.chartsThemeTerminalSvg, 'Terminal')

const source = [
  '// Generated by pnpm charts:generate-landing-svg.',
  '// Source: scripts/generate-charts-landing-svg.ts',
  '',
  ...Object.entries(charts).map(
    ([name, svg]) => `export const ${name} =\n  ${quoteTypeScriptString(svg)}`,
  ),
  '',
].join('\n')

if (checkOnly) {
  if (readFileSync(outputFile, 'utf8') !== source) {
    throw new Error(
      'Charts landing SVG assets are stale. Run pnpm charts:generate-landing-svg.',
    )
  }
} else {
  writeFileSync(outputFile, source)
}

function render(
  definition: Parameters<typeof createChartScene>[0],
  ariaLabel: string,
  width = 520,
  height = 320,
) {
  return renderChartSvg(createChartScene(definition, { width, height }), {
    ariaLabel,
  })
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
