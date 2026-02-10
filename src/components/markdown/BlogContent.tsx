// Server component for blog markdown content
// This file does NOT have 'use client' - it's a server component.
// The children are JSX elements produced by renderMarkdownToJsx on the server,
// which already include client component references for interactive elements.

import type { ReactNode } from 'react'

type BlogContentProps = {
  children: ReactNode
}

export function BlogContent({ children }: BlogContentProps) {
  return (
    <div className="prose prose-gray dark:prose-invert max-w-none [font-size:16px] styled-markdown-content">
      {children}
    </div>
  )
}
