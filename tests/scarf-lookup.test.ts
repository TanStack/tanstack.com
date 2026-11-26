import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lookupScarfCompany } from '../src/utils/analytics/scarf-lookup.server.ts'

test('Scarf lookup sends the visitor IP and the lookup-only credential', async (t) => {
  const company = {
    name: null,
    domain: 'example.test',
    industry: null,
    company_size: null,
    linkedin_url: null,
  }
  const fetch = t.mock.method(
    globalThis,
    'fetch',
    async (input: string | URL | Request, init?: RequestInit) => {
      assert.equal(
        String(input),
        'https://api.scarf.sh/v3/organizations/TanStack/ip-company?ip=2001%3Adb8%3A%3A1',
      )
      assert.equal(
        new Headers(init?.headers).get('X-Scarf-Lookup-Key'),
        'test-lookup-key',
      )
      assert.equal(new Headers(init?.headers).has('Authorization'), false)
      assert.equal(init?.cache, 'no-store')
      return Response.json({ company })
    },
  )
  assert.deepEqual(
    await lookupScarfCompany('2001:db8::1', 'test-lookup-key'),
    company,
  )
  assert.equal(fetch.mock.callCount(), 1)
})

test('a cache miss is distinct from API failures', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ company: null }),
  )
  assert.equal(await lookupScarfCompany('192.0.2.1', 'test-key'), null)
  for (const status of [403, 429, 503]) {
    fetch.mock.mockImplementation(async () => new Response(null, { status }))
    await assert.rejects(
      lookupScarfCompany('192.0.2.1', 'test-key'),
      new RegExp(String(status)),
    )
  }
  fetch.mock.mockImplementation(async () =>
    Response.json({ company: { name: 'Incomplete response' } }),
  )
  await assert.rejects(lookupScarfCompany('192.0.2.1', 'test-key'))
})
