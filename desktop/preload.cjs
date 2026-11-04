const { contextBridge, ipcRenderer } = require('electron')

// A small, persistent drag target also covers loading and external sign-in pages.
// It is independent of the hosted app's route and CSS.
if (process.platform === 'darwin') {
  window.addEventListener(
    'DOMContentLoaded',
    () => {
      document.documentElement.dataset.gumDesktopMac = 'true'
      const handle = document.createElement('div')
      handle.setAttribute('aria-hidden', 'true')
      handle.title = 'Drag window'
      Object.assign(handle.style, {
        position: 'fixed',
        top: '4px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '64px',
        height: '20px',
        zIndex: '2147483647',
        display: 'var(--kody-window-grip-display, flex)',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      })
      handle.style.setProperty('-webkit-app-region', 'drag')
      const shadow = handle.attachShadow({ mode: 'closed' })
      const grip = document.createElement('span')
      Object.assign(grip.style, {
        width: '32px',
        height: '4px',
        borderRadius: '4px',
        background: 'rgba(128,128,128,0.5)',
        pointerEvents: 'none',
      })
      shadow.append(grip)
      document.documentElement.append(handle)
    },
    { once: true },
  )
}

if (!process.argv.includes('--kody-auth-window'))
  contextBridge.exposeInMainWorld('gumDesktop', {
    devices: {
      status: () => ipcRenderer.invoke('gum:device:status'),
      connect: () => ipcRenderer.invoke('gum:device:connect'),
      shareFolder: () => ipcRenderer.invoke('gum:device:shareFolder'),
      removeFolder: (id) => ipcRenderer.invoke('gum:device:removeFolder', id),
      disconnect: () => ipcRenderer.invoke('gum:device:disconnect'),
    },
    describe: () => ipcRenderer.invoke('gum:desktop:describe'),
    updates: {
      state: () => ipcRenderer.invoke('gum:desktop:updates:state'),
      check: () => ipcRenderer.invoke('gum:desktop:updates:check'),
      download: () => ipcRenderer.invoke('gum:desktop:updates:download'),
      install: () => ipcRenderer.invoke('gum:desktop:updates:install'),
    },
    browser: {
      setProfile: (profileId) =>
        ipcRenderer.invoke('gum:browser:profile', profileId),
      setBounds: (bounds) => ipcRenderer.invoke('gum:browser:bounds', bounds),
      hide: () => ipcRenderer.invoke('gum:browser:hide'),
      navigate: (url) => ipcRenderer.invoke('gum:browser:navigate', url),
      back: () => ipcRenderer.invoke('gum:browser:back'),
      forward: () => ipcRenderer.invoke('gum:browser:forward'),
      reload: () => ipcRenderer.invoke('gum:browser:reload'),
      find: (query, next, forward) =>
        ipcRenderer.invoke('gum:browser:find', query, next, forward),
      print: () => ipcRenderer.invoke('gum:browser:print'),
      zoom: (direction) => ipcRenderer.invoke('gum:browser:zoom', direction),
      setDeviceEmulation: (preset) =>
        ipcRenderer.invoke('gum:browser:device', preset),
      screenshot: () => ipcRenderer.invoke('gum:browser:screenshot'),
      history: () => ipcRenderer.invoke('gum:browser:history'),
      openDownload: (id) => ipcRenderer.invoke('gum:browser:open-download', id),
      clearData: () => ipcRenderer.invoke('gum:browser:clear-data'),
      addExtension: () => ipcRenderer.invoke('gum:browser:add-extension'),
      removeExtension: (id) =>
        ipcRenderer.invoke('gum:browser:remove-extension', id),
      state: () => ipcRenderer.invoke('gum:browser:state'),
      onState: (listener) => {
        const handler = (_event, state) => listener(state)
        ipcRenderer.on('gum:browser:state-changed', handler)
        return () =>
          ipcRenderer.removeListener('gum:browser:state-changed', handler)
      },
      onShortcut: (listener) => {
        const handler = (_event, shortcut) => listener(shortcut)
        ipcRenderer.on('gum:browser:shortcut', handler)
        return () => ipcRenderer.removeListener('gum:browser:shortcut', handler)
      },
    },
  })
