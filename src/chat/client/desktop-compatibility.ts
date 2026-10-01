// v1 is additive. Keep its methods and meanings stable across web deployments.
export const browserV1Methods = [
  'setProfile',
  'setBounds',
  'hide',
  'navigate',
  'back',
  'forward',
  'reload',
  'find',
  'print',
  'zoom',
  'setDeviceEmulation',
  'screenshot',
  'history',
  'openDownload',
  'clearData',
  'addExtension',
  'removeExtension',
  'state',
  'onState',
  'onShortcut',
] as const

export interface DesktopDescription {
  appVersion: string
  protocols: number[]
  capabilities: string[]
}

export function supportsDesktopBrowser(
  bridge: unknown,
  description?: DesktopDescription,
): boolean {
  if (!bridge || typeof bridge !== 'object') return false
  const browser = (bridge as { browser?: unknown }).browser
  if (!browser || typeof browser !== 'object') return false
  if (
    !browserV1Methods.every(
      (key) => typeof (browser as Record<string, unknown>)[key] === 'function',
    )
  )
    return false
  // Existing development shells predate the handshake but expose this exact v1 surface.
  if (!description) return !('describe' in bridge)
  return (
    Array.isArray(description.protocols) &&
    description.protocols.includes(1) &&
    Array.isArray(description.capabilities) &&
    description.capabilities.includes('browser.v1')
  )
}

export function supportsDesktopUpdates(
  bridge: unknown,
  description?: DesktopDescription,
): boolean {
  if (
    !bridge ||
    typeof bridge !== 'object' ||
    !description?.protocols?.includes(1) ||
    !description.capabilities?.includes('updates.v1')
  )
    return false
  const updates = (bridge as { updates?: unknown }).updates
  return (
    !!updates &&
    typeof updates === 'object' &&
    ['state', 'check', 'download', 'install'].every(
      (key) => typeof (updates as Record<string, unknown>)[key] === 'function',
    )
  )
}
