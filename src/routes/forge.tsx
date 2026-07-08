import { createFileRoute, useRouter } from '@tanstack/react-router'
import { fetchServerSentEvents, useChat } from '@tanstack/ai-react'
import type { StreamChunk } from '@tanstack/ai'
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
  Bug,
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
  Plus,
  RefreshCw,
  Search,
  Square,
  Trash2,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  isValidElement,
  useMemo,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type CSSProperties,
  type FormEvent,
  type HTMLProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
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
import { ForgeByokMenu } from '~/components/forge/ForgeByokMenu'
import { CodeBlock } from '~/components/markdown/CodeBlock'
import { getCodeBlockLanguageFromFilePath } from '~/components/markdown/codeBlock.shared'
import { InlineCode } from '~/ui/InlineCode'
import {
  cancelLocalForgeRun,
  getForgeRunConfig,
  getForgeChatShells,
  getLocalForgeSession,
  type ForgeBrowserProviderKey,
  type ForgeChatShell,
  validateLocalForgeWorkspace,
} from '~/utils/forge.functions'
import {
  applyForgeStateEvents,
  type ForgeStateEvent,
} from '~/utils/forge-state'
import {
  getForgeGitHubExportDisplayState,
  getForgeWorkflowStatusText,
  getLatestForgeGitHubExport,
} from '~/utils/forge-ui'
import {
  createForgeChatShellsCollection,
  createForgeProjectedStateEventsCollection,
  forgeChatShellsQueryKey,
  insertForgeProjectedStateEvents,
} from '~/utils/forge-collections'
import {
  subscribeForgePendingLaunchFailures,
  takeForgePendingLaunch,
  takeForgePendingLaunchFailure,
  writeForgePendingLaunchFailure,
  type ForgePendingLaunchFailure,
  type ForgePendingLaunch,
  type ForgePendingLaunchProviderKey,
} from '~/utils/forge-pending-launch'
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
type ForgeRightPanelMode = 'debug' | 'files' | 'preview' | 'source'
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
type ForgeDebugEventSource =
  | 'agent'
  | 'export'
  | 'manifest'
  | 'message'
  | 'run'
  | 'state'
  | 'stream'
  | 'warning'
  | 'workflow'
type ForgeDebugEvent = {
  createdAt?: string
  id: string
  name: string
  offset?: number
  payload: unknown
  source: ForgeDebugEventSource
  status?: string
  summary?: string
}
type ForgeDebugStreamEventsByChatId = Record<string, Array<ForgeStateEvent>>
type ForgeDebugClientStreamChunksByChatId = Record<
  string,
  Array<ForgeDebugClientStreamChunk>
>
type ForgeDebugClientStreamChunk = {
  chunk: StreamChunk
  createdAt: string
  id: string
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
type ForgeSessionMessage = ForgeSession['messages'][number]
type ForgeOptimisticMessagesByChatId = Record<
  string,
  Array<ForgeSessionMessage>
>
type ForgeAiChatRequestBody = {
  chatId: string
  clientRequestId: string
  previewUrl?: string
  prompt: string
  providerKey?: ForgeBrowserProviderKey | ForgePendingLaunchProviderKey
}
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
      kind: 'activeWork'
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
const FORGE_OPTIMISTIC_MESSAGE_ID_PREFIX = 'optimistic-message:'
const FORGE_PREVIEW_RECONNECT_IDLE_ATTEMPTS = 2
const FORGE_PREVIEW_RECONNECT_RUN_ATTEMPTS = 120
const FORGE_PREVIEW_RECONNECT_IDLE_RETRY_MS = 4_000
const FORGE_PREVIEW_RECONNECT_RUN_RETRY_MS = 1_500
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

function createForgeOptimisticUserMessage({
  clientRequestId,
  content,
  createdAt,
}: {
  clientRequestId: string
  content: string
  createdAt: string
}): ForgeSessionMessage {
  return {
    completedAt: createdAt,
    content,
    createdAt,
    id: `${FORGE_OPTIMISTIC_MESSAGE_ID_PREFIX}${clientRequestId}`,
    role: 'user',
    status: 'complete',
  }
}

function addForgeOptimisticMessage(
  current: ForgeOptimisticMessagesByChatId,
  chatId: string,
  message: ForgeSessionMessage,
): ForgeOptimisticMessagesByChatId {
  const messages = current[chatId] ?? []

  if (messages.some((currentMessage) => currentMessage.id === message.id)) {
    return current
  }

  return {
    ...current,
    [chatId]: [...messages, message],
  }
}

function removeForgeOptimisticMessage(
  current: ForgeOptimisticMessagesByChatId,
  chatId: string,
  messageId: string,
): ForgeOptimisticMessagesByChatId {
  const messages = current[chatId]

  if (!messages) {
    return current
  }

  const nextMessages = messages.filter((message) => message.id !== messageId)

  if (nextMessages.length === messages.length) {
    return current
  }

  if (nextMessages.length === 0) {
    const next = { ...current }
    delete next[chatId]
    return next
  }

  return {
    ...current,
    [chatId]: nextMessages,
  }
}

function removeFulfilledForgeOptimisticMessages(
  current: ForgeOptimisticMessagesByChatId,
  chatId: string,
  session: ForgeSession,
): ForgeOptimisticMessagesByChatId {
  const messages = current[chatId]

  if (!messages) {
    return current
  }

  const nextMessages = messages.filter(
    (message) => !isForgeOptimisticMessageFulfilled(session.messages, message),
  )

  if (nextMessages.length === messages.length) {
    return current
  }

  if (nextMessages.length === 0) {
    const next = { ...current }
    delete next[chatId]
    return next
  }

  return {
    ...current,
    [chatId]: nextMessages,
  }
}

function mergeForgeOptimisticMessages(
  session: ForgeSession,
  optimisticMessages: Array<ForgeSessionMessage> | undefined,
): ForgeSession {
  if (!optimisticMessages?.length) {
    return session
  }

  const pendingMessages = optimisticMessages.filter((message) => {
    return (
      !session.messages.some(
        (currentMessage) => currentMessage.id === message.id,
      ) && !isForgeOptimisticMessageFulfilled(session.messages, message)
    )
  })

  if (pendingMessages.length === 0) {
    return session
  }

  return {
    ...session,
    messages: [...session.messages, ...pendingMessages],
  }
}

function isForgeOptimisticMessage(message: ForgeSessionMessage) {
  return message.id.startsWith(FORGE_OPTIMISTIC_MESSAGE_ID_PREFIX)
}

function isForgeOptimisticMessageFulfilled(
  messages: Array<ForgeSessionMessage>,
  optimisticMessage: ForgeSessionMessage,
) {
  if (!isForgeOptimisticMessage(optimisticMessage)) {
    return false
  }

  const optimisticCreatedAt = Date.parse(optimisticMessage.createdAt)
  const minimumCreatedAt = Number.isFinite(optimisticCreatedAt)
    ? optimisticCreatedAt - 1000
    : 0

  return messages.some((message) => {
    const messageCreatedAt = Date.parse(message.createdAt)

    return (
      !isForgeOptimisticMessage(message) &&
      message.role === optimisticMessage.role &&
      message.content === optimisticMessage.content &&
      Number.isFinite(messageCreatedAt) &&
      messageCreatedAt >= minimumCreatedAt
    )
  })
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

function applyPendingForgeLaunch(
  session: ForgeSession,
  launch: ForgePendingLaunch,
): ForgeSession {
  if (session.activeChatId !== launch.chatId) {
    return session
  }

  const title = launch.prompt.trim().replace(/\s+/g, ' ').slice(0, 64)
  const latestRun = isActiveForgeRunStatus(session.latestRun?.status)
    ? session.latestRun
    : {
        createdAt: launch.createdAt,
        id: launch.clientRequestId,
        startedAt: launch.createdAt,
        status: 'running',
      }

  return {
    ...session,
    chats: session.chats.map((chat) =>
      chat.id === launch.chatId
        ? {
            ...chat,
            title: title || chat.title,
            updatedAt: launch.createdAt,
          }
        : chat,
    ),
    latestRun,
  }
}

function applyPendingForgeLaunchFailure(
  session: ForgeSession,
  failure: ForgePendingLaunchFailure,
): ForgeSession {
  if (
    session.activeChatId !== failure.chatId ||
    session.latestRun?.id !== failure.clientRequestId
  ) {
    return session
  }

  return {
    ...session,
    latestRun: undefined,
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

const EMPTY_FORGE_CHAT_SHELLS = {
  activeChatId: undefined,
  chats: Array<ForgeRouteChat>(),
  runRequiresProviderKey: true,
} satisfies {
  activeChatId?: string
  chats: Array<ForgeRouteChat>
  runRequiresProviderKey: boolean
}

export const Route = createFileRoute('/forge')({
  head: () => ({
    meta: seo({
      title: 'TanStack Forge',
      description: 'Build TanStack apps with a local agent loop harness.',
    }),
  }),
  validateSearch: forgeSearchSchema,
  shouldReload: false,
  component: ForgeRoute,
})

function ForgeRoute() {
  const initialChatShells = EMPTY_FORGE_CHAT_SHELLS
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const initialChatId = resolveForgeChatId({
    activeChatId: initialChatShells.activeChatId,
    chats: initialChatShells.chats,
    requestedChatId: search.chatId,
  })
  const sessionCacheRef = useRef(new Map<string, ForgeSession>())
  const pendingLaunchesRef = useRef(new Map<string, ForgePendingLaunch>())
  const startedPendingLaunchIdsRef = useRef(new Set<string>())
  const [selectedChatId, setSelectedChatId] = useState(initialChatId)
  const [session, setSession] = useState(() =>
    createPendingForgeSession({
      chatId: initialChatId,
      chats: initialChatShells.chats,
    }),
  )
  const [prompt, setPrompt] = useState('')
  const [browserProviderKey, setBrowserProviderKey] =
    useState<ForgeBrowserProviderKey>()
  const [runError, setRunError] = useState<string | null>(null)
  const [optimisticMessagesByChatId, setOptimisticMessagesByChatId] =
    useState<ForgeOptimisticMessagesByChatId>({})
  const [showLogEvents, setShowLogEvents] = useState(false)
  const [openTranscriptItemIds, setOpenTranscriptItemIds] = useState<
    Record<string, boolean>
  >({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
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
  const [runRequiresProviderKey, setRunRequiresProviderKey] = useState<boolean>(
    initialChatShells.runRequiresProviderKey,
  )
  const [selectedFile, setSelectedFile] = useState<string | undefined>()
  const [fileFilter, setFileFilter] = useState('')
  const [rightPanelMode, setRightPanelMode] =
    useState<ForgeRightPanelMode>('preview')
  const [debugFilter, setDebugFilter] = useState('')
  const [selectedDebugEventId, setSelectedDebugEventId] = useState<string>()
  const [debugStreamEventsByChatId, setDebugStreamEventsByChatId] =
    useState<ForgeDebugStreamEventsByChatId>({})
  const [debugClientStreamChunksByChatId, setDebugClientStreamChunksByChatId] =
    useState<ForgeDebugClientStreamChunksByChatId>({})
  const [previewReconnectCheckingChatIds, setPreviewReconnectCheckingChatIds] =
    useState<Record<string, boolean>>({})
  const [freshPreviewUrlsByChatId, setFreshPreviewUrlsByChatId] = useState<
    Record<string, string>
  >({})
  const [lastKnownPreviewUrlsByChatId, setLastKnownPreviewUrlsByChatId] =
    useState<Record<string, string>>({})
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
  const forgeAiChatRequestRef = useRef<ForgeAiChatRequestBody | undefined>(
    undefined,
  )
  const previewReconnectAttemptKeysRef = useRef(new Set<string>())
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
  useEffect(() => {
    let cancelled = false

    void getForgeRunConfig()
      .then((config) => {
        if (!cancelled) {
          setRunRequiresProviderKey(config?.runRequiresProviderKey ?? true)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRunError(
            error instanceof Error
              ? error.message
              : 'Forge run settings could not load.',
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [])
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
  const forgeAiChatId = streamChatId
    ? `forge-chat:${streamChatId}`
    : 'forge-chat:pending'
  const projectedStateEventsCollection = useMemo(
    () => createForgeProjectedStateEventsCollection(streamChatId),
    [streamChatId],
  )
  const preservePendingLaunch = useCallback((nextSession: ForgeSession) => {
    const pendingLaunch = pendingLaunchesRef.current.get(
      nextSession.activeChatId,
    )

    if (!pendingLaunch) {
      return nextSession
    }

    if (nextSession.latestRun) {
      pendingLaunchesRef.current.delete(nextSession.activeChatId)
      return nextSession
    }

    return applyPendingForgeLaunch(nextSession, pendingLaunch)
  }, [])
  const applyForgeLiveStateBatch = useCallback(
    (chatId: string, batch: ForgeStateBatchStreamEvent) => {
      insertForgeProjectedStateEvents(
        projectedStateEventsCollection,
        chatId,
        batch.events,
      )
      setDebugStreamEventsByChatId((current) =>
        appendForgeDebugStreamEvents(current, chatId, batch.events),
      )
      setSession((currentSession) => {
        if (currentSession.activeChatId !== chatId) {
          return currentSession
        }

        const nextSession = applyForgeStateEvents(currentSession, batch.events)

        sessionCacheRef.current.set(nextSession.activeChatId, nextSession)

        return nextSession
      })
    },
    [projectedStateEventsCollection],
  )
  const applyForgeLiveSnapshot = useCallback(
    (chatId: string, nextSession: ForgeSession) => {
      if (nextSession.activeChatId !== chatId) {
        return
      }

      const visibleSession = preservePendingLaunch(nextSession)

      sessionCacheRef.current.set(visibleSession.activeChatId, visibleSession)
      setSession(visibleSession)
    },
    [preservePendingLaunch],
  )
  const forgeAiChatConnection = useMemo(
    () =>
      fetchServerSentEvents('/api/forge/chat', () => ({
        body: forgeAiChatRequestRef.current ?? {},
      })),
    [],
  )
  const forgeAiChat = useChat({
    connection: forgeAiChatConnection,
    id: forgeAiChatId,
    onCustomEvent: (eventType, data) => {
      const request = forgeAiChatRequestRef.current

      if (!request) {
        return
      }

      if (eventType === 'forge.state-batch') {
        const batch = readForgeStateBatchStreamValue(data)

        if (batch) {
          applyForgeLiveStateBatch(request.chatId, batch)
        }
      } else if (eventType === 'forge.snapshot') {
        const nextSession = readForgeSnapshotStreamValue(data)

        if (nextSession) {
          applyForgeLiveSnapshot(request.chatId, nextSession)
        }
      }
    },
    onChunk: (chunk) => {
      const request = forgeAiChatRequestRef.current

      if (!request) {
        return
      }

      setDebugClientStreamChunksByChatId((current) =>
        appendForgeDebugClientStreamChunk(current, request.chatId, chunk),
      )
    },
    onError: (error) => {
      setRunError(error.message)
    },
    threadId: streamChatId,
  })
  const liveSidebarChats =
    chatShellsQuery.isReady && chatShellsQuery.data !== undefined
      ? chatShellsQuery.data
      : initialChatShells.chats
  const sidebarChats = useMemo(() => {
    if (
      !selectedChatId ||
      liveSidebarChats.some((chat) => chat.id === selectedChatId)
    ) {
      return liveSidebarChats
    }

    const selectedChat =
      session.chats.find((chat) => chat.id === selectedChatId) ??
      initialChatShells.chats.find((chat) => chat.id === selectedChatId)

    return selectedChat ? [selectedChat, ...liveSidebarChats] : liveSidebarChats
  }, [initialChatShells.chats, liveSidebarChats, selectedChatId, session.chats])
  const selectedSidebarChatId = selectedChatId
  const latestRun = session.latestRun
  const sandboxPreviewEvents = useMemo(
    () => [...session.agentEvents, ...session.workflowEvents],
    [session.agentEvents, session.workflowEvents],
  )
  const sandboxPreviewUrl = useMemo(
    () => readLatestForgeSandboxPreviewUrl(sandboxPreviewEvents),
    [sandboxPreviewEvents],
  )
  const sandboxPreviewFailure = useMemo(
    () => readLatestForgeSandboxPreviewFailure(sandboxPreviewEvents),
    [sandboxPreviewEvents],
  )
  const freshSandboxPreviewUrl = selectedChatId
    ? freshPreviewUrlsByChatId[selectedChatId]
    : undefined
  const lastKnownSandboxPreviewUrl = selectedChatId
    ? lastKnownPreviewUrlsByChatId[selectedChatId]
    : undefined
  const displayedSandboxPreviewUrl =
    freshSandboxPreviewUrl ?? sandboxPreviewUrl ?? lastKnownSandboxPreviewUrl
  const existingSandboxPreviewUrl =
    displayedSandboxPreviewUrl &&
    !isLocalForgeQuickTunnelPreviewUrl(displayedSandboxPreviewUrl)
      ? displayedSandboxPreviewUrl
      : undefined
  const previewReconnectIsChecking = selectedChatId
    ? previewReconnectCheckingChatIds[selectedChatId] === true
    : false
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
  const activeOptimisticMessages =
    optimisticMessagesByChatId[session.activeChatId]
  const transcriptSession = useMemo(
    () => mergeForgeOptimisticMessages(session, activeOptimisticMessages),
    [activeOptimisticMessages, session],
  )
  const transcriptItems = useMemo(
    () => createForgeTranscriptItems(transcriptSession),
    [transcriptSession],
  )
  const manifestShortId = session.manifestVersionId
    ? compactManifestId(session.manifestVersionId)
    : 'No manifest'
  const latestGitHubExport = useMemo(
    () => getLatestForgeGitHubExport(session.exports),
    [session.exports],
  )
  const debugStreamEvents =
    debugStreamEventsByChatId[session.activeChatId] ?? []
  const debugClientStreamChunks =
    debugClientStreamChunksByChatId[session.activeChatId] ?? []
  const debugEvents = useMemo(
    () =>
      createForgeDebugEvents({
        clientStreamChunks: debugClientStreamChunks,
        session,
        streamEvents: debugStreamEvents,
      }),
    [debugClientStreamChunks, debugStreamEvents, session],
  )
  const selectedDebugEvent =
    debugEvents.find((event) => event.id === selectedDebugEventId) ??
    debugEvents[0]
  const isMissingRequiredProviderKey =
    runRequiresProviderKey && !browserProviderKey
  const hasActiveChat = session.activeChatId.length > 0
  const persistedRunIsActive =
    latestRun?.status === 'queued' ||
    latestRun?.status === 'starting' ||
    latestRun?.status === 'running' ||
    latestRun?.status === 'paused' ||
    latestRun?.status === 'finishing'
  const canStartRun =
    hasActiveChat &&
    !isSubmitting &&
    !isValidating &&
    !isExportingGitHub &&
    !persistedRunIsActive
  const canRun =
    prompt.trim().length > 0 && canStartRun && !isMissingRequiredProviderKey
  const canValidate = Boolean(session.manifestVersionId) && canStartRun
  const canExportGitHub =
    Boolean(session.manifestVersionId) &&
    githubAuthState?.authenticated === true &&
    githubAuthState.hasGitHubAccount &&
    hasRequiredGitHubRepoScope({
      authState: githubAuthState,
      isPrivate: githubIsPrivate,
    }) &&
    githubRepoNameValidation.valid &&
    canStartRun
  const canManageChats = canStartRun
  useEffect(() => {
    const nextPreviewUrl = freshSandboxPreviewUrl ?? sandboxPreviewUrl

    if (!selectedChatId || !nextPreviewUrl) {
      return
    }

    setLastKnownPreviewUrlsByChatId((current) =>
      current[selectedChatId] === nextPreviewUrl
        ? current
        : {
            ...current,
            [selectedChatId]: nextPreviewUrl,
          },
    )
  }, [freshSandboxPreviewUrl, sandboxPreviewUrl, selectedChatId])

  useEffect(() => {
    const previewNeedsReconnect = shouldReconnectForgeSandboxPreviewUrl({
      latestRun,
      previewUrl: displayedSandboxPreviewUrl,
    })

    if (!selectedChatId || !previewNeedsReconnect) {
      return
    }

    const reconnectKey = displayedSandboxPreviewUrl
      ? [
          selectedChatId,
          'existing-preview-url',
          displayedSandboxPreviewUrl,
        ].join(':')
      : [selectedChatId, latestRun?.id ?? 'no-run', 'no-preview-url'].join(':')

    if (previewReconnectAttemptKeysRef.current.has(reconnectKey)) {
      return
    }

    previewReconnectAttemptKeysRef.current.add(reconnectKey)

    let cancelled = false
    let reconnectTimer: number | undefined
    let attempt = 0
    const activeRun = isActiveForgeRunStatus(latestRun?.status)
    const maxAttempts = activeRun
      ? FORGE_PREVIEW_RECONNECT_RUN_ATTEMPTS
      : FORGE_PREVIEW_RECONNECT_IDLE_ATTEMPTS
    const retryMs = activeRun
      ? FORGE_PREVIEW_RECONNECT_RUN_RETRY_MS
      : FORGE_PREVIEW_RECONNECT_IDLE_RETRY_MS

    setPreviewReconnectCheckingChatIds((current) =>
      setForgePreviewReconnectChecking(current, selectedChatId, true),
    )

    async function attemptReconnect() {
      attempt += 1
      let reconnectError: unknown

      try {
        const reconnectResult =
          await reconnectForgeSandboxPreviewUrl(selectedChatId)
        const recoveredPreviewUrl =
          !activeRun &&
          reconnectResult.reason === 'port-closed' &&
          attempt >= maxAttempts
            ? (
                await reconnectForgeSandboxPreviewUrl(selectedChatId, {
                  mode: 'restart',
                })
              ).url
            : undefined
        const previewUrl = reconnectResult.url ?? recoveredPreviewUrl

        if (previewUrl) {
          setFreshPreviewUrlsByChatId((current) =>
            current[selectedChatId] === previewUrl
              ? current
              : {
                  ...current,
                  [selectedChatId]: previewUrl,
                },
          )

          const eventId = `preview-reconnect-${crypto.randomUUID()}`

          setSession((current) =>
            current.activeChatId === selectedChatId &&
            readLatestForgeSandboxPreviewUrl([
              ...current.agentEvents,
              ...current.workflowEvents,
            ]) !== previewUrl
              ? {
                  ...current,
                  workflowEvents: [
                    ...current.workflowEvents,
                    {
                      createdAt: new Date().toISOString(),
                      detail: previewUrl,
                      id: eventId,
                      message: 'Sandbox preview reconnected',
                      name: 'workflow.preview.reconnected',
                      producerId: 'forge-preview',
                      runId: eventId,
                      status: 'finished',
                    },
                  ],
                }
              : current,
          )

          setPreviewReconnectCheckingChatIds((current) =>
            setForgePreviewReconnectChecking(current, selectedChatId, false),
          )
          return
        }
      } catch (error) {
        reconnectError = error
      }

      if (cancelled) {
        return
      }

      if (attempt < maxAttempts) {
        reconnectTimer = window.setTimeout(attemptReconnect, retryMs)
        return
      }

      if (reconnectError) {
        const eventId = `preview-reconnect-${crypto.randomUUID()}`
        const message =
          reconnectError instanceof Error
            ? reconnectError.message
            : 'Forge sandbox preview reconnect failed.'

        setSession((current) =>
          current.activeChatId === selectedChatId
            ? {
                ...current,
                workflowEvents: [
                  ...current.workflowEvents,
                  {
                    createdAt: new Date().toISOString(),
                    detail: message,
                    id: eventId,
                    message: 'Sandbox preview reconnect failed',
                    name: 'workflow.preview.reconnect.failed',
                    producerId: 'forge-preview',
                    runId: eventId,
                    status: 'failed',
                  },
                ],
              }
            : current,
        )
      }

      setPreviewReconnectCheckingChatIds((current) =>
        setForgePreviewReconnectChecking(current, selectedChatId, false),
      )
    }

    void attemptReconnect()

    return () => {
      cancelled = true
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer)
      }
      setPreviewReconnectCheckingChatIds((current) =>
        setForgePreviewReconnectChecking(current, selectedChatId, false),
      )
    }
  }, [
    displayedSandboxPreviewUrl,
    latestRun?.id,
    latestRun?.status,
    selectedChatId,
  ])
  const statusText = getForgeWorkflowStatusText({
    isExportingGitHub,
    isValidating,
    isSubmitting,
    latestRunStatus: latestRun?.status,
  })
  const missingProviderKeyText =
    'Add a Forge provider key before starting a run.'
  const composerStatusText =
    runError ??
    (isMissingRequiredProviderKey ? missingProviderKeyText : statusText)
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
      activeChatId: initialChatShells.activeChatId,
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
    initialChatShells.activeChatId,
    navigate,
    search.chatId,
    selectedChatId,
    sidebarChats,
  ])

  useEffect(() => {
    const chatId = selectedChatId

    if (!chatId) {
      return
    }

    const pendingLaunch = takeForgePendingLaunch(chatId)

    if (!pendingLaunch) {
      return
    }

    const optimisticMessage = createForgeOptimisticUserMessage({
      clientRequestId: pendingLaunch.clientRequestId,
      content: pendingLaunch.prompt,
      createdAt: pendingLaunch.createdAt,
    })

    setOptimisticMessagesByChatId((current) =>
      addForgeOptimisticMessage(current, chatId, optimisticMessage),
    )
    pendingLaunchesRef.current.set(chatId, pendingLaunch)
    setSession((currentSession) => {
      const nextSession = applyPendingForgeLaunch(currentSession, pendingLaunch)

      sessionCacheRef.current.set(nextSession.activeChatId, nextSession)

      return nextSession
    })

    const pendingLaunchId = `${chatId}:${pendingLaunch.clientRequestId}`

    if (startedPendingLaunchIdsRef.current.has(pendingLaunchId)) {
      return
    }

    startedPendingLaunchIdsRef.current.add(pendingLaunchId)

    const providerKey = pendingLaunch.providerKey ?? browserProviderKey
    forgeAiChatRequestRef.current = {
      chatId,
      clientRequestId: pendingLaunch.clientRequestId,
      ...(existingSandboxPreviewUrl
        ? { previewUrl: existingSandboxPreviewUrl }
        : {}),
      prompt: pendingLaunch.prompt,
      ...(providerKey ? { providerKey } : {}),
    }

    void forgeAiChat
      .sendMessage(pendingLaunch.prompt)
      .then(async () => {
        const nextSession = sessionCacheRef.current.get(chatId)

        pendingLaunchesRef.current.delete(chatId)

        if (nextSession) {
          setOptimisticMessagesByChatId((current) =>
            removeFulfilledForgeOptimisticMessages(
              current,
              chatId,
              nextSession,
            ),
          )
        }

        await queryClient.invalidateQueries({
          queryKey: forgeChatShellsQueryKey,
        })
        await router.invalidate()
      })
      .catch((launchError: unknown) => {
        writeForgePendingLaunchFailure({
          chatId,
          clientRequestId: pendingLaunch.clientRequestId,
          createdAt: new Date().toISOString(),
          message:
            launchError instanceof Error
              ? launchError.message
              : 'Forge run failed to start.',
          prompt: pendingLaunch.prompt,
        })
      })
  }, [
    browserProviderKey,
    existingSandboxPreviewUrl,
    forgeAiChat,
    queryClient,
    router,
    selectedChatId,
  ])

  useEffect(() => {
    const chatId = selectedChatId

    if (!chatId) {
      return
    }

    function handlePendingLaunchFailure(failure: ForgePendingLaunchFailure) {
      if (failure.chatId !== chatId) {
        return
      }

      const optimisticMessageId = `${FORGE_OPTIMISTIC_MESSAGE_ID_PREFIX}${failure.clientRequestId}`

      setRunError(failure.message)
      setPrompt(failure.prompt)
      pendingLaunchesRef.current.delete(failure.chatId)
      setOptimisticMessagesByChatId((current) =>
        removeForgeOptimisticMessage(
          current,
          failure.chatId,
          optimisticMessageId,
        ),
      )
      setSession((currentSession) => {
        const nextSession = applyPendingForgeLaunchFailure(
          currentSession,
          failure,
        )

        sessionCacheRef.current.set(nextSession.activeChatId, nextSession)

        return nextSession
      })
      void queryClient.invalidateQueries({ queryKey: forgeChatShellsQueryKey })
    }

    const pendingFailure = takeForgePendingLaunchFailure(chatId)

    if (pendingFailure) {
      handlePendingLaunchFailure(pendingFailure)
    }

    return subscribeForgePendingLaunchFailures(handlePendingLaunchFailure)
  }, [queryClient, selectedChatId])

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

        const visibleSession = preservePendingLaunch(
          requireForgeSession(nextSession),
        )

        sessionCacheRef.current.set(visibleSession.activeChatId, visibleSession)
        setSession(visibleSession)
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
  }, [preservePendingLaunch, selectedChatId])

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
    if (!activeOptimisticMessages?.length) {
      return
    }

    const remainingMessages = activeOptimisticMessages.filter(
      (message) =>
        !isForgeOptimisticMessageFulfilled(session.messages, message),
    )

    if (remainingMessages.length === activeOptimisticMessages.length) {
      return
    }

    setOptimisticMessagesByChatId((current) => {
      if (current[session.activeChatId] !== activeOptimisticMessages) {
        return current
      }

      if (remainingMessages.length === 0) {
        const next = { ...current }
        delete next[session.activeChatId]
        return next
      }

      return {
        ...current,
        [session.activeChatId]: remainingMessages,
      }
    })
  }, [activeOptimisticMessages, session.activeChatId, session.messages])

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
        const visibleSession = preservePendingLaunch(nextSession)

        sessionCacheRef.current.set(visibleSession.activeChatId, visibleSession)
        setSession(visibleSession)
      }
    }

    function handleStateBatch(event: Event) {
      if (!(event instanceof MessageEvent) || typeof event.data !== 'string') {
        return
      }

      const batch = parseForgeStateBatchEvent(event.data)

      if (batch) {
        applyForgeLiveStateBatch(chatId, batch)
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
  }, [applyForgeLiveStateBatch, preservePendingLaunch, streamChatId])

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

  async function submitForgePrompt(promptText: string) {
    const trimmedPrompt = promptText.trim()

    if (!trimmedPrompt) {
      return
    }

    if (isMissingRequiredProviderKey) {
      setRunError(missingProviderKeyText)
      return
    }

    if (!canStartRun) {
      setPrompt(trimmedPrompt)
      promptTextareaRef.current?.focus()
      return
    }

    setIsSubmitting(true)
    setRunError(null)
    const clientRequestId = `forge-request-${crypto.randomUUID()}`
    const createdAt = new Date().toISOString()
    const optimisticMessage = createForgeOptimisticUserMessage({
      clientRequestId,
      content: trimmedPrompt,
      createdAt,
    })
    const chatId = session.activeChatId
    const pendingLaunch: ForgePendingLaunch = {
      chatId,
      clientRequestId,
      createdAt,
      prompt: trimmedPrompt,
    }

    setOptimisticMessagesByChatId((current) =>
      addForgeOptimisticMessage(current, chatId, optimisticMessage),
    )
    pendingLaunchesRef.current.set(chatId, pendingLaunch)
    setSession((currentSession) => {
      const nextSession = applyPendingForgeLaunch(currentSession, pendingLaunch)

      sessionCacheRef.current.set(nextSession.activeChatId, nextSession)

      return nextSession
    })
    setPrompt('')

    try {
      forgeAiChatRequestRef.current = {
        chatId,
        clientRequestId,
        ...(existingSandboxPreviewUrl
          ? { previewUrl: existingSandboxPreviewUrl }
          : {}),
        prompt: trimmedPrompt,
        ...(browserProviderKey ? { providerKey: browserProviderKey } : {}),
      }

      await forgeAiChat.sendMessage(trimmedPrompt)

      const nextSession = sessionCacheRef.current.get(chatId)
      pendingLaunchesRef.current.delete(chatId)

      if (nextSession) {
        setOptimisticMessagesByChatId((current) =>
          removeFulfilledForgeOptimisticMessages(current, chatId, nextSession),
        )
      }

      await queryClient.invalidateQueries({ queryKey: forgeChatShellsQueryKey })
      await router.invalidate()
    } catch (error) {
      setOptimisticMessagesByChatId((current) =>
        removeForgeOptimisticMessage(current, chatId, optimisticMessage.id),
      )
      pendingLaunchesRef.current.delete(chatId)
      setSession((currentSession) => {
        if (
          currentSession.activeChatId !== chatId ||
          currentSession.latestRun?.id !== clientRequestId
        ) {
          return currentSession
        }

        const nextSession = {
          ...currentSession,
          latestRun: undefined,
        }

        sessionCacheRef.current.set(nextSession.activeChatId, nextSession)

        return nextSession
      })
      setPrompt(trimmedPrompt)
      setRunError(
        error instanceof Error ? error.message : 'Forge run failed to start.',
      )
      await router.invalidate()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await submitForgePrompt(prompt)
  }

  async function handleCancelRun() {
    const chatId = selectedChatId

    if (!chatId || isCancelling) {
      return
    }

    setIsCancelling(true)
    setRunError(null)

    try {
      const nextSession = await cancelLocalForgeRun({ data: { chatId } })
      pendingLaunchesRef.current.delete(chatId)
      setSession(nextSession)
      setOptimisticMessagesByChatId((current) =>
        removeFulfilledForgeOptimisticMessages(current, chatId, nextSession),
      )
      await queryClient.invalidateQueries({ queryKey: forgeChatShellsQueryKey })
      await router.invalidate()
    } catch (error) {
      setRunError(
        error instanceof Error ? error.message : 'Failed to cancel the run.',
      )
    } finally {
      setIsCancelling(false)
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
                disabled={isMissingRequiredProviderKey}
                onChange={(event) => setPrompt(event.currentTarget.value)}
                placeholder={
                  isMissingRequiredProviderKey
                    ? 'Add a provider key to start'
                    : 'Ask Forge to change the app'
                }
                ref={promptTextareaRef}
                value={prompt}
              />
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 px-2 text-xs text-neutral-500 dark:text-neutral-500">
                  <ForgeByokMenu
                    disabled={isSubmitting}
                    onProviderKeyChange={(key) => {
                      setBrowserProviderKey(key)
                      if (key && runError === missingProviderKeyText) {
                        setRunError(null)
                      }
                    }}
                    providerKey={browserProviderKey}
                    required={runRequiresProviderKey}
                  />
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      streamStatus === 'live'
                        ? 'bg-emerald-400'
                        : 'bg-neutral-400 dark:bg-neutral-600'
                    }`}
                  />
                  <span
                    className={`truncate ${
                      runError ? 'text-red-600 dark:text-red-300' : ''
                    }`}
                  >
                    {composerStatusText}
                  </span>
                  <span className="hidden rounded border border-neutral-200 px-1.5 py-0.5 font-mono text-[11px] text-neutral-500 dark:border-white/10 dark:text-neutral-600 sm:inline">
                    {manifestShortId}
                  </span>
                </div>
                {persistedRunIsActive ? (
                  <button
                    className={sendButtonClassName(!isCancelling)}
                    disabled={isCancelling}
                    onClick={handleCancelRun}
                    title="Stop run"
                    type="button"
                  >
                    {isCancelling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {isCancelling ? 'Stopping' : 'Stop run'}
                    </span>
                  </button>
                ) : (
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
                )}
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
            <button
              className={rightPanelModeButtonClassName(
                rightPanelMode === 'debug',
              )}
              onClick={() => setRightPanelMode('debug')}
              type="button"
            >
              <Bug className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-500" />
              <span className="truncate">Debug</span>
            </button>
          </div>

          {hasMountedPreviewPanel ? (
            <div
              className={`h-full min-h-0 ${
                rightPanelMode === 'preview' ? 'block' : 'hidden'
              }`}
            >
              {displayedSandboxPreviewUrl ? (
                <ForgeSandboxPreviewFrame
                  key={selectedChatId}
                  previewUrl={displayedSandboxPreviewUrl}
                />
              ) : (
                <ForgeSandboxPreviewWaiting
                  checking={previewReconnectIsChecking}
                  failure={sandboxPreviewFailure}
                  latestRun={latestRun}
                />
              )}
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

          {rightPanelMode === 'debug' ? (
            <ForgeDebugPanel
              events={debugEvents}
              filter={debugFilter}
              onFilterChange={setDebugFilter}
              onSelectedEventChange={setSelectedDebugEventId}
              selectedEvent={selectedDebugEvent}
              session={session}
              streamStatus={streamStatus}
            />
          ) : null}

          {rightPanelMode === 'files' ? (
            <div className="grid min-h-0">
              <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(300px,38%)]">
                <div className="order-2 grid min-h-0 grid-rows-[auto_1fr] border-l border-neutral-200 bg-white text-neutral-900 dark:border-white/10 dark:bg-[#151515] dark:text-neutral-200">
                  <div className="px-2.5 pb-2 pt-2.5">
                    <label className="relative block">
                      <Search
                        aria-hidden="true"
                        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400 dark:text-neutral-500"
                      />
                      <input
                        aria-label="Filter files"
                        className="h-8 w-full rounded-lg border border-neutral-200 bg-white pl-8 pr-2.5 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/10 dark:border-white/10 dark:bg-[#1f1f1f] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-sky-400/40"
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
                        <div className="px-2 py-2 text-xs text-neutral-500">
                          No matching files.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="px-4 py-2 text-xs text-neutral-500">
                      No files yet.
                    </div>
                  )}
                </div>

                <div className="order-1 grid min-h-0 grid-rows-[40px_1fr_140px]">
                  <div className="flex min-w-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-white/10">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="min-w-0 truncate font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
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
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-500">
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
                    <div className="border-b border-neutral-200 px-4 py-1.5 text-[11px] font-medium text-neutral-600 dark:border-white/10 dark:text-neutral-400">
                      Warnings
                    </div>
                    <div className="whitespace-pre-wrap px-4 py-2.5 text-[11px] leading-5 text-neutral-500 dark:text-neutral-500">
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

function ForgeDebugPanel({
  events,
  filter,
  onFilterChange,
  onSelectedEventChange,
  selectedEvent,
  session,
  streamStatus,
}: {
  events: Array<ForgeDebugEvent>
  filter: string
  onFilterChange: (value: string) => void
  onSelectedEventChange: (eventId: string) => void
  selectedEvent?: ForgeDebugEvent
  session: ForgeSession
  streamStatus: ForgeStreamStatus
}) {
  const filteredEvents = useMemo(
    () => filterForgeDebugEvents(events, filter),
    [events, filter],
  )
  const selectedPayload = selectedEvent
    ? stringifyForgeDebugPayload(selectedEvent.payload)
    : 'No event selected'

  return (
    <div className="grid min-h-0 grid-rows-[auto_1fr] bg-neutral-50 text-neutral-950 dark:bg-[#101010] dark:text-neutral-100">
      <div className="border-b border-neutral-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#151515]">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bug className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
              <span>Loop debug</span>
            </div>
            <div className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-500">
              Raw session, harness, workflow, and stream projection events.
            </div>
          </div>
          <span className={debugStreamStatusClassName(streamStatus)}>
            {streamStatus}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          <DebugStat label="Events" value={events.length.toLocaleString()} />
          <DebugStat
            label="State"
            value={session.stateEventCount.toLocaleString()}
          />
          <DebugStat
            label="Timeline"
            value={session.timelineEventCount.toLocaleString()}
          />
          <DebugStat
            label="Manifest"
            value={
              session.manifestVersionId
                ? compactManifestId(session.manifestVersionId)
                : 'none'
            }
          />
        </div>

        <label className="relative mt-3 block">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400 dark:text-neutral-500"
          />
          <input
            aria-label="Filter debug events"
            className="h-8 w-full rounded-lg border border-neutral-200 bg-white pl-8 pr-2.5 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/10 dark:border-white/10 dark:bg-[#202020] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-sky-400/40"
            onChange={(event) => onFilterChange(event.currentTarget.value)}
            placeholder="Filter source, name, status, payload..."
            type="search"
            value={filter}
          />
        </label>
      </div>

      <div className="grid min-h-0 grid-cols-[minmax(220px,36%)_minmax(0,1fr)]">
        <div className="min-h-0 overflow-auto border-r border-neutral-200 bg-white dark:border-white/10 dark:bg-[#151515]">
          {filteredEvents.length > 0 ? (
            <div className="divide-y divide-neutral-100 dark:divide-white/[0.06]">
              {filteredEvents.map((event) => (
                <button
                  className={debugEventRowClassName(
                    event.id === selectedEvent?.id,
                  )}
                  key={event.id}
                  onClick={() => onSelectedEventChange(event.id)}
                  type="button"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={debugSourceBadgeClassName(event.source)}>
                      {event.source}
                    </span>
                    {event.status ? (
                      <span className="truncate text-[11px] text-neutral-500 dark:text-neutral-500">
                        {event.status}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-neutral-900 dark:text-neutral-100">
                    {event.name}
                  </div>
                  <div className="mt-1 flex min-w-0 items-center justify-between gap-2 text-[11px] text-neutral-500 dark:text-neutral-500">
                    <span className="truncate">
                      {event.summary ?? event.id}
                    </span>
                    <span className="shrink-0">
                      {formatForgeDebugEventMeta(event)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-500">
              No matching debug events.
            </div>
          )}
        </div>

        <div className="grid min-h-0 grid-rows-[auto_1fr] bg-neutral-50 dark:bg-[#101010]">
          <div className="border-b border-neutral-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#151515]">
            {selectedEvent ? (
              <>
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={debugSourceBadgeClassName(selectedEvent.source)}
                  >
                    {selectedEvent.source}
                  </span>
                  <span className="min-w-0 truncate font-mono text-xs font-semibold">
                    {selectedEvent.name}
                  </span>
                </div>
                <div className="mt-1 truncate text-[11px] text-neutral-500 dark:text-neutral-500">
                  {selectedEvent.id}
                </div>
              </>
            ) : (
              <div className="text-xs text-neutral-500 dark:text-neutral-500">
                Select an event.
              </div>
            )}
          </div>
          <pre className="min-h-0 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[11px] leading-5 text-neutral-700 dark:text-neutral-300">
            {selectedPayload}
          </pre>
        </div>
      </div>
    </div>
  )
}

function DebugStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="truncate text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-500">
        {label}
      </div>
      <div className="mt-0.5 truncate font-mono text-xs text-neutral-900 dark:text-neutral-100">
        {value}
      </div>
    </div>
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
      <div className="min-h-0 overflow-auto bg-neutral-50 p-4 text-xs leading-5 text-neutral-500 dark:bg-[#101010] dark:text-neutral-500">
        Binary file preview is not available.
      </div>
    )
  }

  const code = content ?? (wasDeleted ? 'File deleted' : '')
  const language = path ? getCodeBlockLanguageFromFilePath(path) : 'txt'

  return (
    <div className="min-h-0 overflow-hidden bg-white dark:bg-[#101010] [&_.codeblock]:h-full [&_.codeblock]:rounded-none [&_.codeblock]:border-0 [&_.codeblock>div]:h-full [&_code]:!text-[11px] [&_pre]:h-full [&_pre]:overflow-auto [&_pre]:!p-3 [&_pre]:!text-[11px] [&_pre]:!leading-5">
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
      <div className="min-h-0 overflow-auto p-4 text-xs text-neutral-500 dark:text-neutral-500">
        No text diff available.
      </div>
    )
  }

  return (
    <div className="min-h-0 overflow-auto bg-white py-2.5 font-mono text-[11px] leading-5 dark:bg-[#101010]">
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
}: {
  activeChatId: string
  items: Array<ForgeTranscriptItem>
  latestRun: ForgeSession['latestRun']
  onItemOpenChange: (itemId: string, open: boolean) => void
  openItemIds: Record<string, boolean>
  showLogEvents: boolean
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
  const autoScrollKey = useMemo(
    () =>
      getForgeChatAutoScrollKey({
        latestRun,
        latestWorkItem,
        rows,
      }),
    [latestRun, latestWorkItem, rows],
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
    if (rows.length === 0) {
      return
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      rowVirtualizer.scrollToEnd({ behavior: 'auto' })
    })

    return () => window.cancelAnimationFrame(animationFrameId)
  }, [activeChatId, autoScrollKey, rowVirtualizer, rows.length])

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
  const rows = Array<ForgeChatVirtualRow>()

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

function getForgeChatAutoScrollKey({
  latestRun,
  latestWorkItem,
  rows,
}: {
  latestRun: ForgeSession['latestRun']
  latestWorkItem?: ForgeTranscriptWorkItem
  rows: Array<ForgeChatVirtualRow>
}) {
  const latestRow = rows.at(-1)

  return [
    rows.length.toString(),
    latestRow
      ? getForgeChatVirtualRowAutoScrollKey({
          latestRun,
          latestWorkItem,
          row: latestRow,
        })
      : 'empty',
    getLatestForgeMessageAutoScrollKey(rows),
  ].join('\n')
}

function getLatestForgeMessageAutoScrollKey(rows: Array<ForgeChatVirtualRow>) {
  for (let index = rows.length - 1; index >= 0; index--) {
    const row = rows[index]

    if (row?.kind === 'transcript' && row.item.kind === 'message') {
      return getForgeTranscriptMessageAutoScrollKey(row.item)
    }
  }

  return 'no-message'
}

function getForgeChatVirtualRowAutoScrollKey({
  latestRun,
  latestWorkItem,
  row,
}: {
  latestRun: ForgeSession['latestRun']
  latestWorkItem?: ForgeTranscriptWorkItem
  row: ForgeChatVirtualRow
}) {
  switch (row.kind) {
    case 'activeWork':
      return [
        row.id,
        latestRun?.id ?? '',
        latestRun?.status ?? '',
        latestWorkItem
          ? getForgeTranscriptWorkItemAutoScrollKey(latestWorkItem)
          : 'no-work',
      ].join('\n')
    case 'transcript':
      return getForgeTranscriptItemAutoScrollKey(row.item)
  }
}

function getForgeTranscriptItemAutoScrollKey(item: ForgeTranscriptItem) {
  switch (item.kind) {
    case 'activity':
    case 'tool':
      return getForgeTranscriptWorkItemAutoScrollKey(item)
    case 'activityGroup':
    case 'semanticGroup':
      return [
        item.kind,
        item.id,
        item.items.length.toString(),
        getForgeTranscriptWorkItemAutoScrollKey(item.items.at(-1)),
      ].join('\n')
    case 'message':
      return getForgeTranscriptMessageAutoScrollKey(item)
  }
}

function getForgeTranscriptMessageAutoScrollKey(
  item?: ForgeMessageTranscriptItem,
) {
  if (!item) {
    return 'no-message'
  }

  return [
    item.id,
    item.value.id,
    item.value.status ?? '',
    getForgeTextAutoScrollKey(item.value.content),
  ].join('\n')
}

function getForgeTranscriptWorkItemAutoScrollKey(
  item?: ForgeTranscriptWorkItem,
) {
  if (!item) {
    return 'no-work'
  }

  switch (item.kind) {
    case 'activity':
      return [
        item.id,
        item.source,
        getForgeActivityAutoScrollKey(item.value),
      ].join('\n')
    case 'tool': {
      const latestEvent = item.value.events.at(-1)

      return [
        item.id,
        item.value.name,
        item.value.events.length.toString(),
        item.value.path ?? '',
        latestEvent ? getForgeActivityAutoScrollKey(latestEvent) : 'no-event',
      ].join('\n')
    }
  }
}

function getForgeActivityAutoScrollKey(event: ForgeActivityEvent) {
  return [
    event.id,
    event.name,
    event.status ?? '',
    event.path ?? '',
    getForgeTextAutoScrollKey(event.message),
    getForgeTextAutoScrollKey(event.detail),
  ].join('\n')
}

function getForgeTextAutoScrollKey(value?: string) {
  const text = value ?? ''

  return `${text.length}:${text.slice(-120)}`
}

function estimateForgeChatRowSize(row?: ForgeChatVirtualRow) {
  if (!row) {
    return 96
  }

  switch (row.kind) {
    case 'activeWork':
      return 72
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
  }: {
    latestRun: ForgeSession['latestRun']
    latestWorkItem?: ForgeTranscriptWorkItem
    onItemOpenChange: (itemId: string, open: boolean) => void
    openItemIds: Record<string, boolean>
    showLogEvents: boolean
  },
) {
  switch (row.kind) {
    case 'activeWork':
      return (
        <ActiveWorkIndicator
          latestRun={latestRun}
          latestWorkItem={latestWorkItem}
          showLogEvents={showLogEvents}
        />
      )
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

const forgeMarkdownComponents = {
  pre: ForgeMarkdownPre,
  code: ForgeMarkdownCode,
  a: ForgeMarkdownLink,
  p: ForgeMarkdownParagraph,
  h1: ForgeMarkdownHeading1,
  h2: ForgeMarkdownHeading2,
  h3: ForgeMarkdownHeading3,
  ul: ForgeMarkdownUnorderedList,
  ol: ForgeMarkdownOrderedList,
  li: ForgeMarkdownListItem,
  blockquote: ForgeMarkdownBlockquote,
}

function ForgeMarkdownParagraph({ children }: { children?: ReactNode }) {
  return <p className="my-2 first:mt-0 last:mb-0">{children}</p>
}

function ForgeMarkdownHeading1({ children }: { children?: ReactNode }) {
  return (
    <h1 className="mb-2 mt-4 text-base font-semibold text-neutral-950 first:mt-0 dark:text-neutral-100">
      {children}
    </h1>
  )
}

function ForgeMarkdownHeading2({ children }: { children?: ReactNode }) {
  return (
    <h2 className="mb-2 mt-4 text-sm font-semibold text-neutral-950 first:mt-0 dark:text-neutral-100">
      {children}
    </h2>
  )
}

function ForgeMarkdownHeading3({ children }: { children?: ReactNode }) {
  return (
    <h3 className="mb-1.5 mt-3 text-[13px] font-semibold text-neutral-950 first:mt-0 dark:text-neutral-100">
      {children}
    </h3>
  )
}

function ForgeMarkdownUnorderedList({ children }: { children?: ReactNode }) {
  return <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
}

function ForgeMarkdownOrderedList({ children }: { children?: ReactNode }) {
  return <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
}

function ForgeMarkdownListItem({ children }: { children?: ReactNode }) {
  return <li className="leading-5">{children}</li>
}

function ForgeMarkdownBlockquote({ children }: { children?: ReactNode }) {
  return (
    <blockquote className="my-2 border-l-2 border-neutral-300 pl-3 text-neutral-600 dark:border-white/20 dark:text-neutral-400">
      {children}
    </blockquote>
  )
}

type MarkdownCodeElementProps = {
  children?: ReactNode
  className?: string
}

function isMarkdownCodeElement(
  node: ReactNode,
): node is ReactElement<MarkdownCodeElementProps> {
  return isValidElement<MarkdownCodeElementProps>(node)
}

function ForgeMarkdownPre({ children, ...props }: HTMLProps<HTMLPreElement>) {
  const codeElement = isMarkdownCodeElement(children) ? children : undefined
  const codeClassName = codeElement?.props.className?.replace(
    /^lang-/,
    'language-',
  )
  const code = codeElement?.props.children

  return (
    <CodeBlock {...props} showTypeCopyButton={false}>
      <code className={codeClassName}>
        {typeof code === 'string' ? code : ''}
      </code>
    </CodeBlock>
  )
}

function ForgeMarkdownCode({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  if (className?.startsWith('lang-')) {
    return (
      <code className={className.replace(/^lang-/, 'language-')}>
        {children}
      </code>
    )
  }

  return <InlineCode>{children}</InlineCode>
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
      <Streamdown components={forgeMarkdownComponents}>{content}</Streamdown>
      {isStreaming ? (
        <span className="ml-1 inline-block h-3 w-1 translate-y-0.5 animate-pulse rounded-full bg-current opacity-55" />
      ) : null}
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
  const latestActivity =
    latestWorkItem?.kind === 'tool'
      ? latestWorkItem.value.events.at(-1)
      : latestWorkItem?.value
  const activity =
    latestActivity && latestActivity.runId === latestRun?.id
      ? latestActivity
      : undefined
  const source = activity
    ? latestWorkItem?.kind === 'tool'
      ? 'agent'
      : latestWorkItem?.source
    : undefined
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

    if (item.kind === 'message' && item.value.status === 'streaming') {
      return undefined
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
  const reasoningCount = items.filter(isReasoningTranscriptWorkItem).length

  if (reasoningCount > 0 && reasoningCount === items.length) {
    return status === 'finished' ? 'Reasoned through changes' : 'Reasoning'
  }

  const sandboxCustomCount = items.filter(
    isSandboxCustomTranscriptWorkItem,
  ).length

  if (sandboxCustomCount > 0 && sandboxCustomCount === items.length) {
    return sandboxCustomCount === 1
      ? 'Sandbox event'
      : `${sandboxCustomCount.toLocaleString()} sandbox events`
  }

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
  if (items.length > 0 && items.every(isReasoningTranscriptWorkItem)) {
    return formatReasoningTranscriptSubtitle(items)
  }

  if (items.length > 0 && items.every(isSandboxCustomTranscriptWorkItem)) {
    return formatSandboxCustomTranscriptSubtitle(items)
  }

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

function isReasoningTranscriptWorkItem(item: ForgeTranscriptWorkItem) {
  return (
    item.kind === 'activity' &&
    item.source === 'agent' &&
    item.value.name === 'agent.model.reasoning'
  )
}

function isSandboxCustomTranscriptWorkItem(item: ForgeTranscriptWorkItem) {
  return (
    item.kind === 'activity' &&
    item.source === 'agent' &&
    item.value.name.startsWith('agent.sandbox.custom.')
  )
}

function formatSandboxCustomEventName(event: ForgeActivityEvent) {
  return event.name.replace(/^agent\.sandbox\.custom\./, '') || 'event'
}

function formatReasoningTranscriptSubtitle(
  items: Array<ForgeTranscriptWorkItem>,
) {
  const text = items
    .map((item) => (item.kind === 'activity' ? item.value.detail : undefined))
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  return text ? limitDisplayText(text, 220) : undefined
}

function formatSandboxCustomTranscriptSubtitle(
  items: Array<ForgeTranscriptWorkItem>,
) {
  const labels = items
    .map((item) =>
      item.kind === 'activity' ? formatSandboxCustomEventName(item.value) : '',
    )
    .filter(Boolean)
  const uniqueLabels = Array.from(new Set(labels))
  const visibleLabels = uniqueLabels.slice(0, 4)
  const hiddenCount = uniqueLabels.length - visibleLabels.length

  return hiddenCount > 0
    ? `${visibleLabels.join(', ')}, +${hiddenCount.toLocaleString()} more`
    : visibleLabels.join(', ')
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
  if (isCommandTranscriptWorkItem(item)) {
    return 'command'
  }

  if (isReasoningTranscriptWorkItem(item)) {
    return 'reasoning'
  }

  if (isSandboxCustomTranscriptWorkItem(item)) {
    return 'sandbox-custom'
  }

  return undefined
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
      event.name === 'agent.codex.summary'
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

type ForgeDebugEventWithSequence = ForgeDebugEvent & {
  sequence: number
}

function appendForgeDebugStreamEvents(
  current: ForgeDebugStreamEventsByChatId,
  chatId: string,
  events: Array<ForgeStateEvent>,
): ForgeDebugStreamEventsByChatId {
  if (events.length === 0) {
    return current
  }

  const existingEvents = current[chatId] ?? []
  const existingIds = new Set(existingEvents.map(getForgeStateEventDebugId))
  const nextEvents = [...existingEvents]

  for (const event of events) {
    const id = getForgeStateEventDebugId(event)

    if (!existingIds.has(id)) {
      existingIds.add(id)
      nextEvents.push(event)
    }
  }

  return {
    ...current,
    [chatId]: nextEvents.slice(-500),
  }
}

function appendForgeDebugClientStreamChunk(
  current: ForgeDebugClientStreamChunksByChatId,
  chatId: string,
  chunk: StreamChunk,
): ForgeDebugClientStreamChunksByChatId {
  const existingChunks = current[chatId] ?? []
  const createdAt = new Date().toISOString()
  const nextChunk: ForgeDebugClientStreamChunk = {
    chunk,
    createdAt,
    id: [
      'stream',
      Date.parse(createdAt).toString(),
      existingChunks.length.toString(),
      getForgeStreamChunkDebugName(chunk),
    ].join(':'),
  }

  return {
    ...current,
    [chatId]: [...existingChunks, nextChunk].slice(-500),
  }
}

function createForgeDebugEvents({
  clientStreamChunks,
  session,
  streamEvents,
}: {
  clientStreamChunks: Array<ForgeDebugClientStreamChunk>
  session: ForgeSession
  streamEvents: Array<ForgeStateEvent>
}): Array<ForgeDebugEvent> {
  const events = Array<ForgeDebugEventWithSequence>()
  let sequence = 0

  function add(event: ForgeDebugEvent) {
    events.push({
      ...event,
      sequence,
    })
    sequence += 1
  }

  if (session.latestRun) {
    add({
      createdAt: session.latestRun.createdAt,
      id: `run:${session.latestRun.id}`,
      name: `run.${session.latestRun.status}`,
      payload: session.latestRun,
      source: 'run',
      status: session.latestRun.status,
      summary: session.latestRun.error ?? session.latestRun.id,
    })
  }

  for (const message of session.messages) {
    add({
      createdAt: message.createdAt,
      id: `message:${message.id}`,
      name: `message.${message.role}`,
      payload: message,
      source: 'message',
      status: message.status,
      summary: message.content,
    })
  }

  for (const event of session.agentEvents) {
    add({
      createdAt: event.createdAt,
      id: `agent:${event.id}`,
      name: event.name,
      payload: event,
      source: 'agent',
      status: event.status,
      summary: event.message ?? event.detail ?? event.path,
    })
  }

  for (const event of session.workflowEvents) {
    add({
      createdAt: event.createdAt,
      id: `workflow:${event.id}`,
      name: event.name,
      payload: event,
      source: 'workflow',
      status: event.status,
      summary: event.message ?? event.detail ?? event.path,
    })
  }

  for (const event of streamEvents) {
    add({
      createdAt: readForgeStateEventTimestamp(event),
      id: `state:${getForgeStateEventDebugId(event)}`,
      name: `${event.type}.${event.key}`,
      offset: readForgeStateEventOffset(event),
      payload: event,
      source: 'state',
      status: readForgeStateEventStatus(event),
      summary: summarizeForgeStateEvent(event),
    })
  }

  for (const event of clientStreamChunks) {
    add({
      createdAt: event.createdAt,
      id: event.id,
      name: getForgeStreamChunkDebugName(event.chunk),
      payload: event.chunk,
      source: 'stream',
      summary: summarizeForgeStreamChunk(event.chunk),
    })
  }

  for (const exportRow of session.exports) {
    add({
      createdAt: exportRow.startedAt,
      id: `export:${exportRow.id}`,
      name: `export.${exportRow.kind}`,
      payload: exportRow,
      source: 'export',
      status: exportRow.status,
      summary: exportRow.error ?? exportRow.repoUrl ?? exportRow.kind,
    })
  }

  if (session.manifestChange) {
    add({
      id: `manifest-change:${session.manifestVersionId ?? 'current'}`,
      name: 'manifest.change',
      payload: session.manifestChange,
      source: 'manifest',
      summary: `${session.manifestChange.files.length.toLocaleString()} changed files`,
    })
  }

  if (session.currentManifest) {
    add({
      createdAt: session.currentManifest.createdAt,
      id: `manifest:${session.manifestVersionId ?? 'current'}`,
      name: 'manifest.current',
      payload: session.currentManifest,
      source: 'manifest',
      summary: session.currentManifest.app.name,
    })
  }

  for (const [index, warning] of session.warnings.entries()) {
    add({
      id: `warning:${index}`,
      name: 'warning',
      payload: warning,
      source: 'warning',
      summary: warning,
    })
  }

  return events
    .sort(compareForgeDebugEvents)
    .map(({ sequence: _sequence, ...event }) => event)
}

function compareForgeDebugEvents(
  first: ForgeDebugEventWithSequence,
  second: ForgeDebugEventWithSequence,
) {
  const firstValue = getForgeDebugEventSortValue(first)
  const secondValue = getForgeDebugEventSortValue(second)

  if (firstValue !== secondValue) {
    return firstValue - secondValue
  }

  return first.sequence - second.sequence
}

function getForgeDebugEventSortValue(event: ForgeDebugEvent) {
  if (event.createdAt) {
    const createdAt = Date.parse(event.createdAt)

    if (Number.isFinite(createdAt)) {
      return createdAt
    }
  }

  if (event.offset !== undefined) {
    return Number.MAX_SAFE_INTEGER - 1_000_000 + event.offset
  }

  return Number.MAX_SAFE_INTEGER
}

function getForgeStateEventDebugId(event: ForgeStateEvent) {
  return [
    event.headers.stateOffset,
    event.headers.timelineOffset,
    event.type,
    event.key,
  ].join(':')
}

function readForgeStateEventOffset(event: ForgeStateEvent) {
  const stateOffset = Number(event.headers.stateOffset)

  return Number.isFinite(stateOffset) ? stateOffset : undefined
}

function readForgeStateEventTimestamp(event: ForgeStateEvent) {
  if (!isRecord(event.value)) {
    return undefined
  }

  return (
    readString(event.value.createdAt) ??
    readString(event.value.startedAt) ??
    readString(event.value.updatedAt)
  )
}

function readForgeStateEventStatus(event: ForgeStateEvent) {
  if (!isRecord(event.value)) {
    return undefined
  }

  return readString(event.value.status)
}

function summarizeForgeStateEvent(event: ForgeStateEvent) {
  const offsetSummary = `state ${event.headers.stateOffset}, timeline ${event.headers.timelineOffset}`

  if (!isRecord(event.value)) {
    return offsetSummary
  }

  return (
    readString(event.value.message) ??
    readString(event.value.detail) ??
    readString(event.value.error) ??
    readString(event.value.path) ??
    readString(event.value.role) ??
    offsetSummary
  )
}

function getForgeStreamChunkDebugName(chunk: StreamChunk) {
  switch (chunk.type) {
    case 'CUSTOM':
      return `stream.custom.${chunk.name}`
    case 'TOOL_CALL_START':
    case 'TOOL_CALL_END':
      return `stream.${chunk.type}.${chunk.toolCallName ?? chunk.toolName ?? chunk.toolCallId}`
    case 'TOOL_CALL_ARGS':
    case 'TOOL_CALL_RESULT':
      return `stream.${chunk.type}.${chunk.toolCallId}`
    default:
      return `stream.${chunk.type}`
  }
}

function summarizeForgeStreamChunk(chunk: StreamChunk) {
  switch (chunk.type) {
    case 'CUSTOM':
      return summarizeForgeUnknownValue(chunk.value)
    case 'TEXT_MESSAGE_CONTENT':
    case 'REASONING_MESSAGE_CONTENT':
    case 'TOOL_CALL_ARGS':
      return limitDisplayText(chunk.delta, 220)
    case 'TOOL_CALL_RESULT':
      return limitDisplayText(chunk.content, 220)
    case 'TOOL_CALL_START':
    case 'TOOL_CALL_END':
      return chunk.toolCallName ?? chunk.toolName ?? chunk.toolCallId
    case 'RUN_ERROR':
      return chunk.message
    default:
      return undefined
  }
}

function summarizeForgeUnknownValue(value: unknown) {
  if (typeof value === 'string') {
    return limitDisplayText(value, 220)
  }

  try {
    return limitDisplayText(JSON.stringify(value), 220)
  } catch {
    return limitDisplayText(String(value), 220)
  }
}

function filterForgeDebugEvents(
  events: Array<ForgeDebugEvent>,
  filter: string,
) {
  const normalizedFilter = filter.trim().toLowerCase()

  if (!normalizedFilter) {
    return events
  }

  return events.filter((event) => {
    return getForgeDebugSearchText(event).includes(normalizedFilter)
  })
}

function getForgeDebugSearchText(event: ForgeDebugEvent) {
  return [
    event.id,
    event.name,
    event.source,
    event.status,
    event.summary,
    stringifyForgeDebugPayload(event.payload),
  ]
    .filter((value): value is string => typeof value === 'string')
    .join('\n')
    .toLowerCase()
}

function stringifyForgeDebugPayload(payload: unknown) {
  if (typeof payload === 'string') {
    return payload
  }

  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}

function formatForgeDebugEventMeta(event: ForgeDebugEvent) {
  if (event.offset !== undefined) {
    return `#${event.offset.toLocaleString()}`
  }

  if (event.createdAt) {
    const createdAt = new Date(event.createdAt)

    if (!Number.isNaN(createdAt.getTime())) {
      return createdAt.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      })
    }
  }

  return ''
}

function debugEventRowClassName(active: boolean) {
  return `block w-full px-3 py-2.5 text-left transition ${
    active
      ? 'bg-sky-50 text-neutral-950 dark:bg-sky-400/10 dark:text-white'
      : 'text-neutral-800 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-white/[0.04]'
  }`
}

function ForgeSandboxPreviewFrame({ previewUrl }: { previewUrl: string }) {
  const [reloadKey, setReloadKey] = useState(0)
  const [effectivePreviewUrl, setEffectivePreviewUrl] = useState(previewUrl)
  const mountIdRef = useRef<string | undefined>(undefined)
  const iframeSrc = useMemo(
    () => withForgePreviewReloadParam(effectivePreviewUrl, reloadKey),
    [effectivePreviewUrl, reloadKey],
  )

  if (!mountIdRef.current && typeof crypto !== 'undefined') {
    mountIdRef.current = crypto.randomUUID()
  }

  useEffect(() => {
    setEffectivePreviewUrl((currentPreviewUrl) =>
      currentPreviewUrl !== previewUrl &&
      isLocalForgeQuickTunnelPreviewUrl(currentPreviewUrl)
        ? previewUrl
        : currentPreviewUrl,
    )
  }, [previewUrl])

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return
    }

    const mountId = mountIdRef.current ?? 'unknown'

    console.debug('[forge-preview] iframe mounted', {
      mountId,
      previewUrl: effectivePreviewUrl,
    })

    return () => {
      console.debug('[forge-preview] iframe unmounted', {
        mountId,
        previewUrl: effectivePreviewUrl,
      })
    }
  }, [])

  return (
    <div className="grid h-full min-h-0 grid-rows-[36px_minmax(0,1fr)] overflow-hidden bg-white dark:bg-[#101010]">
      <div className="flex min-w-0 items-center gap-2 border-b border-neutral-200 bg-[#fbfbfa] px-2 dark:border-white/10 dark:bg-[#171717]">
        <div className="min-w-0 flex-1 truncate rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 dark:border-white/10 dark:bg-black/25 dark:text-neutral-300">
          {effectivePreviewUrl}
        </div>
        <button
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-white/5 dark:hover:text-white"
          onClick={() => setReloadKey((current) => current + 1)}
          title="Reload preview"
          type="button"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="sr-only">Reload preview</span>
        </button>
        <a
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-white/5 dark:hover:text-white"
          href={effectivePreviewUrl}
          rel="noreferrer"
          target="_blank"
          title="Open preview"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="sr-only">Open preview</span>
        </a>
      </div>
      <iframe
        className="h-full min-h-0 w-full bg-white"
        onLoad={() => {
          if (import.meta.env.DEV) {
            console.debug('[forge-preview] iframe loaded', {
              mountId: mountIdRef.current ?? 'unknown',
              src: iframeSrc,
            })
          }
        }}
        src={iframeSrc}
        title="Forge sandbox preview"
      />
    </div>
  )
}

function ForgeSandboxPreviewWaiting({
  checking,
  failure,
  latestRun,
}: {
  checking: boolean
  failure: string | undefined
  latestRun: ForgeSession['latestRun']
}) {
  const activeRun = isActiveForgeRunStatus(latestRun?.status)
  const hasRun = Boolean(latestRun)
  const hasFailure = Boolean(failure)
  const busy = !hasFailure && (checking || activeRun)
  const startingPreview = !hasFailure && (activeRun || (checking && hasRun))

  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-white px-6 dark:bg-[#101010]">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 dark:border-white/10 dark:text-neutral-400">
          {hasFailure ? (
            <AlertCircle className="h-4 w-4 text-red-500" />
          ) : busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MonitorPlay className="h-4 w-4" />
          )}
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {hasFailure
              ? 'Sandbox preview failed'
              : startingPreview
                ? 'Starting sandbox preview'
                : checking
                  ? 'Checking existing sandbox'
                  : 'No sandbox preview yet'}
          </div>
          <div
            className={`text-xs leading-5 text-neutral-500 dark:text-neutral-400 ${
              hasFailure
                ? 'max-h-32 overflow-auto whitespace-pre-wrap text-left'
                : ''
            }`}
          >
            {failure ??
              (startingPreview
                ? 'The preview will appear here as soon as the sandbox dev server is exposed.'
                : checking
                  ? 'Forge is looking for a live preview server in this chat sandbox.'
                  : 'Run the agent to start the app inside the Cloudflare sandbox.')}
          </div>
        </div>
      </div>
    </div>
  )
}

function readLatestForgeSandboxPreviewUrl(events: Array<ForgeActivityEvent>) {
  for (const event of [...events].reverse()) {
    if (
      event.name !== 'agent.preview.exposed' &&
      event.name !== 'workflow.preview.ready' &&
      event.name !== 'workflow.preview.reconnected'
    ) {
      continue
    }

    const url = readValidForgePreviewUrl(event.detail)

    if (url) {
      return url
    }
  }

  return undefined
}

function readLatestForgeSandboxPreviewFailure(
  events: Array<ForgeActivityEvent>,
) {
  for (const event of [...events].reverse()) {
    if (
      (event.name === 'agent.preview.exposed' ||
        event.name === 'workflow.preview.ready' ||
        event.name === 'workflow.preview.reconnected') &&
      readValidForgePreviewUrl(event.detail)
    ) {
      return undefined
    }

    if (
      event.name !== 'workflow.preview.start.failed' &&
      event.name !== 'workflow.preview.reconnect.failed'
    ) {
      continue
    }

    return (
      readCompactForgePreviewFailure(event.detail) ||
      readCompactForgePreviewFailure(event.message) ||
      'Forge sandbox preview failed to start.'
    )
  }

  return undefined
}

function readCompactForgePreviewFailure(value: unknown) {
  const text = readString(value)?.trim()

  if (!text) {
    return undefined
  }

  return text.length > 1_200 ? `${text.slice(0, 1_200)}...` : text
}

function setForgePreviewReconnectChecking(
  current: Record<string, boolean>,
  chatId: string,
  checking: boolean,
) {
  if (checking) {
    return current[chatId] === true
      ? current
      : {
          ...current,
          [chatId]: true,
        }
  }

  if (current[chatId] !== true) {
    return current
  }

  const next = { ...current }
  delete next[chatId]

  return next
}

function withForgePreviewReloadParam(previewUrl: string, reloadKey: number) {
  if (reloadKey === 0) {
    return previewUrl
  }

  try {
    const url = new URL(previewUrl)

    url.searchParams.set('__forge_preview_reload', String(reloadKey))

    return url.href
  } catch {
    return previewUrl
  }
}

function readValidForgePreviewUrl(value: unknown) {
  const urlText = readString(value)?.trim()

  if (!urlText) {
    return undefined
  }

  try {
    const url = new URL(urlText)

    if (
      isLocalForgePreviewHostBlocked(url) &&
      !isForgeSandboxPreviewProxyHost(url.hostname)
    ) {
      return undefined
    }

    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}

function isLocalForgePreviewHostBlocked(url: URL) {
  if (
    typeof window === 'undefined' ||
    !isLocalForgeAppHost(window.location.hostname)
  ) {
    return false
  }

  return (
    (isLocalForgeAppHost(url.hostname) &&
      url.pathname.startsWith('/__forge-preview/')) ||
    url.hostname === 'lvh.me' ||
    url.hostname.endsWith('-p.lvh.me') ||
    url.hostname.endsWith('-v2.lvh.me') ||
    url.hostname.endsWith('-v3.lvh.me') ||
    url.hostname.endsWith('.localhost')
  )
}

function isForgeSandboxPreviewProxyHost(hostname: string) {
  const firstLabel = hostname.split('.')[0]

  return /^\d{4,5}-[a-z0-9-]{1,63}-[a-z0-9_]{1,16}$/.test(firstLabel)
}

function shouldReconnectForgeSandboxPreviewUrl({
  latestRun,
  previewUrl,
}: {
  latestRun: ForgeSession['latestRun']
  previewUrl: string | undefined
}) {
  if (previewUrl) {
    return isLocalForgeQuickTunnelPreviewUrl(previewUrl)
  }

  if (isActiveForgeRunStatus(latestRun?.status)) {
    return false
  }

  return Boolean(latestRun)
}

function isLocalForgeQuickTunnelPreviewUrl(previewUrl: string) {
  if (
    typeof window === 'undefined' ||
    !isLocalForgeAppHost(window.location.hostname)
  ) {
    return false
  }

  try {
    return new URL(previewUrl).hostname.endsWith('.trycloudflare.com')
  } catch {
    return false
  }
}

type ForgeSandboxPreviewReconnectMode = 'attach' | 'restart' | 'retunnel'

async function reconnectForgeSandboxPreviewUrl(
  chatId: string,
  options?: { mode?: ForgeSandboxPreviewReconnectMode },
) {
  const response = await fetch('/api/forge/preview/reconnect', {
    body: JSON.stringify({ chatId, mode: options?.mode }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(await readForgePreviewReconnectError(response))
  }

  const value: unknown = await response.json()

  if (!isRecord(value)) {
    return {}
  }

  return {
    reason: typeof value.reason === 'string' ? value.reason : undefined,
    url: typeof value.url === 'string' ? value.url : undefined,
  }
}

async function readForgePreviewReconnectError(response: Response) {
  const contentType = response.headers.get('content-type')

  if (contentType?.includes('application/json')) {
    const value: unknown = await response.json().catch(() => undefined)

    if (isRecord(value)) {
      const error = readString(value.error)
      const message = readString(value.message)
      const logTail = readString(value.logTail)

      return [error, message, logTail].filter(Boolean).join('\n\n')
    }
  }

  return await response.text()
}

function isLocalForgeAppHost(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.localhost')
  )
}

function debugSourceBadgeClassName(source: ForgeDebugEventSource) {
  const base =
    'inline-flex h-5 shrink-0 items-center rounded px-1.5 font-mono text-[10px] uppercase tracking-wide'

  switch (source) {
    case 'agent':
      return `${base} bg-violet-50 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300`
    case 'export':
      return `${base} bg-indigo-50 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-300`
    case 'manifest':
      return `${base} bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300`
    case 'message':
      return `${base} bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300`
    case 'run':
      return `${base} bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300`
    case 'state':
      return `${base} bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-neutral-300`
    case 'stream':
      return `${base} bg-cyan-50 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300`
    case 'warning':
      return `${base} bg-orange-50 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300`
    case 'workflow':
      return `${base} bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300`
  }
}

function debugStreamStatusClassName(status: ForgeStreamStatus) {
  const base =
    'inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[11px] font-medium'

  switch (status) {
    case 'live':
      return `${base} bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300`
    case 'connecting':
      return `${base} bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300`
    case 'disconnected':
      return `${base} bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300`
  }
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

function readForgeSnapshotStreamValue(
  value: unknown,
): ForgeSession | undefined {
  if (!isRecord(value) || value.type !== 'snapshot') {
    return undefined
  }

  return isForgeSession(value.snapshot) ? value.snapshot : undefined
}

function readForgeStateBatchStreamValue(
  value: unknown,
): ForgeStateBatchStreamEvent | undefined {
  if (
    !isRecord(value) ||
    value.type !== 'state-batch' ||
    !Array.isArray(value.events)
  ) {
    return undefined
  }

  const events = value.events.filter(isForgeStateEvent)

  return {
    events,
    stateOffset: typeof value.stateOffset === 'number' ? value.stateOffset : 0,
    timelineOffset:
      typeof value.timelineOffset === 'number' ? value.timelineOffset : 0,
    type: 'state-batch',
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

function requireForgeSession(value: unknown): ForgeSession {
  if (isForgeSession(value)) {
    return value
  }

  throw new Error('Forge chat returned an invalid session.')
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

  if (event.name === 'agent.model.reasoning') {
    return {
      detail: event.detail,
      status: event.status,
      title: 'Reasoning',
    }
  }

  if (event.name.startsWith('agent.sandbox.custom.')) {
    return {
      detail: event.detail,
      status: event.status,
      subtitle: event.detail
        ? limitDisplayText(event.detail.replace(/\s+/g, ' '), 220)
        : undefined,
      title: `Sandbox event: ${formatSandboxCustomEventName(event)}`,
    }
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

  if (event.name.startsWith('agent.sandbox.custom.')) {
    return `Sandbox event: ${formatSandboxCustomEventName(event)}`
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
    case 'agent.model.reasoning':
      return 'Reasoning'
    case 'agent.codex.workspace.prepared':
      return 'Prepared Codex workspace'
    case 'agent.codex.plan':
      return 'Planned changes'
    case 'agent.codex.process.started':
      return 'Started Codex'
    case 'agent.codex.thread.started':
      return 'Started Codex thread'
    case 'agent.codex.turn.started':
      return 'Started Codex turn'
    case 'agent.codex.turn.completed':
      return 'Completed Codex turn'
    case 'agent.codex.message':
      return 'Codex message'
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
      return 'Streaming Codex output'
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
