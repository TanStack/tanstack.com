import * as React from 'react'
import * as Toast from '@radix-ui/react-toast'

type ToastOptions = {
  durationMs?: number
}

type ToastItem = {
  id: string
  content: React.ReactNode
  durationMs: number
}

type ToastContextValue = {
  notify: (content: React.ReactNode, options?: ToastOptions) => string
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}

export function ToastProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const notify = React.useCallback(
    (content: React.ReactNode, options?: ToastOptions) => {
      const id = Math.random().toString(36).slice(2)
      const durationMs = options?.durationMs ?? 2500
      setToasts((prev) => [...prev, { id, content, durationMs }])
      return id
    },
    []
  )

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const contextValue = React.useMemo<ToastContextValue>(
    () => ({ notify }),
    [notify]
  )

  return (
    <ToastContext.Provider value={contextValue}>
      <Toast.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <Toast.Root
            key={t.id}
            defaultOpen
            duration={t.durationMs}
            onOpenChange={(open) => {
              if (!open) removeToast(t.id)
            }}
            className="relative z-[60] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-lg outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50"
          >
            <div className="flex items-start gap-2">{t.content}</div>
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed bottom-4 right-4 z-[60] flex max-h-screen w-96 flex-col gap-2 p-0 outline-none" />
      </Toast.Provider>
    </ToastContext.Provider>
  )
}
