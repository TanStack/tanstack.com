// Server requests and browser page views are separate measurements. Never emit
// page_view here or add these counts to pixel views to calculate unique visitors.
export function createScarfServerRequest(request: Request, response: Response) {
  const url = new URL(request.url)
  const clientIp = request.headers.get('cf-connecting-ip')
  if (
    url.hostname !== 'tanstack.com' ||
    request.method !== 'GET' ||
    !response.ok ||
    !clientIp ||
    request.headers.get('dnt') === '1' ||
    request.headers.get('sec-gpc') === '1'
  ) {
    return null
  }

  // Keep account, application, and internal requests out of content analytics.
  if (
    /^\/(?:api|_a|_server|admin|account|auth|oauth|login|dashboard|chat|chat-access)(?:\/|$)/.test(
      url.pathname,
    ) ||
    url.pathname.startsWith('/builder/')
  ) {
    return null
  }

  const contentType = response.headers.get('content-type')?.split(';')[0].trim()
  const isMarkdown = contentType === 'text/markdown'
  const isAgentText =
    contentType === 'text/plain' &&
    (url.pathname.endsWith('.md') ||
      /\/llms(?:-full)?\.txt$/.test(url.pathname))
  if (contentType !== 'text/html' && !isMarkdown && !isAgentText) return null

  const eventUrl = new URL('https://tanstack.gateway.scarf.sh/site-events')
  eventUrl.searchParams.set('event', 'server_request')
  eventUrl.searchParams.set('source', 'worker')
  eventUrl.searchParams.set('page', url.pathname)
  eventUrl.searchParams.set(
    'format',
    contentType === 'text/html' ? 'html' : 'markdown',
  )
  eventUrl.searchParams.set('status', String(response.status))
  let trafficType = 'unknown'
  if (
    'cf' in request &&
    typeof request.cf === 'object' &&
    request.cf !== null
  ) {
    const cf = request.cf
    if (
      'botManagement' in cf &&
      typeof cf.botManagement === 'object' &&
      cf.botManagement !== null
    ) {
      const bot = cf.botManagement
      const score =
        'score' in bot && typeof bot.score === 'number' ? bot.score : 0
      if ('verifiedBot' in bot && bot.verifiedBot === true) {
        trafficType = 'verified_bot'
      } else if (score >= 1 && score <= 99) {
        trafficType = score < 30 ? 'suspected_bot' : 'likely_human'
      }
    }
  }
  eventUrl.searchParams.set('traffic_type', trafficType)

  const headers = new Headers({ 'X-Scarf-IP': clientIp })
  for (const name of ['user-agent', 'dnt', 'sec-gpc']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  return new Request(eventUrl, { method: 'POST', headers })
}

export async function sendScarfServerRequest(request: Request) {
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(5000) })
    await response.body?.cancel()
    if (!response.ok) {
      console.warn('Scarf server tracking failed', { status: response.status })
    }
  } catch {
    // Do not log the request, which carries the visitor's IP address.
    console.warn('Scarf server tracking failed')
  }
}
