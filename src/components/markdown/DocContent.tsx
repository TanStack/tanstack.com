// Server component for doc markdown content
// This file does NOT have 'use client' - it's a server component.
// The children are JSX elements produced by renderMarkdownToJsx on the server,
// which already include client component references for interactive elements.

import type { ReactNode } from 'react'

type DocContentProps = {
  children: ReactNode
}

export function DocContent({ children }: DocContentProps) {
  return <>{children}</>
}
