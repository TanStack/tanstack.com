import assert from 'node:assert/strict'
import test from 'node:test'
import { BrowserClient, Scope, defaultStackParser } from '@sentry/browser'
import {
  consumeStaleAppRecovery,
  reloadOnStaleAppError,
} from '../src/utils/stale-app-reload'

test('Sentry suppresses recovered errors but reports cooldown failures', async (t) => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const storage = new Map<string, string>()
  let now = 20_000
  let reloads = 0
  const location = {
    reload: () => {
      reloads++
    },
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location,
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
  })
  t.after(() => {
    if (previousWindow)
      Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  })
  t.mock.method(Date, 'now', () => now)
  let sent = 0
  const originals: unknown[] = []
  const client = new BrowserClient({
    dsn: 'https://fixture@example.invalid/1',
    integrations: [],
    stackParser: defaultStackParser,
    transport: () => ({
      send: async () => {
        sent++
        return { statusCode: 200 }
      },
      flush: async () => true,
    }),
    beforeSend(event, hint) {
      originals.push(hint.originalException)
      return consumeStaleAppRecovery(hint.originalException) ? null : event
    },
  })
  t.after(() => client.close(100))
  const scope = new Scope()
  scope.setClient(client)
  const first = new Error('Failed to fetch dynamically imported module')
  assert.equal(reloadOnStaleAppError([first]), true)
  // The boundary can see the same error again before Sentry processes it.
  assert.equal(reloadOnStaleAppError(first), false)
  scope.captureException(first)
  await client.flush(100)
  assert.equal(originals[0], first)
  assert.equal(sent, 0)
  assert.equal(consumeStaleAppRecovery(first), false)

  const second = new Error(first.message)
  assert.equal(reloadOnStaleAppError(second), false)
  scope.captureException(second)
  await client.flush(100)
  assert.equal(originals[1], second)
  assert.equal(sent, 1)
  assert.equal(reloads, 1)

  scope.captureException(new Error('ordinary runtime defect'))
  await client.flush(100)
  assert.equal(sent, 2)
  assert.equal(consumeStaleAppRecovery(first.message), false)
  assert.equal(consumeStaleAppRecovery(undefined), false)

  now += 10_001
  const third = new Error(first.message)
  assert.equal(reloadOnStaleAppError(third), true)
  assert.equal(consumeStaleAppRecovery(third), true)
  assert.equal(consumeStaleAppRecovery(third), false)
  assert.equal(reloads, 2)

  now += 10_001
  t.mock.method(location, 'reload', () => {
    throw new Error('reload blocked')
  })
  const blocked = new Error(first.message)
  assert.throws(() => reloadOnStaleAppError(blocked), /reload blocked/)
  assert.equal(consumeStaleAppRecovery(blocked), false)
})
