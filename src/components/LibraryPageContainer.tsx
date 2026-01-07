import type { ReactNode } from 'react'

interface LibraryPageContainerProps {
  children: ReactNode
}

export function LibraryPageContainer({ children }: LibraryPageContainerProps) {
  return (
    <div className="flex flex-col gap-20 md:gap-32 max-w-full pt-32">
      {children}
    </div>
  )
}
