import { isPersonalAssistant } from '../core/bot-workspace'
import { useLongPress } from './useLongPress'
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
  useReducedMotion,
} from 'motion/react'
import { layoutTransition, useUiTransition } from './ui/motion'
import { useSidebarTextSize, type SidebarTextSize } from './sidebar-text-size'
import { useSectionDisplay } from './section-display'
import { Button } from './ui/Button'
import { SegmentedControl } from './ui/SegmentedControl'
import { Checkbox } from './ui/Checkbox'
import {
  applyConversationBulkAction,
  type BulkConversationAction,
} from '../core/conversation-bulk-actions'
import { SelectField } from './SelectField'
import {
  conversationActionRequest,
  type ConversationAction,
} from '../core/conversation-actions'
import {
  useEffect,
  useLayoutEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Modal } from './ui/Modal'
import { Menu } from '@base-ui/react/menu'
import { Tooltip } from '@base-ui/react/tooltip'
import { Popover } from '@base-ui/react/popover'
import { useHotkeys, formatForDisplay } from '@tanstack/react-hotkeys'
import {
  Archive,
  Bell,
  FolderInput,
  CheckSquare,
  ArchiveRestore,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  GripVertical,
  List,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Rows3,
  X,
} from 'lucide-react'
import type { BotSection, WorkspaceBot } from '../core/bot-workspace'
import {
  activityLabels,
  descendantIds,
  isUnread,
  selectBotGroups,
  sortBotSections,
  type BotActivity,
  type BotView,
  type BotViewRow,
  type BotViewGroup,
} from '../core/bot-views'
import {
  botTreeBranches,
  visibleBotRows,
  type SidebarDensity,
} from './bot-sidebar'
import { useSidebarDensity } from './sidebar-density'
import { IconButton } from './IconButton'
import {
  BotDragProvider,
  useBotDrag,
  useBotGroupDrop,
  useSectionDrag,
  useBotDragActive,
} from './BotDrag'
import './bot-workspace.css'

export type WorkspaceRequest = (
  path: string,
  body?: unknown,
  method?: string,
  options?: { errorDisplay?: 'local' | 'workspace' },
) => Promise<unknown>
type MutationProps = {
  onChanged: () => void | Promise<void>
  request: WorkspaceRequest
}

function WorkspaceDialog({
  title,
  onClose,
  busy = false,
  children,
  initialFocus,
}: {
  title: string
  onClose: () => void
  busy?: boolean
  initialFocus?: React.ComponentProps<typeof Modal>['initialFocus']
  children: ReactNode
}) {
  return (
    <Modal
      initialFocus={initialFocus}
      title={title}
      onClose={onClose}
      busy={busy}
      className="bw-dialog"
      headingClassName="bw-dialog-heading"
    >
      {children}
    </Modal>
  )
}

function useWorkspaceMutation({ request, onChanged }: MutationProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const pending = useRef(false)
  const attempt = async (action: () => Promise<unknown>) => {
    if (pending.current) return false
    pending.current = true
    setBusy(true)
    setError('')
    setConflict(false)
    try {
      await action()
      return true
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : 'This change could not be saved.'
      setError(message)
      setConflict(/409|conflict|changed|stale|version/i.test(message))
      return false
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  const run = (path: string, body?: unknown, method = 'POST') =>
    attempt(async () => {
      await request(path, body, method)
    })
  const refresh = () =>
    attempt(async () => {
      await onChanged()
    })
  return { busy, error, conflict, run, refresh }
}

function MutationError({
  error,
  conflict,
  onReload,
}: {
  error: string
  conflict: boolean
  onReload: () => void
}) {
  if (!error) return null
  return (
    <div className="bw-error" role="alert">
      <p>{error}</p>
      {conflict && (
        <Button type="button" variant="secondary" onClick={onReload}>
          Reload details
        </Button>
      )}
    </div>
  )
}

const viewChoices: Array<[BotView['view'], string]> = [
  ['bots', 'All'],
  ['recent', 'Recent'],
  ['attention', 'Needs attention'],
  ['archived', 'Archived'],
  ['trash', 'Trash'],
]

export function BotWorkspace({
  pendingRow,
  bots,
  sections,
  activity = {},
  activityPending = false,
  activityError = false,
  activeId,
  view,
  onViewChange,
  onSelect,
  onPrefetch,
  onCompose,
  onCreate,
  onDuplicate,
  onChanged,
  request,
  viewerId,
}: {
  pendingRow?: { id: string; text: string }
  bots: WorkspaceBot[]
  sections: BotSection[]
  activity?: Record<string, BotActivity>
  activityPending?: boolean
  activityError?: boolean
  activeId: string | null
  view: BotView
  onViewChange: (view: BotView) => void
  onSelect: (id: string) => void
  onPrefetch?: (bot: WorkspaceBot) => void
  onCompose?: (id: string, source: HTMLButtonElement) => void
  onCreate: (parentId: string | null) => void
  onDuplicate?: (bot: WorkspaceBot) => void
  viewerId?: string
} & MutationProps) {
  const [manageSections, setManageSections] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [touchControls, setTouchControls] = useState(false)
  const [editing, setEditing] = useState(false)
  const [selection, setSelection] = useState<string[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const revealedConversation = useRef<{
    viewerId?: string
    activeId: string | null
  } | null>(null)
  useEffect(() => {
    const previous = revealedConversation.current
    if (previous?.viewerId === viewerId && previous?.activeId === activeId)
      return
    revealedConversation.current = { viewerId, activeId }
    // Reveal a conversation reached from search or a direct link, but do not
    // reopen a branch the user collapsed just because activity refreshed.
    setExpandedIds((current) => {
      const next = new Set(previous?.viewerId === viewerId ? current : [])
      const byId = new Map(bots.map((bot) => [bot.id, bot]))
      const visited = new Set<string>()
      let parentId = activeId ? byId.get(activeId)?.parent_id : null
      while (parentId && !visited.has(parentId)) {
        visited.add(parentId)
        next.add(parentId)
        parentId = byId.get(parentId)?.parent_id
      }
      return next
    })
  }, [activeId, bots, viewerId])
  const selectionAnchor = useRef<string | null>(null)
  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)')
    const update = () => {
      setTouchControls(media.matches)
      setEditing(false)
      setSelection([])
    }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const optionsTrigger = useRef<HTMLButtonElement>(null)
  const [density, setDensity] = useSidebarDensity(viewerId)
  const [sectionDisplay, setSectionDisplay] = useSectionDisplay(viewerId)
  const [textSizes, setTextSize] = useSidebarTextSize(viewerId)
  const defaultTextSize = textSizes.default ?? 'auto'
  const textSizeControl = (group: string) => (
    <div className="bw-text-size-options">
      <span>Text size</span>
      <SegmentedControl
        label="Text size"
        value={
          group === 'default'
            ? defaultTextSize
            : (textSizes[group] ?? 'default')
        }
        onValueChange={(value) =>
          setTextSize(group, value as SidebarTextSize | 'default')
        }
        options={[
          ...(group === 'default'
            ? []
            : [{ value: 'default', label: 'Default' }]),
          { value: 'auto', label: 'Auto' },
          { value: 'small', label: 'S' },
          { value: 'medium', label: 'M' },
          { value: 'large', label: 'L' },
        ]}
      />
    </div>
  )
  const searchId = useId()
  const conversationSortId = useId()
  const sectionSortId = useId()
  const groupId = useId()
  const reorderView =
    view.view === 'bots' &&
    view.sort === 'position' &&
    (!view.sectionSort || view.sectionSort === 'position') &&
    view.group === 'section' &&
    !view.q?.trim()
  const isEditing = editing
  const reorderEnabled = reorderView && (!touchControls || isEditing)
  const hasMovableItems =
    sections.length > 0 ||
    bots.some(
      (bot) =>
        bot.id !== `kody:${viewerId}` &&
        bot.archived_at === null &&
        bot.deleted_at === null,
    )
  const changeView = (next: BotView) => {
    setEditing(false)
    setSelection([])
    selectionAnchor.current = null
    onViewChange(next)
  }
  const beginReorder = () => {
    onViewChange({
      ...view,
      view: 'bots',
      sort: 'position',
      sectionSort: 'position',
      group: 'section',
      q: undefined,
    })
    setEditing(true)
    setOptionsOpen(false)
  }
  const allGroups = useMemo(() => {
    const selected = selectBotGroups({
      bots: bots.filter(
        (bot) =>
          bot.id !== `kody:${viewerId}` && bot.id !== `assistant:${viewerId}`,
      ),
      sections,
      activity,
      view,
    })
    if (view.view !== 'bots' || view.group !== 'section' || view.q?.trim())
      return selected
    const byId = new Map(selected.map((group) => [group.id, group]))
    const result: BotViewGroup[] = []
    if (byId.has('pinned')) result.push(byId.get('pinned')!)
    const visibleBots = selected.flatMap((group) =>
      group.rows.map((row) => row.bot),
    )
    for (const section of sortBotSections(
      sections,
      visibleBots,
      activity,
      view.sectionSort,
    )) {
      result.push(
        byId.get(`section:${section.id}`) ?? {
          id: `section:${section.id}`,
          label: section.name,
          rows: [],
        },
      )
    }
    result.push(
      byId.get('unsectioned') ?? {
        id: 'unsectioned',
        label: 'Recent',
        rows: [],
      },
    )
    return result
  }, [bots, sections, activity, view, viewerId])
  const searching = !!view.q?.trim()
  const pendingGroupId =
    view.group === 'none'
      ? 'all'
      : view.group === 'status'
        ? 'running'
        : 'unsectioned'
  const displayGroups =
    pendingRow && !allGroups.some((group) => group.id === pendingGroupId)
      ? [
          ...allGroups,
          {
            id: pendingGroupId,
            label:
              pendingGroupId === 'unsectioned'
                ? 'Recent'
                : pendingGroupId === 'running'
                  ? 'Working'
                  : '',
            rows: [],
          },
        ]
      : allGroups
  const groups = displayGroups.map((group) => ({
    ...group,
    rows: visibleBotRows(group.rows, expandedIds, searching),
  }))
  const branchIds = allGroups.flatMap((group) =>
    group.rows
      .filter((row, index) => (group.rows[index + 1]?.depth ?? 0) > row.depth)
      .map((row) => row.bot.id),
  )
  const allExpanded = branchIds.every((id) => expandedIds.has(id))
  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const visibleIds = groups
    .flatMap((group) => group.rows)
    .filter(({ bot }) => bot.deleted_at === null)
    .map(({ bot }) => bot.id)
  const selectedIds = visibleIds.filter((id) => selection.includes(id))
  const [bulkBusy, setBulkBusy] = useState(false)
  const bulkPending = useRef(false)
  const [bulkError, setBulkError] = useState('')
  const selectedBots = bots.filter((bot) => selectedIds.includes(bot.id))
  const allPinned =
    selectedBots.length > 0 && selectedBots.every((bot) => bot.pinned)
  const allArchived =
    selectedBots.length > 0 &&
    selectedBots.every((bot) => bot.archived_at !== null)
  const runBulk = async (action: BulkConversationAction) => {
    if (bulkPending.current) return
    bulkPending.current = true
    setBulkBusy(true)
    setBulkError('')
    try {
      const result = await applyConversationBulkAction(
        selectedBots,
        action,
        (path, body, method) =>
          request(path, body, method, { errorDisplay: 'local' }),
      )
      setSelection((current) =>
        current.filter((id) => !result.succeeded.includes(id)),
      )
      if (result.failed.length)
        setBulkError(
          result.failed.map((item) => `${item.name}: ${item.error}`).join(' '),
        )
      else {
        setEditing(false)
        optionsTrigger.current?.focus({ preventScroll: true })
      }
    } finally {
      bulkPending.current = false
      setBulkBusy(false)
    }
  }
  const selecting = isEditing || selectedIds.length > 0
  const select = (id: string, range = false, additive = true) => {
    if (bulkPending.current) return
    const anchor = selectionAnchor.current
    if (range && anchor && visibleIds.includes(anchor)) {
      const [from, to] = [
        visibleIds.indexOf(anchor),
        visibleIds.indexOf(id),
      ].sort((a, b) => a - b)
      const ids = visibleIds.slice(from, to + 1)
      setSelection(additive ? [...new Set([...selectedIds, ...ids])] : ids)
    } else {
      selectionAnchor.current = id
      setSelection(
        selectedIds.includes(id)
          ? selectedIds.filter((item) => item !== id)
          : [...selectedIds, id],
      )
    }
  }
  const finishEditing = () => {
    optionsTrigger.current?.focus({ preventScroll: true })
    setEditing(false)
    setSelection([])
    selectionAnchor.current = null
  }
  const activeViewLabel =
    viewChoices.find(([id]) => id === view.view)?.[1] ?? 'All'
  const activityView = view.view === 'recent' || view.view === 'attention'
  const empty =
    activityView && activityError
      ? 'Activity unavailable.'
      : activityView && activityPending
        ? 'Loading activity…'
        : view.q?.trim()
          ? view.view === 'bots'
            ? 'No matching conversations.'
            : `No matches in ${activeViewLabel}.`
          : {
              bots: 'Start a conversation.',
              recent: 'No recent activity.',
              attention: 'Nothing needs your attention.',
              archived: 'No archived conversations.',
              trash: 'Trash is empty.',
            }[view.view]
  return (
    <BotDragProvider
      bots={bots}
      sections={sections}
      request={(path, body, method) =>
        request(path, body, method, { errorDisplay: 'local' })
      }
      onChanged={onChanged}
      enabled={reorderEnabled && !bulkBusy}
      selectedIds={selectedIds}
    >
      <div
        className={`bw-workspace${touchControls ? ' bw-touch-mode' : ''}${isEditing && touchControls ? ' bw-touch-editing' : ''}${selecting ? ' bw-selecting' : ''}`}
      >
        <Button
          className="bw-new-chat"
          variant="secondary"
          onClick={() => onCreate(null)}
        >
          <Plus size={16} aria-hidden />
          New Chat
        </Button>
        <div className="bw-heading">
          <Menu.Root>
            <Menu.Trigger
              className="bw-view-trigger"
              aria-label={`Conversation filter: ${activeViewLabel}`}
            >
              {activeViewLabel}
              <ChevronDown size={14} aria-hidden />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner
                className="bw-positioner"
                align="start"
                sideOffset={6}
              >
                <Menu.Popup
                  className="bw-menu"
                  aria-label="Conversation filters"
                >
                  <Menu.RadioGroup
                    value={view.view}
                    onValueChange={(value) =>
                      changeView({
                        ...view,
                        view: value as BotView['view'],
                        ...(value === 'recent'
                          ? { sort: 'activity', group: 'none' }
                          : value === 'attention'
                            ? { sort: 'unread', group: 'section' }
                            : {}),
                      })
                    }
                  >
                    {viewChoices.map(([id, label]) => (
                      <Menu.RadioItem
                        key={id}
                        value={id}
                        closeOnClick
                        className="bw-menu-item bw-menu-radio"
                      >
                        <Menu.RadioItemIndicator className="bw-menu-check">
                          <Check size={14} aria-hidden />
                        </Menu.RadioItemIndicator>
                        {label}
                      </Menu.RadioItem>
                    ))}
                  </Menu.RadioGroup>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <div className="bw-actions">
            <IconButton
              label="Needs attention"
              aria-pressed={view.view === 'attention'}
              onClick={() =>
                changeView({
                  ...view,
                  view: 'attention',
                  sort: 'unread',
                  group: 'section',
                })
              }
            >
              <Bell size={16} aria-hidden />
            </IconButton>
            {touchControls && hasMovableItems && (
              <button
                type="button"
                className="bw-edit-toggle"
                aria-label={isEditing ? 'Finish editing' : 'Edit order'}
                aria-pressed={isEditing}
                onClick={() => (isEditing ? finishEditing() : beginReorder())}
              >
                {isEditing ? 'Done' : 'Edit'}
              </button>
            )}
            <Popover.Root open={optionsOpen} onOpenChange={setOptionsOpen}>
              <Popover.Trigger
                ref={optionsTrigger}
                className="bw-icon"
                aria-label="Sidebar display"
              >
                <SlidersHorizontal size={16} aria-hidden />
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner
                  className="bw-positioner"
                  align="start"
                  sideOffset={6}
                >
                  <Popover.Popup
                    className="bw-display"
                    finalFocus={() =>
                      manageSections ? false : optionsTrigger.current
                    }
                  >
                    <Popover.Title className="bw-sr-only">
                      Sidebar display
                    </Popover.Title>
                    <div className="bw-density-options">
                      <SegmentedControl
                        label="Conversation display"
                        value={density}
                        onValueChange={setDensity}
                        options={[
                          {
                            value: 'comfortable',
                            label: 'Standard',
                            icon: <Rows3 size={18} aria-hidden />,
                          },
                          {
                            value: 'compact',
                            label: 'Compact',
                            icon: <List size={18} aria-hidden />,
                          },
                        ]}
                      />
                    </div>
                    {textSizeControl('default')}
                    <Button
                      variant="ghost"
                      className="bw-select-conversations"
                      onClick={() => {
                        setEditing(true)
                        setOptionsOpen(false)
                      }}
                    >
                      {' '}
                      <CheckSquare size={15} aria-hidden /> Select conversations
                    </Button>
                    <p className="bw-selection-hint">
                      ⌘/Ctrl-click to select. Shift-click for a range.
                    </p>
                    <label
                      className="bw-display-field"
                      htmlFor={conversationSortId}
                    >
                      Conversations
                      <SelectField
                        id={conversationSortId}
                        value={view.sort}
                        onValueChange={(value) =>
                          changeView({
                            ...view,
                            sort: value as BotView['sort'],
                          })
                        }
                        items={[
                          {
                            value: 'position',
                            label: 'Custom order',
                          },
                          {
                            value: 'name',
                            label: 'Name',
                          },
                          {
                            value: 'created',
                            label: 'Oldest created',
                          },
                          {
                            value: 'activity',
                            label: 'Latest activity',
                          },
                          {
                            value: 'unread',
                            label: 'Unread first',
                          },
                        ]}
                      />
                    </label>
                    {view.group === 'section' && (
                      <label
                        className="bw-display-field"
                        htmlFor={sectionSortId}
                      >
                        Sections
                        <SelectField
                          id={sectionSortId}
                          value={view.sectionSort ?? 'position'}
                          onValueChange={(value) =>
                            changeView({
                              ...view,
                              sectionSort: value as BotView['sectionSort'],
                            })
                          }
                          items={[
                            { value: 'position', label: 'Custom order' },
                            { value: 'name', label: 'Name' },
                            { value: 'activity', label: 'Latest activity' },
                          ]}
                        />
                      </label>
                    )}
                    <label className="bw-display-field" htmlFor={groupId}>
                      Group
                      <SelectField
                        id={groupId}
                        value={view.group}
                        onValueChange={(value) =>
                          changeView({
                            ...view,
                            group: value as BotView['group'],
                          })
                        }
                        items={[
                          {
                            value: 'section',
                            label: 'Sections',
                          },
                          {
                            value: 'status',
                            label: 'Status',
                          },
                          {
                            value: 'none',
                            label: 'No groups',
                          },
                        ]}
                      />
                    </label>
                    {!!branchIds.length && !searching && (
                      <button
                        type="button"
                        className="bw-menu-item bw-display-branches"
                        onClick={() => {
                          setExpandedIds((current) => {
                            const next = new Set(current)
                            for (const id of branchIds) {
                              if (allExpanded) next.delete(id)
                              else next.add(id)
                            }
                            return next
                          })
                          setOptionsOpen(false)
                        }}
                      >
                        {allExpanded ? (
                          <ChevronRight size={15} aria-hidden />
                        ) : (
                          <ChevronDown size={15} aria-hidden />
                        )}
                        {allExpanded ? 'Collapse all' : 'Expand all'}
                      </button>
                    )}
                    {hasMovableItems && (
                      <button
                        type="button"
                        className="bw-menu-item bw-display-reorder"
                        onClick={beginReorder}
                      >
                        <GripVertical size={15} aria-hidden />
                        Reorder
                      </button>
                    )}
                    <button
                      type="button"
                      className="bw-menu-item bw-display-sections"
                      onClick={() => {
                        setOptionsOpen(false)
                        optionsTrigger.current?.focus({ preventScroll: true })
                        setManageSections(true)
                      }}
                    >
                      <Settings2 size={15} aria-hidden />
                      Manage sections
                    </button>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
            <Popover.Root>
              <Popover.Trigger
                className="bw-icon"
                aria-label="Search conversations"
                title="Search conversations"
              >
                <Search size={18} aria-hidden />
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner
                  className="bw-positioner"
                  align="end"
                  sideOffset={6}
                >
                  <Popover.Popup className="bw-display bw-search-popup">
                    <Popover.Title className="bw-sr-only">
                      Search conversations
                    </Popover.Title>
                    <div className="bw-search">
                      <Search size={15} aria-hidden="true" />
                      <label className="bw-sr-only" htmlFor={searchId}>
                        Search conversations
                      </label>
                      <input
                        id={searchId}
                        type="search"
                        value={view.q ?? ''}
                        placeholder="Search"
                        onChange={(event) =>
                          changeView({
                            ...view,
                            q: event.target.value || undefined,
                          })
                        }
                      />
                    </div>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {selecting && (
            <SelectionToolbar
              key="selection"
              className="bw-selection-bar"
              role="toolbar"
              aria-label="Selected conversations"
              aria-busy={bulkBusy || undefined}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && !bulkBusy) finishEditing()
              }}
            >
              <div className="bw-selection-summary">
                <Checkbox
                  aria-label="Select all visible conversations"
                  checked={
                    selectedIds.length === visibleIds.length &&
                    visibleIds.length > 0
                  }
                  indeterminate={
                    selectedIds.length > 0 &&
                    selectedIds.length < visibleIds.length
                  }
                  disabled={bulkBusy}
                  onCheckedChange={(checked) =>
                    setSelection(checked ? visibleIds : [])
                  }
                />
                <span role="status">
                  {bulkBusy ? 'Saving…' : `${selectedIds.length} selected`}
                </span>
                <IconButton
                  label="Clear selection"
                  disabled={bulkBusy}
                  onClick={finishEditing}
                >
                  <X size={14} aria-hidden />
                </IconButton>
              </div>
              {selectedIds.length > 0 && (
                <div className="bw-bulk-actions">
                  <IconButton
                    label={allPinned ? 'Unpin selected' : 'Pin selected'}
                    disabled={bulkBusy}
                    onClick={() =>
                      void runBulk({ type: 'pin', pinned: !allPinned })
                    }
                  >
                    {allPinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
                  </IconButton>
                  <IconButton
                    label={
                      allArchived ? 'Unarchive selected' : 'Archive selected'
                    }
                    disabled={bulkBusy}
                    onClick={() =>
                      void runBulk({ type: 'archive', archived: !allArchived })
                    }
                  >
                    {allArchived ? (
                      <ArchiveRestore aria-hidden />
                    ) : (
                      <Archive aria-hidden />
                    )}
                  </IconButton>
                  <Menu.Root>
                    <Menu.Trigger
                      render={<Button variant="ghost" size="icon" />}
                      aria-label="Move selected to section"
                      disabled={bulkBusy}
                    >
                      <FolderInput size={14} aria-hidden />
                    </Menu.Trigger>
                    <Menu.Portal>
                      <Menu.Positioner className="bw-positioner" sideOffset={6}>
                        <Menu.Popup
                          className="bw-menu"
                          aria-label="Move selected to section"
                        >
                          <Menu.Item
                            className="bw-menu-item"
                            onClick={() =>
                              void runBulk({ type: 'section', sectionId: null })
                            }
                          >
                            No section
                          </Menu.Item>
                          {sections.map((section) => (
                            <Menu.Item
                              className="bw-menu-item"
                              key={section.id}
                              onClick={() =>
                                void runBulk({
                                  type: 'section',
                                  sectionId: section.id,
                                })
                              }
                            >
                              {section.name}
                            </Menu.Item>
                          ))}
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.Root>
                </div>
              )}
            </SelectionToolbar>
          )}
        </AnimatePresence>
        {bulkError && (
          <div className="bw-error" role="alert">
            {bulkError}
          </div>
        )}
        <SidebarList
          onExitSelection={selecting && !bulkBusy ? finishEditing : undefined}
          onSelectAll={() => {
            if (!bulkBusy) {
              setEditing(true)
              setSelection(visibleIds)
            }
          }}
        >
          {groups.length ? (
            groups.map((group) => {
              const groupDensity = group.label
                ? (sectionDisplay[group.id] ?? density)
                : density
              const branches = botTreeBranches(group.rows)
              return (
                <section
                  className={`bw-group bw-density-${groupDensity}`}
                  key={group.id}
                  data-text-size={
                    (group.label && textSizes[group.id]) || defaultTextSize
                  }
                  aria-label={group.label || 'Conversations'}
                >
                  <div className="bw-section-heading-row">
                    {group.id.startsWith('section:') &&
                    sections.some(
                      (section) => `section:${section.id}` === group.id,
                    ) ? (
                      <SidebarSectionHeader
                        section={
                          sections.find(
                            (section) => `section:${section.id}` === group.id,
                          )!
                        }
                        draggable={reorderEnabled && !bulkBusy}
                        editing={isEditing}
                        displayOptions={
                          <SectionDisplayOptions
                            textOptions={textSizeControl(group.id)}
                            value={sectionDisplay[group.id] ?? 'default'}
                            defaultValue={density}
                            onChange={(value) =>
                              setSectionDisplay(group.id, value)
                            }
                          />
                        }
                        defaultSort={view.sort}
                        request={request}
                        onChanged={onChanged}
                      />
                    ) : (
                      <SectionDisplayMenu
                        header={
                          <SidebarGroupHeader
                            group={group}
                            hidden={!group.label}
                            dropEnabled={reorderEnabled && !bulkBusy}
                          />
                        }
                        textOptions={textSizeControl(group.id)}
                        label={group.label}
                        value={sectionDisplay[group.id] ?? 'default'}
                        defaultValue={density}
                        onChange={(value) => setSectionDisplay(group.id, value)}
                      />
                    )}
                  </div>
                  <ul>
                    {pendingRow && group.id === pendingGroupId && (
                      <li
                        className="bw-row is-selected"
                        aria-busy="true"
                        style={{ '--bw-depth': 0 } as CSSProperties}
                      >
                        <div className="bw-select">
                          <span className="bw-row-copy">
                            <span className="bw-row-title">
                              <span>{pendingRow.text}</span>
                            </span>
                          </span>
                        </div>
                      </li>
                    )}
                    {renderConversationRows(group.rows, (row, index) => (
                      <BotRow
                        inPinnedSection={group.id === 'pinned'}
                        key={row.bot.id}
                        row={row}
                        hasChildren={row.hasChildren}
                        expanded={row.expanded}
                        onToggleExpanded={
                          searching
                            ? undefined
                            : () => toggleExpanded(row.bot.id)
                        }
                        branches={branches[index]}
                        bots={bots}
                        sections={sections}
                        current={activity[row.bot.id]}
                        selected={activeId === row.bot.id}
                        marked={selectedIds.includes(row.bot.id)}
                        selecting={selecting && row.bot.deleted_at === null}
                        selectionDisabled={bulkBusy}
                        onMark={() => select(row.bot.id)}
                        showPreview={activityView}
                        density={groupDensity}
                        draggable={reorderEnabled && !bulkBusy}
                        editing={isEditing}
                        onSelect={(id, event) => {
                          if (bulkPending.current) return
                          if (
                            !bulkBusy &&
                            row.bot.deleted_at === null &&
                            (selecting ||
                              event.metaKey ||
                              event.ctrlKey ||
                              event.shiftKey)
                          )
                            select(
                              id,
                              event.shiftKey,
                              event.metaKey || event.ctrlKey || !event.shiftKey,
                            )
                          else {
                            setSelection([])
                            if (
                              onCompose &&
                              !row.bot.archived_at &&
                              !row.bot.deleted_at
                            )
                              onCompose(id, event.currentTarget)
                            else onSelect(id)
                          }
                        }}
                        onPrefetch={onPrefetch}
                        onCompose={onCompose}
                        onCreate={onCreate}
                        onDuplicate={onDuplicate}
                        request={request}
                        onChanged={onChanged}
                      />
                    ))}
                  </ul>
                </section>
              )
            })
          ) : (
            <p className="bw-empty" role="status">
              {empty}
            </p>
          )}
        </SidebarList>
        {manageSections && (
          <SectionManager
            sections={sections}
            onClose={() => setManageSections(false)}
            request={request}
            onChanged={onChanged}
          />
        )}
      </div>
    </BotDragProvider>
  )
}

function renderConversationRows<T extends BotViewRow>(
  rows: T[],
  render: (row: T, index: number) => ReactNode,
): ReactNode {
  return rows.map(render)
}

function SidebarList({
  children,
  onExitSelection,
  onSelectAll,
}: {
  children: ReactNode
  onExitSelection?: () => void
  onSelectAll?: () => void
}) {
  const dragging = useBotDragActive()
  const layoutId = useId()
  return (
    <MotionConfig reducedMotion="user" transition={layoutTransition}>
      <LayoutGroup id={layoutId}>
        <motion.nav
          layoutScroll
          className="bw-list"
          data-dragging={dragging || undefined}
          aria-label="Conversations"
          onKeyDown={(event) => {
            // Escape first cancels the drag; it must not also clear the selection.
            if (
              (event.metaKey || event.ctrlKey) &&
              event.key.toLowerCase() === 'a' &&
              !(event.target as HTMLElement).closest(
                'input,textarea,[contenteditable]',
              )
            ) {
              event.preventDefault()
              onSelectAll?.()
            }
            if (event.key === 'Escape' && !dragging) onExitSelection?.()
          }}
        >
          {children}
        </motion.nav>
      </LayoutGroup>
    </MotionConfig>
  )
}

function SidebarSectionHeader({
  displayOptions,
  section,
  draggable,
  editing,
  defaultSort,
  request,
  onChanged,
}: {
  displayOptions: ReactNode
  section: BotSection
  draggable: boolean
  editing: boolean
  defaultSort: BotView['sort']
} & MutationProps) {
  const sortId = useId()
  const drag = useSectionDrag({ section })
  const labelDrag = draggable && !editing
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const context = useSectionContext(busy || editing)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const sortChoices: Array<[BotView['sort'], string]> = [
    ['position', 'Custom order'],
    ['name', 'Name'],
    ['created', 'Oldest created'],
    ['activity', 'Latest activity'],
    ['unread', 'Unread first'],
  ]
  return (
    <div
      {...context.handlers}
      ref={drag.sourceRef}
      className={`bw-group-heading ${drag.isDragging ? 'is-dragging' : ''}`}
      data-drop={drag.dropState ?? undefined}
      data-drop-axis={drag.dropAxis}
    >
      <h3
        key={labelDrag ? 'draggable' : 'heading'}
        ref={labelDrag ? drag.handleRef : undefined}
        className={labelDrag ? 'bw-drag-label' : undefined}
      >
        {section.name}
      </h3>
      <Popover.Root
        open={!!context.anchor}
        onOpenChange={(open) => {
          if (!open) context.setAnchor(null)
        }}
      >
        <Popover.Portal>
          <Popover.Positioner
            className="bw-positioner"
            align="start"
            {...context.positioner}
          >
            <Popover.Popup
              className="bw-menu bw-section-options"
              finalFocus={() => context.anchor?.target ?? false}
            >
              <Popover.Title className="bw-sr-only">
                Options for {section.name}
              </Popover.Title>
              <label className="bw-display-field" htmlFor={sortId}>
                Sort
                <SelectField
                  id={sortId}
                  value={section.sort_override ?? 'default'}
                  onValueChange={async (value) => {
                    try {
                      setBusy(true)
                      setError('')
                      await request(
                        `sections/${section.id}`,
                        {
                          version: section.version,
                          sortOverride: value === 'default' ? null : value,
                        },
                        'PATCH',
                        { errorDisplay: 'local' },
                      )
                      await onChanged()
                    } catch (cause) {
                      setError((cause as Error).message)
                    } finally {
                      setBusy(false)
                    }
                  }}
                  items={[
                    {
                      value: 'default',
                      label: `Use default (${sortChoices.find(([id]) => id === defaultSort)?.[1]})`,
                    },
                    ...sortChoices.map(([value, label]) => ({ value, label })),
                  ]}
                />
              </label>
              {displayOptions}
              <div className="bw-menu-separator" />
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setError('')
                  setConfirmDelete(true)
                }}
              >
                <Trash2 size={14} aria-hidden />
                Delete section
              </Button>
              {error && (
                <p className="bw-error" role="alert">
                  {error}
                </p>
              )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      {confirmDelete && (
        <WorkspaceDialog
          title={`Delete ${section.name}?`}
          busy={busy}
          onClose={() => setConfirmDelete(false)}
        >
          <p>
            Only the section will be deleted. Its conversations will be kept.
          </p>
          {error && (
            <p className="bw-error" role="alert">
              {error}
            </p>
          )}
          <div className="bw-form-actions">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                try {
                  setBusy(true)
                  setError('')
                  await request(`sections/${section.id}`, undefined, 'DELETE', {
                    errorDisplay: 'local',
                  })
                  await onChanged()
                } catch (cause) {
                  setError((cause as Error).message)
                } finally {
                  setBusy(false)
                }
              }}
            >
              <Trash2 size={14} aria-hidden />
              {busy ? 'Deleting…' : 'Delete section'}
            </Button>
          </div>
        </WorkspaceDialog>
      )}

      {error && (
        <span className="bw-sr-only" role="alert">
          {error}
        </span>
      )}
      <button
        type="button"
        className="bw-icon bw-drag-handle"
        ref={labelDrag ? undefined : drag.handleRef}
        hidden={!draggable || !editing}
        {...drag.dragHandleProps}
      >
        <GripVertical size={13} aria-hidden />
      </button>
    </div>
  )
}

function SidebarGroupHeader({
  group,
  hidden,
  dropEnabled,
}: {
  group: BotViewGroup
  hidden: boolean
  dropEnabled: boolean
}) {
  if (hidden) return null
  if (!dropEnabled)
    return (
      <div className="bw-group-heading">
        <h3>{group.label}</h3>
      </div>
    )
  return <SidebarDropHeader group={group} />
}

function SidebarDropHeader({ group }: { group: BotViewGroup }) {
  const drop = useBotGroupDrop({
    sectionId: null,
    parentId: null,
    pinned: group.id === 'pinned',
  })
  return (
    <div
      ref={drop.dropRef}
      className="bw-group-heading"
      data-drop={drop.isDropTarget ? 'inside' : undefined}
    >
      <h3>{group.label}</h3>
    </div>
  )
}

function BotRow({
  row: { bot, depth, promoted },
  hasChildren,
  expanded,
  onToggleExpanded,
  branches,
  bots,
  sections,
  current,
  selected,
  inPinnedSection,
  marked,
  selecting,
  selectionDisabled,
  onMark,
  showPreview,
  density,
  draggable,
  editing,
  onSelect,
  onPrefetch,
  onCompose,
  onCreate,
  onDuplicate,
  request,
  onChanged,
}: {
  row: BotViewRow
  hasChildren: boolean
  expanded: boolean
  onToggleExpanded?: () => void
  branches: boolean[]
  bots: WorkspaceBot[]
  sections: BotSection[]
  current?: BotActivity
  selected: boolean
  inPinnedSection: boolean
  marked: boolean
  selecting: boolean
  selectionDisabled: boolean
  onMark: () => void
  showPreview: boolean
  density: SidebarDensity
  draggable: boolean
  editing: boolean
  onSelect: (id: string, event: React.MouseEvent<HTMLButtonElement>) => void
  onPrefetch?: (bot: WorkspaceBot) => void
  onCompose?: (id: string, source: HTMLButtonElement) => void
  onCreate: (parentId: string | null) => void
  onDuplicate?: (bot: WorkspaceBot) => void
} & MutationProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [contextAnchor, setContextAnchor] = useState<{
    x: number
    y: number
    target: HTMLElement
  } | null>(null)
  const longPress = useLongPress(
    (target, x, y) => {
      target.focus({ preventScroll: true })
      setContextAnchor({ target, x, y })
    },
    editing || selecting || selectionDisabled || renaming,
  )
  const drag = useBotDrag({ bot })
  const reducedMotion = useReducedMotion()
  const labelDrag = draggable && !editing && !bot.archived_at && !bot.deleted_at
  const unread = isUnread(current)
  const parent =
    promoted && bots.find((candidate) => candidate.id === bot.parent_id)
  const runStatus =
    current &&
    current.status !== 'idle' &&
    (current.status !== 'completed' || unread)
      ? activityLabels[current.status]
      : ''
  const queueStatus = current?.queued_count
    ? `${current.queued_count} queued${current.queue_paused ? ', paused' : ''}`
    : ''
  const status = [runStatus, queueStatus, unread ? 'Unread activity' : '']
    .filter(Boolean)
    .join(' · ')
  return (
    <motion.li
      data-bot-id={bot.id}
      layout={drag.isDragging || reducedMotion ? false : 'position'}
      layoutId={bot.id}
      initial={false}
      ref={drag.sourceRef}
      className={`bw-row ${selected ? 'is-selected' : ''} ${marked ? 'is-marked' : ''} ${drag.isDragging ? 'is-dragging' : ''}`}
      data-drop={drag.dropState ?? undefined}
      data-drop-axis={drag.dropAxis}
      onContextMenu={(event) => {
        if (
          (event.target as HTMLElement).closest('input,textarea,[role="menu"]')
        )
          return
        event.preventDefault()
        event.stopPropagation()
        const target =
          event.currentTarget.querySelector<HTMLElement>('.bw-select')!
        target.focus({ preventScroll: true })
        const rect = target.getBoundingClientRect()
        setContextAnchor({
          x: event.clientX || rect.left,
          y: event.clientY || rect.bottom,
          target,
        })
      }}
      style={{ '--bw-depth': Math.min(depth, 6) } as CSSProperties}
    >
      {branches.map((continues, level) => (
        <span
          key={level}
          aria-hidden
          className={`bw-tree-line ${continues ? 'continues' : ''} ${level === branches.length - 1 ? 'is-branch' : ''}`}
          style={{ '--bw-level': level } as CSSProperties}
        />
      ))}
      {expanded && <span className="bw-child-line" aria-hidden />}
      {selecting && (
        <span className="bw-selection">
          <Checkbox
            aria-label={`Select ${bot.name}`}
            checked={marked}
            disabled={selectionDisabled}
            onCheckedChange={onMark}
          />
        </span>
      )}
      {renaming && (
        <InlineConversationName
          bot={bot}
          request={request}
          onChanged={onChanged}
          onClose={() => setRenaming(false)}
        />
      )}
      <button
        key={labelDrag ? 'draggable' : 'conversation'}
        inert={renaming}
        tabIndex={renaming ? -1 : undefined}
        type="button"
        className={`bw-select${labelDrag ? ' bw-drag-label' : ''}`}
        {...longPress}
        ref={labelDrag ? drag.handleRef : undefined}
        aria-current={selected ? 'page' : undefined}
        aria-label={[bot.name, status].filter(Boolean).join(', ')}
        onClick={(event) => {
          if (!event.defaultPrevented && event.detail < 2)
            onSelect(bot.id, event)
        }}
        onPointerEnter={() => onPrefetch?.(bot)}
        onFocus={() => {
          onPrefetch?.(bot)
        }}
        onDoubleClick={(event) => {
          if (
            !bot.deleted_at &&
            (event.target as HTMLElement).closest('.bw-row-title')
          )
            setRenaming(true)
        }}
      >
        {status && (
          <Tooltip.Root>
            <Tooltip.Trigger
              render={<span />}
              className={`bw-status-dot bw-status-dot-${current?.status ?? 'idle'}`}
              aria-label={status}
              role="img"
              data-unread={unread || undefined}
            />
            <Tooltip.Portal>
              <Tooltip.Positioner
                sideOffset={6}
                className="action-tooltip-positioner"
              >
                <Tooltip.Popup className="action-tooltip">
                  {status}
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        )}
        <span className="bw-row-copy">
          <span
            className="bw-row-title"
            style={renaming ? { visibility: 'hidden' } : undefined}
          >
            <span>{bot.name}</span>
            {bot.pinned && !inPinnedSection && (
              <Pin size={11} aria-label="Pinned" />
            )}
          </span>
          {parent && (
            <span
              className={`bw-row-status ${current ? `bw-status-${current.status}` : ''}`}
            >
              {parent ? `In ${parent.name}` : ''}
            </span>
          )}
          {density === 'comfortable' && showPreview && current?.preview && (
            <span className="bw-preview">{current.preview}</span>
          )}
        </span>
      </button>
      {hasChildren && onToggleExpanded && (
        <IconButton
          className="bw-icon bw-expand"
          label={`${expanded ? 'Collapse' : 'Expand'} ${bot.name}`}
          aria-expanded={expanded}
          onClick={onToggleExpanded}
        >
          {expanded ? (
            <ChevronDown size={14} aria-hidden />
          ) : (
            <ChevronRight size={14} aria-hidden />
          )}
        </IconButton>
      )}
      <div className="bw-row-actions">
        {/* Use a separate handle only in edit mode. Keep disabled drag
            attributes off the conversation button when reordering is off. */}
        <button
          type="button"
          className="bw-icon bw-drag-handle"
          ref={labelDrag ? undefined : drag.handleRef}
          hidden={!draggable || !editing}
          {...drag.dragHandleProps}
        >
          <GripVertical size={13} aria-hidden />
        </button>
        <BotControls
          hideTrigger
          onRename={() => setRenaming(true)}
          contextAnchor={contextAnchor}
          onContextClose={() => setContextAnchor(null)}
          shortcutsEnabled={
            selected && !renaming && !selecting && !selectionDisabled
          }
          bot={bot}
          bots={bots}
          sections={sections}
          request={request}
          onChanged={onChanged}
          onDuplicate={onDuplicate}
          onCreate={onCreate}
          editorOpen={editorOpen}
          onEditorOpenChange={setEditorOpen}
        />
      </div>
    </motion.li>
  )
}

export function BotControls({
  onRename,
  hideTrigger = false,
  contextAnchor,
  onContextClose,
  shortcutsEnabled = false,
  bot,
  bots,
  sections,
  onChanged,
  request,
  onDuplicate,
  onCreate,
  editorOpen: controlledEditorOpen,
  onEditorOpenChange,
}: {
  hideTrigger?: boolean
  onRename?: () => void
  contextAnchor?: { x: number; y: number; target: HTMLElement } | null
  onContextClose?: () => void
  bot: WorkspaceBot
  bots: WorkspaceBot[]
  sections: BotSection[]
  onDuplicate?: (bot: WorkspaceBot) => void
  onCreate?: (parentId: string | null) => void
  shortcutsEnabled?: boolean
  editorOpen?: boolean
  onEditorOpenChange?: (open: boolean) => void
} & MutationProps) {
  const personalAssistant = isPersonalAssistant(bot)
  const [triggerOpen, setTriggerOpen] = useState(false)
  const menuOpen = triggerOpen || !!contextAnchor
  const setMenuOpen = (open: boolean) => {
    setTriggerOpen(open)
    if (!open) onContextClose?.()
  }
  const [internalEditorOpen, setInternalEditorOpen] = useState(false)
  const editorOpen = controlledEditorOpen ?? internalEditorOpen
  const setEditorOpen = onEditorOpenChange ?? setInternalEditorOpen
  const trigger = useRef<HTMLButtonElement>(null)
  const contextTarget = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (contextAnchor) contextTarget.current = contextAnchor.target
  }, [contextAnchor])
  const launching = useRef(false)
  const mutation = useWorkspaceMutation({ request, onChanged })
  const launch = (action: () => void) => {
    launching.current = true
    setMenuOpen(false)
    ;(contextTarget.current ?? trigger.current)?.focus({ preventScroll: true })
    action()
  }
  const quickChange = async (action: ConversationAction) => {
    const { path, body } = conversationActionRequest(bot, action)
    if (await mutation.run(path, body, 'PATCH')) setMenuOpen(false)
  }
  useHotkeys(
    [
      {
        hotkey: 'Mod+Alt+A',
        callback: (event) => {
          event.stopPropagation()
          if (personalAssistant) return
          void quickChange({
            type: 'archive',
            archived: bot.archived_at === null,
          })
        },
        options: {
          enabled:
            (menuOpen || shortcutsEnabled) &&
            !editorOpen &&
            bot.deleted_at === null &&
            !mutation.busy,
        },
      },
      {
        hotkey: 'Mod+Alt+P',
        callback: (event) => {
          event.stopPropagation()
          void quickChange({ type: 'pin', pinned: !bot.pinned })
        },
        options: {
          enabled:
            (menuOpen || shortcutsEnabled) &&
            !editorOpen &&
            bot.deleted_at === null &&
            !mutation.busy,
        },
      },
      {
        hotkey: 'Mod+Alt+D',
        callback: (event) => {
          event.stopPropagation()
          launch(() => onDuplicate?.(bot))
        },
        options: {
          enabled:
            (menuOpen || shortcutsEnabled) &&
            !editorOpen &&
            bot.deleted_at === null &&
            !mutation.busy &&
            !!onDuplicate,
        },
      },
      {
        hotkey: 'Mod+Alt+N',
        callback: (event) => {
          event.stopPropagation()
          launch(() => onCreate?.(bot.id))
        },
        options: {
          enabled:
            (menuOpen || shortcutsEnabled) &&
            !editorOpen &&
            bot.deleted_at === null &&
            !mutation.busy &&
            !!onCreate &&
            bot.archived_at === null,
        },
      },
      {
        hotkey: 'Mod+Alt+S',
        callback: (event) => {
          event.stopPropagation()
          launch(() => setEditorOpen(true))
        },
        options: {
          enabled:
            (menuOpen || shortcutsEnabled) &&
            !editorOpen &&
            bot.deleted_at === null &&
            !mutation.busy,
        },
      },
      {
        hotkey: 'Mod+Alt+R',
        callback: (event) => {
          event.stopPropagation()
          launch(() => (onRename ? onRename() : setEditorOpen(true)))
        },
        options: {
          eventType: 'keydown',
          enabled:
            (menuOpen || shortcutsEnabled) &&
            !editorOpen &&
            bot.deleted_at === null &&
            !mutation.busy,
        },
      },
    ],
    { preventDefault: true, eventType: 'keydown' },
  )
  return (
    <>
      <Menu.Root
        open={menuOpen}
        onOpenChange={(open) => {
          if (open) launching.current = false
          setMenuOpen(open)
        }}
      >
        {!hideTrigger && (
          <Menu.Trigger
            ref={trigger}
            className="bw-icon"
            aria-label={`Manage ${bot.name}`}
            disabled={mutation.busy}
          >
            <MoreHorizontal size={17} aria-hidden />
          </Menu.Trigger>
        )}
        <Menu.Portal>
          <Menu.Positioner
            className="bw-positioner"
            align={contextAnchor ? 'start' : 'end'}
            sideOffset={contextAnchor ? 0 : 5}
            anchor={
              contextAnchor
                ? {
                    getBoundingClientRect: () =>
                      new DOMRect(contextAnchor.x, contextAnchor.y, 0, 0),
                  }
                : undefined
            }
          >
            <Menu.Popup
              className="bw-menu"
              aria-label={`${bot.name} actions`}
              finalFocus={() =>
                launching.current
                  ? false
                  : (contextTarget.current ?? trigger.current)
              }
            >
              {bot.deleted_at === null ? (
                <>
                  {!personalAssistant && (
                    <Menu.Item
                      className="bw-menu-item"
                      disabled={mutation.busy}
                      closeOnClick={false}
                      onClick={() =>
                        void quickChange({
                          type: 'archive',
                          archived: bot.archived_at === null,
                        })
                      }
                    >
                      {bot.archived_at === null ? (
                        <Archive size={15} aria-hidden />
                      ) : (
                        <ArchiveRestore size={15} aria-hidden />
                      )}
                      {bot.archived_at === null ? 'Archive' : 'Unarchive'}
                      <kbd className="bw-menu-shortcut">
                        {formatForDisplay('Mod+Alt+A')}
                      </kbd>
                    </Menu.Item>
                  )}
                  <Menu.Item
                    className="bw-menu-item"
                    disabled={mutation.busy}
                    onClick={() =>
                      launch(() =>
                        onRename ? onRename() : setEditorOpen(true),
                      )
                    }
                  >
                    <Pencil size={15} aria-hidden />
                    Rename
                    <kbd className="bw-menu-shortcut">
                      {formatForDisplay('Mod+Alt+R')}
                    </kbd>
                  </Menu.Item>
                  <Menu.Item
                    className="bw-menu-item"
                    disabled={mutation.busy}
                    closeOnClick={false}
                    onClick={() =>
                      void quickChange({
                        type: 'pin',
                        pinned: !bot.pinned,
                      })
                    }
                  >
                    {bot.pinned ? (
                      <PinOff size={15} aria-hidden />
                    ) : (
                      <Pin size={15} aria-hidden />
                    )}
                    {bot.pinned ? 'Unpin' : 'Pin'}
                    <kbd className="bw-menu-shortcut">
                      {formatForDisplay('Mod+Alt+P')}
                    </kbd>
                  </Menu.Item>
                  {onDuplicate && (
                    <Menu.Item
                      className="bw-menu-item"
                      disabled={mutation.busy}
                      onClick={() => launch(() => onDuplicate(bot))}
                    >
                      <Copy size={15} aria-hidden />
                      Duplicate
                      <kbd className="bw-menu-shortcut">
                        {formatForDisplay('Mod+Alt+D')}
                      </kbd>
                    </Menu.Item>
                  )}
                  {onCreate && bot.archived_at === null && (
                    <Menu.Item
                      className="bw-menu-item"
                      disabled={mutation.busy}
                      onClick={() => launch(() => onCreate(bot.id))}
                    >
                      <Plus size={15} aria-hidden />
                      New chat
                      <kbd className="bw-menu-shortcut">
                        {formatForDisplay('Mod+Alt+N')}
                      </kbd>
                    </Menu.Item>
                  )}
                </>
              ) : null}
              <Menu.Item
                className="bw-menu-item"
                disabled={mutation.busy}
                onClick={() => launch(() => setEditorOpen(true))}
              >
                {bot.deleted_at === null ? (
                  <Settings2 size={15} aria-hidden />
                ) : (
                  <ArchiveRestore size={15} aria-hidden />
                )}
                {bot.deleted_at === null ? 'Settings' : 'Restore…'}
                {bot.deleted_at === null && (
                  <kbd className="bw-menu-shortcut">
                    {formatForDisplay('Mod+Alt+S')}
                  </kbd>
                )}
              </Menu.Item>
              {mutation.busy && (
                <p className="bw-menu-status" role="status">
                  Saving…
                </p>
              )}
              <MutationError
                error={mutation.error}
                conflict={mutation.conflict}
                onReload={() => void mutation.refresh()}
              />
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      {editorOpen && (
        <BotEditor
          key={bot.id}
          bot={bot}
          bots={bots}
          sections={sections}
          onChanged={onChanged}
          request={request}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </>
  )
}

export function BotEditor({
  bot,
  bots,
  sections,
  onChanged,
  request,
  onClose,
}: {
  bot: WorkspaceBot
  bots: WorkspaceBot[]
  sections: BotSection[]
  onClose: () => void
} & MutationProps) {
  const nameInput = useRef<HTMLInputElement>(null)
  const parentPickerId = useId()
  const sectionPickerId = useId()
  const [name, setName] = useState(bot.name)
  const [version] = useState(bot.version)
  const [purpose, setPurpose] = useState(bot.purpose)
  const [parentId, setParentId] = useState(bot.parent_id ?? '')
  const [sectionId, setSectionId] = useState(bot.section_id ?? '')
  const [deleting, setDeleting] = useState(false)
  const [descendants, setDescendants] = useState<'subtree' | 'reparent'>(
    'reparent',
  )
  const mutation = useWorkspaceMutation({ request, onChanged })
  const childIds = useMemo(() => descendantIds(bots, bot.id), [bots, bot.id])
  const children = bots.filter(
    (candidate) => childIds.has(candidate.id) && candidate.deleted_at === null,
  )
  const availableParents = bots.filter(
    (candidate) =>
      candidate.id !== bot.id &&
      !childIds.has(candidate.id) &&
      candidate.deleted_at === null &&
      candidate.archived_at === null,
  )
  const parentChoices = availableParents.some(
    (candidate) => candidate.id === bot.parent_id,
  )
    ? availableParents
    : [
        ...availableParents,
        ...bots.filter(
          (candidate) =>
            candidate.id === bot.parent_id && candidate.deleted_at === null,
        ),
      ]
  const reload = async () => {
    if (await mutation.refresh()) onClose()
  }
  const save = async (path: string, body?: unknown, method = 'POST') => {
    if (await mutation.run(path, body, method)) onClose()
  }
  return (
    <WorkspaceDialog
      title={deleting ? `Delete ${bot.name}?` : bot.name}
      onClose={onClose}
      busy={mutation.busy}
      initialFocus={nameInput}
    >
      <MutationError
        error={mutation.error}
        conflict={mutation.conflict}
        onReload={() => void reload()}
      />
      {bot.deleted_at !== null ? (
        <>
          <p>
            Nested conversations deleted together will also be restored. Those
            deleted separately will stay in Trash.
          </p>
          <div className="bw-form-actions">
            <Button
              type="button"
              variant="primary"
              disabled={mutation.busy}
              onClick={() => void save(`bots/${bot.id}/restore`, { version })}
            >
              {mutation.busy ? 'Restoring…' : 'Restore'}
            </Button>
          </div>
        </>
      ) : deleting ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save(`bots/${bot.id}/delete`, {
              version,
              descendants,
            })
          }}
        >
          <p>This conversation will move to Trash. You can restore it later.</p>
          {children.length > 0 && (
            <fieldset disabled={mutation.busy} className="bw-delete-options">
              <legend>
                {children.length} nested{' '}
                {children.length === 1 ? 'conversation' : 'conversations'}
              </legend>
              <label className="bw-radio">
                <input
                  type="radio"
                  name="descendants"
                  checked={descendants === 'reparent'}
                  onChange={() => setDescendants('reparent')}
                />
                Keep nested conversations and move them up one level
              </label>
              <label className="bw-radio">
                <input
                  type="radio"
                  name="descendants"
                  checked={descendants === 'subtree'}
                  onChange={() => setDescendants('subtree')}
                />
                Move this conversation and everything nested under it to Trash
              </label>
            </fieldset>
          )}
          <div className="bw-form-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.busy}
              onClick={() => setDeleting(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={mutation.busy}>
              {mutation.busy ? 'Deleting…' : 'Move to Trash'}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void save(
                `bots/${bot.id}`,
                {
                  version,
                  name: name.trim(),
                  purpose,
                  parentId: parentId || null,
                },
                'PATCH',
              )
            }}
          >
            <fieldset className="bw-fields" disabled={mutation.busy}>
              <label>
                Name
                <input
                  required
                  ref={nameInput}
                  value={name}
                  maxLength={60}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label>
                Purpose
                <textarea
                  value={purpose}
                  rows={3}
                  maxLength={2000}
                  onChange={(event) => setPurpose(event.target.value)}
                />
              </label>
              <label htmlFor={parentPickerId}>
                Under
                <SelectField
                  id={parentPickerId}
                  value={parentId}
                  onValueChange={(value) => setParentId(value)}
                  items={[
                    {
                      value: '',
                      label: 'Top level',
                    },
                    ...parentChoices.map((candidate) => ({
                      value: candidate.id,
                      label: (
                        <>
                          {candidate.name}
                          {candidate.archived_at !== null ? ' (archived)' : ''}
                        </>
                      ),
                    })),
                  ]}
                />
              </label>
              <div className="bw-form-actions">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!name.trim() || mutation.conflict}
                >
                  {mutation.busy ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </fieldset>
          </form>
          <form
            className="bw-organization"
            onSubmit={(event) => {
              event.preventDefault()
              void save(
                `bots/${bot.id}/organization`,
                {
                  sectionId: sectionId || null,
                  pinned: false,
                },
                'PATCH',
              )
            }}
          >
            <fieldset className="bw-fields" disabled={mutation.busy}>
              <legend>Your sidebar</legend>
              <label htmlFor={sectionPickerId}>
                Section
                <SelectField
                  id={sectionPickerId}
                  value={sectionId}
                  onValueChange={(value) => setSectionId(value)}
                  items={[
                    {
                      value: '',
                      label: 'No section',
                    },
                    ...[...sections]
                      .sort((a, b) => a.position - b.position)
                      .map((section) => ({
                        value: section.id,
                        label: section.name,
                      })),
                  ]}
                />
              </label>
              <div className="bw-form-actions">
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={mutation.conflict}
                >
                  Save organization
                </Button>
              </div>
            </fieldset>
          </form>
          <div className="bw-lifecycle">
            <div className="bw-form-actions bw-lifecycle-actions">
              <Button
                type="button"
                variant="danger"
                disabled={mutation.busy || mutation.conflict}
                onClick={() => setDeleting(true)}
              >
                Delete
              </Button>
            </div>
          </div>
        </>
      )}
    </WorkspaceDialog>
  )
}

function SectionManager({
  sections,
  request,
  onChanged,
  onClose,
}: {
  sections: BotSection[]
  onClose: () => void
} & MutationProps) {
  const editInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<BotSection | null>(null)
  const editingId = editing?.id
  useEffect(() => {
    if (editingId) editInput.current?.focus()
  }, [editingId])
  const [editName, setEditName] = useState('')
  const [deleting, setDeleting] = useState<BotSection | null>(null)
  const mutation = useWorkspaceMutation({ request, onChanged })
  const ordered = [...sections].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id),
  )
  return (
    <WorkspaceDialog title="Sections" onClose={onClose} busy={mutation.busy}>
      <MutationError
        error={mutation.error}
        conflict={mutation.conflict}
        onReload={async () => {
          if (await mutation.refresh()) {
            setEditing(null)
            setDeleting(null)
          }
        }}
      />
      <ul className="bw-section-list">
        {ordered.map((section) => (
          <li key={section.id}>
            {editing?.id === section.id ? (
              <form
                className="bw-section-edit"
                onSubmit={async (event) => {
                  event.preventDefault()
                  if (
                    await mutation.run(
                      `sections/${section.id}`,
                      { version: editing.version, name: editName.trim() },
                      'PATCH',
                    )
                  )
                    setEditing(null)
                }}
              >
                <label className="bw-sr-only" htmlFor={`section-${section.id}`}>
                  Section name
                </label>
                <input
                  id={`section-${section.id}`}
                  ref={editInput}
                  required
                  maxLength={60}
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  disabled={mutation.busy}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={
                    mutation.busy || mutation.conflict || !editName.trim()
                  }
                >
                  Save
                </Button>
                <button
                  type="button"
                  className="bw-icon"
                  aria-label="Cancel rename"
                  onClick={() => setEditing(null)}
                  disabled={mutation.busy}
                >
                  <X size={16} />
                </button>
              </form>
            ) : (
              <>
                <span className="bw-section-name">{section.name}</span>
                <div className="bw-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={mutation.busy}
                    aria-label={`Rename ${section.name}`}
                    onClick={() => {
                      setEditing(section)
                      setEditName(section.name)
                      setDeleting(null)
                    }}
                  >
                    Rename
                  </Button>
                  <button
                    type="button"
                    className="bw-icon"
                    disabled={mutation.busy}
                    aria-label={`Delete section ${section.name}`}
                    onClick={() => {
                      setDeleting(section)
                      setEditing(null)
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {deleting && (
        <div className="bw-section-delete">
          <p>Remove {deleting.name}? Its conversations will stay available.</p>
          <div className="bw-form-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.busy}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={mutation.busy}
              onClick={async () => {
                if (
                  await mutation.run(
                    `sections/${deleting.id}`,
                    undefined,
                    'DELETE',
                  )
                )
                  setDeleting(null)
              }}
            >
              Remove section
            </Button>
          </div>
        </div>
      )}
      <form
        className="bw-new-section"
        onSubmit={async (event) => {
          event.preventDefault()
          if (await mutation.run('sections', { name: name.trim() })) setName('')
        }}
      >
        <label>
          New section
          <input
            required
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={mutation.busy}
          />
        </label>
        <Button
          type="submit"
          variant="primary"
          disabled={mutation.busy || !name.trim()}
        >
          Add section
        </Button>
      </form>
    </WorkspaceDialog>
  )
}

function useSectionContext(disabled = false) {
  const [anchor, setAnchor] = useState<{
    x: number
    y: number
    target: HTMLElement
  } | null>(null)
  const open = (target: HTMLElement, x: number, y: number) => {
    if (disabled) return
    target.focus({ preventScroll: true })
    setAnchor({ target, x, y })
  }
  const longPress = useLongPress(open, disabled)
  return {
    anchor,
    setAnchor,
    handlers: {
      ...longPress,
      tabIndex: 0,
      onContextMenu(event: React.MouseEvent<HTMLElement>) {
        event.preventDefault()
        event.stopPropagation()
        open(event.currentTarget, event.clientX, event.clientY)
      },
      onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
        if (
          event.key === 'ContextMenu' ||
          (event.shiftKey && event.key === 'F10')
        ) {
          event.preventDefault()
          const rect = event.currentTarget.getBoundingClientRect()
          open(event.currentTarget, rect.left, rect.bottom)
        }
      },
    },
    positioner: {
      anchor: anchor
        ? { getBoundingClientRect: () => new DOMRect(anchor.x, anchor.y, 0, 0) }
        : undefined,
      sideOffset: 0,
    },
  }
}

function SectionDisplayMenu({
  header,
  textOptions,
  label,
  value,
  defaultValue,
  onChange,
}: {
  header: ReactNode
  label: string
  textOptions: ReactNode
  value: SidebarDensity | 'default'
  defaultValue: SidebarDensity
  onChange: (value: SidebarDensity | 'default') => void
}) {
  const context = useSectionContext()
  return (
    <div className="bw-section-context" {...context.handlers}>
      {header}
      <Popover.Root
        open={!!context.anchor}
        onOpenChange={(open) => {
          if (!open) context.setAnchor(null)
        }}
      >
        <Popover.Portal>
          <Popover.Positioner
            className="bw-positioner"
            align="start"
            {...context.positioner}
          >
            <Popover.Popup
              className="bw-menu bw-section-options"
              finalFocus={() => context.anchor?.target ?? false}
            >
              <Popover.Title className="bw-sr-only">
                Options for {label}
              </Popover.Title>
              <SectionDisplayOptions
                textOptions={textOptions}
                value={value}
                defaultValue={defaultValue}
                onChange={onChange}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

function SectionDisplayOptions({
  textOptions,
  value,
  defaultValue,
  onChange,
}: {
  textOptions: ReactNode
  value: SidebarDensity | 'default'
  defaultValue: SidebarDensity
  onChange: (value: SidebarDensity | 'default') => void
}) {
  const defaultDisplayId = useId()
  return (
    <div className="bw-section-display-controls">
      {textOptions}
      <label className="bw-display-inherit" htmlFor={defaultDisplayId}>
        <Checkbox
          id={defaultDisplayId}
          aria-label="Use default display"
          checked={value === 'default'}
          onCheckedChange={(checked) =>
            onChange(checked ? 'default' : defaultValue)
          }
        />
        Use default display
      </label>
      <SegmentedControl
        label="Conversation display"
        value={value === 'default' ? defaultValue : value}
        onValueChange={onChange}
        options={[
          {
            value: 'comfortable',
            label: 'Standard',
            icon: <Rows3 size={18} aria-hidden />,
          },
          {
            value: 'compact',
            label: 'Compact',
            icon: <List size={18} aria-hidden />,
          },
        ]}
      />
    </div>
  )
}

function SelectionToolbar(props: React.ComponentProps<typeof motion.div>) {
  const transition = useUiTransition()
  return (
    <motion.div
      {...props}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={transition}
      style={{ overflow: 'clip' }}
    />
  )
}

function InlineConversationName({
  bot,
  request,
  onChanged,
  onClose,
}: { bot: WorkspaceBot; onClose: () => void } & MutationProps) {
  const [name, setName] = useState(bot.name)
  const version = useRef(bot.version)
  const input = useRef<HTMLInputElement>(null)
  const closing = useRef(false)
  const saving = useRef(false)
  const mutation = useWorkspaceMutation({ request, onChanged })
  const [bounds, setBounds] = useState<CSSProperties>({})
  useLayoutEffect(() => {
    const row = input.current?.closest('.bw-row')
    const title = row?.querySelector('.bw-row-title')
    if (row && title) {
      const outer = row.getBoundingClientRect()
      const rect = title.getBoundingClientRect()
      setBounds({
        top: rect.top - outer.top,
        left: rect.left - outer.left,
        width: rect.width,
        height: rect.height,
      })
    }
    input.current?.focus()
    input.current?.select()
  }, [])
  const close = (restoreFocus = true) => {
    closing.current = true
    const row = input.current?.closest('.bw-row')
    onClose()
    if (restoreFocus)
      requestAnimationFrame(() =>
        row
          ?.querySelector<HTMLButtonElement>('.bw-select')
          ?.focus({ preventScroll: true }),
      )
  }
  const save = async (restoreFocus = true) => {
    if (closing.current || saving.current || !name.trim()) return
    if (name.trim() === bot.name) return close(restoreFocus)
    saving.current = true
    try {
      if (
        await mutation.run(
          `bots/${encodeURIComponent(bot.id)}`,
          { version: version.current, name: name.trim() },
          'PATCH',
        )
      )
        close(restoreFocus)
    } finally {
      saving.current = false
    }
  }
  return (
    <form
      className="bw-inline-rename"
      onKeyDown={(event) => event.stopPropagation()}
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="bw-inline-rename-field" style={bounds}>
        <input
          ref={input}
          aria-label="Conversation name"
          value={name}
          maxLength={60}
          required
          disabled={mutation.busy}
          onBlur={() => void save(false)}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Escape' && !mutation.busy) {
              event.preventDefault()
              close()
            }
          }}
        />
        {mutation.error && (
          <span className="bw-error" role="alert">
            {mutation.error}
          </span>
        )}
      </div>
    </form>
  )
}
