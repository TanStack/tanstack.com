import { createConnectedDevice } from './connected-device.mjs'
import {
  app,
  BrowserWindow,
  Menu,
  WebContentsView,
  clipboard,
  dialog,
  ipcMain,
  shell,
  safeStorage,
  session,
} from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { resolveAppUrl } from './runtime-config.mjs'
import { createNativeUpdater } from './updates.mjs'
import { createAppWindowOpenHandler } from './external-links.mjs'

const directory = dirname(fileURLToPath(import.meta.url))
app.setName('TanStack')
app.setPath('userData', join(app.getPath('appData'), 'TanStack'))
const appUrl = resolveAppUrl({
  packaged: app.isPackaged,
  developmentUrl: process.env.TANSTACK_APP_URL,
})

const windows = new Map()
const registeredChannels = new Set()
const profiles = new Map()
let connectedDevice
let nativeUpdater
let appZoomPercent = 100
let saveHistory = Promise.resolve()
let saveAppSettings = Promise.resolve()
const zoomSteps = [50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300]
const appSettingsPath = () =>
  join(app.getPath('userData'), 'desktop-settings.json')

function nextZoom(current, direction) {
  return direction === 0
    ? 100
    : direction > 0
      ? (zoomSteps.find((step) => step > current + 0.5) ?? 300)
      : ([...zoomSteps].reverse().find((step) => step < current - 0.5) ?? 50)
}

async function loadAppSettings() {
  try {
    const value = JSON.parse(await readFile(appSettingsPath(), 'utf8'))
    if (
      Number.isFinite(value.zoomPercent) &&
      value.zoomPercent >= 50 &&
      value.zoomPercent <= 300
    ) {
      appZoomPercent = value.zoomPercent
    }
  } catch (error) {
    if (error?.code !== 'ENOENT')
      console.error('Could not read desktop settings:', error)
  }
}

function setAppZoom(direction) {
  appZoomPercent = nextZoom(appZoomPercent, direction)
  for (const controller of windows.values()) controller.setZoom()
  const path = appSettingsPath()
  const contents = JSON.stringify({ zoomPercent: appZoomPercent })
  saveAppSettings = saveAppSettings
    .then(async () => {
      const temporary = `${path}.tmp`
      await writeFile(temporary, contents, { mode: 0o600 })
      await rename(temporary, path)
    })
    .catch((error) => console.error('Could not save desktop settings:', error))
}

function installApplicationMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === 'darwin'
        ? [
            {
              label: 'TanStack',
              submenu: [
                { role: 'about', label: 'About TanStack' },
                {
                  label: 'Check for Updates…',
                  click: () => void nativeUpdater.checkWithDialog(),
                },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide', label: 'Hide TanStack' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit', label: 'Quit TanStack' },
              ],
            },
          ]
        : []),
      {
        label: 'File',
        submenu: [
          {
            label: 'New Window',
            accelerator: 'CommandOrControl+N',
            click: () => createWindow(),
          },
          {
            label: 'Open Conversation in New Window',
            accelerator: 'CommandOrControl+Shift+N',
            click: () =>
              createWindow(
                focusedWindow()?.webContents.getURL() || appUrl.href,
              ),
          },
          { role: 'close' },
        ],
      },
      { role: 'editMenu' },
      {
        label: 'View',
        submenu: [
          {
            label: 'Refresh TanStack',
            accelerator: 'CommandOrControl+R',
            click: () => {
              focusedWindow()?.webContents.reloadIgnoringCache()
              void nativeUpdater?.check()
            },
          },
          {
            label: 'Check for Updates…',
            click: () => void nativeUpdater?.checkWithDialog(),
          },
          { type: 'separator' },
          {
            label: 'Zoom In TanStack',
            accelerator: 'CommandOrControl+Plus',
            click: () => setAppZoom(1),
          },
          {
            label: 'Zoom Out TanStack',
            accelerator: 'CommandOrControl+-',
            click: () => setAppZoom(-1),
          },
          {
            label: 'Reset TanStack Zoom',
            accelerator: 'CommandOrControl+0',
            click: () => setAppZoom(0),
          },
        ],
      },
      { role: 'windowMenu' },
    ]),
  )
}

async function loadProfileData(profileId) {
  const data = { history: [], downloads: [], extensions: [], zoomPercent: 100 }
  try {
    const value = JSON.parse(
      await readFile(
        join(app.getPath('userData'), `browser-${profileId}.json`),
        'utf8',
      ),
    )
    data.history = Array.isArray(value.history)
      ? value.history
          .filter(
            (entry) =>
              typeof entry.url === 'string' &&
              typeof entry.title === 'string' &&
              Number.isFinite(entry.visitedAt),
          )
          .slice(0, 1000)
      : []
    data.downloads = Array.isArray(value.downloads)
      ? value.downloads
          .filter(
            (entry) =>
              typeof entry.id === 'string' &&
              typeof entry.filename === 'string' &&
              typeof entry.path === 'string',
          )
          .slice(0, 100)
      : []
    data.extensions = Array.isArray(value.extensions)
      ? value.extensions
          .filter(
            (entry) =>
              typeof entry.path === 'string' &&
              typeof entry.id === 'string' &&
              typeof entry.name === 'string',
          )
          .slice(0, 30)
      : []
    data.zoomPercent =
      Number.isFinite(value.zoomPercent) &&
      value.zoomPercent >= 50 &&
      value.zoomPercent <= 300
        ? value.zoomPercent
        : 100
  } catch (error) {
    if (error?.code !== 'ENOENT')
      console.error('Could not read browser history:', error)
  }
  return data
}

function focusedWindow() {
  const focused = BrowserWindow.getFocusedWindow()
  return (
    [...windows.values()].find((entry) => entry.window === focused)?.window ??
    [...windows.values()].at(-1)?.window
  )
}
function assertAppSender(event) {
  const controller = windows.get(event.sender.id)
  if (
    !controller ||
    controller.window.isDestroyed() ||
    event.sender !== controller.window.webContents ||
    event.senderFrame !== event.sender.mainFrame ||
    new URL(event.senderFrame.url).origin !== appUrl.origin
  ) {
    throw new Error(
      'Desktop control is only available to the TanStack app frame.',
    )
  }
  return controller
}

function createWindow(initialUrl = appUrl.href) {
  const target = new URL(initialUrl)
  if (target.origin !== appUrl.origin || target.username || target.password)
    throw new Error('Invalid app window URL.')
  let window
  let closed = false
  let browserView
  let browserVisible = false
  let browserProfile = ''
  let profileData = {
    history: [],
    downloads: [],
    extensions: [],
    zoomPercent: 100,
  }
  let browserZoomPercent = 100
  let deviceEmulation = 'off'
  let find = { query: '', active: 0, matches: 0 }
  let profileChange = Promise.resolve()
  const handlers = new Map()
  function handle(channel, callback) {
    handlers.set(channel, callback)
    if (registeredChannels.has(channel)) return
    registeredChannels.add(channel)
    ipcMain.handle(channel, (event, ...args) =>
      assertAppSender(event).handlers.get(channel)(event, ...args),
    )
  }

  function persistBrowserData(data = profileData, profile = browserProfile) {
    const contents = JSON.stringify(data)
    const path = join(app.getPath('userData'), `browser-${profile}.json`)
    for (const controller of windows.values()) {
      if (controller.profile() === profile) controller.publishState()
    }
    saveHistory = saveHistory
      .then(async () => {
        const temporary = `${path}.tmp`
        await writeFile(temporary, contents, { mode: 0o600 })
        await rename(temporary, path)
      })
      .catch((error) => console.error('Could not save browser history:', error))
  }

  function recordVisit(
    url,
    title,
    data = profileData,
    profile = browserProfile,
  ) {
    if (!url || !/^https?:\/\//.test(url)) return
    const latest = data.history[0]
    if (latest?.url === url && Date.now() - latest.visitedAt < 2000) {
      latest.title = title || latest.title
      return
    }
    data.history.unshift({ url, title: title || url, visitedAt: Date.now() })
    data.history = data.history.slice(0, 1000)
    persistBrowserData(data, profile)
  }

  function browserState() {
    const contents = browserView?.webContents
    return {
      url: contents?.getURL() || '',
      title: contents?.getTitle() || '',
      canGoBack: contents?.navigationHistory.canGoBack() || false,
      canGoForward: contents?.navigationHistory.canGoForward() || false,
      loading: contents?.isLoading() || false,
      zoomPercent: browserZoomPercent,
      appZoomPercent,
      deviceEmulation,
      find,
      downloads: profileData.downloads.slice(0, 20),
      extensions: profileData.extensions.map(
        ({ id, name, version, status }) => ({ id, name, version, status }),
      ),
    }
  }

  function publishState() {
    if (window && !window.isDestroyed()) {
      window.webContents.send('gum:browser:state-changed', browserState())
    }
  }

  function checkedPageUrl(value) {
    if (typeof value !== 'string' || value.length > 4096)
      throw new Error('Invalid URL.')
    const parsed = new URL(value.includes('://') ? value : `https://${value}`)
    if (
      parsed.username ||
      parsed.password ||
      (parsed.protocol !== 'https:' &&
        !(
          parsed.protocol === 'http:' &&
          (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')
        ))
    ) {
      throw new Error('Only HTTPS sites and local previews can open here.')
    }
    return parsed.href
  }

  function setVisible(visible) {
    if (!window || !browserView) return
    if (browserVisible === visible) return
    browserVisible = visible
    if (visible) window.contentView.addChildView(browserView)
    else window.contentView.removeChildView(browserView)
  }

  function initializeWindow() {
    window = new BrowserWindow({
      width: 1320,
      height: 900,
      minWidth: 760,
      minHeight: 520,
      title: 'TanStack',
      ...(process.platform === 'darwin'
        ? { titleBarStyle: 'hiddenInset' }
        : {}),
      webPreferences: {
        preload: join(directory, 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    })
    window.webContents.setZoomMode('isolated')
    window.webContents.setZoomFactor(appZoomPercent / 100)
    window.webContents.on('did-finish-load', () => {
      if (
        Math.abs(window.webContents.getZoomFactor() * 100 - appZoomPercent) >
        0.5
      ) {
        window.webContents.setZoomFactor(appZoomPercent / 100)
      }
      publishState()
    })
    window.webContents.setWindowOpenHandler(
      createAppWindowOpenHandler({
        appOrigin: appUrl.origin,
        getCurrentUrl: () => window.webContents.getURL(),
        openApp: (url) => createWindow(url),
        openExternal: (url) => shell.openExternal(url),
        reportError: (message, url) => {
          const choice = dialog.showMessageBoxSync({
            type: 'error',
            message,
            buttons: ['Close', 'Copy link'],
            defaultId: 1,
            cancelId: 0,
          })
          if (choice === 1) clipboard.writeText(url)
        },
        authWindowOptions: {
          width: 560,
          height: 760,
          title: 'Sign in to TanStack',
          ...(process.platform === 'darwin'
            ? { titleBarStyle: 'hiddenInset' }
            : {}),
          webPreferences: {
            preload: join(directory, 'preload.cjs'),
            additionalArguments: ['--kody-auth-window'],
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        },
      }),
    )
    window.webContents.on('did-create-window', (popup) => {
      popup.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      const restrictNavigation = (event, target) => {
        const url = new URL(target)
        if (url.protocol !== 'https:' && url.origin !== appUrl.origin)
          event.preventDefault()
      }
      popup.webContents.on('will-navigate', restrictNavigation)
      popup.webContents.on('will-redirect', restrictNavigation)
    })
    window.webContents.on('will-navigate', (event, url) => {
      if (new URL(url).origin !== appUrl.origin) event.preventDefault()
    })
    const windowId = window.webContents.id
    window.on('closed', () => {
      windows.delete(windowId)
      closed = true
      browserView?.webContents.close()
      browserView = undefined
      browserVisible = false
    })
    windows.set(window.webContents.id, {
      window,
      handlers,
      publishState,
      profile: () => browserProfile,
      setZoom: () => {
        window.webContents.setZoomFactor(appZoomPercent / 100)
        publishState()
      },
    })
    void window.loadURL(initialUrl)
  }

  async function createBrowserView() {
    const data = profileData
    const profile = browserProfile
    browserView = new WebContentsView({
      webPreferences: {
        partition: `persist:gum-browser-${browserProfile}`,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    })
    const guest = browserView.webContents
    for (const entry of data.extensions) {
      try {
        const loaded =
          guest.session.extensions
            .getAllExtensions()
            .find((item) => item.path === entry.path) ??
          (await guest.session.extensions.loadExtension(entry.path))
        entry.id = loaded.id
        entry.name = loaded.name
        entry.version = loaded.version
        entry.status = 'loaded'
      } catch (error) {
        entry.status = `Could not load: ${String(error).slice(0, 200)}`
      }
    }
    if (closed || guest.isDestroyed()) return
    if (data.extensions.length) persistBrowserData(data, profile)
    guest.setZoomMode('isolated')
    guest.setZoomFactor(browserZoomPercent / 100)
    guest.session.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false),
    )
    guest.setWindowOpenHandler(() => ({ action: 'deny' }))
    guest.on('will-navigate', (event, url) => {
      try {
        checkedPageUrl(url)
      } catch {
        event.preventDefault()
      }
    })
    guest.on('will-redirect', (event, details) => {
      if (!details.isMainFrame) return
      try {
        checkedPageUrl(details.url)
      } catch {
        event.preventDefault()
      }
    })
    for (const name of [
      'did-navigate',
      'did-navigate-in-page',
      'page-title-updated',
      'did-start-loading',
      'did-stop-loading',
    ]) {
      guest.on(name, publishState)
    }
    guest.on('did-navigate', (_event, url) =>
      recordVisit(url, guest.getTitle(), data, profile),
    )
    guest.on('did-navigate-in-page', (_event, url, isMainFrame) => {
      if (isMainFrame) recordVisit(url, guest.getTitle(), data, profile)
    })
    guest.on('page-title-updated', (_event, title) => {
      if (data.history[0]?.url === guest.getURL()) {
        data.history[0].title = title
        persistBrowserData(data, profile)
      }
    })
    guest.on('found-in-page', (_event, result) => {
      find = {
        ...find,
        active: result.activeMatchOrdinal,
        matches: result.matches,
      }
      publishState()
    })
    guest.on('did-finish-load', () => {
      if (Math.abs(guest.getZoomFactor() * 100 - browserZoomPercent) > 0.5) {
        guest.setZoomFactor(browserZoomPercent / 100)
      }
      publishState()
    })
    guest.on('zoom-changed', publishState)
    guest.on('before-input-event', (event, input) => {
      if (
        !(input.meta || input.control) ||
        input.alt ||
        input.type !== 'keyDown'
      )
        return
      const key = input.key.toLowerCase()
      if (key === 'f' || key === 'l') {
        event.preventDefault()
        window?.webContents.send(
          'gum:browser:shortcut',
          key === 'f' ? 'find' : 'address',
        )
      } else if (key === 'p') {
        event.preventDefault()
        guest.print({ silent: false, printBackground: true })
      } else if (key === 'r') {
        event.preventDefault()
        window.webContents.reloadIgnoringCache()
        void nativeUpdater?.check()
      }
    })
    const onDownload = (_event, item, source) => {
      if (source !== guest) return
      const entry = {
        id: randomUUID(),
        filename: item.getFilename(),
        url: item.getURL(),
        path: '',
        receivedBytes: 0,
        totalBytes: item.getTotalBytes(),
        status: 'downloading',
      }
      item.setSaveDialogOptions({
        defaultPath: join(app.getPath('downloads'), entry.filename),
      })
      data.downloads.unshift(entry)
      data.downloads = data.downloads.slice(0, 100)
      publishState()
      item.on('updated', () => {
        entry.receivedBytes = item.getReceivedBytes()
        entry.totalBytes = item.getTotalBytes()
        entry.path = item.getSavePath()
        publishState()
      })
      item.on('done', (_event, status) => {
        entry.status = status
        entry.path = item.getSavePath()
        entry.receivedBytes = item.getReceivedBytes()
        persistBrowserData(data, profile)
        publishState()
      })
    }
    const guestSession = guest.session
    guestSession.on('will-download', onDownload)
    guest.on('destroyed', () =>
      guestSession.removeListener('will-download', onDownload),
    )
  }

  handle('gum:browser:profile', (event, profileId) => {
    assertAppSender(event)
    if (typeof profileId !== 'string' || !profileId || profileId.length > 256)
      throw new Error('Invalid browser profile.')
    const next = createHash('sha256').update(profileId).digest('hex')
    const operation = profileChange.then(async () => {
      if (closed || (next === browserProfile && browserView)) return
      setVisible(false)
      browserView?.webContents.close()
      browserView = undefined
      browserProfile = next
      if (!profiles.has(next)) profiles.set(next, loadProfileData(next))
      profileData = await profiles.get(next)
      if (closed) return
      browserZoomPercent = profileData.zoomPercent
      find = { query: '', active: 0, matches: 0 }
      deviceEmulation = 'off'
      await createBrowserView()
      if (!closed) publishState()
    })
    profileChange = operation.catch(() => {})
    return operation
  })
  handle('gum:browser:bounds', (event, bounds) => {
    assertAppSender(event)
    if (
      !bounds ||
      !['x', 'y', 'width', 'height'].every((key) =>
        Number.isFinite(bounds[key]),
      )
    ) {
      throw new Error('Invalid browser bounds.')
    }
    const area = window.contentView.getBounds()
    const scale = window.webContents.getZoomFactor()
    const left = Math.min(
      area.x + area.width,
      Math.max(area.x, Math.floor(bounds.x * scale)),
    )
    const top = Math.min(
      area.y + area.height,
      Math.max(area.y, Math.floor(bounds.y * scale)),
    )
    const right = Math.min(
      area.x + area.width,
      Math.ceil((bounds.x + bounds.width) * scale),
    )
    const bottom = Math.min(
      area.y + area.height,
      Math.ceil((bounds.y + bounds.height) * scale),
    )
    const box = {
      x: left,
      y: top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    }
    browserView.setBounds(box)
    setVisible(box.width > 0 && box.height > 0)
  })
  handle('gum:browser:hide', (event) => {
    assertAppSender(event)
    setVisible(false)
  })
  handle('gum:browser:state', (event) => {
    assertAppSender(event)
    return browserState()
  })
  handle('gum:browser:navigate', async (event, url) => {
    assertAppSender(event)
    await browserView.webContents.loadURL(checkedPageUrl(url))
    return browserState()
  })
  handle('gum:browser:back', (event) => {
    assertAppSender(event)
    if (browserView.webContents.navigationHistory.canGoBack())
      browserView.webContents.navigationHistory.goBack()
  })
  handle('gum:browser:forward', (event) => {
    assertAppSender(event)
    if (browserView.webContents.navigationHistory.canGoForward())
      browserView.webContents.navigationHistory.goForward()
  })
  handle('gum:browser:reload', (event) => {
    assertAppSender(event)
    browserView.webContents.reload()
  })
  handle('gum:browser:find', (event, query, next = false, forward = true) => {
    assertAppSender(event)
    if (typeof query !== 'string' || query.length > 500)
      throw new Error('Invalid search text.')
    if (!query) {
      browserView.webContents.stopFindInPage('clearSelection')
      find = { query: '', active: 0, matches: 0 }
      publishState()
      return
    }
    find = { ...find, query }
    browserView.webContents.findInPage(query, { findNext: !next, forward })
  })
  handle('gum:browser:print', (event) => {
    assertAppSender(event)
    browserView.webContents.print({ silent: false, printBackground: true })
  })
  handle('gum:browser:zoom', (event, direction) => {
    assertAppSender(event)
    if (![-1, 0, 1].includes(direction))
      throw new Error('Invalid zoom direction.')
    const contents = browserView.webContents
    const current = contents.getZoomFactor() * 100
    const next = nextZoom(current, direction)
    contents.setZoomFactor(next / 100)
    browserZoomPercent = next
    profileData.zoomPercent = next
    persistBrowserData()
    publishState()
    return next
  })
  handle('gum:browser:device', (event, preset) => {
    assertAppSender(event)
    if (!['off', 'phone', 'tablet'].includes(preset))
      throw new Error('Invalid device mode.')
    deviceEmulation = preset
    if (preset !== 'off')
      browserView.webContents.enableDeviceEmulation({
        screenPosition: 'mobile',
        screenSize:
          preset === 'phone'
            ? { width: 390, height: 844 }
            : { width: 768, height: 1024 },
        viewSize:
          preset === 'phone'
            ? { width: 390, height: 844 }
            : { width: 768, height: 1024 },
        deviceScaleFactor: preset === 'phone' ? 3 : 2,
      })
    else browserView.webContents.disableDeviceEmulation()
    publishState()
  })
  handle('gum:browser:screenshot', async (event) => {
    assertAppSender(event)
    const currentView = browserView
    const assertCurrentView = () => {
      if (
        closed ||
        !currentView ||
        currentView !== browserView ||
        currentView.webContents.isDestroyed()
      )
        throw new Error('This browser window changed. Try again.')
    }
    const image = await browserView.webContents.capturePage()
    const result = await dialog.showSaveDialog(window, {
      title: 'Save screenshot',
      defaultPath: join(app.getPath('pictures'), 'TanStack browser.png'),
      filters: [{ name: 'PNG image', extensions: ['png'] }],
    })
    if (result.canceled || !result.filePath) return false
    assertCurrentView()
    await writeFile(result.filePath, image.toPNG())
    return true
  })
  handle('gum:browser:history', (event) => {
    assertAppSender(event)
    return profileData.history.slice(0, 100)
  })
  handle('gum:browser:open-download', async (event, id) => {
    assertAppSender(event)
    const entry = profileData.downloads.find((item) => item.id === id)
    if (!entry || entry.status !== 'completed' || !entry.path)
      throw new Error('Download is unavailable.')
    return shell.openPath(entry.path)
  })
  handle('gum:browser:clear-data', async (event) => {
    assertAppSender(event)
    const currentView = browserView
    const assertCurrentView = () => {
      if (
        closed ||
        !currentView ||
        currentView !== browserView ||
        currentView.webContents.isDestroyed()
      )
        throw new Error('This browser window changed. Try again.')
    }
    const answer = await dialog.showMessageBox(window, {
      type: 'warning',
      buttons: ['Cancel', 'Clear browser data'],
      defaultId: 0,
      cancelId: 0,
      message: 'Clear browser data?',
      detail:
        'This signs you out of websites in TanStack and clears local browsing history and the downloads list. Downloaded files stay on your computer.',
    })
    if (answer.response !== 1) return false
    assertCurrentView()
    await currentView.webContents.session.clearData()
    assertCurrentView()
    profileData.history = []
    profileData.downloads = []
    persistBrowserData()
    publishState()
    return true
  })
  handle('gum:browser:add-extension', async (event) => {
    assertAppSender(event)
    const currentView = browserView
    const assertCurrentView = () => {
      if (
        closed ||
        !currentView ||
        currentView !== browserView ||
        currentView.webContents.isDestroyed()
      )
        throw new Error('This browser window changed. Try again.')
    }
    const selection = await dialog.showOpenDialog(window, {
      title: 'Choose an unpacked extension folder',
      properties: ['openDirectory'],
    })
    if (selection.canceled || !selection.filePaths[0]) return false
    assertCurrentView()
    const path = selection.filePaths[0]
    const manifest = JSON.parse(
      await readFile(join(path, 'manifest.json'), 'utf8'),
    )
    if (typeof manifest.name !== 'string' || !manifest.name.trim()) {
      throw new Error(
        'This folder does not contain a valid extension manifest.',
      )
    }
    const permissions = [
      ...(Array.isArray(manifest.permissions) ? manifest.permissions : []),
      ...(Array.isArray(manifest.host_permissions)
        ? manifest.host_permissions
        : []),
      ...(Array.isArray(manifest.content_scripts)
        ? manifest.content_scripts.flatMap((script) =>
            Array.isArray(script.matches) ? script.matches : [],
          )
        : []),
    ].filter((value) => typeof value === 'string')
    const permissionSummary =
      permissions.length > 20
        ? `${permissions.slice(0, 20).join(', ')}, and ${permissions.length - 20} more`
        : permissions.join(', ')
    const answer = await dialog.showMessageBox(window, {
      type: 'warning',
      buttons: ['Cancel', 'Load extension'],
      defaultId: 0,
      cancelId: 0,
      message: `Load ${manifest.name}?`,
      detail: `Extensions can read and change pages in this browser profile. Requested permissions and site access: ${permissionSummary || 'none listed'}. This extension loads from the selected folder on every app start. Keep that folder in place.`,
    })
    if (answer.response !== 1) return false
    assertCurrentView()
    if (profileData.extensions.some((entry) => entry.path === path)) {
      throw new Error('This extension is already loaded.')
    }
    const loaded =
      await currentView.webContents.session.extensions.loadExtension(path)
    assertCurrentView()
    profileData.extensions.push({
      path,
      id: loaded.id,
      name: loaded.name,
      version: loaded.version,
      status: 'loaded',
    })
    persistBrowserData()
    publishState()
    return true
  })
  handle('gum:browser:remove-extension', async (event, id) => {
    assertAppSender(event)
    const entry = profileData.extensions.find((item) => item.id === id)
    if (!entry) throw new Error('Extension not found.')
    browserView.webContents.session.extensions.removeExtension(id)
    profileData.extensions = profileData.extensions.filter(
      (item) => item !== entry,
    )
    persistBrowserData()
    publishState()
  })
  initializeWindow()
  return window
}
app.whenReady().then(async () => {
  await loadAppSettings()
  connectedDevice = await createConnectedDevice({
    app,
    safeStorage,
    dialog,
    session: session.defaultSession,
    origin: appUrl.origin,
  })
  for (const method of [
    'status',
    'connect',
    'shareFolder',
    'removeFolder',
    'disconnect',
  ]) {
    ipcMain.handle(`gum:device:${method}`, async (event, value) => {
      assertAppSender(event)
      if (method === 'removeFolder' && typeof value !== 'string')
        throw new Error('Invalid folder.')
      return connectedDevice[method](value)
    })
  }
  app.on('before-quit', () => connectedDevice.stop())
  nativeUpdater = await createNativeUpdater({
    app,
    dialog,
    getWindow: () => focusedWindow(),
    prepareToQuit: () => {},
  })
  ipcMain.handle('gum:desktop:describe', (event) => {
    assertAppSender(event)
    return {
      appVersion: app.getVersion(),
      protocols: [1],
      capabilities: ['browser.v1', 'updates.v1', 'devices.v1'],
    }
  })
  for (const action of ['state', 'check', 'download', 'install']) {
    ipcMain.handle(`gum:desktop:updates:${action}`, (event) => {
      assertAppSender(event)
      return nativeUpdater[action]()
    })
  }
  installApplicationMenu()
  createWindow()
  app.on('activate', () => {
    const window = focusedWindow()
    if (window) {
      window.show()
      window.focus()
    } else createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
