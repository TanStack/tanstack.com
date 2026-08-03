import { scaleLinear } from 'd3'
import { defineChart } from '@tanstack/charts'
import { polar, radialArc, radialText } from '@tanstack/charts/polar'

import {
  kineticDarkTheme,
  productShare,
  productShareSlices,
  ringCenter,
} from './kinetic-data'

export const kineticDonutChart = defineChart({
  marks: [
    polar({
      id: 'hero-donut',
      inset: 10,
      radiusRatio: 0.78,
      angle: { scale: scaleLinear().domain([0, 1]) },
      radius: { scale: scaleLinear().domain([0, 1]) },
      marks: [
        radialArc(productShareSlices, {
          id: 'hero-arcs',
          startAngle: 'startAngle',
          endAngle: 'endAngle',
          padAngle: 'padAngle',
          innerRadius: ({ radius }) => radius * 0.56,
          cornerRadius: 9,
          color: (slice) => slice.data.segment,
          key: (slice) => slice.data.segment,
          stroke: '#07111e',
          strokeWidth: 5,
        }),
        radialText(ringCenter, {
          id: 'hero-ring-center',
          angle: 'angle',
          radius: 'radius',
          text: 'label',
          fill: '#ffffff',
          fontSize: 38,
          fontWeight: 750,
          anchor: 'middle',
          baseline: 'middle',
        }),
      ],
    }),
  ],
  color: {
    domain: productShare.map((row) => row.segment),
    range: ['#61e8ff', '#ff806f', '#b9f227', '#a78bfa', '#77929f'],
  },
  theme: kineticDarkTheme,
})
