import * as React from 'react'
import {
  ArrowClockwiseIcon,
  BrowserIcon,
  FolderOpenIcon,
  ShareIcon,
  TerminalWindowIcon,
} from '@phosphor-icons/react'
import { ButtonGroup } from '~/components/ButtonGroup'
import { FileExplorer, type FileExplorerNode } from '~/components/FileExplorer'
import { useTheme } from '~/components/ThemeProvider'
import { Button } from '~/components/ds/ui'
import { Tooltip } from '~/ui'
import { copyTextToClipboard } from '~/utils/browser-effects'
import { compileExampleWorkspace } from '~/utils/example-esbuild.client'
import { createSharedExampleProject } from '~/utils/example-project'
import { createSharedExampleUrl } from '~/utils/example-share.client'
import {
  createExampleSandboxDocument,
  isExampleSandboxMessage,
  postExampleSandboxTheme,
  type ExampleConsoleLevel,
  type ExampleSandboxStatus,
} from '~/utils/example-sandbox.client'
import {
  createExampleWorkspace,
  type ExampleDefinition,
  type ExampleWorkspace,
} from '~/utils/example-workspace'
import { CodeMirrorEditor } from './CodeMirrorEditor.client'

type WorkbenchStatus = 'compiling' | 'idle' | ExampleSandboxStatus
type ConsoleEntry = {
  id: number
  level: ExampleConsoleLevel
  values: Array<string>
}
type MobileView = 'code' | 'preview'
type CodePanelResize = {
  frame: HTMLIFrameElement | null
  ownerDocument: Document
  percent: number
  pointerId: number
  previousCursor: string
  previousFramePointerEvents: string
  previousUserSelect: string
}

const DEFAULT_CODE_PANEL_PERCENT = 67
const MIN_DESKTOP_PANEL_WIDTH = 280

export function ExampleWorkbench({
  autoRun = true,
  className,
  definition,
  filesInitiallyOpen = false,
  libraryColor = 'bg-emerald-500',
  onWorkspaceChange,
}: {
  autoRun?: boolean
  className?: string
  definition: ExampleDefinition
  filesInitiallyOpen?: boolean
  libraryColor?: string
  onWorkspaceChange?: (workspace: ExampleWorkspace) => void
}) {
  const { resolvedTheme } = useTheme()
  const codePanelId = React.useId()
  const previewPanelId = React.useId()
  const [workspace, setWorkspace] = React.useState(() =>
    cloneWorkspace(definition.workspace),
  )
  const [activePath, setActivePath] = React.useState(() =>
    getInitialFile(definition, workspace),
  )
  const [mobileView, setMobileView] = React.useState<MobileView>('preview')
  const [showFiles, setShowFiles] = React.useState(filesInitiallyOpen)
  const [showPreview, setShowPreview] = React.useState(true)
  const [showConsole, setShowConsole] = React.useState(false)
  const [codePanelPercent, setCodePanelPercent] = React.useState(
    DEFAULT_CODE_PANEL_PERCENT,
  )
  const [isCodePanelResizing, setIsCodePanelResizing] = React.useState(false)
  const [status, setStatus] = React.useState<WorkbenchStatus>('idle')
  const [error, setError] = React.useState('')
  const [consoleEntries, setConsoleEntries] = React.useState<
    Array<ConsoleEntry>
  >([])
  const [sourceDocument, setSourceDocument] = React.useState('')
  const [shareState, setShareState] = React.useState<
    'idle' | 'sharing' | 'copied'
  >('idle')
  const frameRef = React.useRef<HTMLIFrameElement>(null)
  const splitRef = React.useRef<HTMLDivElement>(null)
  const codePanelRef = React.useRef<HTMLElement>(null)
  const previewPanelRef = React.useRef<HTMLElement>(null)
  const codeResizeRef = React.useRef<CodePanelResize>(null)
  const runTokenRef = React.useRef('')
  const compileRequestRef = React.useRef(0)
  const nextConsoleIdRef = React.useRef(0)

  React.useEffect(() => {
    const nextWorkspace = cloneWorkspace(definition.workspace)
    setWorkspace(nextWorkspace)
    setActivePath(getInitialFile(definition, nextWorkspace))
  }, [definition])

  const run = React.useCallback(async () => {
    const request = compileRequestRef.current + 1
    compileRequestRef.current = request
    const runToken = crypto.randomUUID()
    runTokenRef.current = runToken
    nextConsoleIdRef.current = 0
    setConsoleEntries([])
    setError('')
    setStatus('compiling')

    try {
      const compiled = await compileExampleWorkspace(workspace)
      if (request !== compileRequestRef.current) return

      setSourceDocument(
        createExampleSandboxDocument({
          compiled,
          document: workspace.files['/index.html'],
          entry: workspace.entry,
          files: workspace.files,
          runToken,
          theme: readTheme(),
        }),
      )
      setStatus('running')
    } catch (cause) {
      if (request !== compileRequestRef.current) return
      setStatus('error')
      setError(formatError(cause))
    }
  }, [workspace])

  React.useEffect(() => {
    if (!autoRun) return
    const timeout = window.setTimeout(() => void run(), 300)
    return () => window.clearTimeout(timeout)
  }, [autoRun, run])

  const syncTheme = React.useCallback(() => {
    postExampleSandboxTheme({
      frame: frameRef.current,
      runToken: runTokenRef.current,
      theme: readTheme(),
    })
  }, [])

  React.useEffect(() => {
    function handleMessage(event: MessageEvent<unknown>) {
      if (event.source !== frameRef.current?.contentWindow) return
      if (!isExampleSandboxMessage(event.data, runTokenRef.current)) return

      const message = event.data
      if (message.kind === 'console') {
        const entry = {
          id: nextConsoleIdRef.current,
          level: message.level,
          values: message.values,
        }
        nextConsoleIdRef.current += 1
        setConsoleEntries((current) => [...current, entry])
        return
      }

      if (message.kind === 'theme-request') {
        syncTheme()
        return
      }

      setStatus(message.status)
      setError(message.message ?? '')
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [syncTheme])

  React.useEffect(() => {
    syncTheme()
    const observer = new MutationObserver(syncTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [syncTheme])

  React.useEffect(() => {
    if (!isCodePanelResizing) return
    const resize = codeResizeRef.current
    return () => restoreCodePanelResize(resize)
  }, [isCodePanelResizing])

  React.useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const revealPreviewOnMobile = () => {
      if (!desktop.matches) setShowPreview(true)
    }

    desktop.addEventListener('change', revealPreviewOnMobile)
    return () => desktop.removeEventListener('change', revealPreviewOnMobile)
  }, [])

  function updateActiveSource(source: string) {
    setWorkspace((current) => {
      const next = createExampleWorkspace({
        entry: current.entry,
        environment: current.environment,
        files: { ...current.files, [activePath]: source },
        imports: current.imports,
      })
      onWorkspaceChange?.(next)
      return next
    })
  }

  function selectFile(path: string) {
    setActivePath(path)
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      setShowFiles(false)
    }
  }

  function toggleFiles() {
    setMobileView('code')
    setShowFiles((open) => !open)
  }

  function toggleConsole() {
    setMobileView('preview')
    setShowPreview(true)
    setShowConsole((open) => !open)
  }

  function togglePreview() {
    const nextShowPreview = !showPreview
    setShowPreview(nextShowPreview)
    if (!nextShowPreview) setShowConsole(false)
  }

  function startCodePanelResize(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return

    const split = splitRef.current
    if (!split) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

    const ownerDocument = event.currentTarget.ownerDocument
    const frame = frameRef.current
    codeResizeRef.current = {
      frame,
      ownerDocument,
      percent: codePanelPercent,
      pointerId: event.pointerId,
      previousCursor: ownerDocument.body.style.cursor,
      previousFramePointerEvents: frame?.style.pointerEvents ?? '',
      previousUserSelect: ownerDocument.body.style.userSelect,
    }

    ownerDocument.body.style.cursor = 'col-resize'
    ownerDocument.body.style.userSelect = 'none'
    if (frame) frame.style.pointerEvents = 'none'
    setIsCodePanelResizing(true)
  }

  function moveCodePanelResize(event: React.PointerEvent<HTMLDivElement>) {
    const resize = codeResizeRef.current
    if (!resize || event.pointerId !== resize.pointerId) return

    const split = splitRef.current
    const codePanel = codePanelRef.current
    const previewPanel = previewPanelRef.current
    if (!split || !codePanel || !previewPanel) return

    const splitRect = split.getBoundingClientRect()
    const separatorWidth = event.currentTarget.getBoundingClientRect().width
    const availableWidth = splitRect.width - separatorWidth
    const minWidth = Math.min(MIN_DESKTOP_PANEL_WIDTH, availableWidth / 2)
    const codeWidth = clamp(
      event.clientX - splitRect.left - separatorWidth / 2,
      minWidth,
      availableWidth - minWidth,
    )
    const percent = (codeWidth / availableWidth) * 100

    resize.percent = percent
    codePanel.style.flexGrow = `${percent}`
    previewPanel.style.flexGrow = `${100 - percent}`
  }

  function finishCodePanelResize(event: React.PointerEvent<HTMLDivElement>) {
    const resize = codeResizeRef.current
    if (!resize || event.pointerId !== resize.pointerId) return

    setCodePanelPercent(resize.percent)
    restoreCodePanelResize(resize)
    codeResizeRef.current = null
    setIsCodePanelResizing(false)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function resizeCodePanelWithKeyboard(
    event: React.KeyboardEvent<HTMLDivElement>,
  ) {
    if (
      event.key !== 'ArrowLeft' &&
      event.key !== 'ArrowRight' &&
      event.key !== 'Home' &&
      event.key !== 'End'
    ) {
      return
    }

    const split = splitRef.current
    const codePanel = codePanelRef.current
    if (!split || !codePanel) return

    event.preventDefault()
    const separatorWidth = event.currentTarget.getBoundingClientRect().width
    const availableWidth = split.getBoundingClientRect().width - separatorWidth
    const minWidth = Math.min(MIN_DESKTOP_PANEL_WIDTH, availableWidth / 2)
    const maxWidth = availableWidth - minWidth
    const codeWidth =
      event.key === 'Home'
        ? minWidth
        : event.key === 'End'
          ? maxWidth
          : clamp(
              codePanel.getBoundingClientRect().width +
                (event.key === 'ArrowRight' ? 1 : -1) *
                  (event.shiftKey ? 64 : 24),
              minWidth,
              maxWidth,
            )

    setCodePanelPercent((codeWidth / availableWidth) * 100)
  }

  async function share() {
    setShareState('sharing')
    setError('')

    try {
      const url = await createSharedExampleUrl(
        createSharedExampleProject({
          title: definition.title,
          description: definition.description,
          initialFile: activePath,
          workspace,
        }),
      )
      await copyTextToClipboard(url.href)
      setShareState('copied')
      window.setTimeout(() => setShareState('idle'), 1_500)
    } catch (cause) {
      setShareState('idle')
      setError(formatError(cause))
    }
  }

  const filePaths = Object.keys(workspace.files).sort()
  const fileTree = React.useMemo(() => createFileTree(filePaths), [filePaths])
  const activeSource = workspace.files[activePath] ?? ''
  const statusLabel = getStatusLabel(status)

  return (
    <section
      className={`not-prose flex h-[clamp(520px,75dvh,720px)] min-w-0 flex-col overflow-hidden rounded-lg border border-border-default bg-background-default text-text-primary ${className ?? ''}`}
      aria-label={`${definition.title} workbench`}
    >
      <header className="flex min-h-10 shrink-0 items-center justify-between gap-3 border-b border-border-default px-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="icon"
            color="gray"
            size="xs"
            rounded="none"
            className={`shrink-0 gap-1.5 border-0 bg-transparent px-1.5 py-1 text-text-muted shadow-none hover:bg-transparent hover:text-text-primary max-[899px]:bg-transparent max-[899px]:text-text-muted active:scale-100 ${showFiles ? 'text-text-primary max-[899px]:text-text-primary' : ''}`}
            aria-pressed={showFiles}
            aria-label={showFiles ? 'Hide files' : 'Show files'}
            onClick={toggleFiles}
          >
            <FolderOpenIcon className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Files</span>
          </Button>
          <div className="min-w-0 truncate font-ds-mono text-xs text-text-muted">
            {activePath}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`hidden text-xs sm:inline ${status === 'error' ? 'text-text-error' : 'text-text-muted'}`}
            role="status"
          >
            {statusLabel}
          </span>
          <ButtonGroup>
            <Tooltip
              content={shareState === 'copied' ? 'Copied' : 'Copy share link'}
              side="bottom"
            >
              <Button
                type="button"
                variant="ghost"
                size="xs"
                rounded="none"
                aria-label="Copy share link"
                disabled={shareState === 'sharing'}
                onClick={() => void share()}
              >
                <ShareIcon className="size-3.5" aria-hidden="true" />
              </Button>
            </Tooltip>
            <Tooltip
              content={showConsole ? 'Hide console' : 'Show console'}
              side="bottom"
            >
              <Button
                type="button"
                variant="ghost"
                size="xs"
                rounded="none"
                aria-pressed={showConsole}
                aria-label={showConsole ? 'Hide console' : 'Show console'}
                onClick={toggleConsole}
              >
                <TerminalWindowIcon className="size-3.5" aria-hidden="true" />
              </Button>
            </Tooltip>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              rounded="none"
              className="hidden lg:inline-flex"
              aria-controls={previewPanelId}
              aria-pressed={showPreview}
              aria-label={showPreview ? 'Hide preview' : 'Show preview'}
              onClick={togglePreview}
            >
              <BrowserIcon className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Preview</span>
            </Button>
            <Tooltip content="Refresh preview" side="bottom">
              <Button
                type="button"
                variant="primary"
                size="xs"
                rounded="none"
                className="hover:translate-y-0 max-[899px]:translate-y-0"
                aria-label="Refresh preview"
                onClick={() => void run()}
              >
                <ArrowClockwiseIcon className="size-3.5" aria-hidden="true" />
              </Button>
            </Tooltip>
          </ButtonGroup>
        </div>
      </header>

      <div className="shrink-0 border-b border-border-default p-1 lg:hidden">
        <ButtonGroup className="flex w-full shadow-none">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            rounded="none"
            className="flex-1 justify-center"
            aria-pressed={mobileView === 'preview'}
            onClick={() => setMobileView('preview')}
          >
            Preview
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            rounded="none"
            className="flex-1 justify-center"
            aria-pressed={mobileView === 'code'}
            onClick={() => setMobileView('code')}
          >
            Code
          </Button>
        </ButtonGroup>
      </div>

      <div
        ref={splitRef}
        className="grid min-h-0 min-w-0 flex-1 grid-cols-1 lg:flex"
      >
        <section
          ref={codePanelRef}
          id={codePanelId}
          style={{
            flexGrow: showPreview ? codePanelPercent : 100,
            minWidth: 'min(280px, calc((100% - 0.5rem) / 2))',
          }}
          className={`${mobileView === 'code' ? 'flex' : 'hidden'} relative min-h-0 min-w-0 overflow-hidden lg:flex lg:basis-0 ${isCodePanelResizing ? '' : 'transition-[flex-grow] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none'}`}
        >
          <FileExplorer
            currentPath={activePath}
            files={fileTree}
            isSidebarOpen={showFiles}
            libraryColor={libraryColor}
            onSidebarClose={() => setShowFiles(false)}
            prefetchFileContent={() => {}}
            setCurrentPath={selectFile}
          />
          <div className="flex min-w-0 flex-1 flex-col bg-[var(--th-background)]">
            <div
              aria-hidden={showFiles}
              inert={showFiles}
              className={`${showFiles ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'} grid shrink-0 transition-[grid-template-rows,opacity] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none`}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="fade-x flex h-9 overflow-x-auto border-b border-border-default bg-background-subtle">
                  {filePaths.map((path) => (
                    <button
                      key={path}
                      type="button"
                      title={path}
                      onClick={() => setActivePath(path)}
                      className={`shrink-0 border-r border-border-default px-2 font-ds-mono text-[11px] ${
                        activePath === path
                          ? 'bg-background-default text-text-primary'
                          : 'text-text-muted hover:bg-background-elevated hover:text-text-secondary'
                      }`}
                    >
                      {path.split('/').pop()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <CodeMirrorEditor
                path={activePath}
                theme={resolvedTheme}
                value={activeSource}
                onChange={updateActiveSource}
                onRun={() => void run()}
              />
            </div>
          </div>
        </section>

        <div
          role="separator"
          aria-controls={`${codePanelId} ${previewPanelId}`}
          aria-label="Resize code and preview panels"
          aria-orientation="vertical"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(codePanelPercent)}
          aria-valuetext={`${Math.round(codePanelPercent)}% code, ${Math.round(100 - codePanelPercent)}% preview`}
          tabIndex={showPreview ? 0 : -1}
          title="Drag to resize. Double-click to reset."
          onDoubleClick={() => setCodePanelPercent(DEFAULT_CODE_PANEL_PERCENT)}
          onKeyDown={resizeCodePanelWithKeyboard}
          onLostPointerCapture={finishCodePanelResize}
          onPointerCancel={finishCodePanelResize}
          onPointerDown={startCodePanelResize}
          onPointerMove={moveCodePanelResize}
          onPointerUp={finishCodePanelResize}
          className={`group relative z-10 hidden shrink-0 touch-none cursor-col-resize select-none items-center justify-center bg-background-default transition-[width,opacity] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:bg-blue-500/15 focus-visible:bg-blue-500/15 focus-visible:outline-2 focus-visible:outline-blue-500 motion-reduce:transition-none lg:flex ${showPreview ? 'lg:w-2 lg:opacity-100' : 'lg:pointer-events-none lg:w-0 lg:opacity-0'}`}
        >
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border-default group-hover:bg-blue-400 group-focus-visible:bg-blue-400" />
        </div>

        <section
          ref={previewPanelRef}
          id={previewPanelId}
          aria-hidden={!showPreview}
          inert={!showPreview}
          style={{
            flexGrow: showPreview ? 100 - codePanelPercent : 0,
            minWidth: showPreview ? 'min(280px, calc((100% - 0.5rem) / 2))' : 0,
          }}
          className={`${mobileView === 'preview' ? 'grid' : 'hidden'} min-h-0 min-w-0 overflow-hidden bg-background-default transition-[flex-grow,min-width,opacity] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none lg:grid lg:basis-0 ${showPreview ? 'lg:opacity-100' : 'lg:pointer-events-none lg:opacity-0'} ${showConsole ? 'grid-rows-[minmax(0,1fr)_minmax(100px,28%)]' : 'grid-rows-1'}`}
        >
          <div className="min-h-0 overflow-hidden bg-background-default">
            {sourceDocument ? (
              <iframe
                ref={frameRef}
                title={`${definition.title} output`}
                sandbox="allow-scripts"
                srcDoc={sourceDocument}
                onLoad={syncTheme}
                className="block size-full border-0 bg-background-default"
              />
            ) : null}
          </div>
          {showConsole ? (
            <div
              role="log"
              aria-label="Console output"
              className="overflow-auto border-t border-border-default bg-[var(--th-background)] p-3 font-ds-mono text-xs leading-5 text-[var(--th-token)]"
            >
              {consoleEntries.length ? (
                consoleEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`whitespace-pre-wrap break-words ${getConsoleColor(entry.level)}`}
                  >
                    {entry.level === 'log' ? '' : `${entry.level} `}
                    {entry.values.join(' ')}
                  </div>
                ))
              ) : (
                <span className="text-text-muted">No console output</span>
              )}
            </div>
          ) : null}
        </section>
      </div>

      {error ? (
        <pre className="max-h-32 overflow-auto border-t border-border-error bg-status-error-bg p-3 font-ds-mono text-xs whitespace-pre-wrap text-text-error">
          {error}
        </pre>
      ) : null}
    </section>
  )
}

function cloneWorkspace(workspace: ExampleWorkspace) {
  return createExampleWorkspace({
    entry: workspace.entry,
    environment: workspace.environment,
    files: { ...workspace.files },
    imports: workspace.imports,
  })
}

function getInitialFile(
  definition: ExampleDefinition,
  workspace: ExampleWorkspace,
) {
  return definition.initialFile &&
    workspace.files[definition.initialFile] !== undefined
    ? definition.initialFile
    : workspace.entry
}

function readTheme() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function formatError(error: unknown) {
  return error instanceof Error ? error.stack || error.message : String(error)
}

function getStatusLabel(status: WorkbenchStatus) {
  switch (status) {
    case 'compiling':
      return 'Compiling'
    case 'running':
      return 'Running'
    case 'ready':
      return 'Ready'
    case 'error':
      return 'Error'
    case 'idle':
      return 'Idle'
  }
}

function getConsoleColor(level: ExampleConsoleLevel) {
  switch (level) {
    case 'error':
      return 'text-text-error'
    case 'warn':
      return 'text-text-warning'
    case 'info':
      return 'text-text-info'
    case 'debug':
      return 'text-text-muted'
    case 'log':
      return ''
  }
}

function createFileTree(paths: Array<string>) {
  const root: Array<FileExplorerNode> = []

  for (const path of paths) {
    const segments = path.split('/').filter(Boolean)
    let children = root

    for (const [index, name] of segments.entries()) {
      const nodePath = `/${segments.slice(0, index + 1).join('/')}`
      const last = index === segments.length - 1
      let node = children.find((candidate) => candidate.path === nodePath)

      if (!node) {
        node = {
          children: last ? undefined : [],
          depth: index,
          name,
          path: nodePath,
          type: last ? 'file' : 'dir',
        }
        children.push(node)
      }

      if (node.children) children = node.children
    }
  }

  return root
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function restoreCodePanelResize(resize: CodePanelResize | null) {
  if (!resize) return

  resize.ownerDocument.body.style.cursor = resize.previousCursor
  resize.ownerDocument.body.style.userSelect = resize.previousUserSelect
  if (resize.frame) {
    resize.frame.style.pointerEvents = resize.previousFramePointerEvents
  }
}
