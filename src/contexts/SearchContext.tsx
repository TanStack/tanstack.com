import * as React from 'react'

interface SearchContextType {
  isOpen: boolean
  openSearch: () => void
  closeSearch: () => void
}

const SearchContext = React.createContext<SearchContextType | undefined>(
  undefined
)

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false)

  const value = React.useMemo(
    () => ({
      isOpen,
      openSearch: () => setIsOpen(true),
      closeSearch: () => setIsOpen(false),
    }),
    [isOpen]
  )

  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  )
}

export function useSearchContext() {
  const context = React.useContext(SearchContext)
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider')
  }
  return context
}
