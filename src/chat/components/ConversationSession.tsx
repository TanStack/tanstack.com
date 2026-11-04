import { retainArchivedMessages } from '../core/conversation-snapshot'
import { workspacePreviewsEnabled } from '../core/workspace-panels'
import { useQueryClient } from '@tanstack/react-query'
import { projectSavedEvent } from '../core/project-events'
import { ProjectsPanel } from './ProjectsPanel'
import { isPersonalAssistant } from '../core/bot-workspace'
import './assistant-chat.css'
import { DraftSyncNotice } from './DraftSyncNotice'
import { useDebugDetails } from './useDebugDetails'
import { Button } from './ui/Button'
import { conversationActionRequest } from '../core/conversation-actions'
import { ActionCard } from './ui/ActionCard'
import { PendingMessage } from './PendingMessage'
import { WorkflowHistory } from './WorkflowHistory'
import { Link } from '@tanstack/react-router'
import { SelectField } from './SelectField'
import { useConversationPalette } from './useConversationPalette'
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { useChat, type SubscribeConnectionAdapter } from '@tanstack/ai-react'
import { Popover } from '@base-ui/react/popover'
import { durableStreamConnection } from '@durable-streams/tanstack-ai-transport'
import {
  ArrowUp,
  LoaderCircle,
  CircleAlert,
  Play,
  RotateCcw,
  Shield,
  Square,
} from 'lucide-react'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'
import type { Bootstrap, History } from './App'
import type { ConversationDestination } from '../core/conversation-destination'
import {
  sameConversationResource,
  conversationLocation,
} from '../core/conversation-destination'
import {
  executionHistorySession,
  defaultWorkspaceSearch,
  type ExecutionHistorySelection,
} from '../core/navigation'
import type {
  ThreadSummary,
  ThreadListItem,
} from '../core/conversation-threads'
import type { WorkspaceBot } from '../core/bot-workspace'
import type { Approval } from '../core/types'
import { ScheduleReview } from './ScheduleReview'
import { KodyMemoryCreateReview } from './KodyMemoryCreateReview'
import { WorkspaceReview } from './WorkspaceReview'
import type {
  QueueCommand,
  QueueResult,
  QueueSnapshot,
} from '../core/conversation-queue'
import {
  availableWorkspacePanels,
  readFilePanel,
  type PanelId,
  type WorkspacePanelState,
} from '../core/workspace-panels'
import {
  captureComposerFocus,
  type ComposerFocusHandoff,
} from './composer-focus'
import { ConversationWorkspace } from './ConversationWorkspace'
import { DesktopBrowserPanel } from './DesktopBrowserPanel'
import { useDesktopBrowserHost } from '../client/desktop-host'
import { useConversationNavigatorSession } from './ConversationNavigatorScope'
import { ConversationDetails } from './ConversationDetails'
import { ConversationDetailsCard } from './ConversationDetailsCard'
import { usePanelMotion } from './usePanelMotion'
const ExecutionSessionPanel = import.meta.env.DEV
  ? lazy(() =>
      import('./ExecutionSessionPanel').then((module) => ({
        default: module.ExecutionSessionPanel,
      })),
    )
  : undefined
import { useSavedFiles } from './useSavedFiles'
import { deferredPanel } from './deferredPanel'
const ConversationFiles = deferredPanel(async () => {
  const module = await import('./SavedFiles')
  return { default: module.ConversationFiles }
}, 'files')
const SavedFileViewer = deferredPanel(async () => {
  const module = await import('./SavedFiles')
  return { default: module.SavedFileViewer }
}, 'file')
const SavedFileDiffViewer = deferredPanel(async () => {
  const module = await import('./SavedFiles')
  return { default: module.SavedFileDiffViewer }
}, 'comparison')
import { ConversationOrigin } from './ConversationOrigin'
import { ConversationActionEvidence } from './ConversationActionEvidence'
import { RetryBranch } from './RetryBranch'
import { RetryPreparation } from './RetryPreparation'
import { useRetryPreparation } from './useRetryPreparation'
import { RetryDraftStore, type RetryDraftDocument } from '../core/retry-draft'
import { RetryDraftRecovery } from './RetryDraftRecovery'
import { createMessageFocusIntent, type UrlMessageFocus } from './message-focus'
import type { RetryDraftEditor } from '../core/retry-draft-editor'
import { useConversationRead } from './useConversationRead'
import { useComposerDraft, useSendBehavior } from './useComposerDraft'
import { usePendingSend } from './usePendingSend'
import { useComposerAttachments } from './useComposerAttachments'
import {
  ComposerAttachments,
  composerSketchDisabledReason,
} from './ComposerAttachments'
import { ComposerAddButton, ComposerReferences } from './ComposerReferences'
import {
  findReferenceTrigger,
  removeReferenceTrigger,
  useComposerReferences,
  type ReferenceTrigger,
} from './useComposerReferences'
import {
  readMessageReferences,
  referenceInput,
} from '../core/message-references'
import { readMessageAttachments } from '../core/message-attachments'
import { readRunModel } from '../core/run-model'
import { useRunModel } from './useRunModel'
import { RunModelPicker } from './RunModelPicker'
import { ContextIndicator } from './ContextIndicator'
import { buildConversationNavigation } from '../core/message-navigation'
import { EarlierMessages } from './EarlierMessages'
import { ConversationTurn, groupConversation } from './ConversationTurn'
import {
  VirtualMessages,
  type ConversationNavigationHandle,
} from './VirtualMessages'
import { PendingTaskCard } from './PendingTaskCard'
import { pendingPackageGuide } from '../core/tasks'
import { DelegatedTasks, useDelegatedTasks } from './DelegatedTasks'
import { DelegatedTaskHistory } from './DelegatedTaskHistory'
import { TaskUsageDetails } from './TaskUsageDetails'
import { QueuedMessages } from './QueuedMessages'
import { CodeBlock, codeThemeCss, MessageMarkdown } from './MessageMarkdown'
import { Dialog } from './Dialog'
import { MessageThreads, type ThreadOpenIntent } from './ConversationThreads'
import { useConversationThreads } from './conversation-thread-state'

export interface SessionNavigation {
  messageId?: string
  explicitMessageFocus?: UrlMessageFocus
  messageFocus?: UrlMessageFocus
  onSelectMessage: (id?: string) => void
  getMessageLink: (id: string) => string
  onOpenFile: (id: string) => void
}
export interface SessionWorkspace {
  state: WorkspacePanelState
  executionHistory?: ExecutionHistorySelection
  onSelectHistorySession?: (id: string | undefined) => void
  details?: {
    open: boolean
    onOpenChange: (open: boolean, options?: { replace?: boolean }) => void
  }
  focusActiveTab?: boolean
  storageKey: string
  returnFocus: RefObject<HTMLButtonElement | null>
  onOpen: (id: PanelId) => void
  onClose: (id: PanelId) => void
  onClosePane: () => void
  onFullscreen: () => void
  renderThread: (parent: ConversationDestination) => ReactNode
  threadTitle?: string
}
function newestQueue(previous?: QueueSnapshot, incoming?: QueueSnapshot) {
  return (previous?.version ?? -1) > (incoming?.version ?? -1)
    ? previous
    : incoming
}
const names: Record<string, string> = {
  included: 'Included AI',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
  groq: 'Groq',
  grok: 'xAI',
  openrouter: 'OpenRouter',
  vercel: 'Vercel AI Gateway',
  cloudflare: 'Cloudflare AI Gateway',
  compatible: 'OpenAI-compatible endpoint',
}

const MemoryPanel = deferredPanel(async () => {
  const module = await import('./MemoryPanel')
  return { default: module.MemoryPanel }
}, 'memory')
const KodyMail = deferredPanel(async () => {
  const module = await import('./KodyMail')
  return { default: module.KodyMail }
}, 'mail')
const Schedules = deferredPanel(async () => {
  const module = await import('./Schedules')
  return { default: module.Schedules }
}, 'schedules')

export function ConversationSession({
  visible,
  bot,
  data,
  workspace,
  header,
  navigation,
  title,
  thread,
  onOpenThread,
  developer,
  refresh,
  initialHistory,
  destination: resolvedDestination,
  focusAfterCreate,
  onFork,
  onRetryReady,
}: {
  initialHistory: History
  destination: ConversationDestination
  visible: boolean
  bot: WorkspaceBot
  data: Bootstrap
  workspace?: SessionWorkspace
  header?: ReactNode
  navigation: SessionNavigation
  title?: string
  thread?: ThreadSummary
  onOpenThread?: (thread: ThreadListItem, intent?: ThreadOpenIntent) => void
  developer: boolean
  refresh: () => Promise<unknown>
  onFork?: (messageId: string, conversationId?: string) => void
  onRetryReady: (
    target: { botId: string; conversationId: string },
    signal: AbortSignal,
  ) => Promise<boolean>
  focusAfterCreate?: ComposerFocusHandoff
}) {
  // The transport and recovery owner must not change underneath an active run.
  const [debugDetails] = useDebugDetails()
  const [destination] = useState(resolvedDestination)
  useConversationNavigatorSession(destination, onOpenThread, !!workspace)
  const [metadata, setMetadata] = useState(initialHistory)
  const [finishedRetry, setFinishedRetry] = useState<string>()
  const [recoveredRetry, setRecoveredRetry] = useState<RetryDraftDocument>()
  const reviewedRetry = useRef<string | undefined>(undefined)
  const activeRetryEditor = useRef<RetryDraftEditor | null>(null)
  const [retryEditorMounted, setRetryEditorMounted] = useState(false)
  const registerRetryEditor = useCallback((editor: RetryDraftEditor | null) => {
    activeRetryEditor.current = editor
    setRetryEditorMounted(!!editor)
  }, [])
  const currentRetryAttemptId = metadata.copyOrigin?.retryAttemptId
  const [retainedRetryAttemptId, setRetainedRetryAttemptId] = useState(
    currentRetryAttemptId,
  )
  useEffect(() => {
    if (currentRetryAttemptId) setRetainedRetryAttemptId(currentRetryAttemptId)
  }, [currentRetryAttemptId])
  // A remote reset can remove the origin while this tab still has unsaved edits.
  // Keep that editor alive until the user has recovered or dismissed its draft.
  const retryAttemptId =
    currentRetryAttemptId ??
    (finishedRetry !== retainedRetryAttemptId
      ? retainedRetryAttemptId
      : undefined)
  const retryEditing = !!retryAttemptId && finishedRetry !== retryAttemptId
  const retryPreparation = useRetryPreparation(
    destination,
    onRetryReady,
    visible,
  )
  const detailsMotion = usePanelMotion(
    destination.sessionKey,
    !!workspace?.details?.open,
  )
  const { request: api, url: apiUrl } = useWorkspaceApi()
  const threads = useConversationThreads(
    destination,
    thread?.parentConversationId,
  )
  const readOnly =
    !!bot.archived_at ||
    !!bot.deleted_at ||
    !!thread?.archivedAt ||
    !!initialHistory.workflowWorker
  const savedFiles = useSavedFiles(bot.id, data.user.id, destination)
  const wasRunning = useRef(false)
  const [input, setInput, clearSubmitted, draftSync] = useComposerDraft(
    destination.compatibility.draftScope,
    data.user.id,
    visible,
  )
  const [sendBehavior] = useSendBehavior()
  const search = { message: navigation.messageId }
  const navigationRef = useRef<ConversationNavigationHandle>(null)
  const [jumpToBottomContainer, setJumpToBottomContainer] =
    useState<HTMLDivElement | null>(null)
  const lastScrolledMessage = useRef<UrlMessageFocus | undefined>(undefined)
  const [error, setError] = useState('')
  const [unarchiving, setUnarchiving] = useState(false)
  const unarchive = async () => {
    if (unarchiving) return
    setUnarchiving(true)
    setError('')
    try {
      const { path, body, method } = conversationActionRequest(bot, {
        type: 'archive',
        archived: false,
      })
      await api(path, body, method)
      await refresh()
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setUnarchiving(false)
    }
  }
  const [sendingAction, setSending] = useState(false)
  const [proposeToolsOnly, setProposeToolsOnly] = useState(false)
  const [systemOne, setSystemOne] = useState(false)
  const composerInput = useRef<HTMLTextAreaElement>(null)
  const [referencePicker] = useState(() => Popover.createHandle())
  const composerArea = useRef<HTMLDivElement>(null)
  const retryFocus = useRef<ComposerFocusHandoff | undefined>(undefined)
  const [chatArea, setChatArea] = useState<HTMLDivElement | null>(null)
  const [referenceTrigger, setReferenceTrigger] =
    useState<ReferenceTrigger | null>(null)
  const pendingSend = usePendingSend(
    destination.compatibility.sendScope,
    async (payload, envelope) => {
      // One receipt owner dispatches cleanup by the saved payload. A reset or
      // ordinary follow-up must not strand an accepted retry, or clear another draft.
      if (payload.retry) {
        if (!navigator.locks)
          throw new Error('Use an up-to-date browser to recover this send.')
        const store = new RetryDraftStore({
          storage: localStorage,
          scope: {
            userId: destination.userId,
            workspaceId: destination.workspaceId,
            botId: destination.botId,
            conversationId: destination.conversationId,
          },
          attemptId: payload.retry.attemptId,
          lock: (key, operation) => navigator.locks.request(key, operation),
        })
        const editor =
          activeRetryEditor.current?.store.key === store.key
            ? activeRetryEditor.current
            : undefined
        const receipt = {
          messageId: payload.messageId,
          draftRevision: payload.retry.draftRevision,
        }
        const restored = editor
          ? await editor.consume(receipt)
          : await store.consume(receipt)
        if (!restored)
          throw new Error('The accepted retry draft could not be recovered.')
        window.dispatchEvent(
          new CustomEvent('gum:retry-draft-changed', { detail: store.key }),
        )
        if (
          restored.revision > payload.retry.draftRevision &&
          reviewedRetry.current !== payload.messageId
        ) {
          setRecoveredRetry(restored)
          throw new Error(
            'Your request was sent. Review the later edits kept below before continuing.',
          )
        }
        void refresh()
        return true
      }
      const textCleared = clearSubmitted(payload.text)
      const filesCleared = attachments.clearSubmitted(payload.fileIds)
      const referencesCleared = await references.clearSubmitted(
        envelope.referenceSelection,
      )
      void refresh()
      return textCleared && filesCleared && referencesCleared
    },
    destination,
  )
  const sending = pendingSend.busy || sendingAction
  const composerLocked = sending || !!pendingSend.pending || !pendingSend.ready
  useEffect(() => {
    if (visible && !readOnly && !composerLocked && composerInput.current)
      focusAfterCreate?.focus(composerInput.current)
  }, [focusAfterCreate, visible, readOnly, composerLocked])
  useEffect(() => {
    if (!visible || readOnly) {
      retryFocus.current?.cancel()
      retryFocus.current = undefined
    } else if (!retryEditing && !composerLocked && composerInput.current) {
      const handoff = retryFocus.current
      retryFocus.current = undefined
      handoff?.focus(composerInput.current)
    }
  }, [visible, readOnly, retryEditing, composerLocked, finishedRetry])
  useEffect(() => () => retryFocus.current?.cancel(), [])
  const attachments = useComposerAttachments({
    visible,
    botId: bot.id,
    destination,
    userId: data.user.id,
    readOnly: readOnly || composerLocked,
  })
  const runModel = useRunModel({
    userId: data.user.id,
    resourcePath: destination.compatibility.resourcePath,
    readOnly: readOnly || composerLocked,
  })
  const usesSelectedModel = !developer || (!systemOne && !proposeToolsOnly)
  const references = useComposerReferences({
    visible,
    userId: data.user.id,
    resourcePath: destination.compatibility.resourcePath,
    readOnly: readOnly || composerLocked,
  })
  const referencedFiles = references.items.filter(
    (item) => item.kind === 'file',
  ).length
  const hasMessageContent =
    !!input.trim() || attachments.hasAttachments || referencedFiles > 0
  const referenceLimitExceeded = attachments.items.length + referencedFiles > 5
  const sketchDisabledReason = composerSketchDisabledReason({
    readOnly,
    locked: composerLocked,
    assistantMode: usesSelectedModel,
    fileCount: attachments.items.length + referencedFiles,
    model: runModel,
  })
  const [reset, setReset] = useState(false)
  const [expandedDetails, setExpandedDetails] = useState<
    Record<string, boolean>
  >({})
  const setExpanded = (id: string, open: boolean) =>
    setExpandedDetails((previous) =>
      previous[id] === open ? previous : { ...previous, [id]: open },
    )
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  )
  const path = destination.apiPath
  const forkMessage = onFork
    ? (messageId: string) => onFork(messageId, destination.conversationId)
    : undefined
  const displayedMessages = useRef(initialHistory.messages)
  const connection = useMemo<SubscribeConnectionAdapter>(() => {
    const durable = durableStreamConnection({
      sendUrl: apiUrl(`${path}/send`),
      readUrl: apiUrl(`${path}/stream`),
      initialOffset: initialHistory.streamOffset,
      emitSnapshotOnSubscribe: false,
    })
    const subscribe =
      durable.subscribe as SubscribeConnectionAdapter['subscribe']
    return {
      subscribe: async function* (signal) {
        for await (const chunk of subscribe(signal))
          yield retainArchivedMessages(chunk, displayedMessages.current)
      },
      send: async (messages, data) => {
        const message = messages.at(-1)
        if (!message || !('parts' in message))
          throw new Error('No message to send.')
        const text = message.parts
          .filter((part) => part.type === 'text')
          .map((part) => part.content)
          .join('\n')
        const messageReferences = readMessageReferences(message)
        const referencedFileIds = new Set(
          messageReferences.flatMap((reference) =>
            reference.kind === 'file' &&
            sameConversationResource(reference, destination)
              ? [reference.fileId]
              : [],
          ),
        )
        await api(`${path}/send`, {
          text,
          messageId: message.id,
          fileIds: readMessageAttachments(message)
            .filter(
              (file) =>
                sameConversationResource(file, destination) &&
                !referencedFileIds.has(file.id),
            )
            .map((file) => file.id),
          references: messageReferences.map(referenceInput),
          ...data,
        })
      },
    }
  }, [path, initialHistory.streamOffset, api, apiUrl])
  const projectQueryClient = useQueryClient()
  const chat = useChat({
    threadId: destination.conversationId ?? destination.sessionKey,
    connection,
    live: true,
    onCustomEvent: (name) => {
      if (name === projectSavedEvent)
        void projectQueryClient.invalidateQueries({
          queryKey: ['chat-projects', data.user.id],
        })
    },
    initialMessages: initialHistory.messages,
    onChunk: (chunk) => {
      if (chunk.type === 'STATE_SNAPSHOT') {
        const snapshot = chunk.snapshot as History
        setMetadata((previous) => ({
          ...snapshot,
          queue: newestQueue(previous.queue, snapshot.queue),
        }))
      }
    },
  })
  displayedMessages.current = chat.messages
  const h = { ...metadata, messages: chat.messages }
  const emptyThreadState = useRef(false)
  emptyThreadState.current =
    !!thread &&
    !thread.archivedAt &&
    !h.messages.length &&
    !input &&
    !attachments.hasAttachments &&
    !references.items.length &&
    !sending &&
    !pendingSend.pending
  const emptyThreadVisit = useRef(0)
  useEffect(() => {
    if (!visible || !thread) return
    const visit = ++emptyThreadVisit.current
    return () => {
      // Defer past React's effect replay, but use the latest draft and send state.
      queueMicrotask(() => {
        if (emptyThreadVisit.current !== visit || !emptyThreadState.current)
          return
        try {
          if (
            localStorage.getItem(
              `gum.draft:${destination.compatibility.draftScope}`,
            )
          )
            return
        } catch {
          return
        }
        void api(`${destination.apiPath}/thread`, undefined, 'DELETE')
          .then(() => threads.refetch())
          .catch(() => {
            /* A failed cleanup keeps the thread available. */
          })
      })
    }
  }, [visible, destination, thread?.conversationId, api])

  const retryDisabledReason = readOnly
    ? 'Restore or unarchive this conversation before trying again.'
    : retryEditing
      ? 'Finish or leave the current request before trying again.'
      : retryPreparation.busy
        ? 'Finish or pause the current preparation first.'
        : undefined
  const retryMessage = (messageId: string) => {
    if (!retryDisabledReason) void retryPreparation.begin(messageId)
  }
  const latestRequest = [...h.messages]
    .reverse()
    .find((message) => message.role === 'user')
  const requestModel =
    readRunModel(latestRequest) ??
    (h.assistantTask?.messageId === latestRequest?.id
      ? h.assistantTask?.runModel
      : undefined)
  const toolResults = new Map(
    h?.messages.flatMap((message) =>
      message.parts.flatMap((part) =>
        part.type === 'tool-result' ? [[part.toolCallId, part] as const] : [],
      ),
    ),
  )
  const busy = h.status === 'running' || !!h.delegationWait
  // One observer and one stop state serve the transcript and Details card.
  const delegatedTasks = useDelegatedTasks({
    destination,
    taskId: destination.isMainConversation ? h.assistantTask?.id : undefined,
    visible: visible && !!onOpenThread,
    active: busy,
  })
  const renderDelegatedTasks = (fromDetails = false) =>
    destination.isMainConversation && h.assistantTask && onOpenThread ? (
      <DelegatedTasks
        state={delegatedTasks}
        readOnly={readOnly}
        threads={threads.error ? [] : (threads.data?.items ?? [])}
        onOpen={(child, intent) => {
          onOpenThread(
            child,
            intent ? { ...intent, closeDetails: fromDetails } : undefined,
          )
        }}
      />
    ) : undefined
  useEffect(() => {
    if (wasRunning.current && !busy) {
      // Native assistant actions can change workspace metadata through the same
      // service as the UI. Refresh after settling without disturbing queued writes.
      void Promise.allSettled([savedFiles.refetch(), refresh()])
    }
    wasRunning.current = busy
  }, [busy, savedFiles.refetch, refresh])
  const waiting =
    !!h.pendingTask ||
    h.approvals.some((a) => a.status === 'pending' || a.status === 'running')
  const pendingMessages = useMemo(() => {
    const local = new Map(
      pendingSend.submitted.map((envelope) => [
        envelope.payload.messageId,
        envelope,
      ]),
    )
    if (pendingSend.pending)
      local.set(pendingSend.pending.payload.messageId, pendingSend.pending)
    return [...local.values()].filter(
      (envelope) =>
        !envelope.payload.retry &&
        !h.messages.some(
          (message) => message.id === envelope.payload.messageId,
        ) &&
        !h.queue?.items.some(
          (item) => item.messageId === envelope.payload.messageId,
        ),
    )
  }, [pendingSend.submitted, pendingSend.pending, h.messages, h.queue])
  useEffect(() => {
    for (const envelope of pendingSend.submitted)
      if (
        !pendingMessages.some(
          (item) => item.payload.messageId === envelope.payload.messageId,
        )
      )
        pendingSend.forgetSubmitted(envelope.payload.messageId)
  }, [pendingSend.submitted, pendingMessages])
  const turns = useMemo(() => groupConversation(h.messages), [h.messages])
  const navigationItems = useMemo(
    () =>
      buildConversationNavigation(
        turns,
        h.turnOutcomes,
        busy ? turns.at(-1)?.id : undefined,
        h.inheritedTurns,
      ),
    [turns, h.turnOutcomes, h.inheritedTurns, busy],
  )
  const messageRevision = useMemo(
    () =>
      h.messages
        .map(
          (message) =>
            `${message.id}:${message.parts.map((part) => (part.type === 'text' ? part.content.length : part.type === 'tool-call' ? part.state : part.type)).join(',')}`,
        )
        .join('|'),
    [h.messages],
  )
  const liveTarget =
    !!search.message &&
    h.messages.some((message) => message.id === search.message)
  const getMessageLink = navigation.getMessageLink
  const [explicitFocus, setExplicitFocus] = useState<
    UrlMessageFocus | undefined
  >(navigation.explicitMessageFocus)
  const explicitObserved = useRef(false)
  const chooseExplicitFocus = (messageId: string) => {
    explicitObserved.current = false
    const selection = { messageId, intent: createMessageFocusIntent() }
    setExplicitFocus(selection)
    return selection
  }
  const selectedMessageFocus =
    explicitFocus?.messageId === search.message
      ? explicitFocus
      : navigation.messageFocus
  useEffect(() => () => explicitFocus?.intent?.cancel(), [explicitFocus])
  useEffect(() => {
    if (!explicitFocus) return
    if (!visible) explicitFocus.intent?.cancel()
    if (explicitFocus.messageId === search.message)
      explicitObserved.current = true
    else if (explicitObserved.current) {
      explicitFocus.intent?.cancel()
      setExplicitFocus(undefined)
    }
  }, [explicitFocus, search.message, visible])
  const selectMessage = (id: string) => {
    const selection = chooseExplicitFocus(id)
    if (
      navigationRef.current?.scrollToMessage(id, {
        focusIntent: selection.intent,
      })
    )
      lastScrolledMessage.current = selection
    navigation.onSelectMessage(id)
  }
  const lastExplicitFocus = useRef(navigation.explicitMessageFocus)
  useLayoutEffect(() => {
    if (lastExplicitFocus.current !== navigation.explicitMessageFocus) {
      lastExplicitFocus.current = navigation.explicitMessageFocus
      lastScrolledMessage.current = undefined
      explicitObserved.current = false
      setExplicitFocus(navigation.explicitMessageFocus)
    }
  }, [navigation.explicitMessageFocus])
  useEffect(() => {
    if (!search.message) {
      lastScrolledMessage.current = undefined
      return
    }
    if (!visible || selectedMessageFocus?.messageId !== search.message) return
    if (
      (lastScrolledMessage.current?.messageId !== search.message ||
        lastScrolledMessage.current.intent !== selectedMessageFocus.intent) &&
      navigationRef.current?.scrollToMessage(search.message, {
        focusIntent: selectedMessageFocus.intent,
      })
    ) {
      lastScrolledMessage.current = selectedMessageFocus
    }
  }, [
    search.message,
    liveTarget,
    navigationItems,
    scrollElement,
    selectedMessageFocus,
    visible,
  ])
  useConversationRead(
    destination,
    scrollElement,
    h.activity?.summary.eventVersion,
    !!busy,
    visible,
  )
  async function send(e?: FormEvent, text = input) {
    e?.preventDefault()
    if (readOnly || sending || !pendingSend.ready) return
    if (pendingSend.pending) {
      await pendingSend.retry()
      return
    }
    if (
      (!text.trim() && !attachments.hasAttachments && !referencedFiles) ||
      attachments.busy ||
      attachments.readyIds.length !== attachments.items.length ||
      (usesSelectedModel && !runModel.valid) ||
      !references.valid ||
      referenceLimitExceeded ||
      (!usesSelectedModel && references.hasReferences)
    )
      return
    setError('')
    // Persist the immutable send before POST. Receipt checks never start work.
    await pendingSend.submit({
      refreshCatalog: false,
      text,
      fileIds: attachments.readyIds,
      references: references.inputs,
      referenceSelection: references.snapshot,
      proposeToolsOnly: developer && proposeToolsOnly,
      systemOne: developer && systemOne,
      delivery: sendBehavior,
      ...(usesSelectedModel ? { runModel: runModel.selection } : {}),
    })
  }
  async function updateQueue(command: QueueCommand) {
    try {
      const result = await api<QueueResult>(`${path}/queue`, command)
      setMetadata((previous) => ({
        ...previous,
        queue: newestQueue(previous.queue, result.queue),
      }))
    } catch (error) {
      // Pull a fresh queue version after a conflicting edit, while preserving
      // the editor text so the person can decide whether to apply it again.
      if (error instanceof ApiError && [404, 409].includes(error.status)) {
        try {
          const current = await api<History>(`${path}/history`)
          setMetadata((previous) => ({
            ...previous,
            queue: newestQueue(previous.queue, current.queue),
          }))
        } catch {
          // Keep the original edit error. The stream can still refresh the queue.
        }
      }
      throw error
    }
  }
  async function approve(a: Approval, value: boolean) {
    setError('')
    try {
      await api(`${path}/approval`, { id: a.id, approve: value })
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const renderMessageThreads =
    destination.isMainConversation && onOpenThread
      ? (
          messageId: string,
          options: { canCreate: boolean; beforeOpen?: () => void },
        ) => (
          <MessageThreads
            destination={destination}
            messageId={messageId}
            threads={
              threads.error
                ? []
                : (threads.data?.items ?? []).filter(
                    (item) => item.sourceMessageId === messageId,
                  )
            }
            canCreate={
              options.canCreate &&
              !readOnly &&
              !threads.isPending &&
              !threads.error
            }
            onOpen={(thread, intent) => {
              options.beforeOpen?.()
              onOpenThread(thread, intent)
            }}
          />
        )
      : undefined
  const empty = !h?.messages.length && !pendingMessages.length
  const executionAvailable = Boolean(
    import.meta.env.DEV &&
    developer &&
    data.browserExecution &&
    !readOnly &&
    ExecutionSessionPanel,
  )
  const kodyAvailable = data.kodyConnected && data.policy.allowKody
  const desktopBrowser = useDesktopBrowserHost()
  useEffect(() => {
    if (
      desktopBrowser.ready &&
      !desktopBrowser.host &&
      !desktopBrowser.issue &&
      workspace?.state.tabs.includes('browser')
    ) {
      workspace.onClose('browser')
    }
  }, [
    desktopBrowser.ready,
    desktopBrowser.host,
    desktopBrowser.issue,
    workspace,
  ])
  const availablePanels = availableWorkspacePanels(
    executionAvailable,
    Boolean(desktopBrowser.host || desktopBrowser.issue),
    kodyAvailable,
    destination.workspaceId === `personal:${destination.userId}`,
  )
  const executionIdentity = {
    userId: destination.userId,
    workspaceId: destination.workspaceId,
    botId: destination.botId,
    conversationId: destination.conversationId,
  }
  const renderPanel = (tab: PanelId) => {
    if (tab === 'projects') {
      if (destination.workspaceId !== `personal:${destination.userId}`)
        return (
          <p role="status">
            Personal projects are unavailable in this workspace.
          </p>
        )
      return <ProjectsPanel userId={destination.userId} />
    }
    if (tab === 'browser')
      return (
        <DesktopBrowserPanel
          active={visible && workspace?.state.active === tab}
          profileId={destination.userId}
        />
      )
    if (tab === 'preview' && !workspacePreviewsEnabled)
      return (
        <p role="status">Workspace previews are unavailable in this alpha.</p>
      )
    if (tab === 'commands' || tab === 'preview') {
      if (!executionAvailable || !ExecutionSessionPanel)
        return <p role="status">Local execution is unavailable.</p>
      return (
        <Suspense fallback={<p role="status">Opening local execution…</p>}>
          <ExecutionSessionPanel
            identity={executionIdentity}
            mode={tab}
            historySessionId={
              tab === 'commands'
                ? executionHistorySession(
                    workspace?.executionHistory,
                    destination.conversationId,
                  )
                : undefined
            }
            onSelectHistorySession={
              tab === 'commands' ? workspace?.onSelectHistorySession : undefined
            }
            active={visible && workspace?.state.active === tab}
            onOpen={(panel) => workspace?.onOpen(panel)}
          />
        </Suspense>
      )
    }
    const resource = readFilePanel(tab)
    if (resource) {
      const shared = {
        botId: bot.id,
        destination,
        userId: data.user.id,
        onSource: (id: string) => workspace?.onOpen(`source:${id}`),
        onPreview: (id: string) => workspace?.onOpen(`file:${id}`),
        onCompare: (left: string, right: string) =>
          workspace?.onOpen(`diff:${left}:${right}`),
      }
      return resource.kind === 'diff' ? (
        <SavedFileDiffViewer
          {...shared}
          leftFileId={resource.beforeId}
          rightFileId={resource.afterId}
        />
      ) : (
        <SavedFileViewer
          {...shared}
          fileId={resource.fileId}
          mode={resource.kind === 'source' ? 'source' : 'preview'}
        />
      )
    }
    return tab === 'thread' ? (
      workspace?.renderThread(destination)
    ) : tab === 'schedules' ? (
      <Schedules
        onSelectMessage={(id) => {
          selectMessage(id)
          workspace?.onClosePane()
        }}
        botId={bot.id}
        userId={data.user.id}
        conversationId={destination.conversationId}
        readOnly={readOnly}
        runVersion={JSON.stringify(h?.runs?.map((run) => [run.id, run.status]))}
      />
    ) : tab === 'memory' ? (
      <MemoryPanel
        onSourceMessage={selectMessage}
        conversationId={destination.conversationId}
        userId={data.user.id}
        readOnly={readOnly}
        kodyAvailable={data.kodyConnected && data.policy.allowKody}
        kodyAccountScope={data.kodyUsername}
        runVersion={JSON.stringify(h?.runs?.map((run) => [run.id, run.status]))}
      />
    ) : tab === 'mail' ? (
      kodyAvailable ? (
        <KodyMail
          userId={data.user.id}
          accountScope={data.kodyUsername ?? data.user.id}
          visible={visible && workspace?.state.active === 'mail'}
        />
      ) : (
        <p role="status">Connect Kody to view mail.</p>
      )
    ) : tab === 'files' ? (
      <ConversationFiles
        botId={bot.id}
        destination={destination}
        userId={data.user.id}
        readOnly={readOnly}
        onOpen={navigation.onOpenFile}
      />
    ) : (
      <ConversationDetails
        tab={tab as 'summary' | 'usage' | 'activity'}
        history={h}
        workflows={
          tab === 'activity' ? (
            <WorkflowHistory
              model={runModel.valid ? runModel.selection : undefined}
              readOnly={readOnly}
              conversationId={destination.conversationId}
              userId={data.user.id}
            />
          ) : undefined
        }
        delegatedTasks={
          tab === 'summary' ? (
            <>
              {renderDelegatedTasks(true)}
              {destination.isMainConversation && onOpenThread && (
                <DelegatedTaskHistory
                  key={destination.conversationId}
                  destination={destination}
                  threads={threads.error ? [] : (threads.data?.items ?? [])}
                  onOpen={(child, intent) =>
                    onOpenThread(
                      child,
                      intent ? { ...intent, closeDetails: true } : undefined,
                    )
                  }
                />
              )}
            </>
          ) : undefined
        }
        taskUsage={
          tab === 'usage' && h.assistantTask ? (
            <TaskUsageDetails
              destination={destination}
              taskId={h.assistantTask.id}
              active={!!busy}
              visible={visible && workspace?.state.active === 'usage'}
            />
          ) : undefined
        }
        environment={{
          fixture: data.fixture,
          workspaceName: data.workspace.name,
          provider: requestModel
            ? (names[requestModel.provider] ?? requestModel.provider)
            : '',
          model: requestModel?.model ?? '',
          connections: [
            ...(data.kodyConnected
              ? [{ label: 'Kody', enabled: data.policy.allowKody }]
              : []),
            ...(data.mcpServers ?? []).map((server) => ({
              label: server.label,
              enabled: server.enabled && data.policy.allowMcp,
            })),
          ],
        }}
        developer={developer}
        execution={
          tab === 'summary' && executionAvailable && ExecutionSessionPanel ? (
            <Suspense fallback={<p role="status">Opening local execution…</p>}>
              <ExecutionSessionPanel
                identity={executionIdentity}
                mode="summary"
                active={visible && !!workspace?.details?.open}
                onOpen={(panel) => {
                  workspace?.details?.onOpenChange(false)
                  workspace?.onOpen(panel)
                }}
              />
            </Suspense>
          ) : undefined
        }
        onSelectMessage={(id) => {
          selectMessage(id)
          if (tab === 'summary') workspace?.details?.onOpenChange(false)
          else workspace?.onClosePane()
        }}
      />
    )
  }
  const stopResponse = async () => {
    if (!busy) throw new Error('This response has already stopped.')
    await api(`${path}/stop`, {})
  }
  useConversationPalette({
    id: destination.sessionKey,
    name: title ?? bot.name,
    available: visible,
    readOnly,
    locked: composerLocked,
    busy,
    workspace,
    availablePanels,
    model: runModel,
    messages: h.messages,
    files: savedFiles.data?.files ?? [],
    threads: threads.error ? [] : (threads.data?.items ?? []),
    onStop: stopResponse,
    onCompose: () => composerInput.current?.focus(),
    onReset: () => setReset(true),
    onMessage: selectMessage,
    messageLink: getMessageLink,
    onFork: forkMessage,
    onFile: navigation.onOpenFile,
    onThread: onOpenThread,
  })
  const content = (
    <>
      <style>{codeThemeCss}</style>
      <div
        data-command-scope={destination.sessionKey}
        className={`conversation ${isPersonalAssistant(bot) && !thread ? 'personal-assistant-chat ' : ''}${empty && !readOnly && !thread ? 'conversation-empty' : ''}${workspace ? ' conversation-details-host' : ''}`}
        data-details-open={(visible && workspace?.details?.open) || undefined}
        data-panel-motion={detailsMotion || undefined}
        ref={setChatArea}
      >
        {h.copyOrigin && (
          <ConversationOrigin
            botId={bot.id}
            destination={destination}
            userId={data.user.id}
            origin={h.copyOrigin}
          />
        )}
        <div
          className="messages-scroll"
          ref={setScrollElement}
          tabIndex={-1}
          role="region"
          aria-label="Conversation messages"
        >
          {thread && (
            <article
              className={`thread-source message ${thread.source.role}`}
              aria-label="Original message"
            >
              <div className="message-content">
                <MessageMarkdown>{thread.source.text}</MessageMarkdown>
              </div>
              {thread.source.truncated && <p>Source excerpt</p>}
            </article>
          )}
          {(!!h.archivedTurns || (!!search.message && !liveTarget)) && (
            <EarlierMessages
              visible={visible}
              focusIntent={
                selectedMessageFocus &&
                selectedMessageFocus.messageId === search.message
                  ? selectedMessageFocus.intent
                  : null
              }
              botId={bot.id}
              destination={destination}
              name={bot.name}
              targetMessageId={!liveTarget ? search.message : undefined}
              getMessageLink={getMessageLink}
              onFork={forkMessage}
              onRetry={retryMessage}
              retryDisabledReason={retryDisabledReason}
              renderMessageThreads={renderMessageThreads}
              onCloseTarget={() => navigation.onSelectMessage(undefined)}
            />
          )}
          {empty ? (
            !thread && (
              <div className="empty-state">
                {!thread && !retryEditing && (
                  <h1>What would you like to do?</h1>
                )}
              </div>
            )
          ) : (
            <VirtualMessages
              messageScope={destination.sessionKey}
              scrollElement={scrollElement}
              navigationItems={navigationItems}
              archive={{
                destination,
                count: h.archivedTurns ?? 0,
                epoch: h.transcriptEpoch,
              }}
              navigationRef={navigationRef}
              jumpToBottomContainer={jumpToBottomContainer}
              onSelectMessage={selectMessage}
              contentVersion={messageRevision}
              onJumpToBottom={() => navigation.onSelectMessage(undefined)}
            >
              {turns.map((turn, index, turns) => (
                <ConversationTurn
                  key={turn.id}
                  turn={turn}
                  messageScope={destination.sessionKey}
                  currentConversation={destination}
                  renderMessageThreads={renderMessageThreads}
                  name={bot.name}
                  simple={isPersonalAssistant(bot) && !thread}
                  timeMarker={(() => {
                    if (!isPersonalAssistant(bot) || thread) return undefined
                    const current =
                      turn.prompt?.createdAt ??
                      h.turnTimings?.[turn.id]?.startedAt
                    const previous =
                      index > 0
                        ? (turns[index - 1].prompt?.createdAt ??
                          h.turnTimings?.[turns[index - 1].id]?.startedAt)
                        : undefined
                    if (current == null) return undefined
                    return previous == null ||
                      Number(current) - Number(previous) > 20 * 60_000 ||
                      new Date(current).toDateString() !==
                        new Date(previous).toDateString()
                      ? Number(current)
                      : undefined
                  })()}
                  outcome={h.turnOutcomes?.[turn.id]}
                  receipts={h.toolReceipts?.[turn.id]}
                  inherited={h.inheritedTurns?.[turn.id]}
                  timing={h.turnTimings?.[turn.id]}
                  running={index === turns.length - 1 && !!busy}
                  waiting={
                    index === turns.length - 1 &&
                    (!!h.pendingTask ||
                      h.approvals.some(
                        (a) => a.status === 'pending' || a.status === 'running',
                      ))
                  }
                  failed={index === turns.length - 1 && h.status === 'error'}
                  failureReason={
                    index === turns.length - 1
                      ? h.error || chat.error?.message
                      : undefined
                  }
                  taskStatus={
                    turn.id === h.assistantTask?.messageId &&
                    (h.assistantTask.status === 'incomplete' ||
                      h.assistantTask.status === 'interrupted')
                      ? h.assistantTask.status
                      : undefined
                  }
                  results={toolResults}
                  expanded={expandedDetails}
                  setExpanded={setExpanded}
                  toolStates={h.toolStates}
                  approvals={h.approvals}
                  getMessageLink={getMessageLink}
                  targetMessageId={search.message}
                  onFork={forkMessage}
                  onRetry={retryMessage}
                  retryDisabledReason={retryDisabledReason}
                />
              ))}
              {renderDelegatedTasks()}
              {h.pendingTask && (
                <PendingTaskCard
                  key={h.pendingTask.id}
                  task={h.pendingTask}
                  guide={pendingPackageGuide(
                    h.pendingTask,
                    h.assistantTask?.observations,
                  )}
                  busy={!!busy}
                  disabled={readOnly}
                  onContinue={async () => {
                    setError('')
                    setSending(true)
                    try {
                      await api(`${path}/continue-task`, {
                        id: h.pendingTask!.id,
                      })
                    } catch (error) {
                      setError((error as Error).message)
                    } finally {
                      setSending(false)
                    }
                  }}
                  onDismiss={async () => {
                    setError('')
                    setSending(true)
                    try {
                      await api(`${path}/dismiss-task`, {
                        id: h.pendingTask!.id,
                      })
                    } catch (error) {
                      setError((error as Error).message)
                    } finally {
                      setSending(false)
                    }
                  }}
                />
              )}
              {h.approvals
                .filter(
                  (a) =>
                    a.status === 'pending' ||
                    (a.status === 'running' && !h.toolStates?.[a.id]) ||
                    a.status === 'error',
                )
                .map((a) => (
                  <ActionCard
                    key={a.id}
                    title={a.title}
                    icon={<Shield aria-hidden />}
                  >
                    {a.workspace ? (
                      <>
                        <WorkspaceReview approval={a} />
                        {a.result && <CodeBlock code={a.result} lang="json" />}
                      </>
                    ) : a.schedule ? (
                      <ScheduleReview approval={a} />
                    ) : a.kodyMemoryCreate ? (
                      <KodyMemoryCreateReview approval={a} />
                    ) : (
                      <>
                        <p>
                          {a.status === 'pending'
                            ? a.mcpTaskCall || a.assistantMcpCall
                              ? 'Run this call on ' +
                                (a.mcpTaskCall || a.assistantMcpCall)!.entry
                                  .serverLabel +
                                '?'
                              : 'This will run code with access to your Kody tools and connections.'
                            : a.status === 'running'
                              ? a.mcpTaskCall || a.assistantMcpCall
                                ? 'Running call…'
                                : 'Running in Kody…'
                              : a.result}
                        </p>
                        <details
                          open={!!expandedDetails[a.id]}
                          onToggle={(event) =>
                            setExpanded(a.id, event.currentTarget.open)
                          }
                        >
                          <summary>
                            {a.mcpTaskCall || a.assistantMcpCall
                              ? 'Review call'
                              : 'Review code'}
                          </summary>
                          {a.code && (
                            <CodeBlock code={a.code} lang="typescript" />
                          )}
                          {(a.mcpTaskCall || a.assistantMcpCall) && (
                            <CodeBlock
                              code={JSON.stringify(
                                {
                                  server: (a.mcpTaskCall || a.assistantMcpCall)!
                                    .entry.serverLabel,
                                  tool: (a.mcpTaskCall || a.assistantMcpCall)!
                                    .entry.name,
                                  arguments: (a.mcpTaskCall ||
                                    a.assistantMcpCall)!.arguments,
                                  transport: a.mcpTaskCall?.transport,
                                },
                                null,
                                2,
                              )}
                              lang="json"
                            />
                          )}
                          {a.action && (
                            <CodeBlock
                              code={JSON.stringify(a.action.input, null, 2)}
                              lang="json"
                            />
                          )}
                        </details>
                      </>
                    )}
                    {a.status === 'pending' && (
                      <div className="ui-action-card-actions">
                        <Button
                          variant="primary"
                          disabled={busy || readOnly}
                          onClick={() => void approve(a, true)}
                        >
                          <Play size={14} />
                          {a.workspace
                            ? a.workspace.operation.type === 'write_file'
                              ? 'Approve and write'
                              : 'Approve and run'
                            : a.schedule
                              ? a.schedule.command.type === 'create'
                                ? 'Create schedule'
                                : 'Save schedule'
                              : a.kodyMemoryCreate
                                ? a.executionOutcome === 'unknown'
                                  ? 'Retry save'
                                  : 'Save memory'
                                : 'Approve and run'}
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busy || readOnly}
                          onClick={() => void approve(a, false)}
                        >
                          {a.schedule || a.kodyMemoryCreate
                            ? 'Cancel'
                            : 'Decline'}
                        </Button>
                      </div>
                    )}
                  </ActionCard>
                ))}
              {pendingMessages.map((pendingMessage, index) => (
                <PendingMessage
                  key={pendingMessage.payload.messageId}
                  text={pendingMessage.payload.text}
                  fileCount={pendingMessage.payload.fileIds.length}
                  uncertain={
                    pendingSend.pending?.payload.messageId ===
                      pendingMessage.payload.messageId &&
                    (!!pendingSend.error ||
                      (!pendingSend.busy &&
                        !pendingSend.submitted.some(
                          (item) =>
                            item.payload.messageId ===
                            pendingMessage.payload.messageId,
                        )))
                  }
                  thinking={
                    index === pendingMessages.length - 1 &&
                    pendingSend.submitted.some(
                      (item) =>
                        item.payload.messageId ===
                        pendingMessage.payload.messageId,
                    ) &&
                    !busy &&
                    !waiting &&
                    !h.queue?.items.length
                  }
                />
              ))}
            </VirtualMessages>
          )}
        </div>
        <div className="composer-area" ref={composerArea}>
          <div className="message-jump-anchor" ref={setJumpToBottomContainer} />
          <RetryPreparation preparation={retryPreparation} />
          {!retryEditing && metadata.resetRetry && (
            <div className="retry-preparation">
              <button
                type="button"
                className="quiet-button"
                onClick={() => {
                  setRetainedRetryAttemptId(metadata.resetRetry!.attemptId)
                  setFinishedRetry(undefined)
                }}
              >
                Review previous retry draft
              </button>
            </div>
          )}
          {recoveredRetry && (
            <RetryDraftRecovery
              document={recoveredRetry}
              busy={pendingSend.busy}
              onContinue={() => {
                const state = activeRetryEditor.current?.snapshot()
                if (state?.dirty || state?.saving) {
                  setRecoveredRetry(undefined)
                  setError(
                    'Review the unsaved edits in the retry editor before continuing.',
                  )
                  return
                }
                retryFocus.current?.cancel()
                retryFocus.current = captureComposerFocus(
                  composerArea.current,
                  visible && !readOnly,
                )
                reviewedRetry.current = recoveredRetry.consumed!.messageId
                setFinishedRetry(recoveredRetry.seed.attemptId)
                setRecoveredRetry(undefined)
                void pendingSend.check()
              }}
            />
          )}
          {h.copyOrigin && (
            <ConversationActionEvidence
              key={`${destination.sessionKey}:${h.copyOrigin.operationId}`}
              destination={destination}
              operationId={h.copyOrigin.operationId}
              editorVisible={
                visible && retryEditing && retryEditorMounted && !recoveredRetry
              }
              visible={visible}
            />
          )}
          {retryAttemptId && (
            <RetryBranch
              key={retryAttemptId}
              destination={destination}
              attemptId={retryAttemptId}
              originMissing={currentRetryAttemptId !== retryAttemptId}
              resetConfirmed={metadata.resetRetry?.attemptId === retryAttemptId}
              editing={retryEditing}
              pending={pendingSend}
              readOnly={readOnly}
              visible={visible && !recoveredRetry}
              onEditor={registerRetryEditor}
              onSent={(handoff) => {
                retryFocus.current?.cancel()
                if (visible && !readOnly) retryFocus.current = handoff
                else {
                  handoff?.cancel()
                  retryFocus.current = undefined
                }
                setFinishedRetry(retryAttemptId)
                void refresh()
              }}
            />
          )}
          <QueuedMessages
            queue={h.queue}
            running={busy}
            waiting={waiting}
            disabled={readOnly}
            onCommand={updateQueue}
            getModelLabel={(selection) => {
              const choice = runModel.catalog?.choices.find(
                (item) =>
                  item.selection.provider === selection.provider &&
                  item.selection.model === selection.model,
              )
              return choice
                ? `${choice.providerLabel} / ${choice.label}`
                : `${names[selection.provider] ?? selection.provider} / ${selection.model}`
            }}
          />
          {((!retryEditing && pendingSend.error) ||
            error ||
            (!turns.length && (h?.error || chat.error))) && (
            <div className="error" role="alert">
              <CircleAlert size={17} />
              {(!retryEditing && pendingSend.error) ||
                error ||
                (!turns.length && (h?.error || chat.error?.message))}
            </div>
          )}
          {!retryEditing &&
            !pendingSend.busy &&
            (pendingSend.pending || !pendingSend.ready) && (
              <div className="queue-controls">
                <span role="status">
                  {pendingSend.pending
                    ? 'Send not confirmed.'
                    : 'Send recovery unavailable.'}
                </span>
                <button type="button" onClick={() => void pendingSend.check()}>
                  Check again
                </button>
              </div>
            )}
          {readOnly ? (
            <p role="status" className="bot-readonly">
              {initialHistory.workflowWorker ? (
                <>
                  Workflow step: {initialHistory.workflowWorker.stepId}.{' '}
                  <Link
                    {...conversationLocation(
                      {
                        workspaceId: destination.workspaceId,
                        botId: destination.botId,
                        conversationId:
                          initialHistory.workflowWorker.ownerConversationId,
                      },
                      {
                        ...defaultWorkspaceSearch,
                        panel: 'activity',
                        panels: ['activity'],
                      },
                    )}
                  >
                    Open workflow activity
                  </Link>
                </>
              ) : bot.deleted_at ? (
                'This conversation is in Trash. Restore it to continue.'
              ) : thread?.archivedAt ? (
                'This thread is archived. Restore it to continue.'
              ) : (
                <>
                  This conversation is archived.{' '}
                  <Button
                    variant="link"
                    disabled={unarchiving}
                    onClick={() => void unarchive()}
                  >
                    {unarchiving ? 'Unarchiving…' : 'Unarchive'}
                  </Button>{' '}
                  it to continue.
                </>
              )}
            </p>
          ) : !retryEditing ? (
            <form
              className="composer"
              onSubmit={(e) => void send(e)}
              onDrop={attachments.onDrop}
              onDragOver={attachments.onDragOver}
              onPaste={attachments.onPaste}
            >
              {pendingSend.pending && (
                <div className="composer-frozen-references">
                  {!!pendingSend.pending.payload.fileIds.length && (
                    <span>
                      {pendingSend.pending.payload.fileIds.length}{' '}
                      {pendingSend.pending.payload.fileIds.length === 1
                        ? 'attachment'
                        : 'attachments'}{' '}
                      included
                    </span>
                  )}
                  {!!pendingSend.pending.payload.references?.length && (
                    <span>
                      {pendingSend.pending.payload.references.length}{' '}
                      {pendingSend.pending.payload.references.length === 1
                        ? 'reference'
                        : 'references'}{' '}
                      included
                    </span>
                  )}
                </div>
              )}
              <ComposerAttachments
                attachments={attachments}
                disabled={composerLocked}
                hidden={!!pendingSend.pending}
                sketchDisabledReason={sketchDisabledReason}
                renderPicker={(choose, chooseSketch) => (
                  <ComposerReferences
                    picker={referencePicker}
                    references={references}
                    userId={data.user.id}
                    botId={bot.id}
                    destination={destination}
                    disabled={composerLocked}
                    disabledReason={
                      usesSelectedModel
                        ? undefined
                        : 'References require Assistant mode. Switch modes or remove them.'
                    }
                    uploadedFileIds={attachments.items.map((item) => item.id)}
                    onUpload={choose}
                    onSketch={chooseSketch}
                    sketchDisabledReason={sketchDisabledReason}
                    mention={usesSelectedModel ? referenceTrigger : null}
                    composerInput={composerInput}
                    onCloseMention={() => {
                      if (referenceTrigger)
                        requestAnimationFrame(() =>
                          composerInput.current?.focus(),
                        )
                      setReferenceTrigger(null)
                    }}
                    onSelected={(trigger) => {
                      const removed = trigger
                        ? removeReferenceTrigger(
                            composerInput.current?.value ?? input,
                            trigger,
                          )
                        : {
                            text: composerInput.current?.value ?? input,
                            caret: null,
                          }
                      if (trigger) setInput(removed.text)
                      requestAnimationFrame(() => {
                        composerInput.current?.focus()
                        if (removed.caret !== null)
                          composerInput.current?.setSelectionRange(
                            removed.caret,
                            removed.caret,
                          )
                      })
                    }}
                  />
                )}
              />
              <DraftSyncNotice sync={draftSync} />
              <DraftSyncNotice sync={references.sync} kind="references" />
              <DraftSyncNotice sync={attachments.sync} kind="attachments" />
              <textarea
                ref={composerInput}
                aria-label={
                  title ? `Message in ${title}` : `Message ${bot.name}`
                }
                placeholder={
                  references.hasReferences && !referencedFiles && !input.trim()
                    ? 'What would you like to do with these?'
                    : isPersonalAssistant(bot) && !thread
                      ? 'Send a message'
                      : 'Do anything'
                }
                value={pendingSend.pending ? '' : input}
                readOnly={composerLocked}
                maxLength={12000}
                onChange={(e) => {
                  setInput(e.target.value)
                  if (
                    !composerLocked &&
                    usesSelectedModel &&
                    !(e.nativeEvent as InputEvent).isComposing
                  )
                    setReferenceTrigger(
                      findReferenceTrigger(
                        e.target.value,
                        e.target.selectionStart,
                        e.target.selectionEnd,
                      ),
                    )
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault()
                    void send()
                  }
                }}
                rows={isPersonalAssistant(bot) && !thread ? 1 : 2}
              />
              <div className="composer-toolbar">
                <div className="composer-toolbar-main">
                  <ComposerAddButton
                    handle={referencePicker}
                    disabled={composerLocked}
                  />
                  {usesSelectedModel &&
                    !(isPersonalAssistant(bot) && !thread) && (
                      <RunModelPicker
                        model={runModel}
                        selection={
                          pendingSend.pending
                            ? (pendingSend.pending.payload.runModel ?? null)
                            : runModel.selection
                        }
                        disabled={composerLocked}
                        frozen={!!pendingSend.pending}
                      />
                    )}
                  {developer && !(isPersonalAssistant(bot) && !thread) && (
                    <SelectField
                      aria-label="Response mode"
                      value={
                        systemOne && developer
                          ? 'system-one'
                          : developer && proposeToolsOnly
                            ? 'tools'
                            : 'assistant'
                      }
                      disabled={!!busy || composerLocked}
                      onValueChange={(value) => {
                        setSystemOne(value === 'system-one')
                        setProposeToolsOnly(value !== 'assistant')
                      }}
                      items={[
                        {
                          value: 'tools',
                          label: 'Find a tool',
                        },
                        ...(developer
                          ? [
                              {
                                value: 'system-one',
                                label: 'System One experiment',
                              },
                            ]
                          : []),
                        {
                          value: 'assistant',
                          label: 'Assistant',
                        },
                      ]}
                    />
                  )}
                  {developer && !(isPersonalAssistant(bot) && !thread) && (
                    <span>
                      <span className="tiny-dot" />
                      {data.fixture
                        ? 'Preview'
                        : systemOne && developer
                          ? 'Jev only'
                          : developer && proposeToolsOnly
                            ? 'Jev + discovery'
                            : names[data.connection.provider]}
                    </span>
                  )}
                </div>
                <div className="composer-toolbar-actions">
                  {!(isPersonalAssistant(bot) && !thread) && (
                    <ContextIndicator
                      steps={h.usageSteps ?? []}
                      taskId={h.assistantTask?.id}
                      transcriptEpoch={h.transcriptEpoch}
                      visible={visible}
                    />
                  )}
                  {busy && (
                    <button
                      className="send stop"
                      type="button"
                      aria-label="Stop response"
                      onClick={() =>
                        void stopResponse().catch((e) => setError(e.message))
                      }
                    >
                      <Square size={16} />
                    </button>
                  )}
                  {(!busy ||
                    !!input.trim() ||
                    attachments.hasAttachments ||
                    references.hasReferences ||
                    pendingSend.pending) && (
                    <button
                      className="send"
                      type="submit"
                      disabled={
                        sending ||
                        !pendingSend.ready ||
                        (!pendingSend.pending &&
                          (attachments.busy ||
                            (usesSelectedModel && !runModel.valid) ||
                            !references.valid ||
                            referenceLimitExceeded ||
                            (!usesSelectedModel && references.hasReferences) ||
                            attachments.readyIds.length !==
                              attachments.items.length ||
                            !hasMessageContent))
                      }
                      aria-label={
                        pendingSend.pending
                          ? 'Retry send'
                          : busy && sendBehavior === 'interrupt'
                            ? 'Interrupt and send'
                            : busy || waiting || !!h.queue?.items.length
                              ? 'Queue message'
                              : 'Send message'
                      }
                    >
                      {sending ? (
                        <LoaderCircle
                          size={20}
                          className="animate-spin"
                          aria-hidden
                        />
                      ) : pendingSend.pending ? (
                        <RotateCcw size={20} />
                      ) : (
                        <ArrowUp size={20} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </form>
          ) : null}
        </div>
      </div>
      {reset && (
        <Dialog
          title="Start a fresh conversation?"
          onClose={() => setReset(false)}
        >
          <p>
            Your instructions, settings and saved actions stay. This removes
            this conversation’s messages and pending approvals.
          </p>
          <div className="button-row">
            <button className="secondary" onClick={() => setReset(false)}>
              Cancel
            </button>
            <button
              className="primary"
              onClick={() =>
                void api(`${path}/reset`, {})
                  .then(() => {
                    setReset(false)
                  })
                  .catch((e) => setError(e.message))
              }
            >
              Start fresh
            </button>
          </div>
        </Dialog>
      )}
    </>
  )
  if (!workspace) return content
  return (
    <ConversationDetailsCard
      anchor={chatArea}
      animate={detailsMotion}
      visible={visible}
      open={visible && !!workspace.details?.open}
      onOpenChange={(open, options) =>
        workspace.details?.onOpenChange(open, options)
      }
      details={renderPanel('summary')}
    >
      <ConversationWorkspace
        {...workspace}
        availablePanels={availablePanels}
        getPanelName={(id) => {
          if (id === 'thread') return workspace.threadTitle
          const resource = readFilePanel(id)
          if (!resource) return
          const name = (fileId: string) => {
            const files = savedFiles.data?.files ?? []
            const file = files.find((candidate) => candidate.id === fileId)
            if (!file) return
            const sameName = files
              .filter((candidate) => candidate.name === file.name)
              .sort(
                (left, right) =>
                  left.createdAt - right.createdAt ||
                  left.id.localeCompare(right.id),
              )
            return sameName.length > 1
              ? `${file.name} · ${sameName.findIndex((candidate) => candidate.id === fileId) + 1}/${sameName.length}`
              : file.name
          }
          if (resource.kind === 'diff') {
            const before = name(resource.beforeId)
            const after = name(resource.afterId)
            return before && after ? `${before} → ${after}` : undefined
          }
          const fileName = name(resource.fileId)
          return (
            fileName &&
            (resource.kind === 'source' ? `${fileName} source` : fileName)
          )
        }}
        renderPanel={renderPanel}
      >
        {header}
        {content}
      </ConversationWorkspace>
    </ConversationDetailsCard>
  )
}
