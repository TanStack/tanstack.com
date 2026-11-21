import assert from 'node:assert/strict'
import test from 'node:test'
import { notFound, redirect } from '@tanstack/react-router'
import {
  filterSentryEvent,
  redactByokRequestHeaders,
} from '../src/utils/sentry-redaction'

test('Sentry events never include BYOK request headers', () => {
  const event = {
    request: {
      headers: {
        Accept: 'application/json',
        'X-Byok-OpenAI': 'openai-secret',
        'x-byok-anthropic': 'anthropic-secret',
        'x-byok-openrouter': 'openrouter-secret',
      },
    },
  }

  assert.equal(redactByokRequestHeaders(event), event)
  assert.deepEqual(event.request.headers, { Accept: 'application/json' })
})

test('Sentry filters actual Router control flow and keeps real failures redacted', () => {
  for (const originalException of [notFound(), redirect({ href: '/' })]) {
    assert.equal(filterSentryEvent({}, { originalException }), null)
  }
  for (const originalException of [
    new Error('failure'),
    new Response(null, { status: 500 }),
    { isRedirect: true },
    undefined,
  ]) {
    const event = {
      request: {
        headers: { 'x-byok-openai': 'secret', Accept: 'application/json' },
      },
    }
    assert.equal(filterSentryEvent(event, { originalException }), event)
    assert.deepEqual(event.request.headers, { Accept: 'application/json' })
  }
})
