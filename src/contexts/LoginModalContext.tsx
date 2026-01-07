import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LoginModal } from '~/components/LoginModal'

interface LoginModalContextValue {
  openLoginModal: (options?: { onSuccess?: () => void }) => void
  closeLoginModal: () => void
}

const LoginModalContext = React.createContext<LoginModalContextValue | null>(
  null,
)

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
  const pendingOnSuccessRef = React.useRef<(() => void) | undefined>(undefined)

  const openLoginModal = React.useCallback(
    (options?: { onSuccess?: () => void }) => {
      pendingOnSuccessRef.current = options?.onSuccess
      setIsOpen(true)
    },
    [],
  )

  const closeLoginModal = React.useCallback(() => {
    setIsOpen(false)
    pendingOnSuccessRef.current = undefined
  }, [])

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'TANSTACK_AUTH_SUCCESS') {
        queryClient.invalidateQueries({ queryKey: ['currentUser'] })
        const onSuccess = pendingOnSuccessRef.current
        setIsOpen(false)
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
      <LoginModal open={isOpen} onOpenChange={setIsOpen} />
    </LoginModalContext.Provider>
  )
}
