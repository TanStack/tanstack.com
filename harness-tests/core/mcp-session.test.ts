import { expect, it } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { fetchMcpCatalog } from '../../src/chat/server/mcp-catalog'
import {
  mcpCall,
  type McpClientOptions,
  type McpSessionState,
} from '../../src/chat/server/mcp'

async function fixture() {
  const servers = new Map<
    string,
    { server: McpServer; transport: WebStandardStreamableHTTPServerTransport }
  >()
  let initialized = 0
  let invoked = 0
  const fetchLocal: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    const session = request.headers.get('mcp-session-id')
    if (session)
      return (
        servers.get(session)?.transport.handleRequest(request) ??
        new Response('Expired', { status: 404 })
      )
    if (request.method !== 'POST')
      return new Response('No session', { status: 400 })
    const body = (await request.clone().json()) as { method: string }
    if (body.method !== 'initialize')
      return new Response('Initialize first', { status: 400 })
    initialized++
    const server = new McpServer({ name: 'session-test', version: '1' })
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableJsonResponse: true,
    })
    const leaf = server.registerTool(
      'read_activity',
      { description: 'Read activity', inputSchema: {} },
      async () => ({ content: [{ type: 'text', text: 'Activity' }] }),
    )
    leaf.disable()
    server.registerTool(
      'discover',
      { description: 'Discover activity tools', inputSchema: {} },
      async () => {
        invoked++
        leaf.enable()
        return { content: [{ type: 'text', text: 'Discovered' }] }
      },
    )
    await server.connect(transport)
    const response = await transport.handleRequest(request)
    servers.set(transport.sessionId!, { server, transport })
    return response
  }
  let serialized: string | undefined
  const options: McpClientOptions = {
    fetch: fetchLocal,
    session: {
      load: async () => (serialized ? JSON.parse(serialized) : undefined),
      save: async (state) => {
        serialized = state ? JSON.stringify(state) : undefined
      },
    },
  }
  return {
    options,
    saved: () =>
      serialized ? (JSON.parse(serialized) as McpSessionState) : undefined,
    counts: () => ({ initialized, invoked }),
    expire: async () => {
      for (const { server } of servers.values()) await server.close()
      servers.clear()
    },
    close: async () => {
      for (const { server } of servers.values()) await server.close()
    },
  }
}
const connection = {
  id: 'test',
  label: 'Test',
  url: 'https://mcp.test/mcp',
  accessToken: 'credential-A',
}
const signal = () => AbortSignal.timeout(10000)
it('preserves session-scoped discovery and catalog capabilities across recreated clients', async () => {
  const f = await fixture()
  try {
    expect(
      (await fetchMcpCatalog(connection, signal(), f.options)).entries.map(
        (e) => e.name,
      ),
    ).toEqual(['discover'])
    await mcpCall(connection, 'discover', {}, signal(), f.options)
    const catalog = await fetchMcpCatalog(connection, signal(), f.options)
    expect(catalog.entries.map((e) => e.name)).toEqual([
      'read_activity',
      'discover',
    ])
    expect(
      (await mcpCall(connection, 'read_activity', {}, signal(), f.options))
        .isError,
    ).not.toBe(true)
    expect(f.counts()).toEqual({ initialized: 1, invoked: 1 })
    expect(f.saved()?.capabilities.tools).toBeDefined()
    expect(JSON.stringify(f.saved())).not.toContain('credential-A')
  } finally {
    await f.close()
  }
})
it.each([
  { accessToken: 'credential-B' },
  { url: 'https://other.test/mcp' },
  { id: 'other' },
])(
  'does not reuse session metadata after changing connection %j',
  async (change) => {
    const f = await fixture()
    try {
      await mcpCall(connection, 'discover', {}, signal(), f.options)
      const original = f.saved()!.sessionId
      const catalog = await fetchMcpCatalog(
        { ...connection, ...change },
        signal(),
        f.options,
      )
      expect(catalog.entries.map((e) => e.name)).toEqual(['discover'])
      expect(f.saved()!.sessionId).not.toBe(original)
      expect(f.counts().initialized).toBe(2)
    } finally {
      await f.close()
    }
  },
)
it('does not reinitialize or replay a call after the saved session expires', async () => {
  const f = await fixture()
  try {
    await mcpCall(connection, 'discover', {}, signal(), f.options)
    await f.expire()
    await expect(
      mcpCall(connection, 'discover', {}, signal(), f.options),
    ).rejects.toThrow()
    expect(f.counts()).toEqual({ initialized: 1, invoked: 1 })
  } finally {
    await f.close()
  }
})
it('does not execute work if newly negotiated session metadata cannot be saved', async () => {
  const f = await fixture()
  try {
    await expect(
      mcpCall(connection, 'discover', {}, signal(), {
        ...f.options,
        session: {
          load: async () => undefined,
          save: async () => {
            throw new Error('Storage unavailable')
          },
        },
      }),
    ).rejects.toThrow('Storage unavailable')
    expect(f.counts().invoked).toBe(0)
  } finally {
    await f.close()
  }
})
it('fails closed on corrupt saved metadata instead of silently initializing a replacement', async () => {
  const f = await fixture()
  try {
    await expect(
      mcpCall(connection, 'discover', {}, signal(), {
        ...f.options,
        session: {
          load: async () => ({ sessionId: 'incomplete' }),
          save: async () => {},
        },
      }),
    ).rejects.toThrow('metadata is invalid')
    expect(f.counts()).toEqual({ initialized: 0, invoked: 0 })
  } finally {
    await f.close()
  }
})
