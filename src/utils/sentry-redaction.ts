type EventWithRequestHeaders = {
  request?: {
    headers?: Record<string, string>
  }
}

type EventHintWithOriginalException = {
  originalException?: unknown
}

export function redactByokRequestHeaders<
  TEvent extends EventWithRequestHeaders,
>(event: TEvent) {
  const headers = event.request?.headers
  if (!headers) return event

  for (const name of Object.keys(headers)) {
    if (name.toLowerCase().startsWith('x-byok-')) delete headers[name]
  }

  return event
}

/**
 * TanStack Router/Start throws `notFound()` and `redirect()` objects as
 * control flow. They are not real errors and should never be reported.
 */
export function isRouterControlFlow(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as { isNotFound?: unknown; isRedirect?: unknown }
  return candidate.isNotFound === true || candidate.isRedirect === true
}

export function filterSentryEvent<TEvent extends EventWithRequestHeaders>(
  event: TEvent,
  hint?: EventHintWithOriginalException,
): TEvent | null {
  if (isRouterControlFlow(hint?.originalException)) return null
  return redactByokRequestHeaders(event)
}
