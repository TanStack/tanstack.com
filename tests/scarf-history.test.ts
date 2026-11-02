import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  loadScarfHistory,
  scarfReportUrl,
} from '../src/utils/analytics/scarf-history.server.ts'

test('site reports select only the website pixels or its dedicated telemetry package', () => {
  const views = scarfReportUrl('2026-09-30', '2026-10-30', 'views')
  assert.equal(views.pathname, '/v3/insights/TanStack/aggregations/export')
  assert.equal(views.searchParams.get('package_id'), 'none')
  assert.ok(
    views.searchParams
      .getAll('tracking_pixel_id')
      .includes('b7a8c111-2305-4d95-a02a-d84c5bfb82ae'),
  )
  assert.equal(views.searchParams.get('group_by_artifact'), 'false')
  assert.equal(views.searchParams.get('group_by_artifact_type'), 'false')
  const events = scarfReportUrl('2026-09-30', '2026-10-30', 'events')
  assert.equal(
    events.searchParams.get('package_id'),
    'b942b596-f90d-4072-a763-86fb5fbe5852',
  )
  assert.equal(events.searchParams.get('tracking_pixel_id'), 'none')
})
test('unavailable reporting access does not pretend the company has zero history', async (t) => {
  const previous = process.env.ANALYTICS_SCARF_API_TOKEN
  process.env.ANALYTICS_SCARF_API_TOKEN = 'test-token'
  t.after(() => {
    if (previous === undefined) delete process.env.ANALYTICS_SCARF_API_TOKEN
    else process.env.ANALYTICS_SCARF_API_TOKEN = previous
  })
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(null, { status: 403 }),
  )
  const result = await loadScarfHistory(30)
  assert.equal(result.status, 'unavailable')
  assert.deepEqual(result.companies, [])
  assert.equal(result.issues.length, 3)
})

test('streamed history keeps aggregate views separate and strips source identifiers', async (t) => {
  const previous = process.env.ANALYTICS_SCARF_API_TOKEN
  process.env.ANALYTICS_SCARF_API_TOKEN = 'test-token'
  t.after(() => {
    if (previous === undefined) delete process.env.ANALYTICS_SCARF_API_TOKEN
    else process.env.ANALYTICS_SCARF_API_TOKEN = previous
  })
  const { historyWindow } =
    await import('../src/utils/analytics/scarf-history.ts')
  const window = historyWindow(30)
  t.mock.method(
    globalThis,
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      assert.equal(
        new Headers(init?.headers).get('Authorization'),
        'Bearer test-token',
      )
      assert.equal(url.searchParams.get('format'), 'ndjson')
      const total =
        url.searchParams.get('package_id') !== 'none'
          ? 90
          : url.searchParams.get('start_date') === window.start
            ? 12
            : 6
      const row = {
        company_domain: 'example.com',
        company_name: 'Example',
        total,
        unique_origins: 2,
        unique_endpoints: 3,
        company_funnel_stage: 'ongoing-usage',
        last_seen: new Date().toISOString(),
        origin_id: 'source-id-must-not-be-returned',
      }
      return new Response(JSON.stringify(row), {
        headers: { 'Content-Type': 'application/x-ndjson' },
      })
    },
  )
  const result = await loadScarfHistory(30)
  assert.equal(result.status, 'ready')
  assert.equal(result.companies[0].views, 12)
  assert.equal(result.companies[0].previousViews, 6)
  assert.equal(result.companies[0].siteEvents, 90)
  assert.equal(
    JSON.stringify(result).includes('source-id-must-not-be-returned'),
    false,
  )
  assert.equal(JSON.stringify(result).includes('test-token'), false)
})
