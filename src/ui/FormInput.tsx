import * as React from 'react'
import { twMerge } from 'tailwind-merge'

type FormInputProps = React.InputHTMLAttributes<HTMLInputElement>

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  function FormInput({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={twMerge(
          'w-full px-3 py-2 border border-border-default rounded-lg bg-background-surface text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow',
          className,
        )}
        {...props}
      />
    )
  },
)
