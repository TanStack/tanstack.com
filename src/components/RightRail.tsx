import * as React from 'react'
import { twMerge } from 'tailwind-merge'

type RightRailProps = {
  children: React.ReactNode
  className?: string
  breakpoint?: 'sm' | 'md'
  stickyOffset?: 'navbar' | 'docs-tabs'
}

export function RightRail({
  children,
  className,
  breakpoint = 'sm',
  stickyOffset = 'navbar',
}: RightRailProps) {
  const stickyTopClass =
    stickyOffset === 'docs-tabs'
      ? breakpoint === 'md'
        ? 'md:top-[calc(var(--navbar-height)+var(--docs-tabs-height,0px))]'
        : 'sm:top-[calc(var(--navbar-height)+var(--docs-tabs-height,0px))]'
      : breakpoint === 'md'
        ? 'md:top-[var(--navbar-height)]'
        : 'sm:top-[var(--navbar-height)]'
  const stickyMaxHeightClass =
    stickyOffset === 'docs-tabs'
      ? breakpoint === 'md'
        ? 'md:max-h-[calc(100dvh-var(--navbar-height)-var(--docs-tabs-height,0px))]'
        : 'sm:max-h-[calc(100dvh-var(--navbar-height)-var(--docs-tabs-height,0px))]'
      : breakpoint === 'md'
        ? 'md:max-h-[calc(100dvh-var(--navbar-height))]'
        : 'sm:max-h-[calc(100dvh-var(--navbar-height))]'
  const wrapperBreakpointClass =
    breakpoint === 'md'
      ? 'w-full md:w-[300px] shrink-0 md:sticky hidden md:block'
      : 'w-full sm:w-[300px] shrink-0 sm:sticky hidden sm:block'

  const innerBreakpointClass = breakpoint === 'md' ? 'md:sticky' : 'sm:sticky'

  return (
    <div className={twMerge(wrapperBreakpointClass, stickyTopClass, className)}>
      <div
        className={twMerge(
          innerBreakpointClass,
          stickyTopClass,
          stickyMaxHeightClass,
          'fade-y fade-size-y-sm ml-auto flex max-w-full flex-col gap-4 overflow-y-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0',
        )}
      >
        {children}
      </div>
    </div>
  )
}
