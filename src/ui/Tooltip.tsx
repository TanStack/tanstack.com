import * as React from 'react'
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import { twMerge } from 'tailwind-merge'

interface TooltipProps {
  children: React.ReactElement
  content: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  delayDuration?: number
  className?: string
}

export function Tooltip({
  children,
  content,
  side = 'top',
  align = 'center',
  delayDuration = 200,
  className,
}: TooltipProps) {
  if (!content) {
    return <>{children}</>
  }

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger delay={delayDuration} render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} align={align} sideOffset={5}>
          <TooltipPrimitive.Popup
            className={twMerge(
              'z-50 rounded-lg px-3 py-2 text-xs',
              'bg-background-inverse text-text-inverse',
              'shadow-lg',
              'origin-(--transform-origin) transition',
              'data-starting-style:scale-95 data-starting-style:opacity-0',
              'data-ending-style:scale-95 data-ending-style:opacity-0',
              'motion-reduce:transition-none',
              className,
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-background-inverse" />
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
