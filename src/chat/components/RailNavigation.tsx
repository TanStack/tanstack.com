import { useCallback, useSyncExternalStore } from 'react'
import { Home } from 'lucide-react'
import { DragDropProvider } from '@dnd-kit/react'
import { useSortable, isSortable } from '@dnd-kit/react/sortable'
import { PointerSensor, PointerActivationConstraints } from '@dnd-kit/dom'
import { homeResources } from './home-resources'
import { IconButton } from './IconButton'

const defaults = ['chat', 'skills', 'community'] as const
export type RailPage = (typeof defaults)[number]
const changed = 'tanchat:rail-order'
const memory = new Map<string, string>()
const initial = JSON.stringify(defaults)
function isPage(value: unknown): value is RailPage {
  return value === 'chat' || value === 'skills' || value === 'community'
}
function subscribe(notify: () => void) {
  window.addEventListener('storage', notify)
  window.addEventListener(changed, notify)
  return () => {
    window.removeEventListener('storage', notify)
    window.removeEventListener(changed, notify)
  }
}
function parse(raw: string): RailPage[] {
  try {
    const value: unknown = JSON.parse(raw)
    if (Array.isArray(value)) {
      const saved = [...new Set(value.filter(isPage))]
      return [...saved, ...defaults.filter((id) => !saved.includes(id))]
    }
  } catch {
    /* Use the default order for invalid preferences. */
  }
  return [...defaults]
}
function Shortcut({
  id,
  index,
  active,
  onOpen,
}: {
  id: RailPage
  index: number
  active: boolean
  onOpen: (id: RailPage) => void
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id,
    index,
    group: 'rail-pages',
  })
  const attach = useCallback(
    (node: HTMLButtonElement | null) => {
      ref(node)
      handleRef(node)
    },
    [ref, handleRef],
  )
  const Icon = id === 'chat' ? Home : homeResources[id].icon
  return (
    <IconButton
      ref={attach}
      label={id === 'chat' ? 'Chat' : homeResources[id].label}
      tooltipSide="right"
      className="workspace-shortcut"
      aria-current={active ? 'page' : undefined}
      data-dragging={isDragging || undefined}
      onClick={() => onOpen(id)}
    >
      <Icon size={20} aria-hidden />
    </IconButton>
  )
}
export function RailNavigation({
  userId,
  activeId,
  onOpen,
}: {
  userId: string
  activeId?: string
  onOpen: (id: RailPage) => void
}) {
  const key = `tanchat.rail-order:${userId}`
  const read = () => {
    try {
      return localStorage.getItem(key) ?? memory.get(key) ?? initial
    } catch {
      return memory.get(key) ?? initial
    }
  }
  const raw = useSyncExternalStore(subscribe, read, () => initial)
  return (
    <nav className="workspace-shortcuts" aria-label="Workspace pages">
      <div className="workspace-favorites">
        <DragDropProvider
          sensors={(defaults) => [
            ...defaults.filter((sensor) => sensor !== PointerSensor),
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
          onDragEnd={(event) => {
            const source = event.operation.source
            if (
              event.canceled ||
              !isSortable(source) ||
              !isPage(source.id) ||
              source.index === source.initialIndex
            )
              return
            const next = parse(read()).filter((id) => id !== source.id)
            next.splice(
              Math.max(0, Math.min(source.index, next.length)),
              0,
              source.id,
            )
            const saved = JSON.stringify(next)
            memory.set(key, saved)
            try {
              localStorage.setItem(key, saved)
            } catch {
              /* Retain the order for this session. */
            }
            window.dispatchEvent(new Event(changed))
          }}
        >
          {parse(raw).map((id, index) => (
            <Shortcut
              key={id}
              id={id}
              index={index}
              active={activeId === id}
              onOpen={onOpen}
            />
          ))}
        </DragDropProvider>
      </div>
    </nav>
  )
}
