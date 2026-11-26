import * as React from 'react'
import { CatchBoundary } from '@tanstack/react-router'
import { useInView } from '~/hooks/useInView'

const LazyEditor = React.lazy(() =>
  import('./CodeMirrorEditor.client').then((module) => ({
    default: module.CodeMirrorEditor,
  })),
)

function EditorLoadError() {
  return (
    <div role="alert" className="p-3 text-sm text-text-muted">
      Editor could not load. Reload the page to try again.
    </div>
  )
}

export function LazyCodeMirrorEditor(
  props: React.ComponentProps<typeof LazyEditor>,
) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inView = useInView(containerRef)
  const [hasActivated, setHasActivated] = React.useState(false)

  React.useEffect(() => {
    if (inView) setHasActivated(true)
  }, [inView])

  return (
    <div ref={containerRef} className="h-full min-h-0">
      {hasActivated || inView ? (
        <React.Suspense
          fallback={
            <div role="status" className="p-3 text-sm text-text-muted">
              Loading editor…
            </div>
          }
        >
          <CatchBoundary
            getResetKey={() => 'editor'}
            errorComponent={EditorLoadError}
          >
            <LazyEditor {...props} />
          </CatchBoundary>
        </React.Suspense>
      ) : null}
    </div>
  )
}
