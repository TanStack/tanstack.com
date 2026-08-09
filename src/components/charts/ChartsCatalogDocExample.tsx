import { ClientOnly } from '@tanstack/react-router'
import * as React from 'react'
import { ChartsCatalogPreview } from './ChartsCatalogPreview'

const LazyChartsCatalogDocExample = React.lazy(() =>
  import('./ChartsCatalogDocExample.client').then((module) => ({
    default: module.ChartsCatalogDocExampleClient,
  })),
)

export function ChartsCatalogDocExample({
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
  const containerRef = React.useRef<HTMLElement>(null)
  const [shouldLoad, setShouldLoad] = React.useState(false)
  const fallback = (
    <ChartsCatalogDocExampleFallback
      caseId={caseId}
      height={height}
      source={source}
      title={title}
    />
  )

  React.useEffect(() => {
    const container = containerRef.current
    if (shouldLoad || !container) return

    if (!('IntersectionObserver' in window)) {
      setShouldLoad(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setShouldLoad(true)
        observer.disconnect()
      },
      { rootMargin: '320px 0px' },
    )
    observer.observe(container)
    return () => observer.disconnect()
  }, [shouldLoad])

  return (
    <section ref={containerRef} className="not-prose my-5">
      {shouldLoad ? (
        <ClientOnly fallback={fallback}>
          <React.Suspense fallback={fallback}>
            <LazyChartsCatalogDocExample
              caseId={caseId}
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
  source,
  title,
}: {
  caseId: string
  height: number
  source: 'hidden' | 'collapsed' | 'expanded'
  title?: string
}) {
  const label = title?.trim() || formatCaseId(caseId)

  return (
    <div
      className="overflow-hidden rounded-lg border border-border-default bg-background-default"
      data-chart-example={caseId}
    >
      {source !== 'hidden' ? (
        <div className="flex min-h-10 items-center justify-between gap-3 border-b border-border-default px-3">
          <span className="min-w-0 truncate font-ds-mono text-xs text-text-muted">
            {label}
          </span>
          <a
            className="shrink-0 text-xs font-medium text-text-secondary hover:text-text-primary"
            href={`/charts/catalog/charts/${caseId}`}
          >
            Open example
          </a>
        </div>
      ) : null}
      <div aria-label={`${label} chart preview`} role="img" style={{ height }}>
        <ChartsCatalogPreview caseId={caseId} className="p-8" family="" />
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
