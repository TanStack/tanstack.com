import * as React from 'react'
import { twMerge } from 'tailwind-merge'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isSelected?: boolean
  isUnavailable?: boolean
}

/** Size cell used in the variant selector grid. Mono, short, tappable. */
export const ShopSize = React.forwardRef<HTMLButtonElement, Props>(
  function ShopSize(
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
          'px-0 py-2.5 border rounded-md text-center',
          'font-shop-mono font-medium text-[12px]',
          'bg-shop-panel text-shop-text border-shop-line',
          'hover:enabled:border-shop-line-2',
          isSelected &&
            'bg-shop-accent text-shop-accent-ink border-shop-accent',
          isUnavailable &&
            !isSelected &&
            'line-through text-shop-muted bg-transparent opacity-55 cursor-not-allowed',
          className,
        )}
      >
        {children}
      </button>
    )
  },
)
