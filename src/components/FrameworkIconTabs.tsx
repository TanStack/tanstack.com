import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import type { Framework } from '~/libraries'
import { getFrameworkOptions } from '~/libraries/frameworks'

type FrameworkIconTabsProps = {
  frameworks: Framework[]
  value: Framework
  onChange: (framework: Framework) => void
  className?: string
}

export function FrameworkIconTabs({
  frameworks,
  value,
  onChange,
  className,
}: FrameworkIconTabsProps) {
  const options = React.useMemo(
    () => getFrameworkOptions(frameworks),
    [frameworks],
  )

  // Not a real tablist: these buttons don't switch a tab panel, they swap the
  // StackBlitz embed via `onChange`. So this is a labeled group of toggle
  // buttons (`aria-pressed`) rather than tabs — each button is individually
  // Tab-focusable, no roving tabindex needed.
  return (
    <div
      role="group"
      aria-label="Choose framework"
      className={twMerge(
        'fade-x fade-size-x-sm flex items-center justify-start gap-1 overflow-x-auto overflow-y-hidden border-b border-border-default scrollbar-hide',
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          aria-pressed={value === opt.value}
          className={`relative -mb-px inline-flex shrink-0 items-center justify-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
            value === opt.value
              ? 'border-text-primary text-text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
          onClick={() => onChange(opt.value as Framework)}
          aria-label={opt.label}
          title={opt.label}
          type="button"
        >
          <img src={opt.logo} alt="" className="w-4 h-4" />
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  )
}
