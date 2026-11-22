import { randomBytes } from 'node:crypto'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'

// This companion has one outgoing capability: workerd's public-only network.
// It does not use Miniflare's unrestricted default global fetch.
export const localMcpEgressWorker = `
export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== '/_gum_mcp_egress' ||
        request.headers.get('x-gum-egress-auth') !== env.PROXY_TOKEN)
      return new Response('Not found', { status: 404 });
    let destination;
    try {
      destination = new URL(request.headers.get('x-gum-egress-target'));
      if (destination.protocol !== 'https:' || destination.username ||
          destination.password || destination.hash) throw Error();
    } catch {
      return new Response('Unsupported MCP destination', { status: 400 });
    }
    const headers = new Headers(request.headers);
    for (const name of [...headers.keys()]) {
      if (name.startsWith('x-gum-egress-') || name.startsWith('cf-') ||
          name.startsWith('x-forwarded-') ||
          ['host', 'connection', 'content-length', 'cookie'].includes(name)) headers.delete(name);
    }
    try {
      return await env.PUBLIC_NETWORK.fetch(destination.href, {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'manual',
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(100000)]),
      });
    } catch {
      return new Response('The public MCP destination could not be reached.', { status: 502 });
    }
  }
};
`

export async function startLocalMcpEgress() {
  const token = randomBytes(32).toString('base64url')
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      host: '127.0.0.1',
      port: 0,
      inspectorPort: 0,
      cf: false,
      modules: true,
      script: localMcpEgressWorker,
      compatibilityDate: '2026-09-21',
      bindings: { PROXY_TOKEN: token },
      serviceBindings: {
        PUBLIC_NETWORK: {
          network: {
            allow: ['public'],
            tlsOptions: { trustBrowserCas: true },
          },
        },
      },
    }),
  )
  try {
    const address = await runtime.ready
    let disposal: Promise<void> | undefined
    return {
      vars: {
        MCP_EGRESS_URL: new URL('/_gum_mcp_egress', address).href,
        MCP_EGRESS_TOKEN: token,
      },
      dispose: () => (disposal ??= runtime.dispose()),
    }
  } catch (error) {
    await runtime.dispose()
    throw error
  }
}
