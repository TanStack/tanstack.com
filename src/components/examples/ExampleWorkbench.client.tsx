import * as React from 'react'
import {
  ArrowClockwiseIcon,
  BrowserIcon,
  ChatCircleDotsIcon,
  CodeIcon,
  FolderOpenIcon,
  PlayIcon,
  PlusIcon,
  ShareIcon,
  TerminalWindowIcon,
  XIcon,
} from '@phosphor-icons/react'
import { ButtonGroup } from '~/components/ButtonGroup'
import { FileExplorer, type FileExplorerNode } from '~/components/FileExplorer'
import { useTheme } from '~/components/ThemeProvider'
import { Button } from '~/components/ds/ui'
import { Tooltip } from '~/ui'
import { copyTextToClipboard } from '~/utils/browser-effects'
import { compileExampleWorkspace } from '~/utils/example-esbuild.client'
import {
  createWebContainerExampleSession,
  getExampleWebContainerSupport,
  type WebContainerExampleSession,
} from '~/utils/example-webcontainer.client'
import { createSharedExampleProject } from '~/utils/example-project'
import { createSharedExampleUrl } from '~/utils/example-share.client'
import {
  createExampleSandboxDocument,
  isExampleSandboxBrowserMessage,
  isExampleSandboxMessage,
  postExampleSandboxBrowserCommand,
  postExampleSandboxTheme,
  type ExampleConsoleLevel,
  type ExampleSandboxStatus,
} from '~/utils/example-sandbox.client'
import {
  canGoBackInExamplePreview,
  canGoForwardInExamplePreview,
  createExamplePreviewHistory,
  normalizeExamplePreviewUrl,
  updateExamplePreviewHistory,
} from '~/utils/example-preview-history'
import {
  createExampleWorkspace,
  type ExampleDefinition,
  type ExampleWorkspace,
} from '~/utils/example-workspace'
import { CodeMirrorEditor } from './CodeMirrorEditor.client'
import {
  SandboxBrowser,
  type SandboxBrowserAnnotationTarget,
} from './SandboxBrowser.client'

const LazyWebContainerTerminalPanel = React.lazy(() =>
  import('./WebContainerTerminal.client').then((module) => ({
    default: module.WebContainerTerminalPanel,
  })),
)

const LazyWebContainerProcessTerminalPanel = React.lazy(() =>
  import('./WebContainerTerminal.client').then((module) => ({
    default: module.WebContainerProcessTerminalPanel,
  })),
)

type WorkbenchStatus =
  | 'booting'
  | 'compiling'
  | 'idle'
  | 'installing'
  | 'mounting'
  | 'starting'
  | 'stopped'
  | 'unsupported'
  | ExampleSandboxStatus
type ConsoleEntry = {
  id: number
  level: ExampleConsoleLevel
  values: Array<string>
}
type ProcessOutput = {
  generation: number
  offset: number
  value: string
}
type WebContainerAvailability =
  | { status: 'checking' | 'reloading' | 'supported' }
  | { reason: string; status: 'unsupported' }
type MobileView = 'code' | 'output' | 'preview'
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
const MAX_PROCESS_OUTPUT_LENGTH = 500_000
const RUN_SETTLE_DELAY_MS = 750
const CLIENT_RUN_TIMEOUT_MS = 15_000
const WEBCONTAINER_RUN_TIMEOUT_MS = 120_000

export type ExampleWorkbenchRunResult =
  | { ok: true }
  | {
      ok: false
      phase:
        | 'aborted'
        | 'compile'
        | 'runtime'
        | 'superseded'
        | 'timeout'
        | 'unsupported'
      message: string
    }

export type ExampleWorkbenchHandle = {
  replaceWorkspace(workspace: ExampleWorkspace): void
  replaceWorkspaceAndRun(
    workspace: ExampleWorkspace,
    signal?: AbortSignal,
  ): Promise<ExampleWorkbenchRunResult>
}

export type ExampleWorkbenchRunRequest = {
  id: string
  onComplete(result: ExampleWorkbenchRunResult): void
  signal?: AbortSignal
}

export type ExampleWorkbenchPreviewOptions = {
  defaultDisplay?: 'collapsed' | 'expanded'
  revealOnPush?: boolean
}

type PendingWorkbenchRun = {
  abortListener?: () => void
  abortSignal?: AbortSignal
  readyTimeout?: number
  resolve(result: ExampleWorkbenchRunResult): void
  timeout: number
  token: string
}
type PendingPreviewCapture = {
  reject(cause: Error): void
  requestId: string
  resolve(blob: Blob): void
  timeout: number
}

export function ExampleWorkbench({
  allowSharing = false,
  alternateEditor,
  autoRun,
  className,
  definition,
  fallbackAction,
  filesInitiallyOpen = false,
  fullscreen = false,
  libraryColor = 'bg-emerald-500',
  onWorkspaceChange,
  preview,
  runLabel = 'Run example',
  runRequest,
  workbenchRef,
}: {
  allowSharing?: boolean
  alternateEditor?: {
    active: boolean
    content: React.ReactNode
    label: string
    onActiveChange(active: boolean): void
  }
  autoRun?: boolean
  className?: string
  definition: ExampleDefinition
  fallbackAction?: { label: string; url: string }
  filesInitiallyOpen?: boolean
  fullscreen?: boolean
  libraryColor?: string
  onWorkspaceChange?: (workspace: ExampleWorkspace) => void
  preview?: ExampleWorkbenchPreviewOptions
  runLabel?: string
  runRequest?: ExampleWorkbenchRunRequest
  workbenchRef?: React.Ref<ExampleWorkbenchHandle>
}) {
  const { resolvedTheme } = useTheme()
  const codePanelId = React.useId()
  const outputPanelId = React.useId()
  const previewPanelId = React.useId()
  const processPanelId = React.useId()
  const [workspace, setWorkspace] = React.useState(() =>
    cloneWorkspace(definition.workspace),
  )
  const alternateEditorActive = alternateEditor?.active ?? false
  const workspaceRef = React.useRef(workspace)
  const [activePath, setActivePath] = React.useState(() =>
    getInitialFile(definition, workspace),
  )
  const previewExpandedByDefault = preview?.defaultDisplay !== 'collapsed'
  const revealPreviewOnPush = preview?.revealOnPush ?? true
  const [mobileView, setMobileView] = React.useState<MobileView>(() =>
    previewExpandedByDefault ? 'preview' : 'code',
  )
  const [isDesktop, setIsDesktop] = React.useState(false)
  const [showFiles, setShowFiles] = React.useState(filesInitiallyOpen)
  const [showPreview, setShowPreview] = React.useState(previewExpandedByDefault)
  const [showConsole, setShowConsole] = React.useState(false)
  const [outputActivated, setOutputActivated] = React.useState(false)
  const [terminalIds, setTerminalIds] = React.useState<Array<number>>([])
  const [activeTerminalId, setActiveTerminalId] = React.useState<
    number | 'process'
  >('process')
  const [codePanelPercent, setCodePanelPercent] = React.useState(
    DEFAULT_CODE_PANEL_PERCENT,
  )
  const [isCodePanelResizing, setIsCodePanelResizing] = React.useState(false)
  const [status, setStatus] = React.useState<WorkbenchStatus>('idle')
  const [error, setError] = React.useState('')
  const [consoleEntries, setConsoleEntries] = React.useState<
    Array<ConsoleEntry>
  >([])
  const [processOutput, setProcessOutput] = React.useState<ProcessOutput>({
    generation: 0,
    offset: 0,
    value: '',
  })
  const [sourceDocument, setSourceDocument] = React.useState('')
  const [previewUrl, setPreviewUrl] = React.useState('')
  const [previewHistory, setPreviewHistory] = React.useState(() =>
    createExamplePreviewHistory(),
  )
  const previewHistoryRef = React.useRef(previewHistory)
  const [previewNavigationError, setPreviewNavigationError] = React.useState('')
  const [previewAnnotationMode, setPreviewAnnotationModeActive] =
    React.useState(false)
  const [previewAnnotationTarget, setPreviewAnnotationTarget] =
    React.useState<SandboxBrowserAnnotationTarget>()
  const [webContainerSession, setWebContainerSession] = React.useState<
    WebContainerExampleSession | undefined
  >()
  const [webContainerAvailability, setWebContainerAvailability] =
    React.useState<WebContainerAvailability>({ status: 'checking' })
  const [shareState, setShareState] = React.useState<
    'idle' | 'sharing' | 'copied'
  >('idle')
  const frameRef = React.useRef<HTMLIFrameElement>(null)
  const splitRef = React.useRef<HTMLDivElement>(null)
  const codePanelRef = React.useRef<HTMLElement>(null)
  const previewPanelRef = React.useRef<HTMLElement>(null)
  const codeResizeRef = React.useRef<CodePanelResize>(null)
  const runTokenRef = React.useRef('')
  const browserChannelRef = React.useRef(crypto.randomUUID())
  const compileRequestRef = React.useRef(0)
  const nextConsoleIdRef = React.useRef(0)
  const nextTerminalIdRef = React.useRef(1)
  const pendingProcessOutputRef = React.useRef('')
  const pendingProcessOutputOffsetRef = React.useRef(0)
  const processOutputFrameRef = React.useRef<number>(undefined)
  const webContainerSessionRef = React.useRef<WebContainerExampleSession>(null)
  const pendingWebContainerWritesRef = React.useRef(new Map<string, string>())
  const webContainerWriteTimeoutRef = React.useRef<number>(undefined)
  const handledRunDefinitionRef = React.useRef<ExampleDefinition>(null)
  const pendingRunRef = React.useRef<PendingWorkbenchRun | undefined>(undefined)
  const pendingPreviewCaptureRef = React.useRef<
    PendingPreviewCapture | undefined
  >(undefined)
  const handledRunRequestRef = React.useRef<string | undefined>(undefined)
  const usesWebContainer = definition.runtime?.type === 'webcontainer'
  const shouldAutoRun = autoRun ?? !usesWebContainer

  React.useEffect(() => {
    previewHistoryRef.current = previewHistory
  }, [previewHistory])

  const cancelPreviewCapture = React.useCallback((message: string) => {
    const pending = pendingPreviewCaptureRef.current
    if (!pending) return
    window.clearTimeout(pending.timeout)
    pendingPreviewCaptureRef.current = undefined
    pending.reject(new Error(message))
  }, [])

  const finishRun = React.useCallback(
    (token: string, result: ExampleWorkbenchRunResult) => {
      const pending = pendingRunRef.current
      if (!pending || pending.token !== token) return

      window.clearTimeout(pending.timeout)
      if (pending.readyTimeout !== undefined) {
        window.clearTimeout(pending.readyTimeout)
      }
      if (pending.abortSignal && pending.abortListener) {
        pending.abortSignal.removeEventListener('abort', pending.abortListener)
      }
      pendingRunRef.current = undefined
      pending.resolve(result)
    },
    [],
  )

  const finishCurrentRun = React.useCallback(
    (result: ExampleWorkbenchRunResult) => {
      const token = pendingRunRef.current?.token
      if (token) finishRun(token, result)
    },
    [finishRun],
  )

  const beginRun = React.useCallback(
    (token: string, signal?: AbortSignal) => {
      finishCurrentRun({
        ok: false,
        phase: 'superseded',
        message: 'The preview restarted before the previous run finished.',
      })

      return new Promise<ExampleWorkbenchRunResult>((resolve) => {
        const timeout = window.setTimeout(
          () =>
            finishRun(token, {
              ok: false,
              phase: 'timeout',
              message: 'The preview did not become ready in time.',
            }),
          usesWebContainer
            ? WEBCONTAINER_RUN_TIMEOUT_MS
            : CLIENT_RUN_TIMEOUT_MS,
        )
        const pending: PendingWorkbenchRun = { resolve, timeout, token }
        pendingRunRef.current = pending

        if (signal) {
          const abortListener = () =>
            finishRun(token, {
              ok: false,
              phase: 'aborted',
              message: 'The notebook run was stopped.',
            })
          pending.abortListener = abortListener
          pending.abortSignal = signal
          signal.addEventListener('abort', abortListener, { once: true })
          if (signal.aborted) abortListener()
        }
      })
    },
    [finishCurrentRun, finishRun, usesWebContainer],
  )

  const finishRunAfterQuietPeriod = React.useCallback(
    (token: string) => {
      const pending = pendingRunRef.current
      if (!pending || pending.token !== token) return
      if (pending.readyTimeout !== undefined) {
        window.clearTimeout(pending.readyTimeout)
      }
      pending.readyTimeout = window.setTimeout(
        () => finishRun(token, { ok: true }),
        RUN_SETTLE_DELAY_MS,
      )
    },
    [finishRun],
  )

  const flushProcessOutput = React.useCallback(() => {
    processOutputFrameRef.current = undefined
    const pending = pendingProcessOutputRef.current
    const pendingOffset = pendingProcessOutputOffsetRef.current
    pendingProcessOutputRef.current = ''
    pendingProcessOutputOffsetRef.current = 0
    if (!pending && !pendingOffset) return

    setProcessOutput((current) => {
      const value = current.value + pending
      const overflow = Math.max(0, value.length - MAX_PROCESS_OUTPUT_LENGTH)
      return {
        generation: current.generation,
        offset: current.offset + pendingOffset + overflow,
        value: overflow ? value.slice(overflow) : value,
      }
    })
  }, [])

  const appendProcessOutput = React.useCallback(
    (value: string) => {
      const pending = pendingProcessOutputRef.current + value
      const overflow = Math.max(0, pending.length - MAX_PROCESS_OUTPUT_LENGTH)
      pendingProcessOutputRef.current = overflow
        ? pending.slice(overflow)
        : pending
      pendingProcessOutputOffsetRef.current += overflow
      if (processOutputFrameRef.current !== undefined) return
      processOutputFrameRef.current =
        window.requestAnimationFrame(flushProcessOutput)
    },
    [flushProcessOutput],
  )

  const resetProcessOutput = React.useCallback(() => {
    if (processOutputFrameRef.current !== undefined) {
      window.cancelAnimationFrame(processOutputFrameRef.current)
      processOutputFrameRef.current = undefined
    }
    pendingProcessOutputRef.current = ''
    pendingProcessOutputOffsetRef.current = 0
    setProcessOutput((current) => ({
      generation: current.generation + 1,
      offset: 0,
      value: '',
    }))
  }, [])

  const revealWebContainerOutput = React.useCallback(() => {
    setOutputActivated(true)
    setShowConsole(true)
    setMobileView('output')
  }, [])

  React.useEffect(() => {
    finishCurrentRun({
      ok: false,
      phase: 'superseded',
      message: 'The notebook changed before the preview finished.',
    })
    compileRequestRef.current += 1
    cancelPreviewCapture('The preview changed before capture completed.')
    browserChannelRef.current = crypto.randomUUID()
    webContainerSessionRef.current?.dispose()
    webContainerSessionRef.current = null
    setWebContainerSession(undefined)
    pendingWebContainerWritesRef.current.clear()
    if (webContainerWriteTimeoutRef.current !== undefined) {
      window.clearTimeout(webContainerWriteTimeoutRef.current)
      webContainerWriteTimeoutRef.current = undefined
    }

    const nextWorkspace = cloneWorkspace(definition.workspace)
    workspaceRef.current = nextWorkspace
    setWorkspace(nextWorkspace)
    setActivePath(getInitialFile(definition, nextWorkspace))
    setConsoleEntries([])
    resetProcessOutput()
    setError('')
    setPreviewUrl('')
    const initialPreviewHistory = createExamplePreviewHistory()
    previewHistoryRef.current = initialPreviewHistory
    setPreviewHistory(initialPreviewHistory)
    setPreviewNavigationError('')
    setPreviewAnnotationModeActive(false)
    setPreviewAnnotationTarget(undefined)
    setSourceDocument('')
    setStatus('idle')
    setMobileView(previewExpandedByDefault ? 'preview' : 'code')
    setShowPreview(previewExpandedByDefault)
    setShowConsole(false)
    setOutputActivated(false)
    setTerminalIds([])
    setActiveTerminalId('process')
    nextTerminalIdRef.current = 1
  }, [
    cancelPreviewCapture,
    definition,
    finishCurrentRun,
    previewExpandedByDefault,
    resetProcessOutput,
  ])

  React.useEffect(() => {
    if (!usesWebContainer) {
      setWebContainerAvailability({ status: 'supported' })
      return
    }

    const support = getExampleWebContainerSupport()
    const reloadKey = `tanstack-webcontainer-reload:${window.location.pathname}${window.location.search}`

    if (support.supported) {
      try {
        window.sessionStorage.removeItem(reloadKey)
      } catch {
        // Storage access is not required once the document is isolated.
      }
      setWebContainerAvailability({ status: 'supported' })
      return
    }

    if (window.isSecureContext && !window.crossOriginIsolated) {
      let shouldReload = false
      try {
        shouldReload = window.sessionStorage.getItem(reloadKey) !== '1'
        if (shouldReload) window.sessionStorage.setItem(reloadKey, '1')
      } catch {
        // Without per-tab storage, reloading could create a loop.
      }

      if (shouldReload) {
        setWebContainerAvailability({ status: 'reloading' })
        window.location.reload()
        return
      }
    }

    setWebContainerAvailability({
      reason: support.reason,
      status: 'unsupported',
    })
    setStatus('unsupported')
  }, [definition, usesWebContainer])

  React.useEffect(
    () => () => {
      cancelPreviewCapture('The preview closed before capture completed.')
      finishCurrentRun({
        ok: false,
        phase: 'superseded',
        message: 'The preview closed before the run finished.',
      })
      webContainerSessionRef.current?.dispose()
      if (webContainerWriteTimeoutRef.current !== undefined) {
        window.clearTimeout(webContainerWriteTimeoutRef.current)
      }
      if (processOutputFrameRef.current !== undefined) {
        window.cancelAnimationFrame(processOutputFrameRef.current)
      }
    },
    [cancelPreviewCapture, finishCurrentRun],
  )

  const flushWebContainerWrites = React.useCallback(async () => {
    if (webContainerWriteTimeoutRef.current !== undefined) {
      window.clearTimeout(webContainerWriteTimeoutRef.current)
      webContainerWriteTimeoutRef.current = undefined
    }

    const session = webContainerSessionRef.current
    if (!session) return

    const pendingWrites = pendingWebContainerWritesRef.current
    const writes = [...pendingWrites]

    try {
      for (const [path, source] of writes) {
        await session.writeFile(path, source)
      }
    } catch (cause) {
      if (webContainerSessionRef.current === session) {
        setError(formatError(cause))
        setStatus('error')
      }
      throw cause
    }

    for (const [path, source] of writes) {
      if (pendingWrites.get(path) === source) pendingWrites.delete(path)
    }
  }, [])

  const scheduleWebContainerWrite = React.useCallback(
    (path: string, source: string) => {
      if (!webContainerSessionRef.current) return

      pendingWebContainerWritesRef.current.set(path, source)
      if (webContainerWriteTimeoutRef.current !== undefined) {
        window.clearTimeout(webContainerWriteTimeoutRef.current)
      }
      webContainerWriteTimeoutRef.current = window.setTimeout(
        () => void flushWebContainerWrites().catch(() => undefined),
        150,
      )
    },
    [flushWebContainerWrites],
  )

  const replaceWorkspace = React.useCallback(
    (nextWorkspace: ExampleWorkspace) => {
      const next = cloneWorkspace(nextWorkspace)
      const current = workspaceRef.current

      if (usesWebContainer) {
        for (const [path, source] of Object.entries(next.files)) {
          if (current.files[path] !== source) {
            scheduleWebContainerWrite(path, source)
          }
        }
      }

      workspaceRef.current = next
      setWorkspace(next)
      setActivePath((path) =>
        next.files[path] === undefined
          ? getInitialFile(definition, next)
          : path,
      )
      onWorkspaceChange?.(next)
    },
    [
      definition,
      onWorkspaceChange,
      scheduleWebContainerWrite,
      usesWebContainer,
    ],
  )

  const run = React.useCallback(
    (signal?: AbortSignal): Promise<ExampleWorkbenchRunResult> => {
      handledRunDefinitionRef.current = definition

      if (signal?.aborted) {
        return Promise.resolve({
          ok: false,
          phase: 'aborted',
          message: 'The notebook run was stopped.',
        })
      }

      setPreviewAnnotationModeActive(false)
      setPreviewAnnotationTarget(undefined)
      postExampleSandboxBrowserCommand({
        channel: browserChannelRef.current,
        command: { kind: 'annotation', enabled: false },
        frame: frameRef.current,
        targetOrigin: getPreviewTargetOrigin(frameRef.current?.src ?? ''),
      })

      const request = compileRequestRef.current + 1
      compileRequestRef.current = request
      const runToken = crypto.randomUUID()
      runTokenRef.current = runToken
      const result = beginRun(runToken, signal)
      nextConsoleIdRef.current = 0
      setConsoleEntries([])
      resetProcessOutput()
      setError('')

      void (async () => {
        try {
          const currentWorkspace = workspaceRef.current
          if (definition.runtime?.type === 'webcontainer') {
            const support = getExampleWebContainerSupport()
            if (!support.supported) {
              setWebContainerAvailability({
                reason: support.reason,
                status: 'unsupported',
              })
              setStatus('unsupported')
              finishRun(runToken, {
                ok: false,
                phase: 'unsupported',
                message: support.reason,
              })
              return
            }

            const currentSession = webContainerSessionRef.current
            if (currentSession) {
              setStatus('starting')
              await flushWebContainerWrites()
              await currentSession.restart()
              return
            }

            setStatus('booting')
            const session = createWebContainerExampleSession({
              browserChannel: browserChannelRef.current,
              onEvent(event) {
                switch (event.kind) {
                  case 'error':
                    revealWebContainerOutput()
                    setError(event.message)
                    setStatus('error')
                    finishCurrentRun({
                      ok: false,
                      phase: 'runtime',
                      message: event.message,
                    })
                    break
                  case 'output':
                    appendProcessOutput(event.value)
                    break
                  case 'preview':
                    {
                      const currentHistory = previewHistoryRef.current
                      const currentUrl =
                        currentHistory.entries[currentHistory.index] ?? '/'
                      const nextUrl = preservePreviewLocation(
                        event.url,
                        currentUrl,
                      )
                      const nextHistory =
                        currentHistory.entries.length === 1 &&
                        currentHistory.entries[0] === '/'
                          ? createExamplePreviewHistory(nextUrl)
                          : updateExamplePreviewHistory(currentHistory, {
                              kind: 'replace',
                              url: nextUrl,
                            })
                      previewHistoryRef.current = nextHistory
                      setPreviewHistory(nextHistory)
                      setPreviewUrl(nextUrl)
                    }
                    break
                  case 'preview-error':
                    appendProcessOutput(`\r\nerror ${event.message}\r\n`)
                    finishCurrentRun({
                      ok: false,
                      phase: 'runtime',
                      message: event.message,
                    })
                    if (event.fatal) {
                      revealWebContainerOutput()
                      setError(event.message)
                      setStatus('error')
                    }
                    break
                  case 'status': {
                    if (
                      event.status === 'starting' ||
                      event.status === 'stopped'
                    ) {
                      setPreviewUrl('')
                    }
                    setStatus(event.status)
                    if (event.status === 'stopped') {
                      finishCurrentRun({
                        ok: false,
                        phase: 'runtime',
                        message:
                          'The notebook server stopped before it was ready.',
                      })
                    }
                    break
                  }
                  case 'superseded':
                    webContainerSessionRef.current = null
                    setWebContainerSession(undefined)
                    setTerminalIds([])
                    setActiveTerminalId('process')
                    pendingWebContainerWritesRef.current.clear()
                    if (webContainerWriteTimeoutRef.current !== undefined) {
                      window.clearTimeout(webContainerWriteTimeoutRef.current)
                      webContainerWriteTimeoutRef.current = undefined
                    }
                    setPreviewUrl('')
                    setError(
                      'This example stopped because another WebContainer example started in this tab.',
                    )
                    setStatus('stopped')
                    finishCurrentRun({
                      ok: false,
                      phase: 'superseded',
                      message:
                        'Another WebContainer notebook started in this tab.',
                    })
                    break
                }
              },
              runtime: definition.runtime,
              workspace: currentWorkspace,
            })
            webContainerSessionRef.current = session
            setWebContainerSession(session)
            await session.start()
            return
          }

          setStatus('compiling')
          const compiled = await compileExampleWorkspace(currentWorkspace)
          if (request !== compileRequestRef.current) return

          setSourceDocument(
            createExampleSandboxDocument({
              binaryFiles: currentWorkspace.binaryFiles,
              browserChannel: browserChannelRef.current,
              compiled,
              document: currentWorkspace.files['/index.html'],
              entry: currentWorkspace.entry,
              files: currentWorkspace.files,
              runToken,
              theme: readTheme(),
            }),
          )
          setStatus('running')
        } catch (cause) {
          if (request !== compileRequestRef.current) return
          const message = formatError(cause)
          if (definition.runtime?.type === 'webcontainer') {
            if (!webContainerSessionRef.current) return
            revealWebContainerOutput()
            webContainerSessionRef.current?.dispose()
            webContainerSessionRef.current = null
            setWebContainerSession(undefined)
            setTerminalIds([])
            setActiveTerminalId('process')
            setPreviewUrl('')
          }
          setStatus('error')
          setError(message)
          finishRun(runToken, {
            ok: false,
            phase:
              definition.runtime?.type === 'webcontainer'
                ? 'runtime'
                : 'compile',
            message,
          })
        }
      })()

      return result
    },
    [
      appendProcessOutput,
      beginRun,
      definition,
      finishCurrentRun,
      finishRun,
      flushWebContainerWrites,
      revealWebContainerOutput,
      resetProcessOutput,
    ],
  )

  const replaceWorkspaceAndRun = React.useCallback(
    (nextWorkspace: ExampleWorkspace, signal?: AbortSignal) => {
      replaceWorkspace(nextWorkspace)
      return run(signal)
    },
    [replaceWorkspace, run],
  )

  React.useImperativeHandle(
    workbenchRef,
    () => ({ replaceWorkspace, replaceWorkspaceAndRun }),
    [replaceWorkspace, replaceWorkspaceAndRun],
  )

  React.useEffect(() => {
    if (!runRequest || handledRunRequestRef.current === runRequest.id) return
    handledRunRequestRef.current = runRequest.id
    void run(runRequest.signal).then(runRequest.onComplete)
  }, [run, runRequest])

  React.useEffect(() => {
    if (
      !shouldAutoRun ||
      (usesWebContainer && webContainerAvailability.status !== 'supported') ||
      handledRunDefinitionRef.current === definition
    ) {
      return
    }

    const timeout = window.setTimeout(
      () => {
        if (handledRunDefinitionRef.current === definition) return
        void run()
      },
      usesWebContainer ? 0 : 300,
    )
    return () => window.clearTimeout(timeout)
  }, [
    definition,
    run,
    shouldAutoRun,
    usesWebContainer,
    webContainerAvailability.status,
  ])

  const syncTheme = React.useCallback(() => {
    if (usesWebContainer) return
    postExampleSandboxTheme({
      frame: frameRef.current,
      runToken: runTokenRef.current,
      theme: readTheme(),
    })
  }, [usesWebContainer])

  const handlePreviewLoad = React.useCallback(() => {
    postExampleSandboxBrowserCommand({
      channel: browserChannelRef.current,
      command: { kind: 'annotation', enabled: previewAnnotationMode },
      frame: frameRef.current,
      targetOrigin: getPreviewTargetOrigin(frameRef.current?.src ?? ''),
    })

    if (!usesWebContainer) {
      syncTheme()
      return
    }

    const token = pendingRunRef.current?.token
    if (token) finishRunAfterQuietPeriod(token)
  }, [
    finishRunAfterQuietPeriod,
    previewAnnotationMode,
    syncTheme,
    usesWebContainer,
  ])

  React.useEffect(() => {
    function handleMessage(event: MessageEvent<unknown>) {
      if (event.source !== frameRef.current?.contentWindow) return
      const previewOrigin = getPreviewTargetOrigin(previewUrl)
      if (
        usesWebContainer
          ? previewOrigin === '*' || event.origin !== previewOrigin
          : event.origin !== 'null'
      ) {
        return
      }

      if (
        isExampleSandboxBrowserMessage(event.data, browserChannelRef.current)
      ) {
        const message = event.data
        if (
          message.kind === 'capture-result' ||
          message.kind === 'capture-error'
        ) {
          const pending = pendingPreviewCaptureRef.current
          if (!pending || pending.requestId !== message.requestId) return
          window.clearTimeout(pending.timeout)
          pendingPreviewCaptureRef.current = undefined
          if (message.kind === 'capture-error') {
            pending.reject(new Error(message.message))
          } else {
            pending.resolve(
              new Blob([message.bytes], { type: message.mimeType }),
            )
          }
          return
        }

        if (message.kind === 'browser-state') {
          const trustedUrl = normalizeExamplePreviewUrl({
            mode: usesWebContainer ? 'webcontainer' : 'client',
            previewUrl,
            url: message.url,
          })
          if (!trustedUrl) return
          const currentHistory = previewHistoryRef.current
          const currentUrl = currentHistory.entries[currentHistory.index] ?? '/'

          setPreviewHistory((current) => {
            const next = updateExamplePreviewHistory(current, {
              kind: message.navigationKind,
              url: trustedUrl,
            })
            previewHistoryRef.current = next
            return next
          })
          setPreviewNavigationError('')
          if (message.navigationKind === 'load' || currentUrl !== trustedUrl) {
            setPreviewAnnotationTarget(undefined)
          }
          if (message.navigationKind === 'push' && revealPreviewOnPush) {
            setShowPreview(true)
            setMobileView('preview')
          }
          return
        }

        if (message.kind === 'navigation-error') {
          setPreviewNavigationError(
            usesWebContainer
              ? 'Preview navigation must stay on the current origin.'
              : 'This client preview only supports in-page links.',
          )
          return
        }

        if (!previewAnnotationMode) return
        const currentHistory = previewHistoryRef.current
        const currentUrl = currentHistory.entries[currentHistory.index] ?? '/'
        setPreviewAnnotationTarget({
          rect: message.rect,
          selector: message.selector,
          tagName: message.tag,
          text: message.text,
          url: currentUrl,
        })
        return
      }

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
        if (message.level === 'error') {
          const consoleError =
            message.values.join('\n') || 'The notebook logged an error.'
          setStatus('error')
          setError(consoleError)
          finishRun(message.runToken, {
            ok: false,
            phase: 'runtime',
            message: consoleError,
          })
        }
        return
      }

      if (message.kind === 'theme-request') {
        syncTheme()
        return
      }

      setStatus(message.status)
      setError(message.message ?? '')
      if (message.status === 'ready') {
        finishRunAfterQuietPeriod(message.runToken)
      } else if (message.status === 'error') {
        finishRun(message.runToken, {
          ok: false,
          phase: 'runtime',
          message: message.message || 'The notebook failed while running.',
        })
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [
    finishRun,
    finishRunAfterQuietPeriod,
    previewAnnotationMode,
    revealPreviewOnPush,
    previewUrl,
    syncTheme,
    usesWebContainer,
  ])

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
    const syncDesktopState = () => {
      setIsDesktop(desktop.matches)
    }

    syncDesktopState()
    desktop.addEventListener('change', syncDesktopState)
    return () => desktop.removeEventListener('change', syncDesktopState)
  }, [])

  function updateActiveSource(source: string) {
    if (usesWebContainer) scheduleWebContainerWrite(activePath, source)

    const current = workspaceRef.current
    const next = createExampleWorkspace({
      binaryFiles: current.binaryFiles,
      entry: current.entry,
      environment: current.environment,
      files: { ...current.files, [activePath]: source },
      imports: current.imports,
    })
    workspaceRef.current = next
    setWorkspace(next)
    onWorkspaceChange?.(next)
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
    if (usesWebContainer && !window.matchMedia('(min-width: 1024px)').matches) {
      setShowPreview(true)
      setOutputActivated(true)
      setMobileView((view) => (view === 'output' ? 'preview' : 'output'))
      return
    }

    setMobileView('preview')
    setShowPreview(true)
    if (!showConsole && usesWebContainer) setOutputActivated(true)
    setShowConsole((open) => !open)
  }

  function addTerminal() {
    if (!webContainerSession) return

    const id = nextTerminalIdRef.current
    nextTerminalIdRef.current += 1
    setTerminalIds((current) => [...current, id])
    setActiveTerminalId(id)
    focusTerminalTab(id)
  }

  function closeTerminal(id: number) {
    const index = terminalIds.indexOf(id)
    const next = terminalIds.filter((terminalId) => terminalId !== id)
    const nextActiveTerminalId =
      activeTerminalId === id
        ? (next[index - 1] ?? next[index] ?? 'process')
        : activeTerminalId

    setTerminalIds(next)
    setActiveTerminalId(nextActiveTerminalId)
    focusTerminalTab(nextActiveTerminalId)
  }

  function getTerminalTabId(id: number | 'process') {
    return id === 'process'
      ? `${processPanelId}-tab`
      : `${outputPanelId}-terminal-${id}-tab`
  }

  function focusTerminalTab(id: number | 'process') {
    window.requestAnimationFrame(() => {
      document.getElementById(getTerminalTabId(id))?.focus()
    })
  }

  function navigateTerminalTabs(event: React.KeyboardEvent<HTMLDivElement>) {
    if (
      event.key !== 'ArrowLeft' &&
      event.key !== 'ArrowRight' &&
      event.key !== 'Home' &&
      event.key !== 'End'
    ) {
      return
    }

    const eventTarget = event.target
    if (!(eventTarget instanceof Element)) return
    const currentTab = eventTarget.closest<HTMLButtonElement>('[role="tab"]')
    if (!currentTab) return

    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]:not([disabled])',
      ),
    )
    const currentIndex = tabs.indexOf(currentTab)
    if (currentIndex === -1) return

    event.preventDefault()
    const nextTab =
      event.key === 'Home'
        ? tabs[0]
        : event.key === 'End'
          ? tabs.at(-1)
          : tabs[
              (currentIndex +
                (event.key === 'ArrowRight' ? 1 : -1) +
                tabs.length) %
                tabs.length
            ]

    nextTab?.focus()
    nextTab?.click()
  }

  function togglePreview() {
    const nextShowPreview = !showPreview
    setShowPreview(nextShowPreview)
    if (!nextShowPreview) setShowConsole(false)
  }

  function sendPreviewBrowserCommand(
    command: Parameters<typeof postExampleSandboxBrowserCommand>[0]['command'],
  ) {
    postExampleSandboxBrowserCommand({
      channel: browserChannelRef.current,
      command,
      frame: frameRef.current,
      targetOrigin: getPreviewTargetOrigin(previewUrl),
    })
  }

  function reloadPreview() {
    const frame = frameRef.current
    const session = webContainerSessionRef.current
    if (usesWebContainer && frame && session) {
      void session.reloadPreview(frame).catch((cause: unknown) => {
        setPreviewNavigationError(formatError(cause))
      })
      return
    }
    sendPreviewBrowserCommand({ kind: 'reload' })
  }

  function setPreviewAnnotationMode(active: boolean) {
    setPreviewAnnotationModeActive(active)
    setPreviewAnnotationTarget(undefined)
    sendPreviewBrowserCommand({ kind: 'annotation', enabled: active })
  }

  function clearPreviewAnnotationTarget() {
    setPreviewAnnotationTarget(undefined)
    sendPreviewBrowserCommand({ kind: 'annotation', enabled: true })
  }

  function capturePreview() {
    cancelPreviewCapture('A newer screenshot replaced this capture.')
    const requestId = crypto.randomUUID()

    return new Promise<Blob>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        if (pendingPreviewCaptureRef.current?.requestId !== requestId) return
        pendingPreviewCaptureRef.current = undefined
        reject(new Error('The preview did not return a screenshot.'))
      }, 15_000)

      pendingPreviewCaptureRef.current = {
        reject,
        requestId,
        resolve,
        timeout,
      }
      sendPreviewBrowserCommand({ kind: 'capture', requestId })
    })
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
          hiddenFiles: definition.hiddenFiles,
          runtime: definition.runtime,
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

  const filePaths = Object.keys(workspace.files)
    .filter((path) => !definition.hiddenFiles?.includes(path))
    .sort()
  const fileTree = React.useMemo(() => createFileTree(filePaths), [filePaths])
  const activeSource = workspace.files[activePath] ?? ''
  const statusLabel = getStatusLabel(status)
  const outputLabel = usesWebContainer ? 'terminals' : 'console'
  const webContainerUnsupportedReason =
    usesWebContainer && webContainerAvailability.status === 'unsupported'
      ? webContainerAvailability.reason
      : ''
  const isWebContainerUnsupported = Boolean(webContainerUnsupportedReason)
  const isWebContainerSupportPending =
    usesWebContainer &&
    (webContainerAvailability.status === 'checking' ||
      webContainerAvailability.status === 'reloading')
  const isMobileOutputVisible = usesWebContainer && mobileView === 'output'
  const isOutputShown = usesWebContainer
    ? isDesktop
      ? showConsole
      : isMobileOutputVisible
    : showConsole
  const isWebContainerBusy =
    usesWebContainer &&
    (isWebContainerSupportPending ||
      status === 'booting' ||
      status === 'mounting' ||
      status === 'installing' ||
      status === 'starting')
  const visibleStatusLabel =
    webContainerAvailability.status === 'checking'
      ? 'Checking support'
      : webContainerAvailability.status === 'reloading'
        ? 'Preparing example'
        : statusLabel
  const currentPreviewUrl = previewHistory.entries[previewHistory.index] ?? '/'
  const externalPreviewUrl = usesWebContainer
    ? getExternalPreviewUrl(currentPreviewUrl)
    : undefined

  return (
    <section
      className={`not-prose flex min-w-0 flex-col overflow-hidden border border-border-default bg-background-default text-text-primary ${
        fullscreen
          ? 'min-h-0 flex-1 rounded-none border-x-0 border-b-0'
          : 'h-[clamp(520px,75dvh,720px)] rounded-lg'
      } ${className ?? ''}`}
      aria-label={`${definition.title} workbench`}
    >
      <header className="flex min-h-10 shrink-0 items-center justify-between gap-3 border-b border-border-default px-2">
        <div className="flex min-w-0 items-center gap-2">
          {alternateEditor ? (
            <ButtonGroup
              role="group"
              aria-label="Editor view"
              className="shrink-0 shadow-none"
            >
              <Button
                type="button"
                variant="ghost"
                size="xs"
                rounded="none"
                className="transition-none hover:shadow-none"
                aria-label="Show files and code"
                aria-pressed={!alternateEditorActive}
                onClick={() => {
                  alternateEditor.onActiveChange(false)
                  setMobileView('code')
                }}
              >
                <CodeIcon className="size-3.5" aria-hidden="true" />
                Code
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                rounded="none"
                className="transition-none hover:shadow-none"
                aria-label={`Show ${alternateEditor.label.toLowerCase()}`}
                aria-pressed={alternateEditorActive}
                onClick={() => {
                  alternateEditor.onActiveChange(true)
                  setMobileView('code')
                }}
              >
                <ChatCircleDotsIcon className="size-3.5" aria-hidden="true" />
                {alternateEditor.label}
              </Button>
            </ButtonGroup>
          ) : null}
          {!alternateEditorActive ? (
            <div
              className={`${mobileView === 'code' ? 'flex' : 'hidden'} min-w-0 items-center gap-2 lg:flex`}
            >
              <Tooltip
                content={showFiles ? 'Hide files' : 'Show files'}
                side="bottom"
              >
                <Button
                  type="button"
                  variant="icon"
                  color="gray"
                  size="icon-sm"
                  rounded="md"
                  className={`shrink-0 transition-none active:scale-100 ${showFiles ? 'text-text-primary' : ''}`}
                  aria-pressed={showFiles}
                  aria-label={showFiles ? 'Hide files' : 'Show files'}
                  onClick={toggleFiles}
                >
                  <FolderOpenIcon className="size-3.5" aria-hidden="true" />
                </Button>
              </Tooltip>
              <div className="min-w-0 truncate font-ds-mono text-xs text-text-muted">
                {activePath}
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`hidden text-xs sm:inline ${status === 'error' ? 'text-text-error' : 'text-text-muted'}`}
            role="status"
          >
            {visibleStatusLabel}
          </span>
          <ButtonGroup>
            {allowSharing ? (
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
            ) : null}
            <Tooltip
              content={`${isOutputShown ? 'Hide' : 'Show'} ${outputLabel}`}
              side="bottom"
            >
              <Button
                type="button"
                variant="ghost"
                size="xs"
                rounded="none"
                aria-controls={outputPanelId}
                aria-pressed={isOutputShown}
                aria-label={`${isOutputShown ? 'Hide' : 'Show'} ${outputLabel}`}
                disabled={isWebContainerUnsupported}
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
            <Tooltip
              content={status === 'idle' ? runLabel : 'Refresh preview'}
              side="bottom"
            >
              <Button
                type="button"
                variant="primary"
                size="xs"
                rounded="none"
                className="hover:translate-y-0 max-[899px]:translate-y-0"
                aria-label={status === 'idle' ? runLabel : 'Refresh preview'}
                disabled={isWebContainerBusy || isWebContainerUnsupported}
                onClick={() => void run()}
              >
                {status === 'idle' ? (
                  <PlayIcon className="size-3.5" aria-hidden="true" />
                ) : (
                  <ArrowClockwiseIcon className="size-3.5" aria-hidden="true" />
                )}
              </Button>
            </Tooltip>
          </ButtonGroup>
        </div>
      </header>

      <div className="shrink-0 border-b border-border-default p-1 lg:hidden">
        <ButtonGroup
          role="group"
          aria-label="Workbench view"
          className="flex w-full shadow-none"
        >
          <Button
            type="button"
            variant="ghost"
            size="xs"
            rounded="none"
            className="flex-1 justify-center"
            aria-pressed={mobileView === 'preview'}
            onClick={() => {
              setShowPreview(true)
              setMobileView('preview')
            }}
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
            {alternateEditor ? 'Editor' : 'Code'}
          </Button>
          {usesWebContainer ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              rounded="none"
              className="flex-1 justify-center"
              aria-pressed={mobileView === 'output'}
              disabled={isWebContainerUnsupported}
              onClick={() => {
                setOutputActivated(true)
                setMobileView('output')
              }}
            >
              Console
            </Button>
          ) : null}
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
          <div
            aria-hidden={alternateEditorActive}
            inert={alternateEditorActive}
            className={`${alternateEditorActive ? 'pointer-events-none invisible' : 'visible'} absolute inset-0 flex min-h-0 min-w-0 overflow-hidden`}
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
          </div>
          <div
            aria-hidden={!alternateEditorActive}
            inert={!alternateEditorActive}
            className={`${alternateEditorActive ? 'visible' : 'pointer-events-none invisible'} absolute inset-0 flex min-h-0 min-w-0`}
          >
            {alternateEditor?.content}
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
          className={`${mobileView === 'code' ? 'hidden' : 'grid'} min-h-0 min-w-0 overflow-hidden bg-background-default transition-[flex-grow,min-width,opacity] duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none lg:grid lg:basis-0 ${showPreview ? 'lg:opacity-100' : 'lg:pointer-events-none lg:opacity-0'} ${isMobileOutputVisible ? 'grid-rows-[0_minmax(0,1fr)]' : showConsole && !usesWebContainer ? 'grid-rows-[minmax(0,1fr)_minmax(100px,28%)]' : 'grid-rows-[minmax(0,1fr)_0]'} ${showConsole ? 'lg:grid-rows-[minmax(0,1fr)_minmax(100px,28%)]' : 'lg:grid-rows-[minmax(0,1fr)_0]'}`}
        >
          <div
            className={`${isMobileOutputVisible ? 'hidden lg:block' : 'block'} row-start-1 min-h-0 overflow-hidden bg-background-default`}
          >
            <SandboxBrowser
              annotationAvailable={Boolean(previewUrl || sourceDocument)}
              annotationMode={previewAnnotationMode}
              annotationTarget={previewAnnotationTarget}
              canGoBack={canGoBackInExamplePreview(previewHistory)}
              canGoForward={canGoForwardInExamplePreview(previewHistory)}
              captureScreenshot={
                previewUrl || sourceDocument ? capturePreview : undefined
              }
              currentUrl={currentPreviewUrl}
              error={previewNavigationError}
              history={[...new Set(previewHistory.entries)]}
              navigationAvailable={Boolean(previewUrl || sourceDocument)}
              onAnnotationModeChange={setPreviewAnnotationMode}
              onBack={() => sendPreviewBrowserCommand({ kind: 'back' })}
              onClearAnnotationTarget={clearPreviewAnnotationTarget}
              onForward={() => sendPreviewBrowserCommand({ kind: 'forward' })}
              onNavigate={(url) =>
                sendPreviewBrowserCommand({ kind: 'navigate', url })
              }
              onReload={reloadPreview}
              openExternalUrl={externalPreviewUrl}
            >
              {previewUrl ? (
                <iframe
                  ref={frameRef}
                  title={`${definition.title} output`}
                  allow="cross-origin-isolated"
                  sandbox="allow-forms allow-same-origin allow-scripts"
                  src={previewUrl}
                  onLoad={handlePreviewLoad}
                  className="block size-full border-0 bg-background-default"
                />
              ) : sourceDocument ? (
                <iframe
                  ref={frameRef}
                  title={`${definition.title} output`}
                  sandbox="allow-scripts"
                  srcDoc={sourceDocument}
                  onLoad={handlePreviewLoad}
                  className="block size-full border-0 bg-background-default"
                />
              ) : (
                <div className="flex size-full items-center justify-center p-6">
                  {isWebContainerUnsupported ? (
                    <div className="max-w-md text-center">
                      <p className="text-sm text-text-muted">
                        {webContainerUnsupportedReason}
                      </p>
                      {fallbackAction ? (
                        <a
                          href={fallbackAction.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {fallbackAction.label}
                        </a>
                      ) : null}
                    </div>
                  ) : isWebContainerBusy || status === 'compiling' ? (
                    <div
                      className="flex items-center gap-2 text-sm text-text-muted"
                      role="status"
                    >
                      <ArrowClockwiseIcon
                        className="size-4 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                      {visibleStatusLabel}
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => void run()}
                    >
                      <PlayIcon className="size-4" aria-hidden="true" />
                      {status === 'error' ? 'Try again' : runLabel}
                    </Button>
                  )}
                </div>
              )}
            </SandboxBrowser>
          </div>
          {usesWebContainer ? (
            outputActivated ? (
              <div
                id={outputPanelId}
                className={`${isMobileOutputVisible ? 'grid' : 'hidden'} row-start-2 min-h-0 grid-rows-[2rem_minmax(0,1fr)] border-t border-border-default bg-background-default ${showConsole ? 'lg:grid' : 'lg:hidden'}`}
              >
                <div className="flex min-w-0 items-stretch border-b border-border-default">
                  <div
                    role="tablist"
                    aria-label="Terminals"
                    onKeyDown={navigateTerminalTabs}
                    className="fade-x flex min-w-0 flex-1 items-stretch overflow-x-auto px-2"
                  >
                    <button
                      type="button"
                      role="tab"
                      id={getTerminalTabId('process')}
                      aria-controls={processPanelId}
                      aria-selected={activeTerminalId === 'process'}
                      tabIndex={activeTerminalId === 'process' ? 0 : -1}
                      className="h-full shrink-0 border-b-2 border-transparent px-2 font-ds-mono text-[11px] text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus aria-selected:border-text-primary aria-selected:text-text-primary"
                      onClick={() => setActiveTerminalId('process')}
                    >
                      Process
                    </button>

                    {terminalIds.map((id) => {
                      const label = `Terminal ${id}`
                      const panelId = `${outputPanelId}-terminal-${id}`
                      const tabId = getTerminalTabId(id)

                      return (
                        <div
                          key={id}
                          className={`flex h-full shrink-0 items-center border-b-2 border-transparent ${activeTerminalId === id ? 'border-text-primary text-text-primary' : 'text-text-muted'}`}
                        >
                          <button
                            type="button"
                            role="tab"
                            id={tabId}
                            aria-controls={panelId}
                            aria-selected={activeTerminalId === id}
                            tabIndex={activeTerminalId === id ? 0 : -1}
                            className="h-full py-0 pr-1 pl-2 font-ds-mono text-[11px] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                            onClick={() => setActiveTerminalId(id)}
                          >
                            {label}
                          </button>
                          <Tooltip content={`Close ${label}`} side="bottom">
                            <button
                              type="button"
                              aria-label={`Close ${label}`}
                              className="mr-1 flex size-5 items-center justify-center rounded-sm text-text-muted hover:bg-background-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                              onClick={() => closeTerminal(id)}
                            >
                              <XIcon className="size-3" aria-hidden="true" />
                            </button>
                          </Tooltip>
                        </div>
                      )
                    })}
                  </div>
                  <Tooltip content="New terminal" side="bottom">
                    <button
                      type="button"
                      aria-label="New terminal"
                      disabled={!webContainerSession || isWebContainerBusy}
                      className="flex w-8 shrink-0 items-center justify-center border-l border-border-default text-text-muted hover:bg-background-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={addTerminal}
                    >
                      <PlusIcon className="size-3.5" aria-hidden="true" />
                    </button>
                  </Tooltip>
                </div>
                <div className="relative min-h-0">
                  <div
                    id={processPanelId}
                    role="tabpanel"
                    aria-labelledby={getTerminalTabId('process')}
                    hidden={activeTerminalId !== 'process'}
                    inert={activeTerminalId !== 'process'}
                    className="absolute inset-0 min-h-0"
                  >
                    <React.Suspense
                      fallback={
                        <div
                          role="status"
                          className="flex size-full items-center justify-center text-xs text-text-muted"
                        >
                          Loading process output
                        </div>
                      }
                    >
                      <LazyWebContainerProcessTerminalPanel
                        active={activeTerminalId === 'process'}
                        generation={processOutput.generation}
                        offset={processOutput.offset}
                        output={processOutput.value}
                        theme={resolvedTheme}
                      />
                    </React.Suspense>
                  </div>

                  {terminalIds.map((id) => {
                    const label = `Terminal ${id}`
                    const panelId = `${outputPanelId}-terminal-${id}`
                    const tabId = getTerminalTabId(id)

                    return webContainerSession ? (
                      <div
                        key={id}
                        id={panelId}
                        role="tabpanel"
                        aria-label={label}
                        aria-labelledby={tabId}
                        hidden={activeTerminalId !== id}
                        inert={activeTerminalId !== id}
                        className="absolute inset-0 min-h-0"
                      >
                        <React.Suspense
                          fallback={
                            <div
                              role="status"
                              className="flex size-full items-center justify-center text-xs text-text-muted"
                            >
                              Loading terminal
                            </div>
                          }
                        >
                          <LazyWebContainerTerminalPanel
                            active={activeTerminalId === id}
                            session={webContainerSession}
                            theme={resolvedTheme}
                          />
                        </React.Suspense>
                      </div>
                    ) : null
                  })}
                </div>
              </div>
            ) : null
          ) : showConsole ? (
            <ConsoleOutput
              id={outputPanelId}
              className="border-t border-border-default"
              entries={consoleEntries}
              label="Console output"
            />
          ) : null}
        </section>
      </div>

      {error ? (
        <div className="flex max-h-32 items-start justify-between gap-3 overflow-auto border-t border-border-error bg-status-error-bg p-3">
          <pre className="min-w-0 font-ds-mono text-xs whitespace-pre-wrap text-text-error">
            {error}
          </pre>
          {fallbackAction ? (
            <a
              href={fallbackAction.url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {fallbackAction.label}
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function ConsoleOutput({
  ariaLabelledBy,
  className = '',
  entries,
  hidden = false,
  id,
  label,
}: {
  ariaLabelledBy?: string
  className?: string
  entries: Array<ConsoleEntry>
  hidden?: boolean
  id: string
  label: string
}) {
  return (
    <div
      id={id}
      role={ariaLabelledBy ? 'tabpanel' : undefined}
      aria-labelledby={ariaLabelledBy}
      hidden={hidden}
      inert={hidden}
      className={`overflow-auto bg-[var(--th-background)] p-3 font-ds-mono text-xs leading-5 text-[var(--th-token)] ${className}`}
    >
      <div role="log" aria-label={label}>
        {entries.length ? (
          entries.map((entry) => (
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
    </div>
  )
}

function cloneWorkspace(workspace: ExampleWorkspace) {
  return createExampleWorkspace({
    binaryFiles: workspace.binaryFiles,
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
    workspace.files[definition.initialFile] !== undefined &&
    !definition.hiddenFiles?.includes(definition.initialFile)
    ? definition.initialFile
    : Object.keys(workspace.files).find(
        (path) => !definition.hiddenFiles?.includes(path),
      ) || workspace.entry
}

function readTheme() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function formatError(error: unknown) {
  return error instanceof Error ? error.stack || error.message : String(error)
}

function getPreviewTargetOrigin(url: string) {
  try {
    return new URL(url).origin
  } catch {
    return '*'
  }
}

function getExternalPreviewUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.href
      : undefined
  } catch {
    return undefined
  }
}

function preservePreviewLocation(baseUrl: string, currentUrl: string) {
  try {
    const base = new URL(baseUrl)
    const current = new URL(currentUrl)
    return new URL(`${current.pathname}${current.search}${current.hash}`, base)
      .href
  } catch {
    return baseUrl
  }
}

function getStatusLabel(status: WorkbenchStatus) {
  switch (status) {
    case 'booting':
      return 'Booting'
    case 'compiling':
      return 'Compiling'
    case 'installing':
      return 'Installing'
    case 'mounting':
      return 'Mounting'
    case 'starting':
      return 'Starting'
    case 'stopped':
      return 'Stopped'
    case 'unsupported':
      return 'Unsupported'
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
