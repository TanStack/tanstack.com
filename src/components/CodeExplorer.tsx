import React from 'react'
import { FileExplorer, type FileExplorerNode } from './FileExplorer'
import { InteractiveSandbox } from './InteractiveSandbox'
import { CodeExplorerTopBar } from './CodeExplorerTopBar'
import { getExamplePanels, type ExamplePanel } from '~/utils/example-panel'
import type { Library } from '~/libraries'
import { twMerge } from 'tailwind-merge'
import { CodeBlock } from '~/components/markdown'
import { getCodeBlockLanguageFromFilePath } from '~/components/markdown/codeBlock.shared'

interface CodeExplorerProps {
  activeTab: ExamplePanel
  codeSandboxUrl: string
  currentCode: string
  currentPath: string
  examplePath: string
  githubContents: FileExplorerNode[] | undefined
  library: Library
  prefetchFileContent: (path: string) => void
  playground?: React.ReactNode
  setActiveTab: (tab: ExamplePanel) => void
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
  playground,
  setActiveTab,
  setCurrentPath,
  stackBlitzUrl,
}: CodeExplorerProps) {
  const [isFullScreen, setIsFullScreen] = React.useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true)
  const [hasOpenedPlayground, setHasOpenedPlayground] = React.useState(
    activeTab === 'playground',
  )
  React.useEffect(() => {
    if (activeTab === 'playground') setHasOpenedPlayground(true)
  }, [activeTab])
  const panels = getExamplePanels({
    ...library,
    hasPlayground: Boolean(playground),
  })
  const currentCodeLanguage = getCodeBlockLanguageFromFilePath(currentPath)

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
        panels={panels}
        setActiveTab={setActiveTab}
        isFullScreen={isFullScreen}
        setIsFullScreen={setIsFullScreen}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />

      <div className="relative flex-1">
        {playground && (hasOpenedPlayground || activeTab === 'playground') ? (
          <div
            className={`absolute inset-0 min-h-0 flex-col ${activeTab === 'playground' ? 'flex' : 'hidden'}`}
          >
            {playground}
          </div>
        ) : null}
        {!playground ? (
          <div
            className={`absolute inset-0 flex ${
              activeTab === 'code' ? '' : 'hidden'
            }`}
          >
            <FileExplorer
              currentPath={currentPath}
              files={githubContents}
              isSidebarOpen={isSidebarOpen}
              libraryColor={library.bgStyle}
              onSidebarClose={() => setIsSidebarOpen(false)}
              prefetchFileContent={prefetchFileContent}
              setCurrentPath={setCurrentPath}
            />
            <div
              className={twMerge(
                'flex-1 overflow-auto relative',
                isFullScreen ? 'max-h-[90dvh]' : 'max-h-[80dvh]',
              )}
            >
              <CodeBlock
                className="h-full border-0"
                isEmbedded
                showTypeCopyButton={false}
              >
                <code className={`language-${currentCodeLanguage}`}>
                  {currentCode}
                </code>
              </CodeBlock>
            </div>
          </div>
        ) : null}
        {!library.hideStackblitzUrl ? (
          <InteractiveSandbox
            isActive={activeTab === 'stackblitz'}
            codeSandboxUrl={codeSandboxUrl}
            stackBlitzUrl={stackBlitzUrl}
            examplePath={examplePath}
            libraryName={library.name}
            embedEditor="stackblitz"
          />
        ) : null}
        {!library.hideCodesandboxUrl ? (
          <InteractiveSandbox
            isActive={activeTab === 'codesandbox'}
            codeSandboxUrl={codeSandboxUrl}
            stackBlitzUrl={stackBlitzUrl}
            examplePath={examplePath}
            libraryName={library.name}
            embedEditor="codesandbox"
          />
        ) : null}
      </div>
    </div>
  )
}
