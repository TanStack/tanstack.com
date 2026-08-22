import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { twMerge } from 'tailwind-merge'

interface TooltipProps {
  children: React.ReactNode
  content: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  delayDuration?: number
  className?: string
}

export function Tooltip({
  children,
  content,
  side = 'top',
  delayDuration = 200,
  className,
}: TooltipProps) {
  if (!content) {
    return <>{children}</>
  }

  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align="center"
            sideOffset={5}
            className={twMerge(
              'z-1300 rounded-lg px-3 py-2 text-xs',
              'bg-background-inverse text-text-inverse',
              'shadow-lg',
              'animate-in fade-in-0 zoom-in-95',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
              '[transform-origin:var(--radix-tooltip-content-transform-origin)] motion-reduce:animate-none',
              className,
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-background-inverse" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
