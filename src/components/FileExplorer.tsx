import React from 'react'
import { FileTree, type FileTreeNode } from './FileTree'
import type { GitHubFileNode } from '~/utils/documents.server'

interface FileExplorerProps {
  currentPath: string | null
  githubContents: GitHubFileNode[] | undefined
  isSidebarOpen: boolean
  libraryColor: string
  prefetchFileContent: (file: string) => void
  setCurrentPath: (file: string) => void
}

export function FileExplorer({
  currentPath,
  githubContents,
  isSidebarOpen,
  libraryColor,
  prefetchFileContent,
  setCurrentPath,
}: FileExplorerProps) {
  const [sidebarWidth, setSidebarWidth] = React.useState(220)
  const [isResizing, setIsResizing] = React.useState(false)
  const fileTreeNodes = React.useMemo(
    () => toFileTreeNodes(githubContents ?? []),
    [githubContents],
  )
  const MIN_SIDEBAR_WIDTH = 60

  const startResizeRef = React.useRef({
    startX: 0,
    startWidth: 0,
  })

  const startResize = (e: React.MouseEvent | React.TouchEvent) => {
    setIsResizing(true)
    startResizeRef.current = {
      startX: 'touches' in e ? e.touches[0].clientX : e.clientX,
      startWidth: sidebarWidth,
    }
  }

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isResizing) return

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const diff = clientX - startResizeRef.current.startX
      const newWidth = startResizeRef.current.startWidth + diff

      if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= 600) {
        setSidebarWidth(newWidth)
      } else if (newWidth < MIN_SIDEBAR_WIDTH) {
        setSidebarWidth(MIN_SIDEBAR_WIDTH)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      if (sidebarWidth <= MIN_SIDEBAR_WIDTH) {
        setSidebarWidth(200)
        const event = new CustomEvent('closeSidebar')
        window.dispatchEvent(event)
      }
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('touchmove', handleMouseMove)
      document.addEventListener('touchend', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('touchmove', handleMouseMove)
      document.removeEventListener('touchend', handleMouseUp)
    }
  }, [isResizing, sidebarWidth])

  if (!githubContents) return null

  return (
    <>
      <div
        className={`shrink-0 overflow-y-auto bg-linear-to-r from-gray-50 via-gray-50 to-transparent shadow-sm dark:from-gray-800/50 dark:via-gray-800/50 dark:to-transparent ${
          isResizing ? '' : 'transition-all duration-300'
        }`}
        style={{
          paddingRight: isSidebarOpen ? '0.5rem' : 0,
          width: isSidebarOpen ? sidebarWidth : 0,
        }}
      >
        {isSidebarOpen ? (
          <div className="p-2">
            <FileTree
              activeClassName={`${libraryColor}/20 text-gray-900 shadow-sm dark:text-white`}
              currentPath={currentPath}
              nodes={fileTreeNodes}
              onSelectFile={setCurrentPath}
              prefetchFileContent={prefetchFileContent}
              tone="docs"
            />
          </div>
        ) : null}
      </div>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className={`w-1 cursor-col-resize hover:bg-gray-300 active:bg-gray-400 dark:hover:bg-gray-600 dark:active:bg-gray-500 ${
          isResizing ? '' : 'transition-colors'
        } ${isSidebarOpen ? '' : 'hidden'}`}
        onMouseDown={startResize}
        onTouchStart={startResize}
      />
    </>
  )
}

function toFileTreeNodes(nodes: Array<GitHubFileNode>): Array<FileTreeNode> {
  return nodes.map((node) => ({
    children: node.children ? toFileTreeNodes(node.children) : undefined,
    name: node.name,
    path: node.path,
    type: node.type === 'dir' ? 'dir' : 'file',
  }))
}
