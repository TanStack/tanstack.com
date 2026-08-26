export type BuilderExample = {
  id: string
  title: string
  description: string
  source: string
}

const dutyStatusSource = String.raw`import {
  defineChart,
  frame,
  link,
  mountChart,
  ruleX,
  ruleY,
  text,
} from '@tanstack/charts'
import { scaleLinear } from '@tanstack/charts/scales/linear'

const colors = {
  OFF: '#ef3b2d',
  SB: '#737373',
  D: '#3b7f2a',
  ON: '#d59a2f',
}

const lanes = { OFF: 3.5, SB: 2.5, D: 1.5, ON: 0.5 }

const segments = [
  { id: 'off-1', start: 0, end: 731, status: 'OFF', duration: '12h, 11m' },
  { id: 'on-1', start: 731, end: 750, status: 'ON', duration: '19m' },
  { id: 'drive-1', start: 750, end: 862, status: 'D', duration: '1h, 52m', speed: '30m/h' },
  { id: 'on-2', start: 862, end: 958, status: 'ON', duration: '1h, 36m' },
  { id: 'drive-2', start: 958, end: 1030, status: 'D', duration: '1h, 12m', speed: '35m/h' },
  { id: 'off-2', start: 1030, end: 1067, status: 'OFF', duration: '37m' },
  { id: 'drive-3', start: 1067, end: 1338, status: 'D', duration: '4h, 28m', speed: '53m/h' },
  { id: 'sleeper-1', start: 1338, end: 1440, status: 'SB', duration: '1h, 42m' },
]

const transitions = segments.slice(1).map((segment, index) => {
  const previous = segments[index]
  return {
    id: previous.id + '-' + segment.id,
    minute: segment.start,
    from: lanes[previous.status],
    to: lanes[segment.status],
    color: colors[previous.status],
  }
})

const hours = Array.from({ length: 23 }, (_, index) => (index + 1) * 60)
const quarterHours = Array.from({ length: 95 }, (_, index) => (index + 1) * 15)
  .filter((minute) => minute % 60 !== 0)
  .flatMap((minute) => [0, 1, 2, 3].map((row) => ({
    id: minute + '-' + row,
    minute,
    from: row,
    to: row + 0.24,
  })))
const labels = segments.map((segment) => ({
  ...segment,
  minute: (segment.start + segment.end) / 2,
  lane: lanes[segment.status],
}))

const definition = defineChart(({ width }) => ({
  marks: [
    frame({ stroke: '#5757c9', strokeOpacity: 0.95 }),
    ruleX(hours, { stroke: '#5757c9', strokeOpacity: 0.6 }),
    ruleY([0, 1, 2, 3, 4], { stroke: '#5757c9', strokeOpacity: 0.6 }),
    link(quarterHours, {
      x1: 'minute', x2: 'minute', y1: 'from', y2: 'to', key: 'id',
      stroke: '#5757c9', strokeOpacity: 0.45, lineCap: 'butt',
    }),
    ruleX([508], { stroke: '#5a9d47', strokeDasharray: '7 7' }),
    ruleX([732], { stroke: '#4f6bea', strokeWidth: 2 }),
    ruleX([1338], { stroke: '#ef3b2d', strokeDasharray: '7 7' }),
    link(segments, {
      x1: 'start', x2: 'end',
      y1: (segment) => lanes[segment.status],
      y2: (segment) => lanes[segment.status],
      key: 'id', stroke: (segment) => colors[segment.status],
      strokeWidth: 3, lineCap: 'butt',
    }),
    link(transitions, {
      x1: 'minute', x2: 'minute', y1: 'from', y2: 'to', key: 'id',
      stroke: 'color', strokeWidth: 3, lineCap: 'butt',
    }),
    text(
      width < 700
        ? labels.filter((segment) => segment.end - segment.start >= 180)
        : labels,
      {
        x: 'minute', y: 'lane', text: 'duration', key: 'id', dy: -11,
        fill: 'currentColor', fontSize: 11, fontWeight: 700,
      },
    ),
    text(width < 700 ? [] : labels.filter((segment) => segment.speed), {
      x: 'minute', y: 'lane', text: 'speed', key: 'id', dy: 13,
      fill: '#3b7f2a', fontSize: 10,
    }),
  ],
  x: { scale: scaleLinear().domain([0, 1440]), axis: false },
  y: { scale: scaleLinear().domain([0, 4]), axis: false },
  margin: 0,
  clip: true,
}))

export default function render(output) {
  const root = document.createElement('section')
  root.className = 'duty-status-demo'
  root.innerHTML = '<style>.duty-status-demo{color:var(--builder-foreground);font:12px/1.2 Inter,system-ui,sans-serif}.duty-grid{display:grid;grid-template-columns:40px minmax(0,1fr) 74px;grid-template-rows:22px 184px 26px;min-width:560px}.hours,.events{position:relative}.hour{position:absolute;bottom:2px;translate:-50% 0;font-size:11px}.labels,.totals{display:grid;grid-template-rows:repeat(4,1fr);align-items:center}.labels{padding-right:7px;text-align:right;font-weight:700}.totals{padding-left:7px;font-size:11px}.event{position:absolute;top:4px;translate:-50% 0;font-size:18px;font-weight:700}.chart{height:184px;min-width:0}.scroll{overflow:auto;padding:18px 0}</style><div class="scroll"><div class="duty-grid"><div></div><div class="hours"></div><div></div><div class="labels"><span style="color:#ef3b2d">OFF</span><span style="color:#737373">SB</span><span style="color:#3b7f2a">D</span><span style="color:#d59a2f">ON</span></div><div class="chart"></div><div class="totals"><span style="color:#ef3b2d">12:48:49</span><span>01:42:24</span><span style="color:#3b7f2a">07:33:25</span><span style="color:#d59a2f">01:55:23</span></div><div></div><div class="events"><span class="event" style="left:35.3%;color:#3b7f2a">▱</span><span class="event" style="left:50.8%;color:#4f6bea">✹</span><span class="event" style="left:92.9%;color:#ef3b2d">⌁̸</span></div><span style="align-self:center;padding-left:7px">09:28:47</span></div></div>'

  const hoursRoot = root.querySelector('.hours')
  const labels = ['M', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'N', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'M']
  labels.forEach((label, index) => {
    const hour = document.createElement('span')
    hour.className = 'hour'
    hour.style.left = index / 24 * 100 + '%'
    hour.textContent = label
    hoursRoot.append(hour)
  })

  output.append(root)
  mountChart(root.querySelector('.chart'), {
    definition,
    height: 184,
    initialWidth: 1000,
    ariaLabel: 'Twenty-four hour duty status log',
  })
}`

const populationRaceSource = String.raw`import React from 'react'
import { createRoot } from 'react-dom/client'
import { Chart } from '@tanstack/charts/react'
import { barX, defineChart, ruleX, text } from '@tanstack/charts'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'

const snapshots = [
  { year: 1961, values: { China: 660, India: 456, 'United States': 184, Russia: 121, Japan: 95, Indonesia: 89, Brazil: 75, Bangladesh: 52, Pakistan: 47, Nigeria: 46 } },
  { year: 1971, values: { China: 841, India: 567, 'United States': 208, Russia: 130, Indonesia: 119, Japan: 106, Brazil: 98, Bangladesh: 70, Pakistan: 62, Nigeria: 57 } },
  { year: 1981, values: { China: 994, India: 716, 'United States': 230, Indonesia: 151, Brazil: 122, Russia: 139, Japan: 118, Bangladesh: 91, Pakistan: 80, Nigeria: 75 } },
  { year: 1991, values: { China: 1158, India: 888, 'United States': 253, Indonesia: 184, Brazil: 153, Russia: 148, Japan: 124, Bangladesh: 111, Pakistan: 111, Nigeria: 98 } },
  { year: 2001, values: { China: 1272, India: 1075, 'United States': 285, Indonesia: 216, Brazil: 177, Pakistan: 146, Russia: 146, Bangladesh: 134, Nigeria: 126, Japan: 127 } },
  { year: 2011, values: { China: 1345, India: 1264, 'United States': 312, Indonesia: 245, Brazil: 198, Pakistan: 184, Nigeria: 166, Bangladesh: 151, Russia: 143, Japan: 128 } },
  { year: 2021, values: { China: 1412, India: 1408, 'United States': 332, Indonesia: 276, Pakistan: 231, Nigeria: 218, Brazil: 214, Bangladesh: 169, Russia: 143, Japan: 126 } },
]

const colors = { China: '#ef4444', India: '#f59e0b', 'United States': '#3b82f6', Indonesia: '#22c55e', Pakistan: '#14b8a6', Nigeria: '#84cc16', Brazil: '#10b981', Bangladesh: '#06b6d4', Russia: '#8b5cf6', Japan: '#ec4899' }

function PopulationRace() {
  const [index, setIndex] = React.useState(0)
  const [playing, setPlaying] = React.useState(true)
  const snapshot = snapshots[index]
  const rows = React.useMemo(
    () => Object.entries(snapshot.values)
      .map(([country, value]) => ({ country, value, label: value + 'M' }))
      .sort((left, right) => right.value - left.value),
    [snapshot],
  )

  React.useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      setIndex((current) => current === snapshots.length - 1 ? 0 : current + 1)
    }, 1200)
    return () => window.clearInterval(timer)
  }, [playing])

  const definition = React.useMemo(() => defineChart({
    marks: [
      ruleX([0, 500, 1000, 1500], { strokeOpacity: 0.15 }),
      barX(rows, {
        x: 'value', y: 'country', key: 'country', inset: 3, radius: 4,
        fill: (datum) => colors[datum.country],
      }),
      text(rows, {
        x: 'value', y: 'country', text: 'label', key: 'country',
        dx: 8, anchor: 'start', fill: 'currentColor', fontWeight: 700,
      }),
    ],
    x: { scale: scaleLinear().domain([0, 1600]), axis: { label: 'Population (millions)' }, grid: false },
    y: { scale: scaleBand().domain(rows.map((row) => row.country)).padding(0.12) },
    margin: { top: 20, right: 72, bottom: 44, left: 116 },
    theme: { background: 'transparent' },
    animate: true,
  }), [rows])

  return React.createElement('section', { className: 'race' },
    React.createElement('style', null, '.race{color:var(--builder-foreground);font-family:Inter,system-ui,sans-serif}.race-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px}.race h1{margin:0;font-size:clamp(28px,4vw,50px);letter-spacing:-.04em}.race p{margin:8px 0 0;color:#737373}.controls{display:flex;gap:8px}.controls button{border:1px solid #8885;border-radius:9px;background:#8882;color:inherit;padding:9px 12px;cursor:pointer}.stage{position:relative;margin-top:12px}.year{position:absolute;right:12px;bottom:48px;color:#8884;font-size:clamp(64px,10vw,112px);font-weight:800;letter-spacing:-.08em;pointer-events:none}.timeline{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;margin:8px auto 0;max-width:720px;color:#737373;font-size:12px}.timeline input{width:100%}@media(max-width:620px){.race-head{display:block}.controls{margin-top:14px}.year{font-size:58px}.chart{margin-left:-18px}}'),
    React.createElement('div', { className: 'race-head' },
      React.createElement('div', null,
        React.createElement('h1', null, 'World Population in 60 Years'),
        React.createElement('p', null, 'The ten most populous countries, 1961–2021'),
      ),
      React.createElement('div', { className: 'controls' },
        React.createElement('button', { onClick: () => setPlaying((value) => !value) }, playing ? 'Pause' : 'Play'),
        React.createElement('button', { onClick: () => setIndex((value) => Math.min(value + 1, snapshots.length - 1)), disabled: index === snapshots.length - 1 }, 'Next'),
      ),
    ),
    React.createElement('div', { className: 'stage' },
      React.createElement('div', { className: 'chart' }, React.createElement(Chart, { definition, height: 520, initialWidth: 900, ariaLabel: 'World population rankings for ' + snapshot.year })),
      React.createElement('strong', { className: 'year' }, snapshot.year),
    ),
    React.createElement('div', { className: 'timeline' },
      React.createElement('span', null, snapshots[0].year),
      React.createElement('input', { type: 'range', min: 0, max: snapshots.length - 1, value: index, onChange: (event) => { setPlaying(false); setIndex(Number(event.target.value)) }, 'aria-label': 'Year' }),
      React.createElement('span', null, snapshots.at(-1).year),
    ),
  )
}

export default function render(output) {
  const root = document.createElement('div')
  output.append(root)
  createRoot(root).render(React.createElement(PopulationRace))
}`

const technicalIndicatorsSource = String.raw`import React from 'react'
import { createRoot } from 'react-dom/client'
import { Chart } from '@tanstack/charts/react'
import { areaY, defineChart, dot, lineY, ruleY } from '@tanstack/charts'
import { scaleLinear } from '@tanstack/charts/scales/linear'

const palette = ['#ae3ce6', '#6899ef', '#f3c536', '#46be78']

function makeRows(kind, revision) {
  return Array.from({ length: 64 }, (_, index) => {
    const x = index
    const drift = kind === 0 ? index * 0.42 : kind === 1 ? -index * 0.08 : index * 0.12
    const wave = Math.sin(index / (4.8 + kind) + revision * 0.7) * (12 + kind * 4)
    const detail = Math.cos(index / 2.3 + kind) * 4
    const value = 48 + drift + wave + detail
    return { id: index, x, value, signal: 50 + Math.sin(index / 7 + 1.8) * 17 }
  })
}

function IndicatorChart({ kind, revision }) {
  const rows = React.useMemo(() => makeRows(kind, revision), [kind, revision])
  const color = palette[kind]
  const definition = React.useMemo(() => defineChart({
    marks: [
      ruleY(kind === 1 ? [30, 70] : [50], { stroke: kind === 1 ? '#ef4444' : '#737373', strokeOpacity: 0.32, strokeDasharray: '5 5' }),
      areaY(rows, { x: 'x', y1: kind === 1 ? 50 : 20, y2: 'value', fill: color, fillOpacity: 0.13 }),
      lineY(rows, { x: 'x', y: 'value', key: 'id', stroke: color, strokeWidth: 2 }),
      lineY(rows, { x: 'x', y: 'signal', key: 'id', stroke: '#adbbd7', strokeOpacity: 0.7, strokeWidth: 1.2 }),
      dot(rows.filter((_, index) => index % 13 === 0), { x: 'x', y: 'value', key: 'id', fill: color, r: 3 }),
    ],
    x: { scale: scaleLinear().domain([0, 63]), axis: false },
    y: { scale: scaleLinear().domain([0, 100]), axis: false, grid: true },
    margin: { top: 12, right: 16, bottom: 18, left: 16 },
    theme: { background: 'transparent' },
    animate: true,
  }), [color, kind, rows])

  return React.createElement(Chart, { definition, height: 240, initialWidth: 620, ariaLabel: 'Technical indicator trend' })
}

const cards = [
  { title: 'Momentum & Money Flow', description: 'RSI, WaveTrend, and flow pressure', metric: 'RSI 63.4', tone: 'Bullish' },
  { title: 'Relative Strength Index', description: 'Momentum against overbought zones', metric: 'RSI 58.7', tone: 'Neutral' },
  { title: 'Volatility', description: 'Range expansion and compression', metric: 'ATR 2.41', tone: 'Rising' },
  { title: 'Trend Strength', description: 'Directional movement and confirmation', metric: 'ADX 31.8', tone: 'Strong' },
]

function Dashboard() {
  const [revisions, setRevisions] = React.useState([0, 0, 0, 0])

  return React.createElement('section', { className: 'dashboard' },
    React.createElement('style', null, '.dashboard{color:#f3f3f4;font-family:Inter,system-ui,sans-serif}.dashboard h1{margin:0 0 24px;font-size:28px;letter-spacing:-.035em}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.card{overflow:hidden;min-width:0;border:1px solid #28292d;border-radius:18px;background:#030304}.head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:20px 20px 10px}.head h2{margin:0;font-size:16px}.head p{margin:5px 0 0;color:#98999f;font-size:12px}.head button{border:1px solid #3c3d42;border-radius:10px;background:#222225;color:#e4e4e6;padding:8px 11px;cursor:pointer}.chart{height:240px;margin:0 10px}.footer{display:flex;align-items:center;gap:16px;border-top:1px solid #1d1e21;margin:0 10px;padding:13px 10px;color:#c2c2c5;font-size:12px}.footer span:last-child{color:#46be78}.meter{display:flex;gap:2px;margin-left:auto}.meter i{display:block;width:3px;height:10px;background:#46be78}.meter i:nth-child(n+8){opacity:.2}@media(max-width:900px){.grid{grid-template-columns:1fr}}'),
    React.createElement('h1', null, 'Technical Indicators'),
    React.createElement('div', { className: 'grid' }, cards.map((card, index) =>
      React.createElement('article', { className: 'card', key: card.title },
        React.createElement('header', { className: 'head' },
          React.createElement('div', null, React.createElement('h2', null, card.title), React.createElement('p', null, card.description)),
          React.createElement('button', { onClick: () => setRevisions((values) => values.map((value, item) => item === index ? value + 1 : value)) }, 'Analyze'),
        ),
        React.createElement('div', { className: 'chart' }, React.createElement(IndicatorChart, { kind: index, revision: revisions[index] })),
        React.createElement('footer', { className: 'footer' },
          React.createElement('span', null, card.metric),
          React.createElement('span', null, card.tone),
          React.createElement('span', { className: 'meter', 'aria-hidden': true }, Array.from({ length: 10 }, (_, item) => React.createElement('i', { key: item }))),
        ),
      ),
    )),
  )
}

export default function render(output) {
  const root = document.createElement('div')
  root.style.margin = '-24px'
  root.style.padding = '28px'
  root.style.minHeight = '100vh'
  root.style.background = '#09090a'
  output.append(root)
  createRoot(root).render(React.createElement(Dashboard))
}`

export const builderExamples = [
  {
    id: 'duty-status',
    title: 'Duty Status Log',
    description:
      'A 24-hour ELD timeline with status, duration, and event annotations.',
    source: dutyStatusSource,
  },
  {
    id: 'population-race',
    title: 'World Population Race',
    description: 'Animated population rankings from 1961 to 2021.',
    source: populationRaceSource,
  },
  {
    id: 'technical-indicators',
    title: 'Technical Indicators',
    description:
      'A responsive dashboard of momentum, volatility, and trend signals.',
    source: technicalIndicatorsSource,
  },
] satisfies Array<BuilderExample>
