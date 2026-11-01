import { z } from 'zod'
import { classifyTraffic } from './traffic-quality'

const diagnosticSchema = z.object({
  quality: z.enum(['automated', 'suspect']),
  webdriver: z.boolean(),
})
const networkSchema = z.object({
  asn: z.number().optional(),
  asOrganization: z.string().optional(),
  country: z.string().optional(),
  botManagement: z
    .object({
      score: z.number().optional(),
      verifiedBot: z.boolean().optional(),
    })
    .optional(),
})

export async function receiveTrafficQuality(request: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  if (request.method !== 'POST')
    return new Response(null, { status: 405, headers })
  const url = new URL(request.url)
  if (
    request.headers.get('origin') !== url.origin ||
    url.hostname !== 'tanstack.com'
  ) {
    return new Response(null, { status: 403, headers })
  }
  if (
    request.headers.get('dnt') === '1' ||
    request.headers.get('sec-gpc') === '1'
  ) {
    return new Response(null, { status: 204, headers })
  }
  // Bound the body even when the client omits Content-Length.
  const reader = request.body?.getReader()
  if (!reader) return new Response(null, { status: 400, headers })
  let raw = ''
  let size = 0
  const decoder = new TextDecoder()
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    size += chunk.value.byteLength
    if (size > 512) {
      await reader.cancel()
      return new Response(null, { status: 413, headers })
    }
    raw += decoder.decode(chunk.value, { stream: true })
  }
  raw += decoder.decode()
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return new Response(null, { status: 400, headers })
  }
  const parsed = diagnosticSchema.safeParse(body)
  const ua = request.headers.get('user-agent') || ''
  if (
    !parsed.success ||
    classifyTraffic({
      userAgent: ua,
      sessionNumber: 1,
      referrer: '',
      url: url.origin,
    }) !== parsed.data.quality
  ) {
    return new Response(null, { status: 400, headers })
  }
  const network = networkSchema.safeParse('cf' in request ? request.cf : {})
  // Network attribution only. Never log the IP, cookies, or GA identifiers.
  console.info('traffic_quality_diagnostic', {
    rule: 'v1',
    quality: parsed.data.quality,
    webdriver: parsed.data.webdriver,
    headless: /HeadlessChrome\//.test(ua),
    chromeMajor: Number(/(?:Chrome|HeadlessChrome)\/(\d+)/.exec(ua)?.[1]),
    ...(network.success ? network.data : {}),
  })
  return new Response(null, { status: 204, headers })
}
