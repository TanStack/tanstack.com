import * as React from 'react'
import {
  FolderOpenIcon,
  PlayIcon,
  ShareIcon,
  TerminalWindowIcon,
} from '@phosphor-icons/react'
import { ButtonGroup } from '~/components/ButtonGroup'
import { FileExplorer, type FileExplorerNode } from '~/components/FileExplorer'
import { useTheme } from '~/components/ThemeProvider'
import { Button } from '~/components/ds/ui'
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

export function ExampleWorkbench({
  autoRun = true,
  className,
  definition,
  onWorkspaceChange,
}: {
  autoRun?: boolean
  className?: string
  definition: ExampleDefinition
  onWorkspaceChange?: (workspace: ExampleWorkspace) => void
}) {
  const { resolvedTheme } = useTheme()
  const [workspace, setWorkspace] = React.useState(() =>
    cloneWorkspace(definition.workspace),
  )
  const [activePath, setActivePath] = React.useState(() =>
    getInitialFile(definition, workspace),
  )
  const [mobileView, setMobileView] = React.useState<MobileView>('preview')
  const [showFiles, setShowFiles] = React.useState(false)
  const [showConsole, setShowConsole] = React.useState(false)
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
    setShowConsole((open) => !open)
  }

  async function share() {
    setShareState('sharing')
    setError('')

    try {
      const url = await createSharedExampleUrl(
        createSharedExampleProject({
          title: definition.title,
          description: definition.description,
          initialFile: definition.initialFile,
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
        <div className="min-w-0 truncate font-ds-mono text-xs text-text-muted">
          {activePath}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`hidden text-xs sm:inline ${status === 'error' ? 'text-text-error' : 'text-text-muted'}`}
            role="status"
          >
            {statusLabel}
          </span>
          <ButtonGroup>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              rounded="none"
              disabled={shareState === 'sharing'}
              onClick={() => void share()}
            >
              <ShareIcon className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">
                {shareState === 'copied' ? 'Copied' : 'Share'}
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              rounded="none"
              aria-pressed={showFiles}
              aria-label={showFiles ? 'Hide files' : 'Show files'}
              onClick={toggleFiles}
            >
              <FolderOpenIcon className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Files</span>
            </Button>
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
              <span className="hidden sm:inline">Console</span>
            </Button>
            <Button
              type="button"
              variant="primary"
              size="xs"
              rounded="none"
              onClick={() => void run()}
            >
              <PlayIcon className="size-3.5" weight="fill" aria-hidden="true" />
              <span className="hidden sm:inline">Run</span>
            </Button>
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

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <section
          className={`${mobileView === 'code' ? 'flex' : 'hidden'} relative min-h-0 min-w-0 overflow-hidden lg:flex lg:border-r lg:border-border-default`}
        >
          <div
            className={`${showFiles ? 'border-r border-border-default shadow-lg' : ''} absolute inset-y-0 left-0 z-20 flex max-w-[80%] overflow-hidden bg-background-default lg:static lg:z-auto lg:max-w-none lg:border-r-0 lg:shadow-none`}
          >
            <FileExplorer
              currentPath={activePath}
              files={fileTree}
              isSidebarOpen={showFiles}
              libraryColor="bg-emerald-500"
              prefetchFileContent={() => {}}
              setCurrentPath={selectFile}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col bg-[var(--th-background)]">
            <div className="fade-x flex min-h-9 shrink-0 overflow-x-auto border-b border-border-default bg-background-subtle">
              {filePaths.map((path) => (
                <button
                  key={path}
                  type="button"
                  title={path}
                  onClick={() => setActivePath(path)}
                  className={`shrink-0 border-r border-border-default px-3 font-ds-mono text-xs ${
                    activePath === path
                      ? 'bg-background-default text-text-primary'
                      : 'text-text-muted hover:bg-background-elevated hover:text-text-secondary'
                  }`}
                >
                  {path.split('/').pop()}
                </button>
              ))}
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

        <section
          className={`${mobileView === 'preview' ? 'grid' : 'hidden'} min-h-0 min-w-0 bg-background-default lg:grid ${showConsole ? 'grid-rows-[minmax(0,1fr)_minmax(100px,28%)]' : 'grid-rows-1'}`}
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
