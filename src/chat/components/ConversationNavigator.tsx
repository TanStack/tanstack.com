import { useWorkspaceSearch } from './useWorkspaceSearch'
import { conversationLocation } from '../core/conversation-destination'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { Collapsible } from '@base-ui/react/collapsible'
import { Popover } from '@base-ui/react/popover'
import { useNavigate } from '@tanstack/react-router'
import { Search, Spool, X } from 'lucide-react'
import type { ThreadListItem } from '../core/conversation-threads'
import { filterConversationNames } from '../core/conversation-family'
import type { WorkspaceBot } from '../core/bot-workspace'
import {
  clearConversationFilePanels,
  readPanelState,
} from '../core/workspace-panels'
import { validateWorkspaceSearch } from '../core/navigation'
import { ThreadLink, type ThreadOpenIntent } from './ConversationThreads'
import { composerFocusHandoff } from './composer-focus'
import { IconButton } from './IconButton'
import { useNavigatorResize } from './useNavigatorResize'
import { useConversationNavigatorScope } from './ConversationNavigatorScope'
import './conversation-card.css'
import './conversation-navigator.css'

const NavigatorContext = createContext<{
  open: boolean
  hasItems: boolean
  panelId: string
  handle: ReturnType<typeof Popover.createHandle>
  trigger: RefObject<HTMLButtonElement | null>
} | null>(null)
export function ConversationNavigatorToggle() {
  const panel = useContext(NavigatorContext)
  if (!panel?.hasItems) return null
  return (
    <Popover.Trigger
      handle={panel.handle}
      ref={panel.trigger}
      render={
        <IconButton
          label="Threads and conversations"
          tooltip={
            panel.open
              ? 'Hide threads and conversations'
              : 'Show threads and conversations'
          }
        >
          <Spool size={17} aria-hidden />
        </IconButton>
      }
      aria-expanded={panel.open}
      aria-controls={panel.open ? panel.panelId : undefined}
    />
  )
}

/** Keep the navigator mounted while conversation sessions load and change. */
export function ConversationNavigator({
  visible,
  children,
}: {
  visible: boolean
  children: ReactNode
}) {
  const navigate = useNavigate()
  const search = useWorkspaceSearch()
  const scope = useConversationNavigatorScope()
  const {
    family,
    selected,
    userId,
    layout: { wide, dockOverride },
    setLayout,
    overlayOpen,
    setOverlayOpen,
  } = scope
  const childBots = family.members.map(({ bot }) => bot)
  const familyThreads = scope.threads.error
    ? []
    : (scope.threads.data?.items ?? [])
  const selectedThreads = scope.selectedThreads.error
    ? []
    : (scope.selectedThreads.data?.items ?? [])
  const listedThreads = [
    ...new Map(
      [...familyThreads, ...selectedThreads].map((thread) => [
        thread.conversationId,
        thread,
      ]),
    ).values(),
  ]
  const activeConversationId =
    readPanelState(search).active === 'thread' && search.thread
      ? search.thread
      : (search.conversation ?? selected.mainConversationId)
  const [handle] = useState(() => Popover.createHandle())
  const dock = useRef<HTMLDivElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const [chatArea, setChatArea] = useState<HTMLDivElement | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const [animate, setAnimate] = useState(false)
  const [availableWidth, setAvailableWidth] = useState(0)
  const observeContainer = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return
      const observer = new ResizeObserver(([entry]) => {
        setAvailableWidth(entry.contentRect.width)
        const next = entry.contentRect.width >= 900
        if (!next && dock.current?.contains(document.activeElement))
          trigger.current?.focus()
        // A manual hide lasts for this layout. Coming back to a roomy layout
        // restores automatic opening, without reopening on every small resize.
        setLayout((current) =>
          current.wide === next ? current : { wide: next },
        )
        if (next) setOverlayOpen(false)
      })
      observer.observe(node)
      return () => observer.disconnect()
    },
    [setLayout, setOverlayOpen],
  )
  useEffect(() => {
    if (!visible) {
      setOverlayOpen(false)
    }
  }, [visible, setOverlayOpen])
  // Existing threads get room before details, but an empty navigator stays closed.
  const hasItems = listedThreads.length + childBots.length > 0
  const dockOpen = hasItems && wide && (dockOverride ?? true)
  const open = hasItems && (wide ? dockOpen : overlayOpen)
  const { width, resizing, handleProps } = useNavigatorResize({
    storageKey: JSON.stringify([
      'gum',
      'conversation-navigator-width',
      1,
      userId,
      selected.workspace_id,
    ]),
    wide,
    availableWidth,
    enabled: visible && open,
  })
  const resizeHandle = (
    <div
      {...handleProps}
      className="conversation-navigator-resizer"
      aria-controls={panelId}
    />
  )
  const setDockOpen = (value: boolean) => {
    setAnimate(true)
    setLayout((current) => ({ ...current, dockOverride: value }))
  }
  const close = () => {
    if (wide) {
      setDockOpen(false)
      trigger.current?.focus()
    } else setOverlayOpen(false)
  }
  const openConversation = (botId: string, conversationId?: string) => {
    setOverlayOpen(false)
    void navigate({
      ...conversationLocation(
        { workspaceId: selected.workspace_id, botId, conversationId },
        {
          ...clearConversationFilePanels(search),
          message: undefined,
          draft: undefined,
          parent: undefined,
        },
      ),
      resetScroll: false,
    })
  }
  const selectThread = (thread: ThreadListItem, intent?: ThreadOpenIntent) => {
    intent?.handoff.cancel()
    const session = scope.session.current
    if (
      session?.onOpenThread &&
      session.destination.botId === selected.id &&
      session.destination.conversationId ===
        (search.conversation ?? selected.mainConversationId) &&
      session.destination.isMainConversation &&
      thread.parentConversationId === session.destination.conversationId
    ) {
      const source = trigger.current
      source?.focus()
      session.onOpenThread(
        thread,
        source ? { source, handoff: composerFocusHandoff(source) } : undefined,
      )
    } else openConversation(thread.botId, thread.conversationId)
  }
  const navigatorQuery =
    search.navigatorSearch?.rootBotId === family.root.id
      ? search.navigatorSearch.query
      : ''
  const changeNavigatorQuery = (query: string) => {
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({
        ...validateWorkspaceSearch(previous),
        navigatorSearch: query
          ? { rootBotId: family.root.id, query }
          : undefined,
      }),
      replace: true,
      resetScroll: false,
    })
  }
  const title = childBots.length ? 'In this chat' : 'Threads'

  const renderItems = (card = false) => (
    <ConversationNavigatorItems
      threads={listedThreads}
      query={navigatorQuery}
      onQueryChange={changeNavigatorQuery}
      childBots={childBots}
      root={family.root}
      childDepths={
        new Map(family.members.map(({ bot, depth }) => [bot.id, depth]))
      }
      activeBotId={selected.id}
      activeConversationId={activeConversationId}
      isMainConversation={activeConversationId === selected.mainConversationId}
      onOpenRoot={() => openConversation(family.root.id)}
      loading={
        !listedThreads.length &&
        ((!!family.root.mainConversationId && scope.threads.isPending) ||
          (!!selected.mainConversationId && scope.selectedThreads.isPending))
      }
      error={!!scope.selectedThreads.error || !!scope.threads.error}
      onRetry={() => {
        if (family.root.mainConversationId) void scope.threads.refetch()
        if (selected.mainConversationId && selected.id !== family.root.id)
          void scope.selectedThreads.refetch()
      }}
      onOpenThread={selectThread}
      showThreadHeading={card || !!childBots.length}
      onOpenChild={(bot) => openConversation(bot.id)}
    />
  )
  return (
    <NavigatorContext
      value={{
        open,
        hasItems,
        panelId,
        trigger,
        handle,
      }}
    >
      <div
        className="conversation-context"
        ref={observeContainer}
        data-navigator-resizing={resizing || undefined}
        style={{ '--navigator-width': `${width}px` } as CSSProperties}
      >
        <Collapsible.Root open={dockOpen} className="conversation-context-body">
          <Collapsible.Panel
            className="conversation-navigator-presence"
            data-panel-motion={animate || undefined}
            ref={dock}
            inert={!dockOpen}
            aria-hidden={!dockOpen || undefined}
          >
            <aside
              className="conversation-navigator"
              id={wide ? panelId : undefined}
              aria-label={title}
            >
              <div className="conversation-navigator-heading">
                <IconButton
                  label="Close threads and conversations"
                  onClick={close}
                >
                  <X size={16} aria-hidden />
                </IconButton>
              </div>
              {renderItems()}
              {resizeHandle}
            </aside>
          </Collapsible.Panel>
          <div className="conversation-context-main" ref={setChatArea}>
            {children}
          </div>
        </Collapsible.Root>
        <Popover.Root
          handle={handle}
          open={visible && !!chatArea && !wide && open}
          onOpenChange={(next, event) => {
            if (wide) {
              if (event.reason === 'trigger-press') setDockOpen(!dockOpen)
            } else {
              setAnimate(true)
              setOverlayOpen(next)
            }
          }}
        >
          <Popover.Portal container={chatArea}>
            <div className="conversation-card-layer conversation-navigator-layer">
              <Popover.Positioner
                anchor={chatArea}
                side="bottom"
                align="start"
                // Place the card inside the chat's top-left corner.
                sideOffset={({ anchor }) => 12 - anchor.height}
                alignOffset={12}
                collisionBoundary={chatArea ?? undefined}
                collisionPadding={12}
                collisionAvoidance={{ side: 'shift', align: 'shift' }}
                className="conversation-card-positioner conversation-navigator-positioner"
                positionMethod="absolute"
              >
                <Popover.Popup
                  className="conversation-card conversation-navigator-overlay"
                  data-panel-motion={animate || undefined}
                  data-edge="left"
                  ref={popup}
                  initialFocus={popup}
                  id={!wide ? panelId : undefined}
                  finalFocus={trigger}
                >
                  <Popover.Title className="sr-only">{title}</Popover.Title>
                  <Popover.Close
                    className="conversation-card-close"
                    render={
                      <IconButton label="Close threads and conversations">
                        <X size={16} aria-hidden />
                      </IconButton>
                    }
                  />
                  <div className="conversation-card-content">
                    {renderItems(true)}
                  </div>
                  {resizeHandle}
                </Popover.Popup>
              </Popover.Positioner>
            </div>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </NavigatorContext>
  )
}

/** Threads and child conversations have separate identities and destinations. */
export function ConversationNavigatorItems({
  threads,
  childBots,
  loading,
  error,
  onRetry,
  onOpenThread,
  onOpenChild,
  root,
  onOpenRoot,
  activeBotId,
  activeConversationId,
  isMainConversation,
  query = '',
  onQueryChange,
}: {
  threads: ThreadListItem[]
  childBots: WorkspaceBot[]
  loading: boolean
  error: boolean
  onRetry: () => void
  onOpenThread: (thread: ThreadListItem, intent?: ThreadOpenIntent) => void
  onOpenChild: (bot: WorkspaceBot) => void
  root?: WorkspaceBot
  onOpenRoot?: () => void
  activeBotId?: string
  activeConversationId?: string
  isMainConversation?: boolean
  childDepths?: Map<string, number>
  showThreadHeading?: boolean
  query?: string
  onQueryChange?: (query: string) => void
}) {
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (searchOpen) searchInput.current?.focus()
  }, [searchOpen])
  const needle = query.trim().toLocaleLowerCase()
  const threadIds = new Set(
    threads
      .filter((thread) => thread.title.toLocaleLowerCase().includes(needle))
      .map((thread) => thread.conversationId),
  )
  for (const id of [...threadIds]) {
    let item = threads.find((thread) => thread.conversationId === id)
    const seen = new Set<string>()
    while (item && !seen.has(item.conversationId)) {
      seen.add(item.conversationId)
      threadIds.add(item.conversationId)
      item = threads.find(
        (thread) => thread.conversationId === item!.parentConversationId,
      )
    }
  }
  const matchingThreads = threads.filter((thread) =>
    threadIds.has(thread.conversationId),
  )
  const botIds = new Set(
    filterConversationNames(childBots, query).map((bot) => bot.id),
  )
  for (const thread of matchingThreads) {
    let bot = childBots.find((bot) => bot.id === thread.botId)
    const seen = new Set<string>()
    while (bot && !seen.has(bot.id)) {
      seen.add(bot.id)
      botIds.add(bot.id)
      bot = childBots.find((item) => item.id === bot!.parent_id)
    }
  }
  const matchingBots = childBots.filter((bot) => botIds.has(bot.id))
  const renderBranch = (
    parentBotId: string | undefined,
    parentConversationId: string | undefined,
    seen = new Set<string>(),
  ): ReactNode => {
    const bots = matchingBots.filter((bot) => bot.parent_id === parentBotId)
    const branchThreads = matchingThreads.filter(
      (thread) => thread.parentConversationId === parentConversationId,
    )
    if (!bots.length && !branchThreads.length) return null
    return (
      <div className="navigator-tree-children">
        {branchThreads.map((thread) => {
          const key = `thread:${thread.conversationId}`
          if (seen.has(key)) return null
          const next = new Set(seen).add(key)
          return (
            <div className="navigator-tree-node" key={key}>
              <ThreadLink
                thread={thread}
                onOpen={onOpenThread}
                active={thread.conversationId === activeConversationId}
              />
              {renderBranch(undefined, thread.conversationId, next)}
            </div>
          )
        })}
        {bots.map((bot) => {
          const key = `bot:${bot.id}`
          if (seen.has(key)) return null
          return (
            <div className="navigator-tree-node" key={key}>
              <button
                type="button"
                className="conversation-navigator-child"
                aria-current={
                  isMainConversation && activeBotId === bot.id
                    ? 'page'
                    : undefined
                }
                onClick={() => onOpenChild(bot)}
              >
                <span>{bot.name}</span>
              </button>
              {renderBranch(
                bot.id,
                bot.mainConversationId ?? undefined,
                new Set(seen).add(key),
              )}
            </div>
          )
        })}
      </div>
    )
  }
  return (
    <div
      className="conversation-navigator-items"
      aria-busy={loading || undefined}
    >
      <div className="conversation-navigator-top">
        {root && !searchOpen && !query && (
          <button
            type="button"
            className="conversation-navigator-child conversation-navigator-root"
            aria-current={
              isMainConversation && activeBotId === root.id ? 'page' : undefined
            }
            onClick={onOpenRoot}
          >
            <span className="conversation-navigator-root-label">
              <span>{root.name}</span>
            </span>
          </button>
        )}
        {onQueryChange && (
          <div className="conversation-navigator-filter">
            <IconButton
              label="Search conversations and threads"
              aria-expanded={searchOpen || !!query}
              onClick={() => setSearchOpen(true)}
            >
              <Search size={16} aria-hidden />
            </IconButton>
            {(searchOpen || !!query) && (
              <input
                ref={searchInput}
                type="search"
                className="conversation-navigator-search"
                aria-label="Filter thread titles and conversation names"
                value={query}
                maxLength={200}
                onChange={(event) => onQueryChange(event.target.value)}
                onBlur={() => {
                  if (!query) setSearchOpen(false)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.stopPropagation()
                    onQueryChange('')
                    setSearchOpen(false)
                    event.currentTarget.parentElement
                      ?.querySelector('button')
                      ?.focus()
                  }
                }}
              />
            )}
          </div>
        )}
      </div>
      {needle &&
        !loading &&
        !error &&
        !matchingThreads.length &&
        !matchingBots.length && <p role="status">No matching names.</p>}
      {error && (
        <p role="alert">
          Threads could not be loaded.{' '}
          <button className="quiet-button" onClick={onRetry}>
            Retry
          </button>
        </p>
      )}
      {renderBranch(root?.id, root?.mainConversationId ?? undefined)}
    </div>
  )
}
