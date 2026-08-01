import * as React from 'react'
import { useLocation } from '@tanstack/react-router'
import { LibrariesOverlay } from '~/components/LibrariesOverlay'

interface LibrariesOverlayContextValue {
  openLibraries: (options?: { onBack?: () => void }) => void
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
  const [returnTarget, setReturnTarget] = React.useState<{
    onBack: () => void
  } | null>(null)

  const openLibraries = React.useCallback(
    (options?: { onBack?: () => void }) => {
      setReturnTarget(options?.onBack ? { onBack: options.onBack } : null)
      setIsOpen(true)
    },
    [],
  )
  const closeLibraries = React.useCallback(() => {
    setIsOpen(false)
    setReturnTarget(null)
  }, [])

  const returnToMenu = React.useCallback(() => {
    const onBack = returnTarget?.onBack
    setIsOpen(false)
    setReturnTarget(null)
    onBack?.()
  }, [returnTarget])

  // Any navigation (e.g. clicking a library card) closes the overlay so it
  // never lingers over the destination page.
  const pathname = useLocation({ select: (location) => location.pathname })
  React.useEffect(() => {
    setIsOpen(false)
    setReturnTarget(null)
  }, [pathname])

  const value = React.useMemo(
    () => ({ openLibraries, closeLibraries }),
    [openLibraries, closeLibraries],
  )

  return (
    <LibrariesOverlayContext.Provider value={value}>
      {children}
      <LibrariesOverlay
        open={isOpen}
        onBack={returnTarget ? returnToMenu : undefined}
        onClose={closeLibraries}
      />
    </LibrariesOverlayContext.Provider>
  )
}
