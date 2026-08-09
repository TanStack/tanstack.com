import * as React from 'react'
import { PlayIcon } from '@phosphor-icons/react'
import { ClientOnly } from '@tanstack/react-router'
import { Button } from '~/components/ds/ui'
import { parseExampleWorkspace } from '~/utils/example-workspace'

const LazyExampleWorkbench = React.lazy(() =>
  import('~/components/examples/ExampleWorkbench.client').then((module) => ({
    default: module.ExampleWorkbench,
  })),
)

export function LiveExample({
  children,
  'data-example-group': group,
  'data-collapsed-indexes': serializedCollapsedIndexes,
  'data-workspace': serializedWorkspace,
}: {
  children?: React.ReactNode
  'data-example-group'?: string
  'data-collapsed-indexes'?: string
  'data-workspace'?: string
}) {
  const [active, setActive] = React.useState(false)
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

  if (!definition) return <>{children}</>

  if (active) {
    return (
      <ClientOnly
        fallback={
          <StaticFiles collapsedIndexes={collapsedIndexes}>
            {children}
          </StaticFiles>
        }
      >
        <React.Suspense
          fallback={
            <StaticFiles collapsedIndexes={collapsedIndexes}>
              {children}
            </StaticFiles>
          }
        >
          <LazyExampleWorkbench definition={definition} className="my-5" />
        </React.Suspense>
      </ClientOnly>
    )
  }

  return (
    <div className="not-prose my-5 overflow-hidden rounded-lg border border-border-default bg-background-default">
      <div className="flex min-h-10 items-center justify-end border-b border-border-default px-2">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setActive(true)}
        >
          <PlayIcon className="size-3.5" weight="fill" aria-hidden="true" />
          Run
        </Button>
      </div>
      <StaticFiles collapsedIndexes={collapsedIndexes}>{children}</StaticFiles>
    </div>
  )
}

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
