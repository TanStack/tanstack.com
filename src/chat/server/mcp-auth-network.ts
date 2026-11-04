import { validateMcpEndpoint } from './public-endpoint'

export class McpAuthorizationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
    this.name = 'McpAuthorizationError'
  }
}

/** OAuth metadata may use a query string; credentials and fragments are never allowed. */
export function validateOAuthUrl(raw: string) {
  let url: URL
  try {
    url = new URL(raw)
    const withoutQuery = new URL(url)
    withoutQuery.search = ''
    validateMcpEndpoint(withoutQuery.href)
  } catch {
    throw new McpAuthorizationError(
      'This service supplied an unsupported authorization address.',
    )
  }
  if (url.href.length > 2048)
    throw new McpAuthorizationError(
      'This service supplied an authorization address that is too long.',
    )
  return url.href
}

/** Each phase permits only its own endpoints, methods and credential destinations. */
export function authorizationFetch(
  options: {
    signal?: AbortSignal
    allowedPosts?: string[]
    allowedCredentialUrls?: string[]
    allowedGets?: string[]
    maxBytes?: number
    fetch?: typeof fetch
  } = {},
): typeof fetch {
  let requests = 0
  const permittedPosts = new Set(options.allowedPosts?.map(validateOAuthUrl))
  const credentialUrls = new Set(
    options.allowedCredentialUrls?.map(validateOAuthUrl),
  )
  const permittedGets =
    options.allowedGets && new Set(options.allowedGets.map(validateOAuthUrl))
  const maxBytes = options.maxBytes ?? 128 * 1024
  const phaseSignal = AbortSignal.any([
    ...(options.signal ? [options.signal] : []),
    AbortSignal.timeout(30000),
  ])
  return async (input, init) => {
    if (++requests > 12)
      throw new McpAuthorizationError(
        'This service required too many authorization requests.',
      )
    const request = new Request(input, init)
    const url = validateOAuthUrl(request.url)
    const method = request.method.toUpperCase()
    if (
      (method === 'GET' && permittedGets && !permittedGets.has(url)) ||
      (method === 'POST' && !permittedPosts.has(url)) ||
      !['GET', 'POST'].includes(method)
    )
      throw new McpAuthorizationError(
        'This authorization request is outside the reviewed service addresses.',
      )
    if (
      request.headers.has('cookie') ||
      (request.headers.has('authorization') && !credentialUrls.has(url))
    )
      throw new McpAuthorizationError(
        'Credentials cannot be sent to this authorization address.',
      )
    const response = await (options.fetch ?? fetch)(request, {
      redirect: 'manual',
      signal: AbortSignal.any([phaseSignal, request.signal]),
    })
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel()
      throw new McpAuthorizationError(
        'This service redirected an authorization request. Use its final endpoint.',
      )
    }
    if (Number(response.headers.get('content-length') ?? 0) > maxBytes) {
      await response.body?.cancel()
      throw new McpAuthorizationError(
        'This service returned an authorization response that is too large.',
      )
    }
    if (!response.body) return response
    let bytes = 0
    const bounded = response.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          bytes += chunk.byteLength
          if (bytes > maxBytes)
            throw new McpAuthorizationError(
              'This service returned an authorization response that is too large.',
            )
          controller.enqueue(chunk)
        },
      }),
    )
    return new Response(bounded, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  }
}
