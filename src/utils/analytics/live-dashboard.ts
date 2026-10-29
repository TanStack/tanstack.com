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
