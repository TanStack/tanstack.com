import { chat, maxIterations } from '@tanstack/ai'
import { createCloudflareText } from '@tanstack/ai-cloudflare'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assistantMcpTools } from '../../src/chat/server/assistant-mcp-tools'
import type { McpConnection } from '../../src/chat/server/mcp'
import type { ServerCatalog } from '../../src/chat/server/mcp-catalog'

const permitted: McpConnection[] = [
  {
    id: 'first-opaque-id',
    label: 'Example service',
    url: 'https://first.example.invalid/mcp',
    accessToken: 'synthetic-first-token',
  },
  {
    id: 'second-opaque-id',
    label: 'Example service',
    url: 'https://second.example.invalid/mcp',
    accessToken: 'synthetic-second-token',
  },
]

type Request = {
  tools: Array<{
    function: {
      name: string
      strict: boolean
      parameters: {
        required: string[]
        properties: Record<string, { type: string[]; description?: string }>
      }
    }
  }>
  messages: Array<{ role: string; content?: unknown }>
}
type Step =
  | Record<string, unknown>
  | ((request: Request) => Record<string, unknown>)

afterEach(() => vi.unstubAllGlobals())

function lastToolResult(request: Request) {
  const message = request.messages.filter((item) => item.role === 'tool').at(-1)
  return JSON.parse(message!.content as string)
}

/** Uses the installed adapter/parser/loop, with only the provider and MCP IO replaced. */
async function discovery(steps: Step[]) {
  const network = vi.fn(async () => {
    throw new Error('Network is forbidden in the discovery contract test.')
  })
  vi.stubGlobal('fetch', network)
  const catalog = vi.fn(
    async (
      connection: McpConnection,
      _refresh: boolean,
    ): Promise<ServerCatalog> => ({
      serverId: connection.id,
      entries: [],
      fetchedAt: 1,
      complete: true,
      scope: 'server-advertised',
      warnings: [],
    }),
  )
  const propose = vi.fn(),
    read = vi.fn()
  const tools = assistantMcpTools({
    connections: permitted,
    catalog,
    propose,
    read,
  })
  const requests: Request[] = []
  const catalogCounts: number[] = []
  const outcomes: Array<{ ok: boolean; error?: string; result?: unknown }> = []
  const run = vi.fn(async (_model: string, request: Request) => {
    const pass = requests.length
    if (pass > steps.length) throw new Error('Unexpected provider request.')
    requests.push(request)
    catalogCounts.push(catalog.mock.calls.length)
    const step = steps[pass]
    const input = typeof step === 'function' ? step(request) : step
    const frame = (delta: unknown, finish_reason: string | null = null) =>
      'data: ' +
      JSON.stringify({
        id: `completion-${pass}`,
        object: 'chat.completion.chunk',
        created: 1,
        model: '@cf/zai-org/glm-5.3-flash',
        choices: [{ index: 0, delta, finish_reason }],
      }) +
      '\n\n'
    let body: string
    if (input === undefined) {
      body =
        frame({ role: 'assistant', content: 'Synthetic discovery finished.' }) +
        frame({}, 'stop')
    } else {
      const args = JSON.stringify(input)
      const split = Math.floor(args.length / 2)
      body =
        frame({
          role: 'assistant',
          tool_calls: [
            {
              index: 0,
              id: `call-${pass}`,
              type: 'function',
              function: {
                name: 'list_connected_tools',
                arguments: args.slice(0, split),
              },
            },
          ],
        }) +
        frame({
          tool_calls: [
            { index: 0, function: { arguments: args.slice(split) } },
          ],
        }) +
        frame({}, 'tool_calls')
    }
    return new Response(body + 'data: [DONE]\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  })
  for await (const _chunk of chat({
    adapter: createCloudflareText('@cf/zai-org/glm-5.3-flash', {
      binding: { run } as never,
    }),
    messages: [{ role: 'user', content: 'Discover my permitted tools.' }],
    tools,
    agentLoopStrategy: maxIterations(6),
    middleware: [
      {
        name: 'capture-discovery-outcomes',
        onAfterToolCall: (_context, tool) => {
          outcomes.push({
            ok: tool.ok,
            result: tool.result,
            error: tool.error instanceof Error ? tool.error.message : undefined,
          })
        },
      },
    ],
  })) {
    // Drain the real SDK stream so its normal tool loop runs to completion.
  }
  expect(network).not.toHaveBeenCalled()
  expect(propose).not.toHaveBeenCalled()
  expect(read).not.toHaveBeenCalled()
  expect(run).toHaveBeenCalledTimes(steps.length + 1)
  return { requests, catalog, catalogCounts, outcomes }
}

describe('MCP discovery through the provider schema boundary', () => {
  it('describes exact returned server IDs and how to list permitted connections', async () => {
    const { requests } = await discovery([])
    const tool = requests[0].tools.find(
      (item) => item.function.name === 'list_connected_tools',
    )!
    const description =
      tool.function.parameters.properties.serverId.description ?? ''
    expect(description).toMatch(
      /exact.*(?:returned|listed)|(?:returned|listed).*exact/i,
    )
    expect(description).toMatch(/omit|without/i)
    expect(description).toMatch(/null/i)
    expect(description).toMatch(/list|discover/i)
  })

  it.each([{ serverId: null, offset: null, refresh: null }, {}])(
    'lists only the supplied permitted inventory for %j',
    async (input) => {
      const { requests, catalog, outcomes } = await discovery([input])
      const tool = requests[0].tools.find(
        (item) => item.function.name === 'list_connected_tools',
      )!
      expect(tool.function.strict).toBe(true)
      expect(tool.function.parameters.required).toEqual([
        'serverId',
        'offset',
        'refresh',
      ])
      expect(tool.function.parameters.properties.serverId.type).toEqual([
        'string',
        'null',
      ])
      expect(outcomes).toEqual([
        {
          ok: true,
          result: {
            servers: permitted.map(({ id, label }) => ({ id, label })),
          },
          error: undefined,
        },
      ])
      expect(lastToolResult(requests[1])).toEqual({
        servers: permitted.map(({ id, label }) => ({ id, label })),
      })
      expect(catalog).not.toHaveBeenCalled()
    },
  )

  it('recovers a label guessed as an ID by listing connections then using an exact returned ID', async () => {
    const { requests, catalog, catalogCounts, outcomes } = await discovery([
      { serverId: 'Example service', offset: 0, refresh: false },
      { serverId: null, offset: 0, refresh: false },
      (request) => ({
        serverId: lastToolResult(request).servers[1].id,
        offset: 0,
        refresh: false,
      }),
    ])
    expect(catalogCounts).toEqual([0, 0, 0, 1])
    expect(catalog).toHaveBeenCalledExactlyOnceWith(permitted[1], false)
    expect(outcomes.map((outcome) => outcome.ok)).toEqual([false, true, true])
    expect(lastToolResult(requests[2])).toEqual({
      servers: permitted.map(({ id, label }) => ({ id, label })),
    })
    expect(lastToolResult(requests[3])).toMatchObject({
      entries: [],
      complete: true,
    })
    const { error } = lastToolResult(requests[1])
    expect(error).toMatch(/list_connected_tools/i)
    expect(error).toMatch(/without (?:a )?serverId/i)
    expect(error).toMatch(/permitted/i)
    expect(error).not.toMatch(
      /(?:all|no) (?:MCP )?(?:servers|connections).*connect/i,
    )
  })
})
