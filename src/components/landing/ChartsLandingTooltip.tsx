import * as React from 'react'

export const LANDING_CHART_TOOLTIP_OPEN_EVENT =
  'tanstack-charts:landing-tooltip-open'

export type LandingChartTooltipRow = {
  color?: string
  label: string
  value: string
}

export type LandingChartTooltipContent = {
  kicker?: string
  rows: ReadonlyArray<LandingChartTooltipRow>
  title: string
}

export type LandingChartTooltipPoint = {
  color?: string
  elementKey: string
  groupKey: string
  key: string
  x: number
  xValue: number | string
  y: number
  yValue: number | string
}

type TooltipAxisFallback = {
  domain: readonly [number, number]
  range: readonly [number, number]
}

export type LandingChartTooltipConfig = {
  fallbackX?: TooltipAxisFallback
  fallbackY?: TooltipAxisFallback
  filter?: (point: LandingChartTooltipPoint) => boolean
  format: (
    points: ReadonlyArray<LandingChartTooltipPoint>,
  ) => LandingChartTooltipContent
  initialPoint?: 'first' | 'last'
  mode?: 'nearest' | 'x'
  theme?: 'dark' | 'light'
}

type ActiveTooltip = {
  anchor: LandingChartTooltipPoint
  content: LandingChartTooltipContent
  left: number
  placeBelow: boolean
  top: number
}

type AxisTick = {
  coordinate: number
  label: string
  value: number | string
}

type TooltipPointGroup = ReadonlyArray<LandingChartTooltipPoint>

export function LandingChartGraphic({
  className,
  svg,
  tooltip,
}: {
  className: string
  svg: string
  tooltip: LandingChartTooltipConfig
}) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const pointsRef =
    React.useRef<ReadonlyArray<LandingChartTooltipPoint> | null>(null)
  const activeRef = React.useRef(false)
  const pointerRef = React.useRef(false)
  const pointerTypeRef = React.useRef<string | null>(null)
  const [active, setActive] = React.useState<ActiveTooltip | null>(null)
  const [keyboardIndex, setKeyboardIndex] = React.useState(-1)
  const [pinned, setPinned] = React.useState(false)

  const interactiveSvg = React.useMemo(
    () => svg.replace(/tabindex="-?\d+"/, 'tabindex="0"'),
    [svg],
  )

  React.useEffect(() => {
    pointsRef.current = null
    activeRef.current = false
    pointerRef.current = false
    pointerTypeRef.current = null
    setActive(null)
    setKeyboardIndex(-1)
    setPinned(false)
  }, [interactiveSvg, tooltip])

  React.useEffect(() => {
    const focusMarker = rootRef.current?.querySelector<SVGCircleElement>(
      '[data-ts-chart-focus]',
    )
    if (!focusMarker) {
      return
    }

    if (!active) {
      focusMarker.setAttribute('visibility', 'hidden')
      return
    }

    focusMarker.setAttribute('cx', String(active.anchor.x))
    focusMarker.setAttribute('cy', String(active.anchor.y))
    focusMarker.setAttribute(
      'fill',
      tooltip.theme === 'light' ? '#fff' : '#07101d',
    )
    focusMarker.setAttribute(
      'stroke',
      active.anchor.color ?? 'var(--landing-accent-bright)',
    )
    focusMarker.setAttribute('visibility', 'visible')
  }, [active, tooltip.theme])

  const getSvg = React.useCallback(
    () => rootRef.current?.querySelector<SVGSVGElement>('svg') ?? null,
    [],
  )

  const getPoints = React.useCallback(() => {
    if (pointsRef.current) {
      return pointsRef.current
    }

    const chart = getSvg()
    if (!chart) {
      return []
    }

    const points = collectTooltipPoints(chart, tooltip)
    pointsRef.current = points
    return points
  }, [getSvg, tooltip])

  const showGroup = React.useCallback(
    (
      chart: SVGSVGElement,
      group: TooltipPointGroup,
      preferredAnchor?: LandingChartTooltipPoint,
    ) => {
      const root = rootRef.current
      const anchor = preferredAnchor ?? group[0]
      if (!root || !anchor) {
        return
      }

      const position = chartPointToRootPosition(root, chart, anchor)
      if (!position) {
        return
      }

      const rootBounds = root.getBoundingClientRect()
      const horizontalPadding = Math.min(128, rootBounds.width / 2)
      const left = clamp(
        position.left,
        horizontalPadding,
        Math.max(horizontalPadding, rootBounds.width - horizontalPadding),
      )
      const top = clamp(position.top, 14, Math.max(14, rootBounds.height - 14))

      document.dispatchEvent(
        new CustomEvent(LANDING_CHART_TOOLTIP_OPEN_EVENT, { detail: root }),
      )
      activeRef.current = true
      setActive({
        anchor,
        content: tooltip.format(group),
        left,
        placeBelow: top < 104,
        top,
      })
    },
    [tooltip],
  )

  const showAtPointer = React.useCallback(
    (clientX: number, clientY: number, target: EventTarget | null) => {
      const chart = getSvg()
      const points = getPoints()
      if (!chart || points.length === 0) {
        return
      }

      const groups = groupTooltipPoints(points, tooltip.mode)
      const targetKey =
        target instanceof Element
          ? target.closest('[data-ts-key]')?.getAttribute('data-ts-key')
          : null
      const directPoint = targetKey
        ? points.find(
            (point) =>
              point.elementKey === targetKey || point.groupKey === targetKey,
          )
        : undefined

      const group =
        directPoint && tooltip.mode !== 'x'
          ? groups.find((candidate) => candidate.includes(directPoint))
          : nearestTooltipGroup(chart, groups, clientX, clientY, tooltip.mode)
      if (!group) {
        return
      }

      const anchor =
        directPoint ??
        nearestTooltipPoint(chart, group, clientX, clientY) ??
        group[0]
      showGroup(chart, group, anchor)
      setKeyboardIndex(groups.indexOf(group))
    },
    [getPoints, getSvg, showGroup, tooltip.mode],
  )

  const showKeyboardGroup = React.useCallback(
    (requestedIndex: number) => {
      const chart = getSvg()
      const groups = groupTooltipPoints(getPoints(), tooltip.mode)
      if (!chart || groups.length === 0) {
        return
      }

      const index =
        ((requestedIndex % groups.length) + groups.length) % groups.length
      const group = groups[index]
      if (!group) {
        return
      }

      pointerRef.current = false
      setKeyboardIndex(index)
      showGroup(chart, group)
    },
    [getPoints, getSvg, showGroup, tooltip.mode],
  )

  const clearTooltip = React.useCallback(() => {
    activeRef.current = false
    setActive(null)
    setPinned(false)
  }, [])

  React.useEffect(() => {
    if (!active) {
      return
    }

    const clearOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        clearTooltip()
      }
    }

    document.addEventListener('keydown', clearOnEscape)
    return () => document.removeEventListener('keydown', clearOnEscape)
  }, [active, clearTooltip])

  React.useEffect(() => {
    if (!pinned) {
      return
    }

    const clearOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        clearTooltip()
      }
    }

    document.addEventListener('pointerdown', clearOutside, true)
    return () => document.removeEventListener('pointerdown', clearOutside, true)
  }, [clearTooltip, pinned])

  React.useEffect(() => {
    const clearOnViewportChange = () => {
      if (!pinned && pointerRef.current && activeRef.current) {
        clearTooltip()
      }
    }

    window.addEventListener('resize', clearOnViewportChange)
    window.addEventListener('scroll', clearOnViewportChange, true)
    return () => {
      window.removeEventListener('resize', clearOnViewportChange)
      window.removeEventListener('scroll', clearOnViewportChange, true)
    }
  }, [clearTooltip, pinned])

  React.useEffect(() => {
    const clearWhenAnotherTooltipOpens = (event: Event) => {
      if (
        (event as CustomEvent<HTMLElement>).detail !== rootRef.current &&
        activeRef.current
      ) {
        clearTooltip()
      }
    }

    document.addEventListener(
      LANDING_CHART_TOOLTIP_OPEN_EVENT,
      clearWhenAnotherTooltipOpens,
    )
    return () =>
      document.removeEventListener(
        LANDING_CHART_TOOLTIP_OPEN_EVENT,
        clearWhenAnotherTooltipOpens,
      )
  }, [clearTooltip])

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const groups = groupTooltipPoints(getPoints(), tooltip.mode)
      if (groups.length === 0) {
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        clearTooltip()
        return
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        setPinned((value) => !value)
        return
      }

      let nextIndex: number | null = null
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        nextIndex = keyboardIndex < 0 ? 0 : keyboardIndex + 1
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        nextIndex = keyboardIndex < 0 ? groups.length - 1 : keyboardIndex - 1
      } else if (event.key === 'Home') {
        nextIndex = 0
      } else if (event.key === 'End') {
        nextIndex = groups.length - 1
      }

      if (nextIndex === null) {
        return
      }

      event.preventDefault()
      setPinned(false)
      showKeyboardGroup(nextIndex)
    },
    [clearTooltip, getPoints, keyboardIndex, showKeyboardGroup, tooltip.mode],
  )

  return (
    <div
      ref={rootRef}
      className={`${className} relative isolate`}
      data-chart-tooltip-root=""
      role="group"
      onBlur={(event) => {
        if (
          !pinned &&
          !event.currentTarget.contains(event.relatedTarget as Node | null)
        ) {
          clearTooltip()
        }
      }}
      onClick={() => {
        if (
          activeRef.current &&
          pointerRef.current &&
          pointerTypeRef.current === 'mouse'
        ) {
          setPinned((value) => !value)
        }
      }}
      onFocus={() => {
        if (activeRef.current) {
          return
        }
        const points = getPoints()
        const groups = groupTooltipPoints(points, tooltip.mode)
        const initialIndex =
          tooltip.initialPoint === 'first' ? 0 : groups.length - 1
        showKeyboardGroup(initialIndex)
      }}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        pointerRef.current = true
        pointerTypeRef.current = event.pointerType
        showAtPointer(event.clientX, event.clientY, event.target)
        if (event.pointerType !== 'mouse') {
          setPinned(true)
        }
      }}
      onPointerLeave={() => {
        if (!pinned && pointerRef.current) {
          activeRef.current = false
          setActive(null)
        }
      }}
      onPointerMove={(event) => {
        if (pinned) {
          return
        }
        pointerRef.current = true
        pointerTypeRef.current = event.pointerType
        showAtPointer(event.clientX, event.clientY, event.target)
      }}
    >
      <div
        className="h-full w-full overflow-hidden [&_svg]:h-full [&_svg]:w-full [&_svg]:outline-offset-[-3px] [&_svg]:focus-visible:outline [&_svg]:focus-visible:outline-2 [&_svg]:focus-visible:outline-[var(--landing-accent-bright)]"
        dangerouslySetInnerHTML={{ __html: interactiveSvg }}
      />
      {active ? (
        <LandingChartTooltipSurface
          content={active.content}
          left={active.left}
          placeBelow={active.placeBelow}
          theme={tooltip.theme ?? 'dark'}
          top={active.top}
        />
      ) : null}
    </div>
  )
}

export function LandingChartTooltipSurface({
  content,
  left,
  placeBelow = false,
  theme,
  top,
}: {
  content: LandingChartTooltipContent
  left?: number
  placeBelow?: boolean
  theme: 'dark' | 'light'
  top?: number
}) {
  const positioned = left !== undefined && top !== undefined
  const themeClasses =
    theme === 'light'
      ? 'border-border-default bg-background-surface text-text-primary shadow-lg'
      : 'border-white/15 bg-ds-neutral-500/95 text-white shadow-lg'

  return (
    <div
      aria-live="polite"
      className={`pointer-events-none z-30 min-w-40 max-w-64 rounded-lg border px-3 py-2.5 text-left ${themeClasses} ${
        positioned ? 'absolute' : ''
      }`}
      data-chart-tooltip=""
      role="status"
      style={
        positioned
          ? {
              left,
              top,
              transform: placeBelow
                ? 'translate(-50%, 14px)'
                : 'translate(-50%, calc(-100% - 14px))',
            }
          : undefined
      }
    >
      {content.kicker ? (
        <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
          {content.kicker}
        </p>
      ) : null}
      <p className="font-ds-display text-ds-heading-6">{content.title}</p>
      <div
        className={`mt-1.5 space-y-1 border-t pt-1.5 ${
          theme === 'light' ? 'border-border-subtle' : 'border-white/10'
        }`}
      >
        {content.rows.map((row) => (
          <div
            key={`${row.label}:${row.value}`}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 text-ds-body-xs"
          >
            <span
              className={`flex min-w-0 items-center gap-1.5 ${
                theme === 'light' ? 'text-text-secondary' : 'text-white/50'
              }`}
            >
              {row.color ? (
                <span
                  aria-hidden="true"
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
              ) : null}
              <span className="truncate">{row.label}</span>
            </span>
            <span className="font-ds-mono text-ds-mono-xs">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function collectTooltipPoints(
  chart: SVGSVGElement,
  config: LandingChartTooltipConfig,
) {
  const marks = chart.querySelector<SVGGElement>('.ts-chart__marks')
  if (!marks) {
    return []
  }

  const xScale = readAxisScale(chart, 'x', config.fallbackX)
  const yScale = readAxisScale(chart, 'y', config.fallbackY)
  const points: Array<LandingChartTooltipPoint> = []

  for (const circle of marks.querySelectorAll<SVGCircleElement>(
    'circle[cx][cy]:not([data-ts-chart-focus])',
  )) {
    const x = Number(circle.getAttribute('cx'))
    const y = Number(circle.getAttribute('cy'))
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      continue
    }

    const elementKey = circle.getAttribute('data-ts-key') ?? ''
    const groupKey =
      circle.parentElement
        ?.closest<SVGGElement>('g[data-ts-key]')
        ?.getAttribute('data-ts-key') ?? ''
    points.push({
      color:
        nonEmptyPaint(circle.getAttribute('stroke')) ??
        nonEmptyPaint(circle.getAttribute('fill')),
      elementKey,
      groupKey,
      key: elementKey || `${groupKey}:${x}:${y}`,
      x,
      xValue: xScale(x),
      y,
      yValue: yScale(y),
    })
  }

  for (const rect of marks.querySelectorAll<SVGRectElement>(
    '.ts-chart__bar rect[x][y][width][height]',
  )) {
    const x =
      Number(rect.getAttribute('x')) + Number(rect.getAttribute('width')) / 2
    const y = Number(rect.getAttribute('y'))
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      continue
    }

    const elementKey = rect.getAttribute('data-ts-key') ?? ''
    const groupKey =
      rect.parentElement
        ?.closest<SVGGElement>('g[data-ts-key]')
        ?.getAttribute('data-ts-key') ?? ''
    points.push({
      color: nonEmptyPaint(rect.getAttribute('fill')),
      elementKey,
      groupKey,
      key: elementKey || `${groupKey}:${x}:${y}`,
      x,
      xValue: xScale(x),
      y,
      yValue: yScale(y),
    })
  }

  if (points.length === 0) {
    for (const path of marks.querySelectorAll<SVGPathElement>(
      '.ts-chart__line path[d]',
    )) {
      const elementKey = path.getAttribute('data-ts-key') ?? ''
      const groupKey =
        path.parentElement
          ?.closest<SVGGElement>('g[data-ts-key]')
          ?.getAttribute('data-ts-key') ?? ''
      for (const [index, vertex] of extractPathVertices(
        path.getAttribute('d') ?? '',
      ).entries()) {
        points.push({
          color: nonEmptyPaint(path.getAttribute('stroke')),
          elementKey,
          groupKey,
          key: `${elementKey}:${index}`,
          x: vertex.x,
          xValue: xScale(vertex.x),
          y: vertex.y,
          yValue: yScale(vertex.y),
        })
      }
    }
  }

  const filtered = config.filter ? points.filter(config.filter) : points
  return filtered.sort((left, right) => left.x - right.x || left.y - right.y)
}

function readAxisScale(
  chart: SVGSVGElement,
  axis: 'x' | 'y',
  fallback?: TooltipAxisFallback,
) {
  const ticks = Array.from(
    chart.querySelectorAll<SVGTextElement>(
      `[data-ts-key^="${axis}-tick-label:"]`,
    ),
  )
    .map((tick): AxisTick | null => {
      const key = tick.getAttribute('data-ts-key')
      const coordinate = Number(tick.getAttribute(axis))
      if (!key || !Number.isFinite(coordinate)) {
        return null
      }

      const raw = key.slice(`${axis}-tick-label:`.length)
      const separator = raw.indexOf(':')
      const type = separator >= 0 ? raw.slice(0, separator) : ''
      const encodedValue = separator >= 0 ? raw.slice(separator + 1) : raw
      const label = tick.textContent?.trim() ?? encodedValue
      const value =
        type === 'number' || type === 'date' ? Number(encodedValue) : label
      if (typeof value === 'number' && !Number.isFinite(value)) {
        return null
      }

      return { coordinate, label, value }
    })
    .filter((tick): tick is AxisTick => tick !== null)
    .sort((left, right) => left.coordinate - right.coordinate)

  const numericTicks = ticks.filter(
    (tick): tick is AxisTick & { value: number } =>
      typeof tick.value === 'number',
  )
  if (numericTicks.length >= 2) {
    const first = numericTicks[0]
    const last = numericTicks[numericTicks.length - 1]
    if (first && last && first.coordinate !== last.coordinate) {
      return (coordinate: number) =>
        first.value +
        ((coordinate - first.coordinate) /
          (last.coordinate - first.coordinate)) *
          (last.value - first.value)
    }
  }

  if (ticks.length > 0) {
    return (coordinate: number) =>
      ticks.reduce((nearest, tick) =>
        Math.abs(tick.coordinate - coordinate) <
        Math.abs(nearest.coordinate - coordinate)
          ? tick
          : nearest,
      ).value
  }

  if (fallback) {
    return (coordinate: number) => {
      const [rangeStart, rangeEnd] = fallback.range
      const [domainStart, domainEnd] = fallback.domain
      return (
        domainStart +
        ((coordinate - rangeStart) / (rangeEnd - rangeStart)) *
          (domainEnd - domainStart)
      )
    }
  }

  return (coordinate: number) => coordinate
}

function extractPathVertices(path: string) {
  const tokens =
    path.match(/[MLCZ]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []
  const vertices: Array<{ x: number; y: number }> = []
  let command = ''
  let index = 0

  while (index < tokens.length) {
    const token = tokens[index]
    if (!token) {
      break
    }

    if (/^[MLCZ]$/i.test(token)) {
      command = token.toUpperCase()
      index += 1
    }

    if (command === 'M' || command === 'L') {
      const x = Number(tokens[index])
      const y = Number(tokens[index + 1])
      index += 2
      if (Number.isFinite(x) && Number.isFinite(y)) {
        vertices.push({ x, y })
      }
      if (command === 'M') {
        command = 'L'
      }
    } else if (command === 'C') {
      const x = Number(tokens[index + 4])
      const y = Number(tokens[index + 5])
      index += 6
      if (Number.isFinite(x) && Number.isFinite(y)) {
        vertices.push({ x, y })
      }
    } else if (command === 'Z') {
      break
    } else {
      index += 1
    }
  }

  const byX = new Map<string, { x: number; y: number }>()
  for (const vertex of vertices) {
    byX.set(vertex.x.toFixed(3), vertex)
  }
  return Array.from(byX.values()).sort((left, right) => left.x - right.x)
}

function groupTooltipPoints(
  points: ReadonlyArray<LandingChartTooltipPoint>,
  mode: LandingChartTooltipConfig['mode'] = 'nearest',
): Array<TooltipPointGroup> {
  if (mode !== 'x') {
    return points.map((point) => [point])
  }

  const groups = new Map<string, Array<LandingChartTooltipPoint>>()
  for (const point of points) {
    const key = point.x.toFixed(2)
    const group = groups.get(key)
    if (group) {
      group.push(point)
    } else {
      groups.set(key, [point])
    }
  }
  return Array.from(groups.values())
}

function nearestTooltipGroup(
  chart: SVGSVGElement,
  groups: ReadonlyArray<TooltipPointGroup>,
  clientX: number,
  clientY: number,
  mode: LandingChartTooltipConfig['mode'] = 'nearest',
) {
  let nearest: TooltipPointGroup | undefined
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const group of groups) {
    const point = nearestTooltipPoint(chart, group, clientX, clientY)
    if (!point) {
      continue
    }
    const screen = chartPointToScreen(chart, point)
    if (!screen) {
      continue
    }

    const distance =
      mode === 'x'
        ? Math.abs(screen.x - clientX)
        : Math.hypot(screen.x - clientX, screen.y - clientY)
    if (distance < nearestDistance) {
      nearest = group
      nearestDistance = distance
    }
  }

  return nearest
}

function nearestTooltipPoint(
  chart: SVGSVGElement,
  points: ReadonlyArray<LandingChartTooltipPoint>,
  clientX: number,
  clientY: number,
) {
  let nearest: LandingChartTooltipPoint | undefined
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const point of points) {
    const screen = chartPointToScreen(chart, point)
    if (!screen) {
      continue
    }
    const distance = Math.hypot(screen.x - clientX, screen.y - clientY)
    if (distance < nearestDistance) {
      nearest = point
      nearestDistance = distance
    }
  }
  return nearest
}

function chartPointToRootPosition(
  root: HTMLElement,
  chart: SVGSVGElement,
  point: LandingChartTooltipPoint,
) {
  const screen = chartPointToScreen(chart, point)
  if (!screen) {
    return null
  }
  const bounds = root.getBoundingClientRect()
  return {
    left: screen.x - bounds.left,
    top: screen.y - bounds.top,
  }
}

function chartPointToScreen(
  chart: SVGSVGElement,
  point: Pick<LandingChartTooltipPoint, 'x' | 'y'>,
) {
  const matrix = chart.getScreenCTM()
  if (!matrix) {
    return null
  }
  const svgPoint = chart.createSVGPoint()
  svgPoint.x = point.x
  svgPoint.y = point.y
  const screen = svgPoint.matrixTransform(matrix)
  return { x: screen.x, y: screen.y }
}

function nonEmptyPaint(value: string | null) {
  return value && value !== 'none' ? value : undefined
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}
