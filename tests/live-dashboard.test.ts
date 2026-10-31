import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  companyBreakdown,
  groupLiveCompanies,
  type LiveData,
  type LiveTab,
} from '../src/utils/analytics/live-dashboard.ts'

const now = '2026-10-29T16:00:00.000Z'
const company = {
  name: 'Example',
  domain: 'example.com',
  industry: 'Software',
  company_size: '100-250',
  linkedin_url: null,
}
function tab(overrides: Partial<LiveTab>): LiveTab {
  return {
    sessionId: 'session-1',
    arrivedAt: new Date('2026-10-29T15:59:00Z'),
    company,
    lookupStatus: 'matched',
    tabId: 'tab-1',
    page: '/query/latest',
    visible: true,
    lastSeen: new Date(now),
    leftAt: null,
    activity: [],
    active: true,
    ...overrides,
  }
}
function data(tabs: LiveTab[]): LiveData {
  return { enabled: true, lookupConfigured: true, now, truncated: false, tabs }
}

test('company rows combine people and tabs without counting the same page twice', () => {
  const rows = groupLiveCompanies(
    data([
      tab({}),
      tab({ tabId: 'tab-2', page: '/router/latest' }),
      tab({ sessionId: 'session-2', tabId: 'tab-3' }),
    ]),
    false,
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0].sessions.length, 2)
  assert.deepEqual(rows[0].pages, ['/query/latest', '/router/latest'])
  assert.deepEqual(companyBreakdown(rows, 'library'), [
    { name: 'Query', value: 1 },
    { name: 'Router', value: 1 },
  ])
  assert.deepEqual(companyBreakdown(rows, 'industry'), [
    { name: 'Software', value: 1 },
  ])
})

test('unmatched traffic stays in its own group and is excluded from company charts', () => {
  const rows = groupLiveCompanies(
    data([
      tab({ company: null, lookupStatus: 'unknown' }),
      tab({
        company: null,
        sessionId: 'session-2',
        tabId: 'tab-2',
        lookupStatus: 'failed',
      }),
    ]),
    false,
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0].name, 'Unmatched traffic')
  assert.equal(rows[0].sessions.length, 2)
  assert.deepEqual(companyBreakdown(rows, 'library'), [])
})

test('recent departures do not inflate current pages or charts, while an open tab keeps its company active', () => {
  const input = data([
    tab({ active: false, leftAt: new Date(now) }),
    tab({ sessionId: 'session-2', tabId: 'tab-2', page: '/form/latest' }),
    tab({
      company: { ...company, domain: 'left.com' },
      sessionId: 'left',
      tabId: 'tab-3',
      active: false,
      leftAt: new Date(now),
    }),
  ])
  assert.equal(groupLiveCompanies(input, false).length, 1)
  const rows = groupLiveCompanies(input, true)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0].pages, ['/form/latest'])
  assert.deepEqual(companyBreakdown(rows, 'industry'), [
    { name: 'Software', value: 1 },
  ])
})

test('actions count interactions from the last five minutes without page views or stale history', () => {
  const rows = groupLiveCompanies(
    data([
      tab({
        activity: [
          { action: 'page_view', page: '/query/latest', at: now },
          { action: 'install_command_copied', page: '/query/latest', at: now },
          {
            action: 'external_link_click',
            page: '/query/latest',
            at: '2026-10-29T15:54:59Z',
          },
        ],
      }),
    ]),
    false,
  )
  assert.equal(rows[0].actions, 1)
})
