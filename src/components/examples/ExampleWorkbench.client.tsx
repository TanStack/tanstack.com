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
  SidebarSimpleIcon,
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
import { BuilderWorkspaceControlsContext } from '~/components/builder/builder-workspace-controls.client'
import { Tooltip } from '~/ui'
import { copyTextToClipboard } from '~/utils/browser-effects'
import {
  compileExampleWorkspace,
  type ExamplePackageResolution,
} from '~/utils/example-esbuild.client'
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
  activateBuilderWorkbenchTab,
  activateBuilderWorkbenchPane,
  addBuilderWorkbenchTab,
  closeBuilderWorkbenchTab,
  createBuilderWorkbenchTabsState,
  getActiveBuilderWorkbenchPane,
  getActiveBuilderWorkbenchTab,
  getBuilderWorkbenchPaneForTab,
  getBuilderWorkbenchPaneTabs,
  getBuilderWorkbenchTabLabel,
  getBuilderWorkbenchTabNavigationTarget,
  moveBuilderWorkbenchTab,
  repairBuilderWorkbenchEditorPaths,
  resizeBuilderWorkbenchPanes,
  splitBuilderWorkbenchTab,
  updateBuilderWorkbenchEditorTab,
  type NewBuilderWorkbenchTab,
  type BuilderWorkbenchPane,
  type BuilderWorkbenchTab,
} from '~/utils/builder-workbench-tabs'
import type { BuilderAiPromptLifecycle } from '~/utils/builder-ai-prompt-queue'
import {
  createExampleWorkspace,
  type ExampleDefinition,
  type ExampleWorkspace,
} from '~/utils/example-workspace'
import { CodeMirrorEditor } from './CodeMirrorEditor.client'
import {
  MAX_SANDBOX_BROWSER_ANNOTATION_PROMPT_LENGTH,
  SandboxBrowser,
  formatSandboxBrowserAnnotations,
  type SandboxBrowserAnnotation,
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
type BuilderPaneResize = {
  frames: Array<{ frame: HTMLIFrameElement; pointerEvents: string }>
  ownerDocument: Document
  pointerId: number
  previousCursor: string
  previousUserSelect: string
}
type BuilderChatResize = {
  frames: Array<{ frame: HTMLIFrameElement; pointerEvents: string }>
  ownerDocument: Document
  percent: number
  pointerId: number
  previousCursor: string
  previousUserSelect: string
}
type BuilderLayoutStyle = React.CSSProperties & {
  '--builder-chat-desktop-track': string
  '--builder-chat-mobile-track': string
  '--builder-workspace-desktop-track': string
  '--builder-workspace-mobile-track': string
}
type BuilderTabDrag = {
  active: boolean
  frames?: Array<{ frame: HTMLIFrameElement; pointerEvents: string }>
  pointerId: number
  startX: number
  startY: number
  tabId: string
  targetPaneId?: string
  targetPosition?: 'before' | 'after'
}

const DEFAULT_CODE_PANEL_PERCENT = 67
const DEFAULT_BUILDER_CHAT_PERCENT = 38
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
  packageResolution = 'legacy',
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
    submitPrompt?(
      content: string,
      lifecycle?: BuilderAiPromptLifecycle,
    ): boolean
  }
  autoRun?: boolean
  className?: string
  definition: ExampleDefinition
  fallbackAction?: { label: string; url: string }
  filesInitiallyOpen?: boolean
  fullscreen?: boolean
  libraryColor?: string
  onWorkspaceChange?: (workspace: ExampleWorkspace) => void
  packageResolution?: ExamplePackageResolution
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
  const builderTabsId = React.useId()
  const builderWorkspaceId = `${builderTabsId}-workspace`
  const builderChatId = `${builderTabsId}-chat`
  const [workspace, setWorkspace] = React.useState(() =>
    cloneWorkspace(definition.workspace),
  )
  const builderMode = alternateEditor !== undefined
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
  const [builderChatPercent, setBuilderChatPercent] = React.useState(
    DEFAULT_BUILDER_CHAT_PERCENT,
  )
  const [builderWorkspaceVisible, setBuilderWorkspaceVisible] =
    React.useState(true)
  const [isBuilderChatResizing, setIsBuilderChatResizing] =
    React.useState(false)
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
  const [builderTabs, setBuilderTabs] = React.useState(() =>
    createBuilderWorkbenchTabsState(),
  )
  const builderTabsRef = React.useRef(builderTabs)
  const builderDefinitionIdRef = React.useRef(definition.id)
  const builderTabButtonRefs = React.useRef(
    new Map<string, HTMLButtonElement>(),
  )
  const builderAddTabButtonRef = React.useRef<HTMLButtonElement>(null)
  const builderPaneRefs = React.useRef(new Map<string, HTMLDivElement>())
  const builderLayoutRef = React.useRef<HTMLDivElement>(null)
  const builderWorkspaceRef = React.useRef<HTMLDivElement>(null)
  const builderContainerRef = React.useRef<HTMLElement>(null)
  const builderPaneGridRef = React.useRef<HTMLDivElement>(null)
  const builderPaneResizeRef = React.useRef<BuilderPaneResize>(null)
  const builderChatResizeRef = React.useRef<BuilderChatResize>(null)
  const builderTabDragRef = React.useRef<BuilderTabDrag>(null)
  const builderTabDidDragRef = React.useRef(false)
  const [builderTabDrag, setBuilderTabDrag] = React.useState<BuilderTabDrag>()
  const [builderArrangeTabId, setBuilderArrangeTabId] = React.useState<string>()
  const [isBuilderPaneResizing, setIsBuilderPaneResizing] =
    React.useState(false)
  const [builderContainerWidth, setBuilderContainerWidth] = React.useState(0)
  const [builderLayoutAnnouncement, setBuilderLayoutAnnouncement] =
    React.useState('')
  const builderShowChatButtonRef = React.useRef<HTMLButtonElement>(null)
  const previousBuilderChatOpenRef = React.useRef(
    alternateEditorActive || builderTabs.tabs.length === 0,
  )
  const builderPreviewHistoriesRef = React.useRef(
    new Map<string, ExamplePreviewHistory>(),
  )
  const currentBuilderPreviewTabIdRef = React.useRef<string | undefined>(
    undefined,
  )
  const builderPreviewFrameRefs = React.useRef(
    new Map<string, HTMLIFrameElement>(),
  )
  const builderPreviewRestoredRunTokensRef = React.useRef(
    new Map<string, string>(),
  )
  const builderValidationFrameRef = React.useRef<HTMLIFrameElement>(null)
  const [needsBuilderValidationFrame, setNeedsBuilderValidationFrame] =
    React.useState(false)
  const needsBuilderValidationFrameRef = React.useRef(
    needsBuilderValidationFrame,
  )
  const builderPreviewNavigationErrorsRef = React.useRef(
    new Map<string, string>(),
  )
  const builderPreviewAnnotationModesRef = React.useRef(new Set<string>())
  const builderPreviewAnnotationTargetsRef = React.useRef(
    new Map<string, SandboxBrowserAnnotationTarget>(),
  )
  const builderPreviewAnnotationsRef = React.useRef(
    new Map<string, ReadonlyArray<SandboxBrowserAnnotation>>(),
  )
  const [, setBuilderPreviewRevision] = React.useState(0)
  const [previewNavigationError, setPreviewNavigationError] = React.useState('')
  const [previewAnnotationMode, setPreviewAnnotationModeActive] =
    React.useState(false)
  const [previewAnnotationTarget, setPreviewAnnotationTarget] =
    React.useState<SandboxBrowserAnnotationTarget>()
  const [previewAnnotations, setPreviewAnnotations] = React.useState<
    ReadonlyArray<SandboxBrowserAnnotation>
  >([])
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

  builderTabsRef.current = builderTabs
  needsBuilderValidationFrameRef.current = needsBuilderValidationFrame

  const getVisibleBuilderPreviewTab = React.useCallback(() => {
    const tabs = builderTabsRef.current
    const activePane = getActiveBuilderWorkbenchPane(tabs)
    const visiblePanes =
      isDesktop && tabs.panes.length === 2
        ? tabs.panes
        : activePane
          ? [activePane]
          : []
    return visiblePanes
      .map((pane) => tabs.tabs.find((tab) => tab.id === pane.activeTabId))
      .find((tab) => tab?.kind === 'preview')
  }, [isDesktop])

  const revealBuilderPreviewTab = React.useCallback(() => {
    setBuilderWorkspaceVisible(true)
    setBuilderTabs((current) => {
      const activeTab = getActiveBuilderWorkbenchTab(current)
      if (activeTab?.kind === 'preview') return current

      const previewTab =
        current.tabs.find(
          (tab) => tab.id === currentBuilderPreviewTabIdRef.current,
        ) ?? current.tabs.find((tab) => tab.kind === 'preview')
      return previewTab
        ? activateBuilderWorkbenchTab(current, previewTab.id)
        : addBuilderWorkbenchTab(current, { kind: 'preview' })
    })
  }, [])

  const showBuilderWorkspace = React.useCallback(() => {
    setBuilderWorkspaceVisible(true)
    const current = builderTabsRef.current
    if (current.tabs.length > 0) {
      setBuilderLayoutAnnouncement('Side panel shown.')
      return
    }

    const next = addBuilderWorkbenchTab(current, { kind: 'preview' })
    const previewTab = next.tabs.find((tab) => tab.kind === 'preview')
    builderTabsRef.current = next
    setBuilderTabs(next)
    if (previewTab) {
      builderPreviewHistoriesRef.current.set(
        previewTab.id,
        createExamplePreviewHistory(),
      )
    }
    setBuilderLayoutAnnouncement('Side panel shown.')
  }, [])

  const toggleBuilderWorkspace = React.useCallback(() => {
    if (!builderWorkspaceVisible || builderTabsRef.current.tabs.length === 0) {
      showBuilderWorkspace()
      return
    }

    alternateEditor?.onActiveChange(true)
    setBuilderWorkspaceVisible(false)
    setBuilderLayoutAnnouncement('Side panel hidden.')
  }, [alternateEditor, builderWorkspaceVisible, showBuilderWorkspace])

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
              message: 'The builder changed before validation completed.',
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
      if (builderMode) {
        needsBuilderValidationFrameRef.current = false
        setNeedsBuilderValidationFrame(false)
      }
      pending.resolve(result)
    },
    [captureEnvironmentSnapshot, builderMode],
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
          const abortListener = () => {
            compileRequestRef.current += 1
            if (!usesWebContainer) setStatus('stopped')
            finishRun(token, {
              ok: false,
              phase: 'aborted',
              message: 'The builder run was stopped.',
            })
          }
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
      message: 'The builder changed before the preview finished.',
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
    const builderChanged = builderDefinitionIdRef.current !== definition.id
    builderDefinitionIdRef.current = definition.id
    if (builderChanged) {
      setBuilderArrangeTabId(undefined)
      setBuilderWorkspaceVisible(true)
      builderPreviewAnnotationsRef.current.clear()
      setPreviewAnnotations([])
    }
    const previousBuilderTabs = builderTabsRef.current
    const availablePaths = Object.keys(nextWorkspace.files).filter(
      (path) => !definition.hiddenFiles?.includes(path),
    )
    const nextBuilderTabs = repairBuilderWorkbenchEditorPaths(
      builderChanged ? createBuilderWorkbenchTabsState() : previousBuilderTabs,
      availablePaths,
      initialFile,
    )
    builderTabsRef.current = nextBuilderTabs
    if (builderChanged || nextBuilderTabs !== previousBuilderTabs) {
      setBuilderTabs(nextBuilderTabs)
    }
    const activeBuilderTab = getActiveBuilderWorkbenchTab(nextBuilderTabs)
    setActivePath(
      activeBuilderTab?.kind === 'editor' ? activeBuilderTab.path : initialFile,
    )
    if (activeBuilderTab?.kind === 'editor') {
      setShowFiles(activeBuilderTab.filesOpen)
    }
    const activeBuilderPreviewTab =
      activeBuilderTab?.kind === 'preview' ? activeBuilderTab : undefined
    const nextBuilderPreviewTab =
      activeBuilderPreviewTab ??
      nextBuilderTabs.tabs.find((tab) => tab.kind === 'preview')
    currentBuilderPreviewTabIdRef.current = nextBuilderPreviewTab?.id
    const nextPreviewHistories = new Map<string, ExamplePreviewHistory>()
    for (const tab of nextBuilderTabs.tabs) {
      if (tab.kind !== 'preview') continue
      nextPreviewHistories.set(
        tab.id,
        tab.id === nextBuilderPreviewTab?.id
          ? initialPreviewHistory
          : createExamplePreviewHistory(),
      )
    }
    builderPreviewHistoriesRef.current = nextPreviewHistories
    builderPreviewRestoredRunTokensRef.current.clear()
    builderPreviewNavigationErrorsRef.current.clear()
    builderPreviewAnnotationModesRef.current.clear()
    builderPreviewAnnotationTargetsRef.current.clear()
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
    if (builderMode) {
      revealBuilderPreviewTab()
    } else {
      setShowPreview(true)
      setMobileView('preview')
    }
  }, [error, builderMode, revealBuilderPreviewTab])

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
          message: 'The builder run was stopped.',
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
      if (builderMode) {
        builderPreviewAnnotationModesRef.current.clear()
        builderPreviewAnnotationTargetsRef.current.clear()
        setBuilderPreviewRevision((current) => current + 1)
        for (const frame of builderPreviewFrameRefs.current.values()) {
          postExampleSandboxBrowserCommand({
            channel: browserChannelRef.current,
            command: { kind: 'annotation', enabled: false },
            frame,
            targetOrigin: getPreviewTargetOrigin(frame.src),
          })
        }
      } else {
        postExampleSandboxBrowserCommand({
          channel: browserChannelRef.current,
          command: { kind: 'annotation', enabled: false },
          frame: frameRef.current,
          targetOrigin: getPreviewTargetOrigin(frameRef.current?.src ?? ''),
        })
      }

      if (builderMode) {
        const visiblePreviewTab = getVisibleBuilderPreviewTab()
        const visibleFrame = visiblePreviewTab
          ? builderPreviewFrameRefs.current.get(visiblePreviewTab.id)
          : undefined
        frameRef.current = visibleFrame ?? null
        const needsValidationFrame = !visibleFrame && !visiblePreviewTab
        needsBuilderValidationFrameRef.current = needsValidationFrame
        setNeedsBuilderValidationFrame(needsValidationFrame)
      }

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
                          'The builder server stopped before it was ready.',
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
                        'Another WebContainer builder started in this tab.',
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
          const compiled = await compileExampleWorkspace(currentWorkspace, {
            packageResolution,
            signal,
          })
          if (signal?.aborted || request !== compileRequestRef.current) return

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
          if (signal?.aborted || request !== compileRequestRef.current) return
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
      getVisibleBuilderPreviewTab,
      builderMode,
      packageResolution,
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
    const frames = builderMode
      ? [
          ...new Set([
            ...builderPreviewFrameRefs.current.values(),
            frameRef.current,
          ]),
        ]
      : [frameRef.current]
    for (const frame of frames) {
      postExampleSandboxTheme({
        frame,
        runToken: runTokenRef.current,
        theme: readTheme(),
      })
    }
  }, [builderMode, usesWebContainer])

  const handlePreviewLoad = React.useCallback(
    (tabId?: string) => {
      const frame = tabId
        ? builderPreviewFrameRefs.current.get(tabId)
        : builderMode
          ? builderValidationFrameRef.current
          : frameRef.current
      if (builderMode && !tabId && frame) frameRef.current = frame
      const pendingRunToken = pendingRunRef.current?.token
      postExampleSandboxBrowserCommand({
        channel: browserChannelRef.current,
        command: {
          kind: 'annotation',
          enabled: tabId
            ? builderPreviewAnnotationModesRef.current.has(tabId)
            : builderMode
              ? false
              : previewAnnotationMode,
        },
        frame: frame ?? null,
        targetOrigin: getPreviewTargetOrigin(frame?.src ?? ''),
      })
      if (
        tabId &&
        frame &&
        builderPreviewRestoredRunTokensRef.current.get(tabId) !==
          runTokenRef.current
      ) {
        builderPreviewRestoredRunTokensRef.current.set(
          tabId,
          runTokenRef.current,
        )
        const history =
          builderPreviewHistoriesRef.current.get(tabId) ??
          createExamplePreviewHistory()
        const targetUrl = history.entries[history.index] ?? '/'
        if (targetUrl !== '/') {
          postExampleSandboxBrowserCommand({
            channel: browserChannelRef.current,
            command: { kind: 'navigate', url: targetUrl },
            frame,
            targetOrigin: getPreviewTargetOrigin(frame.src),
          })
        }
      }
      const observesRun = frame === frameRef.current
      if (pendingRunToken && observesRun) {
        postExampleSandboxBrowserCommand({
          channel: browserChannelRef.current,
          command: {
            kind: 'observe',
            observationId: pendingRunToken,
          },
          frame,
          targetOrigin: getPreviewTargetOrigin(frame?.src ?? ''),
        })
      }

      if (!usesWebContainer) {
        syncTheme()
        return
      }

      if (pendingRunToken && observesRun) markRunReady(pendingRunToken)
    },
    [
      markRunReady,
      builderMode,
      previewAnnotationMode,
      syncTheme,
      usesWebContainer,
    ],
  )

  React.useEffect(() => {
    function handleMessage(event: MessageEvent<unknown>) {
      const builderPreview = builderMode
        ? [...builderPreviewFrameRefs.current.entries()].find(
            ([, frame]) => event.source === frame.contentWindow,
          )
        : undefined
      const isHiddenValidationFrame =
        builderMode &&
        event.source === builderValidationFrameRef.current?.contentWindow
      const sourceFrame =
        builderPreview?.[1] ??
        (isHiddenValidationFrame
          ? builderValidationFrameRef.current
          : frameRef.current)
      const isValidationFrame =
        event.source === frameRef.current?.contentWindow ||
        (needsBuilderValidationFrameRef.current && isHiddenValidationFrame)
      if (
        builderMode
          ? !builderPreview && !isValidationFrame
          : event.source !== sourceFrame?.contentWindow
      ) {
        return
      }
      const builderPreviewTabId = builderPreview?.[0]
      const previewOrigin = getPreviewTargetOrigin(
        sourceFrame?.src ?? previewUrl,
      )
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
            isValidationFrame &&
            environmentSnapshot?.runId === runTokenRef.current &&
            message.observationId === environmentSnapshot.runId
          ) {
            environmentSnapshot.preview = {
              observed: true,
              title: message.title,
              url: trustedUrl,
            }
            markRunObserved(message.observationId)
            if (builderMode) markRunReady(message.observationId)
          }
          if (isValidationFrame && builderMode && !builderPreviewTabId) return
          const currentHistory = builderPreviewTabId
            ? (builderPreviewHistoriesRef.current.get(builderPreviewTabId) ??
              createExamplePreviewHistory())
            : previewHistoryRef.current
          const currentUrl = currentHistory.entries[currentHistory.index] ?? '/'
          const nextHistory = updateExamplePreviewHistory(currentHistory, {
            kind: message.navigationKind,
            url: trustedUrl,
          })
          if (builderPreviewTabId) {
            builderPreviewHistoriesRef.current.set(
              builderPreviewTabId,
              nextHistory,
            )
            builderPreviewNavigationErrorsRef.current.delete(
              builderPreviewTabId,
            )
            setBuilderPreviewRevision((current) => current + 1)
            if (builderPreviewTabId === currentBuilderPreviewTabIdRef.current) {
              previewHistoryRef.current = nextHistory
              setPreviewHistory(nextHistory)
              setPreviewNavigationError('')
            }
          } else {
            previewHistoryRef.current = nextHistory
            setPreviewHistory(nextHistory)
            setPreviewNavigationError('')
          }
          if (message.navigationKind === 'load' || currentUrl !== trustedUrl) {
            if (builderPreviewTabId) {
              builderPreviewAnnotationTargetsRef.current.delete(
                builderPreviewTabId,
              )
              setBuilderPreviewRevision((current) => current + 1)
            } else {
              setPreviewAnnotationTarget(undefined)
            }
          }
          if (message.navigationKind === 'push' && revealPreviewOnPush) {
            if (builderMode) {
              revealBuilderPreviewTab()
            } else {
              setShowPreview(true)
              setMobileView('preview')
            }
          }
          return
        }

        if (message.kind === 'navigation-error') {
          const navigationError = usesWebContainer
            ? 'Preview navigation must stay on the current origin.'
            : 'This client preview only supports in-page links.'
          if (builderPreviewTabId) {
            builderPreviewNavigationErrorsRef.current.set(
              builderPreviewTabId,
              navigationError,
            )
            setBuilderPreviewRevision((current) => current + 1)
          }
          setPreviewNavigationError(navigationError)
          return
        }

        if (builderPreviewTabId) {
          if (
            !builderPreviewAnnotationModesRef.current.has(builderPreviewTabId)
          ) {
            return
          }
          const currentHistory =
            builderPreviewHistoriesRef.current.get(builderPreviewTabId) ??
            createExamplePreviewHistory()
          const currentUrl = currentHistory.entries[currentHistory.index] ?? '/'
          builderPreviewAnnotationTargetsRef.current.set(builderPreviewTabId, {
            rect: message.rect,
            selector: message.selector,
            tagName: message.tag,
            text: message.text,
            url: currentUrl,
          })
          setBuilderPreviewRevision((current) => current + 1)
          return
        }

        if (!previewAnnotationMode) return
        const currentHistory = builderPreviewTabId
          ? (builderPreviewHistoriesRef.current.get(builderPreviewTabId) ??
            createExamplePreviewHistory())
          : previewHistoryRef.current
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
      const observesRun = isValidationFrame
      if (message.kind === 'console') {
        const entry = {
          id: nextConsoleIdRef.current,
          level: message.level,
          values: message.values,
        }
        nextConsoleIdRef.current += 1
        const text = message.values.join('\n')
        if (observesRun) recordRunConsoleEntry(message.level, text)
        setConsoleEntries((current) => [...current, entry].slice(-500))
        if (message.level === 'error') {
          const consoleError = text || 'The builder logged an error.'
          if (!observesRun && builderPreviewTabId) {
            builderPreviewNavigationErrorsRef.current.set(
              builderPreviewTabId,
              consoleError,
            )
            setBuilderPreviewRevision((current) => current + 1)
            return
          }
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

      if (!observesRun) {
        if (message.status === 'error' && builderPreviewTabId) {
          builderPreviewNavigationErrorsRef.current.set(
            builderPreviewTabId,
            message.message || 'The builder failed while running.',
          )
          setBuilderPreviewRevision((current) => current + 1)
        }
        return
      }

      setStatus(message.status)
      setError(message.message ?? '')
      if (message.status === 'ready') {
        markRunReady(message.runToken)
      } else if (message.status === 'error') {
        recordRunConsoleEntry(
          'error',
          message.message || 'The builder failed while running.',
        )
        finishRun(message.runToken, {
          ok: false,
          phase: 'runtime',
          message: message.message || 'The builder failed while running.',
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
    revealBuilderPreviewTab,
    builderMode,
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
    if (!isBuilderPaneResizing) return
    const resize = builderPaneResizeRef.current
    return () => restoreBuilderPaneResize(resize)
  }, [isBuilderPaneResizing])

  React.useEffect(() => {
    if (!isBuilderChatResizing) return
    const resize = builderChatResizeRef.current
    return () => restoreBuilderChatResize(resize)
  }, [isBuilderChatResizing])

  React.useEffect(() => {
    if (!builderTabDrag?.active) return
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const drag = builderTabDragRef.current
      restoreBuilderTabDrag(drag)
      const button = drag
        ? builderTabButtonRefs.current.get(drag.tabId)
        : undefined
      if (drag && button?.hasPointerCapture(drag.pointerId)) {
        button.releasePointerCapture(drag.pointerId)
      }
      builderTabDragRef.current = null
      builderTabDidDragRef.current = false
      setBuilderTabDrag(undefined)
    }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [builderTabDrag?.active])

  React.useEffect(() => {
    const container = builderContainerRef.current
    if (!container) return
    const syncDesktopState = () => {
      setIsDesktop(container.clientWidth >= 900)
      setBuilderContainerWidth(container.clientWidth)
    }
    syncDesktopState()
    const observer = new ResizeObserver(syncDesktopState)
    observer.observe(container)
    return () => observer.disconnect()
  }, [alternateEditor])

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

  function getBuilderPanelId(tab: BuilderWorkbenchTab) {
    return `${builderTabsId}-${tab.id}-panel`
  }

  function assignBuilderRunFrame(frame: HTMLIFrameElement) {
    frameRef.current = frame
    needsBuilderValidationFrameRef.current = false
    setNeedsBuilderValidationFrame(false)
  }

  function setBuilderPreviewFrame(
    tabId: string,
    frame: HTMLIFrameElement | null,
  ) {
    if (frame) {
      builderPreviewFrameRefs.current.set(tabId, frame)
      if (
        pendingRunRef.current &&
        !frameRef.current &&
        !needsBuilderValidationFrameRef.current
      ) {
        assignBuilderRunFrame(frame)
      }
      return
    }
    const previous = builderPreviewFrameRefs.current.get(tabId)
    builderPreviewFrameRefs.current.delete(tabId)
    if (frameRef.current !== previous) return
    window.requestAnimationFrame(() => {
      if (
        frameRef.current !== previous ||
        builderPreviewFrameRefs.current.get(tabId) === previous
      ) {
        return
      }
      frameRef.current = null
      if (pendingRunRef.current) {
        needsBuilderValidationFrameRef.current = true
        setNeedsBuilderValidationFrame(true)
      }
    })
  }

  function getBuilderTabButtonId(tabId: string) {
    return `${builderTabsId}-${tabId}`
  }

  function getBuilderPaneId(paneId: string) {
    return `${builderTabsId}-${paneId}`
  }

  function focusBuilderTab(tabId: string | null) {
    window.requestAnimationFrame(() => {
      if (tabId) {
        builderTabButtonRefs.current.get(tabId)?.focus()
      } else {
        builderAddTabButtonRef.current?.focus()
      }
    })
  }

  function activateBuilderTab(tab: BuilderWorkbenchTab) {
    setBuilderArrangeTabId(undefined)
    setBuilderTabs((current) => activateBuilderWorkbenchTab(current, tab.id))
    if (tab.kind === 'editor') {
      setActivePath(tab.path)
      setShowFiles(tab.filesOpen)
    }
    if (tab.kind === 'console') setOutputActivated(true)
  }

  function addBuilderTab(tab: NewBuilderWorkbenchTab, paneId?: string) {
    if (tab.kind === 'console') {
      const existing = builderTabs.tabs.find(
        (candidate) => candidate.kind === 'console',
      )
      if (existing) {
        activateBuilderTab(existing)
        window.requestAnimationFrame(() => focusBuilderTab(existing.id))
        return
      }
    }
    const base = paneId
      ? activateBuilderWorkbenchPane(builderTabs, paneId)
      : builderTabs
    const next = addBuilderWorkbenchTab(base, tab)
    const addedTab = next.tabs.at(-1)
    setBuilderTabs(next)
    if (addedTab?.kind === 'preview') {
      builderPreviewHistoriesRef.current.set(
        addedTab.id,
        createExamplePreviewHistory(),
      )
    } else if (addedTab?.kind === 'editor') {
      setActivePath(addedTab.path)
      setShowFiles(addedTab.filesOpen)
    } else if (addedTab?.kind === 'console') {
      setOutputActivated(true)
    }
    window.requestAnimationFrame(() => focusBuilderTab(addedTab?.id ?? null))
  }

  function closeBuilderTab(tabId: string) {
    setBuilderArrangeTabId((current) =>
      current === tabId ? undefined : current,
    )
    const pane = getBuilderWorkbenchPaneForTab(builderTabs, tabId)
    const base = pane
      ? activateBuilderWorkbenchPane(builderTabs, pane.id)
      : builderTabs
    const next = closeBuilderWorkbenchTab(base, tabId)
    const nextActiveTab = getActiveBuilderWorkbenchTab(next)
    setBuilderTabs(next)
    builderPreviewHistoriesRef.current.delete(tabId)
    builderPreviewRestoredRunTokensRef.current.delete(tabId)
    builderPreviewNavigationErrorsRef.current.delete(tabId)
    builderPreviewAnnotationModesRef.current.delete(tabId)
    builderPreviewAnnotationTargetsRef.current.delete(tabId)
    builderPreviewAnnotationsRef.current.delete(tabId)
    if (currentBuilderPreviewTabIdRef.current === tabId) {
      currentBuilderPreviewTabIdRef.current = next.tabs.find(
        (tab) => tab.kind === 'preview',
      )?.id
    }
    if (nextActiveTab?.kind === 'editor') {
      setActivePath(nextActiveTab.path)
      setShowFiles(nextActiveTab.filesOpen)
    } else if (nextActiveTab?.kind === 'console') {
      setOutputActivated(true)
    }
    if (next.tabs.length === 0) {
      alternateEditor?.onActiveChange(true)
      setBuilderLayoutAnnouncement('Side panel hidden.')
    } else {
      focusBuilderTab(nextActiveTab?.id ?? null)
    }
  }

  function splitBuilderTab(
    tab: BuilderWorkbenchTab,
    position: 'before' | 'after',
  ) {
    const next = splitBuilderWorkbenchTab(builderTabs, tab.id, position)
    if (next === builderTabs) return
    setBuilderTabs(next)
    const pane = getBuilderWorkbenchPaneForTab(next, tab.id)
    setBuilderLayoutAnnouncement(
      `${getBuilderWorkbenchTabLabel(next.tabs, tab)} moved to ${
        position === 'before' ? 'upper' : 'lower'
      } pane.`,
    )
    focusBuilderTab(pane?.activeTabId ?? tab.id)
  }

  function moveBuilderTab(tab: BuilderWorkbenchTab, paneId: string) {
    const next = moveBuilderWorkbenchTab(builderTabs, tab.id, paneId)
    if (next === builderTabs) return
    setBuilderTabs(next)
    const paneIndex = next.panes.findIndex((pane) => pane.id === paneId)
    setBuilderLayoutAnnouncement(
      `${getBuilderWorkbenchTabLabel(next.tabs, tab)} moved to ${
        paneIndex === 0 ? 'upper' : 'lower'
      } pane.`,
    )
    focusBuilderTab(tab.id)
  }

  function navigateBuilderTabs(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Delete') {
      event.preventDefault()
      closeBuilderTab(event.currentTarget.dataset.tabId ?? '')
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
    const target = getBuilderWorkbenchTabNavigationTarget(
      builderTabs,
      event.currentTarget.dataset.tabId ?? '',
      event.key,
    )
    if (!target) return
    const tab = builderTabs.tabs.find((candidate) => candidate.id === target)
    if (!tab) return
    activateBuilderTab(tab)
    focusBuilderTab(tab.id)
  }

  function setBuilderFilesOpen(open: boolean, tabId?: string) {
    setShowFiles(open)
    const activeTab = tabId
      ? builderTabs.tabs.find((tab) => tab.id === tabId)
      : getActiveBuilderWorkbenchTab(builderTabs)
    if (activeTab?.kind !== 'editor') return
    setBuilderTabs((current) =>
      updateBuilderWorkbenchEditorTab(current, activeTab.id, {
        filesOpen: open,
      }),
    )
  }

  function selectFile(path: string, tabId?: string) {
    setActivePath(path)
    const activeTab = tabId
      ? builderTabs.tabs.find((tab) => tab.id === tabId)
      : getActiveBuilderWorkbenchTab(builderTabs)
    const closeFiles = !window.matchMedia('(min-width: 1024px)').matches
    if (alternateEditor && activeTab?.kind === 'editor') {
      setBuilderTabs((current) =>
        updateBuilderWorkbenchEditorTab(current, activeTab.id, {
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
    const activeTab = getActiveBuilderWorkbenchTab(builderTabs)
    if (alternateEditor && activeTab?.kind === 'editor') {
      setBuilderTabs((current) =>
        updateBuilderWorkbenchEditorTab(current, activeTab.id, {
          filesOpen: next,
        }),
      )
    }
  }

  function updateBuilderSource(path: string, source: string) {
    if (usesWebContainer) scheduleWebContainerWrite(path, source)

    const current = workspaceRef.current
    const next = createExampleWorkspace({
      binaryFiles: current.binaryFiles,
      entry: current.entry,
      environment: current.environment,
      files: { ...current.files, [path]: source },
      imports: current.imports,
    })
    workspaceRevisionRef.current += 1
    workspaceRef.current = next
    setWorkspace(next)
    onWorkspaceChange?.(next)
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
    tabId?: string,
  ) {
    const frame =
      builderMode || tabId
        ? builderPreviewFrameRefs.current.get(
            tabId ?? currentBuilderPreviewTabIdRef.current ?? '',
          )
        : frameRef.current
    postExampleSandboxBrowserCommand({
      channel: browserChannelRef.current,
      command,
      frame: frame ?? null,
      targetOrigin: getPreviewTargetOrigin(frame?.src ?? previewUrl),
    })
  }

  function reloadPreview(tabId?: string) {
    if (runActive || runDisabled) return
    const frame =
      builderMode || tabId
        ? builderPreviewFrameRefs.current.get(
            tabId ?? currentBuilderPreviewTabIdRef.current ?? '',
          )
        : frameRef.current
    const session = webContainerSessionRef.current
    if (usesWebContainer && frame && session) {
      void session.reloadPreview(frame).catch((cause: unknown) => {
        const message = formatError(cause)
        if (tabId) {
          builderPreviewNavigationErrorsRef.current.set(tabId, message)
          setBuilderPreviewRevision((current) => current + 1)
        } else {
          setPreviewNavigationError(message)
        }
      })
      return
    }
    sendPreviewBrowserCommand({ kind: 'reload' }, tabId)
  }

  function navigateBuilderPreviewHistory(
    tabIdOrOffset: string | -1 | 1,
    requestedOffset?: -1 | 1,
  ) {
    const tabId =
      typeof tabIdOrOffset === 'string'
        ? tabIdOrOffset
        : currentBuilderPreviewTabIdRef.current
    const offset =
      typeof tabIdOrOffset === 'number' ? tabIdOrOffset : requestedOffset
    if (!tabId || !offset) return
    const current =
      builderPreviewHistoriesRef.current.get(tabId) ??
      createExamplePreviewHistory()
    const index = current.index + offset
    const url = current.entries[index]
    if (!url) return

    const next = { entries: current.entries, index }
    builderPreviewHistoriesRef.current.set(tabId, next)
    if (tabId === currentBuilderPreviewTabIdRef.current) {
      previewHistoryRef.current = next
      setPreviewHistory(next)
    }
    setBuilderPreviewRevision((revision) => revision + 1)
    sendPreviewBrowserCommand({ kind: 'navigate', url }, tabId)
  }

  function setPreviewAnnotationMode(active: boolean, tabId?: string) {
    if (tabId) {
      currentBuilderPreviewTabIdRef.current = tabId
      if (active) builderPreviewAnnotationModesRef.current.add(tabId)
      else builderPreviewAnnotationModesRef.current.delete(tabId)
      builderPreviewAnnotationTargetsRef.current.delete(tabId)
      setBuilderPreviewRevision((current) => current + 1)
      sendPreviewBrowserCommand({ kind: 'annotation', enabled: active }, tabId)
      return
    }
    setPreviewAnnotationModeActive(active)
    setPreviewAnnotationTarget(undefined)
    sendPreviewBrowserCommand({ kind: 'annotation', enabled: active })
  }

  function clearPreviewAnnotationTarget(tabId?: string) {
    if (tabId) {
      builderPreviewAnnotationTargetsRef.current.delete(tabId)
      setBuilderPreviewRevision((current) => current + 1)
      sendPreviewBrowserCommand({ kind: 'annotation', enabled: true }, tabId)
      return
    }
    setPreviewAnnotationTarget(undefined)
    sendPreviewBrowserCommand({ kind: 'annotation', enabled: true })
  }

  function addPreviewAnnotation(
    annotation: SandboxBrowserAnnotation,
    tabId?: string,
  ) {
    if (tabId) {
      const current = builderPreviewAnnotationsRef.current.get(tabId) ?? []
      builderPreviewAnnotationsRef.current.set(tabId, [...current, annotation])
      setBuilderPreviewRevision((revision) => revision + 1)
      return
    }
    setPreviewAnnotations((current) => [...current, annotation])
  }

  function removePreviewAnnotation(annotationId: string, tabId?: string) {
    if (tabId) {
      const current = builderPreviewAnnotationsRef.current.get(tabId) ?? []
      const next = current.filter(
        (annotation) => annotation.id !== annotationId,
      )
      if (next.length) {
        builderPreviewAnnotationsRef.current.set(tabId, next)
      } else {
        builderPreviewAnnotationsRef.current.delete(tabId)
      }
      setBuilderPreviewRevision((revision) => revision + 1)
      return
    }
    setPreviewAnnotations((current) =>
      current.filter((annotation) => annotation.id !== annotationId),
    )
  }

  function submitPreviewAnnotations(
    annotations: ReadonlyArray<SandboxBrowserAnnotation>,
    tabId: string,
  ) {
    if (!alternateEditor?.submitPrompt || annotations.length === 0) return false
    const content = formatSandboxBrowserAnnotations(annotations)
    if (content.length > MAX_SANDBOX_BROWSER_ANNOTATION_PROMPT_LENGTH) {
      return false
    }

    const definitionId = builderDefinitionIdRef.current
    const accepted = alternateEditor.submitPrompt(content, {
      onDiscarded() {
        if (
          builderDefinitionIdRef.current !== definitionId ||
          !builderTabsRef.current.tabs.some((tab) => tab.id === tabId)
        ) {
          return
        }
        const current = builderPreviewAnnotationsRef.current.get(tabId) ?? []
        const currentIds = new Set(current.map((annotation) => annotation.id))
        builderPreviewAnnotationsRef.current.set(tabId, [
          ...annotations.filter((annotation) => !currentIds.has(annotation.id)),
          ...current,
        ])
        setBuilderPreviewRevision((revision) => revision + 1)
      },
    })
    alternateEditor.onActiveChange(true)
    if (!accepted) return false

    const submittedIds = new Set(annotations.map((annotation) => annotation.id))
    const current = builderPreviewAnnotationsRef.current.get(tabId) ?? []
    const next = current.filter(
      (annotation) => !submittedIds.has(annotation.id),
    )
    if (next.length) {
      builderPreviewAnnotationsRef.current.set(tabId, next)
    } else {
      builderPreviewAnnotationsRef.current.delete(tabId)
    }
    setBuilderPreviewRevision((revision) => revision + 1)
    return true
  }

  function capturePreview(tabId?: string) {
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
      sendPreviewBrowserCommand({ kind: 'capture', requestId }, tabId)
    })
  }

  function startBuilderTabDrag(
    event: React.PointerEvent<HTMLButtonElement>,
    tabId: string,
  ) {
    if (
      event.button !== 0 ||
      !isDesktop ||
      !window.matchMedia('(pointer: fine)').matches
    ) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    builderTabDragRef.current = {
      active: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      tabId,
    }
  }

  function moveBuilderTabDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = builderTabDragRef.current
    if (!drag || event.pointerId !== drag.pointerId) return
    const sourcePane = getBuilderWorkbenchPaneForTab(
      builderTabsRef.current,
      drag.tabId,
    )
    if (!sourcePane || sourcePane.tabIds.length === 1) return
    if (
      !drag.active &&
      (Math.abs(event.clientY - drag.startY) < 6 ||
        Math.abs(event.clientY - drag.startY) <=
          Math.abs(event.clientX - drag.startX))
    ) {
      return
    }

    const workspace = builderWorkspaceRef.current
    if (!workspace) return
    if (!drag.active) {
      drag.active = true
      setBuilderArrangeTabId(undefined)
      drag.frames = [...builderPreviewFrameRefs.current.values()].map(
        (frame) => ({ frame, pointerEvents: frame.style.pointerEvents }),
      )
      for (const { frame } of drag.frames) frame.style.pointerEvents = 'none'
      builderTabDidDragRef.current = true
    }

    if (builderTabsRef.current.panes.length === 1) {
      const rect = workspace.getBoundingClientRect()
      drag.targetPaneId = undefined
      drag.targetPosition =
        event.clientY < rect.top || event.clientY > rect.bottom
          ? undefined
          : event.clientY <= rect.top + rect.height / 3
            ? 'before'
            : event.clientY >= rect.bottom - rect.height / 3
              ? 'after'
              : undefined
    } else {
      const targetPane = builderTabsRef.current.panes.find((pane) => {
        if (pane.id === sourcePane.id) return false
        const rect = builderPaneRefs.current
          .get(pane.id)
          ?.getBoundingClientRect()
        return rect && event.clientY >= rect.top && event.clientY <= rect.bottom
      })
      drag.targetPaneId = targetPane?.id
      drag.targetPosition = undefined
    }
    setBuilderTabDrag({ ...drag })
  }

  function finishBuilderTabDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = builderTabDragRef.current
    if (!drag || event.pointerId !== drag.pointerId) return

    if (drag.active) {
      const current = builderTabsRef.current
      const next = drag.targetPaneId
        ? moveBuilderWorkbenchTab(current, drag.tabId, drag.targetPaneId)
        : drag.targetPosition
          ? splitBuilderWorkbenchTab(current, drag.tabId, drag.targetPosition)
          : current
      if (next !== current) {
        builderTabsRef.current = next
        setBuilderTabs(next)
        const tab = next.tabs.find((candidate) => candidate.id === drag.tabId)
        const pane = getBuilderWorkbenchPaneForTab(next, drag.tabId)
        if (tab && pane) {
          const paneIndex = next.panes.findIndex(
            (candidate) => candidate.id === pane.id,
          )
          setBuilderLayoutAnnouncement(
            `${getBuilderWorkbenchTabLabel(next.tabs, tab)} moved to ${
              paneIndex === 0 ? 'upper' : 'lower'
            } pane.`,
          )
          focusBuilderTab(tab.id)
        }
      }
    }

    restoreBuilderTabDrag(drag)
    builderTabDragRef.current = null
    setBuilderTabDrag(undefined)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function cancelBuilderTabDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = builderTabDragRef.current
    if (!drag || event.pointerId !== drag.pointerId) return
    restoreBuilderTabDrag(drag)
    builderTabDragRef.current = null
    builderTabDidDragRef.current = false
    setBuilderTabDrag(undefined)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function startBuilderPaneResize(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || builderTabs.panes.length !== 2) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const ownerDocument = event.currentTarget.ownerDocument
    const frames = [...builderPreviewFrameRefs.current.values()].map(
      (frame) => ({ frame, pointerEvents: frame.style.pointerEvents }),
    )
    builderPaneResizeRef.current = {
      frames,
      ownerDocument,
      pointerId: event.pointerId,
      previousCursor: ownerDocument.body.style.cursor,
      previousUserSelect: ownerDocument.body.style.userSelect,
    }
    ownerDocument.body.style.cursor = 'row-resize'
    ownerDocument.body.style.userSelect = 'none'
    for (const { frame } of frames) frame.style.pointerEvents = 'none'
    setIsBuilderPaneResizing(true)
  }

  function moveBuilderPaneResize(event: React.PointerEvent<HTMLDivElement>) {
    const resize = builderPaneResizeRef.current
    const grid = builderPaneGridRef.current
    if (!resize || !grid || event.pointerId !== resize.pointerId) return
    const rect = grid.getBoundingClientRect()
    const availableHeight = rect.height - 8
    if (availableHeight <= 0) return
    const upperFraction = clamp(
      (event.clientY - rect.top - 4) / availableHeight,
      0.2,
      0.8,
    )
    setBuilderTabs((current) =>
      resizeBuilderWorkbenchPanes(current, upperFraction),
    )
  }

  function finishBuilderPaneResize(event: React.PointerEvent<HTMLDivElement>) {
    const resize = builderPaneResizeRef.current
    if (!resize || event.pointerId !== resize.pointerId) return
    restoreBuilderPaneResize(resize)
    builderPaneResizeRef.current = null
    setIsBuilderPaneResizing(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function resizeBuilderPanesWithKeyboard(
    event: React.KeyboardEvent<HTMLDivElement>,
  ) {
    if (
      event.key !== 'ArrowUp' &&
      event.key !== 'ArrowDown' &&
      event.key !== 'Home' &&
      event.key !== 'End'
    ) {
      return
    }
    const grid = builderPaneGridRef.current
    if (!grid || builderTabs.panes.length !== 2) return
    event.preventDefault()
    const availableHeight = grid.getBoundingClientRect().height - 8
    if (availableHeight <= 0) return
    const current = builderTabs.panes[0].fraction
    const step = (event.shiftKey ? 64 : 24) / availableHeight
    const next =
      event.key === 'Home'
        ? 0.2
        : event.key === 'End'
          ? 0.8
          : current + (event.key === 'ArrowDown' ? step : -step)
    setBuilderTabs((state) =>
      resizeBuilderWorkbenchPanes(state, clamp(next, 0.2, 0.8)),
    )
  }

  function resetBuilderPaneSizes() {
    setBuilderTabs((current) => resizeBuilderWorkbenchPanes(current, 0.5))
  }

  function startBuilderChatResize(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !showsBuilderChatSplit) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const ownerDocument = event.currentTarget.ownerDocument
    const frames = [...builderPreviewFrameRefs.current.values()].map(
      (frame) => ({ frame, pointerEvents: frame.style.pointerEvents }),
    )
    builderChatResizeRef.current = {
      frames,
      ownerDocument,
      percent: builderChatPercent,
      pointerId: event.pointerId,
      previousCursor: ownerDocument.body.style.cursor,
      previousUserSelect: ownerDocument.body.style.userSelect,
    }
    ownerDocument.body.style.cursor = 'col-resize'
    ownerDocument.body.style.userSelect = 'none'
    for (const { frame } of frames) frame.style.pointerEvents = 'none'
    setIsBuilderChatResizing(true)
  }

  function moveBuilderChatResize(event: React.PointerEvent<HTMLDivElement>) {
    const resize = builderChatResizeRef.current
    const layout = builderLayoutRef.current
    if (!resize || !layout || event.pointerId !== resize.pointerId) return

    const rect = layout.getBoundingClientRect()
    if (rect.width <= 0) return
    const bounds = getBuilderChatPercentBounds(rect.width)
    const percent = clamp(
      ((event.clientX - rect.left) / rect.width) * 100,
      bounds.min,
      bounds.max,
    )
    resize.percent = percent
    setBuilderChatPercent(percent)
  }

  function finishBuilderChatResize(event: React.PointerEvent<HTMLDivElement>) {
    const resize = builderChatResizeRef.current
    if (!resize || event.pointerId !== resize.pointerId) return

    setBuilderChatPercent(resize.percent)
    restoreBuilderChatResize(resize)
    builderChatResizeRef.current = null
    setIsBuilderChatResizing(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function resizeBuilderChatWithKeyboard(
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

    const layout = builderLayoutRef.current
    if (!layout) return
    event.preventDefault()

    const width = layout.getBoundingClientRect().width
    if (width <= 0) return
    const bounds = getBuilderChatPercentBounds(width)
    const currentWidth = (builderChatPercent / 100) * width
    const minWidth = (bounds.min / 100) * width
    const maxWidth = (bounds.max / 100) * width
    const nextWidth =
      event.key === 'Home'
        ? minWidth
        : event.key === 'End'
          ? maxWidth
          : clamp(
              currentWidth +
                (event.key === 'ArrowRight' ? 1 : -1) *
                  (event.shiftKey ? 64 : 24),
              minWidth,
              maxWidth,
            )
    const percent = (nextWidth / width) * 100
    setBuilderChatPercent(percent)
  }

  function resetBuilderChatSize() {
    const bounds = getBuilderChatPercentBounds(builderContainerWidth)
    const percent = clamp(DEFAULT_BUILDER_CHAT_PERCENT, bounds.min, bounds.max)
    setBuilderChatPercent(percent)
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
  const activeBuilderPane = getActiveBuilderWorkbenchPane(builderTabs)
  const activeBuilderTab = getActiveBuilderWorkbenchTab(builderTabs)
  const visibleBuilderPanes =
    isDesktop && builderTabs.panes.length === 2
      ? builderTabs.panes
      : activeBuilderPane
        ? [activeBuilderPane]
        : []
  const activeBuilderEditorTab =
    activeBuilderTab?.kind === 'editor' ? activeBuilderTab : undefined
  const hasBuilderTabs = builderTabs.tabs.length > 0
  const builderWorkspaceOpen = builderWorkspaceVisible && hasBuilderTabs
  const builderChatOpen = alternateEditorActive || !builderWorkspaceOpen
  const showsBuilderChatSplit =
    builderMode && isDesktop && builderWorkspaceOpen && builderChatOpen
  const builderWorkspaceControls = React.useMemo(
    () => ({
      controlsId: builderWorkspaceId,
      open: builderWorkspaceOpen,
      toggle: toggleBuilderWorkspace,
    }),
    [builderWorkspaceId, builderWorkspaceOpen, toggleBuilderWorkspace],
  )

  React.useLayoutEffect(() => {
    if (!builderMode || !isDesktop || !hasBuilderTabs) return

    const bounds = getBuilderChatPercentBounds(builderContainerWidth)
    const next = clamp(builderChatPercent, bounds.min, bounds.max)
    if (next !== builderChatPercent) setBuilderChatPercent(next)
  }, [
    hasBuilderTabs,
    isDesktop,
    builderMode,
    builderChatPercent,
    builderContainerWidth,
  ])

  React.useEffect(() => {
    setBuilderTabs((current) =>
      repairBuilderWorkbenchEditorPaths(
        current,
        filePaths,
        getInitialFile(definition, workspace),
      ),
    )
  }, [definition, filePaths, workspace])

  React.useEffect(() => {
    if (!activeBuilderEditorTab) return
    setActivePath(activeBuilderEditorTab.path)
    setShowFiles(activeBuilderEditorTab.filesOpen)
  }, [activeBuilderEditorTab])

  React.useEffect(() => {
    if (activeBuilderTab?.kind !== 'preview') return

    const currentHistory = previewHistoryRef.current
    const currentUrl = currentHistory.entries[currentHistory.index] ?? '/'
    const history =
      builderPreviewHistoriesRef.current.get(activeBuilderTab.id) ??
      previewHistoryRef.current
    builderPreviewHistoriesRef.current.set(activeBuilderTab.id, history)
    currentBuilderPreviewTabIdRef.current = activeBuilderTab.id
    previewHistoryRef.current = history
    setPreviewHistory(history)

    const targetUrl = history.entries[history.index] ?? '/'
    if (targetUrl === currentUrl) return
    const frame = window.requestAnimationFrame(() => {
      const previewFrame = builderPreviewFrameRefs.current.get(
        activeBuilderTab.id,
      )
      postExampleSandboxBrowserCommand({
        channel: browserChannelRef.current,
        command: { kind: 'navigate', url: targetUrl },
        frame: previewFrame ?? null,
        targetOrigin: getPreviewTargetOrigin(previewFrame?.src ?? ''),
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeBuilderTab?.id, activeBuilderTab?.kind])

  React.useEffect(() => {
    if (
      alternateEditor &&
      builderTabs.tabs.length === 0 &&
      !alternateEditorActive
    ) {
      revealBuilderPreviewTab()
    }
  }, [
    alternateEditor,
    alternateEditorActive,
    builderTabs.tabs.length,
    revealBuilderPreviewTab,
  ])

  React.useEffect(() => {
    const wasOpen = previousBuilderChatOpenRef.current
    previousBuilderChatOpenRef.current = builderChatOpen
    if (!wasOpen || builderChatOpen) return
    const frame = window.requestAnimationFrame(() => {
      builderShowChatButtonRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [builderChatOpen])

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

  function renderBuilderPreviewPanel(tab: BuilderWorkbenchTab) {
    if (tab.kind !== 'preview') return null
    const history =
      builderPreviewHistoriesRef.current.get(tab.id) ??
      createExamplePreviewHistory()
    const tabPreviewUrl = history.entries[history.index] ?? '/'
    const tabExternalPreviewUrl = usesWebContainer
      ? getExternalPreviewUrl(tabPreviewUrl)
      : undefined
    const navigationError =
      builderPreviewNavigationErrorsRef.current.get(tab.id) ?? ''

    return (
      <section
        id={getBuilderPanelId(tab)}
        role="tabpanel"
        aria-labelledby={getBuilderTabButtonId(tab.id)}
        className="size-full min-h-0 overflow-hidden bg-background-default"
      >
        <SandboxBrowser
          annotationAvailable={Boolean(previewUrl || sourceDocument)}
          annotations={builderPreviewAnnotationsRef.current.get(tab.id) ?? []}
          annotationMode={builderPreviewAnnotationModesRef.current.has(tab.id)}
          annotationTarget={builderPreviewAnnotationTargetsRef.current.get(
            tab.id,
          )}
          canGoBack={canGoBackInExamplePreview(history)}
          canGoForward={canGoForwardInExamplePreview(history)}
          captureScreenshot={
            previewUrl || sourceDocument
              ? () => capturePreview(tab.id)
              : undefined
          }
          currentUrl={tabPreviewUrl}
          error={error || navigationError}
          history={[...new Set(history.entries)]}
          navigationAvailable={Boolean(previewUrl || sourceDocument)}
          onAnnotationModeChange={(active) =>
            setPreviewAnnotationMode(active, tab.id)
          }
          onAddAnnotation={(annotation) =>
            addPreviewAnnotation(annotation, tab.id)
          }
          onBack={() => navigateBuilderPreviewHistory(tab.id, -1)}
          onClearAnnotationTarget={() => clearPreviewAnnotationTarget(tab.id)}
          onForward={() => navigateBuilderPreviewHistory(tab.id, 1)}
          onNavigate={(url) =>
            sendPreviewBrowserCommand({ kind: 'navigate', url }, tab.id)
          }
          onRemoveAnnotation={(annotationId) =>
            removePreviewAnnotation(annotationId, tab.id)
          }
          onReload={() => reloadPreview(tab.id)}
          openExternalUrl={tabExternalPreviewUrl}
          reloadDisabled={runActive || runDisabled}
          onSubmitAnnotations={
            alternateEditor?.submitPrompt
              ? (annotations) => submitPreviewAnnotations(annotations, tab.id)
              : undefined
          }
        >
          {previewUrl ? (
            <iframe
              ref={(frame) => setBuilderPreviewFrame(tab.id, frame)}
              title={`${definition.title} ${getBuilderWorkbenchTabLabel(builderTabs.tabs, tab)} output`}
              allow="cross-origin-isolated"
              sandbox="allow-forms allow-same-origin allow-scripts"
              src={previewUrl}
              onLoad={() => handlePreviewLoad(tab.id)}
              className="block size-full border-0 bg-background-default"
            />
          ) : sourceDocument ? (
            <iframe
              ref={(frame) => setBuilderPreviewFrame(tab.id, frame)}
              title={`${definition.title} ${getBuilderWorkbenchTabLabel(builderTabs.tabs, tab)} output`}
              sandbox="allow-scripts"
              srcDoc={sourceDocument}
              onLoad={() => handlePreviewLoad(tab.id)}
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
    )
  }

  function renderBuilderEditorPanel(tab: BuilderWorkbenchTab) {
    if (tab.kind !== 'editor') return null
    const source = workspace.files[tab.path] ?? ''

    return (
      <section
        id={getBuilderPanelId(tab)}
        role="tabpanel"
        aria-labelledby={getBuilderTabButtonId(tab.id)}
        className="size-full min-h-0 overflow-hidden bg-[var(--th-background)]"
      >
        <div className="flex size-full min-h-0 flex-col">
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border-default bg-background-subtle px-2">
            <Tooltip
              content={tab.filesOpen ? 'Hide files' : 'Show files'}
              side="bottom"
            >
              <Button
                type="button"
                variant="icon"
                color="gray"
                size="icon-sm"
                rounded="md"
                className="size-9 shrink-0 transition-none active:scale-100"
                aria-pressed={tab.filesOpen}
                aria-label={tab.filesOpen ? 'Hide files' : 'Show files'}
                onClick={() => setBuilderFilesOpen(!tab.filesOpen, tab.id)}
              >
                <FolderOpenIcon className="size-3.5" aria-hidden="true" />
              </Button>
            </Tooltip>
            <div className="min-w-0 truncate font-ds-mono text-xs text-text-muted">
              {tab.path}
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <FileExplorer
              currentPath={tab.path}
              files={fileTree}
              isSidebarOpen={tab.filesOpen}
              libraryColor={libraryColor}
              onSidebarClose={() => setBuilderFilesOpen(false, tab.id)}
              prefetchFileContent={() => {}}
              setCurrentPath={(path) => selectFile(path, tab.id)}
            />
            <div className="flex min-w-0 flex-1 flex-col bg-[var(--th-background)]">
              <div
                className={`${tab.filesOpen ? 'hidden' : 'flex'} fade-x h-9 shrink-0 overflow-x-auto border-b border-border-default bg-background-subtle`}
              >
                {filePaths.map((path) => (
                  <button
                    key={path}
                    type="button"
                    title={path}
                    onClick={() => selectFile(path, tab.id)}
                    className={`shrink-0 border-r border-border-default px-2 font-ds-mono text-[11px] ${
                      tab.path === path
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
                  path={tab.path}
                  theme={resolvedTheme}
                  value={source}
                  onChange={(value) => updateBuilderSource(tab.path, value)}
                  onRun={() => {
                    if (!manualRunDisabled) void run()
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  function renderBuilderConsolePanel(tab: BuilderWorkbenchTab) {
    if (tab.kind !== 'console') return null
    const panelId = getBuilderPanelId(tab)
    const tabButtonId = getBuilderTabButtonId(tab.id)

    if (!usesWebContainer) {
      return (
        <ConsoleOutput
          id={panelId}
          ariaLabelledBy={tabButtonId}
          className="size-full min-h-0"
          entries={consoleEntries}
          label="Console output"
        />
      )
    }

    return (
      <section
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabButtonId}
        className="grid size-full min-h-0 grid-rows-[2rem_minmax(0,1fr)] overflow-hidden bg-background-default"
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
              const terminalPanelId = `${outputPanelId}-terminal-${id}`
              const terminalTabId = getTerminalTabId(id)

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
                    id={terminalTabId}
                    aria-controls={terminalPanelId}
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
            const terminalPanelId = `${outputPanelId}-terminal-${id}`
            const terminalTabId = getTerminalTabId(id)

            return webContainerSession ? (
              <div
                key={id}
                id={terminalPanelId}
                role="tabpanel"
                aria-label={label}
                aria-labelledby={terminalTabId}
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
      </section>
    )
  }

  function renderBuilderPane(
    pane: BuilderWorkbenchPane,
    paneIndex: number,
    flattened = false,
  ) {
    const paneTabs = flattened
      ? builderTabs.tabs
      : getBuilderWorkbenchPaneTabs(builderTabs, pane)
    const paneTab = flattened
      ? activeBuilderTab
      : paneTabs.find((tab) => tab.id === pane.activeTabId)
    const paneLabel = flattened
      ? 'Builder workspace'
      : paneIndex === 0
        ? 'Upper workspace'
        : 'Lower workspace'
    const newTabLabel =
      flattened || builderTabs.panes.length === 1
        ? 'New tab'
        : `New tab in ${paneIndex === 0 ? 'upper' : 'lower'} pane`
    const showPaneActions =
      (flattened || paneIndex === 0) && (allowSharing || !builderChatOpen)

    return (
      <div
        key={pane.id}
        id={getBuilderPaneId(pane.id)}
        ref={(element) => {
          if (element) builderPaneRefs.current.set(pane.id, element)
          else builderPaneRefs.current.delete(pane.id)
        }}
        className="grid min-h-0 min-w-0 grid-rows-[2.25rem_minmax(0,1fr)] overflow-hidden bg-background-default"
        onPointerDownCapture={() => {
          setBuilderTabs((current) =>
            activateBuilderWorkbenchPane(current, pane.id),
          )
        }}
      >
        <header className="relative z-20 flex min-w-0 items-center gap-1 border-b border-border-default bg-background-default p-1">
          <div
            role="tablist"
            aria-label={paneLabel}
            className="fade-x flex min-w-0 shrink items-center gap-1 overflow-x-auto"
          >
            {paneTabs.map((tab) => {
              const label = getBuilderWorkbenchTabLabel(builderTabs.tabs, tab)
              const editorPathSeparator =
                tab.kind === 'editor' ? tab.path.lastIndexOf('/') : -1
              const editorDirectory =
                tab.kind === 'editor' && editorPathSeparator >= 0
                  ? tab.path.slice(0, editorPathSeparator + 1)
                  : ''
              const editorFileName =
                tab.kind === 'editor'
                  ? tab.path.slice(editorPathSeparator + 1)
                  : ''
              const tabPane = getBuilderWorkbenchPaneForTab(builderTabs, tab.id)
              const tabPaneIndex = builderTabs.panes.findIndex(
                (candidate) => candidate.id === tabPane?.id,
              )
              const otherPane = builderTabs.panes.find(
                (candidate) => candidate.id !== tabPane?.id,
              )
              const active = tab.id === paneTab?.id
              const dragging = tab.id === builderTabDrag?.tabId
              const canArrange = paneTabs.length > 1 || Boolean(otherPane)

              const tabButton = (
                <button
                  ref={(element) => {
                    if (element) {
                      builderTabButtonRefs.current.set(tab.id, element)
                    } else {
                      builderTabButtonRefs.current.delete(tab.id)
                    }
                  }}
                  type="button"
                  role="tab"
                  id={getBuilderTabButtonId(tab.id)}
                  data-tab-id={tab.id}
                  aria-controls={getBuilderPanelId(tab)}
                  aria-selected={active}
                  aria-label={label}
                  title={label}
                  tabIndex={active ? 0 : -1}
                  className="flex min-w-0 touch-pan-x items-center gap-2 px-2.5 text-[13px] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus"
                  onClick={() => {
                    if (builderTabDidDragRef.current) {
                      builderTabDidDragRef.current = false
                      return
                    }
                    if (active && canArrange) {
                      setBuilderArrangeTabId((current) =>
                        current === tab.id ? undefined : tab.id,
                      )
                      return
                    }
                    activateBuilderTab(tab)
                    focusBuilderTab(tab.id)
                  }}
                  onKeyDown={(event) => {
                    const opensMenu =
                      active &&
                      canArrange &&
                      (event.key === 'Enter' ||
                        event.key === ' ' ||
                        event.key === 'ArrowDown' ||
                        (event.shiftKey && event.key === 'F10'))
                    if (opensMenu) {
                      event.preventDefault()
                      setBuilderArrangeTabId(tab.id)
                      return
                    }
                    navigateBuilderTabs(event)
                  }}
                  onPointerDown={(event) => {
                    if (active && canArrange && event.button === 0) {
                      event.preventDefault()
                    }
                    startBuilderTabDrag(event, tab.id)
                  }}
                  onPointerMove={moveBuilderTabDrag}
                  onPointerUp={finishBuilderTabDrag}
                  onPointerCancel={cancelBuilderTabDrag}
                  onLostPointerCapture={cancelBuilderTabDrag}
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
                  {tab.kind === 'editor' ? (
                    <span className="flex min-w-0 max-w-40 items-center overflow-hidden font-ds-mono @min-[900px]:max-w-56">
                      {editorDirectory ? (
                        <span className="min-w-0 overflow-hidden whitespace-nowrap text-right text-text-muted">
                          {editorDirectory}
                        </span>
                      ) : null}
                      <span className="shrink-0">{editorFileName}</span>
                    </span>
                  ) : (
                    <span>{label}</span>
                  )}
                </button>
              )

              return (
                <div
                  key={tab.id}
                  role="presentation"
                  className={`corner-squircle flex h-7 shrink-0 items-stretch overflow-hidden rounded-lg transition-colors duration-100 motion-reduce:transition-none ${
                    active
                      ? 'bg-surface-state-hover text-text-primary'
                      : 'text-text-secondary hover:bg-surface-state-hover hover:text-text-primary'
                  } ${dragging ? 'opacity-50' : ''}`}
                >
                  {active && canArrange ? (
                    <Dropdown
                      open={builderArrangeTabId === tab.id}
                      onOpenChange={(open) => {
                        if (!open) setBuilderArrangeTabId(undefined)
                      }}
                    >
                      <DropdownTrigger>{tabButton}</DropdownTrigger>
                      <DropdownContent
                        align="start"
                        ariaLabelledBy={getBuilderTabButtonId(tab.id)}
                        className="sandbox-ui min-w-44 border-black/10 dark:border-white/10"
                      >
                        {otherPane ? (
                          <DropdownItem
                            onSelect={() => moveBuilderTab(tab, otherPane.id)}
                          >
                            Move to {tabPaneIndex === 0 ? 'lower' : 'upper'}{' '}
                            pane
                          </DropdownItem>
                        ) : (
                          <>
                            <DropdownItem
                              onSelect={() => splitBuilderTab(tab, 'before')}
                            >
                              Split above
                            </DropdownItem>
                            <DropdownItem
                              onSelect={() => splitBuilderTab(tab, 'after')}
                            >
                              Split below
                            </DropdownItem>
                          </>
                        )}
                      </DropdownContent>
                    </Dropdown>
                  ) : (
                    tabButton
                  )}

                  <Tooltip content={`Close ${label}`} side="bottom">
                    <button
                      type="button"
                      aria-label={`Close ${label}`}
                      className="flex w-7 items-center justify-center text-text-secondary hover:bg-surface-state-pressed hover:text-text-primary focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus"
                      onClick={() => closeBuilderTab(tab.id)}
                    >
                      <XIcon className="size-3.5" aria-hidden="true" />
                    </button>
                  </Tooltip>
                </div>
              )
            })}
          </div>

          <Dropdown>
            <DropdownTrigger>
              <Button
                ref={
                  pane.id === builderTabs.activePaneId
                    ? builderAddTabButtonRef
                    : undefined
                }
                type="button"
                variant="icon"
                color="gray"
                size="icon-sm"
                rounded="lg"
                className="size-7 shrink-0 bg-transparent text-text-primary transition-colors duration-100 hover:bg-surface-state-hover active:scale-95 max-[899px]:bg-transparent max-[899px]:text-text-primary max-[899px]:hover:bg-surface-state-hover motion-reduce:transition-none"
                aria-label={newTabLabel}
              >
                <PlusIcon className="size-3.5" aria-hidden="true" />
              </Button>
            </DropdownTrigger>
            <DropdownContent
              align="start"
              sideOffset={4}
              collisionPadding={8}
              className="sandbox-ui w-64 max-w-[calc(100vw-1rem)] origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-xl border-black/10 p-1 shadow-xl duration-100 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 dark:border-white/10 motion-reduce:animate-none"
            >
              <DropdownItem
                className="min-h-10 gap-2 rounded-lg px-2 py-1 text-[13px] text-text-primary transition-colors duration-100 hover:bg-surface-state-hover focus:bg-surface-state-hover motion-reduce:transition-none min-[900px]:min-h-9"
                onSelect={() => addBuilderTab({ kind: 'preview' }, pane.id)}
              >
                <BrowserIcon className="size-4" aria-hidden="true" />
                Preview
              </DropdownItem>
              <DropdownItem
                className="min-h-10 gap-2 rounded-lg px-2 py-1 text-[13px] text-text-primary transition-colors duration-100 hover:bg-surface-state-hover focus:bg-surface-state-hover motion-reduce:transition-none min-[900px]:min-h-9"
                onSelect={() =>
                  addBuilderTab(
                    {
                      kind: 'editor',
                      path: activePath,
                      filesOpen: showFiles,
                    },
                    pane.id,
                  )
                }
              >
                <CodeIcon className="size-4" aria-hidden="true" />
                Editor
              </DropdownItem>
              <DropdownItem
                className="min-h-10 gap-2 rounded-lg px-2 py-1 text-[13px] text-text-primary transition-colors duration-100 hover:bg-surface-state-hover focus:bg-surface-state-hover motion-reduce:transition-none min-[900px]:min-h-9"
                onSelect={() => addBuilderTab({ kind: 'console' }, pane.id)}
              >
                <TerminalWindowIcon className="size-4" aria-hidden="true" />
                Console
              </DropdownItem>
            </DropdownContent>
          </Dropdown>

          {showPaneActions ? (
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {(flattened || paneIndex === 0) && allowSharing ? (
                <Tooltip
                  content={
                    shareState === 'copied' ? 'Copied' : 'Copy share link'
                  }
                  side="bottom"
                >
                  <Button
                    type="button"
                    variant="icon"
                    color="gray"
                    size="icon-sm"
                    rounded="lg"
                    className="size-7 shrink-0 bg-transparent transition-colors duration-100 hover:bg-surface-state-hover active:scale-95 disabled:hover:bg-transparent max-[899px]:bg-transparent max-[899px]:hover:bg-surface-state-hover motion-reduce:transition-none"
                    aria-label="Copy share link"
                    disabled={shareState === 'sharing'}
                    onClick={() => void share()}
                  >
                    <ShareIcon className="size-3.5" aria-hidden="true" />
                  </Button>
                </Tooltip>
              ) : null}

              {(flattened || paneIndex === 0) && !builderChatOpen ? (
                <>
                  <Tooltip content="Show chat" side="bottom">
                    <Button
                      ref={builderShowChatButtonRef}
                      type="button"
                      variant="icon"
                      color="gray"
                      size="icon-sm"
                      rounded="lg"
                      className="size-7 shrink-0 bg-transparent transition-colors duration-100 hover:bg-surface-state-hover active:scale-95 max-[899px]:bg-transparent max-[899px]:hover:bg-surface-state-hover motion-reduce:transition-none"
                      aria-label="Show chat"
                      aria-controls={builderChatId}
                      aria-expanded={builderChatOpen}
                      onClick={() => alternateEditor?.onActiveChange(true)}
                    >
                      <ChatCircleDotsIcon
                        className="size-3.5"
                        aria-hidden="true"
                      />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Hide side panel">
                    <Button
                      type="button"
                      variant="icon"
                      color="gray"
                      size="icon-sm"
                      rounded="lg"
                      className="size-7 shrink-0 bg-transparent transition-colors duration-100 hover:bg-surface-state-hover active:scale-95 max-[899px]:bg-transparent max-[899px]:hover:bg-surface-state-hover motion-reduce:transition-none"
                      aria-label="Hide side panel"
                      aria-controls={builderWorkspaceId}
                      aria-expanded={true}
                      onClick={toggleBuilderWorkspace}
                    >
                      <SidebarSimpleIcon
                        className="size-3.5"
                        mirrored
                        aria-hidden="true"
                      />
                    </Button>
                  </Tooltip>
                </>
              ) : null}
            </div>
          ) : null}
        </header>

        <div className="min-h-0 min-w-0 overflow-hidden">
          {paneTab?.kind === 'preview'
            ? renderBuilderPreviewPanel(paneTab)
            : paneTab?.kind === 'editor'
              ? renderBuilderEditorPanel(paneTab)
              : paneTab
                ? renderBuilderConsolePanel(paneTab)
                : null}
        </div>
      </div>
    )
  }

  if (alternateEditor) {
    const upperFraction = builderTabs.panes[0]?.fraction ?? 1
    const lowerFraction = builderTabs.panes[1]?.fraction ?? 0
    const showsBuilderSplit = isDesktop && visibleBuilderPanes.length === 2
    const splitStyle = showsBuilderSplit
      ? { gridTemplateRows: `${upperFraction}fr 8px ${lowerFraction}fr` }
      : { gridTemplateRows: 'minmax(0, 1fr)' }
    const builderChatBounds = getBuilderChatPercentBounds(builderContainerWidth)
    const currentBuilderChatPercent = clamp(
      builderChatPercent,
      builderChatBounds.min,
      builderChatBounds.max,
    )
    const builderLayoutStyle: BuilderLayoutStyle = {
      '--builder-chat-desktop-track': builderWorkspaceOpen
        ? builderChatOpen
          ? `${currentBuilderChatPercent}fr`
          : '0fr'
        : '1fr',
      '--builder-chat-mobile-track': builderChatOpen ? '1fr' : '0fr',
      '--builder-workspace-desktop-track': builderWorkspaceOpen
        ? builderChatOpen
          ? `${100 - currentBuilderChatPercent}fr`
          : '1fr'
        : '0fr',
      '--builder-workspace-mobile-track': builderWorkspaceOpen ? '1fr' : '0fr',
    }

    return (
      <section
        ref={builderContainerRef}
        className={`sandbox-ui @container not-prose relative flex min-w-0 flex-col overflow-hidden bg-background-default text-text-primary ${
          fullscreen
            ? 'min-h-0 flex-1 rounded-none'
            : 'h-[clamp(520px,75dvh,720px)] rounded-lg border border-border-default'
        } ${className ?? ''}`}
        aria-label={`${definition.title} workbench`}
      >
        {shareError ? (
          <div
            className="absolute top-3 right-3 left-3 z-30 flex max-h-28 items-start gap-2 overflow-hidden rounded-md border border-border-default bg-background-surface px-2.5 py-2 shadow-sm sm:left-auto sm:w-96"
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

        <div
          ref={builderLayoutRef}
          className={`relative grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,var(--builder-workspace-mobile-track))_minmax(0,var(--builder-chat-mobile-track))] overflow-hidden duration-[180ms] [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none @min-[900px]:grid-cols-[minmax(0,var(--builder-chat-desktop-track))_minmax(0,var(--builder-workspace-desktop-track))] @min-[900px]:grid-rows-[minmax(0,1fr)] ${
            isBuilderChatResizing
              ? 'transition-none'
              : 'transition-[grid-template-columns,grid-template-rows]'
          }`}
          style={builderLayoutStyle}
        >
          <div
            id={builderWorkspaceId}
            ref={builderWorkspaceRef}
            aria-hidden={!builderWorkspaceOpen}
            inert={!builderWorkspaceOpen}
            className={`z-20 col-start-1 row-start-1 min-h-0 min-w-0 overflow-hidden @min-[900px]:col-start-2 ${
              builderWorkspaceOpen ? '' : 'pointer-events-none'
            } ${hasBuilderTabs ? '' : 'invisible'}`}
          >
            <div className="relative size-full min-h-0 min-w-0 overflow-hidden">
              <div
                ref={builderPaneGridRef}
                className="grid size-full min-h-0 min-w-0 overflow-hidden"
                style={splitStyle}
              >
                {visibleBuilderPanes.map((pane, index) => (
                  <React.Fragment key={pane.id}>
                    {renderBuilderPane(
                      pane,
                      index,
                      !isDesktop && builderTabs.panes.length === 2,
                    )}
                    {showsBuilderSplit && index === 0 ? (
                      <div
                        role="separator"
                        tabIndex={0}
                        aria-label="Resize builder panes"
                        aria-orientation="horizontal"
                        aria-controls={visibleBuilderPanes
                          .map((candidate) => getBuilderPaneId(candidate.id))
                          .join(' ')}
                        aria-valuemin={20}
                        aria-valuemax={80}
                        aria-valuenow={Math.round(upperFraction * 100)}
                        aria-valuetext={`Upper ${Math.round(
                          upperFraction * 100,
                        )}%, lower ${Math.round(lowerFraction * 100)}%`}
                        className="group relative z-20 touch-none cursor-row-resize bg-border-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus"
                        onDoubleClick={resetBuilderPaneSizes}
                        onKeyDown={resizeBuilderPanesWithKeyboard}
                        onPointerDown={startBuilderPaneResize}
                        onPointerMove={moveBuilderPaneResize}
                        onPointerUp={finishBuilderPaneResize}
                        onPointerCancel={finishBuilderPaneResize}
                        onLostPointerCapture={finishBuilderPaneResize}
                      >
                        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border-default group-hover:bg-border-focus group-focus-visible:bg-border-focus" />
                      </div>
                    ) : null}
                  </React.Fragment>
                ))}
              </div>

              {needsBuilderValidationFrame && (previewUrl || sourceDocument) ? (
                previewUrl ? (
                  <iframe
                    ref={builderValidationFrameRef}
                    title={`${definition.title} validation output`}
                    aria-hidden="true"
                    tabIndex={-1}
                    allow="cross-origin-isolated"
                    sandbox="allow-forms allow-same-origin allow-scripts"
                    src={previewUrl}
                    onLoad={() => handlePreviewLoad()}
                    className="pointer-events-none absolute size-px opacity-0"
                  />
                ) : (
                  <iframe
                    ref={builderValidationFrameRef}
                    title={`${definition.title} validation output`}
                    aria-hidden="true"
                    tabIndex={-1}
                    sandbox="allow-scripts"
                    srcDoc={sourceDocument}
                    onLoad={() => handlePreviewLoad()}
                    className="pointer-events-none absolute size-px opacity-0"
                  />
                )
              ) : null}

              {builderTabDrag?.active ? (
                <div
                  className="pointer-events-none absolute inset-0 z-40 grid grid-rows-2 gap-2 bg-background-default/40 p-3"
                  aria-hidden="true"
                >
                  {builderTabs.panes.length === 1 ? (
                    <>
                      <div
                        className={`flex items-center justify-center rounded-lg border-2 border-dashed text-xs font-medium ${
                          builderTabDrag.targetPosition === 'before'
                            ? 'border-border-focus bg-background-elevated text-text-primary'
                            : 'border-border-default bg-background-subtle/70 text-text-muted'
                        }`}
                      >
                        Tile above
                      </div>
                      <div
                        className={`flex items-center justify-center rounded-lg border-2 border-dashed text-xs font-medium ${
                          builderTabDrag.targetPosition === 'after'
                            ? 'border-border-focus bg-background-elevated text-text-primary'
                            : 'border-border-default bg-background-subtle/70 text-text-muted'
                        }`}
                      >
                        Tile below
                      </div>
                    </>
                  ) : (
                    builderTabs.panes.map((pane, index) => (
                      <div
                        key={pane.id}
                        className={`flex items-center justify-center rounded-lg border-2 border-dashed text-xs font-medium ${
                          builderTabDrag.targetPaneId === pane.id
                            ? 'border-border-focus bg-background-elevated text-text-primary'
                            : 'border-border-default bg-background-subtle/70 text-text-muted'
                        }`}
                      >
                        Move to {index === 0 ? 'upper' : 'lower'} pane
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {showsBuilderChatSplit ? (
            <div
              data-builder-chat-separator=""
              role="separator"
              tabIndex={0}
              aria-label="Resize chat and side panel"
              aria-orientation="vertical"
              aria-controls={`${builderChatId} ${builderWorkspaceId}`}
              aria-valuemin={Math.round(builderChatBounds.min)}
              aria-valuemax={Math.round(builderChatBounds.max)}
              aria-valuenow={Math.round(currentBuilderChatPercent)}
              aria-valuetext={`Chat ${Math.round(
                currentBuilderChatPercent,
              )}%, side panel ${Math.round(100 - currentBuilderChatPercent)}%`}
              className="group absolute inset-y-0 left-[38%] z-20 w-2 -translate-x-1/2 touch-none cursor-col-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus"
              style={{ left: `${currentBuilderChatPercent}%` }}
              onDoubleClick={resetBuilderChatSize}
              onKeyDown={resizeBuilderChatWithKeyboard}
              onPointerDown={startBuilderChatResize}
              onPointerMove={moveBuilderChatResize}
              onPointerUp={finishBuilderChatResize}
              onPointerCancel={finishBuilderChatResize}
              onLostPointerCapture={finishBuilderChatResize}
            >
              <div
                className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 group-hover:bg-border-focus group-focus-visible:bg-border-focus ${
                  isBuilderChatResizing
                    ? 'bg-border-focus'
                    : 'bg-border-default'
                }`}
              />
            </div>
          ) : null}

          <aside
            id={builderChatId}
            aria-label={alternateEditor.label}
            aria-hidden={!builderChatOpen}
            inert={!builderChatOpen}
            className={`z-10 col-start-1 row-start-2 flex min-h-0 min-w-0 overflow-hidden bg-background-default @min-[900px]:row-start-1 ${
              builderWorkspaceOpen && builderChatOpen
                ? 'border-t border-border-default @min-[900px]:border-r @min-[900px]:border-t-0'
                : ''
            } ${builderChatOpen ? '' : 'pointer-events-none'}`}
          >
            <BuilderWorkspaceControlsContext.Provider
              value={builderWorkspaceControls}
            >
              {alternateEditor.content}
            </BuilderWorkspaceControlsContext.Provider>
          </aside>
        </div>

        <div className="sr-only" aria-live="polite">
          {builderLayoutAnnouncement}
        </div>
      </section>
    )
  }

  return (
    <section
      className={`sandbox-ui not-prose relative flex min-w-0 flex-col overflow-hidden bg-background-default text-text-primary ${
        fullscreen
          ? 'min-h-0 flex-1 rounded-none'
          : 'h-[clamp(520px,75dvh,720px)] rounded-lg border border-border-default'
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
          className="absolute top-12 right-3 left-3 z-30 flex max-h-28 items-start gap-2 overflow-hidden rounded-md border border-border-default bg-background-surface px-2.5 py-2 shadow-sm sm:left-auto sm:w-96"
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
              annotations={previewAnnotations}
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
              onAddAnnotation={(annotation) => addPreviewAnnotation(annotation)}
              onBack={() => sendPreviewBrowserCommand({ kind: 'back' })}
              onClearAnnotationTarget={clearPreviewAnnotationTarget}
              onForward={() => sendPreviewBrowserCommand({ kind: 'forward' })}
              onNavigate={(url) =>
                sendPreviewBrowserCommand({ kind: 'navigate', url })
              }
              onRemoveAnnotation={(annotationId) =>
                removePreviewAnnotation(annotationId)
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
                  onLoad={() => handlePreviewLoad()}
                  className="block size-full border-0 bg-background-default"
                />
              ) : sourceDocument ? (
                <iframe
                  ref={frameRef}
                  title={`${definition.title} output`}
                  sandbox="allow-scripts"
                  srcDoc={sourceDocument}
                  onLoad={() => handlePreviewLoad()}
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

function getBuilderChatPercentBounds(width: number) {
  if (width <= 0) return { min: 0, max: 100 }
  const minWidth = Math.min(MIN_DESKTOP_PANEL_WIDTH, width / 2)
  const min = (minWidth / width) * 100
  return { min, max: 100 - min }
}

function restoreCodePanelResize(resize: CodePanelResize | null) {
  if (!resize) return

  resize.ownerDocument.body.style.cursor = resize.previousCursor
  resize.ownerDocument.body.style.userSelect = resize.previousUserSelect
  if (resize.frame) {
    resize.frame.style.pointerEvents = resize.previousFramePointerEvents
  }
}

function restoreBuilderPaneResize(resize: BuilderPaneResize | null) {
  if (!resize) return

  resize.ownerDocument.body.style.cursor = resize.previousCursor
  resize.ownerDocument.body.style.userSelect = resize.previousUserSelect
  for (const { frame, pointerEvents } of resize.frames) {
    frame.style.pointerEvents = pointerEvents
  }
}

function restoreBuilderChatResize(resize: BuilderChatResize | null) {
  if (!resize) return

  resize.ownerDocument.body.style.cursor = resize.previousCursor
  resize.ownerDocument.body.style.userSelect = resize.previousUserSelect
  for (const { frame, pointerEvents } of resize.frames) {
    frame.style.pointerEvents = pointerEvents
  }
}

function restoreBuilderTabDrag(drag: BuilderTabDrag | null) {
  if (!drag?.frames) return
  for (const { frame, pointerEvents } of drag.frames) {
    frame.style.pointerEvents = pointerEvents
  }
}
