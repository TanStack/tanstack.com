import { useEffect, useState } from 'react'
import { appBuildId, availableAppBuild } from '../core/app-version'
import { useDesktopBrowserHost } from '../client/desktop-host'
import { DesktopUpdateControls } from './DesktopUpdateControls'
import './app-updates.css'

export function AppUpdateNotice({
  onRefresh,
  onLater,
}: {
  onRefresh: () => void
  onLater: () => void
}) {
  return (
    <section className="app-update-notice" aria-label="App update">
      <span role="status">A new version is available.</span>
      <button type="button" onClick={onRefresh}>
        Refresh
      </button>
      <button type="button" onClick={onLater}>
        Later
      </button>
    </section>
  )
}

export function AppUpdates() {
  const [available, setAvailable] = useState<string>()
  const [dismissed, setDismissed] = useState<string>()
  const { updates } = useDesktopBrowserHost()
  useEffect(() => {
    if (appBuildId === 'development') return
    let live = true
    let pending = false
    const controller = new AbortController()
    const check = async () => {
      if (pending || document.visibilityState === 'hidden') return
      pending = true
      try {
        const response = await fetch('/api/chat/app-version', {
          cache: 'no-store',
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(10000),
          ]),
        })
        if (!response.ok) return
        const version = await response.json()
        if (live) setAvailable(availableAppBuild(appBuildId, version))
      } catch {
        // Offline or a failed check is not evidence of an available update.
      } finally {
        pending = false
      }
    }
    void check()
    const interval = window.setInterval(() => void check(), 60000)
    const wake = () => void check()
    window.addEventListener('focus', wake)
    window.addEventListener('online', wake)
    document.addEventListener('visibilitychange', wake)
    return () => {
      live = false
      controller.abort()
      clearInterval(interval)
      window.removeEventListener('focus', wake)
      window.removeEventListener('online', wake)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [])
  return (
    <div className="app-updates">
      {available && available !== dismissed && (
        <AppUpdateNotice
          onRefresh={() => window.location.reload()}
          onLater={() => setDismissed(available)}
        />
      )}
      {updates && <DesktopUpdateControls host={updates} notice />}
    </div>
  )
}
