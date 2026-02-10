import React from 'react'
import { HighlightedCodeBlock } from '~/components/markdown'
import { FileExplorer } from './FileExplorer'
import { InteractiveSandbox } from './InteractiveSandbox'
import { CodeExplorerTopBar } from './CodeExplorerTopBar'
import type { GitHubFileNode } from '~/utils/documents.server'
import type { Library } from '~/libraries'
import { twMerge } from 'tailwind-merge'

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop() || ''

  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    mts: 'typescript',
    cts: 'typescript',
    mjs: 'javascript',
    cjs: 'javascript',
    json: 'json',
    md: 'markdown',
    html: 'html',
    css: 'css',
    scss: 'scss',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    sh: 'bash',
    bash: 'bash',
    sql: 'sql',
    vue: 'vue',
    svelte: 'svelte',
  }

  return langMap[ext] || 'text'
}

interface CodeExplorerProps {
  activeTab: 'code' | 'sandbox'
  codeSandboxUrl: string
  /** Pre-highlighted HTML from server-side Shiki */
  currentCodeHtml: string
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
  currentCodeHtml,
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

  const lang = getLanguageFromPath(currentPath)

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
            <HighlightedCodeBlock
              html={currentCodeHtml}
              lang={lang}
              isEmbedded
              className={twMerge(
                'h-full border-0',
                isFullScreen ? 'max-h-[90dvh]' : 'max-h-[80dvh]',
              )}
            />
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
