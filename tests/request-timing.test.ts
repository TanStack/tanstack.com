import assert from 'node:assert/strict'
import { test } from 'node:test'
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
