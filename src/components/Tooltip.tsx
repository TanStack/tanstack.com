import type * as React from 'react'
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'

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
  return (
    <TooltipPrimitive.Provider delay={0}>
      <TooltipPrimitive.Root disableHoverablePopup>
        <TooltipPrimitive.Trigger render={children} />
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Positioner
            side={placement}
            sideOffset={5}
            className="z-1300"
          >
            <TooltipPrimitive.Popup
              className={`rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white shadow-lg dark:bg-gray-800 ${className}`}
            >
              {content}
            </TooltipPrimitive.Popup>
          </TooltipPrimitive.Positioner>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
