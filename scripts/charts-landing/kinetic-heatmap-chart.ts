import { scaleBand } from '@tanstack/charts-scales/band'
import { cell, defineChart } from '@tanstack/charts'

import {
  heatmapMetrics,
  heatmapSignals,
  kineticDarkTheme,
  productNames,
} from './kinetic-data'

export const kineticHeatmapChart = defineChart({
  marks: [
    cell(heatmapSignals, {
      id: 'hero-heatmap',
      x: 'product',
      y: 'metric',
      color: 'band',
      key: 'id',
      inset: 4,
      radius: 8,
      stroke: '#07111e',
      strokeWidth: 2,
    }),
  ],
  x: {
    scale: scaleBand<string>().domain(productNames).padding(0.04),
  },
  y: {
    scale: scaleBand<string>().domain(heatmapMetrics).padding(0.08),
  },
  color: {
    domain: ['Building', 'Strong', 'Peak'],
    range: ['#123d4a', '#27aeca', '#b9f227'],
  },
  theme: kineticDarkTheme,
})
