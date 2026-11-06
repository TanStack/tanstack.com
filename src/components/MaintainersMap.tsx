import { useEffect, useMemo, useState } from 'react'
import {
  geoEqualEarth,
  scaleIdentity,
  select,
  zoom,
  zoomIdentity,
  type D3ZoomEvent,
} from 'd3'
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

export function createMaintainersMapChart(
  maintainers: Maintainer[],
  selectedLibraries?: LibraryId[],
  transform = zoomIdentity,
) {
  return defineChart({
    chart: ({ width, height }) => {
      const projection = geoEqualEarth().fitExtent(
        [
          [8, 8],
          [width - 8, height - 8],
        ],
        { type: 'Sphere' },
      )
      const [x, y] = projection.translate()
      projection
        .scale(projection.scale() * transform.k)
        .translate([
          x * transform.k + transform.x,
          y * transform.k + transform.y,
        ])
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
          const position = projection(coordinates)
          return position
            ? [{ member, coordinates, x: position[0], y: position[1] }]
            : []
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
            geoShape([worldLand], {
              id: 'maintainers-land',
              projection: () => projection,
              fill: 'currentColor',
              stroke: 'currentColor',
              strokeWidth: 0.5,
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

export function MaintainersMap({
  maintainers,
  selectedLibraries,
}: {
  maintainers: Maintainer[]
  selectedLibraries?: LibraryId[]
}) {
  const [host, setHost] = useState((): Element | null => null)
  const [transform, setTransform] = useState(zoomIdentity)
  const [behavior] = useState(() => zoom())
  const [selectedGithub, setSelectedGithub] = useState(
    (): Maintainer['github'] | undefined => undefined,
  )
  useEffect(() => {
    if (!host) return
    const selection = select(host)
    behavior
      .scaleExtent([1, 128])
      .extent((): [[number, number], [number, number]] => [
        [0, 0],
        [host.clientWidth, host.clientHeight],
      ])
      .filter(
        (event: MouseEvent) =>
          !event.button &&
          (event.type !== 'wheel' || event.ctrlKey || event.metaKey),
      )
      .on('zoom', (event: D3ZoomEvent<Element, unknown>) =>
        setTransform(event.transform),
      )
    selection.call(behavior)
    const resize = new ResizeObserver(() => {
      behavior.translateExtent([
        [0, 0],
        [host.clientWidth, host.clientHeight],
      ])
      selection.call(behavior.scaleBy, 1)
    })
    resize.observe(host)
    return () => {
      resize.disconnect()
      selection.on('.zoom', null)
    }
  }, [host, behavior])
  const definition = useMemo(
    () => createMaintainersMapChart(maintainers, selectedLibraries, transform),
    [maintainers, selectedLibraries, transform],
  )
  function changeZoom(factor: number) {
    if (!host) return
    const location =
      maintainers.find((member) => member.github === selectedGithub)
        ?.location ?? maintainers.find((member) => member.location)?.location
    const projected =
      location &&
      geoEqualEarth().fitExtent(
        [
          [8, 8],
          [host.clientWidth - 8, host.clientHeight - 8],
        ],
        { type: 'Sphere' },
      )([location.longitude, location.latitude])
    const k = Math.max(1, Math.min(128, transform.k * factor))
    const anchor =
      projected ??
      transform.invert([host.clientWidth / 2, host.clientHeight / 2])
    const next = zoomIdentity
      .translate(
        host.clientWidth / 2 - anchor[0] * k,
        host.clientHeight / 2 - anchor[1] * k,
      )
      .scale(k)
    select(host).call(
      behavior.transform,
      behavior.constrain()(
        next,
        [
          [0, 0],
          [host.clientWidth, host.clientHeight],
        ],
        behavior.translateExtent(),
      ),
    )
  }
  function reset() {
    if (host) select(host).call(behavior.transform, zoomIdentity)
  }
  const hasLocations = maintainers.some((maintainer) => maintainer.location)

  return (
    <section aria-labelledby="maintainers-map-heading" className="space-y-4">
      <div>
        <h2 id="maintainers-map-heading" className="text-xl font-semibold">
          Around the world
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Locations are optional and shared by each person. The map follows the
          library filter.
        </p>
      </div>
      <div className="relative">
        <div
          ref={setHost}
          onKeyDownCapture={(event) => {
            if (!host || !event.shiftKey) return
            const directions: Record<string, [number, number]> = {
              ArrowLeft: [40, 0],
              ArrowRight: [-40, 0],
              ArrowUp: [0, 40],
              ArrowDown: [0, -40],
            }
            const direction = directions[event.key]
            if (!direction) return
            event.preventDefault()
            event.stopPropagation()
            select(host).call(
              behavior.translateBy,
              direction[0] / transform.k,
              direction[1] / transform.k,
            )
          }}
          className="touch-none rounded-xl bg-gray-50 text-gray-300 dark:bg-gray-900/50 dark:text-gray-700"
        >
          <Chart
            definition={definition}
            className="[&_svg]:overflow-hidden [&_svg]:rounded-xl [&_svg]:outline-none"
            onSelect={(point) =>
              setSelectedGithub(point?.datum.members[0]?.github)
            }
            initialWidth={896}
            aspectRatio={2}
            ariaLabel="World map of shared maintainer and contributor locations"
          />
        </div>
        <div className="absolute bottom-3 right-3 flex gap-1 rounded-lg border border-gray-200 bg-white/95 p-1 text-sm text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-800/95 dark:text-gray-100">
          <button
            type="button"
            aria-label="Zoom in"
            disabled={transform.k >= 128}
            onClick={() => changeZoom(2)}
            className="rounded px-3 py-2 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-700"
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            disabled={transform.k <= 1}
            onClick={() => changeZoom(0.5)}
            className="rounded px-3 py-2 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-700"
          >
            −
          </button>
          <button
            type="button"
            disabled={
              transform.k === 1 && transform.x === 0 && transform.y === 0
            }
            onClick={reset}
            className="rounded px-3 py-2 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-700"
          >
            Reset
          </button>
        </div>
        <p className="absolute bottom-3 left-3 rounded bg-gray-50/90 px-2 py-1 text-xs text-gray-500 dark:bg-gray-900/90 dark:text-gray-400">
          Made with{' '}
          <a
            href="https://www.naturalearthdata.com/"
            className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-200"
          >
            Natural Earth
          </a>
          .
        </p>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Drag to pan. Use Ctrl or ⌘ and scroll to zoom, or pinch on touch
        screens. Select a pin, then use + to zoom toward it. Use Shift and arrow
        keys to pan.
      </p>
      {!hasLocations && (
        <p role="status" className="text-sm text-gray-600 dark:text-gray-400">
          No shared locations for the selected maintainers and contributors.
        </p>
      )}
    </section>
  )
}
