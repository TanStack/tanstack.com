import { PencilSimpleLineIcon } from '@phosphor-icons/react'
import * as React from 'react'
import { Button } from '~/components/ds/ui'
import { getChartsCatalogEmbedCase } from '~/utils/charts-catalog.functions'
import type { ExampleDefinition } from '~/utils/example-workspace'
import { ChartsCatalogResult } from './ChartsCatalogResult.client'

const LazyExampleWorkbench = React.lazy(() =>
  import('~/components/examples/ExampleWorkbench.client').then((module) => ({
    default: module.ExampleWorkbench,
  })),
)

export function ChartsCatalogDocExampleClient({
  caseId,
  edit,
  fallback,
  height,
  source,
  title,
}: {
  caseId: string
  edit: boolean
  fallback: React.ReactNode
  height: number
  source: 'hidden' | 'collapsed' | 'expanded'
  title?: string
}) {
  const [definition, setDefinition] = React.useState<ExampleDefinition>()
  const [editing, setEditing] = React.useState(edit)

  React.useEffect(() => {
    setEditing(edit)
  }, [caseId, edit])

  React.useEffect(() => {
    let cancelled = false
    setDefinition(undefined)

    void getChartsCatalogEmbedCase({
      data: {
        caseId,
        height,
        revision: 0,
        source: false,
      },
    })
      .then((data) => {
        if (cancelled || !data) return
        setDefinition(data.case.example)
      })
      .catch(() => {
        if (!cancelled) setDefinition(undefined)
      })

    return () => {
      cancelled = true
    }
  }, [caseId, height])

  if (!definition) {
    return fallback
  }

  if (editing) {
    return (
      <React.Suspense fallback={fallback}>
        <LazyExampleWorkbench definition={definition} />
      </React.Suspense>
    )
  }

  const label = title?.trim() || definition.title

  return (
    <div
      className="overflow-hidden rounded-lg border border-border-default bg-background-default"
      data-chart-example={caseId}
    >
      {source !== 'hidden' ? (
        <div className="flex min-h-10 items-center justify-between gap-3 border-b border-border-default px-2 pl-3">
          <span className="min-w-0 truncate font-ds-mono text-xs text-text-muted">
            {label}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setEditing(true)}
          >
            <PencilSimpleLineIcon className="size-3.5" aria-hidden="true" />
            Edit
          </Button>
        </div>
      ) : null}
      <ChartsCatalogResult definition={definition} height={height} />
    </div>
  )
}
