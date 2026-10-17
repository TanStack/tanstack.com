import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { currentUserQueryOptions } from '~/hooks/useCurrentUser'
import { getCurrentUser } from '~/utils/auth.functions'
import { authClient } from '~/auth/client'
import { createOAuthPopupAttempt } from '~/auth/oauth-popup-attempt'
import type { OAuthProvider } from '~/auth/types'

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
  const popupAttempt = React.useRef<ReturnType<
    typeof createOAuthPopupAttempt
  > | null>(null)
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
      popupAttempt.current?.dispose()
      popupAttempt.current = null
      pendingOnSuccessRef.current = undefined
      setDescription(undefined)
    }
  }, [])

  const closeLoginModal = React.useCallback(
    () => handleOpenChange(false),
    [handleOpenChange],
  )

  React.useEffect(
    () => () => {
      popupAttempt.current?.dispose()
    },
    [],
  )

  const openSocialPopup = React.useCallback(
    (provider: OAuthProvider) => {
      popupAttempt.current?.dispose()
      const attempt = createOAuthPopupAttempt({
        verifySession: async () => {
          const user = await getCurrentUser()
          if (!user || popupAttempt.current !== attempt) return false
          queryClient.setQueryData(currentUserQueryOptions.queryKey, user)
          return true
        },
        onSuccess: () => {
          const onSuccess = pendingOnSuccessRef.current
          popupAttempt.current = null
          handleOpenChange(false)
          if (onSuccess) setTimeout(onSuccess, 0)
        },
      })
      popupAttempt.current = attempt
      const popup = authClient.signIn.socialPopup({
        provider,
        popupChannel: attempt.channelId,
      })
      if (!popup) {
        attempt.dispose()
        popupAttempt.current = null
        authClient.signIn.social({ provider })
      }
    },
    [queryClient, handleOpenChange],
  )

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
            onSocialSignIn={openSocialPopup}
          />
        </React.Suspense>
      ) : null}
    </LoginModalContext.Provider>
  )
}
