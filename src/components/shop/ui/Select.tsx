import * as React from 'react'
import { twMerge } from 'tailwind-merge'

type Props = React.SelectHTMLAttributes<HTMLSelectElement>

/** Styled native <select> with a carved-in chevron. */
export const ShopSelect = React.forwardRef<HTMLSelectElement, Props>(
  function ShopSelect({ className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        {...rest}
        className={twMerge(
          'appearance-none border border-shop-line-2 rounded-xl',
          'py-2.5 pl-4 pr-8 bg-transparent text-shop-text-2 font-shop-mono text-shop-ui',
          'bg-no-repeat bg-[right_12px_center]',
          // inline SVG chevron, colored with the muted text token
          "bg-[url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path d='M2 4l3 3 3-3' stroke='%23a8a8b0' fill='none' stroke-width='1.4'/></svg>\")]",
          'cursor-pointer transition-colors hover:border-shop-muted hover:text-shop-text',
          className,
        )}
      >
        {children}
      </select>
    )
  },
)
