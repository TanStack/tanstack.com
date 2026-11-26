import { useEffect, useState } from 'react'
import {
  supportsDesktopBrowser,
  supportsDesktopUpdates,
  type DesktopDescription,
} from './desktop-compatibility'

export interface DesktopBrowserState {
  url: string
  title: string
  canGoBack: boolean
  canGoForward: boolean
  loading: boolean
  zoomPercent: number
  appZoomPercent: number
  deviceEmulation: 'off' | 'phone' | 'tablet'
  find: { query: string; active: number; matches: number }
  downloads: DesktopDownload[]
  extensions: DesktopExtension[]
}

export interface DesktopExtension {
  id: string
  name: string
  version?: string
  status: string
}

export interface DesktopDownload {
  id: string
  filename: string
  url: string
  path: string
  receivedBytes: number
  totalBytes: number
  status: string
}

export interface DesktopHistoryEntry {
  url: string
  title: string
  visitedAt: number
}

export interface DesktopBrowserHost {
  setProfile(profileId: string): Promise<void>
  setBounds(bounds: {
    x: number
    y: number
    width: number
    height: number
  }): Promise<void>
  hide(): Promise<void>
  navigate(url: string): Promise<DesktopBrowserState>
  back(): Promise<void>
  forward(): Promise<void>
  reload(): Promise<void>
  find(query: string, next?: boolean, forward?: boolean): Promise<void>
  print(): Promise<void>
  zoom(direction: -1 | 0 | 1): Promise<number>
  setDeviceEmulation(preset: 'off' | 'phone' | 'tablet'): Promise<void>
  screenshot(): Promise<boolean>
  history(): Promise<DesktopHistoryEntry[]>
  openDownload(id: string): Promise<string>
  clearData(): Promise<boolean>
  addExtension(): Promise<boolean>
  removeExtension(id: string): Promise<void>
  state(): Promise<DesktopBrowserState>
  onState(listener: (state: DesktopBrowserState) => void): () => void
  onShortcut(listener: (shortcut: 'find' | 'address') => void): () => void
}

declare global {
  interface Window {
    gumDesktop?: {
      devices?: {
        status: () => Promise<{
          connected: boolean
          name: string
          folders: { id: string; name: string }[]
          error: string
        }>
        connect: () => Promise<void>
        shareFolder: () => Promise<void>
        removeFolder: (id: string) => Promise<void>
        disconnect: () => Promise<void>
      }
      browser: DesktopBrowserHost
      describe?: () => Promise<DesktopDescription>
      updates?: DesktopUpdatesHost
    }
  }
}

export interface DesktopUpdateState {
  status:
    | 'disabled'
    | 'idle'
    | 'checking'
    | 'available'
    | 'current'
    | 'downloading'
    | 'downloaded'
    | 'error'
  version: string
  availableVersion?: string
  percent?: number
  error?: string
}

export interface DesktopUpdatesHost {
  state(): Promise<DesktopUpdateState>
  check(): Promise<DesktopUpdateState>
  download(): Promise<DesktopUpdateState>
  install(): Promise<boolean>
}

interface DesktopHostResult {
  ready: boolean
  host?: DesktopBrowserHost
  updates?: DesktopUpdatesHost
  issue?: string
}

export function useDesktopBrowserHost(): DesktopHostResult {
  const [result, setResult] = useState<DesktopHostResult>({ ready: false })
  useEffect(() => {
    let live = true
    const bridge = window.gumDesktop
    if (!bridge) {
      setResult({ ready: true })
      return
    }
    void (async () => {
      try {
        const description = await bridge.describe?.()
        if (!live) return
        const updates = supportsDesktopUpdates(bridge, description)
          ? bridge.updates
          : undefined
        if (!supportsDesktopBrowser(bridge, description)) {
          setResult({
            ready: true,
            updates,
            issue: 'Update TanChat to use its desktop browser.',
          })
          return
        }
        setResult({ ready: true, host: bridge.browser, updates })
      } catch {
        if (live)
          setResult({
            ready: true,
            issue:
              'The desktop connection is unavailable. Restart TanChat and try again.',
          })
      }
    })()
    return () => {
      live = false
    }
  }, [])
  return result
}
