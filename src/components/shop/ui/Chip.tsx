import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { shopColorContrast } from '~/utils/shop-color'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isSelected?: boolean
  isUnavailable?: boolean
  /** Legacy: hex background only for the selected state. */
  selectedBg?: string
  /** Forced text color when using selectedBg — auto-derived from selectedBg if omitted. */
  selectedTextColor?: string
}

export const ShopChip = React.forwardRef<HTMLButtonElement, Props>(
  function ShopChip(
    {
      isSelected,
      isUnavailable,
      children,
      className,
      disabled,
      selectedBg,
      selectedTextColor,
      style,
      ...rest
    },
    ref,
  ) {
    const chipStyle: React.CSSProperties =
      isSelected && selectedBg
        ? {
            backgroundColor: selectedBg,
            borderColor: selectedBg,
            color: selectedTextColor ?? shopColorContrast(selectedBg),
          }
        : {}

    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={isSelected}
        disabled={disabled ?? isUnavailable}
        {...rest}
        style={{ ...style, ...chipStyle }}
        className={twMerge(
          'inline-flex items-center gap-[7px] px-3 py-1.5 rounded-md border text-shop-sm',
          'font-shop-display transition-[border-color,background-color,color]',
          !selectedBg && 'bg-shop-surface text-shop-text border-shop-line',
          !selectedBg &&
            'hover:enabled:bg-shop-surface-hover hover:enabled:border-shop-line-2',
          isSelected &&
            !selectedBg &&
            'bg-shop-panel-2 border-shop-accent text-shop-text hover:enabled:border-shop-accent',
          isUnavailable &&
            !isSelected &&
            'line-through text-shop-muted opacity-40 cursor-not-allowed',
          className,
        )}
      >
        {children}
      </button>
    )
  },
)
