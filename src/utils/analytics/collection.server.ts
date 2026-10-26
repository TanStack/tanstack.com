import { z } from 'zod'

const networkSchema = z.object({
  asn: z.number().optional(),
  botManagement: z
    .object({
      score: z.number().optional(),
      verifiedBot: z.boolean().optional(),
      corporateProxy: z.boolean().optional(),
    })
    .optional(),
})

// Hosting networks, not a list of proven bots. VPN users can share these ASNs.
const datacenterASNs = new Set([
  16509, 14618, 396982, 8075, 14061, 16276, 24940,
])

export function getNetworkTrafficQuality(request: Request) {
  const parsed = networkSchema.safeParse('cf' in request ? request.cf : {})
  if (!parsed.success) return undefined
  const { asn, botManagement: bot } = parsed.data
  if (bot?.verifiedBot || bot?.score === 1) return 'automated'
  if (bot?.corporateProxy || (asn !== undefined && datacenterASNs.has(asn)))
    return 'datacenter'
  if (bot?.score !== undefined && bot.score >= 2 && bot.score < 30)
    return 'suspect'
  return undefined
}

export function labelAnalyticsCollection(
  params: URLSearchParams,
  networkQuality: ReturnType<typeof getNetworkTrafficQuality>,
  sharedQuality: string | null = null,
) {
  const clientQuality = params.get('ep.traffic_quality') ?? sharedQuality
  if (networkQuality && clientQuality !== 'automated') {
    params.set('ep.traffic_quality', networkQuality)
  }
  params.set('ep.traffic_quality_rule', 'v2')
  // Automatic GA events also carry the document URL. Normalize at collection
  // so chart state never leaks through scroll, engagement, or click events.
  const location = params.get('dl')
  if (location) {
    try {
      const url = new URL(location)
      if (
        url.pathname === '/stats/npm' ||
        url.pathname.startsWith('/stats/npm/')
      ) {
        params.set('dl', url.origin + url.pathname)
      }
    } catch {
      // Preserve malformed upstream values rather than breaking collection.
    }
  }
  return params
}
