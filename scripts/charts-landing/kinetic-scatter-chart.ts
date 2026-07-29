import { scaleLinear } from 'd3-scale'
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
      stroke: '#ffffff',
      strokeOpacity: 0.5,
      strokeWidth: 1.5,
      r: 'size',
    }),
  ],
  x: {
    scale: scaleLinear().domain([8, 34]),
    ticks: 4,
  },
  y: {
    scale: scaleLinear().domain([65, 96]),
    ticks: 4,
    format: (value) => `${value}%`,
    grid: true,
  },
  theme: kineticDarkTheme,
})
