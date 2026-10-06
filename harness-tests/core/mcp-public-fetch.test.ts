import { afterEach, expect, it, vi } from 'vitest'
import {
  publicMcpFetch,
  type McpEgressEnvironment,
} from '../../src/chat/server/mcp-public-fetch'

afterEach(() => vi.unstubAllGlobals())
const proxy = 'http://127.0.0.1:12345/_gum_mcp_egress'
const token = 'a'.repeat(43)
const local: McpEgressEnvironment = {
  MCP_EGRESS_URL: proxy,
  MCP_EGRESS_TOKEN: token,
}

it('defaults to disabled instead of assuming the runtime provides public-only egress', () => {
  expect(() => publicMcpFetch({})).toThrow('not enabled')
})
it('requires a trusted deployment assertion and refuses it during Vite development', () => {
  const env = { MCP_EGRESS_MODE: 'cloudflare-public' }
  expect(publicMcpFetch(env)).toBe(fetch)
  vi.stubGlobal('__GUM_LOCAL_DEVELOPMENT__', true)
  expect(() => publicMcpFetch(env)).toThrow('not enabled')
})
it.each([
  { MCP_EGRESS_URL: proxy },
  { MCP_EGRESS_TOKEN: token },
  { MCP_EGRESS_URL: 'https://attacker.example.com', MCP_EGRESS_TOKEN: token },
  {
    MCP_EGRESS_URL: 'http://localhost:12345/_gum_mcp_egress',
    MCP_EGRESS_TOKEN: token,
  },
  { MCP_EGRESS_URL: proxy + '?target=private', MCP_EGRESS_TOKEN: token },
  { MCP_EGRESS_URL: proxy, MCP_EGRESS_TOKEN: 'short' },
])('rejects incomplete or untrusted companion configuration', (env) => {
  expect(() => publicMcpFetch(env)).toThrow('not configured correctly')
})
it('routes a request only to the configured companion and preserves the destination body/auth', async () => {
  const calls: Request[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const request = new Request(input, init)
      calls.push(request)
      return new Response('ok')
    }),
  )
  const adapter = publicMcpFetch(local)
  const response = await adapter('https://auth.example.com/token', {
    method: 'POST',
    body: 'grant_type=synthetic',
    redirect: 'follow',
    headers: {
      Authorization: 'Basic synthetic-client',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
  expect(await response.text()).toBe('ok')
  expect(calls).toHaveLength(1)
  expect(calls[0].url).toBe(proxy)
  expect(calls[0].redirect).toBe('manual')
  expect(calls[0].headers.get('x-gum-egress-target')).toBe(
    'https://auth.example.com/token',
  )
  expect(calls[0].headers.get('x-gum-egress-auth')).toBe(token)
  expect(calls[0].headers.get('authorization')).toBe('Basic synthetic-client')
  expect(await calls[0].text()).toBe('grant_type=synthetic')
})
it('never downgrades a destination to plain HTTP or sends it directly', async () => {
  const transport = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', transport)
  await expect(
    publicMcpFetch(local)('http://tools.example.com/mcp'),
  ).rejects.toThrow('HTTPS')
  expect(transport).not.toHaveBeenCalled()
})
