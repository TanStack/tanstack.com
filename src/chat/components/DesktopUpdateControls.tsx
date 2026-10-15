import { useEffect, useState } from 'react'
import type {
  DesktopUpdatesHost,
  DesktopUpdateState,
} from '../client/desktop-host'

export function DesktopUpdateControls({
  host,
  notice = false,
}: {
  host: DesktopUpdatesHost
  notice?: boolean
}) {
  const [state, setState] = useState<DesktopUpdateState>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dismissed, setDismissed] = useState('')
  useEffect(() => {
    let live = true
    const read = () =>
      void host
        .state()
        .then((value) => {
          if (live) setState(value)
        })
        .catch(() => {
          if (live) setError('Could not read desktop update status.')
        })
    read()
    const timer = window.setInterval(read, 2000)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [host])
  const action = async () => {
    setBusy(true)
    setError('')
    try {
      if (state?.status === 'downloaded') await host.install()
      else
        setState(
          await (state?.status === 'available'
            ? host.download()
            : host.check()),
        )
    } catch {
      setError('Could not update the desktop app. Try again later.')
    } finally {
      setBusy(false)
    }
  }
  const noticeKey = `${state?.availableVersion}:${state?.status}`
  if (
    notice &&
    (!state ||
      !['available', 'downloading', 'downloaded', 'error'].includes(
        state.status,
      ) ||
      dismissed === noticeKey)
  )
    return null
  return (
    <div
      className={notice ? 'app-update-notice' : undefined}
      aria-label="Desktop update"
    >
      {state && !notice && <p>Desktop {state.version}</p>}
      {notice && (
        <span role="status">
          {state?.status === 'downloaded'
            ? 'Desktop update ready.'
            : state?.status === 'downloading'
              ? `Downloading update${state.percent == null ? '…' : ` ${Math.round(state.percent)}%`}`
              : state?.status === 'error'
                ? 'Desktop update needs attention.'
                : 'A desktop update is available.'}
        </span>
      )}
      {state?.status === 'disabled' ? (
        <p>Desktop updates are not configured for this build.</p>
      ) : (
        <button
          type="button"
          disabled={
            !state ||
            busy ||
            state.status === 'downloading' ||
            state.status === 'checking'
          }
          onClick={() => void action()}
        >
          {busy
            ? 'Working…'
            : state?.status === 'downloaded'
              ? 'Restart and update'
              : state?.status === 'available'
                ? `Download ${state.availableVersion}`
                : 'Check for desktop updates'}
        </button>
      )}
      {state?.status === 'current' && (
        <p role="status">The desktop app is up to date.</p>
      )}
      {(error || state?.error) && <p role="alert">{error || state?.error}</p>}
      {notice && (
        <button type="button" onClick={() => setDismissed(noticeKey)}>
          Later
        </button>
      )}
    </div>
  )
}
