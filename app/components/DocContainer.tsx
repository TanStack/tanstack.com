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
        'w-full max-w-full p-2 md:p-6 lg:p-8',
        props.className
      )}
    >
      {children}
    </div>
  )
}
