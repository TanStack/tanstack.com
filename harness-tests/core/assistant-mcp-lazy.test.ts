import { expect, it, vi } from 'vitest'
import { chat, maxIterations } from '@tanstack/ai'
import { createCloudflareText } from '@tanstack/ai-cloudflare'
import { assistantMcpTools } from '../../src/chat/server/assistant-mcp-tools'
import type { McpConnection } from '../../src/chat/server/mcp'

it('loads current inventory only when the SDK invokes discovery', async () => {
  const connections: McpConnection[] = []
  const loadConnections = vi.fn(async () => {
    connections.splice(0, connections.length, {
      id: 'current',
      label: 'Current service',
      url: 'https://example.invalid/mcp',
    })
  })
  const tools = assistantMcpTools({
    connections,
    loadConnections,
    catalog: vi.fn(),
    propose: vi.fn(),
    read: vi.fn(),
  })
  expect(loadConnections).not.toHaveBeenCalled()
  let pass = 0
  const fetch = vi.fn(async () => {
    const first = pass++ === 0
    const delta = first
      ? {
          role: 'assistant',
          tool_calls: [
            {
              index: 0,
              id: 'inventory',
              type: 'function',
              function: { name: 'list_connected_tools', arguments: '{}' },
            },
          ],
        }
      : { role: 'assistant', content: 'Finished.' }
    return new Response(
      'data: ' +
        JSON.stringify({
          id: 'synthetic',
          choices: [
            { index: 0, delta, finish_reason: first ? 'tool_calls' : 'stop' },
          ],
        }) +
        '\n\ndata: [DONE]\n\n',
      { headers: { 'Content-Type': 'text/event-stream' } },
    )
  })
  const adapter = createCloudflareText('synthetic', {
    accountId: 'synthetic',
    apiKey: 'synthetic',
    fetch,
  })
  const results: unknown[] = []
  for await (const chunk of chat({
    adapter,
    tools,
    messages: [{ role: 'user', content: 'List my connected services.' }],
    agentLoopStrategy: maxIterations(2),
  })) {
    if (chunk.type === 'TOOL_CALL_RESULT') results.push(chunk.content)
  }
  expect(loadConnections).toHaveBeenCalledOnce()
  expect(JSON.stringify(results)).toContain('Current service')
  expect(fetch).toHaveBeenCalledTimes(2)
})
