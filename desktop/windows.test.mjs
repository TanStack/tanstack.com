import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { registerHooks } from 'node:module'
import { mkdtemp } from 'node:fs/promises'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Exercise the actual main-process wiring without launching the user's installed app.
test('desktop windows own their browser and IPC lifecycle while sharing account storage', async () => {
  const root = await mkdtemp(join(tmpdir(), 'banks-windows-'))
  let ready
  let menu
  let focused
  let sequence = 0
  const windows = []
  const views = []
  const handlers = new Map()
  const sessions = new Map()
  const getSession = (partition = 'default') => {
    if (!sessions.has(partition))
      sessions.set(
        partition,
        Object.assign(new EventEmitter(), {
          setPermissionRequestHandler() {},
          clearData: async () => {},
          extensions: {
            getAllExtensions: () => [],
            loadExtension: async () => ({
              id: 'extension',
              name: 'Extension',
              version: '1',
            }),
            removeExtension() {},
          },
        }),
      )
    return sessions.get(partition)
  }
  class Contents extends EventEmitter {
    constructor(partition) {
      super()
      this.id = ++sequence
      this.mainFrame = { url: 'https://tanstack.com/chat' }
      this.url = ''
      this.zoom = 1
      this.sent = []
      this.session = getSession(partition)
      this.navigationHistory = {
        canGoBack: () => false,
        canGoForward: () => false,
      }
    }
    setZoomMode() {}
    setZoomFactor(value) {
      this.zoom = value
    }
    getZoomFactor() {
      return this.zoom
    }
    setWindowOpenHandler(handler) {
      this.openHandler = handler
    }
    async loadURL(url) {
      this.url = url
      this.mainFrame.url = url
      this.emit('did-navigate', {}, url)
      this.emit('did-finish-load')
    }
    getURL() {
      return this.url
    }
    getTitle() {
      return this.url
    }
    isLoading() {
      return false
    }
    isDestroyed() {
      return !!this.destroyed
    }
    send(channel, value) {
      this.sent.push({ channel, value })
    }
    close() {
      this.destroyed = true
      this.emit('destroyed')
    }
    enableDeviceEmulation(value) {
      this.device = value
    }
    disableDeviceEmulation() {
      this.device = undefined
    }
    findInPage() {}
    stopFindInPage() {}
  }
  class Window extends EventEmitter {
    static getFocusedWindow() {
      return focused
    }
    constructor(options) {
      super()
      this.options = options
      this.webContents = new Contents()
      this.children = new Set()
      this.contentView = {
        addChildView: (view) => this.children.add(view),
        removeChildView: (view) => this.children.delete(view),
        getBounds: () => ({ x: 0, y: 0, width: 1320, height: 900 }),
      }
      windows.push(this)
      focused = this
    }
    loadURL(url) {
      return this.webContents.loadURL(url)
    }
    isDestroyed() {
      return !!this.destroyed
    }
    close() {
      this.destroyed = true
      this.webContents.close()
      this.emit('closed')
    }
    show() {}
    focus() {
      focused = this
    }
  }
  class View {
    constructor(options) {
      this.webContents = new Contents(options.webPreferences.partition)
      views.push(this)
    }
    setBounds(value) {
      this.bounds = value
    }
  }
  const app = Object.assign(new EventEmitter(), {
    isPackaged: true,
    setName() {},
    setPath() {},
    getPath: () => root,
    getVersion: () => 'test',
    whenReady: () => ({
      then: (callback) => {
        ready = callback
      },
    }),
    quit() {},
  })
  globalThis.__banksWindowTest = {
    app,
    BrowserWindow: Window,
    WebContentsView: View,
    Menu: {
      buildFromTemplate: (value) => value,
      setApplicationMenu: (value) => {
        menu = value
      },
    },
    ipcMain: {
      handle: (name, handler) => {
        assert.ok(!handlers.has(name), `duplicate IPC handler ${name}`)
        handlers.set(name, handler)
      },
    },
    clipboard: {},
    dialog: {},
    shell: { openExternal: async () => {} },
    safeStorage: {},
    session: { defaultSession: getSession() },
  }
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'electron')
        return { url: 'test:electron', shortCircuit: true }
      if (
        context.parentURL?.includes('/desktop/main.mjs') &&
        specifier === './connected-device.mjs'
      )
        return { url: 'test:device', shortCircuit: true }
      if (
        context.parentURL?.includes('/desktop/main.mjs') &&
        specifier === './updates.mjs'
      )
        return { url: 'test:updates', shortCircuit: true }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url === 'test:electron')
        return {
          format: 'module',
          shortCircuit: true,
          source:
            'export const { app, BrowserWindow, Menu, WebContentsView, clipboard, dialog, ipcMain, shell, safeStorage, session } = globalThis.__banksWindowTest',
        }
      if (url === 'test:device')
        return {
          format: 'module',
          shortCircuit: true,
          source:
            'export async function createConnectedDevice(){return {stop(){},status(){return {connected:false}}}}',
        }
      if (url === 'test:updates')
        return {
          format: 'module',
          shortCircuit: true,
          source:
            'export async function createNativeUpdater(){return {state(){return {}},checkWithDialog(){}}}',
        }
      return next(url, context)
    },
  })
  try {
    await import('./main.mjs')
    await ready()
    const first = windows[0]
    const file = menu.find((entry) => entry.label === 'File').submenu
    file.find((entry) => entry.label === 'New Window').click()
    const second = windows[1]
    const invoke = (window, method, ...args) =>
      handlers.get(`gum:browser:${method}`)(
        {
          sender: window.webContents,
          senderFrame: window.webContents.mainFrame,
        },
        ...args,
      )
    await Promise.all([
      invoke(first, 'profile', 'same-account'),
      invoke(second, 'profile', 'same-account'),
    ])
    assert.equal(views.length, 2)
    assert.equal(views[0].webContents.session, views[1].webContents.session)
    await invoke(first, 'navigate', 'https://one.example')
    await invoke(second, 'navigate', 'https://two.example')
    assert.equal(invoke(first, 'state').url, 'https://one.example/')
    assert.equal(invoke(second, 'state').url, 'https://two.example/')
    assert.deepEqual(
      invoke(first, 'history').map((entry) => entry.url),
      ['https://two.example/', 'https://one.example/'],
    )
    invoke(first, 'device', 'phone')
    assert.equal(invoke(second, 'state').deviceEmulation, 'off')
    invoke(first, 'bounds', { x: 0, y: 0, width: 500, height: 500 })
    invoke(second, 'bounds', { x: 0, y: 0, width: 600, height: 500 })
    invoke(first, 'hide')
    assert.equal(first.children.size, 0)
    assert.equal(second.children.size, 1)
    assert.throws(
      () =>
        handlers.get('gum:browser:state')({
          sender: views[0].webContents,
          senderFrame: views[0].webContents.mainFrame,
        }),
      /app frame/,
    )
    assert.throws(
      () =>
        handlers.get('gum:browser:state')({
          sender: first.webContents,
          senderFrame: { url: first.webContents.getURL() },
        }),
      /app frame/,
    )
    await second.loadURL('https://tanstack.com/chat/w/personal/b/conversation')
    file
      .find((entry) => entry.label === 'Open Conversation in New Window')
      .click()
    assert.equal(windows[2].webContents.getURL(), second.webContents.getURL())
    first.close()
    assert.equal(views[0].webContents.isDestroyed(), true)
    assert.equal(views[1].webContents.isDestroyed(), false)
    assert.equal(invoke(second, 'state').url, 'https://two.example/')
    assert.throws(() => invoke(first, 'state'), /app frame/)
    second.webContents.openHandler({
      url: 'https://tanstack.com/chat/w/personal/b/other',
      frameName: '_blank',
    })
    assert.equal(
      windows[3].webContents.getURL(),
      'https://tanstack.com/chat/w/personal/b/other',
    )
    await invoke(second, 'profile', 'different-account')
    assert.deepEqual(invoke(second, 'history'), [])
    assert.equal(invoke(second, 'state').url, '')
    assert.notEqual(
      views.at(-1).webContents.session,
      views[1].webContents.session,
    )
    const viewCount = views.length
    const pending = invoke(windows[3], 'profile', 'closing-account')
    windows[3].close()
    await pending
    assert.equal(
      views.length,
      viewCount,
      'closing during setup must not create an orphan browser',
    )
    for (const window of windows) if (!window.isDestroyed()) window.close()
  } finally {
    hooks.deregister()
    delete globalThis.__banksWindowTest
    // Writes finish asynchronously, keep the temporary directory for the process lifetime.
    process.once('exit', () => rmSync(root, { recursive: true, force: true }))
  }
})
