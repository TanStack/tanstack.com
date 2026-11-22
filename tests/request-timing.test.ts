import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as Sentry from '@sentry/tanstackstart-react'
import {
  markRequestDatabaseUse,
  timeRequestWork,
  withDocsRequestTimings,
} from '../src/utils/request-timing.server'

const request = new Request('https://tanstack.com/router/latest/docs/overview')
test('timings are request-local and preserve streamed responses', async () => {
  const [used, unused] = await Promise.all([
    withDocsRequestTimings(request, async () => {
      await timeRequestWork('content_r2_read', async () => {
        markRequestDatabaseUse()
      })
      return new Response('first', { status: 201 })
    }),
    withDocsRequestTimings(request, async () => new Response('second')),
  ])
  assert.match(used.headers.get('Server-Timing') ?? '', /content_r2_read;dur=/)
  assert.match(used.headers.get('Server-Timing') ?? '', /db_used;desc="true"/)
  assert.match(
    unused.headers.get('Server-Timing') ?? '',
    /db_used;desc="false"/,
  )
  assert.equal(used.status, 201)
  assert.equal(await used.text(), 'first')
  assert.equal(await unused.text(), 'second')
})
test('failed work is timed without swallowing the error', async () => {
  const response = await withDocsRequestTimings(request, async () => {
    await assert.rejects(
      timeRequestWork('content_origin', async () => {
        throw new Error('origin failed')
      }),
      /origin failed/,
    )
    return new Response('fallback')
  })
  assert.match(
    response.headers.get('Server-Timing') ?? '',
    /content_origin;dur=/,
  )
})
test('non-docs requests have no profiling headers', async () => {
  const response = await withDocsRequestTimings(
    new Request('https://tanstack.com/account'),
    async () => new Response('account'),
  )
  assert.equal(response.headers.has('Server-Timing'), false)
})

test('docs response timing is sent through the scheduled Sentry flush', async (t) => {
  const metricPayloads: unknown[] = []
  const client = new Sentry.NodeClient({
    dsn: 'https://fixture@example.invalid/1',
    integrations: [],
    stackParser: Sentry.defaultStackParser,
    transport: () => ({
      async send([, items]) {
        for (const [header, payload] of items) {
          if (header.type === 'trace_metric') metricPayloads.push(payload)
        }
        return { statusCode: 200 }
      },
      flush: async () => true,
    }),
  })
  t.after(() => client.close(100))

  await Sentry.withScope(async (scope) => {
    scope.setClient(client)
    const pending: Array<Promise<boolean>> = []
    const response = await withDocsRequestTimings(
      request,
      async () => {
        markRequestDatabaseUse()
        return new Response(null, { status: 503 })
      },
      (flush) => pending.push(flush()),
    )

    assert.equal(response.status, 503)
    assert.deepEqual(await Promise.all(pending), [true])
    assert.partialDeepStrictEqual(metricPayloads, [
      {
        items: [
          {
            name: 'docs.response.headers.duration',
            type: 'distribution',
            unit: 'millisecond',
            attributes: {
              'http.response.status_code': { type: 'integer', value: 503 },
              'docs.database_used': { type: 'boolean', value: true },
            },
          },
        ],
      },
    ])
  })
})
