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
        'w-full max-w-full p-2 md:p-4 2xl:p-8',
        props.className
      )}
    >
      {children}
    </div>
  )
}
