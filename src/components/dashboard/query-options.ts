import { queryOptions } from '@tanstack/react-query'
import { snapshotSchema } from './model'
import { serverRequestSchema, type ServerRequest } from './request'
import { fetchDashboard } from './functions'

const dataset = 'green-2025-week1.v1'
// Keep query dependencies and the transport parameters together, including
// selection because the response contains selection aggregates.
export function dashboardKey(
  request: ServerRequest,
): readonly ['dashboard', string, 'server', ServerRequest] {
  return [
    'dashboard',
    dataset,
    'server',
    {
      ...request,
      selection: {
        ...request.selection,
        ids: [...request.selection.ids].sort((a, b) => a - b),
      },
    },
  ]
}
export function dashboardOptions(input: ServerRequest) {
  return queryOptions({
    queryKey: dashboardKey(serverRequestSchema.parse(input)),
    queryFn: ({ queryKey, signal }) =>
      fetchDashboard({ data: queryKey[3], signal }),
    staleTime: 30_000,
  })
}

export const snapshotOptions = queryOptions({
  queryKey: ['dashboard', dataset, 'snapshot'],
  staleTime: Infinity,
  queryFn: async ({ signal }) => {
    const start = performance.now()
    const response = await fetch('/data/dashboard/green-2025-week1.v1.json', {
      signal,
    })
    if (!response.ok)
      throw new Error(`Snapshot request failed (${response.status})`)
    const text = await response.text()
    const fetched = performance.now()
    const snapshot = snapshotSchema.parse(JSON.parse(text))
    const parsed = performance.now()
    performance.measure('dashboard:fetch', { start, end: fetched })
    performance.measure('dashboard:parse-and-validate', {
      start: fetched,
      end: parsed,
    })
    return snapshot
  },
})
