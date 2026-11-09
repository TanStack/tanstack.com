import { createChartRuntime, createMark, defineChart } from '@tanstack/charts'
import type { ChartGradient, SceneNode } from '@tanstack/charts'
import { createSvgChartRenderer } from '@tanstack/charts/svg/renderer'
import { geoOrthographic, geoPath, scaleIdentity } from 'd3'
import land from '~/data/maintainers-land.json'

type Vector = [number, number, number]
type GlobeView = { phi: number; theta: number; scale: number }
type GlobeMarker = { id: string; vector: Vector; radius: number; color: string }
const degrees = Math.PI / 180
const worldLand: { type: 'MultiPolygon'; coordinates: number[][][][] } = {
  type: 'MultiPolygon',
  coordinates: land.coordinates,
}

function gradients(dark: boolean): ChartGradient[] {
  const ocean = dark
    ? 'var(--color-background-default)'
    : 'var(--color-background-subtle)'
  const rim = dark
    ? 'var(--color-background-elevated)'
    : 'var(--color-ds-neutral-tint-100)'
  const light = dark
    ? 'var(--color-border-default)'
    : 'var(--color-ds-neutral-tint-200)'
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

export const globeHaloScale = 1.075

export function createChartsGlobe(container: HTMLDivElement) {
  let view: GlobeView
  let offsetY = 0
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
      const centerY = chart.height / 2 + offsetY
      const pixels = (chart.height / 2) * scale
      const radius = pixels * 0.8
      const cosPhi = Math.cos(phi)
      const sinPhi = Math.sin(phi)
      const cosTheta = Math.cos(theta)
      const sinTheta = Math.sin(theta)

      const projection = geoOrthographic()
        .rotate([phi / degrees + 90, -theta / degrees])
        .scale(radius)
        .translate([centerX, centerY])
        .clipExtent([
          [0, 0],
          [chart.width, chart.height],
        ])
      const landPath = geoPath(projection)(worldLand)

      const nodes: SceneNode[] = [
        {
          kind: 'dot',
          key: 'globe-atmosphere',
          x: centerX,
          y: centerY,
          radius: radius * globeHaloScale,
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
      if (landPath) {
        nodes.push({
          kind: 'area',
          key: 'globe-land',
          points: [],
          path: landPath,
          style: {
            fill: dark
              ? 'var(--color-ds-neutral-tint-200)'
              : 'var(--color-ds-neutral-tint-400)',
          },
        })
      }
      // Use the same location vectors as the avatar connectors.
      for (const {
        id,
        vector: [vx, vy, vz],
        radius: markerRadius,
        color,
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
          radius: markerRadius,
          style: { fill: color },
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
    draw(nextView: GlobeView, width: number, height: number, nextOffsetY = 0) {
      if (width < 1 || height < 1) return
      view = nextView
      offsetY = nextOffsetY
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
