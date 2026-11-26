import * as React from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { crosshair, defineChart, dot } from '@tanstack/charts'
import { Chart } from '@tanstack/charts/react/core'
import { motion } from '@tanstack/charts/motion'
import { tooltip } from '@tanstack/charts/tooltip'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scaleOrdinal } from '@tanstack/charts/scales/ordinal'

// Stable illustrative points for the hero background.
const colors = ['#ec4899', '#8b5cf6', '#3b82f6', '#14b8a6', '#f97316']
const foregroundColors = ['#f39bc4', '#b59bf2', '#92b9fa', '#82d7ce', '#fbc18e']
const renderer = motion({
  initial: false,
  transition: { type: 'spring', stiffness: 220, damping: 26 },
})
const points = Array.from({ length: 2400 }, (_, id) => {
  const x = ((id * 73) % 2401) / 2401
  const spread = Math.sin(id * 127.1) * Math.cos(id * 311.7)
  const y = 0.08 + x * 0.84 + spread * (0.32 + x * 0.5)
  const sizeSample =
    (((id * 97) % 2401) / 2400 +
      ((id * 193 + 419) % 2401) / 2400 +
      ((id * 389 + 811) % 2401) / 2400) /
    3
  const color = x < 0.35 ? colors[0] : x < 0.6 ? colors[1] : colors[2]

  return {
    id,
    x,
    y,
    radius: (2 + sizeSample * 16) * (1 - Math.abs(spread) * 0.75),
    color: id % 29 === 0 ? colors[3] : id % 31 === 0 ? colors[4] : color,
  }
})

function createLayers(pointCount: number) {
  const sortedPoints = points
    .slice(0, pointCount)
    .sort((a, b) => a.radius - b.radius)
  return [
    {
      depth: 0.9,
      size: 0.8,
      opacity: 0.35,
      blur: 5,
      duration: 2200,
      start: 0,
      end: 0.06,
    },
    {
      depth: 1.6,
      size: 0.9,
      opacity: 0.5,
      blur: 0.5,
      duration: 2000,
      start: 0.06,
      end: 0.3,
    },
    {
      depth: 2.6,
      size: 1,
      opacity: 0.65,
      blur: 0,
      duration: 1800,
      start: 0.3,
      end: 0.7,
    },
    {
      depth: 5.5,
      size: 1.15,
      opacity: 0.8,
      blur: 0.5,
      duration: 1600,
      start: 0.7,
      end: 0.94,
    },
    {
      depth: 10,
      size: 1.5,
      opacity: 0.9,
      blur: 8,
      duration: 1400,
      start: 0.94,
      end: 1,
    },
  ].map((layer, index) => {
    const layerPoints = sortedPoints
      .slice(
        Math.round(pointCount * layer.start),
        Math.round(pointCount * layer.end),
      )
      .map((point) => ({
        ...point,
        y:
          index === 4
            ? 0.08 +
              point.x * 0.84 +
              (((point.id * 157 + 653) % 2401) / 2400 - 0.5) *
                (0.45 + point.x * 0.45)
            : point.y,
        radius: point.radius * layer.size,
        color:
          index >= 3
            ? foregroundColors[colors.indexOf(point.color)]
            : point.color,
      }))
    return {
      ...layer,
      points: layerPoints,
      definition: defineChart({
        marks: [
          dot(layerPoints, {
            x: 'x',
            y: 'y',
            key: 'id',
            r: 'radius',
            z: 'color',
            fillOpacity: layer.opacity,
          }),
          ...(index === 2
            ? [
                crosshair({
                  motion: false,
                  stroke: 'var(--color-text-primary)',
                  strokeOpacity: 0.3,
                  strokeDasharray: '4 4',
                  marker: { radius: 4, fill: 'var(--color-text-primary)' },
                }),
              ]
            : []),
        ],
        scales: {
          x: { scale: scaleLinear().domain([0, 1]), axis: false },
          y: { scale: scaleLinear().domain([0, 1]), axis: false },
        },
        margin: 0,
        color: {
          scale: scaleOrdinal()
            .domain([...colors, ...foregroundColors])
            .range([...colors, ...foregroundColors]),
        },
        theme: { background: 'transparent' },
        keyboard: false,
        pointer: index === 2,
        tooltip:
          index === 2
            ? {
                use: tooltip,
                sticky: false,
                format: ({ datum }) =>
                  `Point ${datum.id + 1}\nX: ${datum.x.toFixed(2)} · Y: ${datum.y.toFixed(2)}`,
              }
            : undefined,
      }),
    }
  })
}

export function ChartsHeroBackground() {
  return (
    <div
      aria-hidden="true"
      className="charts-hero-background absolute inset-0"
      onClickCapture={(event) => event.stopPropagation()}
      onPointerDownCapture={(event) => event.stopPropagation()}
    >
      <ClientOnly>
        <ClientHeroChart />
      </ClientOnly>
    </div>
  )
}

function ClientHeroChart() {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [pointCount, setPointCount] = React.useState(0)
  const layers = React.useMemo(
    () => (pointCount ? createLayers(pointCount) : []),
    [pointCount],
  )

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      setPointCount(
        Math.min(
          2400,
          Math.max(200, Math.round(entry.contentRect.width / 100) * 100),
        ),
      )
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])
  const [ready, setReady] = React.useState(false)
  const [visible, setVisible] = React.useState(false)
  const parallaxRefs = React.useRef<Array<HTMLDivElement | null>>([])

  React.useEffect(() => {
    if (!ready) return
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setVisible(true))
    })
    return () => cancelAnimationFrame(frame)
  }, [ready])

  const hasRendered = React.useRef(false)
  const onRender = React.useCallback(() => {
    if (hasRendered.current) return
    hasRendered.current = true
    setReady(true)
  }, [])

  React.useEffect(() => {
    const container = containerRef.current
    if (!container || !layers.length) return
    let inView = true
    const motionAllowed = window.matchMedia(
      '(prefers-reduced-motion: no-preference) and (pointer: fine)',
    )
    let frame = 0
    let previousTime = 0
    let targetX = 0
    let targetY = 0
    const positions = layers.map(() => ({ x: 0, y: 0 }))
    const animate = (now: number) => {
      const elapsed = Math.min(64, previousTime ? now - previousTime : 16)
      previousTime = now
      let moving = false
      parallaxRefs.current.forEach((element, index) => {
        if (!element) return
        const position = positions[index]
        const layer = layers[index]
        const amount = 1 - Math.exp(-elapsed / (layer.duration * 0.25))
        position.x += (targetX - position.x) * amount
        position.y += (targetY - position.y) * amount
        if (
          Math.abs(targetX - position.x) + Math.abs(targetY - position.y) >
          0.0005
        )
          moving = true
        const x = position.x * layer.depth
        const y = position.y * layer.depth
        element.style.transform = `perspective(1400px) translate3d(${x * 12}px, ${y * 10}px, 0) rotateX(${-y * 1.5}deg) rotateY(${x * 1.5}deg) scale(1.035)`
      })
      frame = moving ? requestAnimationFrame(animate) : 0
      if (!moving) previousTime = 0
    }
    const start = () => {
      if (!frame && inView && !document.hidden && motionAllowed.matches)
        frame = requestAnimationFrame(animate)
    }
    const reset = () => {
      targetX = targetY = 0
      if (motionAllowed.matches) start()
      else {
        cancelAnimationFrame(frame)
        frame = previousTime = 0
        positions.forEach((position) => {
          position.x = position.y = 0
        })
        parallaxRefs.current.forEach((element) => {
          if (element)
            element.style.transform = 'perspective(1400px) scale(1.035)'
        })
      }
    }
    const move = (event: PointerEvent) => {
      if (
        !inView ||
        document.hidden ||
        !motionAllowed.matches ||
        event.pointerType !== 'mouse'
      )
        return
      targetX = (event.clientX / window.innerWidth - 0.5) * 2
      targetY = (event.clientY / window.innerHeight - 0.5) * 2
      start()
    }
    const pause = () => {
      cancelAnimationFrame(frame)
      frame = previousTime = 0
    }
    const visibility = () => {
      if (document.hidden) pause()
      else start()
    }
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      if (inView) start()
      else pause()
    })
    observer.observe(container)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pointermove', move)
    document.documentElement.addEventListener('pointerleave', reset)
    motionAllowed.addEventListener('change', reset)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', reset)
      motionAllowed.removeEventListener('change', reset)
    }
  }, [layers])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 origin-center motion-reduce:!transition-none"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(1.04)',
        transition:
          'opacity 2s cubic-bezier(0.22,1,0.36,1), transform 2s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {layers.map((layer, index) => (
        <div
          key={index}
          ref={(element) => {
            parallaxRefs.current[index] = element
          }}
          className={`absolute inset-0 ${index >= 3 ? 'opacity-100' : 'opacity-60 sm:opacity-70 xl:opacity-90'} ${index !== 2 ? 'pointer-events-none' : ''}`}
          style={{
            transform: 'perspective(1400px) scale(1.035)',
            willChange: 'transform',
          }}
        >
          <Chart
            renderer={renderer}
            definition={layer.definition}
            onRender={index === 2 ? onRender : undefined}
            ariaLabel={`Illustrative bubble scatterplot layer ${index + 1}`}
            style={{
              height: '100%',
              filter: layer.blur ? `blur(${layer.blur}px)` : undefined,
            }}
          />
        </div>
      ))}
    </div>
  )
}
