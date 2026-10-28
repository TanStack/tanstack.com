import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getNetworkTrafficQuality,
  labelAnalyticsCollection,
} from '../src/utils/analytics/collection.server'

function networkRequest(cf: object) {
  const request = new Request('https://tanstack.com/_a/g/collect')
  Object.defineProperty(request, 'cf', { value: cf })
  return request
}

test('edge flags hosting networks separately from bots and leaves unknown networks alone', () => {
  assert.equal(
    getNetworkTrafficQuality(networkRequest({ asn: 16509 })),
    'datacenter',
  )
  assert.equal(
    getNetworkTrafficQuality(
      networkRequest({ asn: 16509, botManagement: null }),
    ),
    'datacenter',
  )
  assert.equal(
    getNetworkTrafficQuality(networkRequest({ asn: 7922 })),
    undefined,
  )
  assert.equal(getNetworkTrafficQuality(networkRequest({})), undefined)
  assert.equal(
    getNetworkTrafficQuality(networkRequest({ botManagement: { score: 1 } })),
    'automated',
  )
  assert.equal(
    getNetworkTrafficQuality(networkRequest({ botManagement: { score: 29 } })),
    'suspect',
  )
  assert.equal(
    getNetworkTrafficQuality(networkRequest({ botManagement: { score: 30 } })),
    undefined,
  )
  assert.equal(
    getNetworkTrafficQuality(networkRequest({ botManagement: { score: 0 } })),
    undefined,
  )
  assert.equal(
    getNetworkTrafficQuality(
      networkRequest({ botManagement: { verifiedBot: true } }),
    ),
    'automated',
  )
  assert.equal(
    getNetworkTrafficQuality(
      networkRequest({ botManagement: { corporateProxy: true, score: 99 } }),
    ),
    'datacenter',
  )
})

test('collection preserves scanner labels in query and batch events', () => {
  const params = new URLSearchParams(
    'en=partner_clicked&ep.traffic_quality=automated&ep.partner_id=neon',
  )
  labelAnalyticsCollection(params, 'datacenter')
  assert.equal(params.get('ep.traffic_quality'), 'automated')
  assert.equal(params.get('ep.partner_id'), 'neon')
  assert.equal(params.get('ep.traffic_quality_rule'), 'v2')
  const batch = labelAnalyticsCollection(
    new URLSearchParams('en=page_view'),
    'datacenter',
    'automated',
  )
  assert.equal(batch.has('ep.traffic_quality'), false)
  const normal = labelAnalyticsCollection(
    new URLSearchParams('en=page_view&ep.traffic_quality=unflagged'),
    'datacenter',
  )
  assert.equal(normal.get('ep.traffic_quality'), 'datacenter')
})

test('collection removes chart state for automatic as well as explicit events', () => {
  for (const path of ['/stats/npm', '/stats/npm/', '/stats/npm/react-vs-vue']) {
    const params = new URLSearchParams({
      dl: `https://tanstack.com${path}?chart=${'x'.repeat(1500)}#chart`,
      en: 'scroll',
    })
    labelAnalyticsCollection(params, undefined)
    assert.equal(params.get('dl'), `https://tanstack.com${path}`)
  }
  const params = new URLSearchParams({
    dl: 'https://tanstack.com/?utm_source=newsletter',
  })
  labelAnalyticsCollection(params, undefined)
  assert.equal(params.get('dl'), 'https://tanstack.com/?utm_source=newsletter')
})
