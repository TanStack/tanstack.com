import { z } from 'zod'
import { dashboardSearch } from '../model'
import type { ServerRequest } from '../request'
import { rowSchema, type DashboardResult } from './queries'
import {
  getBlobStorage,
  getBlobStorageCache,
  type BlobStorage,
} from '~/server/runtime/blob-storage.server'

export const dashboardAssetPrefix = 'green-2025-week1.v1'
const total = z.object({ count: z.number(), fareCents: z.number() })
const cachedResult = z.object({
  analysis: z.object({
    timeline: z.array(
      z.object({ index: z.number(), day: z.number(), count: z.number() }),
    ),
    days: z.array(z.object({ day: z.number(), count: z.number() })),
    hours: z.array(z.object({ hour: z.number(), count: z.number() })),
    durations: z.array(z.object({ label: z.string(), count: z.number() })),
    zones: z.array(
      z.object({ id: z.number(), name: z.string(), count: z.number() }),
    ),
    summary: total,
    medianMinutes: z.number(),
    averageMiles: z.number(),
  }),
  rows: z.array(rowSchema),
  rowCount: z.number(),
  page: z.number(),
  total: total.extend({ median: z.number(), average: z.number() }),
  parent: total,
  selectedTotals: total,
  boroughFacets: z.array(z.object({ value: z.string(), count: z.number() })),
  allZones: z.array(
    z.object({ id: z.number(), name: z.string(), borough: z.string() }),
  ),
  selectedMatches: z.boolean(),
  snapshotCount: z.number(),
})

// A finite set: 8 days x 8 boroughs x 3 pages x 4 sizes = at most 768 objects.
// Search strings, selection IDs, zones, and arbitrary sort combinations never become R2 keys.
export function dashboardCacheKey(input: ServerRequest) {
  if (
    input.zone ||
    input.selected ||
    input.selection.all ||
    input.selection.ids.length ||
    input.grid.query ||
    input.grid.filters.length ||
    input.grid.group ||
    input.grid.page > 2 ||
    input.grid.sorting.length !== 1 ||
    input.grid.sorting[0].id !== 'pickup' ||
    input.grid.sorting[0].desc ||
    dashboardSearch.shape.borough.parse(input.borough) !== input.borough
  )
    return undefined
  return `responses/v1/${dashboardAssetPrefix}/${input.day}/${encodeURIComponent(input.borough)}/${input.grid.size}/${input.grid.page}.json`
}

export async function withDashboardCache(
  input: ServerRequest,
  storage: BlobStorage | undefined,
  read: () => Promise<DashboardResult>,
): Promise<DashboardResult> {
  const key = dashboardCacheKey(input)
  if (!key || !storage) return read()
  const edge = getBlobStorageCache('dashboardDemo')
  try {
    const local = await edge?.get(key)
    const text = local?.text ?? (await (await storage.get(key))?.text())
    if (text) {
      const result = cachedResult.parse(JSON.parse(text))
      if (!local) await edge?.put(key, { text, metadata: {} })
      console.info(JSON.stringify({ event: 'dashboard.cache', result: 'hit' }))
      return { ...result, selected: undefined }
    }
  } catch {
    console.warn(
      JSON.stringify({ event: 'dashboard.cache', result: 'read-error' }),
    )
  }
  const result = await read()
  const text = JSON.stringify(result)
  try {
    await storage.put(key, text, {
      contentType: 'application/json',
    })
    await edge?.put(key, { text, metadata: {} })
  } catch {
    console.warn(
      JSON.stringify({ event: 'dashboard.cache', result: 'write-error' }),
    )
  }
  console.info(JSON.stringify({ event: 'dashboard.cache', result: 'miss' }))
  return result
}

export async function dashboardStorage() {
  return getBlobStorage('dashboardDemo')
}
