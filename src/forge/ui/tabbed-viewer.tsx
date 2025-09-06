import { useState } from 'react'
import FileNavigator from '~/forge/ui/file-navigator'
import { WebContainerPreview } from '~/forge/ui/webcontainer-preview'
import { ForgeDeployTab } from '~/forge/ui/forge-deploy-tab'

interface TabbedViewerProps {
  originalTree: Record<string, string>
  projectFiles: Record<string, string>
  projectFilesArray: Array<{ path: string; content: string }>
  projectName?: string
}

type Tab = 'files' | 'preview' | 'deploy'

export function TabbedViewer({
  originalTree,
  projectFiles,
  projectFilesArray,
  projectName,
}: TabbedViewerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('files')

  const getTabClasses = (tab: Tab) => {
    const baseClasses =
      'px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer'
    if (activeTab === tab) {
      return `${baseClasses} border-blue-500 text-blue-600 dark:text-blue-400`
    }
    return `${baseClasses} border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300`
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex">
          <button
            onClick={() => setActiveTab('files')}
            className={getTabClasses('files')}
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Files
            </div>
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={getTabClasses('preview')}
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              Preview
            </div>
          </button>
          <button
            onClick={() => setActiveTab('deploy')}
            className={getTabClasses('deploy')}
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v5l3-3h4l-7-7-7 7h4l3 3z"
                />
              </svg>
              Build & Deploy
            </div>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'files' && (
          <div className="h-full overflow-y-auto">
            <FileNavigator
              originalTree={originalTree}
              projectFiles={projectFiles}
            />
          </div>
        )}
        {activeTab === 'preview' && (
          <WebContainerPreview projectFiles={projectFilesArray} />
        )}
        {activeTab === 'deploy' && (
          <ForgeDeployTab
            projectFiles={projectFilesArray}
            projectName={projectName}
          />
        )}
      </div>
    </div>
  )
}
