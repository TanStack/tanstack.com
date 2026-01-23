/**
 * Builder Layout (v2)
 *
 * Main layout component for the builder, arranging ConfigPanel and ExplorerPanel.
 * Uses proper theme support.
 */

import { useEffect } from 'react'
import { ConfigPanel } from './ConfigPanel'
import { ExplorerPanel } from './ExplorerPanel'
import { useBuilderUrl } from './useBuilderUrl'
import { useBuilderStore } from './store'

export function BuilderLayout() {
  // Sync URL with store
  useBuilderUrl()

  // Auto-compile on mount and when config changes
  const features = useBuilderStore((s) => s.features)
  const tailwind = useBuilderStore((s) => s.tailwind)
  const featuresLoaded = useBuilderStore((s) => s.featuresLoaded)
  const compile = useBuilderStore((s) => s.compile)

  useEffect(() => {
    if (featuresLoaded) {
      compile()
    }
  }, [features, tailwind, featuresLoaded, compile])

  return (
    <div className="h-full flex bg-gray-50 dark:bg-gray-950">
      {/* Left Panel - Config */}
      <div className="w-full md:w-96 lg:w-[26rem] xl:w-[30rem] 2xl:w-[40rem] shrink-0">
        <ConfigPanel />
      </div>

      {/* Right Panel - Explorer (hidden on small screens) */}
      <div className="hidden md:block flex-1 min-w-0 overflow-hidden">
        <ExplorerPanel />
      </div>
    </div>
  )
}
