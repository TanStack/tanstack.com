import * as React from 'react'

import type { ApplicationStarterProps } from '~/components/ApplicationStarter'

const LazyApplicationStarter = React.lazy(() =>
  import('~/components/ApplicationStarter').then((m) => ({
    default: m.ApplicationStarter,
  })),
)

export function DeferredApplicationStarter(props: ApplicationStarterProps) {
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

        setShouldLoad(true)
        observer.disconnect()
      },
      { rootMargin: '320px 0px' },
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

    const requestIdleCallback = window.requestIdleCallback
    const cancelIdleCallback = window.cancelIdleCallback

    if (
      typeof requestIdleCallback === 'function' &&
      typeof cancelIdleCallback === 'function'
    ) {
      const idleId = requestIdleCallback(
        () => {
          setShouldLoad(true)
        },
        { timeout: 2500 },
      )

      return () => {
        cancelIdleCallback(idleId)
      }
    }

    const timeoutId = window.setTimeout(() => {
      setShouldLoad(true)
    }, 1500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [shouldLoad])

  return (
    <div ref={wrapperRef}>
      {shouldLoad ? (
        <React.Suspense
          fallback={<DeferredApplicationStarterFallback mode={props.mode} />}
        >
          <LazyApplicationStarter {...props} />
        </React.Suspense>
      ) : (
        <DeferredApplicationStarterFallback mode={props.mode} />
      )}
    </div>
  )
}

function DeferredApplicationStarterFallback({
  mode = 'full',
}: {
  mode?: ApplicationStarterProps['mode']
}) {
  if (mode === 'compact') {
    return (
      <div aria-hidden="true" className="space-y-3">
        <div className="h-5 w-48 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-800">
            <div className="h-3 w-10 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="mt-2 flex flex-wrap gap-2">
              <div className="h-8 w-24 rounded-md bg-gray-200 dark:bg-gray-800" />
              <div className="h-8 w-28 rounded-md bg-gray-200 dark:bg-gray-800" />
              <div className="h-8 w-20 rounded-md bg-gray-200 dark:bg-gray-800" />
            </div>
          </div>

          <div className="px-3 pb-2 pt-2">
            <div className="h-3 w-12 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="mt-2 h-20 rounded-md bg-gray-100 dark:bg-gray-900" />
          </div>

          <div className="border-t border-gray-200 px-3 py-2 dark:border-gray-800">
            <div className="h-8 w-24 rounded-md bg-gray-200 dark:bg-gray-800" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-[1rem] border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
    >
      <div className="border-b border-gray-200 bg-gray-50/70 px-5 py-4 dark:border-gray-800 dark:bg-gray-900/50">
        <div className="h-7 w-64 max-w-full rounded bg-gray-200 dark:bg-gray-800" />
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="h-9 w-28 rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="h-9 w-32 rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="h-9 w-24 rounded-lg bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>

      <div className="relative border-b border-gray-200 dark:border-gray-800">
        <div className="px-5 pt-4">
          <div className="h-3 w-12 rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="px-5 pb-4 pt-3">
          <div className="h-28 rounded-xl bg-gray-100 dark:bg-gray-900" />
        </div>

        <div className="border-t border-gray-200 px-5 py-4 dark:border-gray-800">
          <div className="flex flex-wrap gap-3">
            <div className="h-10 w-28 rounded-lg bg-gray-200 dark:bg-gray-800" />
            <div className="h-10 w-36 rounded-lg bg-gray-200 dark:bg-gray-800" />
          </div>
        </div>
      </div>
    </div>
  )
}
