import { observeMobileViewport } from './mobile-viewport'
import { listenForInstall } from './InstallApp'
import { useEffect, useState } from 'react'

export function MobileRuntime() {
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    const stopInstall = listenForInstall()
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    const stopViewport = observeMobileViewport()
    if (
      import.meta.env.PROD &&
      'serviceWorker' in navigator &&
      !window.gumDesktop
    ) {
      void navigator.serviceWorker
        .register('/tanchat-sw.js', { scope: '/chat', updateViaCache: 'none' })
        .catch(() => {
          // Online chat remains available if the browser disallows installation.
        })
    }
    return () => {
      stopInstall()
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      stopViewport()
    }
  }, [])
  return offline ? (
    <div className="network-status" role="status">
      You’re offline. Reconnect to send messages.
    </div>
  ) : null
}
