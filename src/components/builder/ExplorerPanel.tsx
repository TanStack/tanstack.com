/**
 * Explorer Panel (v2)
 *
 * Right panel showing generated files and code viewer.
 * Uses the existing CodeBlock component for syntax highlighting.
 * Includes "Addons" tab for viewing per-feature file artifacts.
 */

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { createHighlighter, type HighlighterGeneric } from 'shiki'
import { Code, Play } from 'lucide-react'
import {
  useCompiledOutput,
  useIsCompiling,
  useCompileError,
  useFeatures,
  useBuilderStore,
} from './store'
import { partners } from '~/utils/partners'
import { PreviewPanel } from './webcontainer'
import type { FeatureId, AttributedCompileOutput } from '~/builder/api'

// Lazy highlighter singleton for syntax highlighting
let highlighterPromise: Promise<HighlighterGeneric<any, any>> | null = null

async function getShikiHighlighter(): Promise<HighlighterGeneric<any, any>> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'vitesse-dark'],
      langs: [
        'typescript',
        'javascript',
        'tsx',
        'jsx',
        'bash',
        'json',
        'html',
        'css',
        'markdown',
        'plaintext',
        'toml',
        'yaml',
      ],
    })
  }
  return highlighterPromise
}

// Build a map of partner scores by partnerId
const partnerScores = new Map(
  partners.filter((p) => p.score !== undefined).map((p) => [p.id, p.score]),
)

// Helper types derived from AttributedCompileOutput
type AttributedFiles = NonNullable<AttributedCompileOutput['attributedFiles']>
type AttributedFile = AttributedFiles[string]
type LineAttribution = AttributedFile['attributions'][number]

// File icons
import typescriptIconUrl from '~/images/file-icons/typescript.svg?url'
import javascriptIconUrl from '~/images/file-icons/javascript.svg?url'
import cssIconUrl from '~/images/file-icons/css.svg?url'
import htmlIconUrl from '~/images/file-icons/html.svg?url'
import jsonIconUrl from '~/images/file-icons/json.svg?url'
import textIconUrl from '~/images/file-icons/txt.svg?url'

interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: Array<FileTreeNode>
}

// Image file extensions and their MIME types
const IMAGE_EXTENSIONS: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
}

function isImageFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ext in IMAGE_EXTENSIONS
}

function getImageMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return IMAGE_EXTENSIONS[ext] || 'image/png'
}

function isBinaryContent(content: string): boolean {
  return content.startsWith('base64::')
}

function getBinaryDataUrl(content: string, mimeType: string): string {
  // Content format: "base64::<data>"
  const base64Data = content.slice(8) // Remove "base64::" prefix
  return `data:${mimeType};base64,${base64Data}`
}

function getFileIconPath(filename: string): string {
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
    default:
      return textIconUrl
  }
}

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  switch (ext) {
    case 'ts':
      return 'typescript'
    case 'tsx':
      return 'tsx'
    case 'js':
      return 'javascript'
    case 'jsx':
      return 'jsx'
    case 'css':
      return 'css'
    case 'html':
      return 'html'
    case 'json':
      return 'json'
    case 'md':
      return 'markdown'
    case 'toml':
      return 'toml'
    case 'yaml':
    case 'yml':
      return 'yaml'
    default:
      return 'plaintext'
  }
}

type FeatureArtifact = {
  files: Record<string, string>
  injections: Record<
    string,
    { content: string; highlightedLines: Array<number> }
  >
  packages: {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
}

export function ExplorerPanel() {
  const features = useFeatures()
  const toggleFeature = useBuilderStore((s) => s.toggleFeature)
  const getFeatureInfo = useBuilderStore((s) => s.getFeatureInfo)
  const availableFeatures = useBuilderStore((s) => s.availableFeatures)

  // Sort features: partners first by score, then non-partners
  const sortedFeatures = useMemo(() => {
    return [...features].sort((a, b) => {
      const infoA = availableFeatures.find((f) => f.id === a)
      const infoB = availableFeatures.find((f) => f.id === b)
      const scoreA = infoA?.partnerId
        ? (partnerScores.get(infoA.partnerId) ?? 0)
        : -1
      const scoreB = infoB?.partnerId
        ? (partnerScores.get(infoB.partnerId) ?? 0)
        : -1
      return scoreB - scoreA
    })
  }, [features, availableFeatures])
  const projectName = useBuilderStore((s) => s.projectName)
  const featureOptions = useBuilderStore((s) => s.featureOptions)
  const tailwind = useBuilderStore((s) => s.tailwind)
  const customIntegrations = useBuilderStore((s) => s.customIntegrations)
  const compiledOutput = useCompiledOutput()
  const isCompiling = useIsCompiling()
  const compileError = useCompileError()
  const navigate = useNavigate()
  const search = useSearch({ from: '/builder/' })

  // URL state: addon can be a featureId or undefined for all files
  const urlSelectedAddon = (search.addon as string) || null
  const urlSelectedFile = (search.file as string) || null

  // Fetch artifacts state for per-addon view
  const [featureArtifacts, setFeatureArtifacts] = useState<
    Record<string, FeatureArtifact>
  >({})
  const [artifactsLoading, setArtifactsLoading] = useState(false)

  // Track user-toggled paths
  const [userExpandedPaths, setUserExpandedPaths] = useState<Set<string>>(
    () => new Set(),
  )
  const [userCollapsedPaths, setUserCollapsedPaths] = useState<Set<string>>(
    () => new Set(),
  )

  // File search filter
  const [fileSearch, setFileSearch] = useState('')

  // View mode from URL: 'code' for file viewer, 'preview' for live preview
  const urlTab = (search.tab as string) || 'code'
  const viewMode = urlTab === 'preview' ? 'preview' : 'code'

  const setViewMode = useCallback(
    (mode: 'code' | 'preview') => {
      navigate({
        to: '/builder',
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          tab: mode === 'code' ? undefined : mode,
        }),
        replace: true,
      })
    },
    [navigate],
  )

  // Fetch artifacts for all selected features
  useEffect(() => {
    if (features.length === 0) {
      setFeatureArtifacts({})
      return
    }

    const fetchArtifacts = async () => {
      setArtifactsLoading(true)
      try {
        const response = await fetch('/api/builder/feature-artifacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            features,
            projectName,
            featureOptions,
            tailwind,
            customIntegrations,
          }),
        })
        if (response.ok) {
          const data = await response.json()
          setFeatureArtifacts(data.artifacts || {})
        }
      } catch (error) {
        console.error('Failed to fetch feature artifacts:', error)
      } finally {
        setArtifactsLoading(false)
      }
    }

    fetchArtifacts()
  }, [features, projectName, featureOptions, tailwind, customIntegrations])

  // Derive selected addon - use URL if valid, otherwise null (all files)
  const selectedAddon = useMemo(() => {
    if (urlSelectedAddon && features.includes(urlSelectedAddon as FeatureId)) {
      return urlSelectedAddon
    }
    return null
  }, [urlSelectedAddon, features])

  const isAllFilesMode = selectedAddon === null

  // All files from compiled output - memoized to avoid dependency issues
  const allFiles = useMemo(
    () => compiledOutput?.files || {},
    [compiledOutput?.files],
  )
  const allFileList = useMemo(() => Object.keys(allFiles), [allFiles])

  // For single addon mode, get that addon's artifacts
  const currentArtifacts = selectedAddon
    ? featureArtifacts[selectedAddon]
    : null
  // Memoize to avoid dependency issues in useMemo hooks
  const currentFiles = useMemo(
    () => currentArtifacts?.files || {},
    [currentArtifacts?.files],
  )
  const currentInjections = useMemo(
    () => currentArtifacts?.injections || {},
    [currentArtifacts?.injections],
  )
  const currentPackages = currentArtifacts?.packages || {}

  // Merge files and injections for single addon view
  const addonFilePaths = useMemo(() => {
    const paths = new Map<
      string,
      {
        content: string
        highlightedLines?: Array<number>
        addedLineCount: number
        isNewFile: boolean
      }
    >()
    for (const [path, content] of Object.entries(currentFiles)) {
      paths.set(path, {
        content,
        addedLineCount: content.split('\n').length,
        isNewFile: true,
      })
    }
    for (const [path, data] of Object.entries(currentInjections)) {
      paths.set(path, {
        content: data.content,
        highlightedLines: data.highlightedLines,
        addedLineCount: data.highlightedLines?.length || 0,
        isNewFile: false,
      })
    }
    return paths
  }, [currentFiles, currentInjections])

  const addonFileList = useMemo(
    () => [...addonFilePaths.keys()],
    [addonFilePaths],
  )

  // Current file list depends on mode
  const baseFileList = isAllFilesMode ? allFileList : addonFileList

  // Filter file list by search
  const currentFileList = useMemo(() => {
    if (!fileSearch.trim()) return baseFileList
    const query = fileSearch.toLowerCase()
    return baseFileList.filter((path) => path.toLowerCase().includes(query))
  }, [baseFileList, fileSearch])

  // Derive selected file - use URL if valid, otherwise pick a default
  const selectedFile = useMemo(() => {
    if (urlSelectedFile && currentFileList.includes(urlSelectedFile)) {
      return urlSelectedFile
    }
    const preferred = [
      'src/routes/__root.tsx',
      'src/routes/index.tsx',
      'package.json',
      'vite.config.ts',
    ]
    return (
      preferred.find((p) => currentFileList.includes(p)) ||
      currentFileList[0] ||
      null
    )
  }, [urlSelectedFile, currentFileList])

  // Sync derived values back to URL if different
  useEffect(() => {
    const updates: Record<string, unknown> = {}
    if (selectedAddon !== urlSelectedAddon) {
      updates.addon = selectedAddon || undefined
    }
    if (selectedFile && selectedFile !== urlSelectedFile) {
      updates.file = selectedFile
    }
    if (Object.keys(updates).length > 0) {
      navigate({
        to: '/builder',
        search: (prev: Record<string, unknown>) => ({ ...prev, ...updates }),
        replace: true,
      })
    }
  }, [selectedAddon, urlSelectedAddon, selectedFile, urlSelectedFile, navigate])

  // File tree
  const fileTree = useMemo(() => {
    const filesObj: Record<string, string> = {}
    for (const path of currentFileList) filesObj[path] = ''
    return filesToTree(filesObj)
  }, [currentFileList])

  // File status - tracks which files have added lines
  const fileStatus = useMemo(() => {
    const status = new Set<string>()

    if (isAllFilesMode) {
      // In all files mode, compute from attributions
      const attributedFiles = compiledOutput?.attributedFiles
      if (!attributedFiles) return status

      for (const path of Object.keys(attributedFiles)) {
        const file = attributedFiles[path]
        const attributions = file.attributions
        if (!attributions || attributions.length === 0) continue
        const hasFeature = attributions.some(
          (a: LineAttribution) => a.featureId !== 'base',
        )
        if (hasFeature) {
          status.add(path)
        }
      }
    } else {
      // Single addon mode - all files in the addon have added lines
      for (const path of addonFilePaths.keys()) {
        status.add(path)
      }
    }

    // Mark directories that contain files with added lines
    for (const path of [...status]) {
      const parts = path.split('/')
      for (let i = 1; i < parts.length; i++) {
        status.add(parts.slice(0, i).join('/'))
      }
    }

    return status
  }, [isAllFilesMode, compiledOutput?.attributedFiles, addonFilePaths])

  // Line counts for files (only count added lines)
  const fileLineCounts = useMemo(() => {
    const counts = new Map<string, number>()
    if (isAllFilesMode) {
      // In all files mode, count lines attributed to non-base features
      const attributedFiles = compiledOutput?.attributedFiles
      if (attributedFiles) {
        for (const path of Object.keys(attributedFiles)) {
          const file = attributedFiles[path]
          const attributions = file.attributions
          if (!attributions || attributions.length === 0) continue
          const featureLines = attributions.filter(
            (a: LineAttribution) => a.featureId !== 'base',
          ).length
          if (featureLines > 0) {
            counts.set(path, featureLines)
          }
        }
      }
    } else {
      // In single addon mode, use pre-computed addedLineCount
      for (const [path, data] of addonFilePaths) {
        if (data.addedLineCount > 0) {
          counts.set(path, data.addedLineCount)
        }
      }
    }
    return counts
  }, [isAllFilesMode, compiledOutput?.attributedFiles, addonFilePaths])

  // Track which files are entirely new (vs injections into existing files)
  const newFiles = useMemo(() => {
    const files = new Set<string>()
    if (isAllFilesMode) {
      // In all files mode, a file is "new" if it has NO base lines
      const attributedFiles = compiledOutput?.attributedFiles
      if (attributedFiles) {
        for (const [path, fileData] of Object.entries(attributedFiles)) {
          const hasBaseLines = fileData.attributions?.some(
            (a) => a.featureId === 'base',
          )
          if (!hasBaseLines && fileData.attributions?.length) {
            files.add(path)
          }
        }
      }
    } else {
      for (const [path, data] of addonFilePaths) {
        if (data.isNewFile) {
          files.add(path)
        }
      }
    }
    return files
  }, [isAllFilesMode, addonFilePaths, compiledOutput?.attributedFiles])

  // Total lines added across all files (for "All Files" display)
  const allFilesTotalAddedLines = useMemo(() => {
    let addedLines = 0
    const attributedFiles = compiledOutput?.attributedFiles
    if (!attributedFiles) return addedLines

    for (const path of Object.keys(attributedFiles)) {
      const file = attributedFiles[path]
      const attributions = file.attributions
      if (!attributions || attributions.length === 0) continue

      const featureLines = attributions.filter(
        (a: LineAttribution) => a.featureId !== 'base',
      ).length

      addedLines += featureLines
    }

    return addedLines
  }, [compiledOutput?.attributedFiles])

  // Default expanded paths - all directories
  const defaultExpandedPaths = useMemo(() => {
    const paths = new Set<string>()
    for (const filePath of currentFileList) {
      const parts = filePath.split('/')
      // Add all parent directories
      for (let i = 1; i < parts.length; i++) {
        paths.add(parts.slice(0, i).join('/'))
      }
    }
    return paths
  }, [currentFileList])

  // Expanded paths = (defaults + user-expanded) - user-collapsed
  const expandedPaths = useMemo(() => {
    const paths = new Set(defaultExpandedPaths)
    for (const p of userExpandedPaths) paths.add(p)
    for (const p of userCollapsedPaths) paths.delete(p)
    return paths
  }, [defaultExpandedPaths, userExpandedPaths, userCollapsedPaths])

  const handleToggleExpanded = useCallback(
    (path: string) => {
      const isCurrentlyExpanded = expandedPaths.has(path)
      if (isCurrentlyExpanded) {
        // Collapse: remove from user-expanded, add to user-collapsed
        setUserExpandedPaths((prev) => {
          const next = new Set(prev)
          next.delete(path)
          return next
        })
        setUserCollapsedPaths((prev) => new Set(prev).add(path))
      } else {
        // Expand: add to user-expanded, remove from user-collapsed
        setUserCollapsedPaths((prev) => {
          const next = new Set(prev)
          next.delete(path)
          return next
        })
        setUserExpandedPaths((prev) => new Set(prev).add(path))
      }
    },
    [expandedPaths],
  )

  // Navigation callbacks
  const setSelectedAddon = useCallback(
    (addon: string | null) => {
      // Reset expanded/collapsed when switching addons
      setUserExpandedPaths(new Set())
      setUserCollapsedPaths(new Set())
      navigate({
        to: '/builder',
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          addon: addon || undefined,
          file: undefined,
        }),
        replace: true,
      })
    },
    [navigate],
  )

  const setSelectedFile = useCallback(
    (file: string | null) => {
      navigate({
        to: '/builder',
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          file: file || undefined,
        }),
        replace: true,
      })
    },
    [navigate],
  )

  // Get file content and attributions
  const selectedFileContent = useMemo(() => {
    if (!selectedFile) return null
    if (isAllFilesMode) {
      return allFiles[selectedFile] || null
    }
    const data = addonFilePaths.get(selectedFile)
    return data?.content || null
  }, [selectedFile, isAllFilesMode, allFiles, addonFilePaths])

  const selectedFileHighlights = useMemo(() => {
    if (!selectedFile || isAllFilesMode) return undefined
    return addonFilePaths.get(selectedFile)?.highlightedLines
  }, [selectedFile, isAllFilesMode, addonFilePaths])

  const selectedFileAttributions = useMemo(() => {
    if (!selectedFile || !isAllFilesMode) return undefined
    return compiledOutput?.attributedFiles?.[selectedFile]?.attributions
  }, [selectedFile, isAllFilesMode, compiledOutput?.attributedFiles])

  // Loading/error states
  if (isCompiling) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-cyan-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Compiling...
          </p>
        </div>
      </div>
    )
  }

  if (compileError) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-900 p-4">
        <div className="text-center max-w-md">
          <div className="text-red-600 dark:text-red-400 text-lg mb-2">
            Compilation Error
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {compileError}
          </p>
        </div>
      </div>
    )
  }

  if (!compiledOutput) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p className="mb-2">No output yet</p>
          <p className="text-sm">Select features to generate a project</p>
        </div>
      </div>
    )
  }

  // Addon item renderer (used in both layouts)
  const renderAddonItem = (featureId: FeatureId) => {
    const info = getFeatureInfo(featureId)
    const artifacts = featureArtifacts[featureId]

    // Count added lines: new files + highlighted lines in injections
    let addedLines = 0
    if (artifacts) {
      for (const content of Object.values(artifacts.files)) {
        addedLines += content.split('\n').length
      }
      for (const injection of Object.values(artifacts.injections)) {
        addedLines += injection.highlightedLines?.length || 0
      }
    }

    const featureColor = info?.color ?? '#6b7280'
    const isSelected = selectedAddon === featureId

    return (
      <button
        key={featureId}
        onClick={() => setSelectedAddon(featureId)}
        className={twMerge(
          'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors',
          isSelected
            ? 'text-gray-900 dark:text-gray-100'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
        )}
        style={
          isSelected ? { backgroundColor: `${featureColor}20` } : undefined
        }
      >
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: featureColor }}
        />
        <div className="flex-1 min-w-0 text-xs font-medium truncate">
          {info?.name || featureId}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {addedLines > 0 && (
            <span className="text-[10px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              +{addedLines}
            </span>
          )}
          {/* Remove button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              toggleFeature(featureId)
            }}
            className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            title={`Remove ${info?.name || featureId}`}
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </button>
    )
  }

  // File tree content renderer
  const renderFileTree = () => (
    <>
      {/* File search */}
      <div className="pb-2">
        <input
          type="text"
          value={fileSearch}
          onChange={(e) => setFileSearch(e.target.value)}
          placeholder="Filter files..."
          className="w-full px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-cyan-500"
        />
      </div>

      {artifactsLoading && !isAllFilesMode ? (
        <div className="text-center text-gray-400 dark:text-gray-500 text-xs py-4">
          Loading...
        </div>
      ) : fileTree.length > 0 ? (
        <FileTree
          nodes={fileTree}
          selectedPath={selectedFile}
          onSelect={setSelectedFile}
          expandedPaths={expandedPaths}
          onToggleExpanded={handleToggleExpanded}
          fileStatus={fileStatus}
          fileLineCounts={fileLineCounts}
          newFiles={newFiles}
        />
      ) : (
        <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-4">
          {fileSearch
            ? 'No matching files'
            : isAllFilesMode
              ? 'No files yet'
              : 'No changes'}
        </div>
      )}

      {/* Package contributions (only in single addon mode) */}
      {!isAllFilesMode &&
        (Object.keys(currentPackages.dependencies || {}).length > 0 ||
          Object.keys(currentPackages.devDependencies || {}).length > 0) && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Dependencies
            </div>
            {Object.entries(currentPackages.dependencies || {}).map(
              ([pkg, version]) => (
                <div
                  key={pkg}
                  className="text-xs text-gray-600 dark:text-gray-400 py-0.5 font-mono"
                >
                  {pkg}@{version}
                </div>
              ),
            )}
            {Object.entries(currentPackages.devDependencies || {}).map(
              ([pkg, version]) => (
                <div
                  key={pkg}
                  className="text-xs text-gray-500 dark:text-gray-500 py-0.5 font-mono"
                >
                  {pkg}@{version} (dev)
                </div>
              ),
            )}
          </div>
        )}
    </>
  )

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900">
      {/* Tab bar */}
      <div className="shrink-0 flex items-center gap-1 px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <button
          type="button"
          onClick={() => setViewMode('code')}
          className={twMerge(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            viewMode === 'code'
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200',
          )}
        >
          <Code className="w-4 h-4" />
          Code
        </button>
        <button
          type="button"
          onClick={() => setViewMode('preview')}
          className={twMerge(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            viewMode === 'preview'
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200',
          )}
        >
          <Play className="w-4 h-4" />
          Preview
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {viewMode === 'preview' ? (
          /* Full-width preview */
          <div className="flex-1 min-w-0 h-full">
            <PreviewPanel files={compiledOutput?.files || null} />
          </div>
        ) : (
          <>
            {/* Left sidebar with addons + file tree */}
            <div className="w-64 shrink-0 border-r border-gray-200 dark:border-gray-800 overflow-auto bg-gray-50 dark:bg-gray-900/50">
              {/* Addon selector */}
              <div className="p-2">
                {/* All Files option */}
                <button
                  onClick={() => setSelectedAddon(null)}
                  className={twMerge(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors',
                    isAllFilesMode
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
                  )}
                >
                  <div className="w-3 h-3 rounded-sm shrink-0 bg-gray-400 dark:bg-gray-500" />
                  <div className="flex-1 min-w-0 text-xs font-medium">
                    All Files
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {allFilesTotalAddedLines > 0 ? (
                      <span className="text-[10px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        +{allFilesTotalAddedLines}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        {allFileList.length}
                      </span>
                    )}
                  </div>
                </button>

                {/* Divider */}
                {sortedFeatures.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
                )}

                {/* Selected addons */}
                {sortedFeatures.length > 0 ? (
                  <div className="space-y-1">
                    {sortedFeatures.map(renderAddonItem)}
                  </div>
                ) : (
                  <div className="text-center text-gray-400 dark:text-gray-500 text-xs py-4">
                    No integrations selected
                  </div>
                )}
              </div>

              {/* File tree - stacked below addons */}
              <div className="border-t border-gray-200 dark:border-gray-800">
                <div className="p-2">{renderFileTree()}</div>
              </div>
            </div>

            {/* Code/Image viewer */}
            <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
              {selectedFileContent ? (
                isImageFile(selectedFile || '') &&
                isBinaryContent(selectedFileContent) ? (
                  <ImageViewer
                    filename={selectedFile || ''}
                    content={selectedFileContent}
                  />
                ) : (
                  <CodeViewer
                    filename={selectedFile || ''}
                    content={selectedFileContent}
                    attributions={selectedFileAttributions}
                    showAttributions={isAllFilesMode}
                    highlightedLines={selectedFileHighlights}
                  />
                )
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                  Select a file to view
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer with stats (only show in code mode) */}
      {viewMode === 'code' && (
        <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50">
          <span>{allFileList.length} files</span>
          {compiledOutput.warnings.length > 0 && (
            <span className="ml-4 text-yellow-600 dark:text-yellow-500">
              {compiledOutput.warnings.length} warnings
            </span>
          )}
        </div>
      )}
    </div>
  )
}

interface FileTreeProps {
  nodes: Array<FileTreeNode>
  selectedPath: string | null
  onSelect: (path: string) => void
  depth?: number
  expandedPaths: Set<string>
  onToggleExpanded: (path: string) => void
  fileStatus?: Set<string>
  fileLineCounts?: Map<string, number>
  newFiles?: Set<string>
}

function FileTree({
  nodes,
  selectedPath,
  onSelect,
  depth = 0,
  expandedPaths,
  onToggleExpanded,
  fileStatus,
  fileLineCounts,
  newFiles,
}: FileTreeProps) {
  return (
    <ul className="flex flex-col">
      {nodes.map((node) => (
        <FileTreeItem
          key={node.path}
          node={node}
          selectedPath={selectedPath}
          onSelect={onSelect}
          depth={depth}
          expandedPaths={expandedPaths}
          onToggleExpanded={onToggleExpanded}
          fileStatus={fileStatus}
          fileLineCounts={fileLineCounts}
          newFiles={newFiles}
        />
      ))}
    </ul>
  )
}

interface FileTreeItemProps {
  node: FileTreeNode
  selectedPath: string | null
  onSelect: (path: string) => void
  depth: number
  expandedPaths: Set<string>
  onToggleExpanded: (path: string) => void
  fileStatus?: Set<string>
  fileLineCounts?: Map<string, number>
  newFiles?: Set<string>
}

function FileTreeItem({
  node,
  selectedPath,
  onSelect,
  depth,
  expandedPaths,
  onToggleExpanded,
  fileStatus,
  fileLineCounts,
  newFiles,
}: FileTreeItemProps) {
  const expanded = expandedPaths.has(node.path)
  const isSelected = node.path === selectedPath
  const hasAddedLines = fileStatus?.has(node.path)
  const lineCount = fileLineCounts?.get(node.path)
  const isNewFile = newFiles?.has(node.path)

  if (node.type === 'directory') {
    return (
      <li className="relative">
        {/* Tree lines */}
        {depth > 0 && (
          <>
            <div
              className="absolute w-px bg-gray-200 dark:bg-gray-700"
              style={{
                left: `${depth * 16 - 9}px`,
                top: 0,
                bottom: 0,
              }}
            />
            <div
              className="absolute h-px bg-gray-200 dark:bg-gray-700"
              style={{
                left: `${depth * 16 - 9}px`,
                width: '9px',
                top: '50%',
              }}
            />
          </>
        )}
        <button
          onClick={() => onToggleExpanded(node.path)}
          className="w-full flex items-center gap-2 px-2 py-1 text-[13px] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
        >
          <FolderIcon isOpen={expanded} />
          <span className="truncate flex-1 text-left">{node.name}</span>
          {!expanded && hasAddedLines && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/30 shrink-0" />
          )}
        </button>
        {expanded && node.children && (
          <FileTree
            nodes={node.children}
            selectedPath={selectedPath}
            onSelect={onSelect}
            depth={depth + 1}
            expandedPaths={expandedPaths}
            onToggleExpanded={onToggleExpanded}
            fileStatus={fileStatus}
            fileLineCounts={fileLineCounts}
            newFiles={newFiles}
          />
        )}
      </li>
    )
  }

  return (
    <li className="relative">
      {/* Tree lines */}
      {depth > 0 && (
        <>
          <div
            className="absolute w-px bg-gray-200 dark:bg-gray-700"
            style={{
              left: `${depth * 16 - 9}px`,
              top: 0,
              bottom: 0,
            }}
          />
          <div
            className="absolute h-px bg-gray-200 dark:bg-gray-700"
            style={{
              left: `${depth * 16 - 9}px`,
              width: '9px',
              top: '50%',
            }}
          />
        </>
      )}
      <button
        onClick={() => onSelect(node.path)}
        className={twMerge(
          'w-full flex items-center gap-2 px-2 py-1 text-[13px] rounded transition-colors',
          isSelected
            ? 'bg-blue-100 dark:bg-cyan-900/30 text-gray-900 dark:text-white'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        <img
          src={getFileIconPath(node.name)}
          alt=""
          width={14}
          height={14}
          className="shrink-0"
        />
        <span
          className={twMerge(
            'truncate flex-1 text-left',
            isNewFile && 'text-emerald-600 dark:text-emerald-400 font-medium',
          )}
        >
          {node.name}
        </span>
        {lineCount !== undefined && hasAddedLines && (
          <span className="text-[10px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            +{lineCount}
          </span>
        )}
      </button>
    </li>
  )
}

interface ImageViewerProps {
  filename: string
  content: string
}

function ImageViewer({ filename, content }: ImageViewerProps) {
  const mimeType = getImageMimeType(filename)
  const dataUrl = getBinaryDataUrl(content, mimeType)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Filename header */}
      <div className="shrink-0 px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
          {filename}
        </span>
      </div>

      {/* Image display */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-8 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZjBmMGYwIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMGYwZjAiLz48cmVjdCB4PSIxMCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZmZmIi8+PHJlY3QgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==')] dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMjgyODI4Ii8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMyODI4MjgiLz48cmVjdCB4PSIxMCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMWYxZjFmIi8+PHJlY3QgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzFmMWYxZiIvPjwvc3ZnPg==')]">
        <img
          src={dataUrl}
          alt={filename}
          className="max-w-full max-h-full object-contain shadow-lg rounded"
        />
      </div>
    </div>
  )
}

interface CodeViewerProps {
  filename: string
  content: string
  attributions?: Array<LineAttribution>
  showAttributions?: boolean
  highlightedLines?: Array<number>
}

// Color palette for feature attribution (no red tones - they look like deletions)
const FEATURE_COLORS: Record<string, string> = {
  base: 'bg-gray-500/10',
  query: 'bg-cyan-500/20',
  form: 'bg-blue-500/20',
  table: 'bg-indigo-500/20',
  store: 'bg-violet-500/20',
  drizzle: 'bg-emerald-500/20',
  prisma: 'bg-green-500/20',
  convex: 'bg-orange-500/20',
  neon: 'bg-lime-500/20',
  clerk: 'bg-purple-500/20',
  'better-auth': 'bg-pink-400/20',
  workos: 'bg-fuchsia-500/20',
  netlify: 'bg-teal-500/20',
  vercel: 'bg-slate-500/20',
  cloudflare: 'bg-amber-500/20',
  sentry: 'bg-purple-400/20',
  biome: 'bg-sky-500/20',
  eslint: 'bg-cyan-400/20',
  shadcn: 'bg-zinc-500/20',
  trpc: 'bg-blue-400/20',
  orpc: 'bg-indigo-400/20',
  ai: 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20',
  paraglide: 'bg-yellow-500/20',
  mcp: 'bg-emerald-400/20',
  strapi: 'bg-violet-400/20',
  storybook: 'bg-pink-300/20',
  t3env: 'bg-orange-400/20',
}

function getFeatureColor(featureId: FeatureId | 'base'): string {
  return FEATURE_COLORS[featureId] || 'bg-gray-500/10'
}

function CodeViewer({
  filename,
  content,
  attributions,
  showAttributions = true,
  highlightedLines,
}: CodeViewerProps) {
  const language = getLanguageFromFilename(filename)
  const lines = content.split('\n')
  const highlightedSet = useMemo(
    () => new Set(highlightedLines || []),
    [highlightedLines],
  )

  // Group consecutive lines by feature for cleaner display
  const lineGroups = useMemo(() => {
    if (!attributions || !showAttributions) return null

    const groups: Array<{
      startLine: number
      endLine: number
      featureId: FeatureId | 'base'
      featureName: string
    }> = []

    let currentGroup: (typeof groups)[0] | null = null

    for (const attr of attributions) {
      if (!currentGroup || currentGroup.featureId !== attr.featureId) {
        if (currentGroup) groups.push(currentGroup)
        currentGroup = {
          startLine: attr.lineNumber,
          endLine: attr.lineNumber,
          featureId: attr.featureId,
          featureName: attr.featureName,
        }
      } else {
        currentGroup.endLine = attr.lineNumber
      }
    }
    if (currentGroup) groups.push(currentGroup)

    return groups
  }, [attributions, showAttributions])

  // Check if file has any non-base attributions
  const hasFeatureContributions = useMemo(() => {
    if (!attributions) return false
    return attributions.some((a) => a.featureId !== 'base')
  }, [attributions])

  // Calculate max label width based on longest feature name (monospace: ~0.6em per char)
  const labelColumnWidth = useMemo(() => {
    if (!lineGroups) return 0
    const maxLength = Math.max(
      ...lineGroups
        .filter((g) => g.featureId !== 'base')
        .map((g) => g.featureName.length),
      0,
    )
    // chars * ~8px per char + padding (12px left + 12px right)
    return maxLength > 0 ? maxLength * 8 + 24 : 0
  }, [lineGroups])

  // Simple view without attributions (but may have highlighted lines for injections)
  if (!attributions || !showAttributions || !hasFeatureContributions) {
    // If we have highlighted lines, render with line-by-line highlighting
    if (highlightedSet.size > 0) {
      return (
        <div className="h-full flex flex-col overflow-hidden">
          <div className="shrink-0 px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                {filename}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                {highlightedSet.size}{' '}
                {highlightedSet.size === 1 ? 'line' : 'lines'} added
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-auto font-mono text-sm">
            <div className="min-w-fit">
              {lines.map((line, i) => {
                const lineNum = i + 1
                const isHighlighted = highlightedSet.has(lineNum)

                return (
                  <div
                    key={lineNum}
                    className={twMerge(
                      'flex group hover:bg-gray-100 dark:hover:bg-gray-800/50',
                      isHighlighted && 'bg-emerald-500/20',
                    )}
                  >
                    {/* Line number */}
                    <div className="w-10 shrink-0 px-2 py-0.5 text-right text-xs text-gray-400 dark:text-gray-600 select-none border-r border-gray-200 dark:border-gray-700">
                      {lineNum}
                    </div>

                    {/* Added indicator */}
                    <div className="w-6 shrink-0 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      {isHighlighted && '+'}
                    </div>

                    {/* Code content */}
                    <pre className="flex-1 py-0.5 pr-4 overflow-x-auto">
                      <code className="text-gray-800 dark:text-gray-200">
                        {line || ' '}
                      </code>
                    </pre>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )
    }

    // Use syntax highlighting for plain files
    return (
      <SyntaxHighlightedCode
        filename={filename}
        content={content}
        language={language}
      />
    )
  }

  // Attributed view with line coloring and badges
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Filename header with legend */}
      <div className="shrink-0 px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
            {filename}
          </span>
          <div className="flex items-center gap-2 text-xs">
            {lineGroups &&
              [...new Set(lineGroups.map((g) => g.featureId))]
                .filter((id) => id !== 'base')
                .map((featureId) => {
                  const group = lineGroups.find(
                    (g) => g.featureId === featureId,
                  )
                  return (
                    <span
                      key={featureId}
                      className={twMerge(
                        'px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300',
                        getFeatureColor(featureId),
                      )}
                    >
                      {group?.featureName}
                    </span>
                  )
                })}
          </div>
        </div>
      </div>

      {/* Code with line-by-line attribution */}
      <div className="flex-1 overflow-auto font-mono text-sm">
        <div className="min-w-fit">
          {lines.map((line, i) => {
            const lineNum = i + 1
            const attr = attributions.find((a) => a.lineNumber === lineNum)
            const isFeatureLine = attr && attr.featureId !== 'base'
            const isFirstOfGroup =
              lineGroups?.some(
                (g) => g.startLine === lineNum && g.featureId !== 'base',
              ) || false

            return (
              <div
                key={lineNum}
                className={twMerge(
                  'flex group hover:bg-gray-100 dark:hover:bg-gray-800/50',
                  isFeatureLine && getFeatureColor(attr.featureId),
                )}
              >
                {/* Line number */}
                <div className="w-10 shrink-0 px-2 py-0.5 text-right text-xs text-gray-400 dark:text-gray-600 select-none border-r border-gray-200 dark:border-gray-700">
                  {lineNum}
                </div>

                {/* Attribution badge (shown on first line of group) */}
                {labelColumnWidth > 0 && (
                  <div
                    className="shrink-0 px-1 py-0.5 text-xs flex items-center"
                    style={{ width: labelColumnWidth }}
                  >
                    {isFirstOfGroup && attr && (
                      <span className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {attr.featureName}
                      </span>
                    )}
                  </div>
                )}

                {/* Code content */}
                <pre className="flex-1 py-0.5 pr-4 overflow-x-auto">
                  <code className="text-gray-800 dark:text-gray-200">
                    {line || ' '}
                  </code>
                </pre>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Syntax highlighted code viewer for plain files (no attributions)
function SyntaxHighlightedCode({
  filename,
  content,
  language,
}: {
  filename: string
  content: string
  language: string
}) {
  const [highlightedLight, setHighlightedLight] = useState<string | null>(null)
  const [highlightedDark, setHighlightedDark] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const highlighter = await getShikiHighlighter()
        const loadedLangs = highlighter.getLoadedLanguages()
        const effectiveLang = loadedLangs.includes(language)
          ? language
          : 'plaintext'

        const lightHtml = highlighter.codeToHtml(content.trimEnd(), {
          lang: effectiveLang,
          theme: 'github-light',
        })
        const darkHtml = highlighter.codeToHtml(content.trimEnd(), {
          lang: effectiveLang,
          theme: 'vitesse-dark',
        })
        if (!cancelled) {
          setHighlightedLight(lightHtml)
          setHighlightedDark(darkHtml)
        }
      } catch {
        // Fallback handled by showing plain text
      }
    })()
    return () => {
      cancelled = true
    }
  }, [content, language])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-400 font-mono">
        {filename}
      </div>
      <div className="flex-1 overflow-auto">
        {highlightedLight && highlightedDark ? (
          <>
            <div
              className="dark:hidden [&_pre]:p-4 [&_pre]:m-0 [&_pre]:min-h-full [&_.shiki]:!bg-transparent"
              dangerouslySetInnerHTML={{ __html: highlightedLight }}
            />
            <div
              className="hidden dark:block [&_pre]:p-4 [&_pre]:m-0 [&_pre]:min-h-full [&_.shiki]:!bg-transparent"
              dangerouslySetInnerHTML={{ __html: highlightedDark }}
            />
          </>
        ) : (
          <pre className="p-4 font-mono text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
            <code>{content}</code>
          </pre>
        )}
      </div>
    </div>
  )
}

// Helper to convert flat file map to tree
function filesToTree(files: Record<string, string>): Array<FileTreeNode> {
  const root: Array<FileTreeNode> = []
  const paths = Object.keys(files).sort()

  for (const path of paths) {
    const parts = path.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const currentPath = parts.slice(0, i + 1).join('/')

      let node = current.find((n) => n.name === part)

      if (!node) {
        node = {
          name: part,
          path: currentPath,
          type: isLast ? 'file' : 'directory',
          children: isLast ? undefined : [],
        }
        current.push(node)
      }

      if (!isLast && node.children) {
        current = node.children
      }
    }
  }

  return root
}

// Folder icon with open/closed state
function FolderIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
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
