import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { barY, defineChart, ruleY } from '@tanstack/charts'

import { kineticDarkTheme, productNames, productSignals } from './kinetic-data'

export const kineticBarChart = defineChart({
  marks: [
    barY(productSignals, {
      id: 'hero-bars',
      x: 'product',
      y: 'value',
      color: 'segment',
      key: 'id',
      inset: 5,
      radius: 10,
    }),
    ruleY([70], {
      id: 'hero-rule',
      stroke: '#f7ffcc',
      strokeWidth: 2,
      strokeDasharray: '5 7',
    }),
  ],
  x: {
    scale: scaleBand<string>().domain(productNames).padding(0.16),
  },
  y: {
    scale: scaleLinear().domain([0, 100]),
    ticks: 4,
    grid: true,
  },
  color: {
    domain: ['Core', 'Data', 'Runtime'],
    range: ['#61e8ff', '#ff806f', '#b9f227'],
  },
  theme: kineticDarkTheme,
})
