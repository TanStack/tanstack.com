import React from 'react'
import typescriptIconUrl from '~/images/file-icons/typescript.svg?url'
import javascriptIconUrl from '~/images/file-icons/javascript.svg?url'
import cssIconUrl from '~/images/file-icons/css.svg?url'
import htmlIconUrl from '~/images/file-icons/html.svg?url'
import jsonIconUrl from '~/images/file-icons/json.svg?url'
import svelteIconUrl from '~/images/file-icons/svelte.svg?url'
import vueIconUrl from '~/images/file-icons/vue.svg?url'
import textIconUrl from '~/images/file-icons/txt.svg?url'
import { twMerge } from 'tailwind-merge'
import { ChevronDown, ChevronRight, ImageIcon } from 'lucide-react'

export interface FileTreeNode {
  children?: Array<FileTreeNode>
  name: string
  path: string
  type: 'dir' | 'file'
}

export type FileTreeTone = 'dark' | 'docs' | 'forge'

function getFileIconPath(filename: string) {
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
      return undefined
  }
}

function FileIcon({ filename }: { filename: string }) {
  const iconPath = getFileIconPath(filename)

  if (isImageFile(filename)) {
    return (
      <ImageIcon
        aria-hidden="true"
        className="inline-block h-4 w-4 text-pink-400"
      />
    )
  }

  return (
    <img
      alt={`${filename} file icon`}
      className="inline-block"
      height={16}
      src={iconPath ?? textIconUrl}
      width={16}
    />
  )
}

function isImageFile(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  return (
    ext === 'avif' ||
    ext === 'gif' ||
    ext === 'ico' ||
    ext === 'jpeg' ||
    ext === 'jpg' ||
    ext === 'png' ||
    ext === 'svg' ||
    ext === 'webp'
  )
}

function FolderIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className="inline-block"
      height="16"
      viewBox="0 0 16 16"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      {isOpen ? (
        <>
          <path
            d="M1.5 2h5l1 2h7a1.5 1.5 0 0 1 1.5 1.5V4.5h-14v-2A1.5 1.5 0 0 1 1.5 2z"
            fill="#FFA000"
          />
          <path
            d="M0 5l2 7.5a1 1 0 0 0 1 .5h12a1 1 0 0 0 1-.5l2-7.5H0z"
            fill="#FFCA28"
          />
        </>
      ) : (
        <path
          d="M.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5H7l-1-2H.5z"
          fill="#FFC107"
        />
      )}
    </svg>
  )
}

function getMarginLeft(depth: number, tone: FileTreeTone) {
  return tone === 'forge' ? `${depth * 20 + 4}px` : `${depth * 16 + 4}px`
}

function getGuideLeft(depth: number, tone: FileTreeTone) {
  return tone === 'forge' ? `${depth * 20 - 8}px` : `${depth * 16 - 9}px`
}

function getGuideWidth(tone: FileTreeTone) {
  return tone === 'forge' ? '12px' : '9px'
}

function getGuideClassName(tone: FileTreeTone) {
  if (tone === 'forge') {
    return 'bg-neutral-200 dark:bg-white/10'
  }

  return tone === 'dark'
    ? 'bg-neutral-200 dark:bg-white/10'
    : 'bg-gray-200 dark:bg-gray-700'
}

function fileTreeButtonClassName({
  activeClassName,
  isActive,
  tone,
}: {
  activeClassName?: string
  isActive: boolean
  tone: FileTreeTone
}) {
  const base =
    'flex w-full min-w-0 items-center gap-2 rounded px-2 text-left transition-colors duration-200'

  if (tone === 'forge') {
    const forgeActiveClassName =
      activeClassName ??
      'bg-neutral-100 text-neutral-950 dark:bg-white/[0.075] dark:text-white'

    return twMerge(
      base,
      'h-7 rounded-md text-xs text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-white/[0.055] dark:hover:text-white',
      isActive ? forgeActiveClassName : '',
    )
  }

  return twMerge(
    base,
    'py-1.5',
    tone === 'dark'
      ? 'text-xs text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-neutral-200'
      : 'text-sm text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700',
    isActive
      ? (activeClassName ??
          (tone === 'dark'
            ? 'bg-neutral-200 text-neutral-950 dark:bg-white/10 dark:text-white'
            : 'bg-gray-200 text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'))
      : '',
  )
}

export function buildFileTreeFromPaths(paths: Array<string>) {
  const root: Array<FileTreeNode> = []

  for (const filePath of [...paths].sort()) {
    const pathParts = filePath.split('/').filter(Boolean)

    if (pathParts.length === 0) {
      continue
    }

    let nodes = root
    let currentPath = ''

    for (const [index, part] of pathParts.entries()) {
      const isFile = index === pathParts.length - 1
      currentPath = currentPath ? `${currentPath}/${part}` : part
      let node = nodes.find((candidate) => candidate.path === currentPath)

      if (!node) {
        node = {
          children: isFile ? undefined : [],
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'dir',
        }
        nodes.push(node)
      }

      if (node.type === 'dir') {
        if (!node.children) {
          node.children = []
        }
        nodes = node.children
      }
    }
  }

  return sortFileTreeNodes(root)
}

function sortFileTreeNodes(nodes: Array<FileTreeNode>): Array<FileTreeNode> {
  return nodes
    .map((node) => ({
      ...node,
      children: node.children ? sortFileTreeNodes(node.children) : undefined,
    }))
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === 'dir' ? -1 : 1
      }

      return left.name.localeCompare(right.name)
    })
}

function getAncestorFolders(filePath: string | null) {
  if (!filePath) {
    return new Set<string>()
  }

  const parts = filePath.split('/').filter(Boolean)
  const folders = new Set<string>()

  for (let index = 1; index < parts.length; index += 1) {
    folders.add(parts.slice(0, index).join('/'))
  }

  return folders
}

export function FileTree({
  activeClassName,
  className,
  currentPath,
  forceExpanded = false,
  nodes,
  onSelectFile,
  prefetchFileContent,
  renderSuffix,
  tone = 'docs',
}: {
  activeClassName?: string
  className?: string
  currentPath: string | null
  forceExpanded?: boolean
  nodes: Array<FileTreeNode>
  onSelectFile: (file: string) => void
  prefetchFileContent?: (file: string) => void
  renderSuffix?: (node: FileTreeNode) => React.ReactNode
  tone?: FileTreeTone
}) {
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(
    () => getAncestorFolders(currentPath),
  )

  React.useEffect(() => {
    setExpandedFolders((currentFolders) => {
      const nextFolders = new Set(currentFolders)

      for (const folder of getAncestorFolders(currentPath)) {
        nextFolders.add(folder)
      }

      return nextFolders
    })
  }, [currentPath])

  const toggleFolder = (path: string) => {
    setExpandedFolders((currentFolders) => {
      const nextFolders = new Set(currentFolders)

      if (nextFolders.has(path)) {
        nextFolders.delete(path)
      } else {
        nextFolders.add(path)
      }

      return nextFolders
    })
  }

  return (
    <ul className={twMerge('flex flex-col', className)}>
      {nodes.map((node) => (
        <FileTreeItem
          activeClassName={activeClassName}
          currentPath={currentPath}
          depth={0}
          expandedFolders={expandedFolders}
          forceExpanded={forceExpanded}
          key={node.path}
          node={node}
          onSelectFile={onSelectFile}
          prefetchFileContent={prefetchFileContent}
          renderSuffix={renderSuffix}
          toggleFolder={toggleFolder}
          tone={tone}
        />
      ))}
    </ul>
  )
}

function FileTreeItem({
  activeClassName,
  currentPath,
  depth,
  expandedFolders,
  forceExpanded,
  node,
  onSelectFile,
  prefetchFileContent,
  renderSuffix,
  toggleFolder,
  tone,
}: {
  activeClassName?: string
  currentPath: string | null
  depth: number
  expandedFolders: Set<string>
  forceExpanded: boolean
  node: FileTreeNode
  onSelectFile: (file: string) => void
  prefetchFileContent?: (file: string) => void
  renderSuffix?: (node: FileTreeNode) => React.ReactNode
  toggleFolder: (path: string) => void
  tone: FileTreeTone
}) {
  const pendingPrefetchesRef = React.useRef<Record<string, number>>({})
  const isActive = currentPath === node.path
  const isOpen = forceExpanded || expandedFolders.has(node.path)

  const cancelPrefetch = (path: string) => {
    const timeoutId = pendingPrefetchesRef.current[path]

    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId)
      delete pendingPrefetchesRef.current[path]
    }
  }

  const schedulePrefetch = (path: string) => {
    if (!prefetchFileContent) {
      return
    }

    cancelPrefetch(path)

    pendingPrefetchesRef.current[path] = window.setTimeout(() => {
      delete pendingPrefetchesRef.current[path]
      prefetchFileContent(path)
    }, 180)
  }

  React.useEffect(() => {
    const pendingPrefetches = pendingPrefetchesRef.current

    return () => {
      for (const timeoutId of Object.values(pendingPrefetches)) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [])

  return (
    <li className="relative">
      {depth > 0 ? (
        <>
          <div
            className={twMerge('absolute w-px', getGuideClassName(tone))}
            style={{
              bottom: 0,
              left: getGuideLeft(depth, tone),
              top: 0,
            }}
          />
          {tone === 'forge' ? null : (
            <div
              className={twMerge('absolute h-px', getGuideClassName(tone))}
              style={{
                left: getGuideLeft(depth, tone),
                top: '50%',
                width: getGuideWidth(tone),
              }}
            />
          )}
        </>
      ) : null}
      <div style={{ paddingLeft: getMarginLeft(depth, tone) }}>
        <button
          aria-expanded={node.type === 'dir' ? isOpen : undefined}
          className={fileTreeButtonClassName({
            activeClassName,
            isActive,
            tone,
          })}
          onBlur={() => cancelPrefetch(node.path)}
          onClick={() => {
            cancelPrefetch(node.path)

            if (node.type === 'dir') {
              toggleFolder(node.path)
            } else {
              onSelectFile(node.path)
            }
          }}
          onFocus={() => {
            if (node.type !== 'dir') {
              schedulePrefetch(node.path)
            }
          }}
          onMouseEnter={() => {
            if (node.type !== 'dir') {
              schedulePrefetch(node.path)
            }
          }}
          onMouseLeave={() => cancelPrefetch(node.path)}
          type="button"
        >
          <span
            className={twMerge(
              'shrink-0 select-none',
              tone === 'forge'
                ? 'flex h-4 w-4 items-center justify-center text-neutral-500'
                : '',
            )}
          >
            {tone === 'forge' && node.type === 'dir' ? (
              isOpen ? (
                <ChevronDown aria-hidden="true" className="h-4 w-4" />
              ) : (
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              )
            ) : node.type === 'dir' ? (
              <FolderIcon isOpen={isOpen} />
            ) : (
              <FileIcon filename={node.name} />
            )}
          </span>
          <span
            className={twMerge(
              'min-w-0 flex-1 truncate select-none',
              tone === 'dark' ? 'font-mono' : '',
              tone === 'forge' && node.type === 'dir' ? 'font-medium' : '',
            )}
          >
            {node.name}
          </span>
          {renderSuffix ? renderSuffix(node) : null}
        </button>
      </div>
      {node.children && isOpen
        ? node.children.map((child) => (
            <FileTreeItem
              activeClassName={activeClassName}
              currentPath={currentPath}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              forceExpanded={forceExpanded}
              key={child.path}
              node={child}
              onSelectFile={onSelectFile}
              prefetchFileContent={prefetchFileContent}
              renderSuffix={renderSuffix}
              toggleFolder={toggleFolder}
              tone={tone}
            />
          ))
        : null}
    </li>
  )
}
