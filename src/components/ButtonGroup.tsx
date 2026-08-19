import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import {
  segmentClasses,
  segmentTrackClasses,
  type SegmentSize,
} from '~/components/ds/ui/Tabs'

type ButtonGroupProps = React.ComponentProps<'div'>

/**
 * Low-level toolbar container: joins whatever buttons you drop in with shared
 * edges and a single outer border, restyling children via descendant selectors
 * so it's agnostic to which Button you use. Reach for this when the group is
 * heterogeneous — mixed toggles, a primary action, a dropdown trigger. For a
 * single-select segmented control, use `SegmentedControl` below instead.
 *
 * The `[&>[aria-pressed=true]]` selector paints the pressed/selected child, so
 * any button that sets `aria-pressed` gets the active treatment for free.
 */
export function ButtonGroup({
  children,
  className,
  ...props
}: ButtonGroupProps) {
  return (
    <div
      {...props}
      className={twMerge(
        'inline-flex items-stretch overflow-hidden rounded-md',
        'border border-border-default',
        '[&>*]:border-0! [&>*+*]:border-l! [&>*+*]:border-border-default!',
        'bg-background-surface text-text-primary',
        'shadow-sm',
        '[&>[aria-pressed=true]]:bg-text-primary [&>[aria-pressed=true]]:text-background-default [&>[aria-pressed=true]]:shadow-sm',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------- SegmentedControl -- */

type SegmentedControlOption<TValue extends string> = {
  value: TValue
  /** Visible label — accepts any node, so lead with an icon: `<><Icon/> Day</>`. */
  label: React.ReactNode
  /** Accessible name when the label is icon-only or needs disambiguation. */
  'aria-label'?: string
  disabled?: boolean
}

type SegmentedControlProps<TValue extends string> = {
  options: ReadonlyArray<SegmentedControlOption<TValue>>
  value: TValue
  onValueChange: (value: TValue) => void
  /** Labels the group for assistive tech (the control has no visible label). */
  'aria-label': string
  size?: SegmentSize
  /** Stretch to fill the container, splitting width evenly across options. */
  fullWidth?: boolean
  className?: string
}

/**
 * Declarative single-select segmented control. Give it `options` and a
 * controlled `value`; it manages selection, the `aria-pressed` state, and group
 * semantics. A flat, equal-size segmented track: unselected options are
 * transparent, hover fills with the warm `action-secondary`, and the selected
 * option is a filled squircle chip (`background-inverse`). Shares the segment
 * styling with `Tabs` so the two stay visually locked. For tabs that switch
 * page content (with panels + tab a11y), use `Tabs` instead.
 */
export function SegmentedControl<TValue extends string>({
  options,
  value,
  onValueChange,
  'aria-label': ariaLabel,
  size = 'md',
  fullWidth = false,
  className,
}: SegmentedControlProps<TValue>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={twMerge(
        segmentTrackClasses(size),
        fullWidth && 'flex w-full',
        className,
      )}
    >
      {options.map((option) => {
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            aria-label={option['aria-label']}
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            className={segmentClasses(
              size,
              selected,
              fullWidth ? 'flex-1' : undefined,
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
