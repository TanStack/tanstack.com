import { pie } from 'd3-shape'

export const kineticDarkTheme = {
  background: 'transparent',
  foreground: '#eff7f4',
  grid: '#91c7d1',
  muted: '#77929f',
  palette: ['#61e8ff', '#ff806f', '#b9f227'],
}

export const productSignals = [
  {
    effort: 12,
    forecast: 58,
    id: 'Query',
    impact: 91,
    month: 1,
    previous: 38,
    product: 'Query',
    segment: 'Core',
    size: 8,
    value: 48,
  },
  {
    effort: 18,
    forecast: 66,
    id: 'Router',
    impact: 82,
    month: 2,
    previous: 45,
    product: 'Router',
    segment: 'Core',
    size: 6,
    value: 56,
  },
  {
    effort: 24,
    forecast: 62,
    id: 'Table',
    impact: 77,
    month: 3,
    previous: 51,
    product: 'Table',
    segment: 'Data',
    size: 7,
    value: 54,
  },
  {
    effort: 31,
    forecast: 78,
    id: 'Form',
    impact: 69,
    month: 4,
    previous: 49,
    product: 'Form',
    segment: 'Data',
    size: 5,
    value: 64,
  },
  {
    effort: 16,
    forecast: 83,
    id: 'Start',
    impact: 87,
    month: 5,
    previous: 57,
    product: 'Start',
    segment: 'Runtime',
    size: 9,
    value: 71,
  },
  {
    effort: 27,
    forecast: 86,
    id: 'Virtual',
    impact: 73,
    month: 6,
    previous: 63,
    product: 'Virtual',
    segment: 'Runtime',
    size: 6,
    value: 78,
  },
  {
    effort: 10,
    forecast: 94,
    id: 'Store',
    impact: 94,
    month: 7,
    previous: 68,
    product: 'Store',
    segment: 'Core',
    size: 10,
    value: 86,
  },
  {
    effort: 22,
    forecast: 98,
    id: 'DB',
    impact: 80,
    month: 8,
    previous: 74,
    product: 'DB',
    segment: 'Data',
    size: 7,
    value: 91,
  },
]

export const productNames = productSignals.map((row) => row.product)

export const heatmapMetrics = [
  'Adoption',
  'Performance',
  'Reliability',
  'DX',
] as const

export const heatmapSignals = productSignals.flatMap((product, productIndex) =>
  heatmapMetrics.map((metric, metricIndex) => {
    const score =
      48 + ((product.value + productIndex * 9 + metricIndex * 17) % 50)
    return {
      band: score >= 82 ? 'Peak' : score >= 66 ? 'Strong' : 'Building',
      id: `${product.id}-${metric}`,
      metric,
      product: product.product,
      score,
    }
  }),
)

export const radarDimensions = [
  { dimension: 'Speed', score: 92 },
  { dimension: 'Control', score: 83 },
  { dimension: 'Types', score: 96 },
  { dimension: 'A11y', score: 78 },
  { dimension: 'Motion', score: 88 },
  { dimension: 'Themes', score: 86 },
] as const

export const radarDimensionNames = radarDimensions.map((row) => row.dimension)

export const productShare = [
  { share: 31, segment: 'Core' },
  { share: 25, segment: 'Data' },
  { share: 19, segment: 'Runtime' },
  { share: 14, segment: 'UI' },
  { share: 11, segment: 'Other' },
]

export const productShareSlices = pie<(typeof productShare)[number]>()
  .sort(null)
  .value((row) => row.share)(productShare)

export const ringCenter = [{ angle: 0, label: '100%', radius: 0 }] as const
