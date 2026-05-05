import * as React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isActive?: boolean
  count?: number
}

/** Filter tab used in the shop landing header. Pill-shaped, DM Mono, border-only active state. */
export const ShopTab = React.forwardRef<HTMLButtonElement, Props>(
  function ShopTab(
    { isActive, count: _count, children, className, ...rest },
    ref,
  ) {
    const base =
      'inline-flex items-center px-4 py-2.5 rounded-xl font-shop-mono text-shop-ui transition-colors cursor-pointer'
    const state = isActive
      ? 'border-2 border-shop-muted font-medium text-shop-text'
      : 'border border-shop-line-2 font-normal text-shop-text-2 hover:text-shop-text hover:border-shop-muted'

    return (
      <button
        ref={ref}
        type="button"
        {...rest}
        className={`${base} ${state}${className ? ` ${className}` : ''}`}
      >
        {children}
      </button>
    )
  },
)
