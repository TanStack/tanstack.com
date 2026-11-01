export function validateEndpoint(raw: string) {
  const url = new URL(raw)
  const hostname = url.hostname.replace(/\.$/, '').toLowerCase()
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    url.search ||
    !hostname.includes('.') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    /^[\d.]+$/.test(hostname) ||
    hostname.includes(':')
  )
    throw new Error(
      'Use a public HTTPS API endpoint without credentials or query parameters.',
    )
  return url.href.replace(/\/$/, '')
}

export function validateMcpEndpoint(raw: string) {
  validateEndpoint(raw)
  return new URL(raw).href
}
