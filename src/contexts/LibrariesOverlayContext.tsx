import * as React from 'react'
import { useLocation } from '@tanstack/react-router'
import { LibrariesOverlay } from '~/components/LibrariesOverlay'

interface LibrariesOverlayContextValue {
  openLibraries: () => void
  closeLibraries: () => void
}

declare global {
  var __tanstackLibrariesOverlayContext:
    | React.Context<LibrariesOverlayContextValue | null>
    | undefined
}

const LibrariesOverlayContext =
  import.meta.env.DEV && typeof window !== 'undefined'
    ? (globalThis.__tanstackLibrariesOverlayContext ??=
        React.createContext<LibrariesOverlayContextValue | null>(null))
    : React.createContext<LibrariesOverlayContextValue | null>(null)

export function useLibrariesOverlay() {
  const context = React.useContext(LibrariesOverlayContext)
  if (!context) {
    throw new Error(
      'useLibrariesOverlay must be used within a LibrariesOverlayProvider',
    )
  }
  return context
}

export function LibrariesOverlayProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = React.useState(false)

  const openLibraries = React.useCallback(() => setIsOpen(true), [])
  const closeLibraries = React.useCallback(() => setIsOpen(false), [])

  // Any navigation (e.g. clicking a library card) closes the overlay so it
  // never lingers over the destination page.
  const pathname = useLocation({ select: (location) => location.pathname })
  React.useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  const value = React.useMemo(
    () => ({ openLibraries, closeLibraries }),
    [openLibraries, closeLibraries],
  )

  return (
    <LibrariesOverlayContext.Provider value={value}>
      {children}
      <LibrariesOverlay open={isOpen} onClose={closeLibraries} />
    </LibrariesOverlayContext.Provider>
  )
}
