import * as React from 'react'
import { PlayIcon } from '@phosphor-icons/react'
import { ClientOnly } from '@tanstack/react-router'
import { Hydrate } from '@tanstack/react-start'
import { visible } from '@tanstack/react-start/hydration'
import { Button } from '~/components/ds/ui'
import { parseExampleWorkspace } from '~/utils/example-workspace'

const LazyExampleWorkbench = React.lazy(() =>
  import('~/components/examples/ExampleWorkbench.client').then((module) => ({
    default: module.ExampleWorkbench,
  })),
)

type LiveExampleProps = {
  children?: React.ReactNode
  'data-example-group'?: string
  'data-collapsed-indexes'?: string
  'data-workspace'?: string
}

export function LiveExample(props: LiveExampleProps) {
  return (
    <Hydrate
      key={props['data-workspace'] ?? props['data-example-group']}
      when={visible({ rootMargin: '600px 0px' })}
      fallback={
        <StaticExample
          collapsedIndexes={parseCollapsedIndexes(
            props['data-collapsed-indexes'],
          )}
        >
          {props.children}
        </StaticExample>
      }
    >
      <LiveExampleIsland {...props} />
    </Hydrate>
  )
}

function LiveExampleIsland({
  children,
  'data-example-group': group,
  'data-collapsed-indexes': serializedCollapsedIndexes,
  'data-workspace': serializedWorkspace,
}: LiveExampleProps) {
  const staticExampleRef = React.useRef<HTMLDivElement>(null)
  const collapsedIndexes = React.useMemo(
    () => parseCollapsedIndexes(serializedCollapsedIndexes),
    [serializedCollapsedIndexes],
  )
  const workspace = React.useMemo(() => {
    if (!serializedWorkspace) return undefined

    try {
      return parseExampleWorkspace(JSON.parse(serializedWorkspace))
    } catch {
      return undefined
    }
  }, [serializedWorkspace])
  const definition = React.useMemo(
    () =>
      workspace && group ? { id: group, title: group, workspace } : undefined,
    [group, workspace],
  )
  const [activeDefinition, setActiveDefinition] =
    React.useState<typeof definition>()
  const active = definition !== undefined && activeDefinition === definition
  const activate = React.useCallback(() => {
    if (definition) setActiveDefinition(definition)
  }, [definition])

  React.useEffect(() => {
    if (active) return
    if (!staticExampleRef.current) return
    const element = staticExampleRef.current

    let intersecting = false
    let dwellHandle: number | undefined
    let idleHandle: number | undefined
    let timeoutHandle: number | undefined
    let disposed = false
    let interactionBlocked = false

    function cancelScheduledActivation() {
      if (dwellHandle !== undefined) {
        window.clearTimeout(dwellHandle)
        dwellHandle = undefined
      }
      if (idleHandle !== undefined) {
        window.cancelIdleCallback(idleHandle)
        idleHandle = undefined
      }
      if (timeoutHandle !== undefined) {
        window.clearTimeout(timeoutHandle)
        timeoutHandle = undefined
      }
    }

    function canActivate() {
      const rect = element.getBoundingClientRect()
      return (
        intersecting &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth &&
        !interactionBlocked &&
        document.visibilityState === 'visible' &&
        !element.contains(document.activeElement)
      )
    }

    function scheduleActivation() {
      cancelScheduledActivation()
      if (disposed || !canActivate()) return

      dwellHandle = window.setTimeout(() => {
        dwellHandle = undefined
        if (disposed || !canActivate()) return

        const run = () => {
          idleHandle = undefined
          timeoutHandle = undefined
          if (!disposed && canActivate()) activate()
        }

        if (typeof window.requestIdleCallback === 'function') {
          idleHandle = window.requestIdleCallback(run, { timeout: 1_700 })
        } else {
          timeoutHandle = window.setTimeout(run)
        }
      }, 300)
    }

    const observer = new IntersectionObserver(([entry]) => {
      intersecting = Boolean(
        entry?.isIntersecting && entry.intersectionRatio > 0,
      )
      if (intersecting) scheduleActivation()
      else cancelScheduledActivation()
    })
    observer.observe(element)

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') scheduleActivation()
      else cancelScheduledActivation()
    }

    function handleFocusIn() {
      cancelScheduledActivation()
    }

    function handleFocusOut() {
      queueMicrotask(scheduleActivation)
    }

    function handleInteraction() {
      interactionBlocked = true
      cancelScheduledActivation()
    }

    const source = element.querySelector('[data-live-example-source]')

    document.addEventListener('visibilitychange', handleVisibilityChange)
    element.addEventListener('focusin', handleFocusIn)
    element.addEventListener('focusout', handleFocusOut)
    element.addEventListener('pointerdown', handleInteraction)
    source?.addEventListener('wheel', handleInteraction, { passive: true })

    return () => {
      disposed = true
      cancelScheduledActivation()
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      element.removeEventListener('focusin', handleFocusIn)
      element.removeEventListener('focusout', handleFocusOut)
      element.removeEventListener('pointerdown', handleInteraction)
      source?.removeEventListener('wheel', handleInteraction)
    }
  }, [activate, active])

  if (!definition) return <>{children}</>

  if (active) {
    return (
      <ClientOnly
        fallback={
          <StaticExample collapsedIndexes={collapsedIndexes} onRun={activate}>
            {children}
          </StaticExample>
        }
      >
        <React.Suspense
          fallback={
            <StaticExample collapsedIndexes={collapsedIndexes} onRun={activate}>
              {children}
            </StaticExample>
          }
        >
          <LazyExampleWorkbench
            definition={definition}
            className="my-5"
            packageResolution="dynamic"
          />
        </React.Suspense>
      </ClientOnly>
    )
  }

  return (
    <StaticExample
      ref={staticExampleRef}
      collapsedIndexes={collapsedIndexes}
      onRun={activate}
    >
      {children}
    </StaticExample>
  )
}

const StaticExample = React.forwardRef(function StaticExample(
  {
    children,
    collapsedIndexes,
    onRun,
  }: {
    children?: React.ReactNode
    collapsedIndexes: Array<number>
    onRun?: () => void
  },
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  return (
    <div
      ref={ref}
      data-live-example-state="static"
      className="not-prose my-5 flex h-[clamp(520px,75dvh,720px)] min-w-0 flex-col overflow-hidden rounded-lg border border-border-default bg-background-default"
    >
      <div className="flex min-h-10 shrink-0 items-center justify-end border-b border-border-default px-2">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={!onRun}
          onClick={onRun}
        >
          <PlayIcon className="size-3.5" weight="fill" aria-hidden="true" />
          Run
        </Button>
      </div>
      <div data-live-example-source className="min-h-0 flex-1 overflow-auto">
        <StaticFiles collapsedIndexes={collapsedIndexes}>
          {children}
        </StaticFiles>
      </div>
    </div>
  )
})

function StaticFiles({
  children,
  collapsedIndexes,
}: {
  children?: React.ReactNode
  collapsedIndexes: Array<number>
}) {
  const files = React.Children.toArray(children)
  const collapsed = new Set(collapsedIndexes)
  const visibleFiles = files.filter((_file, index) => !collapsed.has(index))
  const supportFiles = files.filter((_file, index) => collapsed.has(index))

  return (
    <div>
      <div className="divide-y divide-border-default">{visibleFiles}</div>
      {supportFiles.length ? (
        <details className="border-t border-border-default">
          <summary className="cursor-pointer px-3 py-2 font-ds-mono text-xs text-text-muted hover:text-text-secondary">
            Support files
          </summary>
          <div className="divide-y divide-border-default border-t border-border-default">
            {supportFiles}
          </div>
        </details>
      ) : null}
    </div>
  )
}

function parseCollapsedIndexes(value: string | undefined) {
  if (!value) return []

  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    const indexes: Array<number> = []
    for (const item of parsed) {
      if (typeof item !== 'number' || !Number.isInteger(item) || item < 0) {
        return []
      }
      indexes.push(item)
    }
    return indexes
  } catch {
    return []
  }
}
