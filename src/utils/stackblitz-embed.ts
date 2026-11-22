export const stackBlitzEmbedHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
} as const

export const webContainerHeaders = stackBlitzEmbedHeaders

export function getExampleRuntimeHeaders(
  runtime: 'esbuild' | 'external' | 'webcontainer',
) {
  if (runtime === 'esbuild') return {}
  if (runtime === 'webcontainer') return webContainerHeaders
  return stackBlitzEmbedHeaders
}

export function shouldReloadExampleDocument(
  browser: {
    isSecureContext: boolean
    crossOriginIsolated: boolean
    sessionStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  },
  pathname: string,
) {
  if (!browser.isSecureContext) return false
  const key = `tanstack-example-document-reload:${pathname}`
  try {
    if (browser.crossOriginIsolated) {
      browser.sessionStorage.removeItem(key)
      return false
    }
    if (browser.sessionStorage.getItem(key) === '1') return false
    browser.sessionStorage.setItem(key, '1')
    return true
  } catch {
    // Without per-tab storage, reloading could create a loop.
    return false
  }
}

export const stackBlitzIframeProps = {
  allow: 'cross-origin-isolated',
  // React 19.2 needs a string for this attribute; Redact needs it to be truthy.
  credentialless: 'true',
}
