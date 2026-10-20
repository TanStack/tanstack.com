import { useContext, type ComponentProps, type ReactNode } from 'react'
import { Tooltip } from '@base-ui/react/tooltip'
import { PortalContainer } from './PortalContainer'
import './icon-button.css'
import { Button } from './ui/Button'

export function IconButton({
  label,
  tooltip = label,
  tooltipSide = 'top',
  children,
  className,
  disabled,
  onClick,
  ...props
}: Omit<ComponentProps<'button'>, 'aria-label' | 'title'> & {
  label: string
  tooltip?: string
  tooltipSide?: ComponentProps<typeof Tooltip.Positioner>['side']
  children: ReactNode
}) {
  const container = useContext(PortalContainer)
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            focusableWhenDisabled
          />
        }
        type="button"
        {...props}
        className={['icon-button', className].filter(Boolean).join(' ')}
        aria-label={label}
        aria-disabled={disabled || undefined}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault()
            return
          }
          onClick?.(event)
        }}
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal container={container}>
        <Tooltip.Positioner
          side={tooltipSide}
          sideOffset={6}
          className="action-tooltip-positioner"
        >
          <Tooltip.Popup className="action-tooltip">{tooltip}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
