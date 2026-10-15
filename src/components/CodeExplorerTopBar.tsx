import React from 'react'
import {
  ArrowLineLeftIcon,
  ArrowLineRightIcon,
  ArrowsOutIcon,
  ArrowsInIcon,
  TextAlignLeftIcon,
} from '@phosphor-icons/react'
import { Tooltip } from '~/ui'
import type { ExamplePanel, ExamplePanelOption } from '~/utils/example-panel'

interface CodeExplorerTopBarProps {
  activeTab: ExamplePanel
  panels: ReadonlyArray<ExamplePanelOption>
  isFullScreen: boolean
  isSidebarOpen: boolean
  setActiveTab: (tab: ExamplePanel) => void
  setIsFullScreen: React.Dispatch<React.SetStateAction<boolean>>
  setIsSidebarOpen: (isOpen: boolean) => void
}

export function CodeExplorerTopBar({
  activeTab,
  panels,
  isFullScreen,
  isSidebarOpen,
  setActiveTab,
  setIsFullScreen,
  setIsSidebarOpen,
}: CodeExplorerTopBarProps) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700">
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto px-1">
        {activeTab === 'code' ? (
          isSidebarOpen ? (
            <Tooltip content="Hide files" side="bottom">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 text-sm rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                aria-label="Hide files"
                aria-pressed={true}
              >
                <ArrowLineLeftIcon className="w-4 h-4" aria-hidden="true" />
              </button>
            </Tooltip>
          ) : (
            <Tooltip content="Show files" side="bottom">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 text-sm rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                aria-label="Show files"
                aria-pressed={false}
              >
                <ArrowLineRightIcon className="w-4 h-4" aria-hidden="true" />
              </button>
            </Tooltip>
          )
        ) : (
          <div className="p-2 text-sm rounded" aria-hidden>
            <TextAlignLeftIcon
              className="w-4 h-4 text-transparent"
              aria-hidden
            />
          </div>
        )}
        {panels.map((panel) => (
          <button
            key={panel.id}
            type="button"
            onClick={() => setActiveTab(panel.id)}
            aria-pressed={activeTab === panel.id}
            className={`shrink-0 px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === panel.id
                ? 'border-blue-500 text-gray-900 dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {panel.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setIsFullScreen((prev) => !prev)
          }}
          className={`p-2 text-sm rounded transition-colors mr-2 hover:bg-gray-200 dark:hover:bg-gray-700 ${
            activeTab === 'code'
              ? 'text-gray-600 dark:text-gray-400'
              : 'text-gray-400 dark:text-gray-600'
          }`}
          title={isFullScreen ? 'Exit full screen' : 'Enter full screen'}
        >
          {isFullScreen ? (
            <ArrowsInIcon className="w-4 h-4" />
          ) : (
            <ArrowsOutIcon className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  )
}
