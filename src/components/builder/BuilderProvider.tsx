/**
 * BuilderProvider wraps CTA providers and handles initialization
 */

import * as React from 'react'
import {
  CTAProvider,
  WebContainerProvider,
  useReady,
  useManager,
} from '@tanstack/cta-ui-base'
import { useDryRun } from '@tanstack/cta-ui-base/dist/store/project'
import {
  useBuilderSearch,
  useInitializeAddonsFromUrl,
} from './hooks/useBuilderSearch'

type BuilderProviderProps = {
  children: React.ReactNode
}

function BuilderProviderInner({ children }: BuilderProviderProps) {
  // Initialize manager to start CTA engine
  useManager()

  // Sync URL state with CTA state
  useBuilderSearch()

  // Initialize addons from URL after registry loads
  useInitializeAddonsFromUrl()

  const ready = useReady()
  const dryRun = useDryRun()

  // Convert dry run files to WebContainer format
  const dryRunFiles = dryRun?.files
  const projectFiles = React.useMemo(() => {
    if (!dryRunFiles) return []
    return Object.entries(dryRunFiles).map(([path, content]) => ({
      path: path.replace(/^\.\//, ''),
      content: content as string,
    }))
  }, [dryRunFiles])

  if (!ready) {
    return <BuilderLoading />
  }

  return (
    <WebContainerProvider projectFiles={projectFiles}>
      {children}
    </WebContainerProvider>
  )
}

export function BuilderProvider({ children }: BuilderProviderProps) {
  return (
    <CTAProvider>
      <BuilderProviderInner>{children}</BuilderProviderInner>
    </CTAProvider>
  )
}

function BuilderLoading() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-gray-200 dark:border-gray-700" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading builder...
        </p>
      </div>
    </div>
  )
}
