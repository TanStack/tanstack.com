import * as React from 'react'

import { HomeApplicationStarterFallback } from './HomeSectionFallbacks'

const LazyApplicationStarter = React.lazy(() =>
  import('~/components/ApplicationStarter').then((m) => ({
    default: m.ApplicationStarter,
  })),
)

export function HomeApplicationStarter() {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)
  const [shouldLoad, setShouldLoad] = React.useState(false)

  React.useEffect(() => {
    if (shouldLoad) {
      return
    }

    const element = wrapperRef.current

    if (!element || typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return
        }

        React.startTransition(() => {
          setShouldLoad(true)
        })
        observer.disconnect()
      },
      { rootMargin: '180px 0px' },
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [shouldLoad])

  React.useEffect(() => {
    if (shouldLoad || typeof window === 'undefined') {
      return
    }

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(
        () => {
          React.startTransition(() => {
            setShouldLoad(true)
          })
        },
        { timeout: 3500 },
      )

      return () => {
        window.cancelIdleCallback(idleId)
      }
    }

    const timeoutId = window.setTimeout(() => {
      React.startTransition(() => {
        setShouldLoad(true)
      })
    }, 2500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [shouldLoad])

  return (
    <div ref={wrapperRef}>
      {shouldLoad ? (
        <React.Suspense fallback={<HomeApplicationStarterFallback />}>
          <LazyApplicationStarter
            context="home"
            enableHotkeys
            primaryButtonColor="cyan"
            tone="cyan"
          />
        </React.Suspense>
      ) : (
        <HomeApplicationStarterFallback />
      )}
    </div>
  )
}
