import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createUpdateController } from './updates.mjs'

function setup(response = 0) {
  const order = []
  const updater = new EventEmitter()
  updater.quitAndInstall = () => order.push('install')
  const controller = createUpdateController({
    updater,
    version: '0.1.0',
    getWindow: () => undefined,
    dialog: { showMessageBox: async () => ({ response }) },
    prepareToQuit: () => order.push('allow-close'),
  })
  return { updater, controller, order }
}
test('restart requires a downloaded update and native confirmation', async () => {
  const { updater, controller, order } = setup()
  assert.equal(await controller.install(), false)
  updater.emit('update-downloaded')
  assert.equal(await controller.install(), false)
  assert.deepEqual(order, [])
})
test('explicit restart bypasses macOS hide-on-close before the updater closes windows', async () => {
  const { updater, controller, order } = setup(1)
  updater.emit('update-downloaded')
  assert.equal(await controller.install(), true)
  assert.deepEqual(order, ['allow-close', 'install'])
})
test('simultaneous checks share one request', async () => {
  const { updater, controller } = setup()
  let finish
  let requests = 0
  updater.checkForUpdates = () => {
    requests++
    updater.emit('checking-for-update')
    return new Promise((resolve) => {
      finish = resolve
    })
  }
  const first = controller.check()
  const second = controller.check()
  assert.equal(requests, 1)
  updater.emit('update-available', { version: '0.2.0' })
  finish()
  assert.equal((await first).status, 'available')
  assert.equal((await second).availableVersion, '0.2.0')
})
test('a downloaded update survives another check without redownloading', async () => {
  const { updater, controller } = setup()
  updater.emit('update-downloaded')
  updater.checkForUpdates = () => assert.fail('must not check again')
  assert.equal((await controller.check()).status, 'downloaded')
})

test('background checks leave prompts to the app UI and stop on quit', async () => {
  const { startUpdateChecks } = await import('./updates.mjs')
  let tick
  let notified = 0
  let version = '0.1.3'
  let checks = 0
  let cleared = 0
  const stop = startUpdateChecks(
    {
      check: async () => {
        checks++
        return { status: 'available', availableVersion: version }
      },
      checkWithDialog: async () => {
        notified++
      },
    },
    {
      setTimeout: (callback) => {
        tick = callback
        return 1
      },
      setInterval: () => 2,
      clearTimeout: () => {
        cleared++
      },
      clearInterval: () => {
        cleared++
      },
    },
  )
  tick()
  await new Promise(setImmediate)
  tick()
  await new Promise(setImmediate)
  assert.equal(notified, 0)
  version = '0.1.4'
  tick()
  await new Promise(setImmediate)
  assert.equal(notified, 0)
  stop()
  tick()
  await new Promise(setImmediate)
  assert.equal(checks, 3)
  assert.equal(cleared, 2)
})
