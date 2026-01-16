/**
 * BuilderProvider - Wraps CTA providers and handles initialization
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
import { useCapabilities } from '~/hooks/useCapabilities'
import { hasCapability } from '~/db/types'

type BuilderProviderProps = {
  children: React.ReactNode
}

// Context for lazy preview activation
type PreviewContextValue = {
  canPreview: boolean
  previewActivated: boolean
  activatePreview: () => void
}

const PreviewContext = React.createContext<PreviewContextValue>({
  canPreview: false,
  previewActivated: false,
  activatePreview: () => {},
})

export function usePreviewContext() {
  return React.useContext(PreviewContext)
}

// Inner component that only runs after CTA is ready
// This avoids calling useAddOns before data is loaded (which has a bug)
function BuilderReadyInner({ children }: BuilderProviderProps) {
  // Sync URL state with CTA state (uses useAddOns internally)
  useBuilderSearch()

  // Initialize addons from URL after registry loads
  useInitializeAddonsFromUrl()

  // Check if user can use preview (admin only for now)
  const capabilities = useCapabilities()
  const canPreview = hasCapability(capabilities, 'admin')

  // Lazy preview activation - only start WebContainer when user clicks Preview
  const [previewActivated, setPreviewActivated] = React.useState(false)
  const activatePreview = React.useCallback(() => {
    setPreviewActivated(true)
  }, [])

  const previewContextValue = React.useMemo(
    () => ({ canPreview, previewActivated, activatePreview }),
    [canPreview, previewActivated, activatePreview],
  )

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

  // Only load WebContainer if user can preview AND has activated it
  if (!canPreview || !previewActivated) {
    return (
      <PreviewContext.Provider value={previewContextValue}>
        {children}
      </PreviewContext.Provider>
    )
  }

  return (
    <PreviewContext.Provider value={previewContextValue}>
      <WebContainerProvider projectFiles={projectFiles}>
        {children}
      </WebContainerProvider>
    </PreviewContext.Provider>
  )
}

function BuilderProviderInner({ children }: BuilderProviderProps) {
  // Initialize manager to start CTA engine
  useManager()

  const ready = useReady()

  // Delay showing loading state to avoid flash during HMR
  // HMR typically re-initializes within ~100ms, so we wait a bit before showing loading
  const [showLoading, setShowLoading] = React.useState(false)

  React.useEffect(() => {
    if (ready) {
      setShowLoading(false)
      return
    }

    // Only show loading after a short delay to avoid HMR flash
    const timeout = setTimeout(() => {
      setShowLoading(true)
    }, 150)

    return () => clearTimeout(timeout)
  }, [ready])

  if (!ready && showLoading) {
    return <BuilderLoading />
  }

  if (!ready) {
    // Brief moment before showing loading - render nothing or a minimal placeholder
    return null
  }

  return <BuilderReadyInner>{children}</BuilderReadyInner>
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
