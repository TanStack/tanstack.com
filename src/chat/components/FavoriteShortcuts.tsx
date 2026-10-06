import { useCallback } from 'react'
import { DragDropProvider } from '@dnd-kit/react'
import { useSortable, isSortable } from '@dnd-kit/react/sortable'
import { PointerSensor, PointerActivationConstraints } from '@dnd-kit/dom'
import type { HomeSection } from '../core/home-navigation'
import { homeResources } from './home-resources'
import { IconButton } from './IconButton'

function Shortcut({
  id,
  index,
  onOpen,
  active = false,
}: {
  active?: boolean
  id: HomeSection
  index: number
  onOpen: (id: HomeSection) => void
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id,
    index,
    group: 'favorite-pages',
  })
  const attachButton = useCallback(
    (node: HTMLButtonElement | null) => {
      ref(node)
      handleRef(node)
    },
    [ref, handleRef],
  )
  const Icon = homeResources[id].icon
  return (
    <IconButton
      ref={attachButton}
      className="workspace-shortcut"
      aria-current={active ? 'page' : undefined}
      data-dragging={isDragging || undefined}
      label={homeResources[id].label}
      tooltipSide="right"
      onClick={() => onOpen(id)}
    >
      <Icon size={20} aria-hidden />
    </IconButton>
  )
}
export function FavoriteShortcuts({
  favorites,
  activeId,
  onMove,
  onOpen,
}: {
  activeId?: string
  favorites: HomeSection[]
  onMove: (id: HomeSection, index: number) => void
  onOpen: (id: HomeSection) => void
}) {
  return (
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
          !event.canceled &&
          isSortable(source) &&
          source.index !== source.initialIndex
        ) {
          onMove(source.id as HomeSection, source.index)
        }
      }}
    >
      {favorites.map((id, index) => (
        <Shortcut
          key={id}
          active={id === activeId}
          id={id}
          index={index}
          onOpen={onOpen}
        />
      ))}
    </DragDropProvider>
  )
}
