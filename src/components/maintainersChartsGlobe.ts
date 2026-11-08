import { createChartRuntime, createMark, defineChart } from '@tanstack/charts'
import type { ChartGradient, SceneNode } from '@tanstack/charts'
import { createSvgChartRenderer } from '@tanstack/charts/svg/renderer'
import { scaleIdentity } from 'd3'
import land from '~/data/maintainers-globe-land-mask.json'

type Vector = [number, number, number]
type GlobeView = { phi: number; theta: number; scale: number }
type GlobeMarker = { id: string; vector: Vector; size: number }
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

export function createChartsGlobe(container: HTMLDivElement) {
  let view: GlobeView
  let dark = false
  let markers: GlobeMarker[] = []
  const runtime = createChartRuntime()
  const surface = createSvgChartRenderer().mount(container, () => {})
  const idPrefix = container.id || 'maintainer-charts-globe'
  const mark = createMark(() => ({
    id: 'globe',
    channels: {},
    render: ({ chart }) => {
      const { phi, theta, scale } = view
      const centerX = chart.width / 2
      const centerY = chart.height / 2
      const pixels = centerY * scale
      const radius = pixels * 0.8
      const cosPhi = Math.cos(phi)
      const sinPhi = Math.sin(phi)
      const cosTheta = Math.cos(theta)
      const sinTheta = Math.sin(theta)

      // Batch each shade into a single Charts path. Foreshorten each dot at the rim.
      const paths = ['', '', '', '']
      const dotRadius = radius * 0.0054
      const major = round(dotRadius)
      const right = chart.width + dotRadius
      const bottom = chart.height + dotRadius
      for (const [vx, vy, vz] of landVectors) {
        const horizontalDepth = cosPhi * vz - sinPhi * vx
        const depth = sinTheta * vy + cosTheta * horizontalDepth
        if (depth < 0.12) continue
        const screenX = cosPhi * vx + sinPhi * vz
        const screenY = cosTheta * vy - sinTheta * horizontalDepth
        const x = centerX + screenX * radius
        const y = centerY - screenY * radius
        if (x < -dotRadius || x > right || y < -dotRadius || y > bottom)
          continue
        const radialLength = Math.sqrt(screenX * screenX + screenY * screenY)
        const radialScale = radialLength ? dotRadius / radialLength : 0
        const dx = radialLength ? screenY * radialScale : dotRadius
        const dy = screenX * radialScale
        const minor = Math.max(0.1, round(dotRadius * depth))
        const angle = Math.round(Math.atan2(screenX, screenY) / degrees)
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
      // Use the same location vectors as the avatar connectors.
      for (const {
        id,
        vector: [vx, vy, vz],
        size,
      } of markers) {
        const horizontalDepth = cosPhi * vz - sinPhi * vx
        const x = cosPhi * vx + sinPhi * vz
        const y = cosTheta * vy - sinTheta * horizontalDepth
        const depth = sinTheta * vy + cosTheta * horizontalDepth
        if (depth < 0 && x * x + y * y < 0.64) continue
        nodes.push({
          kind: 'dot',
          key: `globe-pin-${id}`,
          x: centerX + x * pixels,
          y: centerY - y * pixels,
          radius: (size * pixels) / 2,
          style: { fill: '#ff915e' },
        })
      }
      return { nodes, points: [] }
    },
  }))

  const scales = {
    x: { scale: scaleIdentity() },
    y: { scale: scaleIdentity() },
  }
  const charts = [false, true].map((isDark) =>
    defineChart({
      marks: [mark],
      gradients: gradients(isDark),
      scales,
      guides: false,
      margin: 0,
    }),
  )
  const renderOptions = {
    ariaLabel: 'Maintainer globe surface',
    idPrefix,
    className: 'block size-full',
  }
  container.dataset.globeRenderer = 'charts'
  container.setAttribute('aria-hidden', 'true')

  return {
    setDark(nextDark: boolean) {
      dark = nextDark
    },
    setMarkers(nextMarkers: GlobeMarker[]) {
      markers = nextMarkers
    },
    draw(nextView: GlobeView, width: number, height: number) {
      if (width < 1 || height < 1) return
      view = nextView
      const scene = runtime.render(charts[dark ? 1 : 0], { width, height })
      surface.render(scene, renderOptions)
    },
    destroy() {
      surface.destroy()
      runtime.destroy()
      delete container.dataset.globeRenderer
      container.removeAttribute('aria-hidden')
    },
  }
}
