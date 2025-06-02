import { HTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'

export function DocContainer({
  children,
  ...props
}: { children: React.ReactNode } & HTMLProps<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={twMerge('w-full max-w-full lg:pr-4', props.className)}
    >
      {children}
    </div>
  )
}
