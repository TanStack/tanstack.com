import * as React from 'react'
import { twMerge } from 'tailwind-merge'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isActive?: boolean
  count?: number
}

/** Filter tab used in the shop landing header. Pill with optional count. */
export const ShopTab = React.forwardRef<HTMLButtonElement, Props>(
  function ShopTab({ isActive, count, children, className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        {...rest}
        className={twMerge(
          'inline-flex items-center gap-[7px] px-3 py-1.5 rounded-md border text-[12.5px]',
          'transition-colors',
          isActive
            ? 'bg-shop-panel text-shop-text border-shop-line-2'
            : 'bg-transparent text-shop-text-2 border-shop-line hover:text-shop-text hover:border-shop-line-2',
          className,
        )}
      >
        {children}
        {count != null ? (
          <span
            className={twMerge(
              'font-shop-mono text-[10.5px]',
              isActive ? 'text-shop-text-2' : 'text-shop-muted',
            )}
          >
            {count}
          </span>
        ) : null}
      </button>
    )
  },
)
