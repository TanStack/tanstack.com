import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react'
import { Popover } from '@base-ui/react/popover'
import { Info, X } from 'lucide-react'
import { IconButton } from './IconButton'
import './conversation-card.css'
import './conversation-details-card.css'

const DetailsCardContext = createContext<{
  open: boolean
  triggerId: string
  trigger: RefObject<HTMLButtonElement | null>
} | null>(null)

export function ConversationDetailsToggle() {
  const card = useContext(DetailsCardContext)
  if (!card) return null
  return (
    <Popover.Trigger
      id={card.triggerId}
      ref={card.trigger}
      render={
        <IconButton label={card.open ? 'Hide details' : 'Show details'}>
          <Info size={17} aria-hidden />
        </IconButton>
      }
    />
  )
}

export function ConversationDetailsCard({
  anchor,
  animate,
  visible,
  open,
  onOpenChange,
  details,
  children,
}: {
  anchor: HTMLElement | null
  animate: boolean
  visible: boolean
  open: boolean
  onOpenChange: (open: boolean, options?: { replace?: boolean }) => void
  details: ReactNode
  children: ReactNode
}) {
  const triggerId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const wide = useRef(false)
  const automatic = useRef(false)
  const restoreFocus = useRef(false)
  const current = useRef({ open, onOpenChange })
  current.current = { open, onOpenChange }
  useEffect(() => {
    if (!anchor || !visible) return
    let previousWide: boolean | undefined
    const observer = new ResizeObserver(([entry]) => {
      if (!entry.contentRect.width) return
      // Match the breakpoint that makes room beside the message column.
      const nextWide = entry.contentRect.width >= 1120
      wide.current = nextWide
      if (nextWide === previousWide) return
      const firstMeasurement = previousWide === undefined
      previousWide = nextWide
      // Preserve an explicitly opened overlay on a narrow initial layout.
      if (firstMeasurement && !nextWide) return
      if (current.current.open === nextWide) return
      automatic.current = true
      if (!nextWide && popup.current?.contains(document.activeElement))
        trigger.current?.focus()
      current.current.onOpenChange(nextWide, { replace: true })
    })
    observer.observe(anchor)
    return () => observer.disconnect()
  }, [anchor, visible])
  return (
    <DetailsCardContext value={{ open, triggerId, trigger }}>
      <Popover.Root
        open={open && !!anchor}
        onOpenChange={(next, event) => {
          // Source navigation can close the card before its focus-out event.
          // Ignore that redundant event so Back keeps the original Details view.
          if (next === open) {
            event.cancel()
            return
          }
          // A roomy inspector can stay open while the conversation is used.
          if (
            wide.current &&
            (event.reason === 'outside-press' || event.reason === 'focus-out')
          ) {
            event.cancel()
            return
          }
          automatic.current = false
          restoreFocus.current = !next
          onOpenChange(next)
        }}
        triggerId={triggerId}
      >
        {children}
        <Popover.Portal container={anchor}>
          <div className="conversation-card-layer details-card-layer">
            <Popover.Positioner
              className="conversation-card-positioner details-card-positioner"
              anchor={anchor}
              side="bottom"
              align="end"
              sideOffset={({ anchor }) => 12 - anchor.height}
              alignOffset={12}
              collisionBoundary={anchor ?? undefined}
              collisionPadding={12}
              collisionAvoidance={{ side: 'shift', align: 'shift' }}
              positionMethod="absolute"
            >
              <Popover.Popup
                className="conversation-card details-card"
                data-panel-motion={animate || undefined}
                data-edge="right"
                ref={popup}
                initialFocus={() => (automatic.current ? false : popup.current)}
                finalFocus={() => {
                  // Explicit dismissal returns to the trigger. Route navigation
                  // owns its new focus, such as a source tab or child composer.
                  const restore = restoreFocus.current && !automatic.current
                  restoreFocus.current = false
                  return restore
                }}
              >
                <Popover.Title className="sr-only">Details</Popover.Title>
                <Popover.Close
                  className="conversation-card-close details-card-close"
                  render={
                    <IconButton label="Close details">
                      <X size={16} aria-hidden />
                    </IconButton>
                  }
                />
                <div className="conversation-card-content details-card-content">
                  {details}
                </div>
              </Popover.Popup>
            </Popover.Positioner>
          </div>
        </Popover.Portal>
      </Popover.Root>
    </DetailsCardContext>
  )
}
