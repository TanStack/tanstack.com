import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { geoDistance, select, zoom, zoomIdentity, type D3ZoomEvent } from 'd3'
import {
  ArrowCounterClockwiseIcon,
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
import { createChartsGlobe, globeHaloScale } from './maintainersChartsGlobe'
import { initialMaintainersView, initialView } from './maintainersGlobeView'

const zoomStep = 1.5
const maxZoom = 128
const mobileInitialScale = zoomStep
const desktopInitialScale = initialView.scale * zoomStep
const mobileViewport = '(max-width: 639px)'
const mobileTopInset = 8
const mobileCornerBleed = 6
const mobileZoomFade = 48
// Allow for rounding in rAF timestamps at 60 Hz and cap redraws on faster displays.
const frameInterval = 1000 / 60 - 1
const markerElevation = 0.015
const entranceThreshold = 0.25
const entranceDuration = 850
const entranceRise = 56
const entranceScale = 0.72
const mobileEntranceScale = 0.93
const profileClearance = 12
const viewportGutter = 16
const offscreenBadgeMinRemaining = 96
const globeRadius = 0.4
const globeGlowDiameter = 0.92
const zoomControls = { width: 46, height: 171 }

type View = typeof initialView

type Anchor = { x: number; y: number; visible: boolean }

type GlobeBounds = {
  width: number
  height: number
  centerY: number
  contentInset: number
  paintWidth: number
  paintHeight: number
  paintTop: number
  projectionHeight: number
}

type ProfileViewport = {
  top: number
  bottom: number
  contentTop: number
  contentBottom: number
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

// Match the Charts globe camera to keep the connectors aligned with the pins.
function projectAnchors(
  groups: MaintainerGroup[],
  { phi, theta, scale }: View,
  { width, centerY, projectionHeight }: GlobeBounds,
) {
  const cosPhi = Math.cos(phi),
    sinPhi = Math.sin(phi),
    cosTheta = Math.cos(theta),
    sinTheta = Math.sin(theta)
  const centerX = width / 2
  const pixels = (projectionHeight * scale) / 2
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
    const pendingImages = {
      portraits: Array.from(
        portraits.querySelectorAll<HTMLImageElement>(
          'img[data-globe-src]:not([src])',
        ),
      ),
      count: Array.from(
        count.querySelectorAll<HTMLImageElement>(
          'img[data-globe-src]:not([src])',
        ),
      ),
    }
    return [{ id, card, line, pin, sizes, pendingImages }]
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
  const maxConnectorLength = mobile ? 48 : 72
  const left = mobile ? 0 : viewportGutter
  const right = bounds.width - left
  const top = Math.max(viewport.contentTop, viewport.top)
  const badgeTop = Math.max(0, top)
  const bottom = Math.min(viewport.bottom, viewport.contentBottom)
  const visibleTop = viewport.top - viewportGutter
  const visibleBottom = Math.min(
    viewport.bottom + viewportGutter,
    viewport.contentBottom,
  )
  const showOffscreenBadges =
    bounds.height - visibleTop >=
    Math.min(offscreenBadgeMinRemaining, bounds.height / 4)
  const { paintTop } = bounds
  const paintBottom = paintTop + bounds.paintHeight
  const pinTop = Math.max(
    viewport.contentTop,
    visibleTop,
    mobile ? paintTop : -Infinity,
  )
  const pinBottom = mobile
    ? Math.min(paintBottom, visibleBottom)
    : visibleBottom
  const contentRight = bounds.width - bounds.contentInset
  const ui = [
    {
      left: contentRight - zoomControls.width,
      right: contentRight,
      top: bounds.height - zoomControls.height,
      bottom: bounds.height,
    },
    {
      left: bounds.contentInset,
      right: contentRight,
      top: viewport.helpTop,
      bottom: viewport.helpBottom,
    },
    ...viewport.filters,
  ]
  const labels = nodes.flatMap(
    ({ id, card, line, pin, sizes, pendingImages }) => {
      const anchor = anchors.get(id)
      if (!anchor) return []
      const pinVisibility =
        anchor.visible &&
        anchor.y >= viewport.contentTop &&
        anchor.y + viewportGutter <= viewport.contentBottom &&
        (!mobile || (anchor.y >= paintTop && anchor.y <= paintBottom))
          ? 'visible'
          : 'hidden'
      if (pin.style.visibility !== pinVisibility)
        pin.style.visibility = pinVisibility
      if (pinVisibility === 'visible')
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
        height <= bottom - (offscreen ? badgeTop : top)
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
      }
      const previous = positions.get(id)
      if (!visible) {
        if (previous) previous.visible = false
        return []
      }
      const images = offscreen ? pendingImages.count : pendingImages.portraits
      for (const avatar of images) {
        if (avatar.dataset.globeSrc) avatar.src = avatar.dataset.globeSrc
      }
      images.length = 0
      const fresh = !previous?.visible || previous.offscreen !== offscreen
      const badgeBottom = mobile
        ? Math.min(bottom, Math.max(badgeTop + height, bounds.height))
        : bottom
      const referenceY =
        offscreen === 'top'
          ? badgeTop + height / 2
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
  // A rounded row is a horizontal segment with a semicircle at each end.
  const nearestSpineX = (label: Label, left: number, x: number) =>
    Math.max(
      left + label.height / 2,
      Math.min(x, left + label.width - label.height / 2),
    )
  const withinReach = (label: Label, { x, y }: { x: number; y: number }) =>
    Boolean(label.offscreen) ||
    (nearestSpineX(label, x, label.anchorX) - label.anchorX) ** 2 +
      (y + label.height / 2 - label.anchorY) ** 2 <=
      (maxConnectorLength + label.height / 2) ** 2
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
    { width, height, offscreen }: Label,
  ) => {
    position.x = Math.max(left, Math.min(right - width, position.x))
    const minY = offscreen ? badgeTop : top
    const maxY = bottom - height
    position.y = Math.max(minY, Math.min(maxY, position.y))
    if (!overlapsUi(position.x, position.y, width, height)) return

    // A slot next to one control can still cover another. Check all of them
    // before moving the row so it settles in one valid position.
    let nearestY = position.y
    let nearestDistance = Infinity
    for (const obstacle of ui) {
      for (const y of [obstacle.top - height - gap, obstacle.bottom + gap]) {
        const distance = Math.abs(y - position.y)
        if (
          y >= minY &&
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
  function findSpace(label: Label, obstacles: Label[], onlyReachable = false) {
    const tooFar = !withinReach(label, label)
    let preferred = { x: label.x, y: label.y }
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
      label.offscreen ? badgeTop : top,
      bottom - label.height,
      ...ui.flatMap((box) => [box.top - label.height - gap, box.bottom + gap]),
      ...obstacles.flatMap((other) => [
        other.y - label.height - gap,
        other.y + other.height + gap,
      ]),
    ]
    if ((label.fresh || tooFar) && !label.offscreen) {
      const dx = label.anchorX - bounds.width / 2
      const dy = label.anchorY - bounds.centerY
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
        constrain(candidate, label)
        if (
          Math.abs(candidate.x - x) > 0.1 ||
          Math.abs(candidate.y - y) > 0.1 ||
          !withinReach(label, candidate) ||
          overlapsUi(candidate.x, candidate.y, label.width, label.height) ||
          obstacles.some((other) => overlaps(candidate, other))
        )
          continue
        label.x = candidate.x
        label.y = candidate.y
        bestScore = score
      }
      if (bestScore < Infinity) return
      preferred = {
        x: originX + directionX * clearance,
        y: originY + directionY * clearance,
      }
      constrain(preferred, label)
      xs[0] = preferred.x
      ys[0] = preferred.y
    }
    let best = {
      ...(onlyReachable ? { x: label.x, y: label.y } : preferred),
      distance: Infinity,
      reachable: false,
    }
    for (const x of xs)
      for (const y of ys) {
        const candidate = { ...label, x, y }
        constrain(candidate, label)
        const reachable = withinReach(label, candidate)
        if (!reachable && (onlyReachable || best.reachable)) continue
        if (
          overlapsUi(candidate.x, candidate.y, label.width, label.height) ||
          obstacles.some((other) => overlaps(candidate, other))
        )
          continue
        const distance =
          (candidate.x - preferred.x) ** 2 + (candidate.y - preferred.y) ** 2
        if ((reachable && !best.reachable) || distance < best.distance)
          best = { x: candidate.x, y: candidate.y, distance, reachable }
      }
    label.x = best.x
    label.y = best.y
  }
  for (const label of labels) constrain(label, label)
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
        constrain(a, a)
        constrain(b, b)
      }
    if (!collision) break
  }
  // If the screen edge blocks a local separation, relocate only the smaller
  // blocked row, rather than repacking the whole visible hemisphere.
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i]
    const colliding = labels.some(
      (other) => other !== label && overlaps(label, other),
    )
    if (colliding || !withinReach(label, label)) {
      findSpace(
        label,
        labels.filter((other) => other !== label),
        !colliding,
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
      constrain(candidate, label)
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
    constrain(position, label)
    position.vx = (position.vx - frequency * stepX) * decay
    position.vy = (position.vy - frequency * stepY) * decay
    moving ||=
      Math.abs(dx) +
        Math.abs(dy) +
        Math.abs(position.vx) +
        Math.abs(position.vy) >
      0.05
    label.card.style.transform = `translate(${position.x}px, ${position.y}px)`
    // Keep the row accessible if the available slots are all out of range.
    const connected = !label.offscreen && withinReach(label, position)
    label.line.style.visibility = connected ? '' : 'hidden'
    if (!connected) continue
    const centerX = position.x + label.width / 2
    const centerY = position.y + label.height / 2
    const radialX = label.anchorX - bounds.width / 2
    const radialY = label.anchorY - bounds.centerY
    const alongRadius =
      ((centerX - label.anchorX) * radialX +
        (centerY - label.anchorY) * radialY) /
      (radialX * radialX + radialY * radialY || 1)
    const radialEndX = label.anchorX + radialX * alongRadius
    const radialEndY = label.anchorY + radialY * alongRadius
    const insideProfile = (x: number, y: number) =>
      (nearestSpineX(label, position.x, x) - x) ** 2 + (y - centerY) ** 2 <
      (label.height / 2) ** 2
    const radialDistance = Math.hypot(
      radialEndX - label.anchorX,
      radialEndY - label.anchorY,
    )
    const fraction = Math.min(1, maxConnectorLength / radialDistance)
    const radialFits =
      insideProfile(radialEndX, radialEndY) &&
      insideProfile(
        label.anchorX + (radialEndX - label.anchorX) * fraction,
        label.anchorY + (radialEndY - label.anchorY) * fraction,
      )
    const closestX = nearestSpineX(label, position.x, label.anchorX)
    label.line.setAttribute('x1', String(label.anchorX))
    label.line.setAttribute('y1', String(label.anchorY))
    label.line.setAttribute('x2', String(radialFits ? radialEndX : closestX))
    label.line.setAttribute('y2', String(radialFits ? radialEndY : centerY))
  }
  return moving
}

type MaintainersMapProps = {
  maintainers: Maintainer[]
  selectedLibraries?: LibraryId[]
  initialLocation: Parameters<typeof initialMaintainersView>[0]
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border-default px-1 py-0.5 font-sans text-[0.9em]">
      {children}
    </kbd>
  )
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
        className="pointer-events-none absolute inset-0 bg-background-subtle transition-opacity duration-300 peer-data-[loaded]:opacity-0 motion-reduce:transition-none"
      />
    </span>
  )
}

export function MaintainersMap({
  maintainers,
  selectedLibraries,
  initialLocation,
}: MaintainersMapProps) {
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [host, setHost] = useState((): HTMLDivElement | null => null)
  const [surface, setSurface] = useState((): HTMLDivElement | null => null)
  const [globe, setGlobe] = useState<ReturnType<
    typeof createChartsGlobe
  > | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [scale, setScale] = useState(initialView.scale)
  const [selectedId, setSelectedId] = useState('')
  const [paused, setPaused] = useState(false)
  const [behavior] = useState(() => zoom<HTMLDivElement, unknown>())
  const [profilePositions] = useState(
    (): Map<string, ProfilePosition> => new Map(),
  )
  const profileNodes = useRef<ReturnType<typeof readProfileNodes>>(undefined)
  const [startingView] = useState(() => initialMaintainersView(initialLocation))
  const view = useRef({ ...startingView })
  const target = useRef({ ...startingView })
  const interacting = useRef(false)
  const pausedRef = useRef(false)
  const pauseRotation = useCallback(() => {
    pausedRef.current = true
    setPaused(true)
  }, [])
  const dirty = useRef(true)
  const wakeGlobe = useRef<() => void>(undefined)
  const invalidate = useCallback(() => {
    dirty.current = true
    wakeGlobe.current?.()
  }, [])
  const hostSize = useRef<GlobeBounds>({
    width: 0,
    height: 0,
    centerY: 0,
    contentInset: 0,
    paintWidth: 0,
    paintHeight: 0,
    paintTop: 0,
    projectionHeight: 0,
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
  // Read by the frame loop, so zooming doesn't restart it.
  const groupsRef = useRef(groups)

  useLayoutEffect(() => {
    if (!host || !surface) return
    const mobile = window.matchMedia(mobileViewport)
    let landingWidth = 0
    let landingHeight = 0
    const readBounds = () => {
      const width = host.clientWidth
      const contentWidth = host.parentElement?.clientWidth ?? width
      const paintWidth = surface.clientWidth
      let height = host.clientHeight
      let centerY = height / 2
      let mobilePaintTop = 0
      let projectionHeight = Math.min(
        height,
        paintWidth / (desktopInitialScale * globeGlowDiameter),
      )
      if (mobile.matches) {
        if (paintWidth !== landingWidth || window.scrollY === 0) {
          landingWidth = paintWidth
          landingHeight =
            window.visualViewport?.height ??
            document.documentElement.clientHeight
        }
        const pageTop = host.getBoundingClientRect().top + window.scrollY
        mobilePaintTop = -Math.ceil(Math.max(0, pageTop))
        host.style.setProperty('--globe-paint-top', `${mobilePaintTop}px`)
        const halfWidth = paintWidth / 2 + mobileCornerBleed
        // Fill the first viewport's corners, then reserve room for the entire globe.
        const bottomDepth = Math.max(
          halfWidth,
          landingHeight - pageTop - mobileTopInset,
        )
        const radius = (bottomDepth ** 2 + halfWidth ** 2) / (2 * bottomDepth)
        projectionHeight = radius / (mobileInitialScale * globeRadius)
        centerY = mobileTopInset + radius
        const globeHeight = Math.ceil(
          centerY + radius * globeHaloScale + mobileTopInset,
        )
        if (height !== globeHeight)
          host.style.setProperty('--globe-mobile-height', `${globeHeight}px`)
        height = globeHeight
      }
      const paintHeight = surface.clientHeight
      return {
        width,
        height,
        centerY,
        contentInset: (width - contentWidth) / 2,
        paintWidth,
        paintHeight,
        paintTop: mobile.matches ? mobilePaintTop : (height - paintHeight) / 2,
        projectionHeight,
      }
    }
    hostSize.current = readBounds()
    const instance = createChartsGlobe(surface)
    setGlobe(instance)
    const updateBounds = () => {
      hostSize.current = readBounds()
      invalidate()
    }
    const resize = new ResizeObserver(updateBounds)
    resize.observe(host)
    resize.observe(surface)
    window.addEventListener('resize', updateBounds)
    const updateTheme = () => {
      const dark = document.documentElement.classList.contains('dark')
      instance.setDark(dark)
      invalidate()
    }
    updateTheme()
    const theme = new MutationObserver(updateTheme)
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => {
      resize.disconnect()
      window.removeEventListener('resize', updateBounds)
      theme.disconnect()
      instance.destroy()
      surface.replaceChildren()
    }
  }, [host, surface, invalidate])

  useLayoutEffect(() => {
    groupsRef.current = groups
    // Regrouping can resize a row before the frame loop can update its line.
    for (const { line } of profileNodes.current ?? [])
      line.style.visibility = 'hidden'
    profileNodes.current = undefined
    globe?.setMarkers(
      groups.map(({ id, vector, members, color }) => ({
        id,
        vector,
        radius: members.length > 1 ? 10 : 6,
        color,
      })),
    )
    invalidate()
  }, [globe, groups, invalidate])

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
    const scene = container.querySelector<HTMLElement>('[data-globe-overlay]')
    const section = container.closest('section')
    const help = section?.querySelector('#maintainers-globe-help')
    const intro = section?.parentElement?.querySelector(':scope > header')
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
    let lastFrame = performance.now()
    const requestFrame = () => {
      if (frame) return
      const now = performance.now()
      if (now - lastFrame > 100) lastFrame = now - frameInterval
      frame = requestAnimationFrame(animate)
    }
    wakeGlobe.current = requestFrame
    const visualViewport = window.visualViewport
    let fadeOffset: number | undefined
    let fadedScale: number | undefined
    let fadedBounds: GlobeBounds | undefined
    const updateViewport = () => {
      const { top, left, height } = container.getBoundingClientRect()
      const contentTop =
        (intro?.getBoundingClientRect().bottom ?? top) - top + viewportGutter
      const helpBounds = help?.getBoundingClientRect()
      // Keep the zoomed paint and floating profiles clear of the next section.
      const nextContent =
        help?.nextElementSibling ?? section?.nextElementSibling
      const contentBottom =
        (nextContent?.getBoundingClientRect().top ??
          helpBounds?.bottom ??
          top + height) -
        top -
        viewportGutter
      const nextFadeOffset = contentBottom - height / 2
      if (fadeOffset !== nextFadeOffset) {
        fadeOffset = nextFadeOffset
        canvasSurface.style.setProperty(
          '--globe-fade-offset',
          `${fadeOffset}px`,
        )
      }
      const screenTop = visualViewport?.offsetTop ?? 0
      const screenHeight =
        visualViewport?.height ?? document.documentElement.clientHeight
      viewport = {
        top: screenTop + navbarHeight + viewportGutter - top,
        bottom: screenTop + screenHeight - viewportGutter - top,
        contentTop,
        contentBottom,
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
    const sectionResize = new ResizeObserver(updateViewport)
    if (section) sectionResize.observe(section)
    if (intro) sectionResize.observe(intro)
    window.addEventListener('scroll', updateViewport, { passive: true })
    window.addEventListener('resize', updateViewport)
    visualViewport?.addEventListener('scroll', updateViewport, {
      passive: true,
    })
    visualViewport?.addEventListener('resize', updateViewport)
    let visible = false
    let anchors = new Map<string, Anchor>()
    let wasGlobeVisible = false
    let layoutMoving = true
    let wasIdle = true
    let entranceVisible = false
    let entered = container.hasAttribute('data-globe-entered')
    let entrancePrepared = false
    let entranceStart: number | undefined
    if (scene) scene.style.transform = ''
    if (entered) scene?.removeAttribute('inert')
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        entranceVisible =
          visible && entry.intersectionRatio >= entranceThreshold
        if (!entranceVisible) entrancePrepared = false
        updateViewport()
      },
      { threshold: [0, entranceThreshold] },
    )
    observer.observe(host)
    const mobile = window.matchMedia(mobileViewport)
    const resetSizes = () => {
      profileNodes.current = undefined
      invalidate()
    }
    mobile.addEventListener('change', resetSizes)
    document.addEventListener('visibilitychange', requestFrame)
    dirty.current = true
    function animate(now: number) {
      frame = 0
      const elapsed = now - lastFrame
      let keepAnimating = elapsed < frameInterval
      if (elapsed >= frameInterval) {
        lastFrame = now
        const bounds = hostSize.current
        const {
          height,
          centerY,
          paintWidth,
          paintHeight,
          paintTop,
          projectionHeight,
        } = bounds
        const radius = projectionHeight * view.current.scale * globeRadius
        const globeTop = centerY - radius
        const globeBottom = centerY + radius
        const visibleGlobeTop = mobile.matches
          ? Math.max(paintTop, globeTop)
          : globeTop
        const visibleGlobeBottom = Math.min(
          mobile.matches
            ? Math.min(paintTop + paintHeight, globeBottom)
            : globeBottom,
          viewport.contentBottom,
        )
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
          const autoRotate =
            globeVisible && !reducedMotion && !pausedRef.current
          if (entered && autoRotate && idle) {
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
            anchors = projectAnchors(groupsRef.current, current, bounds)
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
          // Let the browser paint the hidden surface before revealing the scene.
          const reveal =
            preparing &&
            profileNodes.current !== undefined &&
            (entrancePrepared || reducedMotion)
          if (preparing && profileNodes.current) entrancePrepared = true
          const entering = entranceStart !== undefined
          const progress =
            entranceStart === undefined
              ? Number(entered || reducedMotion)
              : Math.min(1, (now - entranceStart) / entranceDuration)
          const remaining = (1 - progress) ** 4
          // Keep the mobile corners covered even at the start of the entrance.
          const startScale = mobile.matches
            ? mobileEntranceScale
            : entranceScale
          const entryScale = 1 - (1 - startScale) * remaining
          const offsetY = entranceRise * remaining
          if ((entering || reveal) && scene) {
            // Apply the camera's entrance motion to the interactive overlays.
            scene.style.transform = remaining
              ? `translateY(${offsetY}px) scale(${entryScale})`
              : ''
          }
          if ((redraw || entering) && paintHeight > 0) {
            if (
              mobile.matches &&
              (current.scale !== fadedScale || bounds !== fadedBounds)
            ) {
              fadedScale = current.scale
              fadedBounds = bounds
              const fade = Math.min(
                mobileZoomFade,
                mobileZoomFade *
                  Math.max(
                    0,
                    (current.scale - mobileInitialScale) / (zoomStep - 1),
                  ),
              )
              const drawRadius = projectionHeight * current.scale * globeRadius
              const fadeAt = (overflow: number) =>
                `${Math.max(0, Math.min(fade, overflow))}px`
              canvasSurface.style.setProperty(
                '--globe-fade-bottom',
                fadeAt(centerY + drawRadius - paintTop - paintHeight),
              )
              canvasSurface.style.setProperty(
                '--globe-fade-side',
                fadeAt(drawRadius - paintWidth / 2),
              )
            }
            const paintView = {
              ...current,
              scale:
                (current.scale * projectionHeight * entryScale) / paintHeight,
            }
            instance.draw(
              paintView,
              paintWidth,
              paintHeight,
              offsetY +
                (centerY - height / 2) * entryScale +
                (height - paintHeight) / 2 -
                paintTop,
            )
          }
          if (progress === 1) entranceStart = undefined
          if (reveal) {
            entered = true
            if (!reducedMotion) entranceStart = now
            container.setAttribute('data-globe-entered', '')
            scene?.removeAttribute('inert')
          }
          dirty.current = false
          keepAnimating =
            autoRotate ||
            entranceStart !== undefined ||
            (preparing && !entered) ||
            moving ||
            layoutMoving
        }
      }
      if (keepAnimating) requestFrame()
    }
    return () => {
      observer.disconnect()
      sectionResize.disconnect()
      window.removeEventListener('scroll', updateViewport)
      window.removeEventListener('resize', updateViewport)
      visualViewport?.removeEventListener('scroll', updateViewport)
      visualViewport?.removeEventListener('resize', updateViewport)
      mobile.removeEventListener('change', resetSizes)
      document.removeEventListener('visibilitychange', requestFrame)
      cancelAnimationFrame(frame)
      wakeGlobe.current = undefined
    }
  }, [host, globe, surface, reducedMotion, profilePositions, invalidate])

  useEffect(() => {
    if (!host) return
    const selection = select(host)
    let previous = zoomIdentity
    behavior
      .scaleExtent([1, maxZoom])
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
      .on('start', (event: D3ZoomEvent<HTMLDivElement, unknown>) => {
        interacting.current = true
        if (event.sourceEvent) pauseRotation()
      })
      .on('zoom', (event: D3ZoomEvent<HTMLDivElement, unknown>) => {
        const next = event.transform
        if (next.k === previous.k) {
          const radius =
            hostSize.current.projectionHeight * globeRadius * next.k
          target.current.phi += (next.x - previous.x) / radius
          target.current.theta = Math.max(
            -1.2,
            Math.min(
              1.2,
              target.current.theta + (next.y - previous.y) / radius,
            ),
          )
          view.current.phi = target.current.phi
          view.current.theta = target.current.theta
        } else {
          target.current.scale = next.k
          setScale(next.k)
        }
        previous = next
        invalidate()
      })
      .on('end', () => {
        interacting.current = false
        wakeGlobe.current?.()
      })
    selection.call(behavior)
    const initialScale = window.matchMedia(mobileViewport).matches
      ? mobileInitialScale
      : desktopInitialScale
    selection.call(behavior.transform, zoomIdentity.scale(initialScale))
    view.current.scale = initialScale
    return () => {
      selection.on('.zoom', null)
    }
  }, [host, behavior, invalidate, pauseRotation])

  function focus(group: MaintainerGroup) {
    pauseRotation()
    const phi = (-group.location[1] * Math.PI) / 180 - Math.PI / 2
    target.current.phi =
      view.current.phi +
      Math.atan2(
        Math.sin(phi - view.current.phi),
        Math.cos(phi - view.current.phi),
      )
    target.current.theta = (group.location[0] * Math.PI) / 180
    setSelectedId(group.id)
    invalidate()
  }

  // The composite globe needs a focus target for its keyboard rotation controls.
  /* oxlint-disable jsx-a11y/no-noninteractive-tabindex */
  return (
    <section
      aria-label="Maintainer locations"
      className="relative space-y-4 [&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-2 [&_:focus-visible]:outline-border-strong"
    >
      <style>{`
        [data-globe-surface] {
          mask-image: linear-gradient(
            to bottom,
            black calc(50% + var(--globe-fade-offset) - 4rem),
            transparent calc(50% + var(--globe-fade-offset))
          );
        }
        @media ${mobileViewport} {
          [data-globe-surface] {
            top: var(--globe-paint-top, 0px);
            height: calc(100% - var(--globe-paint-top, 0px));
            mask-image:
              linear-gradient(
                to bottom,
                black,
                black calc(100% - var(--globe-fade-bottom, 0px)),
                transparent
              ),
              linear-gradient(
                to right,
                transparent,
                black var(--globe-fade-side, 0px),
                black calc(100% - var(--globe-fade-side, 0px)),
                transparent
              );
            mask-composite: intersect;
          }
        }
        @keyframes maintainer-location-pulse {
          0% { transform: scale(0.45); opacity: 0.7; }
          80%, 100% { transform: scale(2); opacity: 0; }
        }
        @media (prefers-reduced-motion: no-preference) {
          [data-globe-scene] { opacity: 0; }
          [data-globe-entered] [data-globe-scene] {
            opacity: 1;
            animation: maintainer-globe-enter ${entranceDuration}ms cubic-bezier(0.16, 1, 0.3, 1);
          }
        }
        @keyframes maintainer-globe-enter {
          from { opacity: 0; }
          25% { opacity: 1; }
          to { opacity: 1; }
        }
      `}</style>
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
            pauseRotation()
            target.current.phi += direction[0]
            target.current.theta = Math.max(
              -1.2,
              Math.min(1.2, target.current.theta + direction[1]),
            )
            invalidate()
          }}
          className="relative h-[var(--globe-mobile-height,max(125cqw,66svh))] outline-offset-4 [overflow-anchor:none] sm:absolute sm:inset-y-0 sm:left-[calc(50%-50cqw)] sm:h-auto sm:w-[100cqw]"
        >
          <div
            data-globe-scene
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <div
              ref={setSurface}
              data-globe-surface
              className="absolute left-1/2 h-full w-[100cqw] -translate-x-1/2 sm:top-1/2 sm:h-[max(100%,100cqw)] sm:-translate-y-1/2"
            />
          </div>
          <div
            data-globe-scene
            data-globe-overlay
            inert
            className="absolute inset-0"
          >
            <div className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing" />
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible text-text-muted/60 dark:text-text-muted/50"
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
              className="pointer-events-none absolute inset-0"
            >
              {groups.map((group, index) => (
                <span
                  key={group.id}
                  data-globe-anchor={group.id}
                  className="absolute left-0 top-0 size-px"
                  style={{ visibility: 'hidden' }}
                >
                  <span
                    className="absolute -left-2 -top-2 size-4 rounded-full border border-current/70 bg-current/10 motion-safe:animate-[maintainer-location-pulse_2.4s_ease-out_infinite]"
                    style={{
                      animationDelay: `${index * -0.17}s`,
                      color: group.color,
                    }}
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
                    className="pointer-events-auto left-0 top-0 flex w-max items-center -space-x-1 rounded-full border border-border-default dark:border-white/20 bg-background-elevated/95 p-1 shadow-[0_6px_16px_#00000024] group-data-[offscreen]/profile:pointer-events-none group-data-[offscreen]/profile:invisible group-data-[offscreen]/profile:absolute sm:-space-x-1.5 sm:p-1.5"
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
                          className="relative shrink-0 rounded-full bg-background-elevated hover:z-10 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2"
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
                    className="invisible pointer-events-auto absolute left-0 top-0 inline-flex h-7 w-max items-center gap-1 rounded-full border border-border-default dark:border-white/20 bg-background-elevated/95 px-2 text-xs font-semibold tabular-nums shadow-sm group-data-[offscreen]/profile:visible group-data-[offscreen]/profile:static"
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
        <div className="absolute bottom-0 right-0 z-20 flex flex-col gap-1 rounded-lg border border-border-default dark:border-white/20 bg-background-elevated/95 p-1 text-sm text-text-primary shadow-sm">
          <button
            type="button"
            aria-label="Zoom in"
            disabled={scale >= maxZoom}
            onClick={() => {
              pauseRotation()
              if (host) select(host).call(behavior.scaleBy, zoomStep)
            }}
            className="grid size-9 place-items-center rounded hover:bg-surface-state-hover disabled:opacity-40"
          >
            <PlusIcon aria-hidden="true" weight="bold" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            disabled={scale <= 1}
            onClick={() => {
              pauseRotation()
              if (host) select(host).call(behavior.scaleBy, 1 / zoomStep)
            }}
            className="grid size-9 place-items-center rounded hover:bg-surface-state-hover disabled:opacity-40"
          >
            <MinusIcon aria-hidden="true" weight="bold" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Reset zoom and tilt"
            onClick={() => {
              if (!host) return
              select(host).call(
                behavior.scaleTo,
                window.matchMedia(mobileViewport).matches
                  ? mobileInitialScale
                  : desktopInitialScale,
              )
              target.current.theta = startingView.theta
              if (!selectedId) {
                pausedRef.current = false
                setPaused(false)
              }
              wakeGlobe.current?.()
            }}
            className="grid size-9 place-items-center rounded hover:bg-surface-state-hover disabled:opacity-40"
          >
            <ArrowCounterClockwiseIcon
              aria-hidden="true"
              weight="bold"
              className="size-4"
            />
          </button>
          <div className="mx-1 h-px bg-border-subtle dark:bg-white/10" />
          <button
            type="button"
            aria-label="Pause rotation"
            aria-pressed={paused}
            disabled={reducedMotion}
            onClick={() => {
              pausedRef.current = !paused
              setPaused(!paused)
              wakeGlobe.current?.()
            }}
            className="grid size-9 place-items-center rounded hover:bg-surface-state-hover disabled:opacity-40"
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
        className="relative z-20 min-h-8 rounded-lg border border-border-default bg-background-elevated px-3 py-2 text-xs leading-relaxed text-text-primary"
      >
        <span className="hidden sm:inline sm:pointer-coarse:hidden">
          Drag or <Key>Shift</Key>+arrows to rotate. Hold <Key>Ctrl</Key>/
          <Key>⌘</Key> and scroll to zoom. Hover or focus a profile to pause,
          select to see nearby maintainers, <Key>Esc</Key> to close.
        </span>
        <span className="sm:hidden sm:pointer-coarse:inline">
          Drag to rotate, pinch to zoom. Tap a profile to see nearby
          maintainers.
        </span>
      </p>
      {selected && (
        <div
          role="region"
          aria-label="Selected maintainers"
          className="relative z-20 rounded-xl border border-border-default bg-background-subtle/50 p-4 dark:border-white/20"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold">
                {`${selected.members.length} maintainer${selected.members.length === 1 ? '' : 's'} nearby`}
              </h3>
              <p className="mt-1 text-xs text-text-muted">
                Select a profile to open their GitHub.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close selected cluster"
              onClick={() => {
                setSelectedId('')
              }}
              className="rounded p-1 hover:bg-surface-state-hover"
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
                className="flex min-w-0 items-center gap-3 rounded-lg p-2 hover:bg-surface-state-hover"
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
                  <div className="text-xs text-text-muted">
                    {member.location?.name}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
      {!groups.length && (
        <p role="status" className="text-sm text-text-secondary">
          No shared locations for the selected maintainers and contributors.
        </p>
      )}
    </section>
  )
}
