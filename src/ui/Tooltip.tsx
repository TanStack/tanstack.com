import * as React from 'react'
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
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
    <BaseTooltip.Root>
      <BaseTooltip.Trigger delay={delayDuration} render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} align={align} sideOffset={5}>
          <BaseTooltip.Popup
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
            <BaseTooltip.Arrow className="fill-background-inverse" />
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}
