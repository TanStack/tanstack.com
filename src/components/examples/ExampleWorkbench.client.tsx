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
  WarningCircleIcon,
  XIcon,
} from '@phosphor-icons/react'
import { ButtonGroup } from '~/components/ButtonGroup'
import { FileExplorer, type FileExplorerNode } from '~/components/FileExplorer'
import { useTheme } from '~/components/ThemeProvider'
import {
  Button,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
} from '~/components/ds/ui'
import { Tooltip } from '~/ui'
import { copyTextToClipboard } from '~/utils/browser-effects'
import { compileExampleWorkspace } from '~/utils/example-esbuild.client'
import {
  createEmptyExampleEnvironmentSnapshot,
  type ExampleEnvironmentSnapshot,
  type ExampleWorkbenchRunOutcome,
  type ExampleWorkbenchRunResult as ExampleRunResult,
} from '~/utils/example-run-observation'
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
  type ExamplePreviewHistory,
} from '~/utils/example-preview-history'
import {
  activateNotebookWorkbenchTab,
  addNotebookWorkbenchTab,
  closeNotebookWorkbenchTab,
  createNotebookWorkbenchTabsState,
  getNotebookWorkbenchTabLabel,
  getNotebookWorkbenchTabNavigationTarget,
  repairNotebookWorkbenchEditorPaths,
  updateNotebookWorkbenchEditorTab,
  type NewNotebookWorkbenchTab,
  type NotebookWorkbenchTab,
} from '~/utils/notebook-workbench-tabs'
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
const MAX_RUN_CONSOLE_ENTRIES = 50
const MAX_RUN_CONSOLE_CHARACTERS = 16_000
const MAX_RUN_PROCESS_CHARACTERS = 16_000

export type ExampleWorkbenchRunResult = ExampleRunResult

export type ExampleWorkbenchWorkspaceUpdateOptions = {
  notify?: boolean
}

export type ExampleWorkbenchHandle = {
  replaceWorkspace(
    workspace: ExampleWorkspace,
    options?: ExampleWorkbenchWorkspaceUpdateOptions,
  ): void
  replaceWorkspaceAndRun(
    workspace: ExampleWorkspace,
    signal?: AbortSignal,
    options?: ExampleWorkbenchWorkspaceUpdateOptions,
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
  observed?: boolean
  ready?: boolean
  readyTimeout?: number
  resolve(result: ExampleWorkbenchRunResult): void
  timeout: number
  token: string
  workspaceRevision: number
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
  runDisabled = false,
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
  runDisabled?: boolean
  runLabel?: string
  runRequest?: ExampleWorkbenchRunRequest
  workbenchRef?: React.Ref<ExampleWorkbenchHandle>
}) {
  const { resolvedTheme } = useTheme()
  const codePanelId = React.useId()
  const outputPanelId = React.useId()
  const previewPanelId = React.useId()
  const processPanelId = React.useId()
  const notebookTabsId = React.useId()
  const notebookEditorPanelId = React.useId()
  const notebookPreviewPanelId = React.useId()
  const notebookConsolePanelId = React.useId()
  const [workspace, setWorkspace] = React.useState(() =>
    cloneWorkspace(definition.workspace),
  )
  const notebookMode = alternateEditor !== undefined
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
  const [runActive, setRunActive] = React.useState(false)
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
  const [notebookTabs, setNotebookTabs] = React.useState(() =>
    createNotebookWorkbenchTabsState(),
  )
  const notebookTabsRef = React.useRef(notebookTabs)
  const notebookDefinitionIdRef = React.useRef(definition.id)
  const notebookTabButtonRefs = React.useRef(
    new Map<string, HTMLButtonElement>(),
  )
  const notebookAddTabButtonRef = React.useRef<HTMLButtonElement>(null)
  const notebookShowChatButtonRef = React.useRef<HTMLButtonElement>(null)
  const previousNotebookChatOpenRef = React.useRef(
    alternateEditorActive || notebookTabs.tabs.length === 0,
  )
  const notebookPreviewHistoriesRef = React.useRef(
    new Map<string, ExamplePreviewHistory>(),
  )
  const currentNotebookPreviewTabIdRef = React.useRef<string | undefined>(
    undefined,
  )
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
  const [shareError, setShareError] = React.useState('')
  const frameRef = React.useRef<HTMLIFrameElement>(null)
  const splitRef = React.useRef<HTMLDivElement>(null)
  const codePanelRef = React.useRef<HTMLElement>(null)
  const previewPanelRef = React.useRef<HTMLElement>(null)
  const codeResizeRef = React.useRef<CodePanelResize>(null)
  const runTokenRef = React.useRef('')
  const workspaceRevisionRef = React.useRef(0)
  const environmentSnapshotRef = React.useRef<
    ExampleEnvironmentSnapshot | undefined
  >(undefined)
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

  notebookTabsRef.current = notebookTabs

  const revealNotebookPreviewTab = React.useCallback(() => {
    setNotebookTabs((current) => {
      const activeTab = current.tabs.find(
        (tab) => tab.id === current.activeTabId,
      )
      if (activeTab?.kind === 'preview') return current

      const previewTab =
        current.tabs.find(
          (tab) => tab.id === currentNotebookPreviewTabIdRef.current,
        ) ?? current.tabs.find((tab) => tab.kind === 'preview')
      return previewTab
        ? activateNotebookWorkbenchTab(current, previewTab.id)
        : addNotebookWorkbenchTab(current, { kind: 'preview' })
    })
  }, [])

  React.useEffect(() => {
    previewHistoryRef.current = previewHistory
  }, [previewHistory])

  const captureEnvironmentSnapshot = React.useCallback(
    (runId: string): ExampleEnvironmentSnapshot => {
      const snapshot = environmentSnapshotRef.current
      if (!snapshot || snapshot.runId !== runId) {
        return createEmptyExampleEnvironmentSnapshot({
          runId,
          runtime: usesWebContainer ? 'webcontainer' : 'client',
          workspaceRevision: workspaceRevisionRef.current,
        })
      }

      return {
        runId: snapshot.runId,
        workspaceRevision: snapshot.workspaceRevision,
        runtime: snapshot.runtime,
        preview: { ...snapshot.preview },
        console: {
          entries: snapshot.console.entries.map((entry) => ({ ...entry })),
          omittedEntries: snapshot.console.omittedEntries,
        },
        process: snapshot.process ? { ...snapshot.process } : null,
      }
    },
    [usesWebContainer],
  )

  const recordRunConsoleEntry = React.useCallback(
    (level: ExampleConsoleLevel, text: string) => {
      const snapshot = environmentSnapshotRef.current
      if (!snapshot || snapshot.runId !== runTokenRef.current) return

      const next = [
        ...snapshot.console.entries,
        { level, text: text.slice(0, MAX_RUN_CONSOLE_CHARACTERS) },
      ]
      let characters = next.reduce(
        (total, entry) => total + entry.text.length,
        0,
      )
      let omittedEntries = snapshot.console.omittedEntries
      while (
        next.length > MAX_RUN_CONSOLE_ENTRIES ||
        characters > MAX_RUN_CONSOLE_CHARACTERS
      ) {
        const removed = next.shift()
        if (!removed) break
        characters -= removed.text.length
        omittedEntries += 1
      }
      snapshot.console = { entries: next, omittedEntries }
    },
    [],
  )

  const recordRunProcessOutput = React.useCallback((value: string) => {
    const snapshot = environmentSnapshotRef.current
    if (
      !snapshot ||
      snapshot.runId !== runTokenRef.current ||
      !snapshot.process
    ) {
      return
    }

    const combined = snapshot.process.tail + value
    const overflow = Math.max(0, combined.length - MAX_RUN_PROCESS_CHARACTERS)
    snapshot.process = {
      omittedCharacters: snapshot.process.omittedCharacters + overflow,
      tail: overflow ? combined.slice(overflow) : combined,
    }
  }, [])

  const cancelPreviewCapture = React.useCallback((message: string) => {
    const pending = pendingPreviewCaptureRef.current
    if (!pending) return
    window.clearTimeout(pending.timeout)
    pendingPreviewCaptureRef.current = undefined
    pending.reject(new Error(message))
  }, [])

  const finishRun = React.useCallback(
    (token: string, outcome: ExampleWorkbenchRunOutcome) => {
      const pending = pendingRunRef.current
      if (!pending || pending.token !== token) return

      const snapshot = captureEnvironmentSnapshot(token)
      const result: ExampleWorkbenchRunResult =
        outcome.ok && pending.workspaceRevision !== workspaceRevisionRef.current
          ? {
              ok: false,
              phase: 'superseded',
              message: 'The notebook changed before validation completed.',
              snapshot,
            }
          : outcome.ok && !snapshot.preview.observed
            ? {
                ok: false,
                phase: 'timeout',
                message:
                  'The preview loaded without establishing the browser observation channel.',
                snapshot,
              }
            : { ...outcome, snapshot }

      window.clearTimeout(pending.timeout)
      if (pending.readyTimeout !== undefined) {
        window.clearTimeout(pending.readyTimeout)
      }
      if (pending.abortSignal && pending.abortListener) {
        pending.abortSignal.removeEventListener('abort', pending.abortListener)
      }
      pendingRunRef.current = undefined
      setRunActive(false)
      pending.resolve(result)
    },
    [captureEnvironmentSnapshot],
  )

  const finishCurrentRun = React.useCallback(
    (result: ExampleWorkbenchRunOutcome) => {
      const token = pendingRunRef.current?.token
      if (token) finishRun(token, result)
    },
    [finishRun],
  )

  const beginRun = React.useCallback(
    (token: string, signal?: AbortSignal) => {
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
        const pending: PendingWorkbenchRun = {
          resolve,
          timeout,
          token,
          workspaceRevision: workspaceRevisionRef.current,
        }
        pendingRunRef.current = pending
        setRunActive(true)

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
    [finishRun, usesWebContainer],
  )

  const scheduleRunSettlement = React.useCallback(
    (token: string) => {
      const pending = pendingRunRef.current
      if (
        !pending ||
        pending.token !== token ||
        !pending.ready ||
        !pending.observed
      ) {
        return
      }
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

  const markRunReady = React.useCallback(
    (token: string) => {
      const pending = pendingRunRef.current
      if (!pending || pending.token !== token) return
      pending.ready = true
      scheduleRunSettlement(token)
    },
    [scheduleRunSettlement],
  )

  const markRunObserved = React.useCallback(
    (token: string) => {
      const pending = pendingRunRef.current
      if (!pending || pending.token !== token) return
      pending.observed = true
      scheduleRunSettlement(token)
    },
    [scheduleRunSettlement],
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
      recordRunProcessOutput(value)
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
    [flushProcessOutput, recordRunProcessOutput],
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

    workspaceRevisionRef.current += 1
    const nextWorkspace = cloneWorkspace(definition.workspace)
    workspaceRef.current = nextWorkspace
    setWorkspace(nextWorkspace)
    const initialFile = getInitialFile(definition, nextWorkspace)
    setConsoleEntries([])
    resetProcessOutput()
    setError('')
    setPreviewUrl('')
    const initialPreviewHistory = createExamplePreviewHistory()
    previewHistoryRef.current = initialPreviewHistory
    setPreviewHistory(initialPreviewHistory)
    const notebookChanged = notebookDefinitionIdRef.current !== definition.id
    notebookDefinitionIdRef.current = definition.id
    const previousNotebookTabs = notebookTabsRef.current
    const availablePaths = Object.keys(nextWorkspace.files).filter(
      (path) => !definition.hiddenFiles?.includes(path),
    )
    const nextNotebookTabs = repairNotebookWorkbenchEditorPaths(
      notebookChanged
        ? createNotebookWorkbenchTabsState()
        : previousNotebookTabs,
      availablePaths,
      initialFile,
    )
    notebookTabsRef.current = nextNotebookTabs
    if (notebookChanged || nextNotebookTabs !== previousNotebookTabs) {
      setNotebookTabs(nextNotebookTabs)
    }
    const activeNotebookTab = nextNotebookTabs.tabs.find(
      (tab) => tab.id === nextNotebookTabs.activeTabId,
    )
    setActivePath(
      activeNotebookTab?.kind === 'editor'
        ? activeNotebookTab.path
        : initialFile,
    )
    if (activeNotebookTab?.kind === 'editor') {
      setShowFiles(activeNotebookTab.filesOpen)
    }
    const activeNotebookPreviewTab = nextNotebookTabs.tabs.find(
      (tab) =>
        tab.id === nextNotebookTabs.activeTabId && tab.kind === 'preview',
    )
    const nextNotebookPreviewTab =
      activeNotebookPreviewTab ??
      nextNotebookTabs.tabs.find((tab) => tab.kind === 'preview')
    currentNotebookPreviewTabIdRef.current = nextNotebookPreviewTab?.id
    const nextPreviewHistories = new Map<string, ExamplePreviewHistory>()
    for (const tab of nextNotebookTabs.tabs) {
      if (tab.kind !== 'preview') continue
      nextPreviewHistories.set(
        tab.id,
        tab.id === nextNotebookPreviewTab?.id
          ? initialPreviewHistory
          : createExamplePreviewHistory(),
      )
    }
    notebookPreviewHistoriesRef.current = nextPreviewHistories
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
    setShareError('')
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

  React.useEffect(() => {
    if (!error) return
    if (notebookMode) {
      revealNotebookPreviewTab()
    } else {
      setShowPreview(true)
      setMobileView('preview')
    }
  }, [error, notebookMode, revealNotebookPreviewTab])

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
    (
      nextWorkspace: ExampleWorkspace,
      options?: ExampleWorkbenchWorkspaceUpdateOptions,
    ) => {
      const next = cloneWorkspace(nextWorkspace)
      const current = workspaceRef.current

      if (usesWebContainer) {
        for (const [path, source] of Object.entries(next.files)) {
          if (current.files[path] !== source) {
            scheduleWebContainerWrite(path, source)
          }
        }
      }

      workspaceRevisionRef.current += 1
      workspaceRef.current = next
      setWorkspace(next)
      setActivePath((path) =>
        next.files[path] === undefined
          ? getInitialFile(definition, next)
          : path,
      )
      if (options?.notify !== false) onWorkspaceChange?.(next)
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
        const runId = crypto.randomUUID()
        return Promise.resolve({
          ok: false,
          phase: 'aborted',
          message: 'The notebook run was stopped.',
          snapshot: createEmptyExampleEnvironmentSnapshot({
            runId,
            runtime: usesWebContainer ? 'webcontainer' : 'client',
            workspaceRevision: workspaceRevisionRef.current,
          }),
        })
      }

      const overlappingWebContainerRun =
        usesWebContainer &&
        Boolean(pendingRunRef.current) &&
        Boolean(webContainerSessionRef.current)
      finishCurrentRun({
        ok: false,
        phase: 'superseded',
        message: 'The preview restarted before the previous run finished.',
      })
      if (overlappingWebContainerRun) {
        webContainerSessionRef.current?.dispose()
        webContainerSessionRef.current = null
        setWebContainerSession(undefined)
        setTerminalIds([])
        setActiveTerminalId('process')
        pendingWebContainerWritesRef.current.clear()
        if (webContainerWriteTimeoutRef.current !== undefined) {
          window.clearTimeout(webContainerWriteTimeoutRef.current)
          webContainerWriteTimeoutRef.current = undefined
        }
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
      environmentSnapshotRef.current = createEmptyExampleEnvironmentSnapshot({
        runId: runToken,
        runtime: usesWebContainer ? 'webcontainer' : 'client',
        workspaceRevision: workspaceRevisionRef.current,
      })
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
                if (webContainerSessionRef.current !== session) return
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
      usesWebContainer,
    ],
  )

  const replaceWorkspaceAndRun = React.useCallback(
    (
      nextWorkspace: ExampleWorkspace,
      signal?: AbortSignal,
      options?: ExampleWorkbenchWorkspaceUpdateOptions,
    ) => {
      replaceWorkspace(nextWorkspace, options)
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
    const pendingRunToken = pendingRunRef.current?.token
    postExampleSandboxBrowserCommand({
      channel: browserChannelRef.current,
      command: { kind: 'annotation', enabled: previewAnnotationMode },
      frame: frameRef.current,
      targetOrigin: getPreviewTargetOrigin(frameRef.current?.src ?? ''),
    })
    if (pendingRunToken) {
      postExampleSandboxBrowserCommand({
        channel: browserChannelRef.current,
        command: {
          kind: 'observe',
          observationId: pendingRunToken,
        },
        frame: frameRef.current,
        targetOrigin: getPreviewTargetOrigin(frameRef.current?.src ?? ''),
      })
    }

    if (!usesWebContainer) {
      syncTheme()
      return
    }

    if (pendingRunToken) markRunReady(pendingRunToken)
  }, [markRunReady, previewAnnotationMode, syncTheme, usesWebContainer])

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
          const environmentSnapshot = environmentSnapshotRef.current
          if (
            environmentSnapshot?.runId === runTokenRef.current &&
            message.observationId === environmentSnapshot.runId
          ) {
            environmentSnapshot.preview = {
              observed: true,
              title: message.title,
              url: trustedUrl,
            }
            markRunObserved(message.observationId)
          }
          const currentHistory = previewHistoryRef.current
          const currentUrl = currentHistory.entries[currentHistory.index] ?? '/'

          setPreviewHistory((current) => {
            const next = updateExamplePreviewHistory(current, {
              kind: message.navigationKind,
              url: trustedUrl,
            })
            previewHistoryRef.current = next
            const notebookPreviewTabId = currentNotebookPreviewTabIdRef.current
            if (notebookPreviewTabId) {
              notebookPreviewHistoriesRef.current.set(
                notebookPreviewTabId,
                next,
              )
            }
            return next
          })
          setPreviewNavigationError('')
          if (message.navigationKind === 'load' || currentUrl !== trustedUrl) {
            setPreviewAnnotationTarget(undefined)
          }
          if (message.navigationKind === 'push' && revealPreviewOnPush) {
            if (notebookMode) {
              revealNotebookPreviewTab()
            } else {
              setShowPreview(true)
              setMobileView('preview')
            }
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
        const text = message.values.join('\n')
        recordRunConsoleEntry(message.level, text)
        setConsoleEntries((current) => [...current, entry].slice(-500))
        if (message.level === 'error') {
          const consoleError = text || 'The notebook logged an error.'
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
        markRunReady(message.runToken)
      } else if (message.status === 'error') {
        recordRunConsoleEntry(
          'error',
          message.message || 'The notebook failed while running.',
        )
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
    markRunObserved,
    markRunReady,
    previewAnnotationMode,
    revealPreviewOnPush,
    revealNotebookPreviewTab,
    notebookMode,
    previewUrl,
    recordRunConsoleEntry,
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
    workspaceRevisionRef.current += 1
    workspaceRef.current = next
    setWorkspace(next)
    onWorkspaceChange?.(next)
  }

  function getNotebookPanelId(tab: NotebookWorkbenchTab) {
    if (tab.kind === 'preview') return notebookPreviewPanelId
    if (tab.kind === 'editor') return notebookEditorPanelId
    return notebookConsolePanelId
  }

  function getNotebookTabButtonId(tabId: string) {
    return `${notebookTabsId}-${tabId}`
  }

  function focusNotebookTab(tabId: string | null) {
    window.requestAnimationFrame(() => {
      if (tabId) {
        notebookTabButtonRefs.current.get(tabId)?.focus()
      } else {
        notebookAddTabButtonRef.current?.focus()
      }
    })
  }

  function activateNotebookTab(tab: NotebookWorkbenchTab) {
    setNotebookTabs((current) => activateNotebookWorkbenchTab(current, tab.id))
    if (tab.kind === 'editor') {
      setActivePath(tab.path)
      setShowFiles(tab.filesOpen)
    }
    if (tab.kind === 'console') setOutputActivated(true)
  }

  function addNotebookTab(tab: NewNotebookWorkbenchTab) {
    const next = addNotebookWorkbenchTab(notebookTabs, tab)
    const addedTab = next.tabs.at(-1)
    setNotebookTabs(next)
    if (addedTab?.kind === 'preview') {
      notebookPreviewHistoriesRef.current.set(
        addedTab.id,
        createExamplePreviewHistory(),
      )
    } else if (addedTab?.kind === 'editor') {
      setActivePath(addedTab.path)
      setShowFiles(addedTab.filesOpen)
    } else if (addedTab?.kind === 'console') {
      setOutputActivated(true)
    }
    focusNotebookTab(next.activeTabId)
  }

  function closeNotebookTab(tabId: string) {
    const next = closeNotebookWorkbenchTab(notebookTabs, tabId)
    const nextActiveTab = next.tabs.find((tab) => tab.id === next.activeTabId)
    setNotebookTabs(next)
    notebookPreviewHistoriesRef.current.delete(tabId)
    if (currentNotebookPreviewTabIdRef.current === tabId) {
      currentNotebookPreviewTabIdRef.current = next.tabs.find(
        (tab) => tab.kind === 'preview',
      )?.id
    }
    if (nextActiveTab?.kind === 'editor') {
      setActivePath(nextActiveTab.path)
      setShowFiles(nextActiveTab.filesOpen)
    } else if (nextActiveTab?.kind === 'console') {
      setOutputActivated(true)
    }
    if (next.tabs.length === 0) alternateEditor?.onActiveChange(true)
    focusNotebookTab(next.activeTabId)
  }

  function navigateNotebookTabs(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Delete') {
      event.preventDefault()
      closeNotebookTab(event.currentTarget.dataset.tabId ?? '')
      return
    }
    if (
      event.key !== 'ArrowLeft' &&
      event.key !== 'ArrowRight' &&
      event.key !== 'Home' &&
      event.key !== 'End'
    ) {
      return
    }

    event.preventDefault()
    const target = getNotebookWorkbenchTabNavigationTarget(
      notebookTabs,
      event.key,
    )
    if (!target) return
    const tab = notebookTabs.tabs.find((candidate) => candidate.id === target)
    if (!tab) return
    activateNotebookTab(tab)
    focusNotebookTab(tab.id)
  }

  function setNotebookFilesOpen(open: boolean) {
    setShowFiles(open)
    const activeTab = notebookTabs.tabs.find(
      (tab) => tab.id === notebookTabs.activeTabId,
    )
    if (activeTab?.kind !== 'editor') return
    setNotebookTabs((current) =>
      updateNotebookWorkbenchEditorTab(current, activeTab.id, {
        filesOpen: open,
      }),
    )
  }

  function selectFile(path: string) {
    setActivePath(path)
    const activeTab = notebookTabs.tabs.find(
      (tab) => tab.id === notebookTabs.activeTabId,
    )
    const closeFiles = !window.matchMedia('(min-width: 1024px)').matches
    if (alternateEditor && activeTab?.kind === 'editor') {
      setNotebookTabs((current) =>
        updateNotebookWorkbenchEditorTab(current, activeTab.id, {
          path,
          filesOpen: closeFiles ? false : undefined,
        }),
      )
    }
    if (closeFiles) {
      setShowFiles(false)
    }
  }

  function toggleFiles() {
    setMobileView('code')
    const next = !showFiles
    setShowFiles(next)
    const activeTab = notebookTabs.tabs.find(
      (tab) => tab.id === notebookTabs.activeTabId,
    )
    if (alternateEditor && activeTab?.kind === 'editor') {
      setNotebookTabs((current) =>
        updateNotebookWorkbenchEditorTab(current, activeTab.id, {
          filesOpen: next,
        }),
      )
    }
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
    if (runActive || runDisabled) return
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

  function navigateNotebookPreviewHistory(offset: -1 | 1) {
    const current = previewHistoryRef.current
    const index = current.index + offset
    const url = current.entries[index]
    if (!url) return

    const next = { entries: current.entries, index }
    previewHistoryRef.current = next
    setPreviewHistory(next)
    const previewTabId = currentNotebookPreviewTabIdRef.current
    if (previewTabId) {
      notebookPreviewHistoriesRef.current.set(previewTabId, next)
    }
    sendPreviewBrowserCommand({ kind: 'navigate', url })
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
    setShareError('')

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
      setShareError(formatError(cause))
    }
  }

  const filePaths = React.useMemo(
    () =>
      Object.keys(workspace.files)
        .filter((path) => !definition.hiddenFiles?.includes(path))
        .sort(),
    [definition.hiddenFiles, workspace.files],
  )
  const fileTree = React.useMemo(() => createFileTree(filePaths), [filePaths])
  const activeNotebookTab = notebookTabs.tabs.find(
    (tab) => tab.id === notebookTabs.activeTabId,
  )
  const activeNotebookEditorTab =
    activeNotebookTab?.kind === 'editor' ? activeNotebookTab : undefined
  const notebookChatOpen =
    alternateEditorActive || notebookTabs.tabs.length === 0

  React.useEffect(() => {
    setNotebookTabs((current) =>
      repairNotebookWorkbenchEditorPaths(
        current,
        filePaths,
        getInitialFile(definition, workspace),
      ),
    )
  }, [definition, filePaths, workspace])

  React.useEffect(() => {
    if (!activeNotebookEditorTab) return
    setActivePath(activeNotebookEditorTab.path)
    setShowFiles(activeNotebookEditorTab.filesOpen)
  }, [activeNotebookEditorTab])

  React.useEffect(() => {
    if (activeNotebookTab?.kind !== 'preview') return

    const currentHistory = previewHistoryRef.current
    const currentUrl = currentHistory.entries[currentHistory.index] ?? '/'
    const history =
      notebookPreviewHistoriesRef.current.get(activeNotebookTab.id) ??
      previewHistoryRef.current
    notebookPreviewHistoriesRef.current.set(activeNotebookTab.id, history)
    currentNotebookPreviewTabIdRef.current = activeNotebookTab.id
    previewHistoryRef.current = history
    setPreviewHistory(history)

    const targetUrl = history.entries[history.index] ?? '/'
    if (targetUrl === currentUrl) return
    const frame = window.requestAnimationFrame(() => {
      postExampleSandboxBrowserCommand({
        channel: browserChannelRef.current,
        command: { kind: 'navigate', url: targetUrl },
        frame: frameRef.current,
        targetOrigin: getPreviewTargetOrigin(frameRef.current?.src ?? ''),
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeNotebookTab?.id, activeNotebookTab?.kind])

  React.useEffect(() => {
    if (
      alternateEditor &&
      notebookTabs.tabs.length === 0 &&
      !alternateEditorActive
    ) {
      revealNotebookPreviewTab()
    }
  }, [
    alternateEditor,
    alternateEditorActive,
    notebookTabs.tabs.length,
    revealNotebookPreviewTab,
  ])

  React.useEffect(() => {
    const wasOpen = previousNotebookChatOpenRef.current
    previousNotebookChatOpenRef.current = notebookChatOpen
    if (!wasOpen || notebookChatOpen) return
    const frame = window.requestAnimationFrame(() => {
      notebookShowChatButtonRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [notebookChatOpen])

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
  const manualRunDisabled =
    runActive || runDisabled || isWebContainerBusy || isWebContainerUnsupported
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

  if (alternateEditor) {
    const hasNotebookTabs = notebookTabs.tabs.length > 0
    const activeNotebookTabButtonId = activeNotebookTab
      ? getNotebookTabButtonId(activeNotebookTab.id)
      : undefined
    const notebookWorkspaceClass = hasNotebookTabs
      ? notebookChatOpen
        ? 'top-0 right-0 left-0 h-1/2 @min-[900px]:right-auto @min-[900px]:bottom-0 @min-[900px]:h-auto @min-[900px]:w-[62%]'
        : 'inset-0'
      : 'pointer-events-none invisible inset-0'
    const notebookChatGeometryClass = hasNotebookTabs
      ? 'right-0 bottom-0 left-0 h-1/2 border-t border-border-default @min-[900px]:top-0 @min-[900px]:left-auto @min-[900px]:h-auto @min-[900px]:w-[38%] @min-[900px]:border-t-0 @min-[900px]:border-l'
      : 'inset-0'
    const notebookChatTransformClass = notebookChatOpen
      ? 'translate-x-0 translate-y-0'
      : 'pointer-events-none translate-y-full @min-[900px]:translate-x-full @min-[900px]:translate-y-0'

    return (
      <section
        className={`@container not-prose relative flex min-w-0 flex-col overflow-hidden border border-border-default bg-background-default text-text-primary ${
          fullscreen
            ? 'min-h-0 flex-1 rounded-none border-x-0 border-b-0'
            : 'h-[clamp(520px,75dvh,720px)] rounded-lg'
        } ${className ?? ''}`}
        aria-label={`${definition.title} workbench`}
      >
        <header className="flex h-10 shrink-0 items-stretch border-b border-border-default bg-background-default">
          <div
            role="tablist"
            aria-label="Notebook workspace"
            className="fade-x flex min-w-0 flex-1 items-stretch overflow-x-auto"
          >
            {notebookTabs.tabs.map((tab) => {
              const label = getNotebookWorkbenchTabLabel(notebookTabs.tabs, tab)
              const active = tab.id === notebookTabs.activeTabId

              return (
                <div
                  key={tab.id}
                  role="presentation"
                  className={`flex shrink-0 items-stretch border-r border-border-default ${
                    active
                      ? 'bg-background-default text-text-primary'
                      : 'bg-background-subtle text-text-muted'
                  }`}
                >
                  <button
                    ref={(element) => {
                      if (element) {
                        notebookTabButtonRefs.current.set(tab.id, element)
                      } else {
                        notebookTabButtonRefs.current.delete(tab.id)
                      }
                    }}
                    type="button"
                    role="tab"
                    id={getNotebookTabButtonId(tab.id)}
                    data-tab-id={tab.id}
                    aria-controls={getNotebookPanelId(tab)}
                    aria-selected={active}
                    tabIndex={active ? 0 : -1}
                    className="flex min-w-0 items-center gap-1.5 px-2 text-xs hover:bg-background-elevated hover:text-text-primary focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus"
                    onClick={() => activateNotebookTab(tab)}
                    onKeyDown={navigateNotebookTabs}
                  >
                    {tab.kind === 'preview' ? (
                      <BrowserIcon className="size-3.5" aria-hidden="true" />
                    ) : tab.kind === 'editor' ? (
                      <CodeIcon className="size-3.5" aria-hidden="true" />
                    ) : (
                      <TerminalWindowIcon
                        className="size-3.5"
                        aria-hidden="true"
                      />
                    )}
                    <span>{label}</span>
                  </button>
                  <Tooltip content={`Close ${label}`} side="bottom">
                    <button
                      type="button"
                      aria-label={`Close ${label}`}
                      className="flex w-9 items-center justify-center text-text-muted hover:bg-background-elevated hover:text-text-primary focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus"
                      onClick={() => closeNotebookTab(tab.id)}
                    >
                      <XIcon className="size-3" aria-hidden="true" />
                    </button>
                  </Tooltip>
                </div>
              )
            })}
          </div>

          <div className="flex shrink-0 items-stretch border-l border-border-default">
            <Dropdown>
              <DropdownTrigger
                render={
                  <Button
                    ref={notebookAddTabButtonRef}
                    type="button"
                    variant="icon"
                    color="gray"
                    size="icon-sm"
                    rounded="none"
                    className="size-10 shrink-0 transition-none active:scale-100"
                    aria-label="New workspace tab"
                  >
                    <PlusIcon className="size-4" aria-hidden="true" />
                  </Button>
                }
              />
              <DropdownContent align="end" className="min-w-44">
                <DropdownItem
                  onSelect={() => addNotebookTab({ kind: 'preview' })}
                >
                  <BrowserIcon className="size-4" aria-hidden="true" />
                  Preview
                </DropdownItem>
                <DropdownItem
                  onSelect={() =>
                    addNotebookTab({
                      kind: 'editor',
                      path: activePath,
                      filesOpen: showFiles,
                    })
                  }
                >
                  <CodeIcon className="size-4" aria-hidden="true" />
                  Editor
                </DropdownItem>
                <DropdownItem
                  onSelect={() => addNotebookTab({ kind: 'console' })}
                >
                  <TerminalWindowIcon className="size-4" aria-hidden="true" />
                  Console
                </DropdownItem>
              </DropdownContent>
            </Dropdown>

            {allowSharing ? (
              <Tooltip
                content={shareState === 'copied' ? 'Copied' : 'Copy share link'}
                side="bottom"
              >
                <Button
                  type="button"
                  variant="icon"
                  color="gray"
                  size="icon-sm"
                  rounded="none"
                  className="size-10 shrink-0 transition-none active:scale-100"
                  aria-label="Copy share link"
                  disabled={shareState === 'sharing'}
                  onClick={() => void share()}
                >
                  <ShareIcon className="size-4" aria-hidden="true" />
                </Button>
              </Tooltip>
            ) : null}

            {!notebookChatOpen ? (
              <Button
                ref={notebookShowChatButtonRef}
                type="button"
                variant="ghost"
                size="xs"
                rounded="none"
                className="h-10 shrink-0 transition-none hover:shadow-none"
                onClick={() => alternateEditor.onActiveChange(true)}
              >
                <ChatCircleDotsIcon className="size-3.5" aria-hidden="true" />
                Show chat
              </Button>
            ) : null}
          </div>
        </header>

        {shareError ? (
          <div
            className="absolute top-12 right-3 left-3 z-30 flex max-h-28 items-start gap-2 overflow-hidden rounded-lg border border-border-default border-l-2 border-l-border-error bg-background-elevated px-3 py-2 shadow-lg sm:left-auto sm:w-96"
            role="alert"
          >
            <WarningCircleIcon
              className="mt-0.5 size-4 shrink-0 text-icon-error"
              aria-hidden="true"
            />
            <span className="min-h-0 min-w-0 flex-1 overflow-auto text-xs/5 whitespace-pre-wrap text-text-secondary">
              {shareError}
            </span>
            <Button
              type="button"
              variant="icon"
              color="gray"
              size="icon-sm"
              rounded="md"
              className="-m-1 shrink-0 transition-none active:scale-100"
              aria-label="Dismiss share error"
              onClick={() => setShareError('')}
            >
              <XIcon className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            className={`absolute min-h-0 min-w-0 overflow-hidden ${notebookWorkspaceClass}`}
          >
            <section
              id={notebookPreviewPanelId}
              role="tabpanel"
              aria-labelledby={
                activeNotebookTab?.kind === 'preview'
                  ? activeNotebookTabButtonId
                  : undefined
              }
              aria-hidden={activeNotebookTab?.kind !== 'preview'}
              inert={activeNotebookTab?.kind !== 'preview'}
              className={`absolute inset-0 min-h-0 overflow-hidden bg-background-default ${
                activeNotebookTab?.kind === 'preview'
                  ? 'visible'
                  : 'pointer-events-none invisible'
              }`}
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
                error={error || previewNavigationError}
                history={[...new Set(previewHistory.entries)]}
                navigationAvailable={Boolean(previewUrl || sourceDocument)}
                onAnnotationModeChange={setPreviewAnnotationMode}
                onBack={() => navigateNotebookPreviewHistory(-1)}
                onClearAnnotationTarget={clearPreviewAnnotationTarget}
                onForward={() => navigateNotebookPreviewHistory(1)}
                onNavigate={(url) =>
                  sendPreviewBrowserCommand({ kind: 'navigate', url })
                }
                onReload={reloadPreview}
                openExternalUrl={externalPreviewUrl}
                reloadDisabled={runActive || runDisabled}
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
                        disabled={manualRunDisabled}
                        onClick={() => void run()}
                      >
                        <PlayIcon className="size-4" aria-hidden="true" />
                        {status === 'error' ? 'Try again' : runLabel}
                      </Button>
                    )}
                  </div>
                )}
              </SandboxBrowser>
            </section>

            <section
              id={notebookEditorPanelId}
              role="tabpanel"
              aria-labelledby={
                activeNotebookTab?.kind === 'editor'
                  ? activeNotebookTabButtonId
                  : undefined
              }
              aria-hidden={activeNotebookTab?.kind !== 'editor'}
              inert={activeNotebookTab?.kind !== 'editor'}
              className={`absolute inset-0 min-h-0 overflow-hidden bg-[var(--th-background)] ${
                activeNotebookTab?.kind === 'editor'
                  ? 'visible'
                  : 'pointer-events-none invisible'
              }`}
            >
              <div className="flex size-full min-h-0 flex-col">
                <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border-default bg-background-subtle px-2">
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
                      className="size-9 shrink-0 transition-none active:scale-100"
                      aria-pressed={showFiles}
                      aria-label={showFiles ? 'Hide files' : 'Show files'}
                      onClick={() => setNotebookFilesOpen(!showFiles)}
                    >
                      <FolderOpenIcon className="size-3.5" aria-hidden="true" />
                    </Button>
                  </Tooltip>
                  <div className="min-w-0 truncate font-ds-mono text-xs text-text-muted">
                    {activePath}
                  </div>
                </div>

                <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
                  <FileExplorer
                    currentPath={activePath}
                    files={fileTree}
                    isSidebarOpen={showFiles}
                    libraryColor={libraryColor}
                    onSidebarClose={() => setNotebookFilesOpen(false)}
                    prefetchFileContent={() => {}}
                    setCurrentPath={selectFile}
                  />
                  <div className="flex min-w-0 flex-1 flex-col bg-[var(--th-background)]">
                    <div
                      className={`${showFiles ? 'hidden' : 'flex'} fade-x h-9 shrink-0 overflow-x-auto border-b border-border-default bg-background-subtle`}
                    >
                      {filePaths.map((path) => (
                        <button
                          key={path}
                          type="button"
                          title={path}
                          onClick={() => selectFile(path)}
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
                    <div className="min-h-0 flex-1">
                      <CodeMirrorEditor
                        path={activePath}
                        theme={resolvedTheme}
                        value={activeSource}
                        onChange={updateActiveSource}
                        onRun={() => {
                          if (!manualRunDisabled) void run()
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {usesWebContainer ? (
              <section
                id={notebookConsolePanelId}
                role="tabpanel"
                aria-labelledby={
                  activeNotebookTab?.kind === 'console'
                    ? activeNotebookTabButtonId
                    : undefined
                }
                aria-hidden={activeNotebookTab?.kind !== 'console'}
                inert={activeNotebookTab?.kind !== 'console'}
                className={`absolute inset-0 min-h-0 grid-rows-[2rem_minmax(0,1fr)] overflow-hidden bg-background-default ${
                  activeNotebookTab?.kind === 'console'
                    ? 'grid'
                    : 'pointer-events-none invisible grid'
                }`}
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
                          className={`flex h-full shrink-0 items-center border-b-2 border-transparent ${
                            activeTerminalId === id
                              ? 'border-text-primary text-text-primary'
                              : 'text-text-muted'
                          }`}
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
                        active={
                          activeNotebookTab?.kind === 'console' &&
                          activeTerminalId === 'process'
                        }
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
                            active={
                              activeNotebookTab?.kind === 'console' &&
                              activeTerminalId === id
                            }
                            session={webContainerSession}
                            theme={resolvedTheme}
                          />
                        </React.Suspense>
                      </div>
                    ) : null
                  })}
                </div>
              </section>
            ) : (
              <ConsoleOutput
                id={notebookConsolePanelId}
                ariaLabelledBy={
                  activeNotebookTab?.kind === 'console'
                    ? activeNotebookTabButtonId
                    : undefined
                }
                className={`absolute inset-0 min-h-0 ${
                  activeNotebookTab?.kind === 'console'
                    ? 'visible'
                    : 'pointer-events-none invisible'
                }`}
                entries={consoleEntries}
                hidden={activeNotebookTab?.kind !== 'console'}
                label="Console output"
              />
            )}
          </div>

          <aside
            aria-label={alternateEditor.label}
            aria-hidden={!notebookChatOpen}
            inert={!notebookChatOpen}
            className={`absolute z-10 flex min-h-0 min-w-0 overflow-hidden bg-background-default transition-transform duration-[180ms] [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${notebookChatGeometryClass} ${notebookChatTransformClass}`}
          >
            {alternateEditor.content}
          </aside>
        </div>
      </section>
    )
  }

  return (
    <section
      className={`not-prose relative flex min-w-0 flex-col overflow-hidden border border-border-default bg-background-default text-text-primary ${
        fullscreen
          ? 'min-h-0 flex-1 rounded-none border-x-0 border-b-0'
          : 'h-[clamp(520px,75dvh,720px)] rounded-lg'
      } ${className ?? ''}`}
      aria-label={`${definition.title} workbench`}
    >
      <header className="flex min-h-10 shrink-0 items-center justify-between gap-3 border-b border-border-default px-2">
        <div className="flex min-w-0 items-center gap-2">
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
            <Tooltip content={runLabel} side="bottom">
              <Button
                type="button"
                variant="primary"
                size="xs"
                rounded="none"
                className="hover:translate-y-0 max-[899px]:translate-y-0"
                aria-label={runLabel}
                disabled={manualRunDisabled}
                onClick={() => void run()}
              >
                <PlayIcon className="size-3.5" aria-hidden="true" />
              </Button>
            </Tooltip>
          </ButtonGroup>
        </div>
      </header>

      {shareError ? (
        <div
          className="absolute top-12 right-3 left-3 z-30 flex max-h-28 items-start gap-2 overflow-hidden rounded-lg border border-border-default border-l-2 border-l-border-error bg-background-elevated px-3 py-2 shadow-lg sm:left-auto sm:w-96"
          role="alert"
        >
          <WarningCircleIcon
            className="mt-0.5 size-4 shrink-0 text-icon-error"
            aria-hidden="true"
          />
          <span className="min-h-0 min-w-0 flex-1 overflow-auto text-xs/5 whitespace-pre-wrap text-text-secondary">
            {shareError}
          </span>
          <Button
            type="button"
            variant="icon"
            color="gray"
            size="icon-sm"
            rounded="md"
            className="-m-1 shrink-0 transition-none active:scale-100"
            aria-label="Dismiss share error"
            onClick={() => setShareError('')}
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

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
            Code
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
          <div className="absolute inset-0 flex min-h-0 min-w-0 overflow-hidden">
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
                  onRun={() => {
                    if (!manualRunDisabled) void run()
                  }}
                />
              </div>
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
              error={error || previewNavigationError}
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
              reloadDisabled={runActive || runDisabled}
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
                      disabled={manualRunDisabled}
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
