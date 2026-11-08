import { createChartRuntime, createMark, defineChart } from '@tanstack/charts'
import type { ChartGradient, SceneNode } from '@tanstack/charts'
import { createSvgChartRenderer } from '@tanstack/charts/svg/renderer'
import type { COBEOptions, Globe } from 'cobe'
import { scaleIdentity } from 'd3'
import land from '~/data/maintainers-globe-land-mask.json'

type Vector = [number, number, number]
const goldenFraction = (Math.sqrt(5) - 1) / 2
const degrees = Math.PI / 180

// The mask is sampled from the same Natural Earth land polygons used by the map.
const landMask = atob(land.landMask)
const landVectors: Vector[] = []
for (let index = 0; index < land.samples; index++) {
  if (!(landMask.charCodeAt(index >> 3) & (1 << (index & 7)))) continue
  const y = 1 - (2 * index) / land.samples
  const angle = ((index * goldenFraction) % 1) * 2 * Math.PI
  const latitudeRadius = Math.sqrt(1 - y * y)
  landVectors.push([
    latitudeRadius * Math.cos(angle),
    y,
    latitudeRadius * Math.sin(angle),
  ])
}

const darkDots = ['#557282', '#a4bccb', '#e0eff7', '#f1f9ff']
const lightDots = ['#c1cbd0', '#889ba5', '#526671', '#263942']

function gradients(dark: boolean): ChartGradient[] {
  const ocean = dark ? '#101314' : '#f4f7f8'
  const rim = dark ? '#18242b' : '#d8e3e9'
  const light = dark ? '#294350' : '#b3c9d6'
  return [
    {
      id: 'ocean',
      type: 'radial',
      stops: [
        { offset: 0, color: ocean },
        { offset: 0.86, color: ocean },
        { offset: 0.99, color: rim },
        { offset: 1, color: rim },
      ],
    },
    {
      id: 'atmosphere',
      type: 'radial',
      stops: [
        { offset: 0, color: light, opacity: 0 },
        { offset: 0.9, color: light, opacity: 0 },
        { offset: 0.93, color: light, opacity: dark ? 0.47 : 0.34 },
        { offset: 0.965, color: light, opacity: 0.11 },
        { offset: 1, color: light, opacity: 0 },
      ],
    },
  ]
}

const round = (value: number) => Math.round(value * 10) / 10

export function createChartsGlobe(
  container: HTMLDivElement,
  options: COBEOptions,
): Globe {
  const state = { ...options }
  const runtime = createChartRuntime()
  const surface = createSvgChartRenderer().mount(container, () => {})
  const idPrefix = container.id || 'maintainer-charts-globe'
  const mark = createMark(() => ({
    id: 'globe',
    channels: {},
    render: ({ chart }) => {
      const { phi, theta, scale = 1, dark, markers = [] } = state
      const centerX = chart.width / 2
      const centerY = chart.height / 2
      const pixels = centerY * scale
      const radius = pixels * 0.8
      const cosPhi = Math.cos(phi)
      const sinPhi = Math.sin(phi)
      const cosTheta = Math.cos(theta)
      const sinTheta = Math.sin(theta)

      // Match the overlay's camera so the dots and avatar connectors stay aligned.
      const rotate = ([x, y, z]: Vector): Vector => {
        const depth = cosPhi * z - sinPhi * x
        return [
          cosPhi * x + sinPhi * z,
          cosTheta * y - sinTheta * depth,
          sinTheta * y + cosTheta * depth,
        ]
      }

      // Batch each shade into a single Charts path. Foreshorten each dot at the rim.
      const paths = ['', '', '', '']
      const dotRadius = radius * 0.0054
      for (const vector of landVectors) {
        const [screenX, screenY, depth] = rotate(vector)
        if (depth < 0.12) continue
        const x = centerX + screenX * radius
        const y = centerY - screenY * radius
        if (
          x < -dotRadius ||
          x > chart.width + dotRadius ||
          y < -dotRadius ||
          y > chart.height + dotRadius
        )
          continue
        const radialLength = Math.hypot(screenX, screenY)
        const dx = radialLength
          ? (screenY * dotRadius) / radialLength
          : dotRadius
        const dy = radialLength ? (screenX * dotRadius) / radialLength : 0
        const major = round(dotRadius)
        const minor = Math.max(0.1, round(dotRadius * depth))
        const angle = Math.round(Math.atan2(dy, dx) / degrees)
        const shade = Math.min(3, Math.floor(depth * 4))
        paths[shade] +=
          `M${round(x + dx)} ${round(y + dy)}a${major} ${minor} ${angle} 1 0 ${round(-2 * dx)} ${round(-2 * dy)}a${major} ${minor} ${angle} 1 0 ${round(2 * dx)} ${round(2 * dy)}z`
      }

      const nodes: SceneNode[] = [
        {
          kind: 'dot',
          key: 'globe-atmosphere',
          x: centerX,
          y: centerY,
          radius: radius * 1.075,
          style: { fill: 'url(#atmosphere)' },
        },
        {
          kind: 'dot',
          key: 'globe-ocean',
          x: centerX,
          y: centerY,
          radius,
          style: { fill: 'url(#ocean)' },
        },
      ]
      const colors = dark ? darkDots : lightDots
      for (const [shade, path] of paths.entries()) {
        if (path)
          nodes.push({
            kind: 'area',
            key: `globe-land-${shade}`,
            points: [],
            path,
            style: { fill: colors[shade] },
          })
      }
      const markerRadius = 0.8 + (state.markerElevation ?? 0)
      for (const {
        location: [latitude, longitude],
        size,
      } of markers) {
        const horizontal = Math.cos(latitude * degrees) * markerRadius
        const [x, y, depth] = rotate([
          horizontal * Math.cos(longitude * degrees),
          Math.sin(latitude * degrees) * markerRadius,
          -horizontal * Math.sin(longitude * degrees),
        ])
        if (depth < 0 && x * x + y * y < 0.64) continue
        nodes.push({
          kind: 'dot',
          key: `globe-pin-${latitude}-${longitude}`,
          x: centerX + x * pixels,
          y: centerY - y * pixels,
          radius: (size * pixels) / 2,
          style: { fill: '#ff915e' },
        })
      }
      return { nodes, points: [] }
    },
  }))

  const chart = defineChart({
    chart: () => ({
      marks: [mark],
      gradients: gradients(Boolean(state.dark)),
      scales: { x: { scale: scaleIdentity() }, y: { scale: scaleIdentity() } },
      guides: false,
      margin: 0,
      theme: { background: 'transparent' },
    }),
  })
  container.dataset.globeRenderer = 'charts'
  container.setAttribute('aria-hidden', 'true')

  const draw = () => {
    if (state.width < 1 || state.height < 1) return
    const scene = runtime.render(chart, {
      width: state.width,
      height: state.height,
    })
    surface.render(scene, {
      ariaLabel: 'Maintainer globe surface',
      idPrefix,
      className: 'block size-full',
    })
  }
  draw()
  return {
    update(next) {
      Object.assign(state, next)
      draw()
    },
    destroy() {
      surface.destroy()
      runtime.destroy()
      delete container.dataset.globeRenderer
      container.removeAttribute('aria-hidden')
    },
  }
}
