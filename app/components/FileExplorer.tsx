import React from 'react'
import typescriptIconUrl from '~/images/file-icons/typescript.svg?url'
import javascriptIconUrl from '~/images/file-icons/javascript.svg?url'
import cssIconUrl from '~/images/file-icons/css.svg?url'
import htmlIconUrl from '~/images/file-icons/html.svg?url'
import jsonIconUrl from '~/images/file-icons/json.svg?url'
import svelteIconUrl from '~/images/file-icons/svelte.svg?url'
import vueIconUrl from '~/images/file-icons/vue.svg?url'
import textIconUrl from '~/images/file-icons/txt.svg?url'
import type { GitHubFileNode } from '~/utils/documents.server'

const getFileIconPath = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  switch (ext) {
    case 'ts':
    case 'tsx':
      return typescriptIconUrl
    case 'js':
    case 'jsx':
      return javascriptIconUrl
    case 'css':
      return cssIconUrl
    case 'html':
      return htmlIconUrl
    case 'json':
      return jsonIconUrl
    case 'svelte':
      return svelteIconUrl
    case 'vue':
      return vueIconUrl
    default:
      return textIconUrl
  }
}

const FileIcon = ({ filename }: { filename: string }) => {
  return (
    <img
      src={getFileIconPath(filename)}
      alt={`${filename} file icon`}
      width={16}
      height={16}
      className="inline-block"
    />
  )
}

const FolderIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="#FFC107"
    xmlns="http://www.w3.org/2000/svg"
    className="inline-block"
  >
    {isOpen ? (
      <path d="M1.5 2h5l1 2h7a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 14.5 14h-13A1.5 1.5 0 0 1 0 12.5v-9A1.5 1.5 0 0 1 1.5 2z" />
    ) : (
      <path d="M.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5H7l-1-2H.5z" />
    )}
  </svg>
)

function getMarginLeft(depth: number) {
  return `${depth * 2 + 12}px`
}

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
  const [sidebarWidth, setSidebarWidth] = React.useState(200)
  const [isResizing, setIsResizing] = React.useState(false)
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

  const startResizeRef = React.useRef({
    startX: 0,
    startWidth: 0,
  })

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

  if (!githubContents) return null

  return (
    <>
      <div
        style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
        className={`flex-shrink-0 overflow-y-auto bg-gradient-to-r from-gray-50 via-gray-50 to-transparent dark:from-gray-800/50 dark:via-gray-800/50 dark:to-transparent lg:pr-2 shadow-sm ${
          isResizing ? '' : 'transition-all duration-300'
        } ${isSidebarOpen ? '' : 'w-0 pr-0'}`}
      >
        {githubContents && isSidebarOpen ? (
          <div className="p-2">
            <RenderFileTree
              currentPath={currentPath}
              expandedFolders={expandedFolders}
              files={githubContents}
              libraryColor={libraryColor}
              prefetchFileContent={prefetchFileContent}
              setCurrentPath={setCurrentPath}
              toggleFolder={toggleFolder}
            />
          </div>
        ) : null}
      </div>
      <div
        className={`w-1 cursor-col-resize hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 dark:active:bg-gray-500 ${
          isResizing ? '' : 'transition-colors'
        } ${isSidebarOpen ? '' : 'hidden'}`}
        onMouseDown={startResize}
      />
    </>
  )
}

const RenderFileTree = (props: {
  files: GitHubFileNode[] | undefined
  libraryColor: string
  toggleFolder: (path: string) => void
  prefetchFileContent: (file: string) => void
  expandedFolders: Set<string>
  currentPath: string | null
  setCurrentPath: (file: string) => void
}) => {
  if (!props.files) return null

  return (
    <ul className="flex flex-col">
      {props.files.map((file) => (
        <li key={file.path} style={{ marginLeft: getMarginLeft(file.depth) }}>
          <button
            onClick={() => {
              if (file.type === 'dir') {
                props.toggleFolder(file.path)
              } else {
                props.setCurrentPath(file.path)
              }
            }}
            onMouseEnter={() =>
              file.type !== 'dir' && props.prefetchFileContent(file.path)
            }
            className={`px-2 py-2 text-left w-full flex items-center gap-2 text-sm rounded transition-colors duration-200 min-w-0 ${
              props.currentPath === file.path
                ? `${props.libraryColor.replace(
                    'bg-',
                    'bg-opacity-20 bg-'
                  )} text-gray-900 dark:text-white shadow-sm`
                : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <span className="flex-shrink-0 select-none">
              {file.type === 'dir' ? (
                <FolderIcon isOpen={props.expandedFolders.has(file.path)} />
              ) : (
                <FileIcon filename={file.name} />
              )}
            </span>
            <span className="truncate select-none">{file.name}</span>
          </button>
          {file.children && props.expandedFolders.has(file.path) && (
            <RenderFileTree {...props} files={file.children} />
          )}
        </li>
      ))}
    </ul>
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
