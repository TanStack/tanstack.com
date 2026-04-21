import * as React from 'react'
import { twMerge } from 'tailwind-merge'

type Variant = 'primary' | 'outline' | 'ghost'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  fullWidth?: boolean
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold font-sans transition-[filter,border-color,background-color,color] disabled:opacity-50 disabled:cursor-not-allowed'

const variants: Record<Variant, string> = {
  primary:
    'bg-shop-accent text-shop-accent-ink px-4 py-2.5 text-[13px] hover:enabled:brightness-110',
  outline:
    'border border-shop-line bg-shop-panel text-shop-text px-3.5 py-2 text-[12.5px] hover:enabled:border-shop-line-2',
  ghost:
    'text-shop-text-2 hover:enabled:text-shop-text hover:enabled:bg-shop-panel px-2 py-1.5 text-[12.5px]',
}

/** Shop button. Three visual weights — primary, outline, ghost. */
export const ShopButton = React.forwardRef<HTMLButtonElement, Props>(
  function ShopButton(
    { variant = 'outline', fullWidth, className, children, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        {...rest}
        className={twMerge(
          base,
          variants[variant],
          fullWidth && 'w-full',
          className,
        )}
      >
        {children}
      </button>
    )
  },
)
