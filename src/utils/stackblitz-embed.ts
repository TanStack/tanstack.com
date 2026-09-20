import type { IframeHTMLAttributes } from 'react'

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

export const stackBlitzIframeProps = {
  allow: 'cross-origin-isolated',
  credentialless: '',
} as IframeHTMLAttributes<HTMLIFrameElement> & {
  credentialless: string
}
