import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { useQueryClient } from '@tanstack/react-query'
import { useHotkey } from '@tanstack/react-hotkeys'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Streamdown } from 'streamdown'
import * as v from 'valibot'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  CheckCircle2,
  Clock3,
  Download,
  EllipsisVertical,
  ExternalLink,
  Folder,
  GitPullRequest,
  Loader2,
  MonitorPlay,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
} from '~/components/Dropdown'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/Collapsible'
import {
  FileTree,
  buildFileTreeFromPaths,
  type FileTreeNode,
} from '~/components/FileTree'
import { ForgeWebContainerPreview } from '~/components/forge/WebContainerPreview'
import { CodeBlock } from '~/components/markdown/CodeBlock'
import { getCodeBlockLanguageFromFilePath } from '~/components/markdown/codeBlock.shared'
import { InlineCode } from '~/ui/InlineCode'
import { requireAuth } from '~/utils/auth.functions'
import {
  getForgeChatShells,
  getLocalForgeSession,
  startLocalForgeRun,
  type ForgeChatShell,
  validateLocalForgeWorkspace,
} from '~/utils/forge.functions'
import {
  applyForgeStateEvents,
  type ForgeStateEvent,
} from '~/utils/forge-state'
import {
  getForgeGitHubExportDisplayState,
  getForgeRunSummaryTitle,
  getForgeWorkflowStatusText,
  getLatestForgeGitHubExport,
} from '~/utils/forge-ui'
import {
  createForgeChatShellsCollection,
  createForgeProjectedStateEventsCollection,
  forgeChatShellsQueryKey,
  insertForgeProjectedStateEvents,
} from '~/utils/forge-collections'
import { validateRepoName } from '~/utils/github-validation'
import { seo } from '~/utils/seo'

type ForgeSession = Awaited<ReturnType<typeof getLocalForgeSession>>
type ForgeRouteChat = Pick<
  ForgeChatShell,
  | 'createdAt'
  | 'currentManifestVersionId'
  | 'id'
  | 'latestRunId'
  | 'latestRunStatus'
  | 'title'
  | 'updatedAt'
>
type ForgeActivityEvent =
  | ForgeSession['agentEvents'][number]
  | ForgeSession['workflowEvents'][number]
type ForgeManifestFileChange = NonNullable<
  ForgeSession['manifestChange']
>['files'][number]
type ForgeManifestFile = NonNullable<
  ForgeSession['currentManifest']
>['files'][string]
type ForgeStreamStatus = 'connecting' | 'disconnected' | 'live'
type ForgeRightPanelMode = 'files' | 'preview' | 'source'
type ForgeWorkspaceMode = 'changes' | 'file'
type ForgeGitHubAuthState = {
  authenticated: boolean
  hasGitHubAccount: boolean
  hasPrivateRepoScope: boolean
  hasRepoScope: boolean
}
type ForgeStateBatchStreamEvent = {
  events: Array<ForgeStateEvent>
  stateOffset: number
  timelineOffset: number
  type: 'state-batch'
}
type ForgeActivityTranscriptItem = {
  createdAt: string
  id: string
  kind: 'activity'
  source: 'agent' | 'workflow'
  value: ForgeActivityEvent
}
type ForgeTranscriptMessage = Pick<
  ForgeSession['messages'][number],
  'content' | 'createdAt' | 'id' | 'role' | 'status'
>
type ForgeMessageTranscriptItem = {
  createdAt: string
  id: string
  kind: 'message'
  value: ForgeTranscriptMessage
}
type ForgeToolTranscriptItem = {
  createdAt: string
  id: string
  kind: 'tool'
  value: ForgeToolActivityGroup
}
type ForgeTranscriptWorkItem =
  | ForgeActivityTranscriptItem
  | ForgeToolTranscriptItem
type ForgeActivityTranscriptGroup = {
  createdAt: string
  id: string
  items: Array<ForgeTranscriptWorkItem>
  kind: 'activityGroup'
}
type ForgeSemanticTranscriptGroup = {
  createdAt: string
  id: string
  items: Array<ForgeTranscriptWorkItem>
  kind: 'semanticGroup'
  semanticKind: 'validation'
}
type ForgeTranscriptItem =
  | ForgeActivityTranscriptGroup
  | ForgeMessageTranscriptItem
  | ForgeSemanticTranscriptGroup
  | ForgeTranscriptWorkItem
type ForgeToolActivityGroup = {
  createdAt: string
  events: Array<ForgeSession['agentEvents'][number]>
  id: string
  name: string
  path?: string
  toolCallId?: string
}
type ForgeActivityGroupChildItem =
  | ForgeTranscriptWorkItem
  | {
      id: string
      items: Array<ForgeToolTranscriptItem>
      kind: 'toolBundle'
      toolName: string
    }
type ForgeValidationStep = {
  detail?: string
  event: ForgeActivityEvent
  id: string
  label: string
  status?: string
}
type ForgeChatVirtualRow =
  | {
      id: string
      kind: 'activityHeader'
      showLabel: boolean
    }
  | {
      id: string
      kind: 'activeWork'
    }
  | {
      id: string
      kind: 'summary'
    }
  | {
      id: string
      item: ForgeTranscriptItem
      kind: 'transcript'
    }
type ForgeLayoutStyle = CSSProperties & {
  '--forge-left-pane-width': string
  '--forge-right-pane-width': string
}
type ForgeResizablePane = 'left' | 'right'

const FORGE_LEFT_PANE_DEFAULT_WIDTH = 280
const FORGE_LEFT_PANE_MIN_WIDTH = 220
const FORGE_LEFT_PANE_MAX_WIDTH = 380
const FORGE_RIGHT_PANE_DEFAULT_WIDTH = 680
const FORGE_RIGHT_PANE_MIN_WIDTH = 420
const FORGE_RIGHT_PANE_MAX_WIDTH = 960
const FORGE_CHAT_PANE_MIN_WIDTH = 360
const FORGE_RIGHT_PANE_BREAKPOINT = 1280

const forgeSearchSchema = v.object({
  chatId: v.optional(
    v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
  ),
})

function toDefaultRepoName(value?: string) {
  const normalized = (value ?? 'forge-local-app')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')

  return normalized || 'forge-local-app'
}

function resolveForgeChatId({
  activeChatId,
  chats,
  requestedChatId,
}: {
  activeChatId?: string
  chats: Array<ForgeRouteChat>
  requestedChatId?: string
}) {
  if (requestedChatId) {
    return requestedChatId
  }

  if (activeChatId && chats.some((chat) => chat.id === activeChatId)) {
    return activeChatId
  }

  return chats[0]?.id ?? ''
}

function createPendingForgeSession({
  chatId,
  chats,
}: {
  chatId: string
  chats: Array<ForgeRouteChat>
}): ForgeSession {
  const chat = chats.find((item) => item.id === chatId)

  return {
    activeChatId: chatId,
    agentEvents: [],
    chats: chats.map(toForgeSnapshotChat),
    exports: [],
    fileCount: 0,
    files: {},
    latestRun:
      chat?.latestRunId && chat.latestRunStatus
        ? {
            id: chat.latestRunId,
            status: chat.latestRunStatus,
          }
        : undefined,
    manifestVersionId: chat?.currentManifestVersionId,
    messages: [],
    stateEventCount: 0,
    timelineEventCount: 0,
    topFiles: [],
    totalBytes: 0,
    warnings: [],
    workflowEvents: [],
  }
}

function toForgeSnapshotChat(
  chat: ForgeRouteChat,
): ForgeSession['chats'][number] {
  return {
    createdAt: chat.createdAt,
    id: chat.id,
    title: chat.title,
    updatedAt: chat.updatedAt,
  }
}

export const Route = createFileRoute('/forge')({
  beforeLoad: async () => {
    try {
      const user = await requireAuth()
      return { user }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  head: () => ({
    meta: seo({
      title: 'TanStack Forge',
      description: 'Build TanStack apps with a local agent loop harness.',
    }),
  }),
  validateSearch: forgeSearchSchema,
  loader: async () => {
    const chatShells = await getForgeChatShells()

    if (!chatShells.activeChatId) {
      throw redirect({ to: '/forge/new' })
    }

    return chatShells
  },
  shouldReload: false,
  component: ForgeRoute,
})

function ForgeRoute() {
  const loaderChatShells = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const initialChatId = resolveForgeChatId({
    activeChatId: loaderChatShells.activeChatId,
    chats: loaderChatShells.chats,
    requestedChatId: search.chatId,
  })
  const sessionCacheRef = useRef(new Map<string, ForgeSession>())
  const [selectedChatId, setSelectedChatId] = useState(initialChatId)
  const [session, setSession] = useState(() =>
    createPendingForgeSession({
      chatId: initialChatId,
      chats: loaderChatShells.chats,
    }),
  )
  const [prompt, setPrompt] = useState('')
  const [runError, setRunError] = useState<string | null>(null)
  const [showLogEvents, setShowLogEvents] = useState(false)
  const [openTranscriptItemIds, setOpenTranscriptItemIds] = useState<
    Record<string, boolean>
  >({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [isExportingGitHub, setIsExportingGitHub] = useState(false)
  const [githubRepoName, setGithubRepoName] = useState(() =>
    toDefaultRepoName(),
  )
  const [githubIsPrivate, setGithubIsPrivate] = useState(true)
  const [githubAuthState, setGithubAuthState] = useState<ForgeGitHubAuthState>()
  const [githubExportError, setGithubExportError] = useState<string | null>(
    null,
  )
  const [githubExportUrl, setGithubExportUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | undefined>()
  const [fileFilter, setFileFilter] = useState('')
  const [rightPanelMode, setRightPanelMode] =
    useState<ForgeRightPanelMode>('preview')
  const [leftPaneWidth, setLeftPaneWidth] = useState(
    FORGE_LEFT_PANE_DEFAULT_WIDTH,
  )
  const [rightPaneWidth, setRightPaneWidth] = useState(
    FORGE_RIGHT_PANE_DEFAULT_WIDTH,
  )
  const [resizingPane, setResizingPane] = useState<ForgeResizablePane>()
  const [hasMountedPreviewPanel, setHasMountedPreviewPanel] = useState(
    rightPanelMode === 'preview',
  )
  const [workspaceMode, setWorkspaceMode] = useState<ForgeWorkspaceMode>('file')
  const [streamStatus, setStreamStatus] =
    useState<ForgeStreamStatus>('connecting')
  const promptFormRef = useRef<HTMLFormElement>(null)
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingChatNavigationRef = useRef<string | undefined>(undefined)
  const forgeLayoutStyle = useMemo<ForgeLayoutStyle>(
    () => ({
      '--forge-left-pane-width': `${leftPaneWidth}px`,
      '--forge-right-pane-width': `${rightPaneWidth}px`,
    }),
    [leftPaneWidth, rightPaneWidth],
  )
  const leftPaneMaxWidth = getForgeLeftPaneMaxWidth(rightPaneWidth)
  const rightPaneMaxWidth = getForgeRightPaneMaxWidth(leftPaneWidth)
  const chatShellsCollection = useMemo(
    () => createForgeChatShellsCollection(queryClient),
    [queryClient],
  )
  const chatShellsQuery = useLiveQuery(
    (query) =>
      query
        .from({ chat: chatShellsCollection })
        .orderBy(({ chat }) => chat.updatedAt, 'desc'),
    [chatShellsCollection],
  )
  const resizePane = useCallback(
    (pane: ForgeResizablePane, width: number) => {
      if (pane === 'left') {
        setLeftPaneWidth(() => clampForgeLeftPaneWidth(width, rightPaneWidth))
        return
      }

      setRightPaneWidth(() => clampForgeRightPaneWidth(width, leftPaneWidth))
    },
    [leftPaneWidth, rightPaneWidth],
  )
  const handlePaneResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, pane: ForgeResizablePane) => {
      event.preventDefault()

      const handle = event.currentTarget
      const startX = event.clientX
      const startWidth = pane === 'left' ? leftPaneWidth : rightPaneWidth
      const pointerId = event.pointerId
      const previousCursor = document.body.style.cursor
      const previousUserSelect = document.body.style.userSelect

      handle.setPointerCapture(pointerId)
      setResizingPane(pane)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      function cleanup() {
        if (handle.hasPointerCapture(pointerId)) {
          handle.releasePointerCapture(pointerId)
        }

        setResizingPane(undefined)
        document.body.style.cursor = previousCursor
        document.body.style.userSelect = previousUserSelect
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
        window.removeEventListener('pointercancel', handlePointerUp)
        window.removeEventListener('blur', handlePointerUp)
      }

      function handlePointerMove(moveEvent: PointerEvent) {
        moveEvent.preventDefault()
        const delta = moveEvent.clientX - startX
        const nextWidth =
          pane === 'left' ? startWidth + delta : startWidth - delta

        resizePane(pane, nextWidth)
      }

      function handlePointerUp() {
        cleanup()
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp, { once: true })
      window.addEventListener('pointercancel', handlePointerUp, { once: true })
      window.addEventListener('blur', handlePointerUp, { once: true })
    },
    [leftPaneWidth, resizePane, rightPaneWidth],
  )
  const handlePaneResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>, pane: ForgeResizablePane) => {
      const step = event.shiftKey ? 48 : 16
      const currentWidth = pane === 'left' ? leftPaneWidth : rightPaneWidth
      let nextWidth: number | undefined

      if (event.key === 'Home') {
        nextWidth =
          pane === 'left'
            ? FORGE_LEFT_PANE_MIN_WIDTH
            : FORGE_RIGHT_PANE_MIN_WIDTH
      } else if (event.key === 'End') {
        nextWidth =
          pane === 'left'
            ? getForgeLeftPaneMaxWidth(rightPaneWidth)
            : getForgeRightPaneMaxWidth(leftPaneWidth)
      } else if (event.key === 'ArrowLeft') {
        nextWidth = pane === 'left' ? currentWidth - step : currentWidth + step
      } else if (event.key === 'ArrowRight') {
        nextWidth = pane === 'left' ? currentWidth + step : currentWidth - step
      }

      if (nextWidth === undefined) {
        return
      }

      event.preventDefault()
      resizePane(pane, nextWidth)
    },
    [leftPaneWidth, resizePane, rightPaneWidth],
  )

  useEffect(() => {
    if (rightPanelMode === 'preview') {
      setHasMountedPreviewPanel(true)
    }
  }, [rightPanelMode])
  useEffect(() => {
    function handleWindowResize() {
      setLeftPaneWidth((width) =>
        clampForgeLeftPaneWidth(width, rightPaneWidth),
      )
      setRightPaneWidth((width) =>
        clampForgeRightPaneWidth(width, leftPaneWidth),
      )
    }

    handleWindowResize()
    window.addEventListener('resize', handleWindowResize)

    return () => window.removeEventListener('resize', handleWindowResize)
  }, [leftPaneWidth, rightPaneWidth])
  const streamChatId = selectedChatId || session.activeChatId
  const projectedStateEventsCollection = useMemo(
    () => createForgeProjectedStateEventsCollection(streamChatId),
    [streamChatId],
  )
  const liveSidebarChats =
    chatShellsQuery.isReady && chatShellsQuery.data !== undefined
      ? chatShellsQuery.data
      : loaderChatShells.chats
  const sidebarChats = useMemo(() => {
    if (
      !selectedChatId ||
      liveSidebarChats.some((chat) => chat.id === selectedChatId)
    ) {
      return liveSidebarChats
    }

    const selectedChat =
      session.chats.find((chat) => chat.id === selectedChatId) ??
      loaderChatShells.chats.find((chat) => chat.id === selectedChatId)

    return selectedChat ? [selectedChat, ...liveSidebarChats] : liveSidebarChats
  }, [liveSidebarChats, loaderChatShells.chats, selectedChatId, session.chats])
  const selectedSidebarChatId = selectedChatId
  const latestRun = session.latestRun
  const githubRepoNameForExport = githubRepoName.trim()
  const githubRepoNameValidation = useMemo(
    () => validateRepoName(githubRepoNameForExport),
    [githubRepoNameForExport],
  )
  const files = useMemo(
    () => Object.keys(session.files).sort(),
    [session.files],
  )
  const manifestFileTree = useMemo(() => buildFileTreeFromPaths(files), [files])
  const filteredManifestFileTree = useMemo(
    () => filterFileTreeNodes(manifestFileTree, fileFilter),
    [fileFilter, manifestFileTree],
  )
  const fileFilterIsActive = fileFilter.trim().length > 0
  const fileChangeMap = useMemo(() => {
    return new Map(
      session.manifestChange?.files.map((file) => [file.path, file]) ?? [],
    )
  }, [session.manifestChange])
  const firstChangedFile = session.manifestChange?.files[0]?.path
  const transcriptItems = useMemo(
    () => createForgeTranscriptItems(session),
    [session],
  )
  const manifestShortId = session.manifestVersionId
    ? compactManifestId(session.manifestVersionId)
    : 'No manifest'
  const latestGitHubExport = useMemo(
    () => getLatestForgeGitHubExport(session.exports),
    [session.exports],
  )
  const persistedRunIsActive =
    latestRun?.status === 'queued' ||
    latestRun?.status === 'starting' ||
    latestRun?.status === 'running' ||
    latestRun?.status === 'paused' ||
    latestRun?.status === 'finishing'
  const canRun =
    prompt.trim().length > 0 &&
    !isSubmitting &&
    !isValidating &&
    !isExportingGitHub &&
    !persistedRunIsActive
  const canValidate =
    Boolean(session.manifestVersionId) &&
    !isSubmitting &&
    !isValidating &&
    !isExportingGitHub &&
    !persistedRunIsActive
  const canExportGitHub =
    Boolean(session.manifestVersionId) &&
    githubAuthState?.authenticated === true &&
    githubAuthState.hasGitHubAccount &&
    hasRequiredGitHubRepoScope({
      authState: githubAuthState,
      isPrivate: githubIsPrivate,
    }) &&
    githubRepoNameValidation.valid &&
    !isSubmitting &&
    !isValidating &&
    !isExportingGitHub &&
    !persistedRunIsActive
  const canManageChats =
    !isSubmitting &&
    !isValidating &&
    !isExportingGitHub &&
    !persistedRunIsActive
  const statusText = getForgeWorkflowStatusText({
    isExportingGitHub,
    isValidating,
    isSubmitting,
    latestRunStatus: latestRun?.status,
  })
  const selectedFileContent = selectedFile
    ? session.files[selectedFile]
    : undefined
  const selectedManifestFile = selectedFile
    ? session.currentManifest?.files[selectedFile]
    : undefined
  const selectedFileChange = selectedFile
    ? fileChangeMap.get(selectedFile)
    : undefined
  const effectiveWorkspaceMode =
    workspaceMode === 'changes' && selectedFileChange ? 'changes' : 'file'
  const downloadHref = session.manifestVersionId
    ? `/api/forge/download?manifestVersionId=${encodeURIComponent(
        session.manifestVersionId,
      )}`
    : undefined
  const handleTranscriptItemOpenChange = useCallback(
    (itemId: string, open: boolean) => {
      setOpenTranscriptItemIds((current) => {
        if (Boolean(current[itemId]) === open) {
          return current
        }

        const next = { ...current }

        if (open) {
          next[itemId] = true
        } else {
          delete next[itemId]
        }

        return next
      })
    },
    [],
  )

  const activateForgeChat = useCallback(
    ({
      chatId,
      replace,
      resetComposer,
      updateUrl = true,
    }: {
      chatId: string
      replace?: boolean
      resetComposer?: boolean
      updateUrl?: boolean
    }) => {
      const cachedSession = sessionCacheRef.current.get(chatId)

      setSelectedChatId(chatId)
      setSession(
        cachedSession ??
          createPendingForgeSession({
            chatId,
            chats: sidebarChats,
          }),
      )

      if (resetComposer) {
        setPrompt('')
        setSelectedFile(undefined)
        setWorkspaceMode('file')
        setRightPanelMode('preview')
      }

      if (!updateUrl) {
        return
      }

      pendingChatNavigationRef.current = chatId

      void navigate({
        replace,
        search: (previous) => ({
          ...previous,
          chatId,
        }),
      })
        .then(() => {
          if (pendingChatNavigationRef.current === chatId) {
            pendingChatNavigationRef.current = undefined
          }
        })
        .catch(async (error: unknown) => {
          if (pendingChatNavigationRef.current === chatId) {
            pendingChatNavigationRef.current = undefined
          }

          setRunError(
            error instanceof Error
              ? error.message
              : 'Forge chat could not open.',
          )
          await router.invalidate()
        })
    },
    [navigate, router, sidebarChats],
  )

  useHotkey(
    'Enter',
    (event) => {
      if (event.isComposing || event.shiftKey) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (!canRun) {
        return
      }

      promptFormRef.current?.requestSubmit()
    },
    {
      ignoreInputs: false,
      preventDefault: false,
      stopPropagation: false,
      target: promptTextareaRef,
    },
  )

  useEffect(() => {
    const pendingChatId = pendingChatNavigationRef.current

    if (pendingChatId) {
      if (search.chatId === pendingChatId) {
        pendingChatNavigationRef.current = undefined
      } else if (pendingChatId === selectedChatId) {
        return
      }
    }

    const chatId = resolveForgeChatId({
      activeChatId: loaderChatShells.activeChatId,
      chats: sidebarChats,
      requestedChatId: search.chatId,
    })

    if (!chatId) {
      void navigate({ replace: true, to: '/forge/new' })
      return
    }

    const shouldRepairUrl = search.chatId !== chatId

    if (chatId !== selectedChatId || shouldRepairUrl) {
      activateForgeChat({
        chatId,
        replace: true,
        resetComposer: chatId !== selectedChatId,
        updateUrl: shouldRepairUrl,
      })
    }
  }, [
    activateForgeChat,
    loaderChatShells.activeChatId,
    navigate,
    search.chatId,
    selectedChatId,
    sidebarChats,
  ])

  useEffect(() => {
    let cancelled = false
    const chatId = selectedChatId

    if (!chatId) {
      return
    }

    const cachedSession = sessionCacheRef.current.get(chatId)

    if (cachedSession) {
      setSession(cachedSession)
    }

    void getLocalForgeSession({
      data: {
        chatId,
      },
    })
      .then((nextSession) => {
        if (cancelled) {
          return
        }

        sessionCacheRef.current.set(nextSession.activeChatId, nextSession)
        setSession(nextSession)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRunError(
            error instanceof Error
              ? error.message
              : 'Forge chat could not load.',
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedChatId])

  useEffect(() => {
    let cancelled = false

    async function loadGitHubAuthState() {
      try {
        const response = await fetch('/api/forge/export/github')
        const value: unknown = await response.json()

        if (!cancelled && isForgeGitHubAuthState(value)) {
          setGithubAuthState(value)
        }
      } catch {
        if (!cancelled) {
          setGithubAuthState({
            authenticated: false,
            hasGitHubAccount: false,
            hasPrivateRepoScope: false,
            hasRepoScope: false,
          })
        }
      }
    }

    void loadGitHubAuthState()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (githubRepoName.trim()) {
      return
    }

    setGithubRepoName(toDefaultRepoName(session.currentManifest?.app.name))
  }, [githubRepoName, session.currentManifest?.app.name])

  useEffect(() => {
    if (
      selectedFile &&
      (session.files[selectedFile] !== undefined ||
        fileChangeMap.has(selectedFile))
    ) {
      return
    }

    setSelectedFile(files[0])
  }, [fileChangeMap, files, selectedFile, session.files])

  useEffect(() => {
    const chatId = streamChatId

    if (!chatId) {
      return
    }

    setStreamStatus('connecting')

    const eventSource = new EventSource(
      `/api/forge/events?chatId=${encodeURIComponent(chatId)}&stateOffset=0`,
    )

    function handleSnapshot(event: Event) {
      if (!(event instanceof MessageEvent) || typeof event.data !== 'string') {
        return
      }

      const nextSession = parseForgeSnapshotEvent(event.data)

      if (nextSession && nextSession.activeChatId === chatId) {
        sessionCacheRef.current.set(nextSession.activeChatId, nextSession)
        setSession(nextSession)
      }
    }

    function handleStateBatch(event: Event) {
      if (!(event instanceof MessageEvent) || typeof event.data !== 'string') {
        return
      }

      const batch = parseForgeStateBatchEvent(event.data)

      if (batch) {
        insertForgeProjectedStateEvents(
          projectedStateEventsCollection,
          chatId,
          batch.events,
        )
        setSession((currentSession) => {
          if (currentSession.activeChatId !== chatId) {
            return currentSession
          }

          const nextSession = applyForgeStateEvents(
            currentSession,
            batch.events,
          )

          sessionCacheRef.current.set(nextSession.activeChatId, nextSession)

          return nextSession
        })
      }
    }

    eventSource.addEventListener('open', () => {
      setStreamStatus('live')
    })
    eventSource.addEventListener('error', () => {
      setStreamStatus('disconnected')
    })
    eventSource.addEventListener('snapshot', handleSnapshot)
    eventSource.addEventListener('state-batch', handleStateBatch)

    return () => {
      eventSource.removeEventListener('snapshot', handleSnapshot)
      eventSource.removeEventListener('state-batch', handleStateBatch)
      eventSource.close()
    }
  }, [projectedStateEventsCollection, streamChatId])

  function handleCreateChat() {
    void navigate({ to: '/forge/new' })
  }

  function handleSelectChat(chatId: string) {
    if (chatId === selectedSidebarChatId) {
      return
    }

    setRunError(null)
    activateForgeChat({
      chatId,
      resetComposer: true,
    })
  }

  function handleDeleteChat(chatId: string) {
    if (!canManageChats) {
      return
    }

    const remainingChats = sidebarChats.filter((chat) => chat.id !== chatId)
    const isDeletingSelectedChat =
      chatId === selectedSidebarChatId || chatId === session.activeChatId
    setRunError(null)

    try {
      const transaction = chatShellsCollection.delete(chatId)

      if (isDeletingSelectedChat) {
        setPrompt('')
        setSelectedFile(undefined)
        setWorkspaceMode('file')
        setRightPanelMode('preview')
        const nextChat = remainingChats[0]

        if (nextChat) {
          activateForgeChat({
            chatId: nextChat.id,
            replace: true,
            resetComposer: true,
          })
        } else {
          void navigate({ replace: true, to: '/forge/new' }).catch(
            async (error: unknown) => {
              setRunError(
                error instanceof Error
                  ? error.message
                  : 'Forge chat could not open.',
              )
              await router.invalidate()
            },
          )
        }
      }

      void transaction.isPersisted.promise.catch(async (error: unknown) => {
        setRunError(
          error instanceof Error
            ? error.message
            : 'Forge chat could not delete.',
        )
        await queryClient.invalidateQueries({
          queryKey: forgeChatShellsQueryKey,
        })
      })
    } catch (error) {
      setRunError(
        error instanceof Error ? error.message : 'Forge chat could not delete.',
      )
    }
  }

  async function handleRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canRun) {
      return
    }

    setIsSubmitting(true)
    setRunError(null)

    try {
      const nextSession = await startLocalForgeRun({
        data: {
          chatId: session.activeChatId,
          clientRequestId: `forge-request-${crypto.randomUUID()}`,
          prompt,
        },
      })
      setSession(nextSession)
      setPrompt('')
      await queryClient.invalidateQueries({ queryKey: forgeChatShellsQueryKey })
      await router.invalidate()
    } catch (error) {
      setRunError(
        error instanceof Error ? error.message : 'Forge run failed to start.',
      )
      await router.invalidate()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleValidate() {
    if (!canValidate) {
      return
    }

    setIsValidating(true)
    setRunError(null)

    try {
      const nextSession = await validateLocalForgeWorkspace({
        data: { chatId: session.activeChatId },
      })
      setSession(nextSession)
      await queryClient.invalidateQueries({ queryKey: forgeChatShellsQueryKey })
      await router.invalidate()
    } catch (error) {
      setRunError(
        error instanceof Error
          ? error.message
          : 'Forge workspace validation failed.',
      )
      await router.invalidate()
    } finally {
      setIsValidating(false)
    }
  }

  async function handleGitHubExport() {
    if (!canExportGitHub) {
      return
    }

    setIsExportingGitHub(true)
    setGithubExportError(null)
    setGithubExportUrl(null)

    try {
      const response = await fetch('/api/forge/export/github', {
        body: JSON.stringify({
          isPrivate: githubIsPrivate,
          manifestVersionId: session.manifestVersionId,
          repoName: githubRepoNameForExport,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
      const result: unknown = await response.json()

      if (!response.ok || !isRecord(result) || result.success !== true) {
        const message =
          isRecord(result) && typeof result.error === 'string'
            ? result.error
            : 'GitHub export failed.'
        throw new Error(message)
      }

      setGithubExportUrl(readString(result.repoUrl) ?? null)
      await router.invalidate()
    } catch (error) {
      setGithubExportUrl(null)
      setGithubExportError(
        error instanceof Error ? error.message : 'GitHub export failed.',
      )
      await router.invalidate()
    } finally {
      setIsExportingGitHub(false)
    }
  }

  return (
    <main className="h-[calc(100dvh-var(--navbar-height))] overflow-hidden bg-neutral-50 text-neutral-950 dark:bg-[#0c0c0c] dark:text-neutral-100">
      <div
        className="grid h-full grid-cols-1 overflow-hidden lg:grid-cols-[var(--forge-left-pane-width)_minmax(0,1fr)] xl:grid-cols-[var(--forge-left-pane-width)_minmax(360px,1fr)_var(--forge-right-pane-width)]"
        style={forgeLayoutStyle}
      >
        <aside className="relative hidden min-h-0 flex-col border-r border-neutral-200 bg-neutral-100 dark:border-white/10 dark:bg-[#222323] lg:flex">
          <div className="min-h-0 flex-1 overflow-auto px-2 py-3">
            <SidebarActionButton
              disabled={!canManageChats}
              icon={<Plus className="h-3.5 w-3.5" />}
              label="New chat"
              onClick={handleCreateChat}
            />

            <div className="mt-3 space-y-1">
              {sidebarChats.length > 0 ? (
                sidebarChats.map((chat) => (
                  <SidebarChatRow
                    active={chat.id === selectedSidebarChatId}
                    chat={chat}
                    deleteDisabled={!canManageChats}
                    selectDisabled={false}
                    key={chat.id}
                    onDelete={() => handleDeleteChat(chat.id)}
                    onSelect={() => handleSelectChat(chat.id)}
                  />
                ))
              ) : (
                <div className="px-2 py-1.5 text-xs text-neutral-500 dark:text-neutral-500">
                  No chats yet.
                </div>
              )}
            </div>
          </div>
          <ForgePaneResizeHandle
            ariaLabel="Resize chat list"
            max={leftPaneMaxWidth}
            min={FORGE_LEFT_PANE_MIN_WIDTH}
            onKeyDown={(event) => handlePaneResizeKeyDown(event, 'left')}
            onPointerDown={(event) =>
              handlePaneResizePointerDown(event, 'left')
            }
            side="right"
            value={leftPaneWidth}
          />
        </aside>

        <section className="flex min-h-0 flex-col border-r border-neutral-200 bg-white dark:border-white/10 dark:bg-[#151515]">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-white/10">
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">
                Local Forge PoC
              </h1>
              <div className="truncate text-xs text-neutral-500 dark:text-neutral-500">
                {statusText}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                aria-pressed={showLogEvents}
                className={topBarToggleButtonClassName(showLogEvents)}
                onClick={() => setShowLogEvents((value) => !value)}
                title={
                  showLogEvents ? 'Hide low-level logs' : 'Show low-level logs'
                }
                type="button"
              >
                Logs
              </button>
              <a
                className={iconButtonClassName({
                  enabled: Boolean(downloadHref) && !isSubmitting,
                })}
                download
                href={downloadHref}
                onClick={(event) => {
                  if (!downloadHref || isSubmitting) {
                    event.preventDefault()
                  }
                }}
                title="Download manifest ZIP"
              >
                <Download className="h-4 w-4" />
              </a>
              <button
                className={iconButtonClassName({
                  active: isValidating,
                  enabled: canValidate,
                })}
                disabled={!canValidate}
                onClick={handleValidate}
                title="Validate workspace"
                type="button"
              >
                {isValidating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>
            </div>
          </header>

          <ForgeChatScrollPane
            activeChatId={session.activeChatId}
            items={transcriptItems}
            latestRun={latestRun}
            onItemOpenChange={handleTranscriptItemOpenChange}
            openItemIds={openTranscriptItemIds}
            showLogEvents={showLogEvents}
            summary={
              <RunSummaryCard
                error={latestRun?.error ?? runError}
                fileCount={session.fileCount}
                latestRun={latestRun}
                manifestChange={session.manifestChange}
                manifestVersionId={session.manifestVersionId}
                onChangeSelect={(filePath) => {
                  setSelectedFile(filePath)
                  setRightPanelMode('files')
                  setWorkspaceMode('changes')
                }}
                onOpenChanges={
                  firstChangedFile
                    ? () => {
                        setSelectedFile(firstChangedFile)
                        setRightPanelMode('files')
                        setWorkspaceMode('changes')
                      }
                    : undefined
                }
                statusText={statusText}
                totalBytes={session.totalBytes}
              />
            }
          />

          <form
            className="relative z-20 -mt-8 shrink-0 px-4 pb-4 pt-0"
            onSubmit={handleRun}
            ref={promptFormRef}
          >
            <div
              className={`${forgeChatContentClassName} rounded-2xl bg-white p-2 shadow-xl shadow-neutral-200/70 dark:bg-[#242424] dark:shadow-2xl dark:shadow-black/30`}
            >
              <textarea
                className="max-h-40 min-h-14 w-full resize-none bg-transparent px-2 py-2 text-[13px] leading-5 text-neutral-950 outline-none placeholder:text-neutral-500 dark:text-white dark:placeholder:text-neutral-500"
                onChange={(event) => setPrompt(event.currentTarget.value)}
                placeholder="Ask Forge to change the app"
                ref={promptTextareaRef}
                value={prompt}
              />
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 px-2 text-xs text-neutral-500 dark:text-neutral-500">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      streamStatus === 'live'
                        ? 'bg-emerald-400'
                        : 'bg-neutral-400 dark:bg-neutral-600'
                    }`}
                  />
                  <span className="truncate">{statusText}</span>
                  <span className="hidden rounded border border-neutral-200 px-1.5 py-0.5 font-mono text-[11px] text-neutral-500 dark:border-white/10 dark:text-neutral-600 sm:inline">
                    {manifestShortId}
                  </span>
                </div>
                <button
                  className={sendButtonClassName(canRun)}
                  disabled={!canRun}
                  title="Run"
                  type="submit"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                  <span className="sr-only">
                    {isSubmitting ? 'Running' : 'Run'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </section>

        <section className="relative hidden min-h-0 grid-rows-[40px_1fr] bg-neutral-50 dark:bg-[#0d0d0d] xl:grid">
          <ForgePaneResizeHandle
            ariaLabel="Resize workspace pane"
            max={rightPaneMaxWidth}
            min={FORGE_RIGHT_PANE_MIN_WIDTH}
            onKeyDown={(event) => handlePaneResizeKeyDown(event, 'right')}
            onPointerDown={(event) =>
              handlePaneResizePointerDown(event, 'right')
            }
            side="left"
            value={rightPaneWidth}
          />
          <div className="flex items-center gap-1 border-b border-neutral-200 bg-white px-1 dark:border-white/10 dark:bg-[#171717]">
            <button
              className={rightPanelModeButtonClassName(
                rightPanelMode === 'preview',
              )}
              onClick={() => setRightPanelMode('preview')}
              type="button"
            >
              <MonitorPlay className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-500" />
              <span className="truncate">Preview</span>
            </button>
            <button
              className={rightPanelModeButtonClassName(
                rightPanelMode === 'files',
              )}
              onClick={() => setRightPanelMode('files')}
              type="button"
            >
              <Folder className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-500" />
              <span className="truncate">Files</span>
            </button>
            <button
              className={rightPanelModeButtonClassName(
                rightPanelMode === 'source',
              )}
              onClick={() => setRightPanelMode('source')}
              type="button"
            >
              <GitPullRequest className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-500" />
              <span className="truncate">Source</span>
            </button>
          </div>

          {hasMountedPreviewPanel ? (
            <div
              className={`h-full min-h-0 ${
                rightPanelMode === 'preview' ? 'block' : 'hidden'
              }`}
            >
              <ForgeWebContainerPreview
                files={session.files}
                manifestVersionId={session.manifestVersionId}
                packageManager={session.packageManager}
              />
            </div>
          ) : null}

          {rightPanelMode === 'source' ? (
            <div className="min-h-0 overflow-auto p-4">
              <GitHubExportPanel
                authState={githubAuthState}
                canExport={canExportGitHub}
                error={githubExportError}
                isExporting={isExportingGitHub}
                isPrivate={githubIsPrivate}
                latestGitHubExport={latestGitHubExport}
                onExport={handleGitHubExport}
                onPrivateChange={setGithubIsPrivate}
                onRepoNameChange={setGithubRepoName}
                repoNameError={githubRepoNameValidation.error}
                repoName={githubRepoName}
                repoUrl={githubExportUrl}
              />
            </div>
          ) : null}

          {rightPanelMode === 'files' ? (
            <div className="grid min-h-0">
              <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(300px,38%)]">
                <div className="order-2 grid min-h-0 grid-rows-[auto_1fr] border-l border-neutral-200 bg-[#151515] text-neutral-200 dark:border-white/10">
                  <div className="px-3 pb-2 pt-3">
                    <label className="relative block">
                      <Search
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
                      />
                      <input
                        aria-label="Filter files"
                        className="h-9 w-full rounded-xl border border-white/10 bg-[#1f1f1f] pl-9 pr-3 text-[13px] text-neutral-100 outline-none transition placeholder:text-neutral-500 focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/10"
                        onChange={(event) => setFileFilter(event.target.value)}
                        placeholder="Filter files..."
                        type="search"
                        value={fileFilter}
                      />
                    </label>
                  </div>
                  {manifestFileTree.length > 0 ? (
                    <div className="min-h-0 overflow-auto px-2 pb-3">
                      {filteredManifestFileTree.length > 0 ? (
                        <FileTree
                          className="gap-0.5"
                          currentPath={selectedFile ?? null}
                          forceExpanded={fileFilterIsActive}
                          nodes={filteredManifestFileTree}
                          onSelectFile={(file) => {
                            setSelectedFile(file)
                            if (!fileChangeMap.has(file)) {
                              setWorkspaceMode('file')
                            }
                          }}
                          renderSuffix={(node) => {
                            if (node.type !== 'file') {
                              return null
                            }

                            const change = fileChangeMap.get(node.path)

                            return change ? (
                              <span
                                className={fileChangeDotClassName(
                                  change.status,
                                )}
                              >
                                {formatFileChangeStatus(change.status)}
                              </span>
                            ) : null
                          }}
                          tone="forge"
                        />
                      ) : (
                        <div className="px-2 py-2 text-[13px] text-neutral-500">
                          No matching files.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="px-4 py-2 text-[13px] text-neutral-500">
                      No files yet.
                    </div>
                  )}
                </div>

                <div className="order-1 grid min-h-0 grid-rows-[44px_1fr_160px]">
                  <div className="flex min-w-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-white/10">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="min-w-0 truncate font-mono text-xs text-neutral-700 dark:text-neutral-300">
                        {selectedFile ?? 'No file selected'}
                      </div>
                      {selectedFileChange ? (
                        <span
                          className={fileChangeBadgeClassName(
                            selectedFileChange.status,
                          )}
                        >
                          {formatFileChangeStatus(selectedFileChange.status)}
                        </span>
                      ) : null}
                    </div>
                    {selectedFileChange ? (
                      <div className="flex shrink-0 rounded-md border border-neutral-200 bg-neutral-100 p-0.5 dark:border-white/10 dark:bg-black/20">
                        <button
                          className={workspaceModeButtonClassName(
                            effectiveWorkspaceMode === 'file',
                          )}
                          onClick={() => setWorkspaceMode('file')}
                          type="button"
                        >
                          File
                        </button>
                        <button
                          className={workspaceModeButtonClassName(
                            effectiveWorkspaceMode === 'changes',
                          )}
                          onClick={() => setWorkspaceMode('changes')}
                          type="button"
                        >
                          Changes
                        </button>
                      </div>
                    ) : selectedFileContent ? (
                      <div className="text-xs text-neutral-500 dark:text-neutral-500">
                        {formatBytes(textBytes(selectedFileContent))}
                      </div>
                    ) : null}
                  </div>
                  {effectiveWorkspaceMode === 'changes' &&
                  selectedFileChange ? (
                    <ManifestDiffView change={selectedFileChange} />
                  ) : (
                    <ManifestCodeView
                      content={selectedFileContent}
                      file={selectedManifestFile}
                      path={selectedFile}
                      wasDeleted={selectedFileChange?.status === 'deleted'}
                    />
                  )}
                  <div className="min-h-0 overflow-auto border-t border-neutral-200 bg-neutral-50 dark:border-white/10 dark:bg-[#111111]">
                    <div className="border-b border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-600 dark:border-white/10 dark:text-neutral-400">
                      Warnings
                    </div>
                    <div className="whitespace-pre-wrap px-4 py-3 text-xs leading-5 text-neutral-500 dark:text-neutral-500">
                      {session.warnings.length > 0
                        ? session.warnings.join('\n')
                        : 'No warnings'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
      {resizingPane ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-50 cursor-col-resize touch-none bg-transparent"
        />
      ) : null}
    </main>
  )
}

function ForgePaneResizeHandle({
  ariaLabel,
  max,
  min,
  onKeyDown,
  onPointerDown,
  side,
  value,
}: {
  ariaLabel: string
  max: number
  min: number
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  side: 'left' | 'right'
  value: number
}) {
  return (
    <div
      aria-label={ariaLabel}
      aria-orientation="vertical"
      aria-valuemax={Math.round(max)}
      aria-valuemin={min}
      aria-valuenow={Math.round(value)}
      className={`absolute top-0 z-30 h-full w-2 cursor-col-resize touch-none bg-transparent transition hover:bg-sky-500/20 focus:bg-sky-500/15 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-400/40 active:bg-sky-500/25 ${
        side === 'left' ? '-left-1' : '-right-1'
      }`}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      role="separator"
      tabIndex={0}
    />
  )
}

function SidebarActionButton({
  disabled,
  icon,
  label,
  onClick,
}: {
  disabled?: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={`mb-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition ${
        disabled
          ? 'cursor-not-allowed text-neutral-400 dark:text-neutral-600'
          : 'text-neutral-700 hover:bg-neutral-200/80 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white'
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  )
}

function SidebarChatRow({
  active,
  chat,
  deleteDisabled,
  onDelete,
  onSelect,
  selectDisabled,
}: {
  active: boolean
  chat: ForgeSession['chats'][number]
  deleteDisabled: boolean
  onDelete: () => void
  onSelect: () => void
  selectDisabled: boolean
}) {
  return (
    <div
      className={`group flex items-center rounded-md transition ${
        active
          ? 'bg-neutral-950/[0.04] text-neutral-950 dark:bg-white/[0.06] dark:text-white'
          : 'text-neutral-700 hover:bg-neutral-200/80 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white'
      }`}
    >
      <button
        aria-current={active ? 'page' : undefined}
        className={`min-w-0 flex-1 rounded-l-md px-2 py-1.5 text-left text-xs ${
          active ? 'cursor-default' : ''
        }`}
        disabled={selectDisabled}
        onClick={onSelect}
        type="button"
      >
        <span className="block truncate">{chat.title}</span>
      </button>
      <Dropdown>
        <DropdownTrigger>
          <button
            aria-label={`Open menu for ${chat.title}`}
            className={`mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100 ${
              deleteDisabled
                ? 'cursor-not-allowed text-neutral-400 dark:text-neutral-700'
                : 'text-neutral-400 hover:bg-neutral-300/70 hover:text-neutral-950 dark:text-neutral-500 dark:hover:bg-white/10 dark:hover:text-white'
            }`}
            disabled={deleteDisabled}
            title="Chat actions"
            type="button"
          >
            <EllipsisVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownTrigger>
        <DropdownContent
          align="end"
          className="min-w-36 rounded-md border-neutral-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#242424]"
          sideOffset={4}
        >
          <DropdownItem
            className="text-xs text-red-600 hover:bg-red-50 focus:bg-red-50 dark:text-red-300 dark:hover:bg-red-400/10 dark:focus:bg-red-400/10"
            onSelect={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete chat</span>
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
    </div>
  )
}

function RunSummaryCard({
  error,
  fileCount,
  latestRun,
  manifestChange,
  manifestVersionId,
  onChangeSelect,
  onOpenChanges,
  statusText,
  totalBytes,
}: {
  error?: string | null
  fileCount: number
  latestRun?: {
    endedAt?: string
    id: string
    startedAt?: string
    status: string
  }
  manifestChange?: ForgeSession['manifestChange']
  manifestVersionId?: string
  onChangeSelect: (filePath: string) => void
  onOpenChanges?: () => void
  statusText: string
  totalBytes: number
}) {
  const [showAllChanges, setShowAllChanges] = useState(false)
  const changedFileCount = manifestChange?.changedFileCount ?? 0
  const hasChanges = changedFileCount > 0
  const hiddenChangeCount = Math.max(0, (manifestChange?.files.length ?? 0) - 5)
  const visibleFileChanges =
    manifestChange?.files.slice(0, showAllChanges ? undefined : 5) ?? []
  const summaryTitle = getForgeRunSummaryTitle({
    changedFileCount,
    hasParentManifest: Boolean(manifestChange?.parentManifestVersionId),
    statusText,
  })

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-white/10 dark:bg-[#1e1e1e]">
      <div className="flex items-start justify-between gap-4 px-4 py-3.5">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 ring-1 ring-neutral-200 dark:bg-black/35 dark:ring-white/10">
            {latestRun?.status === 'failed' ? (
              <AlertCircle className="h-5 w-5 text-red-400" />
            ) : latestRun?.status === 'finished' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <Play className="h-5 w-5 text-neutral-500 dark:text-neutral-300" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-neutral-950 dark:text-neutral-100">
              {summaryTitle}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-500">
              {hasChanges && manifestChange ? (
                <LineChangeSummary
                  additions={manifestChange.additions}
                  deletions={manifestChange.deletions}
                />
              ) : (
                <>
                  <span>{fileCount.toLocaleString()} files</span>
                  <span>{formatBytes(totalBytes)}</span>
                </>
              )}
              {latestRun?.startedAt ? (
                <span>{formatRunDuration(latestRun)}</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="max-w-[150px] truncate font-mono text-xs text-neutral-500 dark:text-neutral-500">
            {manifestVersionId ? compactManifestId(manifestVersionId) : ''}
          </div>
          {onOpenChanges ? (
            <button
              className="h-7 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 text-xs font-medium text-neutral-800 transition hover:bg-neutral-100 hover:text-neutral-950 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:hover:bg-white/10 dark:hover:text-white"
              onClick={onOpenChanges}
              type="button"
            >
              Review
            </button>
          ) : null}
        </div>
      </div>
      {hasChanges && manifestChange ? (
        <div className="border-t border-neutral-200 dark:border-white/10">
          <div className="divide-y divide-neutral-200 dark:divide-white/5">
            {visibleFileChanges.map((change) => (
              <ChangedFileRow
                change={change}
                key={change.path}
                onSelect={() => onChangeSelect(change.path)}
              />
            ))}
          </div>
          {hiddenChangeCount > 0 ? (
            <button
              className="flex w-full items-center gap-1 border-t border-neutral-200 px-4 py-1.5 text-left text-[11px] text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-800 dark:border-white/10 dark:hover:bg-white/5 dark:hover:text-neutral-300"
              onClick={() => setShowAllChanges((value) => !value)}
              type="button"
            >
              <span>
                {showAllChanges
                  ? 'Show fewer files'
                  : `Show ${hiddenChangeCount.toLocaleString()} more ${
                      hiddenChangeCount === 1 ? 'file' : 'files'
                    }`}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition ${
                  showAllChanges ? 'rotate-180' : ''
                }`}
              />
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <div className="border-t border-neutral-200 px-4 py-3 text-sm text-red-600 dark:border-white/10 dark:text-red-300">
          {error}
        </div>
      ) : null}
    </div>
  )
}

function ChangedFileRow({
  change,
  onSelect,
}: {
  change: ForgeManifestFileChange
  onSelect: () => void
}) {
  return (
    <button
      className="flex w-full min-w-0 items-center gap-2 bg-neutral-50 px-3 py-1.5 text-left transition hover:bg-neutral-100 dark:bg-black/15 dark:hover:bg-white/5"
      onClick={onSelect}
      type="button"
    >
      <span className={fileChangeBadgeClassName(change.status)}>
        {formatFileChangeStatus(change.status)}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
        {change.path}
      </span>
      <LineChangeSummary
        additions={change.additions}
        deletions={change.deletions}
      />
    </button>
  )
}

function LineChangeSummary({
  additions,
  deletions,
}: {
  additions: number
  deletions: number
}) {
  return (
    <span className="flex shrink-0 items-center gap-2 font-mono text-[11px]">
      <span className="text-emerald-600 dark:text-emerald-400">
        +{additions.toLocaleString()}
      </span>
      <span className="text-red-600 dark:text-red-400">
        -{deletions.toLocaleString()}
      </span>
    </span>
  )
}

function ManifestCodeView({
  content,
  file,
  path,
  wasDeleted,
}: {
  content?: string
  file?: ForgeManifestFile
  path?: string
  wasDeleted: boolean
}) {
  const isBinary =
    file?.encoding === 'base64' || content?.startsWith('base64::') === true

  if (isBinary) {
    return (
      <div className="min-h-0 overflow-auto bg-neutral-50 p-4 text-sm leading-6 text-neutral-500 dark:bg-[#101010] dark:text-neutral-500">
        Binary file preview is not available.
      </div>
    )
  }

  const code = content ?? (wasDeleted ? 'File deleted' : '')
  const language = path ? getCodeBlockLanguageFromFilePath(path) : 'txt'

  return (
    <div className="min-h-0 overflow-hidden bg-white dark:bg-[#101010] [&_.codeblock]:h-full [&_.codeblock]:rounded-none [&_.codeblock]:border-0 [&_.codeblock>div]:h-full [&_pre]:h-full [&_pre]:overflow-auto [&_pre]:!p-4">
      <CodeBlock
        className="h-full rounded-none border-0"
        isEmbedded
        showTypeCopyButton={false}
      >
        <code className={`language-${language}`}>{code}</code>
      </CodeBlock>
    </div>
  )
}

function ManifestDiffView({ change }: { change: ForgeManifestFileChange }) {
  if (change.diffLines.length === 0) {
    return (
      <div className="min-h-0 overflow-auto p-4 text-sm text-neutral-500 dark:text-neutral-500">
        No text diff available.
      </div>
    )
  }

  return (
    <div className="min-h-0 overflow-auto bg-white py-3 font-mono text-xs leading-5 dark:bg-[#101010]">
      {change.diffLines.map((line, index) => (
        <DiffLine line={line} key={`${index}-${line.kind}`} />
      ))}
    </div>
  )
}

function DiffLine({
  line,
}: {
  line: ForgeManifestFileChange['diffLines'][number]
}) {
  return (
    <div className={diffLineClassName(line.kind)}>
      <span className="w-10 shrink-0 select-none text-right text-neutral-400 dark:text-neutral-600">
        {line.oldLineNumber ?? ''}
      </span>
      <span className="w-10 shrink-0 select-none text-right text-neutral-400 dark:text-neutral-600">
        {line.newLineNumber ?? ''}
      </span>
      <span className={diffSignClassName(line.kind)}>
        {diffLineSign(line.kind)}
      </span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
        {line.content || ' '}
      </span>
    </div>
  )
}

function GitHubExportPanel({
  authState,
  canExport,
  error,
  isExporting,
  isPrivate,
  latestGitHubExport,
  onExport,
  onPrivateChange,
  onRepoNameChange,
  repoName,
  repoNameError,
  repoUrl,
}: {
  authState?: ForgeGitHubAuthState
  canExport: boolean
  error: string | null
  isExporting: boolean
  isPrivate: boolean
  latestGitHubExport?: ForgeSession['exports'][number]
  onExport: () => void
  onPrivateChange: (value: boolean) => void
  onRepoNameChange: (value: string) => void
  repoName: string
  repoNameError?: string
  repoUrl: string | null
}) {
  const {
    latestGitHubExport: displayedGitHubExport,
    visibleError,
    visibleRepoUrl,
  } = getForgeGitHubExportDisplayState({
    latestGitHubExport,
    repoUrl,
  })
  const authMessage = getGitHubExportAuthMessage({
    authState,
    isPrivate,
  })

  return (
    <div className="rounded-lg border border-neutral-200 bg-white dark:border-white/10 dark:bg-[#171717]">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-2 text-sm font-medium">
          <GitPullRequest className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
          Source control
        </div>
        {displayedGitHubExport ? (
          <span className="text-xs text-neutral-500 dark:text-neutral-500">
            {formatExportStatus(displayedGitHubExport)}
          </span>
        ) : null}
      </div>
      <div className="space-y-3 px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input
            className="h-9 min-w-0 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 dark:border-white/10 dark:bg-black/20 dark:text-white dark:placeholder:text-neutral-600 dark:focus:border-white/30"
            onChange={(event) => onRepoNameChange(event.currentTarget.value)}
            placeholder="repository-name"
            value={repoName}
          />
          <label className="inline-flex h-9 items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300">
            <input
              checked={isPrivate}
              className="h-4 w-4 accent-neutral-950 dark:accent-white"
              onChange={(event) => onPrivateChange(event.currentTarget.checked)}
              type="checkbox"
            />
            Private
          </label>
          <button
            className={buttonClassName({
              enabled: canExport,
              tone: 'secondary',
            })}
            disabled={!canExport}
            onClick={onExport}
            type="button"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GitPullRequest className="h-4 w-4" />
            )}
            <span>{isExporting ? 'Exporting' : 'Export'}</span>
          </button>
        </div>
        {visibleRepoUrl ? (
          <a
            className="inline-flex items-center gap-2 text-xs text-sky-600 hover:text-sky-500 dark:text-sky-300 dark:hover:text-sky-200"
            href={visibleRepoUrl}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="truncate">{visibleRepoUrl}</span>
          </a>
        ) : null}
        {authMessage ? (
          <div className="text-xs text-neutral-500 dark:text-neutral-500">
            {authMessage}
          </div>
        ) : null}
        {repoNameError ? (
          <div className="text-xs text-red-600 dark:text-red-300">
            {repoNameError}
          </div>
        ) : null}
        {visibleError ? (
          <div className="text-xs text-red-600 dark:text-red-300">
            {visibleError}
          </div>
        ) : null}
        {error ? (
          <div className="text-xs text-red-600 dark:text-red-300">{error}</div>
        ) : null}
      </div>
    </div>
  )
}

function ForgeChatScrollPane({
  activeChatId,
  items,
  latestRun,
  onItemOpenChange,
  openItemIds,
  showLogEvents,
  summary,
}: {
  activeChatId: string
  items: Array<ForgeTranscriptItem>
  latestRun: ForgeSession['latestRun']
  onItemOpenChange: (itemId: string, open: boolean) => void
  openItemIds: Record<string, boolean>
  showLogEvents: boolean
  summary: ReactNode
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const activeRun = isActiveForgeRunStatus(latestRun?.status)
  const visibleItems = useMemo(
    () => getVisibleTranscriptItems(items, showLogEvents),
    [items, showLogEvents],
  )
  const latestWorkItem = getLatestTranscriptWorkItem(visibleItems)
  const rows = useMemo(
    () =>
      createForgeChatVirtualRows({
        activeRun,
        latestRunId: latestRun?.id,
        visibleItems,
      }),
    [activeRun, latestRun?.id, visibleItems],
  )
  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    anchorTo: 'end',
    count: rows.length,
    estimateSize: (index) => estimateForgeChatRowSize(rows[index]),
    followOnAppend: true,
    gap: 12,
    getItemKey: (index) => rows[index]?.id ?? index,
    getScrollElement: () => parentRef.current,
    overscan: 8,
    paddingEnd: 52,
    paddingStart: 20,
    scrollEndThreshold: 96,
    useAnimationFrameWithResizeObserver: true,
  })
  const virtualItems = rowVirtualizer.getVirtualItems()
  const showJumpToLatest = rows.length > 1 && !rowVirtualizer.isAtEnd(96)

  useEffect(() => {
    rowVirtualizer.scrollToEnd({ behavior: 'auto' })
  }, [activeChatId, rowVirtualizer])

  return (
    <div className="relative min-h-0 flex-1">
      <div className="h-full overflow-auto overscroll-contain" ref={parentRef}>
        <div
          className="relative w-full"
          style={{ height: rowVirtualizer.getTotalSize() }}
        >
          {virtualItems.map((virtualItem) => {
            const row = rows[virtualItem.index]

            if (!row) {
              return null
            }

            return (
              <div
                className="absolute left-0 top-0 w-full px-4"
                data-index={virtualItem.index}
                key={virtualItem.key}
                ref={rowVirtualizer.measureElement}
                style={{
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div className={forgeChatContentClassName}>
                  {renderForgeChatVirtualRow(row, {
                    latestRun,
                    latestWorkItem,
                    onItemOpenChange,
                    openItemIds,
                    showLogEvents,
                    summary,
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {showJumpToLatest ? (
        <div className="pointer-events-none absolute bottom-24 left-4 right-4 z-30">
          <div className={forgeChatContentClassName}>
            <div className="flex justify-center">
              <button
                className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-neutral-950 text-white shadow-lg shadow-black/10 transition hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                onClick={() =>
                  rowVirtualizer.scrollToEnd({ behavior: 'smooth' })
                }
                title="Jump to latest"
                type="button"
              >
                <ArrowDown className="h-4 w-4" />
                <span className="sr-only">Jump to latest</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function createForgeChatVirtualRows({
  activeRun,
  latestRunId,
  visibleItems,
}: {
  activeRun: boolean
  latestRunId?: string
  visibleItems: Array<ForgeTranscriptItem>
}): Array<ForgeChatVirtualRow> {
  const rows: Array<ForgeChatVirtualRow> = [
    {
      id: 'summary',
      kind: 'summary',
    },
  ]

  if (visibleItems.length > 0 || activeRun) {
    rows.push({
      id: 'activity-header',
      kind: 'activityHeader',
      showLabel: visibleItems.length > 0,
    })
  }

  for (const item of visibleItems) {
    rows.push({
      id: `transcript:${item.id}`,
      item,
      kind: 'transcript',
    })
  }

  if (activeRun) {
    rows.push({
      id: `active-work:${latestRunId ?? 'pending'}`,
      kind: 'activeWork',
    })
  }

  return rows
}

function estimateForgeChatRowSize(row?: ForgeChatVirtualRow) {
  if (!row) {
    return 96
  }

  switch (row.kind) {
    case 'activityHeader':
      return 36
    case 'activeWork':
      return 72
    case 'summary':
      return 180
    case 'transcript':
      return estimateForgeTranscriptItemSize(row.item)
  }
}

function estimateForgeTranscriptItemSize(item: ForgeTranscriptItem) {
  switch (item.kind) {
    case 'activity':
    case 'tool':
      return 92
    case 'activityGroup':
    case 'semanticGroup':
      return 112
    case 'message':
      return item.value.content && item.value.content.length > 240 ? 180 : 96
  }
}

function renderForgeChatVirtualRow(
  row: ForgeChatVirtualRow,
  {
    latestRun,
    latestWorkItem,
    onItemOpenChange,
    openItemIds,
    showLogEvents,
    summary,
  }: {
    latestRun: ForgeSession['latestRun']
    latestWorkItem?: ForgeTranscriptWorkItem
    onItemOpenChange: (itemId: string, open: boolean) => void
    openItemIds: Record<string, boolean>
    showLogEvents: boolean
    summary: ReactNode
  },
) {
  switch (row.kind) {
    case 'activityHeader':
      return (
        <div className="border-t border-neutral-200 pt-5 dark:border-white/10">
          {row.showLabel ? (
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-600">
              Activity
            </div>
          ) : null}
        </div>
      )
    case 'activeWork':
      return (
        <ActiveWorkIndicator
          latestRun={latestRun}
          latestWorkItem={latestWorkItem}
          showLogEvents={showLogEvents}
        />
      )
    case 'summary':
      return summary
    case 'transcript':
      return renderForgeTranscriptItem(row.item, {
        onItemOpenChange,
        openItemIds,
        showLogEvents,
      })
  }
}

function renderForgeTranscriptItem(
  item: ForgeTranscriptItem,
  {
    onItemOpenChange,
    openItemIds,
    showLogEvents,
  }: {
    onItemOpenChange: (itemId: string, open: boolean) => void
    openItemIds: Record<string, boolean>
    showLogEvents: boolean
  },
) {
  return item.kind === 'message' ? (
    <MessageBubble
      content={item.value.content}
      role={item.value.role}
      status={item.value.status}
    />
  ) : item.kind === 'activityGroup' ? (
    <ActivityGroupBubble
      group={item}
      onItemOpenChange={onItemOpenChange}
      open={Boolean(openItemIds[item.id])}
      openItemIds={openItemIds}
      showLogEvents={showLogEvents}
    />
  ) : item.kind === 'semanticGroup' ? (
    <SemanticActivityGroupBubble
      group={item}
      onItemOpenChange={onItemOpenChange}
      open={Boolean(openItemIds[item.id])}
      openItemIds={openItemIds}
      showLogEvents={showLogEvents}
    />
  ) : (
    renderTranscriptWorkItem(item, {
      onItemOpenChange,
      open: Boolean(openItemIds[item.id]),
      showLogEvents,
    })
  )
}

function MessageBubble({
  content,
  role,
  status,
}: {
  content?: string
  role: string
  status?: string
}) {
  const isUser = role === 'user'
  const isStreaming = status === 'streaming'
  const body = content || (isStreaming ? 'Thinking...' : '')

  return (
    <article className={isUser ? 'flex justify-end' : 'min-w-0'}>
      {isUser ? (
        <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-sky-500/[0.11] px-3 py-2 text-[13px] leading-5 text-neutral-900 dark:bg-sky-400/[0.13] dark:text-neutral-100">
          {body}
        </div>
      ) : (
        <ForgeAssistantMarkdown
          content={body}
          isFailed={status === 'failed'}
          isStreaming={isStreaming}
        />
      )}
    </article>
  )
}

const forgeStreamdownComponents = {
  pre: CodeBlock,
  code: InlineCode,
  a: ForgeMarkdownLink,
  p: ({ children }: { children?: ReactNode }) => (
    <p className="my-2 first:mt-0 last:mb-0">{children}</p>
  ),
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mb-2 mt-4 text-base font-semibold text-neutral-950 first:mt-0 dark:text-neutral-100">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mb-2 mt-4 text-sm font-semibold text-neutral-950 first:mt-0 dark:text-neutral-100">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mb-1.5 mt-3 text-[13px] font-semibold text-neutral-950 first:mt-0 dark:text-neutral-100">
      {children}
    </h3>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="leading-5">{children}</li>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="my-2 border-l-2 border-neutral-300 pl-3 text-neutral-600 dark:border-white/20 dark:text-neutral-400">
      {children}
    </blockquote>
  ),
}

function ForgeAssistantMarkdown({
  content,
  isFailed = false,
  isStreaming,
}: {
  content: string
  isFailed?: boolean
  isStreaming: boolean
}) {
  return (
    <div
      className={`min-w-0 text-[13px] leading-5 ${
        isFailed
          ? 'text-red-600 dark:text-red-300'
          : 'text-neutral-800 dark:text-neutral-200'
      }`}
    >
      <Streamdown
        components={forgeStreamdownComponents}
        isAnimating={isStreaming}
      >
        {content}
      </Streamdown>
    </div>
  )
}

function renderTranscriptWorkItem(
  item: ForgeTranscriptWorkItem,
  {
    nested = false,
    onItemOpenChange,
    open,
    showLogEvents,
  }: {
    nested?: boolean
    onItemOpenChange: (itemId: string, open: boolean) => void
    open: boolean
    showLogEvents: boolean
  },
) {
  return item.kind === 'tool' ? (
    <ToolActivityBubble
      group={item.value}
      itemId={item.id}
      key={item.id}
      nested={nested}
      onOpenChange={onItemOpenChange}
      open={open}
      showLogEvents={showLogEvents}
    />
  ) : (
    <ActivityBubble
      event={item.value}
      itemId={item.id}
      key={item.id}
      nested={nested}
      onOpenChange={onItemOpenChange}
      open={open}
      showLogEvents={showLogEvents}
      source={item.source}
    />
  )
}

function ForgeMarkdownLink({
  children,
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className="font-medium text-neutral-950 underline decoration-neutral-300 underline-offset-2 transition hover:decoration-neutral-700 dark:text-neutral-100 dark:decoration-neutral-600 dark:hover:decoration-neutral-200"
      href={href}
      rel="noreferrer"
      target={href?.startsWith('http') ? '_blank' : undefined}
      {...props}
    >
      {children}
    </a>
  )
}

function ActiveWorkIndicator({
  latestWorkItem,
  latestRun,
  showLogEvents,
}: {
  latestWorkItem?: ForgeTranscriptWorkItem
  latestRun: ForgeSession['latestRun']
  showLogEvents: boolean
}) {
  const activity =
    latestWorkItem?.kind === 'tool'
      ? latestWorkItem.value.events.at(-1)
      : latestWorkItem?.value
  const source =
    latestWorkItem?.kind === 'tool' ? 'agent' : latestWorkItem?.source
  const title =
    activity && source
      ? formatActiveWorkTitle(activity, source)
      : formatRunStatusLabel(latestRun?.status)
  const detail = activity
    ? (activity.message ?? activity.detail ?? activity.path)
    : showLogEvents
      ? 'Preparing the agent run'
      : undefined

  return (
    <div className="flex gap-3 rounded-md bg-sky-500/[0.07] px-3 py-2.5 text-sky-950 dark:bg-sky-400/[0.08] dark:text-sky-100">
      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-sky-500 dark:text-sky-300" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium">{title}</div>
        {detail ? (
          <div className="mt-1 text-xs leading-5 text-sky-700 dark:text-sky-200/80">
            {detail}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SemanticActivityGroupBubble({
  group,
  onItemOpenChange,
  open,
  openItemIds,
  showLogEvents,
}: {
  group: ForgeSemanticTranscriptGroup
  onItemOpenChange: (itemId: string, open: boolean) => void
  open: boolean
  openItemIds: Record<string, boolean>
  showLogEvents: boolean
}) {
  const steps = getValidationSteps(group)
  const status = getValidationGroupStatus(steps)
  const elapsedMs = getActivityGroupElapsedMs(group.items)
  const title = formatValidationGroupTitle(status)
  const subtitle = formatValidationGroupSubtitle(steps)

  return (
    <Collapsible
      className={activityShellClassName(open)}
      onOpenChange={(nextOpen) => onItemOpenChange(group.id, nextOpen)}
      open={open}
    >
      {({ open: groupOpen }) => (
        <>
          <CollapsibleTrigger className={activityTriggerClassName}>
            <ActivityStatusIcon status={status} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0 truncate text-xs font-medium text-neutral-800 dark:text-neutral-200">
                  {title}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-neutral-500 dark:text-neutral-500">
                  <span>{steps.length.toLocaleString()} steps</span>
                  {elapsedMs ? <span>{formatDuration(elapsedMs)}</span> : null}
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition ${
                      groupOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </div>
              {subtitle ? (
                <div className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500 dark:text-neutral-500">
                  {subtitle}
                </div>
              ) : null}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className={activityContentClassName}>
              <div className="space-y-1.5 px-10 py-2 text-xs leading-5 text-neutral-500 dark:text-neutral-500">
                {steps.map((step) => (
                  <div
                    className="flex min-w-0 items-center gap-2"
                    key={step.id}
                  >
                    <ActivityStatusIcon status={step.status} />
                    <span className="min-w-0 flex-1 truncate text-neutral-700 dark:text-neutral-300">
                      {step.label}
                    </span>
                    {step.detail ? (
                      <span className="min-w-0 max-w-[40%] truncate font-mono text-neutral-400 dark:text-neutral-600">
                        {step.detail}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
              {showLogEvents ? (
                <div className="mt-2 border-t border-neutral-200/60 dark:border-white/10">
                  <div className="px-10 py-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-600">
                    Raw logs
                  </div>
                  {group.items.map((item) =>
                    renderTranscriptWorkItem(item, {
                      nested: true,
                      onItemOpenChange,
                      open: Boolean(openItemIds[item.id]),
                      showLogEvents: true,
                    }),
                  )}
                </div>
              ) : null}
            </div>
          </CollapsibleContent>
        </>
      )}
    </Collapsible>
  )
}

function ActivityGroupBubble({
  group,
  onItemOpenChange,
  open,
  openItemIds,
  showLogEvents,
}: {
  group: ForgeActivityTranscriptGroup
  onItemOpenChange: (itemId: string, open: boolean) => void
  open: boolean
  openItemIds: Record<string, boolean>
  showLogEvents: boolean
}) {
  const visibleItems = getVisibleActivityGroupItems(group, showLogEvents)
  const childItems = getActivityGroupChildItems(visibleItems)
  const status = getActivityGroupStatus(visibleItems)
  const eventCount = getActivityGroupEventCount(visibleItems)
  const elapsedMs = getActivityGroupElapsedMs(visibleItems)
  const title = formatActivityGroupTitle(visibleItems, status)
  const subtitle = formatActivityGroupSubtitle(visibleItems)

  return (
    <Collapsible
      className={activityShellClassName(open)}
      onOpenChange={(nextOpen) => onItemOpenChange(group.id, nextOpen)}
      open={open}
    >
      {({ open: groupOpen }) => (
        <>
          <CollapsibleTrigger className={activityTriggerClassName}>
            <ActivityStatusIcon status={status} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0 truncate text-xs font-medium text-neutral-800 dark:text-neutral-200">
                  {title}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-neutral-500 dark:text-neutral-500">
                  <span>{eventCount.toLocaleString()} events</span>
                  {elapsedMs ? <span>{formatDuration(elapsedMs)}</span> : null}
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition ${
                      groupOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </div>
              {subtitle ? (
                <div className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500 dark:text-neutral-500">
                  {subtitle}
                </div>
              ) : null}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className={activityContentClassName}>
              {childItems.map((item) =>
                renderActivityGroupChildItem(item, {
                  onItemOpenChange,
                  openItemIds,
                  showLogEvents,
                }),
              )}
            </div>
          </CollapsibleContent>
        </>
      )}
    </Collapsible>
  )
}

function renderActivityGroupChildItem(
  item: ForgeActivityGroupChildItem,
  {
    onItemOpenChange,
    openItemIds,
    showLogEvents,
  }: {
    onItemOpenChange: (itemId: string, open: boolean) => void
    openItemIds: Record<string, boolean>
    showLogEvents: boolean
  },
) {
  return item.kind === 'toolBundle' ? (
    <ToolBundleBubble
      bundle={item}
      key={item.id}
      onItemOpenChange={onItemOpenChange}
      open={Boolean(openItemIds[item.id])}
      openItemIds={openItemIds}
      showLogEvents={showLogEvents}
    />
  ) : (
    renderTranscriptWorkItem(item, {
      nested: true,
      onItemOpenChange,
      open: Boolean(openItemIds[item.id]),
      showLogEvents,
    })
  )
}

function ToolBundleBubble({
  bundle,
  onItemOpenChange,
  open,
  openItemIds,
  showLogEvents,
}: {
  bundle: Extract<ForgeActivityGroupChildItem, { kind: 'toolBundle' }>
  onItemOpenChange: (itemId: string, open: boolean) => void
  open: boolean
  openItemIds: Record<string, boolean>
  showLogEvents: boolean
}) {
  const status = getActivityGroupStatus(bundle.items)
  const eventCount = getActivityGroupEventCount(bundle.items)
  const elapsedMs = getActivityGroupElapsedMs(bundle.items)
  const title = formatToolBundleTitle(bundle)
  const subtitle = formatToolBundleSubtitle(bundle)

  return (
    <Collapsible
      className={nestedActivityShellClassName(open)}
      onOpenChange={(nextOpen) => onItemOpenChange(bundle.id, nextOpen)}
      open={open}
    >
      {({ open: bundleOpen }) => (
        <>
          <CollapsibleTrigger className={nestedActivityTriggerClassName}>
            <ActivityStatusIcon status={status} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0 truncate text-xs font-medium text-neutral-800 dark:text-neutral-200">
                  {title}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-neutral-500 dark:text-neutral-500">
                  <span>{eventCount.toLocaleString()} events</span>
                  {elapsedMs ? <span>{formatDuration(elapsedMs)}</span> : null}
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition ${
                      bundleOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </div>
              {subtitle ? (
                <div className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500 dark:text-neutral-500">
                  {subtitle}
                </div>
              ) : null}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="pb-1 pl-7">
              {bundle.items.map((item) =>
                renderTranscriptWorkItem(item, {
                  nested: true,
                  onItemOpenChange,
                  open: Boolean(openItemIds[item.id]),
                  showLogEvents,
                }),
              )}
            </div>
          </CollapsibleContent>
        </>
      )}
    </Collapsible>
  )
}

function ToolActivityBubble({
  group,
  itemId,
  nested = false,
  onOpenChange,
  open,
  showLogEvents,
}: {
  group: ForgeToolActivityGroup
  itemId: string
  nested?: boolean
  onOpenChange: (itemId: string, open: boolean) => void
  open: boolean
  showLogEvents: boolean
}) {
  const latestEvent = group.events.at(-1)
  const toolName = getToolActivityName(group)
  const detail = latestEvent?.message ?? latestEvent?.detail ?? group.path
  const hasDetails = group.events.some(
    (event) => event.detail || event.elapsedMs || event.path,
  )

  return (
    <Collapsible
      className={
        nested
          ? nestedActivityShellClassName(open)
          : activityShellClassName(open)
      }
      onOpenChange={(nextOpen) => onOpenChange(itemId, nextOpen)}
      open={open}
    >
      {({ open }) => (
        <>
          <CollapsibleTrigger
            className={`flex w-full list-none items-start gap-3 px-3 text-left ${
              hasDetails ? 'cursor-pointer' : 'cursor-default'
            } ${nested ? 'py-1.5' : 'py-2.5'} rounded-md transition hover:bg-neutral-950/[0.035] dark:hover:bg-white/[0.04]`}
            disabled={!hasDetails}
          >
            <ActivityStatusIcon status={latestEvent?.status} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0 truncate text-xs font-medium text-neutral-800 dark:text-neutral-200">
                  {formatToolActivityTitle({
                    path: group.path,
                    status: latestEvent?.status,
                    toolName,
                  })}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-neutral-500 dark:text-neutral-500">
                  {group.events.length > 1 ? (
                    <span>{group.events.length} events</span>
                  ) : null}
                  {latestEvent?.elapsedMs ? (
                    <span>{formatDuration(latestEvent.elapsedMs)}</span>
                  ) : null}
                  {hasDetails ? (
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition ${
                        open ? 'rotate-180' : ''
                      }`}
                    />
                  ) : null}
                </div>
              </div>
              {detail ? (
                <div className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500 dark:text-neutral-500">
                  {detail}
                </div>
              ) : null}
            </div>
          </CollapsibleTrigger>
          {hasDetails ? (
            <CollapsibleContent>
              <div className="space-y-1.5 px-10 pb-2 text-xs leading-5 text-neutral-500 dark:text-neutral-500">
                {showLogEvents
                  ? group.events.map((event) => (
                      <div
                        className="rounded-md bg-neutral-950/[0.035] px-2.5 py-2 dark:bg-white/[0.04]"
                        key={event.id}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 truncate font-medium text-neutral-700 dark:text-neutral-300">
                            {event.message ?? event.name}
                          </div>
                          <div className="shrink-0 text-neutral-400 dark:text-neutral-600">
                            {event.status ?? 'event'}
                          </div>
                        </div>
                        {event.path ? (
                          <ActivityDetail label="Path" value={event.path} />
                        ) : null}
                        {event.detail ? (
                          <ActivityDetail label="Detail" value={event.detail} />
                        ) : null}
                        {event.elapsedMs ? (
                          <ActivityDetail
                            label="Elapsed"
                            value={formatDuration(event.elapsedMs)}
                          />
                        ) : null}
                      </div>
                    ))
                  : group.events.map((event) => {
                      const eventDetail = event.detail ?? event.path

                      return eventDetail ? (
                        <ActivityPlainDetail
                          key={event.id}
                          value={eventDetail}
                        />
                      ) : null
                    })}
              </div>
            </CollapsibleContent>
          ) : null}
        </>
      )}
    </Collapsible>
  )
}

function ActivityBubble({
  event,
  itemId,
  nested = false,
  onOpenChange,
  open,
  showLogEvents,
  source,
}: {
  event: ForgeActivityEvent
  itemId: string
  nested?: boolean
  onOpenChange: (itemId: string, open: boolean) => void
  open: boolean
  showLogEvents: boolean
  source: 'agent' | 'workflow'
}) {
  const display = getActivityDisplay(event, source)
  const detail = display?.detail ?? event.detail ?? event.path
  const path = display?.path ?? event.path
  const status = display?.status ?? event.status
  const title = display?.title ?? formatActivityTitle(event, source)
  const subtitleCandidate = display?.subtitle ?? event.message ?? detail
  const subtitle =
    subtitleCandidate && subtitleCandidate !== title
      ? subtitleCandidate
      : detail !== title
        ? detail
        : undefined
  const hasDetails = Boolean(detail || event.elapsedMs || path)

  return (
    <Collapsible
      className={
        nested
          ? nestedActivityShellClassName(open)
          : activityShellClassName(open)
      }
      onOpenChange={(nextOpen) => onOpenChange(itemId, nextOpen)}
      open={open}
    >
      {({ open }) => (
        <>
          <CollapsibleTrigger
            className={`flex w-full list-none items-start gap-3 px-3 text-left ${
              hasDetails ? 'cursor-pointer' : 'cursor-default'
            } ${nested ? 'py-1.5' : 'py-2.5'} rounded-md transition hover:bg-neutral-950/[0.035] dark:hover:bg-white/[0.04]`}
            disabled={!hasDetails}
          >
            <ActivityStatusIcon status={status} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0 truncate font-mono text-xs text-neutral-800 dark:text-neutral-200">
                  {title}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-neutral-500 dark:text-neutral-500">
                  {event.elapsedMs ? (
                    <span>{formatDuration(event.elapsedMs)}</span>
                  ) : null}
                  {hasDetails ? (
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition ${
                        open ? 'rotate-180' : ''
                      }`}
                    />
                  ) : null}
                </div>
              </div>
              {subtitle ? (
                <div className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500 dark:text-neutral-500">
                  {subtitle}
                </div>
              ) : null}
            </div>
          </CollapsibleTrigger>
          {hasDetails ? (
            <CollapsibleContent>
              <div className="px-10 pb-2 text-xs leading-5 text-neutral-500 dark:text-neutral-500">
                {showLogEvents ? (
                  <dl className="space-y-1.5">
                    <ActivityDetail label="Source" value={source} />
                    <ActivityDetail label="Event" value={event.name} />
                    {path ? <ActivityDetail label="Path" value={path} /> : null}
                    {detail ? (
                      <ActivityDetail label="Detail" value={detail} />
                    ) : null}
                    {event.elapsedMs ? (
                      <ActivityDetail
                        label="Elapsed"
                        value={formatDuration(event.elapsedMs)}
                      />
                    ) : null}
                  </dl>
                ) : detail ? (
                  <ActivityPlainDetail value={detail} />
                ) : path ? (
                  <ActivityPlainDetail value={path} />
                ) : null}
              </div>
            </CollapsibleContent>
          ) : null}
        </>
      )}
    </Collapsible>
  )
}

function getLatestTranscriptWorkItem(
  items: Array<ForgeTranscriptItem>,
): ForgeTranscriptWorkItem | undefined {
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index]

    if (!item) {
      continue
    }

    if (item.kind === 'activityGroup' || item.kind === 'semanticGroup') {
      return item.items.at(-1)
    }

    if (item.kind === 'activity' || item.kind === 'tool') {
      return item
    }
  }

  return undefined
}

function getVisibleTranscriptItems(
  items: Array<ForgeTranscriptItem>,
  showLogEvents: boolean,
) {
  const visibleItems = Array<ForgeTranscriptItem>()

  for (const item of items) {
    if (item.kind === 'activityGroup') {
      const groupItems = getVisibleActivityGroupItems(item, showLogEvents)

      if (groupItems.length === 0) {
        continue
      }

      if (groupItems.length === 1) {
        const groupItem = groupItems[0]

        if (groupItem) {
          visibleItems.push(groupItem)
        }

        continue
      }

      visibleItems.push({
        ...item,
        items: groupItems,
      })
      continue
    }

    if (isTranscriptItemVisible(item, showLogEvents)) {
      visibleItems.push(item)
    }
  }

  return visibleItems
}

function isTranscriptItemVisible(
  item: ForgeTranscriptItem,
  showLogEvents: boolean,
) {
  if (item.kind === 'message') {
    return true
  }

  if (item.kind === 'activityGroup') {
    return getVisibleActivityGroupItems(item, showLogEvents).length > 0
  }

  if (item.kind === 'semanticGroup') {
    return true
  }

  return showLogEvents || !isLowLevelTranscriptWorkItem(item)
}

function getVisibleActivityGroupItems(
  group: ForgeActivityTranscriptGroup,
  showLogEvents: boolean,
) {
  return group.items.filter(
    (item) => showLogEvents || !isLowLevelTranscriptWorkItem(item),
  )
}

function isLowLevelTranscriptWorkItem(item: ForgeTranscriptWorkItem) {
  if (item.kind === 'activity') {
    return isLowLevelActivityEvent(item.value, item.source)
  }

  return item.value.events.every((event) =>
    isLowLevelActivityEvent(event, 'agent'),
  )
}

function getActivityGroupChildItems(
  items: Array<ForgeTranscriptWorkItem>,
): Array<ForgeActivityGroupChildItem> {
  const childItems = Array<ForgeActivityGroupChildItem>()
  let toolItems = Array<ForgeToolTranscriptItem>()
  let activeToolName: string | undefined

  function flushToolItems() {
    if (toolItems.length === 0) {
      return
    }

    if (toolItems.length === 1) {
      childItems.push(toolItems[0])
      toolItems = []
      activeToolName = undefined
      return
    }

    const firstTool = toolItems[0]

    if (!firstTool || !activeToolName) {
      toolItems = []
      activeToolName = undefined
      return
    }

    childItems.push({
      id: `tool-bundle:${firstTool.id}`,
      items: toolItems,
      kind: 'toolBundle',
      toolName: activeToolName,
    })
    toolItems = []
    activeToolName = undefined
  }

  for (const item of items) {
    if (item.kind !== 'tool') {
      flushToolItems()
      childItems.push(item)
      continue
    }

    const toolName = getToolActivityName(item.value)

    if (activeToolName && activeToolName !== toolName) {
      flushToolItems()
    }

    activeToolName = toolName
    toolItems.push(item)
  }

  flushToolItems()

  return childItems
}

function getActivityGroupStatus(items: Array<ForgeTranscriptWorkItem>) {
  const statuses = items
    .map(getTranscriptWorkItemStatus)
    .filter((status) => status !== undefined)

  if (statuses.includes('failed')) {
    return 'failed'
  }

  if (
    statuses.length > 0 &&
    statuses.every((status) => status === 'finished')
  ) {
    return 'finished'
  }

  return statuses.at(-1)
}

function getTranscriptWorkItemStatus(item: ForgeTranscriptWorkItem) {
  if (item.kind === 'tool') {
    return item.value.events.at(-1)?.status
  }

  const display = getActivityDisplay(item.value, item.source)

  return display?.status ?? item.value.status
}

function getActivityGroupEventCount(items: Array<ForgeTranscriptWorkItem>) {
  return items.reduce(
    (eventCount, item) => eventCount + getTranscriptWorkItemEventCount(item),
    0,
  )
}

function getTranscriptWorkItemEventCount(item: ForgeTranscriptWorkItem) {
  return item.kind === 'tool' ? item.value.events.length : 1
}

function getActivityGroupElapsedMs(items: Array<ForgeTranscriptWorkItem>) {
  return items.reduce(
    (elapsedMs, item) =>
      Math.max(elapsedMs, getTranscriptWorkItemElapsedMs(item) ?? 0),
    0,
  )
}

function getTranscriptWorkItemElapsedMs(item: ForgeTranscriptWorkItem) {
  if (item.kind === 'activity') {
    return item.value.elapsedMs
  }

  return item.value.events.reduce(
    (elapsedMs, event) => Math.max(elapsedMs, event.elapsedMs ?? 0),
    0,
  )
}

function formatActivityGroupTitle(
  items: Array<ForgeTranscriptWorkItem>,
  status?: string,
) {
  const commandCount = items.filter(isCommandTranscriptWorkItem).length

  if (commandCount > 0 && commandCount === items.length) {
    return formatCountedCommandGroupTitle(commandCount, status)
  }

  const toolCount = items.filter((item) => item.kind === 'tool').length
  const allTools = toolCount === items.length
  const count = allTools ? toolCount : items.length
  const noun = allTools
    ? `${count.toLocaleString()} ${count === 1 ? 'tool call' : 'tool calls'}`
    : `${count.toLocaleString()} ${count === 1 ? 'step' : 'steps'}`

  if (status === 'failed') {
    return `Stopped during ${noun}`
  }

  if (status === 'finished') {
    return `Ran ${noun}`
  }

  return `Running ${noun}`
}

function formatActivityGroupSubtitle(items: Array<ForgeTranscriptWorkItem>) {
  if (
    items.length > 0 &&
    items.every((item) => isCommandTranscriptWorkItem(item))
  ) {
    return undefined
  }

  const counts = new Map<string, number>()

  for (const item of items) {
    const label = getTranscriptWorkItemLabel(item)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  const labels = Array.from(counts.entries()).map(([label, count]) =>
    count === 1 ? label : `${label} x${count.toLocaleString()}`,
  )
  const visibleLabels = labels.slice(0, 5)
  const hiddenCount = labels.length - visibleLabels.length

  return hiddenCount > 0
    ? `${visibleLabels.join(', ')}, +${hiddenCount.toLocaleString()} more`
    : visibleLabels.join(', ')
}

function formatCountedCommandGroupTitle(count: number, status?: string) {
  const noun = `${count.toLocaleString()} ${
    count === 1 ? 'command' : 'commands'
  }`

  return status === 'running' ? `Running ${noun}` : `Ran ${noun}`
}

function isCommandTranscriptWorkItem(item: ForgeTranscriptWorkItem) {
  if (item.kind !== 'activity' || item.source !== 'agent') {
    return false
  }

  return (
    item.value.name.startsWith('agent.codex.command.') ||
    isCodexLegacyItemType(item.value, 'command_execution')
  )
}

function getTranscriptWorkItemLabel(item: ForgeTranscriptWorkItem) {
  if (item.kind === 'tool') {
    return formatToolActivityLabel(getToolActivityName(item.value))
  }

  return formatActivityTitle(item.value, item.source)
}

function getToolActivityName(group: ForgeToolActivityGroup) {
  return group.name.replace('agent.tool.', '')
}

function formatToolActivityLabel(toolName: string) {
  switch (toolName) {
    case 'deleteFile':
      return 'Deleted files'
    case 'listFiles':
      return 'Listed files'
    case 'planRun':
      return 'Planned changes'
    case 'readFile':
      return 'Read files'
    case 'setSummary':
      return 'Summarized run'
    case 'validateFiles':
      return 'Checked files'
    case 'writeFile':
      return 'Wrote files'
    default:
      return toolName
  }
}

function formatToolBundleTitle(
  bundle: Extract<ForgeActivityGroupChildItem, { kind: 'toolBundle' }>,
) {
  const count = bundle.items.length
  const status = getActivityGroupStatus(bundle.items)

  switch (bundle.toolName) {
    case 'deleteFile':
      return formatCountedToolTitle({
        count,
        failed: 'Failed deleting',
        finished: 'Deleted',
        noun: 'file',
        running: 'Deleting',
        status,
      })
    case 'readFile':
      return formatCountedToolTitle({
        count,
        failed: 'Failed reading',
        finished: 'Read',
        noun: 'file',
        running: 'Reading',
        status,
      })
    case 'writeFile':
      return formatCountedToolTitle({
        count,
        failed: 'Failed writing',
        finished: 'Wrote',
        noun: 'file',
        running: 'Writing',
        status,
      })
    default: {
      const label = formatToolActivityLabel(bundle.toolName)
      return count === 1 ? label : `${label} x${count.toLocaleString()}`
    }
  }
}

function formatCountedToolTitle({
  count,
  failed,
  finished,
  noun,
  running,
  status,
}: {
  count: number
  failed: string
  finished: string
  noun: string
  running: string
  status?: string
}) {
  const verb =
    status === 'failed' ? failed : status === 'finished' ? finished : running
  return `${verb} ${count.toLocaleString()} ${count === 1 ? noun : `${noun}s`}`
}

function formatToolBundleSubtitle(
  bundle: Extract<ForgeActivityGroupChildItem, { kind: 'toolBundle' }>,
) {
  const labels = bundle.items
    .map((item) => item.value.path ?? item.value.events.at(-1)?.message)
    .filter((label): label is string => Boolean(label))
  const visibleLabels = labels.slice(0, 5)
  const hiddenCount = labels.length - visibleLabels.length

  return hiddenCount > 0
    ? `${visibleLabels.join(', ')}, +${hiddenCount.toLocaleString()} more`
    : visibleLabels.join(', ')
}

function getValidationSteps(
  group: ForgeSemanticTranscriptGroup,
): Array<ForgeValidationStep> {
  const steps = new Map<string, ForgeValidationStep>()

  for (const item of group.items) {
    if (item.kind !== 'activity' || item.source !== 'workflow') {
      continue
    }

    const step = toValidationStep(item.value)

    if (!step) {
      continue
    }

    steps.set(step.id, step)
  }

  return Array.from(steps.values()).sort(compareValidationSteps)
}

function toValidationStep(
  event: ForgeActivityEvent,
): ForgeValidationStep | undefined {
  const commandName = getWorkflowCommandName(event)

  if (commandName) {
    return {
      detail: event.status === 'failed' ? event.detail : undefined,
      event,
      id: `command:${commandName}`,
      label: formatValidationCommandLabel(commandName, event.status),
      status: event.status,
    }
  }

  if (event.name.startsWith('workflow.materialize.')) {
    return {
      detail: event.status === 'failed' ? event.detail : undefined,
      event,
      id: 'materialize',
      label: formatValidationLifecycleLabel({
        failed: 'Materialization failed',
        finished: 'Materialized workspace',
        running: 'Materializing workspace',
        status: event.status,
      }),
      status: event.status,
    }
  }

  if (event.name.startsWith('workflow.manifest.system-snapshot.')) {
    return {
      detail: event.status === 'failed' ? event.detail : undefined,
      event,
      id: 'system-snapshot',
      label: formatValidationLifecycleLabel({
        failed: 'System snapshot failed',
        finished: 'Captured system files',
        running: 'Capturing system files',
        status: event.status,
      }),
      status: event.status,
    }
  }

  if (event.name.startsWith('workflow.validation.')) {
    return {
      detail: event.status === 'failed' ? event.detail : undefined,
      event,
      id: 'validation',
      label: formatValidationLifecycleLabel({
        failed: 'Validation failed',
        finished: 'Validation passed',
        running: 'Validation running',
        status: event.status,
      }),
      status: event.status,
    }
  }

  return undefined
}

function getValidationGroupStatus(steps: Array<ForgeValidationStep>) {
  const statuses = steps
    .map((step) => step.status)
    .filter((status) => status !== undefined)

  if (statuses.includes('failed')) {
    return 'failed'
  }

  if (
    statuses.length > 0 &&
    steps.some((step) => step.id === 'validation') &&
    statuses.every((status) => status === 'finished')
  ) {
    return 'finished'
  }

  return 'running'
}

function formatValidationGroupTitle(status?: string) {
  if (status === 'failed') {
    return 'Workspace validation failed'
  }

  if (status === 'finished') {
    return 'Validated workspace'
  }

  return 'Validating workspace'
}

function formatValidationGroupSubtitle(steps: Array<ForgeValidationStep>) {
  const labels = steps
    .filter(
      (step) => step.id.startsWith('command:') || step.status === 'failed',
    )
    .map((step) => step.label)
  const visibleLabels = labels.slice(0, 5)
  const hiddenCount = labels.length - visibleLabels.length

  return hiddenCount > 0
    ? `${visibleLabels.join(', ')}, +${hiddenCount.toLocaleString()} more`
    : visibleLabels.join(', ')
}

function getWorkflowCommandName(event: ForgeActivityEvent) {
  if (!event.name.startsWith('workflow.command.')) {
    return undefined
  }

  const match = event.message?.match(/^(.+) (started|passed|failed)$/)
  return match?.[1]
}

function formatValidationCommandLabel(commandName: string, status?: string) {
  const commandTitle = formatWorkflowCommandTitle(commandName)

  if (status === 'failed') {
    return `${commandTitle} failed`
  }

  if (status === 'finished') {
    return `${commandTitle} passed`
  }

  return `${commandTitle} started`
}

function formatWorkflowCommandTitle(commandName: string) {
  switch (commandName) {
    case 'build':
      return 'Build'
    case 'install':
      return 'Install'
    case 'route-tree':
      return 'Route tree'
    case 'typecheck':
      return 'Typecheck'
    default:
      return commandName
        .split('-')
        .filter(Boolean)
        .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
        .join(' ')
  }
}

function formatValidationLifecycleLabel({
  failed,
  finished,
  running,
  status,
}: {
  failed: string
  finished: string
  running: string
  status?: string
}) {
  if (status === 'failed') {
    return failed
  }

  if (status === 'finished') {
    return finished
  }

  return running
}

function compareValidationSteps(
  left: ForgeValidationStep,
  right: ForgeValidationStep,
) {
  const leftOrder = getValidationStepOrder(left)
  const rightOrder = getValidationStepOrder(right)

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder
  }

  return left.id.localeCompare(right.id)
}

function getValidationStepOrder(step: ForgeValidationStep) {
  switch (step.id) {
    case 'materialize':
      return 10
    case 'command:install':
      return 20
    case 'command:route-tree':
      return 30
    case 'system-snapshot':
      return 40
    case 'command:typecheck':
      return 50
    case 'command:build':
      return 60
    case 'validation':
      return 70
    default:
      return 100
  }
}

function ActivityDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[76px_minmax(0,1fr)]">
      <dt className="text-neutral-400 dark:text-neutral-600">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap break-words font-mono text-neutral-700 dark:text-neutral-300">
        {value}
      </dd>
    </div>
  )
}

function ActivityPlainDetail({ value }: { value: string }) {
  return (
    <div className="min-w-0 whitespace-pre-wrap break-words font-mono text-neutral-700 dark:text-neutral-300">
      {value}
    </div>
  )
}

function ActivityStatusIcon({ status }: { status?: string }) {
  if (status === 'failed') {
    return <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
  }

  if (status === 'finished') {
    return (
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
    )
  }

  return (
    <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-500" />
  )
}

function buttonClassName({
  enabled,
  tone,
}: {
  enabled: boolean
  tone: 'primary' | 'secondary'
}) {
  const base =
    'inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition'

  if (!enabled) {
    return `${base} cursor-not-allowed border border-neutral-200 bg-neutral-50 text-neutral-400 dark:border-white/10 dark:bg-white/5 dark:text-neutral-600`
  }

  if (tone === 'primary') {
    return `${base} bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200`
  }

  return `${base} border border-neutral-200 bg-neutral-50 text-neutral-800 hover:bg-neutral-100 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:hover:bg-white/10`
}

function sendButtonClassName(enabled: boolean) {
  const base =
    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition'

  if (!enabled) {
    return `${base} cursor-not-allowed bg-neutral-200 text-neutral-400 dark:bg-white/10 dark:text-neutral-600`
  }

  return `${base} bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200`
}

const activityTriggerClassName =
  'flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition hover:bg-neutral-950/[0.035] dark:hover:bg-white/[0.04]'

const forgeChatContentClassName = 'mx-auto w-full max-w-[760px]'

const nestedActivityTriggerClassName =
  'flex w-full items-start gap-3 rounded-md px-3 py-1.5 text-left transition hover:bg-neutral-950/[0.035] dark:hover:bg-white/[0.04]'

const activityContentClassName =
  'rounded-b-md bg-neutral-950/[0.025] dark:bg-white/[0.03]'

function activityShellClassName(open: boolean) {
  const base = 'group rounded-md transition-colors'

  return open
    ? `${base} bg-neutral-950/[0.035] dark:bg-white/[0.04]`
    : `${base} bg-transparent`
}

function nestedActivityShellClassName(open: boolean) {
  const base = 'group rounded-md transition-colors'

  return open
    ? `${base} bg-neutral-950/[0.025] dark:bg-white/[0.035]`
    : `${base} bg-transparent`
}

function workspaceModeButtonClassName(active: boolean) {
  const base = 'h-6 rounded px-2 text-xs font-medium transition'

  if (active) {
    return `${base} bg-neutral-200 text-neutral-950 dark:bg-white/15 dark:text-white`
  }

  return `${base} text-neutral-500 hover:bg-neutral-200/80 hover:text-neutral-900 dark:text-neutral-500 dark:hover:bg-white/10 dark:hover:text-neutral-200`
}

function rightPanelModeButtonClassName(active: boolean) {
  const base =
    'flex h-7 min-w-0 items-center gap-1.5 rounded-md px-2 text-xs transition'

  if (active) {
    return `${base} bg-neutral-100 text-neutral-900 dark:bg-white/5 dark:text-neutral-200`
  }

  return `${base} text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-500 dark:hover:bg-white/5 dark:hover:text-neutral-200`
}

function topBarToggleButtonClassName(active: boolean) {
  const base =
    'inline-flex h-8 shrink-0 items-center justify-center rounded-md px-2 text-xs font-medium transition'

  if (active) {
    return `${base} bg-neutral-100 text-neutral-900 dark:bg-white/5 dark:text-neutral-200`
  }

  return `${base} text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-white/5 dark:hover:text-white`
}

function iconButtonClassName({
  active,
  enabled,
}: {
  active?: boolean
  enabled: boolean
}) {
  const base =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition'

  if (active) {
    return `${base} bg-neutral-100 text-neutral-900 dark:bg-white/5 dark:text-neutral-200`
  }

  if (!enabled) {
    return `${base} cursor-not-allowed text-neutral-300 dark:text-neutral-700`
  }

  return `${base} text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-white/5 dark:hover:text-white`
}

function getForgeLeftPaneMaxWidth(rightPaneWidth: number) {
  if (typeof window === 'undefined') {
    return FORGE_LEFT_PANE_MAX_WIDTH
  }

  const reservedRightWidth =
    window.innerWidth >= FORGE_RIGHT_PANE_BREAKPOINT ? rightPaneWidth : 0
  const viewportMax =
    window.innerWidth - reservedRightWidth - FORGE_CHAT_PANE_MIN_WIDTH

  return Math.max(
    FORGE_LEFT_PANE_MIN_WIDTH,
    Math.min(FORGE_LEFT_PANE_MAX_WIDTH, viewportMax),
  )
}

function getForgeRightPaneMaxWidth(leftPaneWidth: number) {
  if (typeof window === 'undefined') {
    return FORGE_RIGHT_PANE_MAX_WIDTH
  }

  const viewportMax =
    window.innerWidth - leftPaneWidth - FORGE_CHAT_PANE_MIN_WIDTH

  return Math.max(
    FORGE_RIGHT_PANE_MIN_WIDTH,
    Math.min(FORGE_RIGHT_PANE_MAX_WIDTH, viewportMax),
  )
}

function clampForgeLeftPaneWidth(value: number, rightPaneWidth: number) {
  return clampNumber(
    value,
    FORGE_LEFT_PANE_MIN_WIDTH,
    getForgeLeftPaneMaxWidth(rightPaneWidth),
  )
}

function clampForgeRightPaneWidth(value: number, leftPaneWidth: number) {
  return clampNumber(
    value,
    FORGE_RIGHT_PANE_MIN_WIDTH,
    getForgeRightPaneMaxWidth(leftPaneWidth),
  )
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function readCodexAgentMessageText(event: ForgeSession['agentEvents'][number]) {
  if (!event.name.startsWith('agent.codex.')) {
    return undefined
  }

  const detail = event.detail

  if (!detail) {
    return undefined
  }

  try {
    const parsed: unknown = JSON.parse(detail)

    if (!isRecord(parsed) || parsed.type !== 'item.completed') {
      return undefined
    }

    const item = isRecord(parsed.item) ? parsed.item : undefined

    if (!item || item.type !== 'agent_message') {
      return undefined
    }

    const text = readString(item.text)?.trim()

    if (text && isCodexFinalJsonMessageText(text)) {
      return undefined
    }

    return text || undefined
  } catch {
    return undefined
  }
}

function isCodexFinalJsonMessageText(text: string) {
  try {
    const parsed: unknown = JSON.parse(text)

    return (
      isRecord(parsed) &&
      typeof parsed.title === 'string' &&
      typeof parsed.summary === 'string'
    )
  } catch {
    return false
  }
}

function toForgeTranscriptMessageStatus(status?: string) {
  if (status === 'failed') {
    return 'failed'
  }

  if (status === 'running' || status === 'queued' || status === 'starting') {
    return 'streaming'
  }

  if (status === 'cancelled') {
    return 'cancelled'
  }

  return 'complete'
}

function readCodexSummaryMessageText(
  event: ForgeSession['agentEvents'][number],
) {
  if (event.name !== 'agent.codex.summary') {
    return undefined
  }

  return event.detail?.trim() || event.message?.trim() || undefined
}

function readRunFailureMessageText(event: ForgeSession['agentEvents'][number]) {
  if (event.name !== 'run.failed') {
    return undefined
  }

  return event.detail?.trim() || event.message?.trim() || 'Run failed'
}

function createForgeTranscriptItems(
  session: ForgeSession,
): Array<ForgeTranscriptItem> {
  const items = Array<
    | ForgeMessageTranscriptItem
    | ForgeSemanticTranscriptGroup
    | ForgeTranscriptWorkItem
  >()
  const toolGroups = new Map<string, ForgeToolActivityGroup>()
  const validationGroups = new Map<
    string,
    Array<ForgeSession['workflowEvents'][number]>
  >()
  const terminalLifecycleEventKeys = getTerminalLifecycleEventKeys([
    ...session.agentEvents,
    ...session.workflowEvents,
  ])

  for (const message of session.messages) {
    if (!message.content && message.status !== 'streaming') {
      continue
    }

    items.push({
      createdAt: message.createdAt,
      id: `message:${message.id}`,
      kind: 'message',
      value: message,
    })
  }

  for (const event of session.agentEvents) {
    if (shouldHideLifecycleStartEvent(event, terminalLifecycleEventKeys)) {
      continue
    }

    const codexSummaryMessageText = readCodexSummaryMessageText(event)

    if (codexSummaryMessageText) {
      items.push({
        createdAt: event.createdAt,
        id: `agent-summary:${event.id}`,
        kind: 'message',
        value: {
          content: codexSummaryMessageText,
          createdAt: event.createdAt,
          id: `agent-summary:${event.id}`,
          role: 'assistant',
          status: 'complete',
        },
      })
    }

    const runFailureMessageText = readRunFailureMessageText(event)

    if (runFailureMessageText) {
      items.push({
        createdAt: event.createdAt,
        id: `agent-run-failure:${event.id}`,
        kind: 'message',
        value: {
          content: runFailureMessageText,
          createdAt: event.createdAt,
          id: `agent-run-failure:${event.id}`,
          role: 'assistant',
          status: 'failed',
        },
      })
    }

    const codexAgentMessageText = readCodexAgentMessageText(event)

    if (codexAgentMessageText) {
      items.push({
        createdAt: event.createdAt,
        id: `agent-message:${event.id}`,
        kind: 'message',
        value: {
          content: codexAgentMessageText,
          createdAt: event.createdAt,
          id: `agent-message:${event.id}`,
          role: 'assistant',
          status: toForgeTranscriptMessageStatus(event.status),
        },
      })
    }

    if (event.name.startsWith('agent.tool.')) {
      const groupId = event.toolCallId ?? event.id
      const existingGroup = toolGroups.get(groupId)

      if (existingGroup) {
        existingGroup.events.push(event)
        existingGroup.path = existingGroup.path ?? event.path
      } else {
        toolGroups.set(groupId, {
          createdAt: event.createdAt,
          events: [event],
          id: groupId,
          name: event.name,
          path: event.path,
          toolCallId: event.toolCallId,
        })
      }

      continue
    }

    items.push({
      createdAt: event.createdAt,
      id: `agent:${event.id}`,
      kind: 'activity',
      source: 'agent',
      value: event,
    })
  }

  for (const group of toolGroups.values()) {
    group.events.sort(compareForgeActivityEvents)
    items.push({
      createdAt: group.createdAt,
      id: `tool:${group.id}`,
      kind: 'tool',
      value: group,
    })
  }

  for (const event of session.workflowEvents) {
    if (shouldHideLifecycleStartEvent(event, terminalLifecycleEventKeys)) {
      continue
    }

    if (isValidationWorkflowEvent(event)) {
      const groupEvents = validationGroups.get(event.runId)

      if (groupEvents) {
        groupEvents.push(event)
      } else {
        validationGroups.set(event.runId, [event])
      }

      continue
    }

    items.push({
      createdAt: event.createdAt,
      id: `workflow:${event.id}`,
      kind: 'activity',
      source: 'workflow',
      value: event,
    })
  }

  for (const [runId, events] of validationGroups) {
    events.sort(compareForgeActivityEvents)

    const firstEvent = events[0]

    if (!firstEvent) {
      continue
    }

    items.push({
      createdAt: firstEvent.createdAt,
      id: `validation:${runId}`,
      items: events.map((event) => ({
        createdAt: event.createdAt,
        id: `workflow:${event.id}`,
        kind: 'activity',
        source: 'workflow',
        value: event,
      })),
      kind: 'semanticGroup',
      semanticKind: 'validation',
    })
  }

  return groupConsecutiveTranscriptWorkItems(
    items.sort(compareForgeTranscriptItems),
  )
}

function groupConsecutiveTranscriptWorkItems(
  items: Array<
    | ForgeMessageTranscriptItem
    | ForgeSemanticTranscriptGroup
    | ForgeTranscriptWorkItem
  >,
): Array<ForgeTranscriptItem> {
  const groupedItems = Array<ForgeTranscriptItem>()
  let workItems = Array<ForgeTranscriptWorkItem>()
  let activeTaskType: string | undefined

  function flushWorkItems() {
    if (workItems.length === 0) {
      return
    }

    if (workItems.length === 1) {
      groupedItems.push(workItems[0])
      workItems = []
      activeTaskType = undefined
      return
    }

    const firstItem = workItems[0]

    if (!firstItem) {
      return
    }

    groupedItems.push({
      createdAt: firstItem.createdAt,
      id: `activity-group:${firstItem.id}`,
      items: workItems,
      kind: 'activityGroup',
    })
    workItems = []
    activeTaskType = undefined
  }

  for (const item of items) {
    if (item.kind === 'message' || item.kind === 'semanticGroup') {
      flushWorkItems()
      groupedItems.push(item)
      continue
    }

    const taskType = getTranscriptWorkItemGroupTaskType(item)

    if (!taskType) {
      flushWorkItems()
      groupedItems.push(item)
      continue
    }

    if (activeTaskType && activeTaskType !== taskType) {
      flushWorkItems()
    }

    activeTaskType = taskType
    workItems.push(item)
  }

  flushWorkItems()

  return groupedItems
}

function getTranscriptWorkItemGroupTaskType(item: ForgeTranscriptWorkItem) {
  return isCommandTranscriptWorkItem(item) ? 'command' : undefined
}

function compareForgeTranscriptItems(
  left: ForgeTranscriptItem,
  right: ForgeTranscriptItem,
) {
  const leftTime = Date.parse(left.createdAt)
  const rightTime = Date.parse(right.createdAt)
  const leftMs = Number.isFinite(leftTime) ? leftTime : 0
  const rightMs = Number.isFinite(rightTime) ? rightTime : 0

  if (leftMs !== rightMs) {
    return leftMs - rightMs
  }

  return left.id.localeCompare(right.id)
}

function compareForgeActivityEvents(
  left: ForgeActivityEvent,
  right: ForgeActivityEvent,
) {
  const leftTime = Date.parse(left.createdAt)
  const rightTime = Date.parse(right.createdAt)
  const leftMs = Number.isFinite(leftTime) ? leftTime : 0
  const rightMs = Number.isFinite(rightTime) ? rightTime : 0

  if (leftMs !== rightMs) {
    return leftMs - rightMs
  }

  return left.id.localeCompare(right.id)
}

function getTerminalLifecycleEventKeys(events: Array<ForgeActivityEvent>) {
  const keys = new Set<string>()

  for (const event of events) {
    const key = getLifecycleEventKey(event, 'terminal')

    if (key) {
      keys.add(key)
    }
  }

  return keys
}

function shouldHideLifecycleStartEvent(
  event: ForgeActivityEvent,
  terminalLifecycleEventKeys: Set<string>,
) {
  if (event.status === 'failed' || event.status === 'cancelled') {
    return false
  }

  const key = getLifecycleEventKey(event, 'start')

  return key ? terminalLifecycleEventKeys.has(key) : false
}

function getLifecycleEventKey(
  event: ForgeActivityEvent,
  phase: 'start' | 'terminal',
) {
  const baseName = getLifecycleBaseEventName(event.name, phase)

  if (!baseName) {
    return undefined
  }

  const toolCallId =
    'toolCallId' in event && typeof event.toolCallId === 'string'
      ? event.toolCallId
      : undefined

  return toolCallId
    ? `${event.runId}:${baseName}:${toolCallId}`
    : `${event.runId}:${baseName}`
}

function getLifecycleBaseEventName(
  eventName: string,
  phase: 'start' | 'terminal',
) {
  const suffix =
    phase === 'start'
      ? /\.(started|start)$/i
      : /\.(cancelled|completed|done|error|failed|finished)$/i

  if (!suffix.test(eventName)) {
    return undefined
  }

  return eventName.replace(suffix, '')
}

function isLowLevelActivityEvent(
  event: ForgeActivityEvent,
  source: 'agent' | 'workflow',
) {
  if (source === 'agent') {
    return (
      event.name === 'agent.harness.started' ||
      event.name === 'agent.harness.finished' ||
      event.name === 'agent.model.started' ||
      event.name === 'agent.model.finished' ||
      event.name === 'agent.codex.output' ||
      event.name === 'agent.codex.message' ||
      event.name === 'agent.codex.plan' ||
      event.name === 'agent.codex.notice' ||
      event.name.startsWith('agent.codex.process.') ||
      event.name.startsWith('agent.codex.thread.') ||
      event.name.startsWith('agent.codex.turn.') ||
      event.name === 'run.failed' ||
      event.name === 'agent.codex.file.changed' ||
      event.name === 'agent.codex.summary' ||
      event.name === 'agent.codex.workspace.prepared' ||
      isCodexLegacyItemType(event, 'error') ||
      readCodexAgentMessageText(event) !== undefined
    )
  }

  return (
    event.name.endsWith('.started') &&
    (event.name.startsWith('workflow.manifest.') ||
      event.name.startsWith('workflow.materialize.'))
  )
}

function isValidationWorkflowEvent(
  event: ForgeSession['workflowEvents'][number],
) {
  return (
    event.name.startsWith('workflow.materialize.') ||
    event.name.startsWith('workflow.command.') ||
    event.name.startsWith('workflow.manifest.system-snapshot.') ||
    event.name.startsWith('workflow.validation.')
  )
}

function parseForgeSnapshotEvent(data: string): ForgeSession | undefined {
  try {
    const parsed: unknown = JSON.parse(data)

    if (!isRecord(parsed) || parsed.type !== 'snapshot') {
      return undefined
    }

    return isForgeSession(parsed.snapshot) ? parsed.snapshot : undefined
  } catch {
    return undefined
  }
}

function parseForgeStateBatchEvent(
  data: string,
): ForgeStateBatchStreamEvent | undefined {
  try {
    const parsed: unknown = JSON.parse(data)

    if (
      !isRecord(parsed) ||
      parsed.type !== 'state-batch' ||
      !Array.isArray(parsed.events)
    ) {
      return undefined
    }

    const events = parsed.events.filter(isForgeStateEvent)

    return {
      events,
      stateOffset:
        typeof parsed.stateOffset === 'number' ? parsed.stateOffset : 0,
      timelineOffset:
        typeof parsed.timelineOffset === 'number' ? parsed.timelineOffset : 0,
      type: 'state-batch',
    }
  } catch {
    return undefined
  }
}

function isForgeSession(value: unknown): value is ForgeSession {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.activeChatId === 'string' &&
    Array.isArray(value.agentEvents) &&
    Array.isArray(value.chats) &&
    value.chats.every(isForgeChat) &&
    Array.isArray(value.exports) &&
    Array.isArray(value.workflowEvents) &&
    typeof value.fileCount === 'number' &&
    isStringRecord(value.files) &&
    Array.isArray(value.messages) &&
    typeof value.stateEventCount === 'number' &&
    typeof value.timelineEventCount === 'number' &&
    Array.isArray(value.topFiles) &&
    value.topFiles.every((file) => typeof file === 'string') &&
    typeof value.totalBytes === 'number' &&
    Array.isArray(value.warnings) &&
    value.warnings.every((warning) => typeof warning === 'string')
  )
}

function isForgeChat(value: unknown): value is ForgeSession['chats'][number] {
  return (
    isRecord(value) &&
    typeof value.createdAt === 'string' &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

function isForgeGitHubAuthState(value: unknown): value is ForgeGitHubAuthState {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.authenticated === 'boolean' &&
    typeof value.hasGitHubAccount === 'boolean' &&
    typeof value.hasPrivateRepoScope === 'boolean' &&
    typeof value.hasRepoScope === 'boolean'
  )
}

function isForgeStateEvent(value: unknown): value is ForgeStateEvent {
  if (!isRecord(value) || !isRecord(value.headers)) {
    return false
  }

  return (
    typeof value.type === 'string' &&
    typeof value.key === 'string' &&
    typeof value.headers.stateOffset === 'string' &&
    typeof value.headers.timelineOffset === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) {
    return false
  }

  return Object.values(value).every((entry) => typeof entry === 'string')
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

type ForgeActivityDisplay = {
  detail?: string
  path?: string
  status?: string
  subtitle?: string
  title?: string
}

type CodexLegacyFileChange = {
  kind?: string
  path: string
}

function getActivityDisplay(
  event: ForgeActivityEvent,
  source: 'agent' | 'workflow',
): ForgeActivityDisplay | undefined {
  if (source !== 'agent') {
    return undefined
  }

  if (event.name === 'agent.codex.summary') {
    return {
      status: 'finished',
    }
  }

  if (event.name.startsWith('agent.codex.command.')) {
    const running = event.name.endsWith('.started')

    return {
      status: running ? 'running' : 'neutral',
      title: running ? 'Running command' : 'Ran command',
    }
  }

  return getCodexLegacyActivityDisplay(event)
}

function getCodexLegacyActivityDisplay(
  event: ForgeActivityEvent,
): ForgeActivityDisplay | undefined {
  if (!event.name.startsWith('agent.codex.item.') || !event.detail) {
    return undefined
  }

  const item = readCodexLegacyItem(event.detail)

  if (!item) {
    return undefined
  }

  const itemType = readString(item.type)

  if (itemType === 'command_execution') {
    return getCodexLegacyCommandDisplay(event, item)
  }

  if (itemType === 'file_change') {
    return getCodexLegacyFileChangeDisplay(event, item)
  }

  if (itemType === 'error') {
    return {
      detail: readString(item.message) ?? readString(item.text) ?? event.detail,
      status: getCodexLegacyItemStatus(event, item),
      title: 'Codex notice',
    }
  }

  return undefined
}

function readCodexLegacyItem(detail: string) {
  try {
    const parsed: unknown = JSON.parse(detail)

    if (!isRecord(parsed)) {
      return undefined
    }

    return isRecord(parsed.item) ? parsed.item : undefined
  } catch {
    return undefined
  }
}

function isCodexLegacyItemType(event: ForgeActivityEvent, itemType: string) {
  if (!event.name.startsWith('agent.codex.item.') || !event.detail) {
    return false
  }

  const item = readCodexLegacyItem(event.detail)

  return readString(item?.type) === itemType
}

function getCodexLegacyCommandDisplay(
  event: ForgeActivityEvent,
  item: Record<string, unknown>,
): ForgeActivityDisplay {
  const command = readString(item.command) ?? readString(item.cmd) ?? 'command'
  const output =
    readString(item.aggregated_output) ?? readString(item.output) ?? undefined
  const exitCode = readNumber(item.exit_code)
  const status = getCodexLegacyItemStatus(event, item)
  const running = status === 'running'

  return {
    detail: formatCodexLegacyCommandDetail({
      command,
      exitCode,
      output,
    }),
    status: running ? 'running' : 'neutral',
    subtitle: limitDisplayText(command, 220),
    title: running ? 'Running command' : 'Ran command',
  }
}

function getCodexLegacyFileChangeDisplay(
  event: ForgeActivityEvent,
  item: Record<string, unknown>,
): ForgeActivityDisplay {
  const changes = readCodexLegacyFileChanges(event, item)
  const status = getCodexLegacyItemStatus(event, item)
  const title = formatCodexLegacyFileChangeTitle(changes, status)
  const detail = formatCodexLegacyFileChangeDetail(changes)
  const firstChange = changes[0]

  return {
    detail,
    path: changes.length === 1 ? firstChange?.path : undefined,
    status,
    subtitle: detail,
    title,
  }
}

function readCodexLegacyFileChanges(
  event: ForgeActivityEvent,
  item: Record<string, unknown>,
) {
  const changes = Array<CodexLegacyFileChange>()

  if (!Array.isArray(item.changes)) {
    return changes
  }

  for (const change of item.changes) {
    if (!isRecord(change)) {
      continue
    }

    const filePath = readString(change.path) ?? readString(change.file)

    if (!filePath) {
      continue
    }

    changes.push({
      kind: readString(change.kind),
      path: toCodexLegacyDisplayPath(event, filePath),
    })
  }

  return changes
}

function toCodexLegacyDisplayPath(event: ForgeActivityEvent, filePath: string) {
  const runWorkspaceMarker = `/workspaces/${event.runId}/`
  const runWorkspaceIndex = filePath.indexOf(runWorkspaceMarker)

  if (runWorkspaceIndex >= 0) {
    return filePath.slice(runWorkspaceIndex + runWorkspaceMarker.length)
  }

  const workspaceMarker = '/codex-cli/workspaces/'
  const workspaceIndex = filePath.indexOf(workspaceMarker)

  if (workspaceIndex < 0) {
    return filePath
  }

  const workspacePath = filePath.slice(workspaceIndex + workspaceMarker.length)
  const firstPathSeparatorIndex = workspacePath.indexOf('/')

  return firstPathSeparatorIndex >= 0
    ? workspacePath.slice(firstPathSeparatorIndex + 1)
    : filePath
}

function getCodexLegacyItemStatus(
  event: ForgeActivityEvent,
  item: Record<string, unknown>,
) {
  const exitCode = readNumber(item.exit_code)

  if (exitCode !== undefined && exitCode !== 0) {
    return 'failed'
  }

  const itemStatus = readString(item.status)

  if (itemStatus) {
    if (/\b(failed|error)\b/i.test(itemStatus)) {
      return 'failed'
    }

    if (/\b(completed|finished|done|success|succeeded)\b/i.test(itemStatus)) {
      return 'finished'
    }

    if (/\b(cancelled|canceled|interrupted)\b/i.test(itemStatus)) {
      return 'cancelled'
    }
  }

  return event.status
}

function formatCodexLegacyCommandDetail({
  command,
  exitCode,
  output,
}: {
  command: string
  exitCode?: number
  output?: string
}) {
  const lines = [`$ ${command}`]

  if (exitCode !== undefined) {
    lines.push('', `Exit code: ${exitCode.toLocaleString()}`)
  }

  if (output) {
    lines.push('', limitDisplayText(output.trim(), 4000))
  }

  return limitDisplayText(lines.join('\n'), 5000)
}

function formatCodexLegacyFileChangeTitle(
  changes: Array<CodexLegacyFileChange>,
  status?: string,
) {
  const verb =
    status === 'failed'
      ? 'Failed editing'
      : status === 'finished'
        ? 'Edited'
        : 'Editing'

  if (changes.length === 0) {
    return `${verb} files`
  }

  if (changes.length === 1) {
    return `${verb} ${changes[0]?.path ?? 'file'}`
  }

  return `${verb} ${changes.length.toLocaleString()} files`
}

function formatCodexLegacyFileChangeDetail(
  changes: Array<CodexLegacyFileChange>,
) {
  if (changes.length === 0) {
    return undefined
  }

  return changes
    .map((change) => `${change.kind ?? 'change'} ${change.path}`)
    .join('\n')
}

function limitDisplayText(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text
}

function formatActivityTitle(
  event: ForgeActivityEvent,
  source: 'agent' | 'workflow',
) {
  if (source === 'agent' && event.name.startsWith('agent.tool.')) {
    const toolName = event.name.replace('agent.tool.', '')

    return event.path ? `tool.${toolName} ${event.path}` : `tool.${toolName}`
  }

  if (source === 'agent') {
    const agentTitle = formatKnownAgentActivityTitle(event)

    if (agentTitle) {
      return agentTitle
    }
  }

  if (source === 'workflow') {
    const validationStep = toValidationStep(event)

    if (validationStep) {
      return validationStep.label
    }
  }

  return event.path ? `${event.name} ${event.path}` : event.name
}

function formatKnownAgentActivityTitle(event: ForgeActivityEvent) {
  const display = getCodexLegacyActivityDisplay(event)

  if (display?.title) {
    return display.title
  }

  switch (event.name) {
    case 'agent.harness.started':
      return 'Harness started'
    case 'agent.harness.finished':
      return 'Harness finished'
    case 'agent.model.started':
      return 'Thinking'
    case 'agent.model.finished':
      return 'Finished thinking'
    case 'agent.model.error':
      return 'Model error'
    case 'agent.codex.workspace.prepared':
      return 'Prepared Codex workspace'
    case 'agent.codex.plan':
      return 'Planned changes'
    case 'agent.codex.command.started':
      return 'Running command'
    case 'agent.codex.command.completed':
      return 'Ran command'
    case 'agent.codex.command.failed':
      return 'Ran command'
    case 'agent.codex.file.change.started':
      return event.message || 'Editing files'
    case 'agent.codex.file.change.completed':
      return event.message || 'Edited files'
    case 'agent.codex.file.change.failed':
      return event.message || 'File edit failed'
    case 'agent.codex.file.changed':
      return event.path
        ? `Captured file change ${event.path}`
        : 'Captured file change'
    case 'agent.codex.notice':
      return 'Codex notice'
    case 'agent.codex.summary':
      return 'Summarized changes'
    case 'agent.codex.output':
      return 'Codex output'
    default:
      return undefined
  }
}

function formatToolActivityTitle({
  path,
  status,
  toolName,
}: {
  path?: string
  status?: string
  toolName: string
}) {
  const verb = formatToolVerb(toolName, status)

  return path ? `${verb} ${path}` : verb
}

function formatToolVerb(toolName: string, status?: string) {
  if (status === 'failed') {
    switch (toolName) {
      case 'deleteFile':
        return 'Failed deleting'
      case 'listFiles':
        return 'Failed listing files'
      case 'planRun':
        return 'Failed planning run'
      case 'readFile':
        return 'Failed reading'
      case 'setSummary':
        return 'Failed summarizing run'
      case 'validateFiles':
        return 'Failed checking files'
      case 'writeFile':
        return 'Failed writing'
      default:
        return `Failed ${toolName}`
    }
  }

  if (status !== 'finished') {
    switch (toolName) {
      case 'deleteFile':
        return 'Deleting'
      case 'listFiles':
        return 'Listing files'
      case 'planRun':
        return 'Planning run'
      case 'readFile':
        return 'Reading'
      case 'setSummary':
        return 'Summarizing run'
      case 'validateFiles':
        return 'Checking files'
      case 'writeFile':
        return 'Writing'
      default:
        return `Running ${toolName}`
    }
  }

  switch (toolName) {
    case 'deleteFile':
      return 'Deleted'
    case 'listFiles':
      return 'Listed files'
    case 'planRun':
      return 'Planned run'
    case 'readFile':
      return 'Read'
    case 'setSummary':
      return 'Summarized run'
    case 'validateFiles':
      return 'Validated files'
    case 'writeFile':
      return 'Wrote'
    default:
      return `Ran ${toolName}`
  }
}

function formatActiveWorkTitle(
  event: ForgeActivityEvent,
  source: 'agent' | 'workflow',
) {
  if (source === 'agent' && event.name.startsWith('agent.tool.')) {
    return formatToolActivityTitle({
      path: event.path,
      status: event.status,
      toolName: event.name.replace('agent.tool.', ''),
    })
  }

  if (source === 'workflow') {
    const validationStep = toValidationStep(event)

    if (validationStep) {
      return validationStep.label
    }
  }

  if (source === 'agent') {
    const agentTitle = formatKnownAgentActivityTitle(event)

    if (agentTitle) {
      return agentTitle
    }
  }

  const title = formatActivityTitle(event, source)

  if (event.status === 'failed') {
    return `Failed ${title}`
  }

  if (event.status === 'finished') {
    return `Last completed ${title}`
  }

  return `Working on ${title}`
}

function formatRunStatusLabel(status?: string) {
  switch (status) {
    case 'queued':
      return 'Queued'
    case 'starting':
      return 'Starting agent'
    case 'running':
      return 'Thinking'
    case 'finishing':
      return 'Finishing run'
    case 'paused':
      return 'Paused'
    default:
      return 'Working'
  }
}

function isActiveForgeRunStatus(status?: string) {
  switch (status) {
    case 'finishing':
    case 'paused':
    case 'queued':
    case 'running':
    case 'starting':
      return true
    default:
      return false
  }
}

function formatExportStatus(exportRow: ForgeSession['exports'][number]) {
  if (exportRow.status === 'completed' && exportRow.kind === 'github') {
    return exportRow.repoName ? `GitHub: ${exportRow.repoName}` : 'GitHub'
  }

  if (exportRow.status === 'completed' && exportRow.byteLength !== undefined) {
    return `${formatBytes(exportRow.byteLength)} ZIP`
  }

  if (exportRow.status === 'failed') {
    return 'Failed'
  }

  return exportRow.kind === 'github' ? 'Exporting GitHub' : 'Running'
}

function getGitHubExportAuthMessage({
  authState,
  isPrivate,
}: {
  authState?: ForgeGitHubAuthState
  isPrivate: boolean
}) {
  if (!authState) {
    return 'Checking GitHub access'
  }

  if (!authState.authenticated) {
    return 'Login required'
  }

  if (!authState.hasGitHubAccount) {
    return 'GitHub account required'
  }

  if (!hasRequiredGitHubRepoScope({ authState, isPrivate })) {
    return isPrivate
      ? 'GitHub private repo scope required'
      : 'GitHub public repo scope required'
  }

  return undefined
}

function hasRequiredGitHubRepoScope({
  authState,
  isPrivate,
}: {
  authState: Pick<ForgeGitHubAuthState, 'hasPrivateRepoScope' | 'hasRepoScope'>
  isPrivate: boolean
}) {
  return isPrivate ? authState.hasPrivateRepoScope : authState.hasRepoScope
}

function filterFileTreeNodes(
  nodes: Array<FileTreeNode>,
  query: string,
): Array<FileTreeNode> {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return nodes
  }

  return nodes.flatMap((node) => filterFileTreeNode(node, normalizedQuery))
}

function filterFileTreeNode(
  node: FileTreeNode,
  normalizedQuery: string,
): Array<FileTreeNode> {
  const matchesSelf =
    node.name.toLowerCase().includes(normalizedQuery) ||
    node.path.toLowerCase().includes(normalizedQuery)

  if (node.type === 'file') {
    return matchesSelf ? [node] : []
  }

  if (matchesSelf) {
    return [node]
  }

  const filteredChildren =
    node.children?.flatMap((child) =>
      filterFileTreeNode(child, normalizedQuery),
    ) ?? []

  return filteredChildren.length > 0
    ? [
        {
          ...node,
          children: filteredChildren,
        },
      ]
    : []
}

function formatFileChangeStatus(status: ForgeManifestFileChange['status']) {
  switch (status) {
    case 'added':
      return 'A'
    case 'deleted':
      return 'D'
    case 'modified':
      return 'M'
  }
}

function fileChangeBadgeClassName(status: ForgeManifestFileChange['status']) {
  const base =
    'flex h-5 w-5 shrink-0 items-center justify-center rounded border font-mono text-[10px] font-semibold'

  switch (status) {
    case 'added':
      return `${base} border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300`
    case 'deleted':
      return `${base} border-red-500/30 bg-red-500/10 text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300`
    case 'modified':
      return `${base} border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300`
  }
}

function fileChangeDotClassName(status: ForgeManifestFileChange['status']) {
  const base =
    'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm font-mono text-[9px] font-semibold'

  switch (status) {
    case 'added':
      return `${base} bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300`
    case 'deleted':
      return `${base} bg-red-500/10 text-red-700 dark:bg-red-400/15 dark:text-red-300`
    case 'modified':
      return `${base} bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300`
  }
}

function diffLineClassName(
  kind: ForgeManifestFileChange['diffLines'][number]['kind'],
) {
  const base = 'flex min-w-max gap-3 px-4'

  switch (kind) {
    case 'added':
      return `${base} bg-emerald-500/10 text-emerald-950 dark:bg-emerald-400/10 dark:text-emerald-100`
    case 'deleted':
      return `${base} bg-red-500/10 text-red-950 dark:bg-red-400/10 dark:text-red-100`
    case 'context':
      return `${base} text-neutral-700 dark:text-neutral-400`
  }
}

function diffSignClassName(
  kind: ForgeManifestFileChange['diffLines'][number]['kind'],
) {
  switch (kind) {
    case 'added':
      return 'w-4 shrink-0 select-none text-emerald-700 dark:text-emerald-300'
    case 'deleted':
      return 'w-4 shrink-0 select-none text-red-700 dark:text-red-300'
    case 'context':
      return 'w-4 shrink-0 select-none text-neutral-400 dark:text-neutral-600'
  }
}

function diffLineSign(
  kind: ForgeManifestFileChange['diffLines'][number]['kind'],
) {
  switch (kind) {
    case 'added':
      return '+'
    case 'deleted':
      return '-'
    case 'context':
      return ' '
  }
}

function compactManifestId(manifestVersionId: string) {
  const prefix = 'local-manifest-sha256:'

  if (!manifestVersionId.startsWith(prefix)) {
    return manifestVersionId
  }

  return manifestVersionId.replace(prefix, 'sha256:').slice(0, 19)
}

function formatRunDuration(run: { endedAt?: string; startedAt?: string }) {
  if (!run.startedAt || !run.endedAt) {
    return 'running'
  }

  const durationMs =
    new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime()

  return formatDuration(durationMs)
}

function formatDuration(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return '0s'
  }

  const seconds = Math.round(durationMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes === 0) {
    return `${remainingSeconds}s`
  }

  return `${minutes}m ${remainingSeconds}s`
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes.toLocaleString()} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function textBytes(value: string) {
  return new TextEncoder().encode(value).length
}
