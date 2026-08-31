import assert from 'node:assert/strict'
import test from 'node:test'
import { redactByokRequestHeaders } from '../src/utils/sentry-redaction'

test('Sentry events never include BYOK request headers', () => {
  const event = {
    request: {
      headers: {
        Accept: 'application/json',
        'X-Byok-OpenAI': 'openai-secret',
        'x-byok-anthropic': 'anthropic-secret',
      },
    },
  }

  assert.equal(redactByokRequestHeaders(event), event)
  assert.deepEqual(event.request.headers, { Accept: 'application/json' })
})
