/**
 * BuilderLayout - Main 2-panel layout for the builder
 * Left panel: Configuration (starters, options, add-ons)
 * Right panel: File explorer and preview tabs
 */

import * as React from 'react'
import { ConfigPanel } from './config/ConfigPanel'
import { ExplorerPanel } from './explorer/ExplorerPanel'

export function BuilderLayout() {
  const [isMobileConfigOpen, setIsMobileConfigOpen] = React.useState(true)

  return (
    <div className="flex h-full w-full overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Left panel - Config */}
      <div
        className={`
          w-full md:w-[400px] lg:w-[440px] shrink-0
          border-r border-gray-200 dark:border-gray-800
          bg-white dark:bg-gray-900
          overflow-y-auto
          ${isMobileConfigOpen ? 'block' : 'hidden md:block'}
        `}
      >
        <ConfigPanel />
      </div>

      {/* Right panel - Explorer/Preview */}
      <div
        className={`
          flex-1 min-w-0 min-h-0 overflow-hidden
          bg-white dark:bg-gray-900
          ${isMobileConfigOpen ? 'hidden md:flex' : 'flex'}
          flex-col
        `}
      >
        <ExplorerPanel
          isMobileConfigOpen={isMobileConfigOpen}
          onToggleMobileConfig={() => setIsMobileConfigOpen((p) => !p)}
        />
      </div>
    </div>
  )
}
