import { scaleLinear } from '@tanstack/charts/scales/linear'
import { curveMonotoneX } from 'd3-shape'
import { d3Curve, defineChart, dot, lineY } from '@tanstack/charts'

import { kineticDarkTheme, productSignals } from './kinetic-data'

export const kineticLineChart = defineChart({
  marks: [
    lineY(productSignals, {
      id: 'hero-line',
      x: 'month',
      y: 'value',
      key: 'id',
      stroke: '#61adbf',
      strokeWidth: 3,
      curve: d3Curve(curveMonotoneX),
    }),
    dot(productSignals, {
      id: 'hero-points',
      x: 'month',
      y: 'value',
      z: 'segment',
      key: 'id',
      stroke: '#9cd5e2',
      strokeWidth: 2,
      r: 4,
    }),
  ],
  x: {
    scale: scaleLinear().domain([1, 8]),
    axis: { ticks: { count: 4, format: (month) => `M${month}` } },
  },
  y: {
    scale: scaleLinear().domain([30, 100]),
    axis: { ticks: { count: 4 } },
    grid: true,
  },
  theme: kineticDarkTheme,
})
