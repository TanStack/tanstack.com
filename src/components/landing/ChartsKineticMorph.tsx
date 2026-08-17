import * as React from 'react'
import { interpolateString } from 'd3-interpolate'

import {
  LandingChartGraphic,
  type LandingChartTooltipConfig,
} from './ChartsLandingTooltip'

const transitionDuration = 1_050
const transitionElementSelector = [
  '.ts-chart__marks circle[data-ts-key]',
  '.ts-chart__marks line[data-ts-key]',
  '.ts-chart__marks path[data-ts-key]',
  '.ts-chart__marks polygon[data-ts-key]',
  '.ts-chart__marks polyline[data-ts-key]',
  '.ts-chart__marks rect[data-ts-key]',
  '.ts-chart__marks text[data-ts-key]',
].join(',')

export function ChartsKineticMorph({
  current,
  previous,
  reducedMotion,
}: {
  current: {
    id: string
    svg: string
    tooltip: LandingChartTooltipConfig
  }
  previous?: {
    id: string
    svg: string
  }
  reducedMotion: boolean
}) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const currentRef = React.useRef<HTMLDivElement>(null)
  const previousRef = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    const root = rootRef.current
    const currentLayer = currentRef.current
    const previousLayer = previousRef.current
    if (
      reducedMotion ||
      !root ||
      !currentLayer ||
      !previousLayer ||
      typeof currentLayer.animate !== 'function'
    ) {
      return
    }

    const animations: Array<Animation> = []
    const frameCleanups: Array<() => void> = []
    const previousByKey = new Map(
      transitionElements(previousLayer).map((element) => [
        transitionKey(element),
        element,
      ]),
    )
    const currentElements = transitionElements(currentLayer)
    const transitions = currentElements.map((element) => {
      const previousElement = previousByKey.get(transitionKey(element))
      return {
        element,
        from: previousElement?.getBoundingClientRect(),
        geometry: previousElement
          ? captureGeometry(previousElement, element)
          : undefined,
        previousElement,
        to: element.getBoundingClientRect(),
      }
    })

    animations.push(
      previousLayer.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 680,
        easing: 'cubic-bezier(0.4, 0, 1, 1)',
        fill: 'forwards',
      }),
    )

    for (const guide of currentLayer.querySelectorAll<SVGElement>(
      '.ts-chart__axes, .ts-chart__grid',
    )) {
      animations.push(
        guide.animate([{ opacity: 0.18 }, { opacity: 1 }], {
          duration: 720,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'both',
        }),
      )
    }

    for (const transition of transitions) {
      const { element, from, geometry, previousElement, to } = transition
      if (!previousElement || !from) {
        animations.push(
          element.animate(
            [
              { opacity: 0, transform: 'scale(0.92)' },
              { opacity: 1, transform: 'scale(1)' },
            ],
            {
              delay: 220,
              duration: 560,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              fill: 'both',
            },
          ),
        )
        continue
      }

      previousElement.style.visibility = 'hidden'
      if (geometry) {
        frameCleanups.push(
          animateGeometry(geometry, transitionDuration, root.ownerDocument),
        )
        continue
      }

      const scaleX =
        from.width > 0.5 && to.width > 0.5 ? from.width / to.width : 1
      const scaleY =
        from.height > 0.5 && to.height > 0.5 ? from.height / to.height : 1
      const deltaX = from.left + from.width / 2 - (to.left + to.width / 2)
      const deltaY = from.top + from.height / 2 - (to.top + to.height / 2)

      element.style.transformBox = 'fill-box'
      element.style.transformOrigin = 'center'
      animations.push(
        element.animate(
          [
            {
              opacity: 0.78,
              transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`,
            },
            { opacity: 1, transform: 'translate(0, 0) scale(1, 1)' },
          ],
          {
            duration: transitionDuration,
            easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
            fill: 'both',
          },
        ),
      )
    }

    return () => {
      for (const animation of animations) {
        animation.cancel()
      }
      for (const cleanup of frameCleanups) {
        cleanup()
      }
    }
  }, [current.id, previous?.id, reducedMotion])

  return (
    <div ref={rootRef} className="relative h-full w-full">
      {previous && !reducedMotion ? (
        <div
          ref={previousRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden [&_svg]:h-full [&_svg]:w-full"
          dangerouslySetInnerHTML={{
            __html: previous.svg.replace(/tabindex="-?\d+"/, 'tabindex="-1"'),
          }}
        />
      ) : null}
      <div ref={currentRef} className="relative z-10 h-full w-full">
        <LandingChartGraphic
          key={current.id}
          className="h-full w-full"
          svg={current.svg}
          tooltip={current.tooltip}
        />
      </div>
    </div>
  )
}

function transitionElements(root: Element) {
  return Array.from(
    root.querySelectorAll<SVGGraphicsElement>(transitionElementSelector),
  )
}

function transitionKey(element: SVGGraphicsElement) {
  return element.getAttribute('data-ts-key') ?? ''
}

type GeometryTransition =
  | {
      element: SVGGraphicsElement
      from: ReadonlyArray<number>
      kind: 'attributes'
      names: ReadonlyArray<string>
      to: ReadonlyArray<number>
    }
  | {
      element: SVGPathElement
      interpolate: (progress: number) => string
      kind: 'path'
    }

function captureGeometry(
  previous: SVGGraphicsElement,
  current: SVGGraphicsElement,
): GeometryTransition | undefined {
  if (previous.tagName !== current.tagName) {
    return undefined
  }

  if (previous instanceof SVGPathElement && current instanceof SVGPathElement) {
    const from = previous.getAttribute('d')
    const to = current.getAttribute('d')
    if (from && to && pathTopology(from) === pathTopology(to)) {
      return {
        element: current,
        interpolate: interpolateString(from, to),
        kind: 'path',
      }
    }
    return undefined
  }

  const names =
    current instanceof SVGCircleElement
      ? ['cx', 'cy', 'r']
      : current instanceof SVGLineElement
        ? ['x1', 'y1', 'x2', 'y2']
        : current instanceof SVGRectElement
          ? ['x', 'y', 'width', 'height', 'rx', 'ry']
          : undefined
  if (!names) {
    return undefined
  }

  const from = names.map((name) => Number(previous.getAttribute(name) ?? 0))
  const to = names.map((name) => Number(current.getAttribute(name) ?? 0))
  if (![...from, ...to].every(Number.isFinite)) {
    return undefined
  }
  return { element: current, from, kind: 'attributes', names, to }
}

function animateGeometry(
  transition: GeometryTransition,
  duration: number,
  document: Document,
) {
  const view = document.defaultView
  if (!view) {
    applyGeometry(transition, 1)
    return () => {}
  }

  let frame = 0
  let start: number | undefined
  let finished = false
  const update = (time: number) => {
    start ??= time
    const progress = Math.min(1, (time - start) / duration)
    applyGeometry(transition, smoothStep(progress))
    if (progress < 1) {
      frame = view.requestAnimationFrame(update)
    } else {
      finished = true
    }
  }

  applyGeometry(transition, 0)
  frame = view.requestAnimationFrame(update)
  return () => {
    if (!finished) {
      view.cancelAnimationFrame(frame)
      applyGeometry(transition, 1)
    }
  }
}

function applyGeometry(transition: GeometryTransition, progress: number) {
  if (transition.kind === 'path') {
    transition.element.setAttribute('d', transition.interpolate(progress))
    return
  }

  transition.names.forEach((name, index) => {
    const from = transition.from[index] ?? 0
    const to = transition.to[index] ?? 0
    transition.element.setAttribute(
      name,
      String(Math.round((from + (to - from) * progress) * 100) / 100),
    )
  })
}

function pathTopology(path: string) {
  return path.replaceAll(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi, '<number>')
}

function smoothStep(progress: number) {
  return progress * progress * (3 - 2 * progress)
}
