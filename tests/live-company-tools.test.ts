import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildCompanyGridRows,
  filterCompanyRows,
  emptyCompanyFilters,
  employeeLowerBound,
  companyFacetCounts,
  companyWidgetItems,
  companyGrowth,
  csvSafeText,
  type LiveOverview,
} from '../src/utils/analytics/live-dashboard.ts'
import {
  companyHistoryFromReports,
  historyWindow,
  type ScarfHistory,
} from '../src/utils/analytics/scarf-history.ts'

const data: LiveOverview = {
  enabled: true,
  lookupConfigured: true,
  now: '2026-10-29T17:00:00Z',
  companies: [
    {
      id: 'acme.example',
      company: {
        name: 'Acme',
        domain: 'acme.example',
        industry: 'Software',
        company_size: '1,000 - 4,999',
        linkedin_url: null,
      },
      activeSessions: 3,
      activeTabs: 5,
      visibleTabs: 2,
      recentSessions: 4,
      pages: ['/query/latest', '/router/latest'],
      actions: 9,
      recentViews: 12,
      lastSeen: new Date('2026-10-29T17:00:00Z'),
    },
    {
      id: 'other.example',
      company: {
        name: 'Other',
        domain: 'other.example',
        industry: 'Retail',
        company_size: '100K+',
        linkedin_url: null,
      },
      activeSessions: 1,
      activeTabs: 1,
      visibleTabs: 1,
      recentSessions: 1,
      pages: ['/query/latest'],
      actions: 1,
      recentViews: 2,
      lastSeen: new Date('2026-10-29T17:00:00Z'),
    },
    {
      id: '',
      company: null,
      activeSessions: 10,
      activeTabs: 10,
      visibleTabs: 2,
      recentSessions: 10,
      pages: ['/form/latest'],
      actions: 100,
      recentViews: 100,
      lastSeen: new Date('2026-10-29T17:00:00Z'),
    },
  ],
}
const history: ScarfHistory = {
  status: 'ready',
  days: 30,
  start: '2026-09-30',
  end: '2026-10-30',
  fetchedAt: data.now,
  issues: [],
  companies: [
    {
      domain: 'acme.example',
      name: 'Acme',
      views: 500,
      previousViews: 250,
      siteEvents: 2000,
      origins: 12,
      endpoints: 18,
      stage: 'ongoing-usage',
      lastSeen: data.now,
    },
  ],
}

test('facets use OR within a dimension and AND across dimensions', () => {
  const rows = buildCompanyGridRows(data, history)
  assert.deepEqual(
    filterCompanyRows(rows, {
      ...emptyCompanyFilters,
      library: ['Query', 'Form'],
      industry: ['Software'],
    }).map((row) => row.id),
    ['acme.example'],
  )
  assert.deepEqual(
    filterCompanyRows(rows, {
      ...emptyCompanyFilters,
      minViews: '100',
      minActions: '5',
    }).map((row) => row.id),
    ['acme.example'],
  )
  assert.equal(
    filterCompanyRows(rows, { ...emptyCompanyFilters, identifiedOnly: true })
      .length,
    2,
  )
})
test('facet counts exclude unmatched traffic and count each company once per library', () => {
  const rows = buildCompanyGridRows(data, history)
  assert.deepEqual(
    companyFacetCounts(rows, 'library').map((item) => [item.name, item.value]),
    [
      ['Query', 2],
      ['Router', 1],
    ],
  )
  assert.equal(
    companyFacetCounts(
      filterCompanyRows(
        rows,
        { ...emptyCompanyFilters, industry: ['Software'] },
        'industry',
      ),
      'industry',
    ).length,
    2,
  )
})
test('Other retains the actual facet values so a click can filter the grouped categories', () => {
  const items = Array.from({ length: 8 }, (_, index) => ({
    name: `Industry ${index}`,
    value: 8 - index,
    values: [`Industry ${index}`],
  }))
  const other = companyWidgetItems(items).at(-1)
  assert.deepEqual(other, {
    name: 'Other',
    value: 6,
    values: ['Industry 5', 'Industry 6', 'Industry 7'],
  })
})
test('size sorting handles provider range variants, K suffixes, and unknown values', () => {
  assert.equal(employeeLowerBound('1,000 - 4,999'), 1000)
  assert.equal(employeeLowerBound('5K-10K'), 5000)
  assert.equal(employeeLowerBound('100K+'), 100000)
  assert.equal(employeeLowerBound(null), undefined)
})
test('missing historical metrics stay unknown, zero stays zero, and change uses equal windows', () => {
  const rows = buildCompanyGridRows(data, history)
  assert.equal(companyGrowth(rows[0]), 100)
  assert.equal(rows[1].history, undefined)
  assert.equal(companyGrowth(rows[1]), undefined)
  assert.deepEqual(historyWindow(30, new Date('2026-10-29T17:00:00Z')), {
    start: '2026-09-30',
    end: '2026-10-30',
    previousStart: '2026-08-31',
  })
})
test('report joins keep site pixel views separate from telemetry events and do not invent missing values', () => {
  const report = {
    company_domain: 'ACME.EXAMPLE',
    company_name: 'Acme',
    total: 12,
    unique_origins: 2,
    unique_endpoints: 3,
    company_funnel_stage: null,
    last_seen: data.now,
  }
  const rows = companyHistoryFromReports([report], undefined, [
    { ...report, total: 90 },
  ])
  assert.equal(rows[0].views, 12)
  assert.equal(rows[0].siteEvents, 90)
  assert.equal(rows[0].previousViews, undefined)
  assert.throws(
    () => companyHistoryFromReports([report, report], undefined, undefined),
    /duplicate/,
  )
})
test('CSV text neutralizes spreadsheet formulas while preserving numeric values at their source', () => {
  assert.equal(csvSafeText('=SUM(1,2)'), "'=SUM(1,2)")
  assert.equal(csvSafeText('  +1'), "'  +1")
  assert.equal(csvSafeText('Acme'), 'Acme')
})
