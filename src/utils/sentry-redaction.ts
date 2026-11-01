type EventWithRequestHeaders = {
  request?: {
    headers?: Record<string, string>
    url?: string
    data?: unknown
    cookies?: unknown
  }
  tags?: Record<string, unknown>
  user?: unknown
  extra?: unknown
  contexts?: unknown
  breadcrumbs?: unknown
  message?: string
  exception?: { values?: { value?: string }[] }
}

export function redactByokRequestHeaders<
  TEvent extends EventWithRequestHeaders,
>(event: TEvent) {
  if (event.request) {
    delete event.request.cookies
    for (const name of Object.keys(event.request.headers ?? {})) {
      if (
        name.toLowerCase() === 'cookie' ||
        name.toLowerCase() === 'set-cookie'
      )
        delete event.request.headers?.[name]
    }
  }
  const path = event.request?.url
    ? new URL(event.request.url, 'https://tanstack.com').pathname
    : ''
  if (
    path === '/_a/live' ||
    path === '/_a/visitor-chat' ||
    event.tags?.['visitor-chat'] === 'true'
  ) {
    if (event.request) {
      delete event.request.data
      delete event.request.cookies
      delete event.request.headers
      if (event.request.url) event.request.url = event.request.url.split('?')[0]
    }
    delete event.user
    delete event.extra
    delete event.contexts
    delete event.breadcrumbs
    if (event.message) event.message = 'Visitor chat request failed'
    for (const exception of event.exception?.values ?? [])
      exception.value = 'Visitor chat request failed'
    return event
  }
  const headers = event.request?.headers
  if (!headers) return event

  for (const name of Object.keys(headers)) {
    if (name.toLowerCase().startsWith('x-byok-')) delete headers[name]
  }

  return event
}
