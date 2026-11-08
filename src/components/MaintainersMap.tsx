import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import createGlobe, { type Globe, type Marker } from 'cobe'
import { geoDistance, select, zoom, zoomIdentity, type D3ZoomEvent } from 'd3'
import { XIcon } from '@phosphor-icons/react'
import type { Maintainer } from '~/libraries/maintainers'
import type { LibraryId } from '~/libraries/types'
import { categoryOf } from '~/libraries/categories'
import { Tooltip } from '~/ui/Tooltip'

const initialView = { phi: -Math.PI / 2 - 0.25, theta: 0.4, scale: 1.2 }
// Allow for rounding in rAF timestamps at 60 Hz and cap redraws on faster displays.
const frameInterval = 1000 / 60 - 1
const markerElevation = 0.015
const entranceThreshold = 0.25
const entranceWarmup = 280
const zoomControls = { width: 46, height: 86 }
const desktopHeading = { width: 176, height: 52 }

type View = typeof initialView

type Anchor = { x: number; y: number; visible: boolean }

// Same projection COBE uses for its marker anchors (radius 0.8, no offset).
// Doing it here avoids COBE's per-frame :root custom properties, which force
// a style recalc of the whole page on every frame.
function project(
  [latitude, longitude]: [number, number],
  { phi, theta, scale }: View,
  width: number,
  height: number,
): Anchor {
  const lat = (latitude * Math.PI) / 180
  const lng = (longitude * Math.PI) / 180 - Math.PI
  const radius = 0.8 + markerElevation
  const x = -Math.cos(lat) * Math.cos(lng) * radius
  const y = Math.sin(lat) * radius
  const z = Math.cos(lat) * Math.sin(lng) * radius
  const cosPhi = Math.cos(phi),
    sinPhi = Math.sin(phi),
    cosTheta = Math.cos(theta),
    sinTheta = Math.sin(theta)
  const screenX = cosPhi * x + sinPhi * z
  const screenY = sinPhi * sinTheta * x + cosTheta * y - cosPhi * sinTheta * z
  const depth = -sinPhi * cosTheta * x + sinTheta * y + cosPhi * cosTheta * z
  return {
    x: (((screenX / (width / height)) * scale + 1) / 2) * width,
    y: ((-screenY * scale + 1) / 2) * height,
    visible: depth >= 0 || screenX ** 2 + screenY ** 2 >= 0.64,
  }
}

type MaintainerGroup = {
  id: string
  location: [number, number]
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
}

// Keep each location's chosen offset for its entire visible pass. Rotation
// carries the row along; empty space opening up is not a reason to reshuffle.
// Runs every frame: card sizes are cached and read before any style writes, so
// the frame never forces a layout.
function placeProfiles(
  host: Element,
  bounds: { width: number; height: number },
  mobile: boolean,
  anchors: Map<string, Anchor>,
  sizes: Map<string, { width: number; height: number }>,
  positions: Map<string, ProfilePosition>,
  elapsed: number,
) {
  const gap = mobile ? 4 : 8
  const headingRight = mobile ? 0 : desktopHeading.width + gap
  const headingBottom = mobile ? 0 : desktopHeading.height + gap
  const lines = new Map<string, SVGLineElement>()
  for (const line of host.querySelectorAll('[data-globe-line]'))
    if (line instanceof SVGLineElement && line.dataset.globeLine)
      lines.set(line.dataset.globeLine, line)
  const cards = [...host.querySelectorAll('[data-globe-profile]')].filter(
    (card) => card instanceof HTMLElement,
  )
  for (const card of cards) {
    const id = card.dataset.globeProfile
    if (id && !sizes.has(id))
      sizes.set(id, { width: card.offsetWidth, height: card.offsetHeight })
  }
  for (const element of host.querySelectorAll('[data-globe-anchor]')) {
    if (!(element instanceof HTMLElement)) continue
    const anchor = anchors.get(element.dataset.globeAnchor ?? '')
    if (!anchor) continue
    element.style.transform = `translate(${anchor.x}px, ${anchor.y}px)`
    const visibility = anchor.visible ? 'visible' : 'hidden'
    if (element.style.visibility !== visibility)
      element.style.visibility = visibility
  }
  const labels = cards.flatMap((card) => {
    const id = card.dataset.globeProfile
    if (!id) return []
    const line = lines.get(id)
    const anchor = anchors.get(id)
    const size = sizes.get(id)
    if (!line || !anchor || !size) return []
    const anchorX = anchor.x,
      anchorY = anchor.y
    const visible =
      anchor.visible &&
      anchorX >= 0 &&
      anchorX <= bounds.width &&
      anchorY >= 0 &&
      anchorY <= bounds.height
    if ((card.dataset.shown === 'true') !== visible) {
      card.dataset.shown = String(visible)
      card.style.visibility = visible ? 'visible' : 'hidden'
      card.style.opacity = visible ? '1' : '0'
      card.style.filter = visible ? 'blur(0px)' : 'blur(6px)'
      card.style.transitionDelay = visible ? '0s, 0s, 0s' : '0s, 0s, 280ms'
      card.style.pointerEvents = visible ? 'auto' : 'none'
      card.inert = !visible
      line.style.opacity = visible ? '1' : '0'
      if (visible) {
        for (const avatar of card.querySelectorAll(
          'img[data-globe-src]:not([src])',
        )) {
          if (avatar instanceof HTMLImageElement && avatar.dataset.globeSrc)
            avatar.src = avatar.dataset.globeSrc
        }
      }
    }
    const previous = positions.get(id)
    if (!visible) {
      if (previous) previous.visible = false
      return []
    }
    const { width, height } = size
    const fresh = !previous?.visible
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
        x: anchorX + (fresh ? -width / 2 : previous.offsetX),
        y: anchorY + (fresh ? -height - 28 : previous.offsetY),
      },
    ]
  })
  type Label = (typeof labels)[number]
  const constrain = (
    position: { x: number; y: number },
    width: number,
    height: number,
  ) => {
    position.x = Math.max(0, Math.min(bounds.width - width, position.x))
    const bottomClearance =
      position.x + width + gap > bounds.width - zoomControls.width
        ? zoomControls.height + gap
        : 0
    const topClearance = position.x < headingRight ? headingBottom : 0
    position.y = Math.max(
      topClearance,
      Math.min(bounds.height - height - bottomClearance, position.y),
    )
  }
  const overlaps = (a: Label, b: Label) =>
    a.x < b.x + b.width + gap - 0.1 &&
    a.x + a.width + gap - 0.1 > b.x &&
    a.y < b.y + b.height + gap - 0.1 &&
    a.y + a.height + gap - 0.1 > b.y
  function findSpace(label: Label, obstacles: Label[]) {
    const xs = [
      label.x,
      0,
      bounds.width - label.width,
      bounds.width - zoomControls.width - label.width - gap,
      headingRight,
      ...obstacles.flatMap((other) => [
        other.x - label.width - gap,
        other.x + other.width + gap,
      ]),
    ]
    const ys = [
      label.y,
      0,
      bounds.height - label.height,
      bounds.height - zoomControls.height - label.height - gap,
      headingBottom,
      ...obstacles.flatMap((other) => [
        other.y - label.height - gap,
        other.y + other.height + gap,
      ]),
    ]
    let best = { x: label.x, y: label.y, distance: Infinity }
    for (const x of xs)
      for (const y of ys) {
        const candidate = { ...label, x, y }
        constrain(candidate, label.width, label.height)
        if (obstacles.some((other) => overlaps(candidate, other))) continue
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
  const decay = Math.exp(-frequency * dt)
  for (const label of labels) {
    let position = positions.get(label.id)
    if (!position?.visible) {
      position = {
        x: label.x,
        y: label.y + 10,
        vx: 0,
        vy: 0,
        offsetX: label.x - label.anchorX,
        offsetY: label.y - label.anchorY,
        visible: true,
      }
      positions.set(label.id, position)
    }
    position.offsetX = label.x - label.anchorX
    position.offsetY = label.y - label.anchorY
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
    label.line.setAttribute('x1', String(label.anchorX))
    label.line.setAttribute('y1', String(label.anchorY))
    label.line.setAttribute('x2', String(position.x + label.width / 2))
    label.line.setAttribute('y2', String(position.y + label.height))
  }
  return moving
}

type MaintainersMapProps = {
  maintainers: Maintainer[]
  selectedLibraries?: LibraryId[]
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
  const [behavior] = useState(() => zoom())
  const [profilePositions] = useState(
    (): Map<string, ProfilePosition> => new Map(),
  )
  const [profileSizes] = useState(
    (): Map<string, { width: number; height: number }> => new Map(),
  )
  const view = useRef({ ...initialView })
  const target = useRef({ ...initialView })
  const interacting = useRef(false)
  const dirty = useRef(true)
  const hostSize = useRef({ width: 0, height: 0 })

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
    if (!surface) return
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'display:block;width:100%;height:100%'
    canvas.setAttribute('aria-hidden', 'true')
    surface.append(canvas)
    hostSize.current = {
      width: surface.clientWidth,
      height: surface.clientHeight,
    }
    const instance = createGlobe(canvas, {
      width: surface.clientWidth,
      height: surface.clientHeight,
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
    const resize = new ResizeObserver(() => {
      hostSize.current = {
        width: surface.clientWidth,
        height: surface.clientHeight,
      }
      instance.update(hostSize.current)
      dirty.current = true
    })
    resize.observe(surface)
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
  }, [surface])

  useEffect(() => {
    groupsRef.current = groups
    // Grouping can change a card's members, and so its size.
    profileSizes.clear()
    dirty.current = true
    if (!globe) return
    // No marker ids: COBE would otherwise rewrite :root custom properties and
    // move an anchor element per marker on every frame.
    const markers: Marker[] = groups.map((group) => ({
      location: group.location,
      size: group.members.length > 1 ? 0.035 : 0.022,
    }))
    globe.update({ markers })
  }, [globe, groups, profileSizes])

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(preference.matches)
    update()
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!host || !globe) return
    const container = host
    const instance = globe
    const scene = container.querySelector('[data-globe-scene]')
    let visible = false,
      lastFrame = performance.now(),
      frame = 0
    let layoutMoving = true
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
        dirty.current = true
      },
      { threshold: [0, entranceThreshold] },
    )
    observer.observe(host)
    const mobile = window.matchMedia('(max-width: 639px)')
    const resetSizes = () => {
      profileSizes.clear()
      dirty.current = true
    }
    mobile.addEventListener('change', resetSizes)
    dirty.current = true
    function animate(now: number) {
      const elapsed = now - lastFrame
      if (elapsed >= frameInterval) {
        lastFrame = now
        if (visible && !document.hidden) {
          const preparing = entranceVisible && !entered
          const readingProfile = container.querySelector(
            '[data-globe-profile]:hover, [data-globe-profile]:focus-within',
          )
          if (
            entered &&
            !reducedMotion &&
            !interacting.current &&
            !readingProfile
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
          }
          if (redraw || preparing) instance.update(current)
          if (redraw || layoutMoving) {
            const { width, height } = hostSize.current
            const anchors = new Map<string, Anchor>()
            for (const group of groupsRef.current)
              anchors.set(
                group.id,
                project(group.location, current, width, height),
              )
            layoutMoving = placeProfiles(
              container,
              hostSize.current,
              mobile.matches,
              anchors,
              profileSizes,
              profilePositions,
              elapsed,
            )
          }
          // Draw the globe and settle the first profile rows before revealing the scene.
          if (
            preparing &&
            (!groupsRef.current.length ||
              container.querySelector('[data-globe-profile]'))
          ) {
            entranceReadyAt ??= now + (reducedMotion ? 0 : entranceWarmup)
            if (now >= entranceReadyAt) {
              entered = true
              container.setAttribute('data-globe-entered', '')
              scene?.removeAttribute('inert')
            }
          }
          dirty.current = false
        }
      }
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => {
      observer.disconnect()
      mobile.removeEventListener('change', resetSizes)
      cancelAnimationFrame(frame)
    }
  }, [host, globe, reducedMotion, profilePositions, profileSizes])

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
        }
        target.current.scale = next.k
        setScale(next.k)
        previous = next
        dirty.current = true
      })
      .on('end', () => {
        interacting.current = false
      })
    selection.call(behavior)
    selection.call(behavior.transform, zoomIdentity.scale(initialView.scale))
    view.current.scale = initialView.scale
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
            animation: maintainer-globe-enter 850ms cubic-bezier(0.16, 1, 0.3, 1) both;
          }
        }
        @keyframes maintainer-globe-enter {
          from { opacity: 0; transform: scale(0.72); }
          25% { opacity: 1; }
          to { opacity: 1; transform: none; }
        }
      `}</style>
      <div className="sm:pointer-events-none sm:absolute sm:top-0 sm:left-0 sm:z-10">
        <div>
          <h2 id="maintainers-map-heading" className="text-xl font-semibold">
            Around the world
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {locatedCount} shared location{locatedCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>
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
        className="relative isolate aspect-square overflow-hidden outline-offset-4 sm:aspect-[5/4]"
      >
        <div data-globe-scene inert className="absolute inset-0">
          <div
            ref={setSurface}
            className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing"
          />
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full text-gray-500/60 dark:text-gray-400/50"
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
          {groups.map((group, index) => (
            <span
              key={group.id}
              data-globe-anchor={group.id}
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 size-px"
              style={{ visibility: 'hidden' }}
            >
              <span
                className="pointer-events-none absolute -left-2 -top-2 size-4 rounded-full border border-[#f79163]/70 bg-[#f79163]/10 motion-safe:animate-[maintainer-location-pulse_2.4s_ease-out_infinite]"
                style={{ animationDelay: `${index * -0.17}s` }}
              />
            </span>
          ))}
          <ClientOnly>
            {groups.map((group) => (
              <div
                key={group.id}
                data-globe-profile={group.id}
                className="absolute left-0 top-0 w-max"
                style={{
                  visibility: 'hidden',
                  opacity: 0,
                  filter: 'blur(6px)',
                  transition:
                    'opacity 280ms ease, filter 280ms ease, visibility 0s linear 280ms',
                }}
              >
                <div className="flex items-center -space-x-1 rounded-full border border-white/70 bg-white/95 p-1 shadow-[0_6px_16px_#00000024] sm:-space-x-1.5 sm:p-1.5 dark:border-gray-600 dark:bg-gray-800/95">
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
                        <span
                          data-globe-avatar
                          className="relative block size-5 overflow-hidden rounded-full sm:size-7"
                          style={{ border: `2px solid ${group.color}` }}
                        >
                          <img
                            data-globe-src={member.avatar}
                            alt={member.name}
                            width={28}
                            height={28}
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
                      </button>
                    </Tooltip>
                  ))}
                </div>
              </div>
            ))}
          </ClientOnly>
        </div>
        <div className="absolute bottom-0 right-0 flex flex-col gap-1 rounded-lg border border-gray-200 bg-white/95 p-1 text-sm text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-800/95 dark:text-gray-100">
          <button
            type="button"
            aria-label="Zoom in"
            disabled={scale >= 6}
            onClick={() => host && select(host).call(behavior.scaleBy, 1.5)}
            className="grid size-9 place-items-center rounded hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-700"
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            disabled={scale <= 1}
            onClick={() => host && select(host).call(behavior.scaleBy, 1 / 1.5)}
            className="grid size-9 place-items-center rounded hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-700"
          >
            −
          </button>
        </div>
      </div>
      <p
        id="maintainers-globe-help"
        className="min-h-8 text-xs text-gray-500 dark:text-gray-400"
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
          className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-900/30"
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
