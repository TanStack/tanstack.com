import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import { createAppWindowOpenHandler } from './external-links.mjs'

function setup(overrides = {}) {
  const opened = []
  const errors = []
  const options = { webPreferences: { sandbox: true, nodeIntegration: false } }
  const handler = createAppWindowOpenHandler({
    appOrigin: 'https://gum.example',
    getCurrentUrl: () => 'https://gum.example/chat',
    authWindowOptions: options,
    openExternal: async (url) => opened.push(url),
    reportError: (message) => errors.push(message),
    ...overrides,
  })
  return { handler, opened, errors, options }
}

test('Open setup web links open in the system browser without creating an Electron window', async () => {
  const { handler, opened } = setup()
  assert.deepEqual(
    handler({
      url: 'https://kody.codes/account/integrations?setup=google',
      frameName: '_blank',
    }),
    { action: 'deny' },
  )
  await setImmediate()
  assert.deepEqual(opened, [
    'https://kody.codes/account/integrations?setup=google',
  ])
})

test('named sign-in popup still opens with its isolated options', async () => {
  const { handler, opened, options } = setup()
  assert.deepEqual(
    handler({
      url: 'about:blank',
      frameName: 'kody-banks-auth-12345678-1234-1234-1234-123456789012',
    }),
    {
      action: 'allow',
      overrideBrowserWindowOptions: options,
    },
  )
  await setImmediate()
  assert.deepEqual(opened, [])
})

test('unsafe protocols, credentials, malformed URLs, and untrusted pages cannot launch apps', async () => {
  const { handler, opened } = setup()
  for (const url of [
    'file:///tmp/test',
    'javascript:alert(1)',
    'custom-app:run',
    'https://user:pass@example.com',
    'not a URL',
    'about:blank',
  ]) {
    assert.deepEqual(handler({ url, frameName: '_blank' }), { action: 'deny' })
  }
  const untrusted = setup({ getCurrentUrl: () => 'https://other.example' })
  assert.deepEqual(
    untrusted.handler({ url: 'https://kody.codes', frameName: '_blank' }),
    { action: 'deny' },
  )
  await setImmediate()
  assert.deepEqual(opened, [])
  assert.deepEqual(untrusted.opened, [])
})

test('browser launch failures show a recovery message', async () => {
  const { handler, errors } = setup({
    openExternal: async () => {
      throw new Error('OS launch failed')
    },
  })
  handler({ url: 'https://kody.codes', frameName: '_blank' })
  await setImmediate()
  assert.equal(errors.length, 1)
  assert.match(errors[0], /Could not open your browser/)
})
