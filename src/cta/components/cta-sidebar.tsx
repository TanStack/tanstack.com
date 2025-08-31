import { useState } from 'react'
import { useApplicationMode, useReady } from '../store/project'

import SelectedAddOns from './sidebar-items/add-ons'
import RunAddOns from './sidebar-items/run-add-ons'
import ProjectName from './sidebar-items/project-name'
import ModeSelector from './sidebar-items/mode-selector'
import TypescriptSwitch from './sidebar-items/typescript-switch'
import StarterDialog from './sidebar-items/starter'

type TabType = 'setup' | 'addons' | 'starter'

export function BuilderSidebar() {
  const ready = useReady()
  const mode = useApplicationMode()
  const [activeTab, setActiveTab] = useState<TabType>('addons')

  if (!ready) {
    return (
      <div className="mt-5">
        <RunAddOns />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-xl">
      {/* Tab Headers */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {mode === 'setup' && (
          <button
            onClick={() => setActiveTab('setup')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-all relative ${
              activeTab === 'setup'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Setup
            {activeTab === 'setup' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}
          </button>
        )}
        <button
          onClick={() => setActiveTab('addons')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-all relative ${
            activeTab === 'addons'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Add-ons
          {activeTab === 'addons' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          )}
        </button>
        {mode === 'setup' && (
          <button
            onClick={() => setActiveTab('starter')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-all relative ${
              activeTab === 'starter'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Starter
            {activeTab === 'starter' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {activeTab === 'setup' && mode === 'setup' && (
          <div className="space-y-4">
            <ProjectName />
            <ModeSelector />
            <TypescriptSwitch />
          </div>
        )}
        
        {activeTab === 'addons' && (
          <SelectedAddOns />
        )}
        
        {activeTab === 'starter' && mode === 'setup' && (
          <StarterDialog />
        )}
      </div>

      {/* Bottom Action */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <RunAddOns />
      </div>
    </div>
  )
}
