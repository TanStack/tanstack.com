import { motion, useReducedMotion } from 'motion/react'
import { useUiTransition } from './motion'
import { Dialog } from '@base-ui/react/dialog'
import {
  useContext,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { X } from 'lucide-react'
import { PortalContainer } from '../PortalContainer'
import { IconButton } from '../IconButton'
import './modal.css'

export function Modal({
  title,
  onClose,
  busy = false,
  children,
  className = 'dialog',
  headingClassName = 'dialog-heading',
  initialFocus,
}: {
  title: string
  onClose: () => void
  busy?: boolean
  children: ReactNode
  className?: string
  headingClassName?: string
  initialFocus?: ComponentProps<typeof Dialog.Popup>['initialFocus']
}) {
  const parentContainer = useContext(PortalContainer)
  const popup = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(true)
  const transition = useUiTransition(0.2)
  const reduced = useReducedMotion()
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next, event) => {
        if (busy) {
          event.cancel()
          return
        }
        setOpen(next)
      }}
      onOpenChangeComplete={(next) => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal container={parentContainer}>
        <Dialog.Backdrop
          className="ui-modal-backdrop"
          render={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: open ? 1 : 0 }}
              transition={transition}
            />
          }
        />
        <Dialog.Popup
          initialFocus={initialFocus}
          ref={popup}
          className={`ui-modal ${className}`}
          render={
            <motion.div
              initial={{ opacity: 0, scale: reduced ? 1 : 0.98 }}
              animate={{
                opacity: open ? 1 : 0,
                scale: open || reduced ? 1 : 0.98,
              }}
              transition={transition}
            />
          }
        >
          <PortalContainer value={popup}>
            <div className={headingClassName}>
              <Dialog.Title>{title}</Dialog.Title>
              <IconButton
                label="Close"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                <X size={16} aria-hidden />
              </IconButton>
            </div>
            {children}
          </PortalContainer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
