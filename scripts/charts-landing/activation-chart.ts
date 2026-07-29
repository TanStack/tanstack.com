import { curveMonotoneX, scaleLinear, scaleUtc } from 'd3'
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
      fill: '#3aa3c4',
      fillOpacity: 0.2,
      curve: d3Curve(curveMonotoneX),
    }),
    ruleY([70], {
      id: 'activation-goal',
      stroke: '#e06e49',
      strokeOpacity: 0.95,
      strokeWidth: 2,
      strokeDasharray: '7 7',
    }),
    lineY(weeks, {
      id: 'activation-line',
      x: 'date',
      y: 'activation',
      key: 'id',
      stroke: '#61adbf',
      strokeWidth: 3.25,
      points: true,
      curve: d3Curve(curveMonotoneX),
    }),
    dot(releases, {
      id: 'activation-events',
      x: 'date',
      y: 'activation',
      key: 'id',
      r: 6,
      fill: '#ffffff',
      stroke: '#3aa3c4',
      strokeWidth: 3,
    }),
    text(releases, {
      id: 'activation-event-labels',
      x: 'date',
      y: 'activation',
      text: 'label',
      key: 'id',
      fill: '#ffffff',
      fontSize: 12,
      fontWeight: 650,
      dy: -21,
    }),
  ],
  x: {
    scale: scaleUtc().domain([weeks[0]!.date, weeks.at(-1)!.date]),
    label: 'Week ending',
    format: (value) => monthDay.format(value),
    grid: false,
  },
  y: {
    scale: scaleLinear().domain([40, 82]),
    label: 'Activation rate (%)',
    format: (value) => `${Math.round(value)}%`,
    grid: true,
    ticks: 5,
  },
  theme: activationTheme,
})
