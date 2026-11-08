import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  geoDistance,
  geoGraticule10,
  geoOrthographic,
  scaleIdentity,
  select,
  zoom,
  zoomIdentity,
  type D3ZoomEvent,
} from 'd3'
import { MinusIcon, PauseIcon, PlayIcon, PlusIcon } from '@phosphor-icons/react'
import { defineChart, type ChartPoint } from '@tanstack/charts'
import { geoShape } from '@tanstack/charts/geo'
import { Chart } from '@tanstack/charts/react'
import { tooltip } from '@tanstack/charts/tooltip'
import { decorative } from '@tanstack/charts/mark/decorative'
import { text } from '@tanstack/charts/text'
import type { Maintainer } from '~/libraries/maintainers'
import type { LibraryId } from '~/libraries/types'
import { categoryOf } from '~/libraries/categories'
import land from '~/data/maintainers-land.json'

type LandGeometry = {
  type: 'MultiPolygon'
  coordinates: number[][][][]
}

type MaintainerPin = {
  type: 'Feature'
  id: string
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: Record<string, never>
  members: Maintainer[]
  x: number
  y: number
  fill: string
}

const initialView = { longitude: -12, latitude: 26, scale: 1 }
const maxScale = 2.5
const autoRotationInterval = 1000 / 30
const sphere = { type: 'Sphere' } as const
const graticule = geoGraticule10()
const pinRadius = 5
const groupRadius = 10
const pinStrokeWidth = 1.5

const worldLand: LandGeometry = {
  type: 'MultiPolygon',
  coordinates: land.coordinates,
}

function getMapLibraryId(
  maintainer: Maintainer,
  selectedLibraries?: LibraryId[],
) {
  return [
    ...(maintainer.creatorOf ?? []),
    ...(maintainer.maintainerOf ?? []),
    ...(maintainer.contributorOf ?? []),
    ...(maintainer.consultantOf ?? []),
  ].find((id) => !selectedLibraries?.length || selectedLibraries.includes(id))
}

function createMaintainersGlobeChart(
  maintainers: Maintainer[],
  selectedLibraries: LibraryId[] | undefined,
  { longitude, latitude, scale }: typeof initialView,
  oceanGradient: string,
) {
  return defineChart({
    chart: ({ width, height }) => {
      const center: [number, number] = [longitude, latitude]
      const projection = geoOrthographic()
        .translate([width / 2, height / 2])
        .scale((Math.min(width, height) / 2 - 14) * scale)
        .rotate([-longitude, -latitude])
        .precision(1)
        .clipExtent([
          [0, 0],
          [width, height],
        ])

      const located = maintainers
        .flatMap((member) => {
          if (!member.location) return []
          const coordinates: [number, number] = [
            member.location.longitude,
            member.location.latitude,
          ]
          if (geoDistance(center, coordinates) >= Math.PI / 2) return []
          const position = projection(coordinates)
          if (!position) return []
          const [x, y] = position
          if (x < 0 || x > width || y < 0 || y > height) return []
          return [{ member, coordinates, x, y }]
        })
        .sort((a, b) => a.member.github.localeCompare(b.member.github))
      const groups = located.map((anchor) => ({
        anchor,
        members: [anchor.member],
      }))
      let merged = true
      while (merged) {
        merged = false
        for (const [index, group] of groups.entries()) {
          for (
            let otherIndex = index + 1;
            otherIndex < groups.length;
            otherIndex++
          ) {
            const other = groups[otherIndex]
            const radius = group.members.length > 1 ? groupRadius : pinRadius
            const otherRadius =
              other.members.length > 1 ? groupRadius : pinRadius
            if (
              Math.hypot(
                group.anchor.x - other.anchor.x,
                group.anchor.y - other.anchor.y,
              ) <=
              radius + otherRadius + pinStrokeWidth
            ) {
              group.members.push(...other.members)
              groups.splice(otherIndex, 1)
              otherIndex--
              merged = true
            }
          }
        }
      }
      const pins: MaintainerPin[] = []
      for (const { anchor, members } of groups) {
        members.sort((a, b) => a.github.localeCompare(b.github))
        const categories = new Set(
          members.map((member) => {
            const libraryId = getMapLibraryId(member, selectedLibraries)
            return libraryId ? categoryOf(libraryId) : undefined
          }),
        )
        const category =
          categories.size === 1 ? categories.values().next().value : undefined
        pins.push({
          type: 'Feature',
          id: members.map((member) => member.github).join(','),
          geometry: { type: 'Point', coordinates: anchor.coordinates },
          properties: {},
          members,
          x: anchor.x,
          y: anchor.y,
          fill: category
            ? `var(--color-category-${category})`
            : 'var(--color-text-secondary)',
        })
      }
      return {
        marks: [
          decorative(
            geoShape([sphere], {
              id: 'maintainers-sphere',
              projection: () => projection,
              fill: `url(#${oceanGradient})`,
              stroke: 'var(--charts-globe-rim)',
              strokeWidth: 1.5,
            }),
          ),
          decorative(
            geoShape([graticule], {
              id: 'maintainers-grid',
              projection: () => projection,
              fill: 'none',
              stroke: 'var(--charts-globe-grid)',
              strokeWidth: 0.65,
            }),
          ),
          decorative(
            geoShape([worldLand], {
              id: 'maintainers-land',
              projection: () => projection,
              fill: 'var(--charts-globe-land)',
              stroke: 'var(--charts-globe-coast)',
              strokeWidth: 0.65,
            }),
          ),
          geoShape(pins, {
            id: 'maintainers-pins',
            projection: () => projection,
            key: 'id',
            r: (pin) => (pin.members.length > 1 ? groupRadius : pinRadius),
            fill: (pin) => pin.fill,
            stroke: '#ffffff',
            strokeWidth: pinStrokeWidth,
          }),
          decorative(
            text(
              pins.filter((pin) => pin.members.length > 1),
              {
                id: 'maintainers-counts',
                key: 'id',
                x: 'x',
                y: 'y',
                text: (pin) => pin.members.length,
                fill: '#ffffff',
                fontSize: 11,
                fontWeight: 600,
              },
            ),
          ),
        ],
        scales: {
          x: { scale: scaleIdentity() },
          y: { scale: scaleIdentity() },
        },
        guides: false,
        margin: 0,
        clip: true,
        theme: { background: 'transparent' },
      }
    },
    maxFocusDistance: 16,
    tooltip: {
      use: tooltip,
      format: formatTooltip,
    },
  })
}

function formatTooltip(point: ChartPoint<MaintainerPin>) {
  return point.datum.members
    .map((member) => `${member.name}\n${member.location?.name}`)
    .join('\n\n')
}

export function MaintainersChartsGlobe({
  maintainers,
  selectedLibraries,
}: {
  maintainers: Maintainer[]
  selectedLibraries?: LibraryId[]
}) {
  const oceanGradient = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [view, setView] = useState(initialView)
  const [behavior] = useState(() => zoom<HTMLDivElement, unknown>())
  const [inView, setInView] = useState(false)
  const [entered, setEntered] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [paused, setPaused] = useState(false)
  const interacting = useRef(false)
  const readingPin = useRef(false)
  const onFocusChange = useCallback(
    (point: ChartPoint<MaintainerPin> | null) => {
      readingPin.current = point !== null
    },
    [],
  )

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(preference.matches)
    update()
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!host) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.25
        setInView(visible)
        if (visible) setEntered(true)
      },
      { threshold: 0.25 },
    )
    observer.observe(host)
    return () => observer.disconnect()
  }, [host])

  useEffect(() => {
    if (!inView || paused || reducedMotion) return
    let frame = 0
    let last = 0
    function rotate(now: number) {
      if (!last) last = now
      const elapsed = now - last
      if (elapsed >= autoRotationInterval - 1) {
        last = now
        if (!interacting.current && !readingPin.current && !document.hidden) {
          setView((current) => ({
            ...current,
            longitude:
              (current.longitude + Math.min(elapsed, 50) * 0.012) % 360,
          }))
        }
      }
      frame = requestAnimationFrame(rotate)
    }
    frame = requestAnimationFrame(rotate)
    return () => cancelAnimationFrame(frame)
  }, [inView, paused, reducedMotion])

  useEffect(() => {
    if (!host) return
    const selection = select(host)
    let previous = zoomIdentity
    behavior
      .scaleExtent([1, maxScale])
      .extent((): [[number, number], [number, number]] => [
        [0, 0],
        [host.clientWidth, host.clientHeight],
      ])
      .filter(
        (event: MouseEvent) =>
          !event.button &&
          (event.type !== 'wheel' || event.ctrlKey || event.metaKey),
      )
      .on('start', () => {
        interacting.current = true
      })
      .on('zoom', (event: D3ZoomEvent<HTMLDivElement, unknown>) => {
        const next = event.transform
        if (next.k === previous.k) {
          const degreesPerPixel = 120 / (host.clientHeight * next.k)
          const longitude = (previous.x - next.x) * degreesPerPixel
          const latitude = (next.y - previous.y) * degreesPerPixel
          setView((current) => ({
            ...current,
            longitude: (current.longitude + longitude) % 360,
            latitude: Math.max(-75, Math.min(75, current.latitude + latitude)),
          }))
        } else {
          setView((current) => ({ ...current, scale: next.k }))
        }
        previous = next
      })
      .on('end', () => {
        interacting.current = false
      })
    selection.call(behavior)
    return () => {
      selection.on('.zoom', null)
    }
  }, [host, behavior])

  const definition = useMemo(
    () =>
      createMaintainersGlobeChart(
        maintainers,
        selectedLibraries,
        view,
        oceanGradient,
      ),
    [maintainers, selectedLibraries, view, oceanGradient],
  )
  const locatedCount = maintainers.filter(
    (maintainer) => maintainer.location,
  ).length

  return (
    <section aria-labelledby="maintainers-map-heading" className="space-y-4">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          [data-charts-globe-scene] { opacity: 0; transform: translateY(3.5rem) scale(0.72); }
          [data-charts-globe-scene][data-entered] {
            opacity: 1;
            transform: none;
            animation: charts-globe-enter 850ms cubic-bezier(0.16, 1, 0.3, 1);
          }
        }
        @keyframes charts-globe-enter {
          from { opacity: 0; transform: translateY(3.5rem) scale(0.72); }
          25% { opacity: 1; }
          to { opacity: 1; transform: none; }
        }
      `}</style>
      <div>
        <h2 id="maintainers-map-heading" className="text-xl font-semibold">
          Around the world
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {locatedCount} shared location{locatedCount === 1 ? '' : 's'} ·
          TanStack Charts
        </p>
      </div>
      <div className="relative mx-auto max-w-[40rem]">
        <div
          ref={setHost}
          onKeyDownCapture={(event) => {
            if (!event.shiftKey) return
            const directions: Record<string, [number, number]> = {
              ArrowLeft: [-12, 0],
              ArrowRight: [12, 0],
              ArrowUp: [0, 12],
              ArrowDown: [0, -12],
            }
            const direction = directions[event.key]
            if (!direction) return
            event.preventDefault()
            event.stopPropagation()
            setView((current) => ({
              ...current,
              longitude: (current.longitude + direction[0]) % 360,
              latitude: Math.max(
                -75,
                Math.min(75, current.latitude + direction[1]),
              ),
            }))
          }}
          className="relative isolate touch-none cursor-grab active:cursor-grabbing [--charts-globe-coast:#466b83] [--charts-globe-grid:#91b2c9] [--charts-globe-land:#6e94a9] [--charts-globe-ocean-center:#dceef9] [--charts-globe-ocean-edge:#9fbdd5] [--charts-globe-rim:#7d9db5] dark:[--charts-globe-coast:#82aabc] dark:[--charts-globe-grid:#25485e] dark:[--charts-globe-land:#40758c] dark:[--charts-globe-ocean-center:#203b50] dark:[--charts-globe-ocean-edge:#091620] dark:[--charts-globe-rim:#3d6b84]"
        >
          <svg aria-hidden="true" className="absolute size-0">
            <defs>
              <radialGradient id={oceanGradient} cx="38%" cy="32%" r="68%">
                <stop
                  style={{ stopColor: 'var(--charts-globe-ocean-center)' }}
                />
                <stop
                  offset="100%"
                  stopColor="var(--charts-globe-ocean-edge)"
                />
              </radialGradient>
            </defs>
          </svg>
          <div data-charts-globe-scene data-entered={entered || undefined}>
            <Chart
              definition={definition}
              onFocusChange={onFocusChange}
              initialWidth={640}
              aspectRatio={1}
              ariaLabel="TanStack Charts globe of maintainer locations"
            />
          </div>
        </div>
        <div className="absolute right-0 bottom-0 z-10 flex flex-col gap-1 rounded-lg border border-gray-200 bg-white/95 p-1 text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-800/95 dark:text-gray-100">
          <button
            type="button"
            aria-label="Zoom in"
            disabled={view.scale >= maxScale}
            onClick={() => host && select(host).call(behavior.scaleBy, 1.3)}
            className="grid size-9 place-items-center rounded hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-700"
          >
            <PlusIcon aria-hidden="true" weight="bold" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            disabled={view.scale <= 1}
            onClick={() => host && select(host).call(behavior.scaleBy, 1 / 1.3)}
            className="grid size-9 place-items-center rounded hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-700"
          >
            <MinusIcon aria-hidden="true" weight="bold" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Pause rotation"
            aria-pressed={paused}
            disabled={reducedMotion}
            onClick={() => setPaused((value) => !value)}
            className="grid size-9 place-items-center rounded hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-700"
          >
            {paused ? (
              <PlayIcon aria-hidden="true" weight="bold" className="size-4" />
            ) : (
              <PauseIcon aria-hidden="true" weight="bold" className="size-4" />
            )}
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        <span className="hidden sm:inline sm:pointer-coarse:hidden">
          Drag to rotate. Hold Ctrl or ⌘ while scrolling to zoom. Hover over a
          pin to see nearby maintainers. Use Shift and arrow keys to rotate.
        </span>
        <span className="sm:hidden sm:pointer-coarse:inline">
          Tap a pin to see nearby maintainers.
        </span>
      </p>
      {!locatedCount && (
        <p role="status" className="text-sm text-gray-600 dark:text-gray-400">
          No shared locations for the selected maintainers and contributors.
        </p>
      )}
    </section>
  )
}
