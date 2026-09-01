import assert from 'node:assert/strict'
import test from 'node:test'
import { PROVIDER_INFO } from '../src/components/deploy/shared'

test('Render deployment opens the repository as a Blueprint', () => {
  const url = new URL(PROVIDER_INFO.render.deployUrl('tanstack', 'books'))

  assert.equal(url.origin, 'https://render.com')
  assert.equal(url.pathname, '/deploy')
  assert.equal(
    url.searchParams.get('repo'),
    'https://github.com/tanstack/books',
  )
  assert.equal(url.searchParams.get('utm_source'), 'tanstack')
  assert.equal(url.searchParams.get('utm_medium'), 'referral')
  assert.equal(url.searchParams.get('utm_campaign'), 'gold-launch')
})
