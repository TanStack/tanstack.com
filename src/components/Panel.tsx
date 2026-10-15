import * as React from 'react'
import { twMerge } from 'tailwind-merge'

type PanelRenderProps = {
  open: boolean
  orientation: 'horizontal' | 'vertical'
  toggle: () => void
}

type PanelProps = {
  open?: boolean
  defaultOpen?: boolean
  orientation?: 'horizontal' | 'vertical'
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode | ((props: PanelRenderProps) => React.ReactNode)
  className?: string
}

type PanelTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode
}

type PanelContentProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode
}

const PanelContext = React.createContext<PanelRenderProps | null>(null)

function usePanel() {
  const context = React.useContext(PanelContext)
  if (!context) {
    throw new Error('Panel components must be used within a Panel')
  }
  return context
}

export function Panel({
  open: controlledOpen,
  defaultOpen = false,
  orientation = 'vertical',
  onOpenChange,
  children,
  className,
}: PanelProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const toggle = React.useCallback(() => {
    if (isControlled) {
      onOpenChange?.(!open)
    } else {
      setUncontrolledOpen((prev) => {
        const next = !prev
        onOpenChange?.(next)
        return next
      })
    }
  }, [isControlled, open, onOpenChange])

  const value = React.useMemo(
    () => ({ open, orientation, toggle }),
    [open, orientation, toggle],
  )

  return (
    <PanelContext.Provider value={value}>
      <div className={className} data-panel data-orientation={orientation}>
        {typeof children === 'function' ? children(value) : children}
      </div>
    </PanelContext.Provider>
  )
}

export function PanelTrigger({
  children,
  className,
  onClick,
  onMouseDown,
  type = 'button',
  ...props
}: PanelTriggerProps) {
  const { open, toggle } = usePanel()

  return (
    <button
      {...props}
      type={type}
      aria-expanded={open}
      onMouseDown={(e) => {
        e.stopPropagation()
        onMouseDown?.(e)
      }}
      onClick={(e) => {
        e.stopPropagation()
        toggle()
        onClick?.(e)
      }}
      className={twMerge('cursor-pointer select-none', className)}
      data-panel-trigger
    >
      {children}
    </button>
  )
}

export const PanelContent = React.forwardRef<HTMLDivElement, PanelContentProps>(
  function PanelContent({ children, className, ...props }, ref) {
    const { open, orientation } = usePanel()
    const horizontal = orientation === 'horizontal'

    return (
      <div
        {...props}
        ref={ref}
        aria-hidden={!open}
        inert={open ? undefined : true}
        className={twMerge(
          'grid overflow-hidden duration-200 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
          horizontal
            ? 'transition-[grid-template-columns]'
            : 'transition-[grid-template-rows]',
          horizontal
            ? open
              ? 'grid-cols-[1fr]'
              : 'grid-cols-[0fr]'
            : open
              ? 'grid-rows-[1fr]'
              : 'grid-rows-[0fr]',
          className,
        )}
      >
        <div
          className={twMerge(
            'overflow-hidden',
            horizontal ? 'min-w-0' : 'min-h-0',
          )}
        >
          {children}
        </div>
      </div>
    )
  },
)
