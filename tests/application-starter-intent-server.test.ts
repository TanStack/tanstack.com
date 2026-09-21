import assert from 'node:assert/strict'
import { test } from 'node:test'
import { z } from 'zod'

import { inferApplicationStarterPartnerIntent } from '../src/utils/application-starter-intent.server'
import { runWithHostRuntimeEnv } from '../src/server/runtime/host.server'

const activePartners = [
  { id: 'clerk', name: 'Clerk' },
  { id: 'railway', name: 'Railway' },
]
const payloadSchema = z.object({
  state: z.string(),
  questions: z.record(z.string(), z.object({ type: z.literal('choice') })),
})

test('published decide adapter maps capabilities and provider preferences without ranking providers', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: unknown, init: RequestInit) => {
      assert.equal(typeof init.body, 'string')
      const payload = payloadSchema.parse(JSON.parse(String(init.body)))
      assert.equal(
        payload.state,
        'Build an online store using Clerk, avoid Railway',
      )
      const choices: Record<string, string> = {
        app: 'clear',
        capability_accounts: 'needed',
        capability_storage: 'needed',
        capability_hosting: 'needed',
        provider_clerk: 'requested',
        provider_railway: 'excluded',
      }
      return Response.json({
        model: 'jev-latest',
        usage: { input_tokens: 1, output_tokens: 1 },
        answers: Object.fromEntries(
          Object.keys(payload.questions).map((key) => {
            const value =
              choices[key] ??
              (key.startsWith('provider_') ? 'unspecified' : 'absent')
            return [
              key,
              {
                type: 'choice',
                choice: value,
                probabilities: { [value]: 1 },
                confidence: 1,
              },
            ]
          }),
        ),
      })
    },
  )
  const result = await runWithHostRuntimeEnv(
    { TYPESAFE_API_KEY: 'test-only' },
    () =>
      inferApplicationStarterPartnerIntent(
        'Build an online store using Clerk, avoid Railway',
        activePartners,
      ),
  )
  assert.deepEqual(result, {
    eligiblePartnerIds: [
      'clerk',
      'workos',
      'cloudflare',
      'netlify',
      'railway',
      'render',
      'vercel',
      'prisma',
    ],
    preferredPartnerIds: ['clerk'],
    excludedPartnerIds: ['railway'],
  })
})

test('missing credentials make no inference request', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Must not call')
  })
  const result = await runWithHostRuntimeEnv({ TYPESAFE_API_KEY: '' }, () =>
    inferApplicationStarterPartnerIntent('Build a store', activePartners),
  )
  assert.equal(result, null)
  assert.equal(fetch.mock.callCount(), 0)
})

test('provider errors and malformed responses preserve deterministic behavior', async (t) => {
  for (const response of [
    new Response('Unavailable', { status: 503 }),
    Response.json({ unexpected: true }),
  ]) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => response)
    assert.equal(
      await runWithHostRuntimeEnv({ TYPESAFE_API_KEY: 'test-only' }, () =>
        inferApplicationStarterPartnerIntent('Build a store', activePartners),
      ),
      null,
    )
    fetch.mock.restore()
  }
})
