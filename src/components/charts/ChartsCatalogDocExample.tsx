import { ClientOnly } from '@tanstack/react-router'
import { Hydrate } from '@tanstack/react-start'
import { visible } from '@tanstack/react-start/hydration'
import * as React from 'react'
import { ChartsCatalogPreview } from './ChartsCatalogPreview'
import { Button } from '~/components/ds/ui'

const LazyChartsCatalogDocExample = React.lazy(() =>
  import('./ChartsCatalogDocExample.client').then((module) => ({
    default: module.ChartsCatalogDocExampleClient,
  })),
)

export function ChartsCatalogDocExample({
  ...props
}: {
  caseId: string
  height: number
  source?: 'hidden' | 'collapsed' | 'expanded'
  title?: string
}) {
  return (
    <Hydrate
      key={props.caseId}
      when={visible({ rootMargin: '600px 0px' })}
      fallback={
        <section className="not-prose my-5">
          <ChartsCatalogDocExampleFallback
            caseId={props.caseId}
            height={props.height}
            source={props.source ?? 'collapsed'}
            title={props.title}
          />
        </section>
      }
    >
      <ChartsCatalogDocExampleIsland {...props} />
    </Hydrate>
  )
}

function ChartsCatalogDocExampleIsland({
  caseId,
  height,
  source = 'collapsed',
  title,
}: {
  caseId: string
  height: number
  source?: 'hidden' | 'collapsed' | 'expanded'
  title?: string
}) {
  const [activation, setActivation] = React.useState<{
    caseId: string
    edit: boolean
  }>()
  const activatedCaseRef = React.useRef<string | undefined>(undefined)
  const exampleRef = React.useRef<HTMLElement>(null)
  const isActive = activation?.caseId === caseId
  const activateRun = React.useCallback(() => {
    if (activatedCaseRef.current === caseId) return
    activatedCaseRef.current = caseId
    setActivation({ caseId, edit: false })
  }, [caseId])
  const activateEdit = React.useCallback(() => {
    activatedCaseRef.current = caseId
    setActivation({ caseId, edit: true })
  }, [caseId])

  React.useEffect(() => {
    if (isActive) return
    if (!exampleRef.current) return
    const element = exampleRef.current

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
          if (!disposed && canActivate()) activateRun()
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

    document.addEventListener('visibilitychange', handleVisibilityChange)
    element.addEventListener('focusin', handleFocusIn)
    element.addEventListener('focusout', handleFocusOut)
    element.addEventListener('pointerdown', handleInteraction)

    return () => {
      disposed = true
      cancelScheduledActivation()
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      element.removeEventListener('focusin', handleFocusIn)
      element.removeEventListener('focusout', handleFocusOut)
      element.removeEventListener('pointerdown', handleInteraction)
    }
  }, [activateRun, isActive])

  const fallback = (
    <ChartsCatalogDocExampleFallback
      caseId={caseId}
      height={height}
      onEdit={activateEdit}
      onRun={activateRun}
      source={source}
      title={title}
    />
  )

  return (
    <section ref={exampleRef} className="not-prose my-5">
      {isActive ? (
        <ClientOnly fallback={fallback}>
          <React.Suspense fallback={fallback}>
            <LazyChartsCatalogDocExample
              caseId={caseId}
              edit={activation.edit}
              fallback={fallback}
              height={height}
              source={source}
              title={title}
            />
          </React.Suspense>
        </ClientOnly>
      ) : (
        fallback
      )}
    </section>
  )
}

function ChartsCatalogDocExampleFallback({
  caseId,
  height,
  onEdit,
  onRun,
  source,
  title,
}: {
  caseId: string
  height: number
  onEdit?: () => void
  onRun?: () => void
  source: 'hidden' | 'collapsed' | 'expanded'
  title?: string
}) {
  const label = title?.trim() || formatCaseId(caseId)

  return (
    <div
      className="overflow-hidden rounded-lg border border-border-default bg-background-default"
      data-chart-example={caseId}
      data-chart-example-state="static"
    >
      <div
        className={`flex min-h-10 items-center gap-3 border-b border-border-default px-2 ${source === 'hidden' ? 'justify-end' : 'justify-between pl-3'}`}
      >
        {source !== 'hidden' ? (
          <span className="min-w-0 truncate font-ds-mono text-xs text-text-muted">
            {label}
          </span>
        ) : null}
        <div className="flex shrink-0 items-center gap-1">
          {source !== 'hidden' ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={!onEdit}
              onClick={onEdit}
            >
              Edit
            </Button>
          ) : null}
          <Button
            type="button"
            variant="primary"
            size="xs"
            disabled={!onRun}
            onClick={onRun}
          >
            Run
          </Button>
        </div>
      </div>
      <div aria-label={`${label} chart preview`} role="img" style={{ height }}>
        <ChartsCatalogPreview caseId={caseId} />
      </div>
    </div>
  )
}

function formatCaseId(caseId: string) {
  return caseId
    .replace(/^\d+-/, '')
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
