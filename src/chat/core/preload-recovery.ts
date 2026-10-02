// This runs in the document head before React hydrates. Vite emits this event
// when a dynamic import fails, including when a deploy removes an old chunk.
export const preloadRecoveryScript = `window.addEventListener('vite:preloadError', (event) => {
  try {
    const key = 'kody-banks.preload-reload-at'
    const now = Date.now()
    const lastReload = Number(sessionStorage.getItem(key) || 0)
    if (Math.abs(now - lastReload) < 30000) return
    sessionStorage.setItem(key, String(now))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})`
