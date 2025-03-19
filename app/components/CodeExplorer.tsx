import React from 'react'
import { CodeBlock } from '~/components/Markdown'
import { FileExplorer } from './FileExplorer'
import { InteractiveSandbox } from './InteractiveSandbox'
import { CodeExplorerTopBar } from './CodeExplorerTopBar'
import type { GitHubFileNode } from '~/utils/documents.server'
import type { Library } from '~/libraries'

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
  const [sidebarWidth, setSidebarWidth] = React.useState(200)
  const [isResizing, setIsResizing] = React.useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true)
  const startResizeRef = React.useRef({
    startX: 0,
    startWidth: 0,
  })

  // Initialize expandedFolders with root-level folders
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(
    () => {
      const expanded = new Set<string>()
      if (githubContents) {
        const flattened = recursiveFlattenGithubContents(githubContents)
        if (flattened.every((f) => f.depth === 0)) {
          return expanded
        }

        // if the currentPath matches, then open
        for (const file of flattened) {
          if (file.path === currentPath) {
            // Open all ancestors directories
            const dirs = flattedOnlyToDirs(githubContents)
            const ancestors = file.path.split('/').slice(0, -1)

            while (ancestors.length > 0) {
              const ancestor = ancestors.join('/')

              if (dirs.some((d) => d.path === ancestor)) {
                expanded.add(ancestor)
                ancestors.pop()
              } else {
                break
              }
            }

            break
          }
        }
      }
      return expanded
    }
  )

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

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const startResize = (e: React.MouseEvent) => {
    setIsResizing(true)
    startResizeRef.current = {
      startX: e.clientX,
      startWidth: sidebarWidth,
    }
  }

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const diff = e.clientX - startResizeRef.current.startX
      const newWidth = startResizeRef.current.startWidth + diff

      if (newWidth >= 150 && newWidth <= 600) {
        setSidebarWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  return (
    <div
      className={`flex flex-col min-h-[80dvh] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${
        isFullScreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900 p-4' : ''
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
            files={githubContents}
            libraryColor={library.bgStyle}
            toggleFolder={toggleFolder}
            prefetchFileContent={prefetchFileContent}
            expandedFolders={expandedFolders}
            currentPath={currentPath}
            setCurrentPath={setCurrentPath}
            sidebarWidth={sidebarWidth}
            isSidebarOpen={isSidebarOpen}
            isResizing={isResizing}
            onResizeStart={startResize}
          />
          <div className="flex-1 overflow-auto relative">
            <CodeBlock
              isEmbedded
              className={`${isFullScreen ? 'max-h-[90dvh]' : 'max-h-[80dvh]'}`}
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

function recursiveFlattenGithubContents(
  nodes: Array<GitHubFileNode>,
  bannedDirs: Set<string> = new Set()
): Array<GitHubFileNode> {
  return nodes.flatMap((node) => {
    if (node.type === 'dir' && node.children && !bannedDirs.has(node.name)) {
      return recursiveFlattenGithubContents(node.children, bannedDirs)
    }
    return node
  })
}

function flattedOnlyToDirs(
  nodes: Array<GitHubFileNode>
): Array<GitHubFileNode> {
  return nodes.flatMap((node) => {
    if (node.type === 'dir' && node.children) {
      return [node, ...flattedOnlyToDirs(node.children)]
    }
    return node.type === 'dir' ? [node] : []
  })
}
