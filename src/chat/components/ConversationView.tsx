import { useWorkspaceSearch } from './useWorkspaceSearch'
import { useMobileBack } from './mobile-back'
import { ArrowLeft } from 'lucide-react'
import { LoadingState } from './ui/LoadingState'
import { motion, useReducedMotion } from 'motion/react'
import { useUiTransition } from './ui/motion'
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Bootstrap, History } from './App'
import type { WorkspaceBot } from '../core/bot-workspace'
import type {
  ThreadSummary,
  ThreadListItem,
} from '../core/conversation-threads'
import {
  conversationLocation,
  type ConversationDestination,
} from '../core/conversation-destination'
import {
  clearConversationFilePanels,
  closeWorkspacePanel,
  openWorkspacePanel,
  readPanelState,
  togglePanelFullscreen,
} from '../core/workspace-panels'
import {
  selectExecutionHistory,
  validateWorkspaceSearch,
  type WorkspaceSearch,
} from '../core/navigation'
import { useWorkspaceApi } from './WorkspaceApi'
import { conversationRouteQuery } from './conversationRouteQuery'
import {
  ConversationSession,
  type SessionWorkspace,
} from './ConversationSession'
import { ThreadPanel, type ThreadOpenIntent } from './ConversationThreads'
import { threadAccessDenied } from './conversation-thread-state'
import { ThreadTitle } from './ThreadTitle'
import { useConversationNavigatorScope } from './ConversationNavigatorScope'
import type { ComposerFocusHandoff } from './composer-focus'
import { useUrlMessageFocus } from './useUrlMessageFocus'
import { createMessageFocusIntent, type UrlMessageFocus } from './message-focus'

type ViewProps = {
  conversationId?: string
  visible: boolean
  bot: WorkspaceBot
  data: Bootstrap
  detailsTrigger: RefObject<HTMLButtonElement | null>
  developer: boolean
  refresh: () => Promise<unknown>
  onFork?: (messageId: string, conversationId?: string) => void
  focusAfterCreate?: ComposerFocusHandoff
  embeddedThread?: ThreadSummary
  header?: ReactNode
}

/** Authorize the exact destination before mounting its one session owner. */
export function ConversationView(props: ViewProps) {
  const routeSearch = useWorkspaceSearch()
  const messageFocus = useUrlMessageFocus(
    props.embeddedThread ? routeSearch.threadMessage : routeSearch.message,
    props.visible,
  )
  const { request: api, workspaceId } = useWorkspaceApi()
  const queries = useQueryClient()
  const [opened, setOpened] = useState<{
    snapshot: History
    destination: ConversationDestination
  }>()
  const history = useQuery({
    ...conversationRouteQuery({
      queries,
      request: api,
      workspaceId,
      bot: props.bot,
      conversationId: props.conversationId,
      userId: props.data.user.id,
    }),
  })
  useEffect(() => {
    if (history.data && (history.isFetchedAfterMount || !history.isStale))
      setOpened((existing) => existing ?? history.data)
  }, [history.isFetchedAfterMount, history.isStale, history.data])
  if (history.error)
    return (
      <>
        {props.header}
        <div className="error" role="alert">
          {history.error.message}{' '}
          <button onClick={() => void history.refetch()}>Retry</button>
        </div>
      </>
    )
  const ready = opened ?? (!history.isStale ? history.data : undefined)
  if (!ready)
    return (
      <>
        {props.header}
        <LoadingState inset>Opening conversation…</LoadingState>
      </>
    )
  return (
    <RoutedConversation
      key={ready.destination.sessionKey}
      {...props}
      opened={ready}
      messageFocus={messageFocus}
    />
  )
}

function RoutedConversation({
  opened,
  messageFocus,
  ...props
}: ViewProps & {
  opened: { snapshot: History; destination: ConversationDestination }
  messageFocus?: UrlMessageFocus
}) {
  const { destination } = opened
  const navigator = useConversationNavigatorScope()
  const reducedMotion = useReducedMotion()
  const entranceTransition = useUiTransition(0.22)
  const depth =
    (navigator.family.members.find((item) => item.bot.id === destination.botId)
      ?.depth ?? 0) + (destination.isMainConversation ? 0 : 1)
  const [direction] = useState(() =>
    navigator.navigationDepth.current === null
      ? 0
      : Math.sign(depth - navigator.navigationDepth.current),
  )
  useEffect(() => {
    if (!props.embeddedThread) navigator.navigationDepth.current = depth
  }, [depth, navigator.navigationDepth, props.embeddedThread])
  const requiresThread =
    !destination.isMainConversation && !opened.snapshot.workflowWorker
  const { request } = useWorkspaceApi()
  const navigate = useNavigate()
  const router = useRouter()
  const search = useWorkspaceSearch()
  const embedded = !!props.embeddedThread
  const paneFocus = useRef<HTMLButtonElement | null>(null)
  const [threadFocus, setThreadFocus] = useState<{
    id: string
    intent: ThreadOpenIntent
  }>()
  const [explicitMessageFocus, setExplicitMessageFocus] =
    useState<UrlMessageFocus>()
  useEffect(
    () => () => explicitMessageFocus?.intent?.cancel(),
    [explicitMessageFocus],
  )
  useEffect(() => () => threadFocus?.intent.handoff.cancel(), [threadFocus])
  const state = readPanelState(search)
  const descriptor = useQuery({
    queryKey: [
      'conversation-thread',
      destination.workspaceId,
      destination.userId,
      destination.conversationId,
    ],
    queryFn: async () => {
      const value = await request<ThreadSummary>(
        `${destination.apiPath}/thread`,
      )
      if (
        value.conversationId !== destination.conversationId ||
        value.botId !== destination.botId ||
        value.parentConversationId === destination.conversationId
      )
        throw new Error(
          'This thread does not match the requested conversation.',
        )
      return value
    },
    enabled: requiresThread && !embedded,
    retry: false,
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchInterval: props.visible ? 5000 : false,
    refetchIntervalInBackground: false,
  })
  const verified = useRef<ThreadSummary | undefined>(undefined)
  if (threadAccessDenied(descriptor.error)) verified.current = undefined
  else if (
    (descriptor.isFetchedAfterMount || !descriptor.isStale) &&
    descriptor.data &&
    !descriptor.error
  )
    verified.current = descriptor.data
  const thread = props.embeddedThread ?? verified.current
  const move = (next: WorkspaceSearch) =>
    void navigate({
      ...conversationLocation(destination, next),
      resetScroll: false,
    })
  const change = (
    update: (previous: WorkspaceSearch) => WorkspaceSearch,
    options?: { replace?: boolean },
  ) =>
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) =>
        update(validateWorkspaceSearch(previous)),
      resetScroll: false,
      replace: options?.replace,
    })
  useEffect(() => {
    if (
      !embedded &&
      search.executionHistory &&
      search.executionHistory.conversationId !== destination.conversationId
    )
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => {
          const current = validateWorkspaceSearch(previous)
          // Do not remove a newer selection made after this render.
          return current.executionHistory?.conversationId ===
            search.executionHistory?.conversationId &&
            current.executionHistory?.sessionId ===
              search.executionHistory?.sessionId
            ? selectExecutionHistory(
                current,
                destination.conversationId,
                undefined,
              )
            : current
        },
        replace: true,
        resetScroll: false,
      })
  }, [
    embedded,
    destination.conversationId,
    search.executionHistory?.conversationId,
    search.executionHistory?.sessionId,
    navigate,
  ])
  const selectMessage = (message?: string) =>
    change((previous) =>
      embedded
        ? { ...previous, threadMessage: message }
        : { ...previous, message },
    )
  const closePane = () =>
    change((previous) => ({
      ...previous,
      panelHidden: true,
    }))
  const openThread = (next: ThreadListItem, intent?: ThreadOpenIntent) => {
    if (
      !destination.isMainConversation ||
      next.parentConversationId !== destination.conversationId ||
      next.conversationId === destination.conversationId
    )
      return
    intent?.handoff.cancel()
    if (navigator.layout.wide)
      navigator.setLayout((current) => ({ ...current, dockOverride: true }))
    navigator.setOverlayOpen(false)
    void navigate({
      ...conversationLocation(
        { ...destination, conversationId: next.conversationId },
        {
          ...clearConversationFilePanels(search),
          thread: undefined,
          threadMessage: undefined,
          message: intent?.messageId,
          panel: undefined,
          panels: undefined,
          fullscreen: undefined,
          details: undefined,
        },
      ),
      resetScroll: false,
    })
  }
  const getMessageLink = (message: string) => {
    const target = router.buildLocation(
      conversationLocation(destination, {
        ...clearConversationFilePanels(search),
        message,
        panel: undefined,
        panels: undefined,
        fullscreen: undefined,
      }),
    )
    return new URL(target.href, window.location.origin).href
  }
  const openFile = (id: string) => {
    // A file selected inside a thread keeps that thread's exact resource owner.
    const next = embedded ? clearConversationFilePanels(search) : search
    move(openWorkspacePanel({ ...next, message: undefined }, `file:${id}`))
  }
  const workspace: SessionWorkspace | undefined = embedded
    ? undefined
    : {
        state,
        executionHistory: search.executionHistory,
        onSelectHistorySession: (id) =>
          change((previous) =>
            selectExecutionHistory(previous, destination.conversationId, id),
          ),
        details: {
          open: search.details === true,
          onOpenChange: (open, options) =>
            change(
              (previous) => ({ ...previous, details: open || undefined }),
              options,
            ),
        },
        focusActiveTab: !(
          state.active === 'thread' && threadFocus?.id === search.thread
        ),
        storageKey: JSON.stringify([
          'gum',
          'workspace-pane',
          destination.userId,
          destination.workspaceId,
          destination.conversationId,
        ]),
        returnFocus: paneFocus.current?.isConnected
          ? paneFocus
          : props.detailsTrigger,
        onOpen: (id) => change((previous) => openWorkspacePanel(previous, id)),
        onClose: (id) =>
          change((previous) => closeWorkspacePanel(previous, id)),
        onClosePane: closePane,
        onFullscreen: () => change(togglePanelFullscreen),
        threadTitle: search.thread ? 'Thread' : undefined,
        renderThread: (parent) =>
          search.thread &&
          destination.isMainConversation &&
          search.thread !== destination.conversationId ? (
            <ThreadPanel
              key={search.thread}
              parent={parent}
              readOnly={!!props.bot.archived_at || !!props.bot.deleted_at}
              threadId={search.thread}
              active={props.visible && state.active === 'thread'}
              onReturn={(message) => {
                if (message)
                  setExplicitMessageFocus({
                    messageId: message,
                    intent: createMessageFocusIntent(),
                  })
                move({
                  ...search,
                  message,
                  panel: undefined,
                  panels: undefined,
                  fullscreen: undefined,
                })
              }}
              onOpenFull={(value) =>
                void navigate({
                  ...conversationLocation(
                    {
                      workspaceId: destination.workspaceId,
                      botId: destination.botId,
                      conversationId: value.conversationId,
                    },
                    {
                      ...clearConversationFilePanels(search),
                      message: search.threadMessage,
                    },
                  ),
                  resetScroll: false,
                })
              }
            >
              {(value) => (
                <ConversationView
                  key={value.conversationId}
                  {...props}
                  conversationId={value.conversationId}
                  embeddedThread={value}
                  header={undefined}
                  visible={props.visible && state.active === 'thread'}
                  focusAfterCreate={
                    threadFocus?.id === value.conversationId &&
                    !threadFocus.intent.messageId
                      ? threadFocus.intent.handoff
                      : undefined
                  }
                />
              )}
            </ThreadPanel>
          ) : (
            <p role="alert">This thread is unavailable.</p>
          ),
      }
  useMobileBack(
    props.visible &&
      !!thread &&
      (embedded || state.active !== 'thread' || !!state.hidden),
    () => {
      if (!thread) return
      void navigate({
        ...conversationLocation(
          {
            workspaceId: destination.workspaceId,
            botId: thread.botId,
            conversationId: thread.parentConversationId,
          },
          {
            ...clearConversationFilePanels(search),
            message: thread.sourceMessageId,
          },
        ),
        resetScroll: false,
      })
    },
  )
  if (requiresThread && !embedded && descriptor.error && !thread)
    return (
      <>
        {props.header}
        <p role="alert" className="error">
          {descriptor.error.message}{' '}
          <button onClick={() => void descriptor.refetch()}>Retry</button>
        </p>
      </>
    )
  if (requiresThread && !thread)
    return (
      <>
        {props.header}
        <LoadingState inset>Opening thread…</LoadingState>
      </>
    )
  const hierarchy: {
    id: string
    botId: string
    title: string
    messageId?: string
  }[] = []
  if (thread) {
    const available = [
      ...(navigator.threads.data?.items ?? []),
      ...(navigator.selectedThreads.data?.items ?? []),
    ]
    const seen = new Set<string>([thread.conversationId])
    let child: ThreadListItem = thread
    while (!seen.has(child.parentConversationId)) {
      seen.add(child.parentConversationId)
      const parent = available.find(
        (item) => item.conversationId === child.parentConversationId,
      )
      hierarchy.unshift({
        id: child.parentConversationId,
        botId: child.botId,
        title: parent?.title ?? props.bot.name,
        messageId: child.sourceMessageId,
      })
      if (!parent) break
      child = parent
    }
    let bot = props.bot
    const botIds = new Set([bot.id])
    while (bot.parent_id && !botIds.has(bot.parent_id)) {
      const parent = props.data.bots.find((item) => item.id === bot.parent_id)
      if (!parent?.mainConversationId) break
      botIds.add(parent.id)
      hierarchy.unshift({
        id: parent.mainConversationId,
        botId: parent.id,
        title: parent.name,
      })
      bot = parent
    }
  }
  const header = (
    <>
      {props.header}
      {!embedded && thread && (
        <>
          {descriptor.error && (
            <p className="error" role="alert">
              Thread details could not be refreshed.{' '}
              <button onClick={() => void descriptor.refetch()}>Retry</button>
            </p>
          )}
          {!navigator.layout.wide && !navigator.overlayOpen && (
            <nav
              className="thread-heading thread-hierarchy"
              aria-label="Conversation hierarchy"
            >
              {hierarchy.map((entry, index) => (
                <button
                  key={entry.id}
                  type="button"
                  className="quiet-button thread-hierarchy-entry"
                  style={{ paddingInlineStart: 8 + index * 12 }}
                  title={entry.title}
                  onClick={() =>
                    void navigate({
                      ...conversationLocation(
                        {
                          workspaceId: destination.workspaceId,
                          botId: entry.botId,
                          conversationId: entry.id,
                        },
                        {
                          ...clearConversationFilePanels(search),
                          message: entry.messageId,
                        },
                      ),
                      resetScroll: false,
                    })
                  }
                >
                  <ArrowLeft size={14} aria-hidden />
                  <span>{entry.title}</span>
                </button>
              ))}
              <div
                className="thread-hierarchy-current"
                style={{ paddingInlineStart: 8 + hierarchy.length * 12 }}
                aria-current="page"
              >
                <ThreadTitle
                  userId={destination.userId}
                  thread={thread}
                  disabled={
                    !!props.bot.archived_at ||
                    !!props.bot.deleted_at ||
                    !!descriptor.error
                  }
                />
              </div>
            </nav>
          )}
        </>
      )}
    </>
  )
  const session = (
    <ConversationSession
      key={destination.sessionKey}
      {...props}
      developer={props.developer && destination.isMainConversation}
      destination={destination}
      initialHistory={opened.snapshot}
      onRetryReady={async (target, signal) => {
        if (signal.aborted) return false
        await props.refresh()
        if (signal.aborted) return false
        await navigate({
          ...conversationLocation(
            { ...target, workspaceId: destination.workspaceId },
            {
              ...clearConversationFilePanels(search),
              view: 'bots',
              q: '',
              draft: undefined,
              parent: undefined,
              message: undefined,
              thread: undefined,
              threadMessage: undefined,
            },
          ),
          resetScroll: false,
        })
        return true
      }}
      header={header}
      workspace={workspace}
      thread={thread}
      title={thread ? 'thread' : undefined}
      onOpenThread={destination.isMainConversation ? openThread : undefined}
      navigation={{
        messageFocus,
        messageId: embedded ? search.threadMessage : search.message,
        explicitMessageFocus,
        onSelectMessage: selectMessage,
        getMessageLink,
        onOpenFile: openFile,
      }}
    />
  )
  if (!embedded)
    return (
      <motion.div
        className="full-thread-conversation"
        initial={
          direction && !reducedMotion
            ? { opacity: 0, x: direction * 36 }
            : false
        }
        animate={{ opacity: 1, x: 0 }}
        transition={entranceTransition}
      >
        {session}
      </motion.div>
    )
  return session
}
