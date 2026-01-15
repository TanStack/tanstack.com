/**
 * LivePreview - WebContainer iframe with controls
 */

import * as React from 'react'
import { useWebContainer } from '@tanstack/cta-ui-base'
import { PreviewLoading } from './PreviewLoading'

export function LivePreview() {
  const webContainer = useWebContainer()
  const [refreshKey, setRefreshKey] = React.useState(0)

  // Track WebContainer state reactively
  const [state, setState] = React.useState(() => ({
    previewUrl: webContainer?.getState().previewUrl ?? null,
    ready: webContainer?.getState().ready ?? false,
    error: webContainer?.getState().error ?? null,
    setupStep: webContainer?.getState().setupStep ?? 'idle',
  }))

  // Subscribe to state changes
  React.useEffect(() => {
    if (!webContainer) return

    // Set initial state
    const initial = webContainer.getState()
    setState({
      previewUrl: initial.previewUrl,
      ready: initial.ready,
      error: initial.error,
      setupStep: initial.setupStep,
    })

    const unsubscribe = webContainer.subscribe((newState) => {
      setState({
        previewUrl: newState.previewUrl,
        ready: newState.ready,
        error: newState.error,
        setupStep: newState.setupStep,
      })
    })

    return unsubscribe
  }, [webContainer])

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1)
  }

  // Show loading state - use setupStep since ready flag may not be set
  const isReady = state.setupStep === 'ready' && state.previewUrl
  if (!isReady) {
    return <PreviewLoading setupStep={state.setupStep} error={state.error} />
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        {/* Refresh button */}
        <button
          type="button"
          onClick={handleRefresh}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Refresh preview"
        >
          <svg
            className="w-4 h-4 text-gray-500 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>

        {/* URL bar */}
        <div className="flex-1 px-3 py-1.5 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-mono text-gray-600 dark:text-gray-400 truncate">
          {state.previewUrl}
        </div>

        {/* Open in new tab */}
        <a
          href={state.previewUrl ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Open in new tab"
        >
          <svg
            className="w-4 h-4 text-gray-500 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </div>

      {/* Iframe */}
      <div className="flex-1 bg-white">
        <iframe
          key={refreshKey}
          src={state.previewUrl ?? undefined}
          title="Live Preview"
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      </div>
    </div>
  )
}
