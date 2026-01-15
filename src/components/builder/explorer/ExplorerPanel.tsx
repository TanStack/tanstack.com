/**
 * ExplorerPanel - Right panel with file tree, code viewer, and preview tabs
 */

import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { FileExplorer } from '~/components/FileExplorer'
import { CodeViewer } from './CodeViewer'
import { LivePreview } from '../preview/LivePreview'
import { Terminal } from '../preview/Terminal'
import { useDryRun } from '@tanstack/cta-ui-base/dist/store/project'
import { usePreviewContext } from '../BuilderProvider'
import type { ExplorerTab } from '../types'

type ExplorerPanelProps = {
  isMobileConfigOpen: boolean
  onToggleMobileConfig: () => void
}

// Convert flat files to GitHubFileNode tree structure
type FileNode = {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: FileNode[]
  depth: number
}

function filesToGitHubTree(files: Record<string, string>): FileNode[] {
  const root: FileNode[] = []
  const paths = Object.keys(files).sort()

  for (const filePath of paths) {
    const normalizedPath = filePath.replace(/^\.\//, '')
    const parts = normalizedPath.split('/')
    let currentLevel = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      const currentPath = parts.slice(0, i + 1).join('/')

      let existing = currentLevel.find((n) => n.name === part)

      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'dir',
          depth: i,
          children: isFile ? undefined : [],
        }
        currentLevel.push(existing)
      }

      if (!isFile && existing.children) {
        currentLevel = existing.children
      }
    }
  }

  // Sort: directories first, then alphabetically
  const sortNodes = (nodes: FileNode[]): FileNode[] => {
    return nodes
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'dir' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
      .map((node) => ({
        ...node,
        children: node.children ? sortNodes(node.children) : undefined,
      }))
  }

  return sortNodes(root)
}

export function ExplorerPanel({
  isMobileConfigOpen,
  onToggleMobileConfig,
}: ExplorerPanelProps) {
  const navigate = useNavigate({ from: '/builder' })
  const search = useSearch({ from: '/builder' })
  const { canPreview, previewActivated, activatePreview } = usePreviewContext()

  // Force files tab if preview is disabled or not activated
  const activeTab =
    canPreview && previewActivated ? (search.tab ?? 'files') : 'files'

  const handlePreviewClick = () => {
    if (!previewActivated) {
      activatePreview()
    }
    setActiveTab('preview')
  }
  const selectedFile = search.file ?? null
  const isTerminalOpen = search.terminal ?? true

  const setActiveTab = (tab: ExplorerTab) => {
    navigate({ to: '.', search: { ...search, tab }, replace: true })
  }

  const setSelectedFile = (file: string | null) => {
    navigate({
      to: '.',
      search: { ...search, file: file ?? undefined },
      replace: true,
    })
  }

  const setIsTerminalOpen = (open: boolean | ((prev: boolean) => boolean)) => {
    const newValue = typeof open === 'function' ? open(isTerminalOpen) : open
    navigate({
      to: '.',
      search: { ...search, terminal: newValue },
      replace: true,
    })
  }

  const dryRun = useDryRun()
  const files = React.useMemo(
    () => (dryRun?.files ?? {}) as Record<string, string>,
    [dryRun?.files],
  )

  // Convert flat files to tree structure for FileExplorer
  const fileTree = React.useMemo(() => filesToGitHubTree(files), [files])

  // Auto-select first file if none selected
  React.useEffect(() => {
    if (!selectedFile && Object.keys(files).length > 0) {
      const fileKeys = Object.keys(files)
      const preferredFiles = [
        'src/routes/index.tsx',
        'src/routes/__root.tsx',
        'src/app.tsx',
        'src/main.tsx',
        'package.json',
      ]

      for (const preferred of preferredFiles) {
        const match = fileKeys.find(
          (k) =>
            k.endsWith(preferred) || k === `./${preferred}` || k === preferred,
        )
        if (match) {
          // Store without ./ prefix to match tree paths
          setSelectedFile(match.replace(/^\.\//, ''))
          return
        }
      }

      // Fallback to first file
      setSelectedFile(fileKeys[0].replace(/^\.\//, ''))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setSelectedFile is stable from useState
  }, [files, selectedFile])

  // Try to find file content - files may have ./ prefix or not
  const selectedFileContent = selectedFile
    ? (files[selectedFile] ?? files[`./${selectedFile}`] ?? null)
    : null

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        {/* Mobile config toggle */}
        <button
          type="button"
          onClick={onToggleMobileConfig}
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label={isMobileConfigOpen ? 'Show preview' : 'Show config'}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isMobileConfigOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            )}
          </svg>
        </button>

        <TabButton
          label="Files"
          isActive={activeTab === 'files'}
          onClick={() => setActiveTab('files')}
        />
        {canPreview && (
          <TabButton
            label="Preview"
            isActive={activeTab === 'preview'}
            onClick={handlePreviewClick}
          />
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Terminal toggle - only show when preview is activated */}
        {canPreview && previewActivated && (
          <button
            type="button"
            onClick={() => setIsTerminalOpen((p) => !p)}
            className={twMerge(
              'px-3 py-2 text-xs font-medium transition-colors',
              isTerminalOpen
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
            )}
          >
            Terminal
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'files' ? (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* File tree sidebar using existing FileExplorer */}
            <FileExplorer
              currentPath={selectedFile}
              githubContents={fileTree as any}
              isSidebarOpen={true}
              libraryColor="bg-blue-500"
              prefetchFileContent={() => {}}
              setCurrentPath={setSelectedFile}
            />

            {/* Code viewer */}
            <div className="flex-1 min-w-0 min-h-0 overflow-auto">
              <CodeViewer
                filePath={selectedFile}
                content={selectedFileContent}
              />
            </div>
          </div>
        ) : canPreview && previewActivated ? (
          <div className="flex-1 overflow-hidden">
            <LivePreview />
          </div>
        ) : null}

        {/* Terminal panel - only show when preview is activated */}
        {canPreview && previewActivated && isTerminalOpen && (
          <Terminal onClose={() => setIsTerminalOpen(false)} />
        )}
      </div>
    </div>
  )
}

type TabButtonProps = {
  label: string
  isActive: boolean
  onClick: () => void
}

function TabButton({ label, isActive, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={twMerge(
        'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
        isActive
          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
      )}
    >
      {label}
    </button>
  )
}
