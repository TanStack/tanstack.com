import React from 'react'
import type { Framework } from '~/libraries'
import { useIntersectionObserver } from '~/hooks/useIntersectionObserver'

const LazyCodeExampleCardImpl = React.lazy(async () => {
  const mod = await import('./CodeExampleCard')

  return { default: mod.CodeExampleCard }
})

interface LazyCodeExampleCardProps {
  title?: string
  frameworks: Framework[]
  codeByFramework: Partial<Record<Framework, { lang: string; code: string }>>
}

export function LazyCodeExampleCard(props: LazyCodeExampleCardProps) {
  const { ref, isIntersecting } = useIntersectionObserver({
    rootMargin: '25%',
    triggerOnce: true,
  })

  return (
    <div ref={ref} className="px-4 space-y-4 flex flex-col items-center">
      {!isIntersecting ? (
        <div className="w-full max-w-5xl mx-auto space-y-4">
          <div className="h-10 w-56 mx-auto rounded bg-gray-200/70 dark:bg-gray-800/70 animate-pulse" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 overflow-hidden">
            <div className="h-14 border-b border-gray-200 dark:border-gray-800 bg-gray-100/70 dark:bg-gray-800/70 animate-pulse" />
            <div className="p-4 space-y-3">
              <div className="h-4 w-11/12 rounded bg-gray-200/70 dark:bg-gray-800/70 animate-pulse" />
              <div className="h-4 w-10/12 rounded bg-gray-200/70 dark:bg-gray-800/70 animate-pulse" />
              <div className="h-4 w-8/12 rounded bg-gray-200/70 dark:bg-gray-800/70 animate-pulse" />
              <div className="h-4 w-9/12 rounded bg-gray-200/70 dark:bg-gray-800/70 animate-pulse" />
              <div className="h-4 w-7/12 rounded bg-gray-200/70 dark:bg-gray-800/70 animate-pulse" />
              <div className="h-48 rounded bg-gray-100/70 dark:bg-gray-800/50 animate-pulse" />
            </div>
          </div>
        </div>
      ) : (
        <React.Suspense fallback={null}>
          <LazyCodeExampleCardImpl {...props} />
        </React.Suspense>
      )}
    </div>
  )
}
