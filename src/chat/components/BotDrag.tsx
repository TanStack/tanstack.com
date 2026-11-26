import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react'
import {
  DragDropProvider,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
} from '@dnd-kit/react'
import {
  Accessibility,
  Cursor,
  KeyboardSensor,
  PointerSensor,
  PointerActivationConstraints,
} from '@dnd-kit/dom'
import {
  botDropPlacement,
  planBotDrop,
  type BotDragSource,
  type BotDropTarget,
} from '../core/bot-drag'
import type { BotSection, WorkspaceBot } from '../core/bot-workspace'

type VisualDropTarget = BotDropTarget & {
  axis?: 'x' | 'y'
  marker?: { id: string; placement: 'before' | 'after' }
}

type Group = {
  parentId: string | null
  sectionId: string | null
  pinned: boolean
}
type Context = {
  enabled: boolean
  selectedIds: string[]
  source: BotDragSource | null
  target: VisualDropTarget | null
}
const Context = createContext<Context>({
  enabled: false,
  selectedIds: [],
  source: null,
  target: null,
})
export function useBotDragActive() {
  return useContext(Context).source !== null
}
export function BotDragProvider({
  bots,
  sections,
  request,
  onChanged,
  enabled = true,
  selectedIds = [],
  children,
}: {
  bots: WorkspaceBot[]
  sections: BotSection[]
  request: (path: string, body?: unknown, method?: string) => Promise<unknown>
  onChanged: () => void | Promise<void>
  enabled?: boolean
  selectedIds?: string[]
  children: ReactNode
}) {
  const captured = useRef<{
    bots: WorkspaceBot[]
    sections: BotSection[]
    source: BotDragSource | null
  }>({ bots, sections, source: null })
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const [source, setSource] = useState<BotDragSource | null>(null)
  const [target, setTarget] = useState<VisualDropTarget | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [error, setError] = useState('')
  function resolveTarget(event: DragMoveEvent | DragOverEvent | DragEndEvent) {
    const operation = event.operation
    const from = captured.current.source
    const to = operation.target?.data.target as BotDropTarget | undefined
    let next: VisualDropTarget | null = to ?? null
    if (next && next.kind !== 'group' && operation.target?.element) {
      const element = operation.target.element
      const rect = element.getBoundingClientRect()
      const grid = element.parentElement
      const horizontal =
        next.kind === 'bot' &&
        !!element.closest('.bw-density-icons') &&
        !!grid &&
        getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean)
          .length > 1
      const axis = horizontal ? 'x' : 'y'
      const rtl = horizontal && getComputedStyle(element).direction === 'rtl'

      const placement = botDropPlacement(
        horizontal
          ? rtl
            ? rect.right - operation.position.current.x
            : operation.position.current.x
          : operation.position.current.y,
        horizontal ? (rtl ? 0 : rect.left) : rect.top,
        horizontal ? rect.width : rect.height,
        next.kind === 'bot',
      )
      next =
        next.kind === 'bot'
          ? { ...next, placement, axis }
          : { ...next, placement: placement === 'before' ? 'before' : 'after' }
      // Both sides of a grid gap share one marker. Keep the drop plan tied
      // to the actual target; only its visual boundary is normalized.
      if (horizontal && next.kind === 'bot' && placement === 'after') {
        const sibling = element.nextElementSibling
        const id = sibling?.getAttribute('data-bot-id')
        // At a row wrap, keep the marker on the hovered tile's trailing
        // edge instead of jumping to the opposite side of the next row.
        const sameRow =
          sibling &&
          Math.abs(sibling.getBoundingClientRect().top - rect.top) < 1
        if (id && sameRow)
          next = { ...next, marker: { id, placement: 'before' } }
      }
    }
    const plan =
      from && next
        ? planBotDrop(
            captured.current.bots,
            captured.current.sections,
            from,
            next,
          )
        : null
    return { target: plan ? next : null, plan }
  }
  function update(event: DragMoveEvent | DragOverEvent) {
    const resolved = resolveTarget(event)
    setTarget(resolved.target)
    setAnnouncement(resolved.plan?.announcement ?? 'No move')
  }
  return (
    <Context.Provider
      value={{ enabled: enabled && !pending, selectedIds, source, target }}
    >
      <DragDropProvider
        plugins={(defaults) => [
          ...defaults.filter(
            (plugin) => plugin !== Accessibility && plugin !== Cursor,
          ),
          Cursor.configure({ cursor: 'default' }),
          Accessibility.configure({
            screenReaderInstructions: {
              draggable:
                'Press Space to pick up. Use arrow keys to move, Space to drop, or Escape to cancel.',
            },
            announcements: {
              dragstart: (event: DragStartEvent) =>
                `Picked up ${event.operation.source?.data.label ?? 'item'}. Children stay attached.`,
              dragend: (event: DragEndEvent) =>
                event.canceled ? 'Move canceled.' : undefined,
            },
          }),
        ]}
        sensors={(defaults) => [
          ...defaults.filter(
            (sensor) => sensor !== PointerSensor && sensor !== KeyboardSensor,
          ),
          KeyboardSensor.configure({
            // Compact rows have insertion edges narrower than the default step.
            offset: { x: 10, y: 5 },
            keyboardCodes: {
              ...KeyboardSensor.defaults.keyboardCodes,
              start: ['Space'],
            },
          }),
          PointerSensor.configure({
            activationConstraints: (event) =>
              event.pointerType === 'touch'
                ? [
                    new PointerActivationConstraints.Delay({
                      value: 180,
                      tolerance: 5,
                    }),
                  ]
                : [new PointerActivationConstraints.Distance({ value: 5 })],
          }),
        ]}
        onDragStart={(event) => {
          const from =
            (event.operation.source?.data.source as BotDragSource) ?? null
          captured.current = { bots, sections, source: from }
          setError('')
          setSource(from)
          setTarget(null)
        }}
        onDragMove={update}
        onDragOver={update}
        onDragEnd={async (event) => {
          const { plan } = resolveTarget(event)
          setSource(null)
          setTarget(null)
          if (event.canceled) setAnnouncement('')
          if (event.canceled || !plan || busy.current) return
          busy.current = true
          setPending(true)
          try {
            await request(plan.path, plan.body, plan.method)
            setAnnouncement(plan.announcement.replace(/^Move /, 'Moved '))
          } catch (e) {
            setError(
              e instanceof Error ? e.message : 'Could not move this item.',
            )
            await Promise.resolve(onChanged()).catch(() => {})
          } finally {
            busy.current = false
            setPending(false)
          }
        }}
      >
        {children}
      </DragDropProvider>
      <span style={hidden} aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
      {error && <p role="alert">{error}</p>}
    </Context.Provider>
  )
}
const hidden: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
}
function useItemDrag(
  source: BotDragSource,
  label: string,
  disabled: boolean,
  group?: Group,
) {
  const context = useContext(Context)
  const grouped =
    source.kind === 'bot' && context.selectedIds.includes(source.id)
  const dragSource = grouped ? { ...source, ids: context.selectedIds } : source
  const dragLabel =
    grouped && context.selectedIds.length > 1
      ? `${context.selectedIds.length} selected conversations`
      : label
  const drag = useDraggable({
    id: `drag:${source.kind}:${source.id}`,
    type: source.kind,
    data: { source: dragSource, label: dragLabel },
    disabled: disabled || !context.enabled,
  })
  const drop = useDroppable({
    id: `drag:${source.kind}:${source.id}`,
    accept: source.kind,
    data: { target: { ...source, placement: 'after' }, label },
    disabled:
      disabled ||
      !context.enabled ||
      (context.source?.kind === source.kind &&
        (context.source.id === source.id ||
          (context.source.kind === 'bot' &&
            context.source.ids?.includes(source.id)))),
  })
  const groupDrop = useDroppable({
    id: `group:section:${source.id}`,
    accept: 'bot',
    data: { target: group ? { kind: 'group', ...group } : null },
    disabled: !group || !context.enabled,
  })
  const matched =
    context.target &&
    context.target.kind === source.kind &&
    context.target.id === source.id
  const markerMatched = context.target?.marker
    ? source.kind === 'bot' && context.target.marker.id === source.id
    : matched
  const groupMatched =
    group &&
    context.target?.kind === 'group' &&
    context.target.sectionId === group.sectionId &&
    context.target.parentId === group.parentId &&
    context.target.pinned === group.pinned
  const sourceRef = useCallback(
    (element: Element | null) => {
      drag.ref(element)
      drop.ref(element)
      groupDrop.ref(element)
    },
    [drag.ref, drop.ref, groupDrop.ref],
  )
  return {
    sourceRef,
    handleRef: drag.handleRef,
    isDragging:
      drag.isDragging ||
      (source.kind === 'bot' &&
        context.source?.kind === 'bot' &&
        !!context.source.ids?.includes(source.id)),
    dropAxis: markerMatched ? context.target?.axis : undefined,
    dropState:
      markerMatched && context.target?.kind !== 'group'
        ? (context.target?.marker?.placement ?? context.target?.placement)
        : groupMatched
          ? 'inside'
          : null,
    dragHandleProps: {
      'aria-label': `Move ${dragLabel}`,
      'aria-disabled': disabled || !context.enabled,
      disabled: disabled || !context.enabled,
      style: { touchAction: 'none' } as CSSProperties,
    },
  }
}
export function useBotDrag({ bot }: { bot: WorkspaceBot }) {
  return useItemDrag(
    { kind: 'bot', id: bot.id },
    bot.name,
    !!bot.archived_at || !!bot.deleted_at,
  )
}
export function useSectionDrag({ section }: { section: BotSection }) {
  return useItemDrag({ kind: 'section', id: section.id }, section.name, false, {
    sectionId: section.id,
    parentId: null,
    pinned: false,
  })
}
export function useBotGroupDrop(group: Group) {
  const context = useContext(Context)
  const drop = useDroppable({
    id: `group:${JSON.stringify(group)}`,
    accept: 'bot',
    data: { target: { kind: 'group', ...group } },
    disabled: !context.enabled,
  })
  return {
    dropRef: drop.ref,
    isDropTarget:
      context.target?.kind === 'group' &&
      context.target.sectionId === group.sectionId &&
      context.target.parentId === group.parentId &&
      context.target.pinned === group.pinned,
  }
}
