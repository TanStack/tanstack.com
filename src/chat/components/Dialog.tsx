import type { ReactNode } from 'react'
import { Modal } from './ui/Modal'

export function Dialog({
  title,
  onClose,
  children,
  wide = false,
  className,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  className?: string
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      className={className ?? (wide ? 'dialog wide' : 'dialog')}
    >
      {children}
    </Modal>
  )
}
