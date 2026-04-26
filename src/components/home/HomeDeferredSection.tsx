import * as React from 'react'
import { useIntersectionObserver } from '~/hooks/useIntersectionObserver'

export function HomeDeferredSection({
  children,
  fallback,
  forceLoad = false,
  preload,
  rootMargin = '20%',
  timeoutMs = 4000,
}: {
  children: React.ReactNode
  fallback: React.ReactNode
  forceLoad?: boolean
  preload?: () => Promise<unknown>
  rootMargin?: string
  timeoutMs?: number
}) {
  const { ref, isIntersecting } = useIntersectionObserver({
    rootMargin,
    triggerOnce: true,
  })
  const [shouldLoad, setShouldLoad] = React.useState(false)

  React.useLayoutEffect(() => {
    if (!forceLoad || shouldLoad) {
      return
    }

    void preload?.()
    setShouldLoad(true)
  }, [forceLoad, preload, shouldLoad])

  React.useEffect(() => {
    if (forceLoad || shouldLoad || !isIntersecting) {
      return
    }

    void preload?.()

    React.startTransition(() => {
      setShouldLoad(true)
    })
  }, [forceLoad, isIntersecting, preload, shouldLoad])

  React.useEffect(() => {
    if (forceLoad || shouldLoad || typeof window === 'undefined') {
      return
    }

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(
        () => {
          void preload?.()

          React.startTransition(() => {
            setShouldLoad(true)
          })
        },
        { timeout: timeoutMs },
      )

      return () => {
        window.cancelIdleCallback(idleId)
      }
    }

    const timeoutId = window.setTimeout(() => {
      void preload?.()

      React.startTransition(() => {
        setShouldLoad(true)
      })
    }, timeoutMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [forceLoad, preload, shouldLoad, timeoutMs])

  return (
    <div ref={ref}>
      {shouldLoad ? (
        <React.Suspense fallback={fallback}>{children}</React.Suspense>
      ) : (
        fallback
      )}
    </div>
  )
}
