import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scaleUtc } from 'd3-scale'
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

import { releases, weeks } from './activation-data'
import { activationTheme } from './activation-theme'

const monthDay = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

export const activationChart = defineChart({
  marks: [
    areaY(weeks, {
      id: 'activation-range',
      x: 'date',
      y1: 'expectedLow',
      y2: 'expectedHigh',
      key: 'id',
      fill: 'var(--activation-range)',
      fillOpacity: 0.22,
      curve: d3Curve(curveMonotoneX),
    }),
    ruleY([70], {
      id: 'activation-goal',
      stroke: 'var(--activation-goal)',
      strokeOpacity: 0.95,
      strokeWidth: 2,
      strokeDasharray: '7 7',
    }),
    lineY(weeks, {
      id: 'activation-line',
      x: 'date',
      y: 'activation',
      key: 'id',
      stroke: 'var(--activation-line)',
      strokeWidth: 4.25,
      points: true,
      curve: d3Curve(curveMonotoneX),
    }),
    dot(releases, {
      id: 'activation-events',
      x: 'date',
      y: 'activation',
      key: 'id',
      r: 6,
      fill: 'var(--activation-bg)',
      stroke: 'var(--activation-release)',
      strokeWidth: 3,
    }),
    text(releases, {
      id: 'activation-event-labels',
      x: 'date',
      y: 'activation',
      text: 'label',
      key: 'id',
      fill: 'var(--activation-foreground)',
      fontSize: 12,
      fontWeight: 650,
      dy: -21,
    }),
  ],
  x: {
    scale: scaleUtc().domain([weeks[0]!.date, weeks.at(-1)!.date]),
    axis: {
      label: 'Week ending',
      ticks: { format: (value) => monthDay.format(value) },
    },
    grid: false,
  },
  y: {
    scale: scaleLinear().domain([40, 82]),
    axis: {
      label: 'Activation rate (%)',
      ticks: { count: 5, format: (value) => `${Math.round(value)}%` },
    },
    grid: true,
  },
  theme: activationTheme,
})
