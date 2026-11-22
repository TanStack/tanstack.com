import assert from 'node:assert/strict'
import test from 'node:test'
import * as Sentry from '@sentry/tanstackstart-react'

test('server instrumentation stays disabled in tests and reuses its client after a reload', async (t) => {
  t.mock.property(process, 'env', {
    ...process.env,
    NODE_ENV: 'test',
    SENTRY_DSN: 'https://fixture@example.invalid/1',
  })
  const listenerCounts = () =>
    ['beforeExit', 'uncaughtException', 'unhandledRejection'].map((event) =>
      process.listenerCount(event),
    )

  try {
    await import(
      new URL('../src/instrument.server.mjs?reload=1', import.meta.url).href
    )
    const client = Sentry.getClient()
    const counts = listenerCounts()
    assert.ok(client)
    assert.equal(client.getOptions().enabled, false)

    await import(
      new URL('../src/instrument.server.mjs?reload=2', import.meta.url).href
    )
    assert.equal(Sentry.getClient(), client)
    assert.deepEqual(listenerCounts(), counts)
  } finally {
    await Sentry.close(100)
  }
})
