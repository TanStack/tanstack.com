import * as React from 'react'
import { twMerge } from 'tailwind-merge'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isSelected?: boolean
  isUnavailable?: boolean
}

/**
 * Variant selector chip — used for non-size options like color or material.
 * Size-specific grid cells use <ShopSize> for the tighter square treatment.
 */
export const ShopChip = React.forwardRef<HTMLButtonElement, Props>(
  function ShopChip(
    { isSelected, isUnavailable, children, className, disabled, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={isSelected}
        disabled={disabled ?? isUnavailable}
        {...rest}
        className={twMerge(
          'inline-flex items-center gap-[7px] px-3 py-1.5 rounded-md border text-[12px]',
          'font-sans transition-[border-color,background-color]',
          'bg-shop-panel text-shop-text border-shop-line',
          'hover:enabled:border-shop-line-2',
          isSelected &&
            'border-shop-accent bg-shop-accent/10 hover:enabled:border-shop-accent',
          isUnavailable &&
            !isSelected &&
            'line-through text-shop-muted opacity-60 cursor-not-allowed',
          className,
        )}
      >
        {children}
      </button>
    )
  },
)
