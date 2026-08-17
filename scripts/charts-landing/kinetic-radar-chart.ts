import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'
import { curveLinearClosed } from 'd3-shape'
import { defineChart } from '@tanstack/charts'
import {
  angleGrid,
  polar,
  radialArea,
  radialDot,
  radialGrid,
  radialLine,
} from '@tanstack/charts/polar'

import {
  kineticDarkTheme,
  radarDimensionNames,
  radarDimensions,
} from './kinetic-data'

export const kineticRadarChart = defineChart({
  marks: [
    polar({
      id: 'hero-radar',
      radiusRatio: 0.83,
      angle: {
        scale: scalePoint<string>().domain(radarDimensionNames),
        wrap: true,
      },
      radius: { scale: scaleLinear().domain([0, 100]) },
      guides: [
        radialGrid({
          ticks: 4,
          shape: 'polygon',
          labels: false,
          stroke: '#91c7d1',
          strokeOpacity: 0.16,
        }),
        angleGrid({
          labels: true,
          labelFill: '#d7e0e4',
          labelFontSize: 12,
          stroke: '#91c7d1',
          strokeOpacity: 0.15,
        }),
      ],
      marks: [
        radialArea(radarDimensions, {
          id: 'hero-radar-area',
          angle: 'dimension',
          radius: 'score',
          curve: curveLinearClosed,
          fill: '#27d9f0',
          fillOpacity: 0.25,
        }),
        radialLine(radarDimensions, {
          id: 'hero-radar-line',
          angle: 'dimension',
          radius: 'score',
          curve: curveLinearClosed,
          stroke: '#f7ffcc',
          strokeWidth: 4,
        }),
        radialDot(radarDimensions, {
          id: 'hero-radar-points',
          angle: 'dimension',
          radius: 'score',
          key: 'dimension',
          r: 6,
          fill: '#b9f227',
          stroke: '#07111e',
          strokeWidth: 3,
        }),
      ],
    }),
  ],
  theme: kineticDarkTheme,
})
