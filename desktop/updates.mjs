import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function createNativeUpdater({
  app,
  dialog,
  getWindow,
  prepareToQuit,
}) {
  let updater
  if (app.isPackaged) {
    const metadata = JSON.parse(
      await readFile(join(app.getAppPath(), 'package.json'), 'utf8'),
    )
    if (metadata.nativeUpdates) {
      const { default: electronUpdater } = await import('electron-updater')
      updater = electronUpdater.autoUpdater
      updater.autoDownload = false
      updater.autoInstallOnAppQuit = true
      updater.allowDowngrade = false
    }
  }
  const controller = createUpdateController({
    updater,
    version: app.getVersion(),
    dialog,
    getWindow,
    prepareToQuit,
  })
  if (updater) {
    const stop = startUpdateChecks(controller)
    app.once('before-quit', stop)
  }
  return controller
}

export function startUpdateChecks(controller, timers = globalThis) {
  let stopped = false
  const check = async () => {
    if (stopped) return
    await controller.check()
  }
  const startup = timers.setTimeout(() => void check(), 30_000)
  const interval = timers.setInterval(() => void check(), 4 * 60 * 60 * 1000)
  startup.unref?.()
  interval.unref?.()
  return () => {
    stopped = true
    timers.clearTimeout(startup)
    timers.clearInterval(interval)
  }
}

export function createUpdateController({
  updater,
  version,
  dialog,
  getWindow,
  prepareToQuit,
}) {
  let status = { status: updater ? 'idle' : 'disabled', version }
  let pending
  const showDialog = (options) => {
    const window = getWindow()
    return window
      ? dialog.showMessageBox(window, options)
      : dialog.showMessageBox(options)
  }
  if (updater) {
    updater.on('checking-for-update', () => {
      status = { ...status, status: 'checking', error: undefined }
    })
    updater.on('update-available', (info) => {
      status = {
        ...status,
        status: 'available',
        availableVersion: info.version,
      }
    })
    updater.on('update-not-available', () => {
      status = { status: 'current', version: version }
    })
    updater.on('download-progress', (progress) => {
      status = { ...status, status: 'downloading', percent: progress.percent }
    })
    updater.on('update-downloaded', () => {
      status = { ...status, status: 'downloaded', percent: 100 }
    })
    updater.on('error', (error) => {
      console.error('Desktop update failed:', error)
      status = {
        ...status,
        status: 'error',
        error: 'The desktop update could not finish. Try again later.',
      }
    })
  }
  const run = async (action) => {
    if (pending) return pending
    pending = (async () => {
      try {
        await action()
      } catch (error) {
        console.error('Desktop update failed:', error)
        status = {
          ...status,
          status: 'error',
          error: 'The desktop update could not finish. Try again later.',
        }
      }
      return { ...status }
    })()
    try {
      return await pending
    } finally {
      pending = undefined
    }
  }
  const api = {
    state: () => ({ ...status }),
    check: async () => {
      if (!updater || status.status === 'downloaded') return api.state()
      return run(() => updater.checkForUpdates())
    },
    download: async () => {
      if (!updater || status.status !== 'available') return api.state()
      return run(() => updater.downloadUpdate())
    },
    install: async () => {
      if (!updater || status.status !== 'downloaded') return false
      const answer = await showDialog({
        type: 'question',
        buttons: ['Later', 'Restart and update'],
        defaultId: 0,
        cancelId: 0,
        message: 'Restart TanStack to install the update?',
        detail:
          'This closes the desktop window and its browser pages. You can also install the update the next time you quit the app.',
      })
      if (answer.response !== 1) return false
      // The updater closes windows before app.before-quit. Bypass hide-on-close first.
      prepareToQuit()
      updater.quitAndInstall()
      return true
    },
    checkWithDialog: async () => {
      const result = await api.check()
      if (result.status === 'downloaded') return api.install()
      if (result.status === 'available') {
        const answer = await showDialog({
          type: 'info',
          buttons: ['Later', 'Download'],
          defaultId: 1,
          cancelId: 0,
          message: `TanStack ${result.availableVersion} is available.`,
        })
        if (answer.response === 1) {
          const downloaded = await api.download()
          if (downloaded.status === 'downloaded') await api.install()
        }
        return
      }
      await showDialog({
        type: result.status === 'error' ? 'error' : 'info',
        message:
          result.status === 'disabled'
            ? 'Desktop updates are not configured for this build.'
            : result.status === 'error'
              ? result.error
              : result.status === 'checking' || result.status === 'downloading'
                ? 'The desktop update is still in progress.'
                : 'TanStack is up to date.',
      })
    },
  }
  return api
}
