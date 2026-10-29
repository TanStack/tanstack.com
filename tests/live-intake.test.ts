import assert from 'node:assert/strict'
import { test } from 'node:test'
import { receiveLiveEvent } from '../src/utils/analytics/live.server.ts'

function request(body = '{}', headers: Record<string, string> = {}) {
  return new Request('https://tanstack.com/_a/live', {
    method: 'POST',
    headers: {
      origin: 'https://tanstack.com',
      'cf-connecting-ip': '192.0.2.1',
      ...headers,
    },
    body,
  })
}

test('presence intake rejects other origins and methods', async () => {
  assert.equal(
    (await receiveLiveEvent(new Request('https://tanstack.com/_a/live')))
      .status,
    405,
  )
  assert.equal(
    (await receiveLiveEvent(request('{}', { origin: 'https://other.test' })))
      .status,
    403,
  )
})

test('privacy signals skip collection before reading the body', async () => {
  for (const header of ['dnt', 'sec-gpc']) {
    const incoming = request('not JSON', { [header]: '1' })
    assert.equal((await receiveLiveEvent(incoming)).status, 204)
    assert.equal(incoming.bodyUsed, false)
  }
})

test('enabled intake bounds and validates data before using the database', async (t) => {
  const previous = process.env.LIVE_VISITORS_ENABLED
  process.env.LIVE_VISITORS_ENABLED = 'true'
  t.after(() => {
    if (previous === undefined) delete process.env.LIVE_VISITORS_ENABLED
    else process.env.LIVE_VISITORS_ENABLED = previous
  })
  assert.equal((await receiveLiveEvent(request('x'.repeat(1025)))).status, 413)
  assert.equal((await receiveLiveEvent(request('invalid'))).status, 400)
  assert.equal(
    (await receiveLiveEvent(request(JSON.stringify({ page: '/admin' }))))
      .status,
    400,
  )
  assert.equal(
    (await receiveLiveEvent(request('{}', { 'cf-connecting-ip': 'not-an-ip' })))
      .status,
    204,
  )
})
