import { useEffect, useState } from 'react'
import { Button } from './ui/Button'
type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
let pending: InstallPrompt | undefined
const listeners = new Set<() => void>()
export function listenForInstall() {
  const ready = (event: Event) => {
    event.preventDefault()
    pending = event as InstallPrompt
    listeners.forEach((notify) => notify())
  }
  const installed = () => {
    pending = undefined
    listeners.forEach((notify) => notify())
  }
  window.addEventListener('beforeinstallprompt', ready)
  window.addEventListener('appinstalled', installed)
  return () => {
    window.removeEventListener('beforeinstallprompt', ready)
    window.removeEventListener('appinstalled', installed)
  }
}
export function InstallApp() {
  const [prompt, setPrompt] = useState(pending)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const update = () => setPrompt(pending)
    listeners.add(update)
    update()
    return () => {
      listeners.delete(update)
    }
  }, [])
  if (!prompt || (typeof window !== 'undefined' && window.gumDesktop))
    return null
  return (
    <Button
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await prompt.prompt()
          await prompt.userChoice
        } finally {
          pending = undefined
          listeners.forEach((notify) => notify())
          setBusy(false)
        }
      }}
    >
      Install TanChat
    </Button>
  )
}
