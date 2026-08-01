import { curveMonotoneX, scaleLinear } from 'd3'
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
      fill: '#3aa3c4',
      fillOpacity: 0.24,
      curve: d3Curve(curveMonotoneX),
    }),
    ruleY([70], {
      id: 'hero-rule',
      stroke: '#e06e49',
      strokeWidth: 2,
      strokeDasharray: '7 7',
    }),
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
    text(releases, {
      id: 'hero-labels',
      x: 'month',
      y: 'value',
      text: 'product',
      key: 'id',
      fill: '#ffffff',
      fontSize: 11,
      fontWeight: 650,
      dy: -18,
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
