import { scaleLinear } from '@tanstack/charts/scales/linear'
import { curveMonotoneX } from 'd3-shape'
import {
  areaY,
  d3Curve,
  defineChart,
  dot,
  lineY,
  ruleY,
  text,
} from '@tanstack/charts'

import { kineticDarkTheme, productSignals } from './kinetic-data'

const releases = productSignals.filter(
  (row) => row.product === 'Form' || row.product === 'Store',
)

export const kineticLayeredChart = defineChart({
  marks: [
    areaY(productSignals, {
      id: 'hero-area',
      x: 'month',
      y1: 'previous',
      y2: 'forecast',
      key: 'id',
      fill: '#27d9f0',
      fillOpacity: 0.26,
      curve: d3Curve(curveMonotoneX),
    }),
    ruleY([70], {
      id: 'hero-rule',
      stroke: '#ff806f',
      strokeWidth: 2.5,
      strokeDasharray: '7 7',
    }),
    lineY(productSignals, {
      id: 'hero-line',
      x: 'month',
      y: 'value',
      key: 'id',
      stroke: '#f7ffcc',
      strokeWidth: 5,
      curve: d3Curve(curveMonotoneX),
    }),
    dot(productSignals, {
      id: 'hero-points',
      x: 'month',
      y: 'value',
      z: 'segment',
      key: 'id',
      stroke: '#07111e',
      strokeWidth: 3,
      r: 7,
    }),
    text(releases, {
      id: 'hero-labels',
      x: 'month',
      y: 'value',
      text: 'product',
      key: 'id',
      fill: '#ffffff',
      fontSize: 13,
      fontWeight: 700,
      dy: -22,
    }),
  ],
  scales: {
    x: {
      scale: scaleLinear().domain([1, 8]),
      axis: { ticks: { count: 4, format: (month) => `M${month}` } },
    },
    y: {
      scale: scaleLinear().domain([30, 100]),
      axis: { ticks: { count: 4 } },
      grid: true,
    },
  },
  theme: kineticDarkTheme,
})
