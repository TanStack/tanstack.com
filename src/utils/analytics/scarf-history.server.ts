import { libraries } from '~/libraries/libraries'
import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import { getDefaultRuntimeCache } from '~/server/runtime/blob-storage.server'
import { homepageScarfPixel, productScarfPixels } from './scarf-pixels'
import {
  companyHistoryFromReports,
  historyWindow,
  scarfAggregationRowSchema,
  type ScarfAggregationRow,
  scarfHistorySchema,
  type ScarfHistory,
} from './scarf-history'

// This is the event-only /site-events route verified in Scarf's package settings.
const siteTelemetryPackage = 'b942b596-f90d-4072-a763-86fb5fbe5852'
const sitePixels = [
  ...new Set([
    homepageScarfPixel,
    ...productScarfPixels.map((pixel) => pixel.id),
    ...libraries.flatMap((library) =>
      library.scarfId ? [library.scarfId] : [],
    ),
  ]),
]

export function scarfReportUrl(
  start: string,
  end: string,
  source: 'views' | 'events',
) {
  const url = new URL(
    'https://api.scarf.sh/v3/insights/TanStack/aggregations/export',
  )
  for (const [key, value] of Object.entries({
    start_date: start,
    end_date: end,
    rollup: 'total',
    breakdown: 'by-company',
    format: 'ndjson',
    group_by_artifact: 'false',
    group_by_artifact_type: 'false',
    include_low_confidence: 'false',
  }))
    url.searchParams.set(key, value)
  url.searchParams.set(
    'package_id',
    source === 'events' ? siteTelemetryPackage : 'none',
  )
  if (source === 'views')
    for (const id of sitePixels)
      url.searchParams.append('tracking_pixel_id', id)
  else url.searchParams.set('tracking_pixel_id', 'none')
  return url
}

class ScarfReportError extends Error {
  constructor(readonly detail: string) {
    super(detail)
  }
}

async function report(
  start: string,
  end: string,
  source: 'views' | 'events',
  token: string,
) {
  const response = await fetch(scarfReportUrl(start, end, source), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/x-ndjson',
    },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new ScarfReportError(`HTTP ${response.status}`)
  }
  const rows: ScarfAggregationRow[] = []
  const reader = response.body?.getReader()
  if (!reader) throw new ScarfReportError('empty response')
  const decoder = new TextDecoder()
  let buffer = ''
  let bytes = 0
  const addRow = (line: string) => {
    if (!line.trim()) return
    if (rows.length >= 50_000)
      throw new ScarfReportError('export too large; choose a shorter window')
    rows.push(scarfAggregationRowSchema.parse(JSON.parse(line)))
  }
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > 100 * 1024 * 1024)
        throw new ScarfReportError('export too large; choose a shorter window')
      buffer += decoder.decode(chunk.value, { stream: true })
      let end = buffer.indexOf('\n')
      while (end !== -1) {
        addRow(buffer.slice(0, end))
        buffer = buffer.slice(end + 1)
        end = buffer.indexOf('\n')
      }
      if (buffer.length > 64_000)
        throw new ScarfReportError('invalid export row')
    }
    buffer += decoder.decode()
    addRow(buffer)
    return rows
  } catch (error) {
    await reader.cancel()
    throw error
  } finally {
    reader.releaseLock()
  }
}

export async function loadScarfHistory(
  days: ScarfHistory['days'],
): Promise<ScarfHistory> {
  const window = historyWindow(days)
  const base = {
    days,
    start: window.start,
    end: window.end,
    fetchedAt: new Date().toISOString(),
    companies: [],
    issues: [],
  }
  const host = await getHostRuntimeEnv()
  const token =
    host?.ANALYTICS_SCARF_API_TOKEN ?? process.env.ANALYTICS_SCARF_API_TOKEN
  if (typeof token !== 'string' || !token)
    return { ...base, status: 'unconfigured' }
  const cache = getDefaultRuntimeCache()
  const cacheKey = new Request(
    `https://scarf-reporting.tanstack.internal/site-history/v1/${days}/${window.end}`,
  )
  const cached = await cache?.match(cacheKey).catch(() => undefined)
  if (cached) {
    const parsed = scarfHistorySchema.safeParse(await cached.json())
    if (parsed.success) return parsed.data
  }
  const results = await Promise.allSettled([
    report(window.start, window.end, 'views', token),
    report(window.previousStart, window.start, 'views', token),
    report(window.start, window.end, 'events', token),
  ])
  const data = results.map((result) =>
    result.status === 'fulfilled' ? result.value : undefined,
  )
  const issues = results.flatMap((result, index) =>
    result.status === 'fulfilled'
      ? []
      : [
          `${['Site pixel views', 'Previous period', 'Site events'][index]} unavailable${result.reason instanceof ScarfReportError ? ` (${result.reason.detail})` : ' (unexpected response or timeout)'}. Check Scarf reporting access or try again later.`,
        ],
  )
  let companies: ScarfHistory['companies'] = []
  try {
    companies = companyHistoryFromReports(data[0], data[1], data[2])
  } catch {
    issues.push(
      'Scarf returned inconsistent company totals. History is unavailable.',
    )
  }
  const history: ScarfHistory = {
    ...base,
    companies,
    issues,
    status: issues.length
      ? companies.length
        ? 'partial'
        : 'unavailable'
      : 'ready',
  }
  // Cache aggregate company metrics only, never credentials or source-level data.
  await cache
    ?.put(
      cacheKey,
      new Response(JSON.stringify(history), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `max-age=${history.status === 'ready' ? 900 : 60}`,
        },
      }),
    )
    .catch(() => undefined)
  return history
}
