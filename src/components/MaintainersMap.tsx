import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import createGlobe, { type Globe, type Marker } from 'cobe'
import { geoDistance, select, zoom, zoomIdentity, type D3ZoomEvent } from 'd3'
import {
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  XIcon,
} from '@phosphor-icons/react'
import type { Maintainer } from '~/libraries/maintainers'
import type { LibraryId } from '~/libraries/types'
import { categoryOf } from '~/libraries/categories'
import { Tooltip } from '~/ui/Tooltip'

const initialView = { phi: -Math.PI / 2 - 0.25, theta: 0.4, scale: 1.2 }
const zoomStep = 1.5
const mobileViewport = '(max-width: 639px)'
// Allow for rounding in rAF timestamps at 60 Hz and cap redraws on faster displays.
const frameInterval = 1000 / 60 - 1
const markerElevation = 0.015
const entranceThreshold = 0.25
const entranceWarmup = 280
const profileClearance = 12
const viewportGutter = 16
const offscreenBadgeMinRemaining = 96
const canvasHeightStep = 128
const globeRadius = 0.4
const globeGlowDiameter = 0.92
const zoomControls = { width: 46, height: 126 }
const desktopHeading = { width: 176, height: 52 }

type View = typeof initialView

type Anchor = { x: number; y: number; visible: boolean }

type GlobeBounds = {
  width: number
  height: number
  headingLeft: number
}

type ProfileViewport = {
  top: number
  bottom: number
  helpTop: number
  helpBottom: number
  filters: Array<{ left: number; right: number; top: number; bottom: number }>
}

type ProfileSize = { width: number; height: number }
type ProfileSizes = { portraits: ProfileSize; count: ProfileSize }
type OffscreenEdge = 'top' | 'bottom'
type MarkerVector = [x: number, y: number, z: number]

function markerVector(latitude: number, longitude: number): MarkerVector {
  const lat = (latitude * Math.PI) / 180
  const lng = (longitude * Math.PI) / 180 - Math.PI
  const radius = 0.8 + markerElevation
  const horizontalRadius = Math.cos(lat) * radius
  return [
    -horizontalRadius * Math.cos(lng),
    Math.sin(lat) * radius,
    horizontalRadius * Math.sin(lng),
  ]
}

// Match COBE's marker projection without writing marker CSS to the page root.
function projectAnchors(
  groups: MaintainerGroup[],
  { phi, theta, scale }: View,
  width: number,
  height: number,
) {
  const cosPhi = Math.cos(phi),
    sinPhi = Math.sin(phi),
    cosTheta = Math.cos(theta),
    sinTheta = Math.sin(theta)
  const centerX = width / 2
  const centerY = height / 2
  const pixels = centerY * scale
  const anchors = new Map<string, Anchor>()
  for (const {
    id,
    vector: [x, y, z],
  } of groups) {
    const screenX = cosPhi * x + sinPhi * z
    const screenY = sinPhi * sinTheta * x + cosTheta * y - cosPhi * sinTheta * z
    const depth = -sinPhi * cosTheta * x + sinTheta * y + cosPhi * cosTheta * z
    anchors.set(id, {
      x: centerX + screenX * pixels,
      y: centerY - screenY * pixels,
      visible: depth >= 0 || screenX ** 2 + screenY ** 2 >= 0.64,
    })
  }
  return anchors
}

type MaintainerGroup = {
  id: string
  location: [number, number]
  vector: MarkerVector
  members: Maintainer[]
  color: string
}

type ProfilePosition = {
  x: number
  y: number
  vx: number
  vy: number
  offsetX: number
  offsetY: number
  visible: boolean
  offscreen?: OffscreenEdge
}

function readProfileNodes(host: Element) {
  const lines = new Map<string, SVGLineElement>()
  for (const line of host.querySelectorAll<SVGLineElement>('[data-globe-line]'))
    if (line.dataset.globeLine) lines.set(line.dataset.globeLine, line)
  const pins = new Map<string, HTMLElement>()
  for (const pin of host.querySelectorAll<HTMLElement>('[data-globe-anchor]'))
    if (pin.dataset.globeAnchor) pins.set(pin.dataset.globeAnchor, pin)

  return Array.from(
    host.querySelectorAll<HTMLElement>('[data-globe-profile]'),
  ).flatMap((card) => {
    const id = card.dataset.globeProfile
    if (!id) return []
    const line = lines.get(id)
    const pin = pins.get(id)
    const portraits = card.querySelector<HTMLElement>('[data-globe-portraits]')
    const count = card.querySelector<HTMLElement>('[data-globe-count]')
    if (!line || !pin || !portraits || !count) return []
    const sizes: ProfileSizes = {
      portraits: {
        width: portraits.offsetWidth,
        height: portraits.offsetHeight,
      },
      count: { width: count.offsetWidth, height: count.offsetHeight },
    }
    return [{ id, card, line, pin, portraits, count, sizes }]
  })
}

function profileOffset(
  width: number,
  height: number,
  directionX: number,
  directionY: number,
) {
  return (
    Math.min(
      width / (2 * Math.abs(directionX)),
      height / (2 * Math.abs(directionY)),
    ) + profileClearance
  )
}

// Carry each row along with its marker and let it drift closer when room opens.
// Runs every frame: card sizes are cached and read before any style writes, so
// the frame never forces a layout.
function placeProfiles(
  nodes: ReturnType<typeof readProfileNodes>,
  bounds: GlobeBounds,
  mobile: boolean,
  anchors: Map<string, Anchor>,
  positions: Map<string, ProfilePosition>,
  elapsed: number,
  canReturn: boolean,
  viewport: ProfileViewport,
  globeVisible: boolean,
) {
  const gap = mobile ? 4 : 8
  const left = mobile ? 0 : viewportGutter
  const right = bounds.width - left
  const top = Math.max(0, viewport.top)
  const bottom = viewport.bottom
  const visibleTop = viewport.top - viewportGutter
  const visibleBottom = viewport.bottom + viewportGutter
  const showOffscreenBadges =
    bounds.height - visibleTop >=
    Math.min(offscreenBadgeMinRemaining, bounds.height / 4)
  const pinTop = mobile ? Math.max(0, visibleTop) : visibleTop
  const pinBottom = mobile
    ? Math.min(bounds.height, visibleBottom)
    : visibleBottom
  const contentRight = bounds.width - bounds.headingLeft
  const ui = [
    {
      left: contentRight - zoomControls.width,
      right: contentRight,
      top: bounds.height - zoomControls.height,
      bottom: bounds.height,
    },
    {
      left: bounds.headingLeft,
      right: contentRight,
      top: viewport.helpTop,
      bottom: viewport.helpBottom,
    },
  ]
  if (!mobile) {
    ui.push(
      {
        left: bounds.headingLeft,
        right: bounds.headingLeft + desktopHeading.width,
        top: 0,
        bottom: desktopHeading.height,
      },
      ...viewport.filters,
    )
  }
  const labels = nodes.flatMap(
    ({ id, card, line, pin, portraits, count, sizes }) => {
      const anchor = anchors.get(id)
      if (!anchor) return []
      const pinVisibility = anchor.visible ? 'visible' : 'hidden'
      if (pin.style.visibility !== pinVisibility)
        pin.style.visibility = pinVisibility
      if (anchor.visible)
        pin.style.transform = `translate(${anchor.x}px, ${anchor.y}px)`
      const anchorX = anchor.x,
        anchorY = anchor.y
      let offscreen: OffscreenEdge | undefined
      if (anchorY < pinTop) offscreen = 'top'
      else if (anchorY > pinBottom) offscreen = 'bottom'
      else if (anchorX < 0 || anchorX > bounds.width)
        offscreen = anchorY < (pinTop + pinBottom) / 2 ? 'top' : 'bottom'
      const { width, height } = offscreen ? sizes.count : sizes.portraits
      const visible =
        globeVisible &&
        anchor.visible &&
        (!offscreen || showOffscreenBadges) &&
        height <= bottom - top
      if (
        (card.dataset.shown === 'true') !== visible ||
        card.dataset.offscreen !== offscreen
      ) {
        card.dataset.shown = String(visible)
        if (offscreen) card.dataset.offscreen = offscreen
        else delete card.dataset.offscreen
        card.style.visibility = visible ? 'visible' : 'hidden'
        card.style.opacity = visible ? '1' : '0'
        card.style.filter = visible ? 'none' : 'blur(6px)'
        card.style.transitionDelay = visible ? '0s, 0s, 0s' : '0s, 0s, 280ms'
        card.inert = !visible
        line.style.opacity = visible && !offscreen ? '1' : '0'
        if (visible) {
          const row = offscreen ? count : portraits
          for (const avatar of row.querySelectorAll<HTMLImageElement>(
            'img[data-globe-src]:not([src])',
          )) {
            if (avatar.dataset.globeSrc) avatar.src = avatar.dataset.globeSrc
          }
        }
      }
      const previous = positions.get(id)
      if (!visible) {
        if (previous) previous.visible = false
        return []
      }
      const fresh = !previous?.visible || previous.offscreen !== offscreen
      const badgeBottom = mobile
        ? Math.min(bottom, Math.max(top + height, bounds.height))
        : bottom
      const referenceY =
        offscreen === 'top'
          ? top + height / 2
          : offscreen === 'bottom'
            ? badgeBottom - height / 2
            : anchorY
      return [
        {
          id,
          card,
          line,
          anchorX,
          anchorY,
          width,
          height,
          fresh,
          offscreen,
          referenceY,
          x: anchorX + (fresh ? -width / 2 : previous.offsetX),
          y: referenceY + (fresh ? -height / 2 : previous.offsetY),
        },
      ]
    },
  )
  type Label = (typeof labels)[number]
  const overlapsUi = (x: number, y: number, width: number, height: number) =>
    ui.some(
      (box) =>
        x < box.right + gap - 0.1 &&
        x + width + gap > box.left + 0.1 &&
        y < box.bottom + gap - 0.1 &&
        y + height + gap > box.top + 0.1,
    )
  const constrain = (
    position: { x: number; y: number },
    width: number,
    height: number,
  ) => {
    position.x = Math.max(left, Math.min(right - width, position.x))
    const maxY = bottom - height
    position.y = Math.max(top, Math.min(maxY, position.y))
    if (!overlapsUi(position.x, position.y, width, height)) return

    // A slot next to one control can still cover another. Check all of them
    // before moving the row so it settles in one valid position.
    let nearestY = position.y
    let nearestDistance = Infinity
    for (const obstacle of ui) {
      for (const y of [obstacle.top - height - gap, obstacle.bottom + gap]) {
        const distance = Math.abs(y - position.y)
        if (
          y >= top &&
          y <= maxY &&
          distance < nearestDistance &&
          !overlapsUi(position.x, y, width, height)
        ) {
          nearestY = y
          nearestDistance = distance
        }
      }
    }
    position.y = nearestY
  }
  const overlaps = (a: Label, b: Label) =>
    a.x < b.x + b.width + gap - 0.1 &&
    a.x + a.width + gap - 0.1 > b.x &&
    a.y < b.y + b.height + gap - 0.1 &&
    a.y + a.height + gap - 0.1 > b.y
  function findSpace(label: Label, obstacles: Label[]) {
    const xs = [
      label.x,
      left,
      right - label.width,
      ...ui.flatMap((box) => [box.left - label.width - gap, box.right + gap]),
      ...obstacles.flatMap((other) => [
        other.x - label.width - gap,
        other.x + other.width + gap,
      ]),
    ]
    const ys = [
      label.y,
      top,
      bottom - label.height,
      ...ui.flatMap((box) => [box.top - label.height - gap, box.bottom + gap]),
      ...obstacles.flatMap((other) => [
        other.y - label.height - gap,
        other.y + other.height + gap,
      ]),
    ]
    if (label.fresh && !label.offscreen) {
      const dx = label.anchorX - bounds.width / 2
      const dy = label.anchorY - bounds.height / 2
      const radius = Math.hypot(dx, dy)
      const directionX = radius ? dx / radius : -1
      const directionY = radius ? dy / radius : 0
      const originX = label.anchorX - label.width / 2
      const originY = label.anchorY - label.height / 2
      const clearance = profileOffset(
        label.width,
        label.height,
        directionX,
        directionY,
      )
      // Try the center-to-location line first. Use the inward side when the
      // edge of the map leaves no room beyond the location.
      let bestScore = Infinity
      for (const distance of [
        clearance,
        -clearance,
        ...xs.map((x) => (x - originX) / directionX),
        ...ys.map((y) => (y - originY) / directionY),
      ]) {
        if (!Number.isFinite(distance) || Math.abs(distance) < clearance)
          continue
        const score =
          Math.abs(distance) + (distance < 0 ? right - left + bottom - top : 0)
        if (score >= bestScore) continue
        const x = originX + directionX * distance
        const y = originY + directionY * distance
        const candidate = { ...label, x, y }
        constrain(candidate, label.width, label.height)
        if (
          Math.abs(candidate.x - x) > 0.1 ||
          Math.abs(candidate.y - y) > 0.1 ||
          overlapsUi(candidate.x, candidate.y, label.width, label.height) ||
          obstacles.some((other) => overlaps(candidate, other))
        )
          continue
        label.x = candidate.x
        label.y = candidate.y
        bestScore = score
      }
      if (bestScore < Infinity) return
      label.x = originX + directionX * clearance
      label.y = originY + directionY * clearance
      constrain(label, label.width, label.height)
      xs[0] = label.x
      ys[0] = label.y
    }
    let best = { x: label.x, y: label.y, distance: Infinity }
    for (const x of xs)
      for (const y of ys) {
        const candidate = { ...label, x, y }
        constrain(candidate, label.width, label.height)
        if (
          overlapsUi(candidate.x, candidate.y, label.width, label.height) ||
          obstacles.some((other) => overlaps(candidate, other))
        )
          continue
        const distance =
          (candidate.x - label.x) ** 2 + (candidate.y - label.y) ** 2
        if (distance < best.distance)
          best = { x: candidate.x, y: candidate.y, distance }
      }
    label.x = best.x
    label.y = best.y
  }
  for (const label of labels) constrain(label, label.width, label.height)
  const settled = labels.filter((label) => !label.fresh)
  for (const label of labels
    .filter((label) => label.fresh)
    .sort((a, b) => b.width - a.width || a.id.localeCompare(b.id))) {
    // Only the arriving row finds a new slot. Established rows stay put.
    findSpace(label, settled)
    settled.push(label)
  }
  for (let pass = 0; pass < 8; pass++) {
    let collision = false
    for (let i = 0; i < labels.length; i++)
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i],
          b = labels[j]
        if (!overlaps(a, b)) continue
        collision = true
        const overlapX =
          Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) + gap
        const overlapY =
          Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) + gap
        const share = b.width / (a.width + b.width)
        if (overlapX < overlapY) {
          const direction = a.x + a.width / 2 <= b.x + b.width / 2 ? -1 : 1
          a.x += direction * overlapX * share
          b.x -= direction * overlapX * (1 - share)
        } else {
          const direction = a.y + a.height / 2 <= b.y + b.height / 2 ? -1 : 1
          a.y += direction * overlapY * share
          b.y -= direction * overlapY * (1 - share)
        }
        constrain(a, a.width, a.height)
        constrain(b, b.width, b.height)
      }
    if (!collision) break
  }
  // If the screen edge blocks a local separation, relocate only the smaller
  // blocked row, rather than repacking the whole visible hemisphere.
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i]
    if (labels.some((other) => other !== label && overlaps(label, other))) {
      findSpace(
        label,
        labels.filter((other) => other !== label),
      )
    }
  }
  let moving = false
  const dt = Math.min(elapsed, 64) / 1000,
    frequency = 14
  if (canReturn) {
    for (const label of labels) {
      if (label.fresh || label.offscreen) continue
      const dx = label.x + label.width / 2 - label.anchorX
      const dy = label.y + label.height / 2 - label.anchorY
      const distance = Math.hypot(dx, dy)
      if (distance <= profileClearance) continue
      const directionX = dx / distance
      const directionY = dy / distance
      const clearance = profileOffset(
        label.width,
        label.height,
        directionX,
        directionY,
      )
      const step = Math.min(distance - clearance, 80 * dt)
      if (step <= 0.1) continue
      const x = label.x - directionX * step
      const y = label.y - directionY * step
      const candidate = { ...label, x, y }
      constrain(candidate, label.width, label.height)
      if (
        candidate.x !== x ||
        candidate.y !== y ||
        labels.some((other) => other !== label && overlaps(candidate, other))
      )
        continue
      label.x = x
      label.y = y
      moving = true
    }
  }
  const decay = Math.exp(-frequency * dt)
  for (const label of labels) {
    let position = positions.get(label.id)
    if (!position?.visible || position.offscreen !== label.offscreen) {
      const dx = label.anchorX - (label.x + label.width / 2)
      const dy = label.anchorY - (label.y + label.height / 2)
      const distance = Math.hypot(dx, dy)
      const step = distance ? Math.min(gap / 2 / distance, 1) : 0
      position = {
        x: label.x + dx * step,
        y: label.y + dy * step,
        vx: 0,
        vy: 0,
        offsetX: label.x - label.anchorX,
        offsetY: label.y - label.referenceY,
        visible: true,
        offscreen: label.offscreen,
      }
      positions.set(label.id, position)
    }
    position.offsetX = label.x - label.anchorX
    position.offsetY = label.y - label.referenceY
    const dx = position.x - label.x,
      dy = position.y - label.y
    const stepX = (position.vx + frequency * dx) * dt
    const stepY = (position.vy + frequency * dy) * dt
    position.x = label.x + (dx + stepX) * decay
    position.y = label.y + (dy + stepY) * decay
    constrain(position, label.width, label.height)
    position.vx = (position.vx - frequency * stepX) * decay
    position.vy = (position.vy - frequency * stepY) * decay
    moving ||=
      Math.abs(dx) +
        Math.abs(dy) +
        Math.abs(position.vx) +
        Math.abs(position.vy) >
      0.05
    label.card.style.transform = `translate(${position.x}px, ${position.y}px)`
    if (label.offscreen) continue
    const centerX = position.x + label.width / 2
    const centerY = position.y + label.height / 2
    const radialX = label.anchorX - bounds.width / 2
    const radialY = label.anchorY - bounds.height / 2
    const alongRadius =
      ((centerX - label.anchorX) * radialX +
        (centerY - label.anchorY) * radialY) /
      (radialX * radialX + radialY * radialY || 1)
    const radialEndX = label.anchorX + radialX * alongRadius
    const radialEndY = label.anchorY + radialY * alongRadius
    // Let the endpoint slide inside the pill as the row follows its marker.
    const endDx = Math.max(
      0,
      Math.abs(radialEndX - centerX) - (label.width - label.height) / 2,
    )
    const endDy = radialEndY - centerY
    const radialFits = endDx ** 2 + endDy ** 2 < (label.height / 2 - 1) ** 2
    label.line.setAttribute('x1', String(label.anchorX))
    label.line.setAttribute('y1', String(label.anchorY))
    label.line.setAttribute('x2', String(radialFits ? radialEndX : centerX))
    label.line.setAttribute('y2', String(radialFits ? radialEndY : centerY))
  }
  return moving
}

type MaintainersMapProps = {
  maintainers: Maintainer[]
  selectedLibraries?: LibraryId[]
}

function GlobeAvatar({
  member,
  color,
  compact = false,
}: {
  member: Maintainer
  color: string
  compact?: boolean
}) {
  return (
    <span
      data-globe-avatar={compact ? 'compact' : 'full'}
      className={`relative block shrink-0 overflow-hidden rounded-full ${compact ? 'size-3 border' : 'size-5 border-2 sm:size-8'}`}
      style={{ borderColor: color }}
    >
      <img
        data-globe-src={member.avatar}
        alt={compact ? '' : member.name}
        width={compact ? 12 : 28}
        height={compact ? 12 : 28}
        loading="lazy"
        decoding="async"
        onLoad={(event) => {
          const image = event.currentTarget
          void image.decode().then(
            () => {
              image.dataset.loaded = ''
            },
            () => {},
          )
        }}
        className="peer block size-full object-cover opacity-0 transition-opacity duration-300 data-[loaded]:opacity-100 motion-reduce:transition-none"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gray-200 transition-opacity duration-300 peer-data-[loaded]:opacity-0 motion-reduce:transition-none dark:bg-gray-700"
      />
    </span>
  )
}

export function MaintainersMap({
  maintainers,
  selectedLibraries,
}: MaintainersMapProps) {
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [host, setHost] = useState((): Element | null => null)
  const [surface, setSurface] = useState((): HTMLDivElement | null => null)
  const [globe, setGlobe] = useState((): Globe | null => null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [scale, setScale] = useState(initialView.scale)
  const [selectedId, setSelectedId] = useState('')
  const [paused, setPaused] = useState(false)
  const [behavior] = useState(() => zoom())
  const [profilePositions] = useState(
    (): Map<string, ProfilePosition> => new Map(),
  )
  const profileNodes = useRef<ReturnType<typeof readProfileNodes>>(undefined)
  const view = useRef({ ...initialView })
  const target = useRef({ ...initialView })
  const interacting = useRef(false)
  const pausedRef = useRef(false)
  const dirty = useRef(true)
  const hostSize = useRef<GlobeBounds>({
    width: 0,
    height: 0,
    headingLeft: 0,
  })

  const groups = useMemo(() => {
    const result: MaintainerGroup[] = []
    for (const member of maintainers) {
      if (!member.location) continue
      const { latitude, longitude } = member.location
      const nearby = result.find(
        (group) =>
          geoDistance(
            [group.location[1], group.location[0]],
            [longitude, latitude],
          ) <
          0.12 / scale,
      )
      if (nearby) nearby.members.push(member)
      else
        result.push({
          id: `${prefix}-${member.github.toLowerCase()}`,
          location: [latitude, longitude],
          vector: markerVector(latitude, longitude),
          members: [member],
          color: '',
        })
    }
    for (const group of result) {
      const categories = new Set(
        group.members.map((member) => {
          const library = [
            ...(member.creatorOf ?? []),
            ...(member.maintainerOf ?? []),
            ...(member.contributorOf ?? []),
            ...(member.consultantOf ?? []),
          ].find(
            (id) =>
              !selectedLibraries?.length || selectedLibraries.includes(id),
          )
          return library ? categoryOf(library) : undefined
        }),
      )
      const category =
        categories.size === 1 ? categories.values().next().value : undefined
      group.color = category
        ? `var(--color-category-${category})`
        : 'var(--color-text-secondary)'
    }
    return result
  }, [maintainers, selectedLibraries, prefix, scale])
  const selected = groups.find((group) => group.id === selectedId)
  const locatedCount = groups.reduce(
    (count, group) => count + group.members.length,
    0,
  )
  // Read by the frame loop, so zooming doesn't restart it.
  const groupsRef = useRef(groups)

  useEffect(() => {
    if (!host || !surface) return
    const readBounds = () => {
      const width = host.clientWidth
      const contentWidth = host.parentElement?.clientWidth ?? width
      return {
        width,
        height: host.clientHeight,
        headingLeft: (width - contentWidth) / 2,
      }
    }
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'display:block;width:100%;height:100%'
    canvas.setAttribute('aria-hidden', 'true')
    surface.append(canvas)
    hostSize.current = readBounds()
    const instance = createGlobe(canvas, {
      width: hostSize.current.width,
      height: hostSize.current.height,
      devicePixelRatio: Math.min(window.devicePixelRatio, 2),
      ...view.current,
      dark: 1,
      diffuse: 1.4,
      mapSamples: 24000,
      mapBrightness: 6,
      mapBaseBrightness: 0,
      baseColor: [0.55, 0.65, 0.72],
      markerColor: [1, 0.57, 0.37],
      glowColor: [0.12, 0.17, 0.2],
      markerElevation,
    })
    setGlobe(instance)
    const updateBounds = () => {
      hostSize.current = readBounds()
      dirty.current = true
    }
    const resize = new ResizeObserver(updateBounds)
    resize.observe(host)
    const updateTheme = () => {
      const dark = document.documentElement.classList.contains('dark')
      instance.update({
        dark: dark ? 1 : 0,
        baseColor: dark ? [0.55, 0.65, 0.72] : [1, 1, 1],
        glowColor: dark ? [0.12, 0.17, 0.2] : [0.9, 0.91, 0.92],
      })
      dirty.current = true
    }
    updateTheme()
    const theme = new MutationObserver(updateTheme)
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => {
      resize.disconnect()
      theme.disconnect()
      instance.destroy()
      surface.replaceChildren()
    }
  }, [host, surface])

  useEffect(() => {
    groupsRef.current = groups
    // Regrouping can replace nodes or change a card's width.
    profileNodes.current = undefined
    dirty.current = true
    if (!globe) return
    // No marker ids: COBE would otherwise rewrite :root custom properties and
    // move an anchor element per marker on every frame.
    const markers: Marker[] = groups.map((group) => ({
      location: group.location,
      size: group.members.length > 1 ? 0.035 : 0.022,
    }))
    globe.update({ markers })
  }, [globe, groups])

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(preference.matches)
    update()
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!host || !globe || !surface) return
    const container = host
    const instance = globe
    const canvasSurface = surface
    const scene = container.querySelector('[data-globe-scene][inert]')
    const section = container.closest('section')
    const help = section?.querySelector('#maintainers-globe-help')
    const filterControls =
      section?.parentElement?.querySelectorAll('[data-globe-filter]') ?? []
    const navbarHeight =
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          '--navbar-height',
        ),
      ) || 0
    let viewport: ProfileViewport
    let viewportChanged = true
    let frame = 0
    const requestFrame = () => {
      if (!frame) frame = requestAnimationFrame(animate)
    }
    const visualViewport = window.visualViewport
    const updateViewport = () => {
      const { top, left } = container.getBoundingClientRect()
      const helpBounds = help?.getBoundingClientRect()
      const screenTop = visualViewport?.offsetTop ?? 0
      const screenHeight =
        visualViewport?.height ?? document.documentElement.clientHeight
      viewport = {
        top: screenTop + navbarHeight + viewportGutter - top,
        bottom: screenTop + screenHeight - viewportGutter - top,
        helpTop: (helpBounds?.top ?? 0) - top,
        helpBottom: (helpBounds?.bottom ?? 0) - top,
        filters: Array.from(filterControls, (control) => {
          const rect = control.getBoundingClientRect()
          return {
            top: rect.top - top,
            bottom: rect.bottom - top,
            left: rect.left - left,
            right: rect.right - left,
          }
        }),
      }
      viewportChanged = true
      requestFrame()
    }
    updateViewport()
    window.addEventListener('scroll', updateViewport, { passive: true })
    window.addEventListener('resize', updateViewport)
    visualViewport?.addEventListener('scroll', updateViewport, {
      passive: true,
    })
    visualViewport?.addEventListener('resize', updateViewport)
    let visible = false,
      lastFrame = performance.now()
    let renderedWidth = 0
    let renderedHeight = 0
    let anchors = new Map<string, Anchor>()
    let wasGlobeVisible = false
    let layoutMoving = true
    let wasIdle = true
    let entranceVisible = false
    let entered = container.hasAttribute('data-globe-entered')
    let entranceReadyAt: number | undefined
    if (entered) scene?.removeAttribute('inert')
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        entranceVisible =
          visible && entry.intersectionRatio >= entranceThreshold
        if (!entranceVisible) entranceReadyAt = undefined
        updateViewport()
      },
      { threshold: [0, entranceThreshold] },
    )
    observer.observe(host)
    const mobile = window.matchMedia(mobileViewport)
    const resetSizes = () => {
      profileNodes.current = undefined
      dirty.current = true
    }
    mobile.addEventListener('change', resetSizes)
    dirty.current = true
    function animate(now: number) {
      frame = 0
      const elapsed = now - lastFrame
      if (elapsed >= frameInterval) {
        lastFrame = now
        const { width, height } = hostSize.current
        const radius = height * view.current.scale * globeRadius
        const globeTop = height / 2 - radius
        const globeBottom = height / 2 + radius
        const visibleGlobeTop = mobile.matches
          ? Math.max(0, globeTop)
          : globeTop
        const visibleGlobeBottom = mobile.matches
          ? Math.min(height, globeBottom)
          : globeBottom
        const globeVisible =
          visibleGlobeBottom > viewport.top - viewportGutter &&
          visibleGlobeTop < viewport.bottom + viewportGutter
        const visibilityChanged = globeVisible !== wasGlobeVisible
        wasGlobeVisible = globeVisible
        if (
          (visible || globeVisible || visibilityChanged) &&
          !document.hidden
        ) {
          const preparing = entranceVisible && !entered
          const readingProfile = container.querySelector(
            '[data-globe-profile]:hover, [data-globe-profile]:focus-within',
          )
          const idle = !readingProfile && !interacting.current
          if (
            entered &&
            globeVisible &&
            !reducedMotion &&
            !pausedRef.current &&
            idle
          ) {
            target.current.phi += Math.min(elapsed, 100) * 0.00015
          }
          const current = view.current,
            next = target.current
          const moving =
            Math.abs(current.phi - next.phi) +
              Math.abs(current.theta - next.theta) +
              Math.abs(current.scale - next.scale) >
            0.00001
          const redraw = moving || dirty.current
          if (redraw) {
            const ease = 1 - Math.exp(-Math.min(elapsed, 100) / 90)
            current.phi += (next.phi - current.phi) * ease
            current.theta += (next.theta - current.theta) * ease
            current.scale += (next.scale - current.scale) * ease
            anchors = projectAnchors(groupsRef.current, current, width, height)
          }
          if (
            redraw ||
            viewportChanged ||
            visibilityChanged ||
            layoutMoving ||
            (preparing && !profileNodes.current) ||
            (idle && !wasIdle)
          ) {
            const nodes = profileNodes.current ?? readProfileNodes(container)
            // The ClientOnly portraits may mount a frame after the pins.
            if (nodes.length === groupsRef.current.length)
              profileNodes.current = nodes
            layoutMoving = placeProfiles(
              nodes,
              hostSize.current,
              mobile.matches,
              anchors,
              profilePositions,
              elapsed,
              idle,
              viewport,
              globeVisible,
            )
            viewportChanged = false
          }
          wasIdle = idle
          // Draw the globe and settle the first profile rows before revealing the scene.
          if (preparing && profileNodes.current) {
            entranceReadyAt ??= now + (reducedMotion ? 0 : entranceWarmup)
          }
          const reveal =
            preparing && entranceReadyAt !== undefined && now >= entranceReadyAt
          if (redraw || reveal) {
            // Paint again just before reveal so COBE can use its loaded texture.
            // Only the paint layer grows with zoom, preserving page layout.
            const extraHeight = mobile.matches
              ? 0
              : Math.max(0, height * (current.scale * globeGlowDiameter - 1))
            const paintHeight =
              height +
              Math.ceil(extraHeight / canvasHeightStep) * canvasHeightStep
            const paintView = {
              ...current,
              scale: (current.scale * height) / paintHeight,
            }
            if (width !== renderedWidth || paintHeight !== renderedHeight) {
              canvasSurface.style.height = `${paintHeight}px`
              instance.update({ ...paintView, width, height: paintHeight })
              renderedWidth = width
              renderedHeight = paintHeight
            } else {
              instance.update(paintView)
            }
          }
          if (reveal) {
            entered = true
            container.setAttribute('data-globe-entered', '')
            scene?.removeAttribute('inert')
          }
          dirty.current = false
        }
      }
      if (elapsed < frameInterval || visible || wasGlobeVisible) requestFrame()
    }
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', updateViewport)
      window.removeEventListener('resize', updateViewport)
      visualViewport?.removeEventListener('scroll', updateViewport)
      visualViewport?.removeEventListener('resize', updateViewport)
      mobile.removeEventListener('change', resetSizes)
      cancelAnimationFrame(frame)
    }
  }, [host, globe, surface, reducedMotion, profilePositions])

  useEffect(() => {
    if (!host) return
    const selection = select(host)
    let previous = zoomIdentity
    behavior
      .scaleExtent([1, 6])
      .extent((): [[number, number], [number, number]] => [
        [0, 0],
        [host.clientWidth, host.clientHeight],
      ])
      .filter(
        (event: MouseEvent) =>
          !event.button &&
          !(
            event.target instanceof Element &&
            event.target.closest('button, [data-globe-profile]')
          ) &&
          (event.type !== 'wheel' || event.ctrlKey || event.metaKey),
      )
      .on('start', () => {
        interacting.current = true
      })
      .on('zoom', (event: D3ZoomEvent<Element, unknown>) => {
        const next = event.transform
        if (next.k === previous.k) {
          target.current.phi +=
            (next.x - previous.x) / (host.clientHeight * 0.4 * next.k)
          target.current.theta = Math.max(
            -1.2,
            Math.min(
              1.2,
              target.current.theta +
                (next.y - previous.y) / (host.clientHeight * 0.4 * next.k),
            ),
          )
          view.current.phi = target.current.phi
          view.current.theta = target.current.theta
        } else {
          target.current.scale = next.k
          setScale(next.k)
        }
        previous = next
        dirty.current = true
      })
      .on('end', () => {
        interacting.current = false
      })
    selection.call(behavior)
    const initialScale = window.matchMedia(mobileViewport).matches
      ? initialView.scale
      : initialView.scale * zoomStep
    selection.call(behavior.transform, zoomIdentity.scale(initialScale))
    view.current.scale = initialScale
    return () => {
      selection.on('.zoom', null)
    }
  }, [host, behavior])

  function focus(group: MaintainerGroup) {
    const phi = (-group.location[1] * Math.PI) / 180 - Math.PI / 2
    target.current.phi =
      view.current.phi +
      Math.atan2(
        Math.sin(phi - view.current.phi),
        Math.cos(phi - view.current.phi),
      )
    target.current.theta = (group.location[0] * Math.PI) / 180
    setSelectedId(group.id)
    dirty.current = true
  }

  // The composite globe needs a focus target for its keyboard rotation controls.
  /* oxlint-disable jsx-a11y/no-noninteractive-tabindex */
  return (
    <section
      aria-labelledby="maintainers-map-heading"
      className="relative space-y-4"
    >
      <style>{`
        @keyframes maintainer-location-pulse {
          0% { transform: scale(0.45); opacity: 0.7; }
          80%, 100% { transform: scale(2); opacity: 0; }
        }
        @media (prefers-reduced-motion: no-preference) {
          [data-globe-scene] { opacity: 0; transform: scale(0.72); }
          [data-globe-entered] [data-globe-scene] {
            opacity: 1;
            transform: none;
            animation: maintainer-globe-enter 850ms cubic-bezier(0.16, 1, 0.3, 1);
          }
        }
        @keyframes maintainer-globe-enter {
          from { opacity: 0; transform: scale(0.72); }
          25% { opacity: 1; }
          to { opacity: 1; transform: none; }
        }
      `}</style>
      <div className="sm:pointer-events-none sm:absolute sm:top-0 sm:left-0 sm:z-20">
        <div>
          <h2 id="maintainers-map-heading" className="text-xl font-semibold">
            Around the world
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {locatedCount} shared location{locatedCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>
      <div className="relative sm:aspect-[5/4]">
        <div
          ref={setHost}
          role="application"
          aria-roledescription="interactive globe"
          aria-label="Interactive globe of maintainer locations"
          aria-describedby="maintainers-globe-help"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setSelectedId('')
              return
            }
            if (event.target !== event.currentTarget || !event.shiftKey) return
            const directions: Record<string, [number, number]> = {
              ArrowLeft: [-0.15, 0],
              ArrowRight: [0.15, 0],
              ArrowUp: [0, -0.15],
              ArrowDown: [0, 0.15],
            }
            const direction = directions[event.key]
            if (!direction) return
            event.preventDefault()
            target.current.phi += direction[0]
            target.current.theta = Math.max(
              -1.2,
              Math.min(1.2, target.current.theta + direction[1]),
            )
            dirty.current = true
          }}
          className="relative isolate z-10 aspect-square outline-offset-4 [overflow-anchor:none] sm:absolute sm:inset-y-0 sm:left-[calc(50%-50cqw)] sm:z-auto sm:isolation-auto sm:aspect-auto sm:w-[100cqw]"
        >
          <div
            data-globe-scene
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden sm:overflow-visible"
          >
            <div
              ref={setSurface}
              className="absolute inset-x-0 top-1/2 h-full -translate-y-1/2"
            />
          </div>
          <div data-globe-scene inert className="absolute inset-0">
            <div className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing" />
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full text-gray-500/60 sm:overflow-visible dark:text-gray-400/50"
            >
              {groups.map(({ id }) => (
                <line
                  key={id}
                  data-globe-line={id}
                  stroke="currentColor"
                  strokeWidth="1"
                  style={{ opacity: 0, transition: 'opacity 280ms ease' }}
                />
              ))}
            </svg>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden sm:overflow-visible"
            >
              {groups.map((group, index) => (
                <span
                  key={group.id}
                  data-globe-anchor={group.id}
                  className="absolute left-0 top-0 size-px"
                  style={{ visibility: 'hidden' }}
                >
                  <span
                    className="absolute -left-2 -top-2 size-4 rounded-full border border-[#f79163]/70 bg-[#f79163]/10 motion-safe:animate-[maintainer-location-pulse_2.4s_ease-out_infinite]"
                    style={{ animationDelay: `${index * -0.17}s` }}
                  />
                </span>
              ))}
            </div>
            <ClientOnly>
              {groups.map((group) => (
                <div
                  key={group.id}
                  data-globe-profile={group.id}
                  className="group/profile pointer-events-none absolute left-0 top-0 w-max will-change-transform sm:z-10"
                  style={{
                    visibility: 'hidden',
                    opacity: 0,
                    filter: 'blur(6px)',
                    transition:
                      'opacity 280ms ease, filter 280ms ease, visibility 0s linear 280ms',
                  }}
                >
                  <div
                    data-globe-portraits
                    className="pointer-events-auto left-0 top-0 flex w-max items-center -space-x-1 rounded-full border border-white/70 bg-white/95 p-1 shadow-[0_6px_16px_#00000024] group-data-[offscreen]/profile:pointer-events-none group-data-[offscreen]/profile:invisible group-data-[offscreen]/profile:absolute sm:-space-x-1.5 sm:p-1.5 dark:border-gray-600 dark:bg-gray-800/95"
                  >
                    {group.members.map((member) => (
                      <Tooltip
                        key={member.github}
                        content={
                          <div className="max-w-64 space-y-1">
                            <div className="font-semibold">{member.name}</div>
                            <div className="opacity-70">
                              {member.location?.name}
                            </div>
                          </div>
                        }
                      >
                        <button
                          type="button"
                          onClick={() => focus(group)}
                          aria-label={`Show ${member.name}`}
                          aria-expanded={selectedId === group.id}
                          className="relative shrink-0 rounded-full bg-white transition-transform hover:z-10 hover:-translate-y-1 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-gray-800"
                        >
                          <GlobeAvatar member={member} color={group.color} />
                        </button>
                      </Tooltip>
                    ))}
                  </div>
                  <button
                    type="button"
                    data-globe-count
                    onClick={() => focus(group)}
                    aria-label={`Show ${group.members.length} ${group.members.length === 1 ? 'maintainer' : 'maintainers'} near ${group.members[0]?.location?.name ?? 'this location'}`}
                    aria-expanded={selectedId === group.id}
                    className="invisible pointer-events-auto absolute left-0 top-0 inline-flex h-7 w-max items-center gap-1 rounded-full border border-white/70 bg-white/95 px-2 text-xs font-semibold tabular-nums shadow-sm group-data-[offscreen]/profile:visible group-data-[offscreen]/profile:static dark:border-gray-600 dark:bg-gray-800/95"
                  >
                    <span aria-hidden="true" className="flex -space-x-0.5">
                      {group.members.map((member) => (
                        <GlobeAvatar
                          key={member.github}
                          member={member}
                          color={group.color}
                          compact
                        />
                      ))}
                    </span>
                    {group.members.length}
                  </button>
                </div>
              ))}
            </ClientOnly>
          </div>
        </div>
        <div className="absolute bottom-0 right-0 z-20 flex flex-col gap-1 rounded-lg border border-gray-200 bg-white/95 p-1 text-sm text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-800/95 dark:text-gray-100">
          <button
            type="button"
            aria-label="Zoom in"
            disabled={scale >= 6}
            onClick={() =>
              host && select(host).call(behavior.scaleBy, zoomStep)
            }
            className="grid size-9 place-items-center rounded hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-700"
          >
            <PlusIcon aria-hidden="true" weight="bold" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            disabled={scale <= 1}
            onClick={() =>
              host && select(host).call(behavior.scaleBy, 1 / zoomStep)
            }
            className="grid size-9 place-items-center rounded hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-700"
          >
            <MinusIcon aria-hidden="true" weight="bold" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Pause rotation"
            aria-pressed={paused}
            disabled={reducedMotion}
            onClick={() => {
              pausedRef.current = !paused
              setPaused(!paused)
            }}
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
      <p
        id="maintainers-globe-help"
        className="relative z-20 min-h-8 text-xs text-gray-500 dark:text-gray-400"
      >
        <span className="hidden sm:inline sm:pointer-coarse:hidden">
          Drag to rotate. Hold Ctrl or ⌘ while scrolling to zoom. Hover over a
          profile to pause, or select it to see nearby maintainers. Use Shift
          and arrow keys to rotate.
        </span>
        <span className="sm:hidden sm:pointer-coarse:inline">
          Tap a profile to see nearby maintainers.
        </span>
      </p>
      {selected && (
        <div
          role="region"
          aria-label="Selected maintainers"
          className="relative z-20 rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-900/30"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold">
                {selected.members.length === 1
                  ? 'Meet the maintainer'
                  : `${selected.members.length} maintainers nearby`}
              </h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Shared locations from this cluster.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close selected cluster"
              onClick={() => {
                setSelectedId('')
              }}
              className="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-800"
            >
              <XIcon />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {selected.members.map((member) => (
              <a
                key={member.github}
                href={`https://github.com/${member.github}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-3 rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <img
                  src={member.avatar}
                  alt=""
                  width={36}
                  height={36}
                  className="size-9 shrink-0 rounded-full"
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{member.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {member.location?.name}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
      {!locatedCount && (
        <p role="status" className="text-sm text-gray-600 dark:text-gray-400">
          No shared locations for the selected maintainers and contributors.
        </p>
      )}
    </section>
  )
}
