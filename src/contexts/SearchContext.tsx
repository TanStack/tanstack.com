'use client'

import * as React from 'react'

const LazySearchModal = React.lazy(() =>
  import('~/components/SearchModal').then((m) => ({ default: m.SearchModal })),
)

interface SearchContextType {
  isOpen: boolean
  newChatRequestId: number
  openSearch: () => void
  closeSearch: () => void
}

const SearchContext = React.createContext<SearchContextType | undefined>(
  undefined,
)

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [hasOpenedSearch, setHasOpenedSearch] = React.useState(false)
  const [newChatRequestId, setNewChatRequestId] = React.useState(0)

  const openSearch = React.useCallback(() => {
    setHasOpenedSearch(true)
    setIsOpen(true)
  }, [])

  const closeSearch = React.useCallback(() => {
    setIsOpen(false)
  }, [])

  const requestNewChat = React.useCallback(() => {
    setNewChatRequestId((current) => current + 1)
  }, [])

  const value = React.useMemo(
    () => ({
      isOpen,
      newChatRequestId,
      openSearch,
      closeSearch,
    }),
    [closeSearch, isOpen, newChatRequestId, openSearch],
  )

  React.useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return

      const trigger = event.target.closest('[data-search-trigger]')
      if (!trigger) return
      if (trigger instanceof HTMLButtonElement && trigger.disabled) return

      event.preventDefault()
      openSearch()
    }

    document.addEventListener('click', handleDocumentClick)
    return () => {
      document.removeEventListener('click', handleDocumentClick)
    }
  }, [openSearch])

  React.useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.altKey || event.shiftKey) return
      // Match both `key` and `code` so the shortcut works on non-QWERTY layouts.
      const isK = event.key.toLowerCase() === 'k' || event.code === 'KeyK'
      if (!isK) return

      event.preventDefault()
      event.stopPropagation()

      if (isOpen) {
        requestNewChat()
        return
      }

      openSearch()
    }

    document.addEventListener('keydown', handleGlobalKeyDown, { capture: true })
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown, {
        capture: true,
      })
    }
  }, [isOpen, openSearch, requestNewChat])

  return (
    <SearchContext.Provider value={value}>
      {children}
      {hasOpenedSearch ? (
        <React.Suspense fallback={null}>
          <LazySearchModal />
        </React.Suspense>
      ) : null}
    </SearchContext.Provider>
  )
}

export function useSearchContext() {
  const context = React.useContext(SearchContext)
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider')
  }
  return context
}
