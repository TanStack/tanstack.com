import { scaleBand, scaleLinear } from 'd3'
import { defineChart, dot, link } from '@tanstack/charts'

import { kineticDarkTheme, productNames, productSignals } from './kinetic-data'

export const kineticLollipopChart = defineChart({
  marks: [
    link(productSignals, {
      id: 'hero-stems',
      x1: 'product',
      y1: () => 0,
      x2: 'product',
      y2: 'value',
      key: 'id',
      stroke: '#756c5b',
      strokeWidth: 2,
    }),
    dot(productSignals, {
      id: 'hero-points',
      x: 'product',
      y: 'value',
      z: 'segment',
      key: 'id',
      stroke: '#9cd5e2',
      strokeWidth: 1.5,
      r: 6,
    }),
  ],
  x: {
    scale: scaleBand<string>().domain(productNames).padding(0.3),
  },
  y: {
    scale: scaleLinear().domain([0, 100]),
    axis: { ticks: { count: 4 } },
    grid: true,
  },
  theme: kineticDarkTheme,
})
