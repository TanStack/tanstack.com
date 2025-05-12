import * as React from 'react'
import {
  useFloating,
  useHover,
  useInteractions,
  FloatingPortal,
  offset,
  shift,
  flip,
  autoUpdate,
} from '@floating-ui/react'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactElement
  placement?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}

export function Tooltip({
  content,
  children,
  placement = 'top',
  className = '',
}: TooltipProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement,
    middleware: [offset(5), flip(), shift()],
    whileElementsMounted: autoUpdate,
  })

  const hover = useHover(context)

  const { getReferenceProps, getFloatingProps } = useInteractions([hover])

  return (
    <>
      {React.cloneElement(children, {
        ref: refs.setReference,
        ...getReferenceProps(),
      })}
      <FloatingPortal>
        {isOpen && (
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className={`z-50 rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white shadow-lg dark:bg-gray-800 ${className}`}
          >
            {content}
          </div>
        )}
      </FloatingPortal>
    </>
  )
}
