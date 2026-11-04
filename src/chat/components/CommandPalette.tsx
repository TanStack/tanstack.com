import { SelectField } from './SelectField'
import { CommandContext, type ScopeGetter } from './palette-context'
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Autocomplete } from '@base-ui/react/autocomplete'
import { useHotkey, formatForDisplay } from '@tanstack/react-hotkeys'
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  CornerDownLeft,
  File,
  GitFork,
  LayoutList,
  MessageCircle,
  MessagesSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Search,
  Settings,
  Sparkles,
  Square,
  Sun,
  X,
} from 'lucide-react'
import {
  parsePaletteVisits,
  rankPalette,
  recordPaletteVisit,
  type PaletteFilter,
  type PaletteKind,
  type PaletteVisit,
} from '../core/command-palette'
import type { PaletteItem, PalettePage, PaletteScope } from './palette-types'
import { PortalContainer } from './PortalContainer'
import { IconButton } from './IconButton'
import './command-palette.css'

type Entry = {
  page: PalettePage
  query: string
  filter: PaletteFilter
  scopeId?: string
}
const kindNames: Record<PaletteKind, string> = {
  action: 'Action',
  conversation: 'Conversation',
  thread: 'Thread',
  file: 'File',
  message: 'Message',
  setting: 'Setting',
}
const icons = {
  search: Search,
  chat: MessageCircle,
  thread: MessagesSquare,
  file: File,
  settings: Settings,
  arrow: ArrowRight,
  model: Sparkles,
  stop: Square,
  copy: Copy,
  fork: GitFork,
  pin: Pin,
  archive: Archive,
  rename: Pencil,
  move: ArrowRight,
  plus: Plus,
  sun: Sun,
  layout: LayoutList,
}

export function CommandPaletteTrigger() {
  const commands = useContext(CommandContext)
  if (!commands) return null
  return (
    <IconButton
      label="Search and commands"
      tooltip={`Search and commands (${formatForDisplay('Mod+K')})`}
      onClick={commands.open}
    >
      <Search size={17} aria-hidden />
    </IconButton>
  )
}

export function CommandPaletteProvider({
  userId,
  workspaceId,
  locationKey,
  items,
  children,
}: {
  userId: string
  workspaceId: string
  locationKey: string
  items: PaletteItem[]
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [stack, setStack] = useState<Entry[]>([])
  const [scope, setScope] = useState<PaletteScope>()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<PaletteFilter>('all')
  const [highlighted, setHighlighted] = useState<PaletteItem>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [visits, setVisits] = useState<PaletteVisit[]>([])
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const popup = useRef<HTMLDivElement>(null)
  const [container, setContainer] = useState<HTMLElement | undefined>()
  const afterDismiss = useRef<(() => void | Promise<void>) | undefined>(
    undefined,
  )
  const locked = useRef(false)
  const mounted = useRef(true)
  const scopes = useRef(new Map<string, ScopeGetter>())
  const latestItems = useRef(items)
  latestItems.current = items
  const lastScope = useRef<string | null>(null)
  const storageKey = JSON.stringify(['gum', 'palette', 1, userId, workspaceId])
  const rootState = useRef({ query: '', filter: 'all' as PaletteFilter })
  const pageDepth = stack.length
  useEffect(() => {
    if (open) input.current?.focus()
  }, [open, pageDepth])
  const view = stack.at(-1)
  const page = view?.page
  const rootItems = useMemo(
    () => [
      ...items,
      ...(scope?.items ?? []).map((item) => ({ ...item, context: 3 })),
    ],
    [items, scope],
  )
  const source = page?.type === 'list' ? page.items : rootItems
  // Freeze the current result set after keyboard movement, until the query changes.
  // Actions still recheck their live scope when invoked.
  const [frozen, setFrozen] = useState<PaletteItem[] | null>(null)
  const ranked = useMemo(
    () =>
      frozen ??
      rankPalette(source, query, {
        visits,
        filter: page ? 'all' : filter,
        limit: 40,
        diversify: !page,
      }),
    [frozen, source, query, visits, page, filter],
  )
  const displayed =
    page?.type === 'list' && !query ? page.items.slice(0, 40) : ranked

  useEffect(() => {
    mounted.current = true
    try {
      setVisits(parsePaletteVisits(localStorage.getItem(storageKey)))
    } catch {
      /* Optional ranking history. */
    }
    return () => {
      mounted.current = false
      afterDismiss.current = undefined
    }
  }, [storageKey])
  useEffect(() => {
    const focus = (event: FocusEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (popup.current?.contains(target)) return
      const id = target
        ?.closest('[data-command-scope]')
        ?.getAttribute('data-command-scope')
      if (id) lastScope.current = id
    }
    document.addEventListener('focusin', focus)
    return () => document.removeEventListener('focusin', focus)
  }, [])
  useEffect(() => {
    setOpen(false)
    afterDismiss.current = undefined
  }, [locationKey])

  const register = useCallback((id: string, getter: ScopeGetter) => {
    scopes.current.set(id, getter)
    return () => {
      if (scopes.current.get(id) === getter) scopes.current.delete(id)
    }
  }, [])
  const show = useCallback(() => {
    if (locked.current) return
    const source =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    trigger.current = source
    setContainer(
      (source?.closest('dialog[open]') as HTMLElement | null) ?? undefined,
    )
    const candidates = [...scopes.current.values()]
      .map((get) => get())
      .filter((item) => item.available)
    const explicit =
      source
        ?.closest('[data-command-scope]')
        ?.getAttribute('data-command-scope') ?? lastScope.current
    setScope(
      candidates.find((item) => item.id === explicit) ??
        candidates.find((item) => item.primary),
    )
    setQuery('')
    setFilter('all')
    setStack([])
    setError('')
    setFrozen(null)
    setHighlighted(undefined)
    afterDismiss.current = undefined
    setOpen(true)
  }, [])
  const context = useMemo(() => ({ open: show, register }), [show, register])
  useHotkey(
    'Mod+K',
    (event) => {
      if (event.isComposing || event.keyCode === 229) return
      if (open) {
        if (!locked.current) setOpen(false)
      } else show()
    },
    { ignoreInputs: false, requireReset: true },
  )

  function changeQuery(value: string) {
    setQuery(value.slice(0, 200))
    setFrozen(null)
    setError('')
  }
  function push(next: PalettePage, scopeId?: string) {
    if (!stack.length) rootState.current = { query, filter }
    setStack((previous) => [
      ...previous.map((entry, index) =>
        index === previous.length - 1 ? { ...entry, query, filter } : entry,
      ),
      { page: next, query: '', filter: 'all', scopeId },
    ])
    setQuery('')
    setFrozen(null)
    setHighlighted(undefined)
    setError('')
  }
  function back() {
    if (locked.current) return
    const next = stack.slice(0, -1)
    setStack(next)
    setQuery(next.at(-1)?.query ?? rootState.current.query)
    setFilter(next.at(-1)?.filter ?? rootState.current.filter)
    setFrozen(null)
    setHighlighted(undefined)
    setError('')
  }
  function checkScope(scopeId?: string) {
    if (scopeId && !scopes.current.get(scopeId)?.().available)
      throw new Error(
        'This conversation is no longer available. Close search and try again.',
      )
  }
  function remember(item: PaletteItem) {
    // Avoid saving message excerpts or sensitive content queries in browser history.
    if (item.kind === 'message' || item.kind === 'file') return
    setVisits((previous) => {
      const next = recordPaletteVisit(previous, item.id, query, Date.now())
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        /* Session ranking still works. */
      }
      return next
    })
  }
  async function run(item: PaletteItem, actions = false) {
    if (locked.current || item.disabledReason) return
    const scopedItem = scope?.items.some(
      (candidate) => candidate.id === item.id,
    )
    const scopeId = view?.scopeId ?? (scopedItem ? scope?.id : undefined)
    locked.current = true
    setBusy(true)
    setError('')
    try {
      checkScope(scopeId)
      const live =
        !page && scopedItem
          ? scopes.current
              .get(scopeId!)?.()
              .items.find((candidate) => candidate.id === item.id)
          : !page
            ? latestItems.current.find((candidate) => candidate.id === item.id)
            : item
      if (!live || live.disabledReason)
        throw new Error(
          live?.disabledReason ?? 'This action is no longer available.',
        )
      if (actions) {
        if (live.actions) push(live.actions(), scopeId)
        return
      }
      if (live.afterClose) {
        afterDismiss.current = async () => {
          checkScope(scopeId)
          await live.run()
        }
        remember(live)
        setOpen(false)
        return
      }
      const next = await live.run()
      if (!mounted.current) return
      if (next) push(next, scopeId)
      else {
        remember(live)
        setOpen(false)
      }
    } catch (error) {
      if (mounted.current)
        setError(
          error instanceof Error
            ? error.message
            : 'Could not complete this action.',
        )
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function submit(value: string) {
    if (page?.type !== 'input' || locked.current) return
    locked.current = true
    setBusy(true)
    setError('')
    try {
      checkScope(view?.scopeId)
      await page.submit(value)
      if (mounted.current) setOpen(false)
    } catch (error) {
      if (mounted.current)
        setError(
          error instanceof Error
            ? error.message
            : 'Could not save this change.',
        )
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }
  return (
    <CommandContext.Provider value={context}>
      {children}
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (!locked.current) setOpen(next)
        }}
        onOpenChangeComplete={(opened) => {
          if (opened) return
          const action = afterDismiss.current
          afterDismiss.current = undefined
          if (action)
            void Promise.resolve()
              .then(action)
              .catch(() => {
                if (mounted.current) {
                  setError('Could not open that destination. Try again.')
                  setOpen(true)
                }
              })
        }}
      >
        <Dialog.Portal container={container}>
          <PortalContainer.Provider value={popup}>
            <Dialog.Backdrop className="command-backdrop" />
            <Dialog.Popup
              ref={popup}
              className="command-palette"
              aria-label="Search and commands"
              initialFocus={input}
              finalFocus={() =>
                trigger.current?.isConnected ? trigger.current : true
              }
              onKeyDownCapture={(event) => {
                if (event.nativeEvent.isComposing) return
                if (
                  event.key === 'Enter' &&
                  (event.metaKey || event.ctrlKey) &&
                  highlighted?.actions &&
                  page?.type !== 'input'
                ) {
                  event.preventDefault()
                  event.stopPropagation()
                  void run(highlighted, true)
                }
                if (event.key === 'Escape' && stack.length) {
                  event.preventDefault()
                  event.stopPropagation()
                  back()
                }
                if (
                  event.key === 'Backspace' &&
                  page?.type === 'list' &&
                  !query &&
                  event.target === input.current
                ) {
                  event.preventDefault()
                  back()
                }
              }}
            >
              {page?.type === 'input' ? (
                <PaletteInput
                  key={stack.length}
                  page={page}
                  busy={busy}
                  inputRef={input}
                  onBack={back}
                  onSubmit={submit}
                />
              ) : (
                <Autocomplete.Root<PaletteItem>
                  key={stack.length}
                  inline
                  open
                  items={displayed}
                  filteredItems={displayed}
                  value={query}
                  onValueChange={changeQuery}
                  itemToStringValue={(item) => item.label}
                  autoHighlight="always"
                  keepHighlight
                  highlightItemOnHover
                  onItemHighlighted={(item, details) => {
                    setHighlighted(item)
                    if (details.reason === 'keyboard')
                      setFrozen((current) => current ?? displayed)
                  }}
                >
                  <div className="command-input-row">
                    {page ? (
                      <IconButton label="Back" onClick={back} disabled={busy}>
                        <ArrowLeft size={18} />
                      </IconButton>
                    ) : (
                      <Search size={19} aria-hidden />
                    )}
                    <Autocomplete.Input
                      ref={input}
                      aria-label={
                        page?.type === 'list'
                          ? page.title
                          : 'Search conversations, actions, and settings'
                      }
                      placeholder={
                        page?.type === 'list'
                          ? (page.placeholder ?? page.title)
                          : 'Search or do something…'
                      }
                      maxLength={200}
                      readOnly={busy}
                    />
                    <Dialog.Close
                      render={
                        <IconButton label="Close search" disabled={busy}>
                          <X size={17} />
                        </IconButton>
                      }
                    />
                  </div>
                  {page ? (
                    <div className="command-context">{page.title}</div>
                  ) : (
                    <div className="command-filters">
                      <SelectField
                        aria-label="Search type"
                        value={filter}
                        disabled={busy}
                        onValueChange={(value) => {
                          setFilter(value as PaletteFilter)
                          setFrozen(null)
                        }}
                        items={[
                          {
                            value: 'all',
                            label: 'Everything',
                          },
                          {
                            value: 'conversation',
                            label: 'Conversations',
                          },
                          {
                            value: 'action',
                            label: 'Actions',
                          },
                          {
                            value: 'setting',
                            label: 'Settings',
                          },
                          ...(scope
                            ? [
                                {
                                  value: 'file',
                                  label: 'Files in this chat',
                                },
                                {
                                  value: 'message',
                                  label: 'Loaded messages',
                                },
                              ]
                            : []),
                        ]}
                      />
                      {scope && <span title={scope.name}>{scope.name}</span>}
                    </div>
                  )}
                  <Autocomplete.List
                    className="command-results"
                    aria-label={
                      page?.type === 'list' ? page.title : 'Search results'
                    }
                  >
                    {displayed.map((item, index) => {
                      const Icon =
                        icons[
                          item.icon ??
                            (item.kind === 'conversation'
                              ? 'chat'
                              : item.kind === 'setting'
                                ? 'settings'
                                : 'arrow')
                        ]
                      return (
                        <Autocomplete.Item
                          key={item.id}
                          value={item}
                          index={index}
                          className="command-item"
                          disabled={busy || !!item.disabledReason}
                          onClick={() => void run(item)}
                        >
                          <Icon size={17} aria-hidden />
                          <span className="command-item-text">
                            <span>{item.label}</span>
                            {(item.disabledReason || item.detail) && (
                              <small>
                                {item.disabledReason ?? item.detail}
                              </small>
                            )}
                          </span>
                          <span className="command-item-kind">
                            {item.shortcut ? (
                              <kbd>{item.shortcut}</kbd>
                            ) : (
                              kindNames[item.kind]
                            )}
                          </span>
                          {item.actions && (
                            <ChevronRight size={14} aria-hidden />
                          )}
                        </Autocomplete.Item>
                      )
                    })}
                  </Autocomplete.List>
                  {!displayed.length && (
                    <p className="command-empty" role="status">
                      {query
                        ? 'No matches. Try fewer words or a different search type.'
                        : 'No items in this view.'}
                    </p>
                  )}
                  <div className="command-footer">
                    <span>
                      <CornerDownLeft size={13} aria-hidden />{' '}
                      {busy ? 'Working…' : 'Open or run'}
                    </span>
                    {highlighted?.actions && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void run(highlighted, true)}
                      >
                        <MoreHorizontal size={16} aria-hidden /> Actions{' '}
                        <kbd>{formatForDisplay('Mod+Enter')}</kbd>
                      </button>
                    )}
                    {filter === 'message' && !page && (
                      <span>Messages already loaded in this chat</span>
                    )}
                  </div>
                </Autocomplete.Root>
              )}
              {page?.type === 'list' && page.notice && (
                <p className="command-notice">{page.notice}</p>
              )}
              {error && (
                <p className="command-error" role="alert">
                  {error}
                </p>
              )}
            </Dialog.Popup>
          </PortalContainer.Provider>
        </Dialog.Portal>
      </Dialog.Root>
    </CommandContext.Provider>
  )
}

function PaletteInput({
  page,
  busy,
  inputRef,
  onBack,
  onSubmit,
}: {
  page: Extract<PalettePage, { type: 'input' }>
  busy: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  onBack: () => void
  onSubmit: (value: string) => Promise<void>
}) {
  const [value, setValue] = useState(page.initialValue)
  return (
    <form
      className="command-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (value.trim()) void onSubmit(value.trim())
      }}
    >
      <div className="command-input-row">
        <IconButton label="Back" onClick={onBack} disabled={busy}>
          <ArrowLeft size={18} />
        </IconButton>
        <Dialog.Title>{page.title}</Dialog.Title>
        <Dialog.Close
          render={
            <IconButton label="Close search" disabled={busy}>
              <X size={17} />
            </IconButton>
          }
        />
      </div>
      <label>
        {page.label}
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={page.maxLength}
          required
          disabled={busy}
        />
      </label>
      <div className="command-form-actions">
        <button className="primary" disabled={busy || !value.trim()}>
          <Check size={15} aria-hidden />
          {busy ? 'Saving…' : page.submitLabel}
        </button>
      </div>
    </form>
  )
}
