import { HTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'

export function DocContainer({
  children,
  ...props
}: { children: React.ReactNode } & HTMLProps<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={twMerge(
        'max-w-full space-y-2 md:space-y-6 lg:space-y-8 p-2 md:p-6 lg:p-8',
        props.className
      )}
    >
      {children}
    </div>
  )
}
