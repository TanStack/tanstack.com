export function createAppWindowOpenHandler({
  appOrigin,
  getCurrentUrl,
  authWindowOptions,
  openExternal,
  openApp,
  reportError,
}) {
  return ({ url, frameName }) => {
    try {
      if (new URL(getCurrentUrl()).origin !== appOrigin)
        return { action: 'deny' }
      if (
        url === 'about:blank' &&
        /^kody-banks-auth-[a-f0-9-]{36}$/.test(frameName)
      ) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: authWindowOptions,
        }
      }
      const target = new URL(url)
      if (
        !['https:', 'http:'].includes(target.protocol) ||
        target.username ||
        target.password
      ) {
        return { action: 'deny' }
      }
      if (
        target.origin === appOrigin &&
        openApp &&
        !target.pathname.startsWith('/auth/')
      ) {
        openApp(target.href)
        return { action: 'deny' }
      }
      // Only ordinary web URLs reach the OS, never file or custom app protocols.
      void Promise.resolve()
        .then(() => openExternal(target.href))
        .catch(() => {
          reportError(
            'Could not open your browser. Copy the link and open it in your browser.',
            target.href,
          )
        })
    } catch {
      return { action: 'deny' }
    }
    return { action: 'deny' }
  }
}
