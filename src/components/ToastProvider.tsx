import { Toast } from '@base-ui/react/toast'
import * as React from 'react'
import styles from './ToastProvider.module.css'

type ToastOptions = {
  id?: string
}

type ToastContextValue = {
  notify: (content: React.ReactNode, options?: ToastOptions) => string
}

type ToastProviderProps = {
  children: React.ReactNode
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}

export function ToastProvider({ children }: ToastProviderProps) {
  return (
    <Toast.Provider timeout={2500}>
      <ToastNotifications>{children}</ToastNotifications>
    </Toast.Provider>
  )
}

function ToastNotifications({ children }: ToastProviderProps) {
  const { add, toasts } = Toast.useToastManager()

  const notify = React.useCallback(
    (content: React.ReactNode, { id }: ToastOptions = {}) =>
      add({
        title: content,
        id,
      }),
    [add],
  )

  const contextValue = React.useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className={styles.viewport}>
          {toasts.map((toast) => (
            <Toast.Root
              key={toast.id}
              toast={toast}
              swipeDirection="right"
              className={`${styles.toast} rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50`}
            >
              <Toast.Content className={styles.content}>
                <Toast.Title className="flex items-start gap-2" />
              </Toast.Content>
            </Toast.Root>
          ))}
        </Toast.Viewport>
      </Toast.Portal>
    </ToastContext.Provider>
  )
}
