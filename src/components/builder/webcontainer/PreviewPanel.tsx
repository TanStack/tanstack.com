/**
 * PreviewPanel - WebContainer live preview with iframe and controls
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  RefreshCw,
  Terminal,
  X,
  Loader2,
  Globe,
  ChevronLeft,
  ChevronRight,
  Home,
  Copy,
  Check,
} from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import * as Tooltip from '@radix-ui/react-tooltip'
import { PreviewLoading } from './PreviewLoading'
import {
  useWebContainerStore,
  useSetupStep,
  usePreviewUrl,
  useWebContainerError,
  useTerminalOutput,
  useIsUpdating,
} from './useWebContainerStore'

interface PreviewPanelProps {
  files: Record<string, string> | null
}

// Navigation history for iframe (since we can't access cross-origin history)
interface NavHistory {
  entries: Array<string>
  index: number
}

// Show terminal by default on tall screens (excludes landscape tablets/mobile)
function useDefaultShowTerminal() {
  const [show, setShow] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerHeight >= 700
  })

  useEffect(() => {
    const handleResize = () => {
      // Only auto-show, don't auto-hide if user manually toggled
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return [show, setShow] as const
}

export function PreviewPanel({ files }: PreviewPanelProps) {
  const [showTerminal, setShowTerminal] = useDefaultShowTerminal()
  const [navHistory, setNavHistory] = useState<NavHistory>({
    entries: ['/'],
    index: 0,
  })
  const [isResizingTerminal, setIsResizingTerminal] = useState(false)
  const prevFilesRef = useRef<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Derived state from navHistory
  const currentPath = navHistory.entries[navHistory.index] || '/'
  const canGoBack = navHistory.index > 0
  const canGoForward = navHistory.index < navHistory.entries.length - 1

  const setupStep = useSetupStep()
  const previewUrl = usePreviewUrl()
  const error = useWebContainerError()
  const isUpdating = useIsUpdating()

  const container = useWebContainerStore((s) => s.container)
  const boot = useWebContainerStore((s) => s.boot)
  const updateFiles = useWebContainerStore((s) => s.updateFiles)

  // Boot WebContainer on mount
  useEffect(() => {
    boot()
  }, [boot])

  // Update files when they change (wait for container to be ready)
  useEffect(() => {
    if (!files || !container) return

    const filesJson = JSON.stringify(files)
    if (filesJson === prevFilesRef.current) return
    prevFilesRef.current = filesJson

    updateFiles(files)
  }, [files, container, updateFiles])

  // Listen for navigation messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'wc-nav') return
      const { type, path } = event.data.payload || {}
      if (!path) return

      setNavHistory((prev) => {
        if (type === 'popstate') {
          // Back/forward in iframe - find the path in history
          const existingIndex = prev.entries.indexOf(path)
          if (existingIndex !== -1) {
            return { ...prev, index: existingIndex }
          }
          // Path not found, treat as new navigation
          const newEntries = [...prev.entries.slice(0, prev.index + 1), path]
          return { entries: newEntries, index: newEntries.length - 1 }
        }
        if (type === 'pushstate' || type === 'load' || type === 'hashchange') {
          // New navigation - truncate forward history and add new entry
          if (prev.entries[prev.index] === path) {
            return prev // Same path, no change
          }
          const newEntries = [...prev.entries.slice(0, prev.index + 1), path]
          return { entries: newEntries, index: newEntries.length - 1 }
        }
        if (type === 'replacestate') {
          // Replace current entry
          const newEntries = [...prev.entries]
          newEntries[prev.index] = path
          return { entries: newEntries, index: prev.index }
        }
        return prev
      })
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Reset history when preview URL changes (new project)
  useEffect(() => {
    if (previewUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNavHistory({ entries: ['/'], index: 0 })
    }
  }, [previewUrl])

  // Navigation handlers - use postMessage to control iframe navigation
  const handleBack = useCallback(() => {
    if (canGoBack) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'wc-nav-cmd', cmd: 'back' },
        '*',
      )
    }
  }, [canGoBack])

  const handleForward = useCallback(() => {
    if (canGoForward) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'wc-nav-cmd', cmd: 'forward' },
        '*',
      )
    }
  }, [canGoForward])

  const handleHome = useCallback(() => {
    if (iframeRef.current && previewUrl) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'wc-nav-cmd', cmd: 'navigate', path: '/' },
        '*',
      )
    }
  }, [previewUrl])

  const handleRefresh = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'wc-nav-cmd', cmd: 'reload' },
      '*',
    )
  }, [])

  // Extract origin from the preview URL for the tooltip
  const urlOrigin = useMemo(() => {
    if (!previewUrl) return ''
    try {
      return new URL(previewUrl).origin
    } catch {
      return ''
    }
  }, [previewUrl])

  // Show loading state only if we don't have a preview URL yet
  // During updates, we keep showing the old preview with an overlay
  const showLoadingScreen = !previewUrl && setupStep !== 'ready'
  if (showLoadingScreen) {
    return (
      <div className="h-full flex flex-col">
        {/* Top half: Loading stepper */}
        <div className="flex-1 min-h-0">
          <PreviewLoading setupStep={setupStep} error={error} />
        </div>
        {/* Bottom half: Terminal */}
        <div className="flex-1 min-h-0 border-t border-gray-200 dark:border-gray-800">
          <FullTerminalView />
        </div>
      </div>
    )
  }

  // Show error screen if there's an error and no preview
  if (error && !previewUrl) {
    return (
      <div className="h-full flex flex-col">
        {/* Top half: Error */}
        <div className="flex-1 min-h-0">
          <PreviewLoading setupStep="error" error={error} />
        </div>
        {/* Bottom half: Terminal */}
        <div className="flex-1 min-h-0 border-t border-gray-200 dark:border-gray-800">
          <FullTerminalView />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 shrink-0">
        {/* Navigation buttons */}
        <button
          type="button"
          onClick={handleBack}
          disabled={!canGoBack}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-30"
          title="Go back"
        >
          <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
        <button
          type="button"
          onClick={handleForward}
          disabled={!canGoForward}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-30"
          title="Go forward"
        >
          <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
        <button
          type="button"
          onClick={handleHome}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Go home"
        >
          <Home className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>

        {/* Refresh button */}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isUpdating}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          title="Refresh preview"
        >
          {isUpdating ? (
            <Loader2 className="w-4 h-4 text-gray-500 dark:text-gray-400 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          )}
        </button>

        {/* URL bar - Chrome-style: origin badge with tooltip, then path */}
        <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-mono text-gray-600 dark:text-gray-400 overflow-hidden">
          {urlOrigin && (
            <Tooltip.Provider delayDuration={200}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    type="button"
                    className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs"
                  >
                    <Globe className="w-3 h-3" />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    className="z-[100] px-2 py-1 text-xs font-mono bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded shadow-lg"
                    sideOffset={5}
                  >
                    {urlOrigin}
                    <Tooltip.Arrow className="fill-gray-900 dark:fill-gray-100" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          )}
          <span className="truncate">{currentPath}</span>
        </div>

        {/* Terminal toggle */}
        <button
          type="button"
          onClick={() => setShowTerminal(!showTerminal)}
          className={twMerge(
            'p-1.5 rounded transition-colors',
            showTerminal
              ? 'bg-gray-200 dark:bg-gray-700'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700',
          )}
          title="Toggle terminal"
        >
          <Terminal className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Iframe or Terminal (show terminal when updating/not ready) */}
      <div className="flex-1 bg-white dark:bg-gray-950 relative overflow-hidden flex flex-col">
        {(isUpdating || isResizingTerminal) && (
          <div
            className={twMerge(
              'absolute inset-0 z-10',
              isUpdating
                ? 'bg-white/80 dark:bg-gray-900/80 flex items-center justify-center'
                : 'bg-transparent cursor-ns-resize',
            )}
          >
            {isUpdating && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating...
              </div>
            )}
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={previewUrl || undefined}
          title="Live Preview"
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      </div>

      {/* Terminal panel */}
      <TerminalPanel
        show={showTerminal}
        onToggle={() => setShowTerminal(false)}
        onDragStateChange={setIsResizingTerminal}
      />
    </div>
  )
}

/**
 * Terminal view shown while building/updating (bottom half of preview area)
 */
function FullTerminalView() {
  const terminalOutput = useTerminalOutput()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [terminalOutput])

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-gray-950">
      {/* Terminal header */}
      <div className="flex items-center px-3 py-1.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Terminal
        </span>
      </div>

      {/* Terminal output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed"
      >
        {terminalOutput.length === 0 ? (
          <span className="text-gray-400 dark:text-gray-500">
            Waiting for output...
          </span>
        ) : (
          terminalOutput.map((line, index) => (
            <div key={index} className="whitespace-pre-wrap">
              <span className={getLineColor(line)}>{line}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

interface TerminalPanelProps {
  show: boolean
  onToggle: () => void
  onDragStateChange?: (isDragging: boolean) => void
}

const DEFAULT_TERMINAL_HEIGHT = 192 // 12rem
const INITIAL_TERMINAL_HEIGHT = 350 // Start taller, animate down
const MIN_TERMINAL_HEIGHT = 80
const MAX_TERMINAL_HEIGHT = 600

function TerminalPanel({
  show,
  onToggle,
  onDragStateChange,
}: TerminalPanelProps) {
  const terminalOutput = useTerminalOutput()
  const clearTerminal = useWebContainerStore((s) => s.clearTerminal)
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(INITIAL_TERMINAL_HEIGHT)
  const [isDragging, setIsDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  const hasAnimated = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

  const handleCopy = useCallback(() => {
    const text = terminalOutput.join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [terminalOutput])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [terminalOutput])

  // Animate down to default height on first mount
  useEffect(() => {
    if (!show || hasAnimated.current) return
    hasAnimated.current = true
    const timer = setTimeout(() => {
      setHeight(DEFAULT_TERMINAL_HEIGHT)
    }, 100)
    return () => clearTimeout(timer)
  }, [show])

  // Handle resize drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true)
      onDragStateChange?.(true)
      startY.current = e.clientY
      startHeight.current = height
      document.body.style.cursor = 'ns-resize'
      document.body.style.userSelect = 'none'
    },
    [height, onDragStateChange],
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startY.current - e.clientY
      const maxHeight = containerRef.current?.parentElement
        ? containerRef.current.parentElement.clientHeight - 100
        : MAX_TERMINAL_HEIGHT
      const newHeight = Math.min(
        Math.max(startHeight.current + delta, MIN_TERMINAL_HEIGHT),
        Math.min(maxHeight, MAX_TERMINAL_HEIGHT),
      )
      setHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      onDragStateChange?.(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, onDragStateChange])

  if (!show) return null

  return (
    <div
      ref={containerRef}
      className={twMerge(
        'border-t border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-950 shrink-0 relative',
        !isDragging && 'transition-[height] duration-300 ease-out',
      )}
      style={{ height }}
    >
      {/* Header - entire header is draggable for resize except action buttons */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 cursor-ns-resize select-none"
        onMouseDown={handleMouseDown}
      >
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Terminal
        </span>
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          className="flex items-center gap-1 cursor-default"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Copy terminal output"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
            )}
          </button>

          {/* Clear button */}
          <button
            type="button"
            onClick={clearTerminal}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Clear terminal"
          >
            <svg
              className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={onToggle}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Close terminal"
          >
            <X className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed"
      >
        {terminalOutput.length === 0 ? (
          <span className="text-gray-400 dark:text-gray-500">
            Waiting for output...
          </span>
        ) : (
          terminalOutput.map((line, index) => (
            <div key={index} className="whitespace-pre-wrap">
              <span className={getLineColor(line)}>{line}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function getLineColor(line: string): string {
  const lineLower = line.toLowerCase()

  if (
    lineLower.includes('error') ||
    lineLower.includes('failed') ||
    lineLower.includes('err')
  ) {
    return 'text-red-600 dark:text-red-400'
  }

  if (lineLower.includes('warning') || lineLower.includes('warn')) {
    return 'text-yellow-600 dark:text-yellow-400'
  }

  if (
    lineLower.includes('success') ||
    lineLower.includes('ready') ||
    lineLower.includes('done') ||
    lineLower.includes('✅')
  ) {
    return 'text-green-600 dark:text-green-400'
  }

  if (
    line.startsWith('>') ||
    line.startsWith('$') ||
    line.startsWith('🚀') ||
    line.startsWith('📦')
  ) {
    return 'text-blue-600 dark:text-blue-400'
  }

  return 'text-gray-700 dark:text-gray-300'
}
