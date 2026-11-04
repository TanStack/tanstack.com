import { afterAll, beforeAll, expect, it } from 'vitest'
import {
  Miniflare,
  Response as RuntimeResponse,
  convertV4MiniflareOptions,
} from 'miniflare'
import { localMcpEgressWorker } from '../../scripts/local-mcp-egress'

let runtime: Miniflare
const received: {
  url: string
  method: string
  headers: Record<string, string>
  body: string
  redirect: string
}[] = []
beforeAll(async () => {
  runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: localMcpEgressWorker,
      compatibilityDate: '2026-09-21',
      cf: false,
      host: '127.0.0.1',
      port: 0,
      inspectorPort: 0,
      bindings: { PROXY_TOKEN: 'synthetic-companion-secret' },
      serviceBindings: {
        PUBLIC_NETWORK: async (request) => {
          received.push({
            url: request.url,
            method: request.method,
            headers: Object.fromEntries(request.headers),
            body: await request.text(),
            redirect: request.redirect,
          })
          return new RuntimeResponse(null, {
            status: 302,
            headers: { Location: 'https://other.example.com' },
          })
        },
      },
    }),
  )
  await runtime.ready
})
afterAll(async () => {
  await runtime?.dispose()
})

it('does not contact a destination until the local companion secret matches', async () => {
  const response = await runtime.dispatchFetch(
    'http://localhost/_gum_mcp_egress',
    {
      headers: { 'x-gum-egress-target': 'https://tools.example.com/mcp' },
    },
  )
  expect(response.status).toBe(404)
  expect(received).toHaveLength(0)
})
it('removes companion and local request headers while preserving the intended resource authorization and body', async () => {
  const response = await runtime.dispatchFetch(
    'http://localhost/_gum_mcp_egress',
    {
      method: 'POST',
      redirect: 'manual',
      body: 'synthetic OAuth body',
      headers: {
        'x-gum-egress-target': 'https://tools.example.com/mcp',
        'x-gum-egress-auth': 'synthetic-companion-secret',
        'x-gum-egress-injected': 'not-upstream',
        'x-forwarded-host': 'private.local',
        Cookie: 'gum_session=not-upstream',
        Authorization: 'Bearer synthetic-resource-token',
        'Content-Type': 'application/json',
      },
    },
  )
  expect(response.status).toBe(302)
  expect(response.headers.get('location')).toBe('https://other.example.com')
  expect(received).toHaveLength(1)
  expect(received[0]).toMatchObject({
    url: 'https://tools.example.com/mcp',
    method: 'POST',
    body: 'synthetic OAuth body',
    headers: {
      authorization: 'Bearer synthetic-resource-token',
      'content-type': 'application/json',
    },
  })
  expect(
    Object.keys(received[0].headers).some(
      (key) =>
        key.startsWith('x-gum-egress-') || key.startsWith('x-forwarded-'),
    ),
  ).toBe(false)
  expect(received[0].headers.cookie).toBeUndefined()
  expect(JSON.stringify(received[0])).not.toContain(
    'synthetic-companion-secret',
  )
})
