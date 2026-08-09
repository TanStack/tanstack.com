import * as React from 'react'
import { PlayIcon } from '@phosphor-icons/react'
import { Button } from '~/components/ds/ui'
import { parseExampleWorkspace } from '~/utils/example-workspace'

const LazyExampleWorkbench = React.lazy(() =>
  import('~/components/examples/ExampleWorkbench.client').then((module) => ({
    default: module.ExampleWorkbench,
  })),
)

export function LiveExample({
  children,
  'data-live-id': id,
  'data-workspace': serializedWorkspace,
}: {
  children?: React.ReactNode
  'data-live-id'?: string
  'data-workspace'?: string
}) {
  const [active, setActive] = React.useState(false)
  const workspace = React.useMemo(() => {
    if (!serializedWorkspace) return undefined

    try {
      return parseExampleWorkspace(JSON.parse(serializedWorkspace))
    } catch {
      return undefined
    }
  }, [serializedWorkspace])
  const definition = React.useMemo(
    () => (workspace && id ? { id, title: id, workspace } : undefined),
    [id, workspace],
  )

  if (!definition) return <>{children}</>

  if (active) {
    return (
      <React.Suspense fallback={<StaticFiles>{children}</StaticFiles>}>
        <LazyExampleWorkbench definition={definition} className="my-5" />
      </React.Suspense>
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
      <StaticFiles>{children}</StaticFiles>
    </div>
  )
}

function StaticFiles({ children }: { children?: React.ReactNode }) {
  return <div className="divide-y divide-border-default">{children}</div>
}
