import { z } from 'zod'

export const historyDaysSchema = z.union([
  z.literal(7),
  z.literal(30),
  z.literal(90),
  z.literal(365),
])
export const scarfCompanyHistorySchema = z.object({
  domain: z.string(),
  name: z.string().nullable(),
  views: z.number().nonnegative().optional(),
  previousViews: z.number().nonnegative().optional(),
  siteEvents: z.number().nonnegative().optional(),
  origins: z.number().nonnegative().optional(),
  endpoints: z.number().nonnegative().optional(),
  stage: z.string().nullable(),
  lastSeen: z.string().nullable(),
})
export type ScarfCompanyHistory = z.infer<typeof scarfCompanyHistorySchema>
export const scarfHistorySchema = z.object({
  status: z.enum(['ready', 'partial', 'unconfigured', 'unavailable']),
  days: historyDaysSchema,
  start: z.string(),
  end: z.string(),
  fetchedAt: z.string(),
  companies: z.array(scarfCompanyHistorySchema),
  issues: z.array(z.string()),
})
export type ScarfHistory = z.infer<typeof scarfHistorySchema>
export function historyWindow(days: number, now = new Date()) {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  )
  const start = new Date(end.getTime() - days * 86_400_000)
  const previousStart = new Date(start.getTime() - days * 86_400_000)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    previousStart: previousStart.toISOString().slice(0, 10),
  }
}
export const scarfAggregationRowSchema = z.object({
  company_domain: z.string().nullable(),
  company_name: z.string().nullable(),
  total: z.number().int().nonnegative(),
  unique_origins: z.number().int().nonnegative(),
  unique_endpoints: z.number().int().nonnegative(),
  company_funnel_stage: z.string().nullable(),
  last_seen: z.string(),
})
export type ScarfAggregationRow = z.infer<typeof scarfAggregationRowSchema>
export const scarfAggregationSchema = z.object({
  data: z.array(scarfAggregationRowSchema).max(50_000),
})

export function companyHistoryFromReports(
  views: z.infer<typeof scarfAggregationSchema>['data'] | undefined,
  previous: z.infer<typeof scarfAggregationSchema>['data'] | undefined,
  events: z.infer<typeof scarfAggregationSchema>['data'] | undefined,
) {
  const companies = new Map<string, ScarfCompanyHistory>()
  const reports: {
    kind: 'views' | 'previousViews' | 'siteEvents'
    rows: typeof views
  }[] = [
    { kind: 'views', rows: views },
    { kind: 'previousViews', rows: previous },
    { kind: 'siteEvents', rows: events },
  ]
  for (const { kind, rows } of reports) {
    const seen = new Set<string>()
    for (const row of rows ?? []) {
      const domain = row.company_domain?.trim().toLowerCase()
      if (!domain) continue
      if (seen.has(domain))
        throw new Error('Scarf returned duplicate company totals')
      seen.add(domain)
      const company = companies.get(domain) ?? {
        domain,
        name: row.company_name,
        stage: null,
        lastSeen: null,
      }
      company[kind] = row.total
      if (kind === 'views') {
        company.origins = row.unique_origins
        company.endpoints = row.unique_endpoints
        company.stage = row.company_funnel_stage
        company.lastSeen = row.last_seen
      }
      companies.set(domain, company)
    }
  }
  return [...companies.values()]
}
