import * as React from 'react'
import { twMerge } from 'tailwind-merge'

/* --------------------------------------------------- Shared segment styling --

   The "secondary" segmented look, shared by `SegmentedControl` (single-select
   toggle) and the `Tabs` triggers below so the two stay visually locked. Flat,
   equal-size chips in a subtle track: resting is transparent, hover is the warm
   `action-secondary` fill (cream in light / dark-gray in dark — token-driven so
   it also tracks the `.ds-mode-*` showcase overrides), selected is a filled
   squircle chip in the inverse color. No raised/overhang treatment. */

export type SegmentSize = 'sm' | 'md' | 'lg'

const segmentBase =
  'relative inline-flex items-center justify-center corner-squircle font-medium ' +
  'transition-colors duration-150 ease-out cursor-pointer select-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

// Heights map to the Figma spec: sm 32 / md 40 / lg 52. Icon-only segments end
// up near-square from the horizontal padding. The chip radius is the "internal"
// corner (12 / 14 / 18px), nested 2px inside the track's "external" corner.
const segmentSizeStyles: Record<SegmentSize, string> = {
  sm: 'h-8 gap-1.5 px-2.5 text-sm [&_svg]:size-4 rounded-[12px]',
  md: 'h-10 gap-2 px-3 text-sm [&_svg]:size-4 rounded-[14px]',
  lg: 'h-13 gap-2 px-4 text-base [&_svg]:size-5 rounded-[18px]',
}

export function segmentClasses(
  size: SegmentSize,
  selected: boolean,
  className?: string,
) {
  return twMerge(
    segmentBase,
    segmentSizeStyles[size],
    selected
      ? 'bg-background-inverse text-text-inverse'
      : 'text-text-secondary hover:bg-action-secondary hover:text-text-primary',
    className,
  )
}

// The track's "external" corner radius per size (14 / 16 / 20px) — 2px larger
// than the chip so the nested corners stay concentric.
const segmentTrackRadius: Record<SegmentSize, string> = {
  sm: 'rounded-[14px]',
  md: 'rounded-[16px]',
  lg: 'rounded-[20px]',
}

/** The rounded track that wraps a row of segments, sized to match its chips. */
export function segmentTrackClasses(size: SegmentSize) {
  return `inline-flex items-center gap-0.5 corner-squircle border border-border-subtle bg-background-subtle p-0.5 ${segmentTrackRadius[size]}`
}

/* ----------------------------------------------------------- Primary tabs --

   The "primary" style is the underline tab used across the docs (framework /
   code tabs): a row on a baseline border, with a colored underline under the
   active tab. Heavier and more structural than the segmented "secondary" style. */

// `overflow-x-auto` lets a long tab row scroll horizontally; `overflow-y-hidden`
// is required alongside it — otherwise the browser computes overflow-y as `auto`
// too and the triggers' `-mb-px` (overlapping the baseline) trips a phantom
// vertical scrollbar.
const primaryListClasses =
  'flex items-center gap-1 overflow-x-auto overflow-y-hidden border-b border-border-default'

const primaryTriggerBase =
  'relative -mb-px inline-flex shrink-0 items-center justify-center border-b-2 font-semibold ' +
  'transition-colors duration-150 ease-out cursor-pointer select-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:rounded-sm ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const primaryTriggerSize: Record<SegmentSize, string> = {
  sm: 'gap-1.5 px-2.5 py-1.5 text-sm [&_svg]:size-4',
  md: 'gap-2 px-3 py-2 text-sm [&_svg]:size-4',
  lg: 'gap-2 px-3.5 py-2.5 text-base [&_svg]:size-5',
}

export function primaryTriggerClasses(
  size: SegmentSize,
  selected: boolean,
  className?: string,
) {
  return twMerge(
    primaryTriggerBase,
    primaryTriggerSize[size],
    selected
      ? 'border-text-primary text-text-primary'
      : 'border-transparent text-text-secondary hover:text-text-primary',
    className,
  )
}

/* --------------------------------------------------------------------- Tabs --

   Two styles, one API:
   - `variant="primary"` — the prominent underline tabs the docs use to switch a
     page's main content (framework / code tabs).
   - `variant="secondary"` (default) — the compact segmented track for switching
     context inside page content.

   Compound + context API (mirrors the Dropdown wrappers), hand-rolled for full
   tab semantics — `role="tablist/tab/tabpanel"`, `aria-selected`, roving
   tabindex and Arrow/Home/End keyboard navigation. Controlled
   (`value`/`onValueChange`) or uncontrolled (`defaultValue`). */

type TabsVariant = 'primary' | 'secondary'

type TabsContextValue = {
  value: string
  setValue: (value: string) => void
  idBase: string
  variant: TabsVariant
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

// Size flows from TabsList to its triggers without threading a prop through JSX.
const SegmentSizeContext = React.createContext<SegmentSize>('md')

function useTabsContext(component: string) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) {
    throw new Error(`<${component}> must be used within <Tabs>`)
  }
  return ctx
}

export function Tabs({
  value: controlledValue,
  defaultValue,
  onValueChange,
  variant = 'secondary',
  className,
  children,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** `primary` = underline; `secondary` = segmented (default). */
  variant?: TabsVariant
  className?: string
  children: React.ReactNode
}) {
  const isControlled = controlledValue !== undefined
  const idBase = React.useId()
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? '')
  const value = controlledValue ?? internalValue

  const setValue = React.useCallback(
    (next: string) => {
      if (!isControlled) setInternalValue(next)
      onValueChange?.(next)
    },
    [isControlled, onValueChange],
  )

  const ctx = React.useMemo<TabsContextValue>(
    () => ({ value, setValue, idBase, variant }),
    [value, setValue, idBase, variant],
  )

  return (
    <TabsContext.Provider value={ctx}>
      <div className={twMerge('flex flex-col', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({
  'aria-label': ariaLabel,
  size = 'md',
  className,
  children,
}: {
  'aria-label': string
  size?: SegmentSize
  className?: string
  children: React.ReactNode
}) {
  const { variant } = useTabsContext('TabsList')
  // Automatic activation: focus follows arrow keys and selects as it moves,
  // the expected behavior for a horizontal tablist. Reuses each trigger's own
  // click handler so selection stays in one place.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
    if (!keys.includes(event.key)) return
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]:not(:disabled)',
      ),
    )
    if (tabs.length === 0) return
    const current = tabs.indexOf(document.activeElement as HTMLButtonElement)
    let next = current
    if (event.key === 'ArrowRight')
      next = current < 0 ? 0 : (current + 1) % tabs.length
    else if (event.key === 'ArrowLeft')
      next = current < 0 ? tabs.length - 1 : (current - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    event.preventDefault()
    const target = tabs[next]
    target.focus()
    target.click()
  }

  return (
    <SegmentSizeContext.Provider value={size}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className={
          variant === 'primary'
            ? twMerge(primaryListClasses, className)
            : twMerge(segmentTrackClasses(size), 'self-start', className)
        }
      >
        {children}
      </div>
    </SegmentSizeContext.Provider>
  )
}

export function TabsTrigger({
  value,
  icon,
  disabled,
  className,
  children,
}: {
  value: string
  /** Optional leading icon node (sized by the segment). */
  icon?: React.ReactNode
  disabled?: boolean
  className?: string
  children: React.ReactNode
}) {
  const { value: active, setValue, idBase, variant } =
    useTabsContext('TabsTrigger')
  const size = React.useContext(SegmentSizeContext)
  const selected = active === value

  return (
    <button
      type="button"
      role="tab"
      id={`${idBase}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${idBase}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={() => setValue(value)}
      className={
        variant === 'primary'
          ? primaryTriggerClasses(size, selected, className)
          : segmentClasses(size, selected, className)
      }
    >
      {icon}
      {children}
    </button>
  )
}

export function TabsPanel({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: React.ReactNode
}) {
  const { value: active, idBase } = useTabsContext('TabsPanel')
  const selected = active === value

  return (
    <div
      role="tabpanel"
      id={`${idBase}-panel-${value}`}
      aria-labelledby={`${idBase}-tab-${value}`}
      hidden={!selected}
      tabIndex={0}
      className={twMerge(
        'mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        className,
      )}
    >
      {selected ? children : null}
    </div>
  )
}
