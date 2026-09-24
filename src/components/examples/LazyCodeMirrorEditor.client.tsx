import * as React from 'react'
import { useInView } from '~/hooks/useInView'

const LazyEditor = React.lazy(() =>
  import('./CodeMirrorEditor.client').then((module) => ({
    default: module.CodeMirrorEditor,
  })),
)

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
          <LazyEditor {...props} />
        </React.Suspense>
      ) : null}
    </div>
  )
}
