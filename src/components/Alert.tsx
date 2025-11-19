import * as React from 'react'
import type { HTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'

const VARIANT_TO_ICON: Record<string, string> = {
  note: 'M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm0 14.5a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13ZM7.25 7a.75.75 0 0 0-.75.75v2.75H6.25a.75.75 0 0 0 0 1.5h2a.75.75 0 0 0 0-1.5H8v-2h.25a.75.75 0 0 0 0-1.5h-2ZM8 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  tip: 'M2.273 8.652c-.803-1.658.123-3.428 1.783-4.23 1.201-.581 2.759-.3 3.944.916 1.185 1.216 1.446 3.997-.563 5.235-.384.233-.523.812-.523.812l-.645.645h-1.12l-.645-.645s-.175-.616-.481-.832c-.526-.376-1.604-1.344-2.35-2.9Zm3.227-.367a.5.5 0 0 1 .5-.5H7a.5.5 0 0 1 0 1h-.75v1.25a.5.5 0 0 1-1 0v-1.75Zm.5-2a.5.5 0 0 1 0 1 .5.5 0 0 1 0-1Zm-.5 6.75h2.5a.5.5 0 0 1 0 1h-2.5a.5.5 0 0 1 0-1Z',
  warning:
    'M7.022 1.566c.39-.717 1.566-.717 1.956 0l6.857 12.6c.375.689-.122 1.534-.978 1.534H1.143c-.856 0-1.353-.845-.978-1.535L7.022 1.566ZM8.5 4h-1v6h1V4ZM8 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z',
  caution:
    'M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm0 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM6.5 6.75A.75.75 0 0 1 7.25 6h1.5a.75.75 0 0 1 .75.75v4.5h.25a.75.75 0 0 1 0 1.5h-3a.75.75 0 0 1 0-1.5h.25v-3h-.25a.75.75 0 0 1-.75-.75Zm1.5-2.25a1 1 0 1 1 2 0 1 1 0 0 1-2 0Z',
  important:
    'M7.022 1.566c.39-.717 1.566-.717 1.956 0l6.857 12.6c.375.689-.122 1.534-.978 1.534H1.143c-.856 0-1.353-.845-.978-1.535L7.022 1.566ZM8 5a.9.9 0 0 1 .9.9v3.6a.9.9 0 0 1-1.8 0V5.9A.9.9 0 0 1 8 5Zm0 6a1.1 1.1 0 1 1 0 2.2A1.1 1.1 0 0 1 8 11Z',
}

const VARIANT_TO_LABEL: Record<string, string> = {
  note: 'Note',
  tip: 'Tip',
  warning: 'Warning',
  caution: 'Caution',
  important: 'Important',
}

export type AlertProps = {
  variant?: keyof typeof VARIANT_TO_ICON
} & HTMLProps<HTMLDivElement>

export function Alert({
                        variant = 'note',
                        children,
                        className,
                        ...rest
                      }: AlertProps) {
  const iconPath = VARIANT_TO_ICON[variant] ?? VARIANT_TO_ICON.note
  const label = VARIANT_TO_LABEL[variant] ?? VARIANT_TO_LABEL.note

  return (
    <div
      {...rest}
      className={twMerge(
        `markdown-alert markdown-alert-${variant}`,
        className
      )}
    >
      <div className="markdown-alert-title">
        <svg
          className="octicon octicon-info mr-2"
          viewBox="0 0 16 16"
          width="16"
          height="16"
          aria-hidden="true"
        >
          <path d={iconPath} />
        </svg>
        <span>
          {label}
        </span>
      </div>
      {children}
    </div>
  )
}
