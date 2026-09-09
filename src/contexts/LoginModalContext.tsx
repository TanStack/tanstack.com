import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { currentUserQueryOptions } from '~/hooks/useCurrentUser'

const LazyLoginModal = React.lazy(() =>
  import('~/components/LoginModal').then((m) => ({ default: m.LoginModal })),
)

interface LoginModalContextValue {
  openLoginModal: (options?: {
    description?: string
    onSuccess?: () => void
  }) => void
  closeLoginModal: () => void
}

declare global {
  var __tanstackLoginModalContext:
    | React.Context<LoginModalContextValue | null>
    | undefined
}

const LoginModalContext =
  import.meta.env.DEV && typeof window !== 'undefined'
    ? (globalThis.__tanstackLoginModalContext ??=
        React.createContext<LoginModalContextValue | null>(null))
    : React.createContext<LoginModalContextValue | null>(null)

export function useLoginModal() {
  const context = React.useContext(LoginModalContext)
  if (!context) {
    throw new Error('useLoginModal must be used within a LoginModalProvider')
  }
  return context
}

interface LoginModalProviderProps {
  children: React.ReactNode
}

export function LoginModalProvider({ children }: LoginModalProviderProps) {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = React.useState(false)
  const [hasLoadedModal, setHasLoadedModal] = React.useState(false)
  const [description, setDescription] = React.useState<string>()
  const pendingOnSuccessRef = React.useRef<(() => void) | undefined>(undefined)

  const openLoginModal = React.useCallback(
    (options?: { description?: string; onSuccess?: () => void }) => {
      pendingOnSuccessRef.current = options?.onSuccess
      setDescription(options?.description)
      setHasLoadedModal(true)
      setIsOpen(true)
    },
    [],
  )

  const handleOpenChange = React.useCallback((open: boolean) => {
    setIsOpen(open)
    if (!open) {
      pendingOnSuccessRef.current = undefined
      setDescription(undefined)
    }
  }, [])

  const closeLoginModal = React.useCallback(
    () => handleOpenChange(false),
    [handleOpenChange],
  )

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'TANSTACK_AUTH_SUCCESS') {
        queryClient.invalidateQueries(currentUserQueryOptions)
        const onSuccess = pendingOnSuccessRef.current
        setIsOpen(false)
        setDescription(undefined)
        pendingOnSuccessRef.current = undefined
        if (onSuccess) {
          setTimeout(onSuccess, 0)
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [queryClient])

  const value = React.useMemo(
    () => ({ openLoginModal, closeLoginModal }),
    [openLoginModal, closeLoginModal],
  )

  return (
    <LoginModalContext.Provider value={value}>
      {children}
      {hasLoadedModal ? (
        <React.Suspense fallback={null}>
          <LazyLoginModal
            open={isOpen}
            description={description}
            onOpenChange={handleOpenChange}
          />
        </React.Suspense>
      ) : null}
    </LoginModalContext.Provider>
  )
}
