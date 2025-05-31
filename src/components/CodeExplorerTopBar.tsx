import React from 'react'
import { CgMenuLeft } from 'react-icons/cg'
import { FaCompress, FaExpand } from 'react-icons/fa'

interface CodeExplorerTopBarProps {
  activeTab: 'code' | 'sandbox'
  isFullScreen: boolean
  isSidebarOpen: boolean
  setActiveTab: (tab: 'code' | 'sandbox') => void
  setIsFullScreen: React.Dispatch<React.SetStateAction<boolean>>
  setIsSidebarOpen: (isOpen: boolean) => void
}

export function CodeExplorerTopBar({
  activeTab,
  isFullScreen,
  isSidebarOpen,
  setActiveTab,
  setIsFullScreen,
  setIsSidebarOpen,
}: CodeExplorerTopBarProps) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 px-1">
        {activeTab === 'code' ? (
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="rounded p-2 text-sm text-gray-700 transition-colors hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
            title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            <CgMenuLeft className="h-4 w-4" />
          </button>
        ) : (
          <div className="rounded p-2 text-sm" aria-hidden>
            <CgMenuLeft className="h-4 w-4 text-transparent" aria-hidden />
          </div>
        )}
        <button
          onClick={() => setActiveTab('code')}
          className={`relative px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'code'
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <span className="hidden sm:inline">Code Explorer</span>
          <span className="sm:hidden">Code</span>
          {activeTab === 'code' ? (
            <div className="absolute right-0 bottom-0 left-0 h-0.5 bg-blue-500" />
          ) : (
            <div className="absolute right-0 bottom-0 left-0 h-0.5 bg-transparent" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('sandbox')}
          className={`relative px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'sandbox'
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <span className="hidden sm:inline">Interactive Sandbox</span>
          <span className="sm:hidden">Sandbox</span>
          {activeTab === 'sandbox' ? (
            <div className="absolute right-0 bottom-0 left-0 h-0.5 bg-blue-500" />
          ) : (
            <div className="absolute right-0 bottom-0 left-0 h-0.5 bg-transparent" />
          )}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setIsFullScreen((prev) => !prev)
          }}
          className={`mr-2 rounded p-2 text-sm transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 ${
            activeTab === 'code'
              ? 'text-gray-700 dark:text-gray-300'
              : 'text-gray-400 dark:text-gray-600'
          }`}
          title={isFullScreen ? 'Exit full screen' : 'Enter full screen'}
        >
          {isFullScreen ? (
            <FaCompress className="h-4 w-4" />
          ) : (
            <FaExpand className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  )
}
