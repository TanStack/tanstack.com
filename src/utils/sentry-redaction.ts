type EventWithRequestHeaders = {
  request?: {
    headers?: Record<string, string>
  }
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
