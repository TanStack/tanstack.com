import * as React from 'react'
import { MarkdownHeading } from '~/utils/markdown/processor'

const MarkdownHeadingContext = React.createContext<{
  headings: MarkdownHeading[]
  setHeadings(headings: MarkdownHeading[]): void
}>({
  headings: [],
  setHeadings: () => undefined,
})

export function MarkdownHeadingProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [headings, setHeadings] = React.useState<MarkdownHeading[]>([])

  const value = React.useMemo(() => ({ headings, setHeadings }), [headings])

  return (
    <MarkdownHeadingContext.Provider value={value}>
      {children}
    </MarkdownHeadingContext.Provider>
  )
}

export function useMarkdownHeadings() {
  return React.useContext(MarkdownHeadingContext)
}
