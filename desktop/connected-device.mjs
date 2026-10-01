import { hostname } from 'node:os'
import { join, basename } from 'node:path'
import { readFile, writeFile, rename, realpath, stat } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { readGrantedFolder } from './device-folders.mjs'

export async function createConnectedDevice({
  app,
  safeStorage,
  dialog,
  session,
  origin,
}) {
  const path = join(app.getPath('userData'), 'connected-device.json')
  let state = null,
    stopped = false,
    timer,
    error = '',
    working = false,
    authenticated = false,
    syncing = null,
    saving = Promise.resolve()
  async function save() {
    if (!safeStorage.isEncryptionAvailable())
      throw new Error('Secure credential storage is unavailable.')
    const encrypted = safeStorage
      .encryptString(JSON.stringify(state))
      .toString('base64')
    saving = saving
      .catch(() => {})
      .then(async () => {
        await writeFile(path + '.tmp', encrypted, { mode: 0o600 })
        await rename(path + '.tmp', path)
      })
    await saving
  }
  try {
    state = JSON.parse(
      safeStorage.decryptString(
        Buffer.from(await readFile(path, 'utf8'), 'base64'),
      ),
    )
    if (state?.origin !== origin) state = null
  } catch (e) {
    if (e.code !== 'ENOENT') error = 'Reconnect this device to restore access.'
  }
  async function account(body) {
    const response = await session.fetch(origin + '/api/chat/account/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify(body),
      redirect: 'error',
    })
    if (!response.ok) throw new Error('Sign in to connect this device.')
    return response.json()
  }
  async function syncAccount(enable = false) {
    if (syncing) await syncing
    const run = async () => {
      const response = await session.fetch(
        origin + '/api/chat/account/devices',
        {
          redirect: 'error',
        },
      )
      authenticated = false
      if (response.status === 401) return false
      if (!response.ok) throw new Error('Could not check device sign-in.')
      const userId = response.headers.get('X-Device-Account')
      if (!userId)
        throw new Error(
          'Update the server to enable automatic device registration.',
        )
      const devices = await response.json()
      if (state?.userId !== userId) {
        state = null
        await save()
      }
      if (state && !devices.some((device) => device.id === state.id)) {
        state.revoked = true
        state.grants = []
        await save()
      }
      if (state?.revoked && !enable) {
        authenticated = true
        return false
      }
      if (!state || state.revoked) {
        if (process.platform !== 'darwin') return false
        if (!safeStorage.isEncryptionAvailable())
          throw new Error('Secure credential storage is unavailable.')
        const registration = await account({
          type: 'register',
          name: hostname(),
        })
        if (registration.userId !== userId)
          throw new Error('Account changed. Please try again.')
        state = { ...registration, name: hostname(), origin, grants: [] }
        await save()
      }
      authenticated = true
      return true
    }
    syncing = run()
    try {
      return await syncing
    } finally {
      syncing = null
    }
  }
  async function assertAccount(expectedId) {
    if (!(await syncAccount()) || state?.id !== expectedId)
      throw new Error('Account or device access changed. Please try again.')
  }
  async function transport(body) {
    const response = await fetch(origin + '/api/chat/device-transport', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + state.token,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    })
    if (response.status === 401) {
      state.revoked = true
      state.grants = []
      await save()
      throw new Error('Device access was revoked.')
    }
    if (!response.ok) throw new Error('Device connection is unavailable.')
    return response.json()
  }
  async function poll() {
    if (stopped || working) return
    working = true
    try {
      if (await syncAccount()) {
        const deviceId = state.id
        const request = await transport({
          type: 'poll',
          grants: state.grants.map(({ id, name }) => ({ id, name })),
        })
        error = ''
        if (request && Date.now() < request.expiresAt) {
          await assertAccount(deviceId)
          let result
          try {
            result = await readGrantedFolder(state.grants, request)
          } catch {
            result = {
              error:
                'The file could not be read. Check the path and folder permission.',
            }
          }
          if (
            state &&
            !stopped &&
            state.grants.some((g) => g.id === request.grantId)
          ) {
            await assertAccount(deviceId)
            await transport({
              type: 'result',
              id: request.id,
              result: JSON.stringify(result),
            })
          }
        }
      }
    } catch (e) {
      error = e.message
    } finally {
      working = false
      if (!stopped) timer = setTimeout(poll, 2000)
    }
  }
  void poll()
  return {
    status: () => ({
      connected: authenticated && !!state && !state.revoked,
      name: state?.name ?? hostname(),
      folders: !authenticated
        ? []
        : (state?.grants.map(({ id, name }) => ({ id, name })) ?? []),
      error,
    }),
    async connect() {
      await syncAccount()
    },
    async shareFolder() {
      if (!(await syncAccount(true)))
        throw new Error('Sign in to share a folder.')
      const deviceId = state.id
      const selection = await dialog.showOpenDialog({
        title: 'Share a folder with TanStack',
        properties: ['openDirectory'],
      })
      if (selection.canceled) return
      const approval = await dialog.showMessageBox({
        type: 'question',
        buttons: ['Cancel', 'Share folder'],
        defaultId: 0,
        cancelId: 0,
        message: 'Allow TanStack to read files in this folder?',
        detail:
          'File contents may be sent to your private cloud conversations and their model provider. Access stays available while the desktop app is running. You can remove access in Devices.',
      })
      if (approval.response !== 1) return
      await assertAccount(deviceId)
      if (state.grants.length >= 20)
        throw new Error('Remove a folder before sharing another.')
      const path = await realpath(selection.filePaths[0])
      const info = await stat(path)
      state.grants.push({
        id: randomUUID(),
        name: basename(path),
        path,
        dev: info.dev,
        ino: info.ino,
      })
      await save()
    },
    async removeFolder(id) {
      if (state) {
        await assertAccount(state.id)
        state.grants = state.grants.filter((g) => g.id !== id)
        await save()
      }
    },
    async disconnect() {
      if (state) {
        await assertAccount(state.id)
        await account({ type: 'revoke', id: state.id })
        state.revoked = true
        state.grants = []
        await save()
      }
    },
    stop() {
      stopped = true
      clearTimeout(timer)
    },
  }
}
