import assert from 'node:assert/strict'
import test from 'node:test'
import * as Sentry from '@sentry/tanstackstart-react'

test('server instrumentation reuses its client after a module reload', async () => {
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

    await import(
      new URL('../src/instrument.server.mjs?reload=2', import.meta.url).href
    )
    assert.equal(Sentry.getClient(), client)
    assert.deepEqual(listenerCounts(), counts)
  } finally {
    await Sentry.close(100)
  }
})
