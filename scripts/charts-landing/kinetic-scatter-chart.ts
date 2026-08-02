import { scaleLinear } from 'd3'
import { defineChart, dot } from '@tanstack/charts'

import { kineticDarkTheme, productSignals } from './kinetic-data'

export const kineticScatterChart = defineChart({
  marks: [
    dot(productSignals, {
      id: 'hero-points',
      x: 'effort',
      y: 'impact',
      z: 'segment',
      key: 'id',
      fillOpacity: 0.9,
      stroke: '#07111e',
      strokeOpacity: 1,
      strokeWidth: 3,
      r: 'size',
    }),
  ],
  x: {
    scale: scaleLinear().domain([8, 34]),
    axis: { ticks: { count: 4 } },
  },
  y: {
    scale: scaleLinear().domain([65, 96]),
    axis: { ticks: { count: 4, format: (value) => `${value}%` } },
    grid: true,
  },
  theme: kineticDarkTheme,
})
