import * as React from 'react'
import {
  FolderOpenIcon,
  PlayIcon,
  ShareIcon,
  TerminalWindowIcon,
} from '@phosphor-icons/react'
import { ButtonGroup } from '~/components/ButtonGroup'
import { FileExplorer, type FileExplorerNode } from '~/components/FileExplorer'
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
  const [workspace, setWorkspace] = React.useState(() =>
    cloneWorkspace(definition.workspace),
  )
  const [activePath, setActivePath] = React.useState(() =>
    getInitialFile(definition, workspace),
  )
  const [showFiles, setShowFiles] = React.useState(true)
  const [showConsole, setShowConsole] = React.useState(false)
  const [status, setStatus] = React.useState<WorkbenchStatus>('idle')
  const [error, setError] = React.useState('')
  const [consoleEntries, setConsoleEntries] = React.useState<
    Array<ConsoleEntry>
  >([])
  const [sourceDocument, setSourceDocument] = React.useState('')
  const [frameHeight, setFrameHeight] = React.useState<number>()
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
    setFrameHeight(undefined)
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

      if (message.kind === 'height') {
        setFrameHeight(message.height)
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
        files: { ...current.files, [activePath]: source },
        imports: current.imports,
      })
      onWorkspaceChange?.(next)
      return next
    })
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
      className={`not-prose flex min-h-[680px] flex-col overflow-hidden rounded-lg border border-border-default bg-background-default text-text-primary ${className ?? ''}`}
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
              onClick={() => setShowFiles((open) => !open)}
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
              onClick={() => setShowConsole((open) => !open)}
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

      <div className="grid min-h-0 flex-1 lg:grid-cols-2">
        <section className="flex min-h-0 border-b border-border-default lg:border-r lg:border-b-0">
          <FileExplorer
            currentPath={activePath}
            files={fileTree}
            isSidebarOpen={showFiles}
            libraryColor="bg-emerald-500"
            prefetchFileContent={() => {}}
            setCurrentPath={setActivePath}
          />
          <div className="flex min-w-0 flex-1 flex-col bg-gray-950">
            <div className="fade-x flex min-h-9 shrink-0 overflow-x-auto border-b border-gray-800">
              {filePaths.map((path) => (
                <button
                  key={path}
                  type="button"
                  title={path}
                  onClick={() => setActivePath(path)}
                  className={`shrink-0 border-r border-gray-800 px-3 font-mono text-xs ${
                    activePath === path
                      ? 'bg-gray-900 text-gray-100'
                      : 'text-gray-500 hover:bg-gray-900/60 hover:text-gray-300'
                  }`}
                >
                  {path.split('/').pop()}
                </button>
              ))}
            </div>
            <div className="min-h-[400px] flex-1">
              <CodeMirrorEditor
                path={activePath}
                value={activeSource}
                onChange={updateActiveSource}
                onRun={() => void run()}
              />
            </div>
          </div>
        </section>

        <section
          className={`grid min-h-0 ${showConsole ? 'grid-rows-[minmax(400px,1fr)_minmax(120px,180px)]' : 'grid-rows-1'}`}
        >
          <div className="min-h-[400px] overflow-auto bg-white dark:bg-gray-950">
            {sourceDocument ? (
              <iframe
                ref={frameRef}
                title={`${definition.title} output`}
                sandbox="allow-scripts"
                srcDoc={sourceDocument}
                onLoad={syncTheme}
                style={
                  frameHeight === undefined
                    ? undefined
                    : { height: frameHeight }
                }
                className="block min-h-full w-full border-0 bg-white dark:bg-gray-950"
              />
            ) : null}
          </div>
          {showConsole ? (
            <div
              role="log"
              aria-label="Console output"
              className="overflow-auto border-t border-gray-800 bg-gray-950 p-3 font-mono text-xs leading-5 text-gray-200"
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
                <span className="text-gray-500">No console output</span>
              )}
            </div>
          ) : null}
        </section>
      </div>

      {error ? (
        <pre className="max-h-32 overflow-auto border-t border-red-500/20 bg-red-950 p-3 font-mono text-xs whitespace-pre-wrap text-red-300">
          {error}
        </pre>
      ) : null}
    </section>
  )
}

function cloneWorkspace(workspace: ExampleWorkspace) {
  return createExampleWorkspace({
    entry: workspace.entry,
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
      return 'text-red-400'
    case 'warn':
      return 'text-amber-300'
    case 'info':
      return 'text-blue-300'
    case 'debug':
      return 'text-gray-500'
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
