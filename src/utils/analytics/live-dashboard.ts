import type { getLiveVisitors } from './live.functions'

export type LiveData = Awaited<ReturnType<typeof getLiveVisitors>>
export type LiveTab = LiveData['tabs'][number]

export function groupLiveCompanies(data: LiveData, includeRecent: boolean) {
  const sessions = new Map<string, LiveTab[]>()
  for (const tab of data.tabs) {
    const tabs = sessions.get(tab.sessionId) ?? []
    tabs.push(tab)
    sessions.set(tab.sessionId, tabs)
  }
  const groups = new Map<
    string,
    { company: LiveTab['company']; sessions: LiveTab[][] }
  >()
  for (const tabs of sessions.values()) {
    if (!includeRecent && !tabs.some((tab) => tab.active)) continue
    const company = tabs[0].company
    const id = company?.domain.toLowerCase() ?? ''
    const group = groups.get(id) ?? { company, sessions: [] }
    group.sessions.push(tabs)
    groups.set(id, group)
  }
  const since = new Date(data.now).getTime() - 5 * 60_000
  return [...groups].map(([id, group]) => {
    const tabs = group.sessions.flat()
    const activeTabs = tabs.filter((tab) => tab.active)
    const pages = [...new Set(activeTabs.map((tab) => tab.page))]
    const libraries = [...new Set(pages.map(pageLibrary))]
    return {
      id,
      name: group.company?.name || group.company?.domain || 'Unmatched traffic',
      company: group.company,
      sessions: group.sessions,
      pages,
      libraries,
      actions: tabs.reduce(
        (total, tab) =>
          total +
          tab.activity.filter(
            (event) =>
              event.action !== 'page_view' &&
              new Date(event.at).getTime() >= since,
          ).length,
        0,
      ),
      lastSeen: Math.max(
        ...tabs.map((tab) => new Date(tab.lastSeen).getTime()),
      ),
      active: activeTabs.length > 0,
    }
  })
}

export type LiveCompanyRow = ReturnType<typeof groupLiveCompanies>[number]

const libraryNames: Record<string, string> = {
  query: 'Query',
  router: 'Router',
  start: 'Start',
  table: 'Table',
  db: 'DB',
  form: 'Form',
  store: 'Store',
  virtual: 'Virtual',
  pacer: 'Pacer',
  hotkeys: 'Hotkeys',
  ai: 'AI',
  charts: 'Charts',
  intent: 'Intent',
  devtools: 'Devtools',
  config: 'Config',
  cli: 'CLI',
  highlight: 'Highlight',
  markdown: 'Markdown',
  ranger: 'Ranger',
  redact: 'Redact',
  mcp: 'MCP',
  workflow: 'Workflow',
}

export function pageLibrary(page: string) {
  return libraryNames[page.split('/')[1]] ?? 'Website'
}

export function companyBreakdown(
  rows: LiveCompanyRow[],
  dimension: 'library' | 'industry',
) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!row.id || !row.active) continue
    const labels =
      dimension === 'library'
        ? row.libraries
        : [row.company?.industry || 'Unspecified']
    for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const ranked = [...counts]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
  if (ranked.length <= 5) return ranked
  return [
    ...ranked.slice(0, 4),
    {
      name: 'Other',
      value: ranked.slice(4).reduce((total, item) => total + item.value, 0),
    },
  ]
}

export type LiveOverview = Awaited<
  ReturnType<typeof import('./live.functions').getLiveCompanyOverview>
>
export type CompanyFacet = 'library' | 'industry' | 'size' | 'stage'
export type CompanyFilters = {
  search: string
  library: string[]
  industry: string[]
  size: string[]
  stage: string[]
  minViews: string
  minActions: string
  showRecent: boolean
  identifiedOnly: boolean
}
export const emptyCompanyFilters: CompanyFilters = {
  search: '',
  library: [],
  industry: [],
  size: [],
  stage: [],
  minViews: '',
  minActions: '',
  showRecent: false,
  identifiedOnly: false,
}

export function employeeLowerBound(value: string | null | undefined) {
  const match = value?.match(/(\d[\d,]*(?:\.\d+)?)\s*([km])?/i)
  if (!match) return undefined
  return (
    Number(match[1].replaceAll(',', '')) *
    (match[2]?.toLowerCase() === 'm'
      ? 1_000_000
      : match[2]?.toLowerCase() === 'k'
        ? 1000
        : 1)
  )
}
export function companySizeBucket(value: string | null | undefined) {
  const count = employeeLowerBound(value)
  return count === undefined
    ? 'Unspecified'
    : count < 250
      ? '1-249'
      : count < 1000
        ? '250-999'
        : count < 10_000
          ? '1K-9,999'
          : '10K+'
}
export function buildCompanyGridRows(
  data: LiveOverview,
  history: import('./scarf-history').ScarfHistory | undefined,
) {
  const reports = new Map(
    history?.companies.map((company) => [company.domain, company]),
  )
  return data.companies.map((company) => {
    const report = reports.get(company.id)
    return {
      ...company,
      name:
        company.company?.name ||
        report?.name ||
        company.id ||
        'Unmatched traffic',
      libraries: [...new Set(company.pages.map(pageLibrary))],
      active: company.activeSessions > 0,
      industry: company.company?.industry || 'Unspecified',
      sizeBucket: companySizeBucket(company.company?.company_size),
      employeeMin: employeeLowerBound(company.company?.company_size),
      history: report,
    }
  })
}
export type CompanyGridRow = ReturnType<typeof buildCompanyGridRows>[number]
export function companyFacetValues(row: CompanyGridRow, facet: CompanyFacet) {
  return facet === 'library'
    ? row.libraries
    : facet === 'industry'
      ? [row.industry]
      : facet === 'size'
        ? [row.sizeBucket]
        : [row.history?.stage || 'Unspecified']
}
export function filterCompanyRows(
  rows: CompanyGridRow[],
  filters: CompanyFilters,
  omit?: CompanyFacet,
) {
  const facets: CompanyFacet[] = ['library', 'industry', 'size', 'stage']
  const search = filters.search.trim().toLowerCase()
  return rows.filter(
    (row) =>
      (filters.showRecent || row.active) &&
      (!filters.identifiedOnly || Boolean(row.id)) &&
      (!search ||
        `${row.name} ${row.id} ${row.industry} ${row.libraries.join(' ')} ${row.pages.join(' ')}`
          .toLowerCase()
          .includes(search)) &&
      (!filters.minViews ||
        (row.history?.views !== undefined &&
          row.history.views >= Number(filters.minViews))) &&
      (!filters.minActions || row.actions >= Number(filters.minActions)) &&
      facets.every(
        (facet) =>
          omit === facet ||
          !filters[facet].length ||
          filters[facet].some((value) =>
            companyFacetValues(row, facet).includes(value),
          ),
      ),
  )
}
export function companyFacetCounts(
  rows: CompanyGridRow[],
  facet: CompanyFacet,
  activeOnly = true,
) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!row.id || (activeOnly && !row.active)) continue
    for (const value of companyFacetValues(row, facet))
      counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts]
    .map(([name, value]) => ({ name, value, values: [name] }))
    .sort((a, b) =>
      facet === 'size'
        ? ['1-249', '250-999', '1K-9,999', '10K+', 'Unspecified'].indexOf(
            a.name,
          ) -
          ['1-249', '250-999', '1K-9,999', '10K+', 'Unspecified'].indexOf(
            b.name,
          )
        : b.value - a.value || a.name.localeCompare(b.name),
    )
}
export function companyWidgetItems(
  items: ReturnType<typeof companyFacetCounts>,
) {
  return items.length <= 6
    ? items
    : [
        ...items.slice(0, 5),
        {
          name: 'Other',
          value: items.slice(5).reduce((count, item) => count + item.value, 0),
          values: items.slice(5).flatMap((item) => item.values),
        },
      ]
}
export function companyGrowth(row: CompanyGridRow) {
  const current = row.history?.views
  const previous = row.history?.previousViews
  return current === undefined || previous === undefined || previous === 0
    ? undefined
    : ((current - previous) / previous) * 100
}
export function csvSafeText(value: string) {
  return /^\s*[=+\-@]|^[\t\r\n]/.test(value) ? `'${value}` : value
}
