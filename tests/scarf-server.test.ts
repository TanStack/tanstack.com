import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createScarfServerRequest,
  sendScarfServerRequest,
} from '../src/utils/analytics/scarf-server.ts'

function incoming(
  path = '/query/latest/docs',
  headers: Record<string, string> = {},
) {
  return new Request(`https://tanstack.com${path}`, {
    headers: {
      'cf-connecting-ip': '192.0.2.1',
      'user-agent': 'ExampleCrawler/1.0',
      ...headers,
    },
  })
}

function content(type = 'text/html', status = 200) {
  return new Response('content', { status, headers: { 'content-type': type } })
}

test('forwards the visitor IP and user agent, without queries or cookies', () => {
  const event = createScarfServerRequest(
    incoming('/query/latest/docs?token=secret', { cookie: 'session=secret' }),
    content(),
  )
  assert.ok(event)
  const url = new URL(event.url)
  assert.equal(url.searchParams.get('event'), 'server_request')
  assert.equal(url.searchParams.get('source'), 'worker')
  assert.equal(url.searchParams.get('page'), '/query/latest/docs')
  assert.equal(event.headers.get('X-Scarf-IP'), '192.0.2.1')
  assert.equal(event.headers.get('user-agent'), 'ExampleCrawler/1.0')
  assert.equal(event.headers.get('cookie'), null)
  assert.ok(!event.url.includes('secret'))
})

test('browser requests stay in the server request dataset, never page_view or pixels', () => {
  const event = createScarfServerRequest(
    incoming('/', {
      'sec-fetch-dest': 'document',
      'user-agent': 'Mozilla/5.0',
    }),
    content(),
  )
  assert.ok(event)
  const url = new URL(event.url)
  assert.equal(url.pathname, '/site-events')
  assert.equal(url.searchParams.get('event'), 'server_request')
  assert.equal(url.searchParams.has('x-pxid'), false)
})

test('counts markdown negotiation and agent text, but not assets or internal requests', () => {
  for (const [path, type] of [
    ['/query/latest/docs', 'text/markdown; charset=utf-8'],
    ['/query/latest/docs/overview.md', 'text/plain'],
    ['/llms.txt', 'text/plain'],
    ['/llms-full.txt', 'text/plain'],
  ]) {
    assert.ok(createScarfServerRequest(incoming(path), content(type)), path)
  }
  for (const path of [
    '/api/example',
    '/_a/scarf/clipboard',
    '/account',
    '/admin/users',
    '/chat/c/private',
    '/builder/private-project',
  ]) {
    assert.equal(
      createScarfServerRequest(incoming(path), content()),
      null,
      path,
    )
  }
  for (const type of [
    'application/json',
    'image/png',
    'text/javascript',
    'text/plain',
  ]) {
    assert.equal(
      createScarfServerRequest(incoming('/asset'), content(type)),
      null,
    )
  }
})

test('skips opt-outs, missing IPs, non-production hosts, failed responses and non-GET requests', () => {
  for (const header of ['dnt', 'sec-gpc']) {
    assert.equal(
      createScarfServerRequest(incoming('/', { [header]: '1' }), content()),
      null,
    )
  }
  assert.equal(
    createScarfServerRequest(new Request('https://tanstack.com/'), content()),
    null,
  )
  assert.equal(
    createScarfServerRequest(
      new Request('https://preview.workers.dev/', {
        headers: { 'cf-connecting-ip': '192.0.2.1' },
      }),
      content(),
    ),
    null,
  )
  for (const status of [301, 404, 500]) {
    assert.equal(
      createScarfServerRequest(incoming(), content('text/html', status)),
      null,
    )
  }
  for (const method of ['HEAD', 'POST', 'OPTIONS']) {
    assert.equal(
      createScarfServerRequest(new Request(incoming(), { method }), content()),
      null,
    )
  }
})

test('delivery failures do not reject or leak the visitor IP', async (context) => {
  const warnings: unknown[][] = []
  context.mock.method(console, 'warn', (...args: unknown[]) =>
    warnings.push(args),
  )
  context.mock.method(globalThis, 'fetch', async () => {
    throw new Error('192.0.2.1')
  })
  await assert.doesNotReject(sendScarfServerRequest(incoming()))
  assert.equal(warnings.length, 1)
  assert.ok(!JSON.stringify(warnings).includes('192.0.2.1'))
})

test('uses Cloudflare bot signals without treating missing signals as human or bot', () => {
  for (const [botManagement, expected] of [
    [{ verifiedBot: true, score: 99 }, 'verified_bot'],
    [{ verifiedBot: false, score: 1 }, 'suspected_bot'],
    [{ verifiedBot: false, score: 29 }, 'suspected_bot'],
    [{ verifiedBot: false, score: 30 }, 'likely_human'],
    [{ verifiedBot: false, score: 0 }, 'unknown'],
    [{}, 'unknown'],
  ]) {
    const request = Object.assign(incoming(), { cf: { botManagement } })
    const event = createScarfServerRequest(request, content())
    assert.ok(event)
    assert.equal(new URL(event.url).searchParams.get('traffic_type'), expected)
  }
  const event = createScarfServerRequest(incoming(), content())
  assert.ok(event)
  assert.equal(new URL(event.url).searchParams.get('traffic_type'), 'unknown')
})
