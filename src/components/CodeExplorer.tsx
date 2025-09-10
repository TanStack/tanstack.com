import React from 'react'
import { CodeBlock } from '~/components/Markdown'
import { FileExplorer } from './FileExplorer'
import { InteractiveSandbox } from './InteractiveSandbox'
import { CodeExplorerTopBar } from './CodeExplorerTopBar'
import type { GitHubFileNode } from '~/utils/documents.server'
import type { Library } from '~/libraries'
import { twMerge } from 'tailwind-merge'

function overrideExtension(ext: string | undefined) {
  if (!ext) return 'txt'

  // Override some extensions
  if (['cts', 'mts'].includes(ext)) return 'ts'
  if (['cjs', 'mjs'].includes(ext)) return 'js'
  if (['prettierrc', 'babelrc', 'webmanifest'].includes(ext)) return 'json'
  if (['env', 'example'].includes(ext)) return 'sh'
  if (
    [
      'gitignore',
      'prettierignore',
      'log',
      'gitattributes',
      'editorconfig',
      'lock',
      'opts',
      'Dockerfile',
      'dockerignore',
      'npmrc',
      'nvmrc',
    ].includes(ext)
  )
    return 'txt'

  return ext
}

interface CodeExplorerProps {
  activeTab: 'code' | 'sandbox'
  codeSandboxUrl: string
  currentCode: string
  currentPath: string
  examplePath: string
  githubContents: GitHubFileNode[] | undefined
  library: Library
  prefetchFileContent: (path: string) => void
  setActiveTab: (tab: 'code' | 'sandbox') => void
  setCurrentPath: (path: string) => void
  stackBlitzUrl: string
}

export function CodeExplorer({
  activeTab,
  codeSandboxUrl,
  currentCode,
  currentPath,
  examplePath,
  githubContents,
  library,
  prefetchFileContent,
  setActiveTab,
  setCurrentPath,
  stackBlitzUrl,
}: CodeExplorerProps) {
  const [isFullScreen, setIsFullScreen] = React.useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true)

  // Add escape key handler
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isFullScreen])

  // Add sidebar close handler
  React.useEffect(() => {
    const handleCloseSidebar = () => {
      setIsSidebarOpen(false)
    }
    window.addEventListener('closeSidebar', handleCloseSidebar)
    return () => window.removeEventListener('closeSidebar', handleCloseSidebar)
  }, [])

  return (
    <div
      className={`flex flex-col min-h-[60dvh] sm:min-h-[80dvh] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${
        isFullScreen
          ? 'fixed inset-0 top-[var(--navbar-height)] z-50 bg-white dark:bg-gray-900'
          : ''
      }`}
    >
      <CodeExplorerTopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isFullScreen={isFullScreen}
        setIsFullScreen={setIsFullScreen}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />

      <div className="relative flex-1">
        <div
          className={`absolute inset-0 flex ${
            activeTab === 'code' ? '' : 'hidden'
          }`}
        >
          <FileExplorer
            currentPath={currentPath}
            githubContents={githubContents}
            isSidebarOpen={isSidebarOpen}
            libraryColor={library.bgStyle}
            prefetchFileContent={prefetchFileContent}
            setCurrentPath={setCurrentPath}
          />
          <div className="flex-1 overflow-auto relative">
            <CodeBlock
              isEmbedded
              className={twMerge(
                'h-full border-0',
                isFullScreen ? 'max-h-[90dvh]' : 'max-h-[80dvh]'
              )}
            >
              <code
                className={`language-${overrideExtension(
                  currentPath.split('.').pop()
                )}`}
              >
                {currentCode}
              </code>
            </CodeBlock>
          </div>
        </div>
        <InteractiveSandbox
          isActive={activeTab === 'sandbox'}
          codeSandboxUrl={codeSandboxUrl}
          stackBlitzUrl={stackBlitzUrl}
          examplePath={examplePath}
          libraryName={library.name}
          embedEditor={library.embedEditor || 'stackblitz'}
        />
      </div>
    </div>
  )
}
