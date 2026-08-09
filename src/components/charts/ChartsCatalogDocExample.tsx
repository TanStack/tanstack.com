import { ClientOnly } from '@tanstack/react-router'
import * as React from 'react'
import { ChartsCatalogPreview } from './ChartsCatalogPreview'
import { Button } from '~/components/ds/ui'

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
  const [activation, setActivation] = React.useState<{
    caseId: string
    edit: boolean
  }>()
  const isActive = activation?.caseId === caseId
  const fallback = (
    <ChartsCatalogDocExampleFallback
      caseId={caseId}
      height={height}
      onEdit={() => setActivation({ caseId, edit: true })}
      onRun={() => setActivation({ caseId, edit: false })}
      source={source}
      title={title}
    />
  )

  return (
    <section className="not-prose my-5">
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
  onEdit: () => void
  onRun: () => void
  source: 'hidden' | 'collapsed' | 'expanded'
  title?: string
}) {
  const label = title?.trim() || formatCaseId(caseId)

  return (
    <div
      className="overflow-hidden rounded-lg border border-border-default bg-background-default"
      data-chart-example={caseId}
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
            <Button type="button" variant="ghost" size="xs" onClick={onEdit}>
              Edit
            </Button>
          ) : null}
          <Button type="button" variant="primary" size="xs" onClick={onRun}>
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
