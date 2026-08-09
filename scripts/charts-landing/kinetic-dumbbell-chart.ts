import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { defineChart, dot, link } from '@tanstack/charts'

import { kineticDarkTheme, productNames, productSignals } from './kinetic-data'

export const kineticDumbbellChart = defineChart({
  marks: [
    link(productSignals, {
      id: 'hero-stems',
      x1: 'previous',
      y1: 'product',
      x2: 'value',
      y2: 'product',
      key: 'id',
      stroke: '#756c5b',
      strokeWidth: 2,
    }),
    dot(productSignals, {
      id: 'hero-secondary',
      x: 'previous',
      y: 'product',
      z: 'segment',
      key: 'id',
      fill: '#e06e49',
      r: 5,
    }),
    dot(productSignals, {
      id: 'hero-points',
      x: 'value',
      y: 'product',
      z: 'segment',
      key: 'id',
      r: 5,
    }),
  ],
  x: {
    scale: scaleLinear().domain([30, 100]),
    axis: { ticks: { count: 4 } },
    grid: true,
  },
  y: {
    scale: scaleBand<string>().domain(productNames).padding(0.28),
  },
  theme: kineticDarkTheme,
})
