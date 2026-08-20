import * as React from 'react'
import { twMerge } from 'tailwind-merge'

type CollapsibleRenderProps = {
  open: boolean
  orientation: 'horizontal' | 'vertical'
  toggle: () => void
}

type CollapsibleProps = {
  open?: boolean
  defaultOpen?: boolean
  orientation?: 'horizontal' | 'vertical'
  onOpenChange?: (open: boolean) => void
  children:
    | React.ReactNode
    | ((props: CollapsibleRenderProps) => React.ReactNode)
  className?: string
}

type CollapsibleTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode
}

type CollapsibleContentProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode
}

const CollapsibleContext = React.createContext<CollapsibleRenderProps | null>(
  null,
)

function useCollapsible() {
  const context = React.useContext(CollapsibleContext)
  if (!context) {
    throw new Error('Collapsible components must be used within a Collapsible')
  }
  return context
}

export function Collapsible({
  open: controlledOpen,
  defaultOpen = false,
  orientation = 'vertical',
  onOpenChange,
  children,
  className,
}: CollapsibleProps) {
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
    <CollapsibleContext.Provider value={value}>
      <div
        className={className}
        data-collapsible
        data-orientation={orientation}
      >
        {typeof children === 'function' ? children(value) : children}
      </div>
    </CollapsibleContext.Provider>
  )
}

export function CollapsibleTrigger({
  children,
  className,
  onClick,
  onMouseDown,
  type = 'button',
  ...props
}: CollapsibleTriggerProps) {
  const { open, toggle } = useCollapsible()

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
      data-collapsible-trigger
    >
      {children}
    </button>
  )
}

export const CollapsibleContent = React.forwardRef<
  HTMLDivElement,
  CollapsibleContentProps
>(function CollapsibleContent({ children, className, ...props }, ref) {
  const { open, orientation } = useCollapsible()
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
})
