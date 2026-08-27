import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { barX, defineChart, text } from '@tanstack/charts'

export const bundleSizeSnapshot = [
  { library: 'TanStack Charts', size: 40 },
  { library: 'uPlot', size: 22 },
  { library: 'Chart.js', size: 46 },
  { library: 'visx', size: 49 },
  { library: 'Lightweight Charts', size: 60 },
  { library: 'Observable Plot', size: 85 },
  { library: 'Vega-Lite', size: 87 },
  { library: 'D3', size: 90 },
  { library: 'Recharts', size: 97 },
  { library: 'Highcharts', size: 100 },
  { library: 'Victory', size: 105 },
  { library: 'Nivo', size: 143 },
  { library: 'Apache ECharts', size: 157 },
  { library: 'ApexCharts', size: 164 },
  { library: 'Plotly.js partial', size: 250 },
  { library: 'AG Charts', size: 367 },
] as const

const libraryNames = bundleSizeSnapshot.map((row) => row.library)

export function bundleSizeChart(compact = false) {
  return defineChart({
    marks: [
      barX(bundleSizeSnapshot, {
        id: 'bundle-bars',
        x: 'size',
        y: 'library',
        key: 'library',
        fill: (row) =>
          row.library === 'TanStack Charts' ? '#61e8ff' : '#315464',
        inset: compact ? 3 : 4,
        maxThickness: compact ? 25 : 28,
        radius: 6,
      }),
      text(bundleSizeSnapshot, {
        id: 'bundle-values',
        x: 'size',
        y: 'library',
        text: (row) => `${row.size} kB`,
        key: 'library',
        fill: (row) =>
          row.library === 'TanStack Charts' ? '#f7ffcc' : '#d6e6eb',
        fontSize: compact ? 15 : 14,
        fontWeight: 700,
        anchor: 'start',
        dx: compact ? 8 : 10,
      }),
    ],
    scales: {
      x: {
        scale: scaleLinear().domain([0, 425]),
        axis: {
          label: 'Minified + gzip (kB)',
          ticks: { count: compact ? 3 : 5 },
          tickLabels: { fontSize: compact ? 13 : 12 },
        },
        grid: true,
      },
      y: {
        scale: scaleBand<string>().domain(libraryNames).padding(0.12),
        axis: {
          line: false,
          ticks: { padding: compact ? 8 : 12, size: 0 },
          tickLabels: {
            fontSize: compact ? 15 : 14,
            fontWeight: ({ value }) =>
              value === 'TanStack Charts' ? 800 : 500,
            opacity: ({ value }) => (value === 'TanStack Charts' ? 1 : 0.76),
          },
        },
      },
    },
    theme: {
      background: 'transparent',
      foreground: '#eef8f7',
      grid: '#24404c',
      muted: '#91aab3',
      palette: ['#61e8ff'],
    },
  })
}
