import { expect, it, vi } from 'vitest'
import { chat, maxIterations } from '@tanstack/ai'
import { assistantMcpTools } from '../../src/chat/server/assistant-mcp-tools'
import type { CatalogEntry } from '../../src/chat/server/mcp-catalog'

it.each(['prompt', 'resource', 'resource-template'] as const)(
  'forwards actual TanStack tool-call context for %s reads',
  async (kind) => {
    const entry: CatalogEntry = {
      id: 'entry',
      serverId: 'server',
      serverLabel: 'Source',
      name: 'read',
      title: 'Read',
      description: 'Synthetic',
      kind,
      target:
        kind === 'prompt'
          ? { method: 'prompts/get', name: 'read' }
          : kind === 'resource'
            ? { method: 'resources/read', uri: 'test://plain' }
            : { method: 'resources/read', uriTemplate: 'test://items/{id}' },
      ...(kind === 'prompt'
        ? { arguments: [{ name: 'id', required: true }] }
        : {}),
    }
    const read = vi.fn(async () => ({ text: 'evidence' }))
    const tools = assistantMcpTools({
      connections: [
        { id: 'server', label: 'Source', url: 'https://example.com/mcp' },
      ],
      selectedTools: [entry],
      catalog: vi.fn(),
      propose: vi.fn(),
      read,
    })
    const supplied = kind === 'resource' ? {} : { id: 'item' }
    const adapter: any = {
      kind: 'text',
      name: 'test',
      model: 'scripted',
      async *chatStream() {
        yield {
          type: 'TOOL_CALL_START',
          toolCallId: 'native-read-id',
          toolCallName: 'call_connected_tool',
          parentMessageId: 'answer',
        }
        yield {
          type: 'TOOL_CALL_ARGS',
          toolCallId: 'native-read-id',
          delta: JSON.stringify({ entryId: 'entry', arguments: supplied }),
        }
        yield { type: 'TOOL_CALL_END', toolCallId: 'native-read-id' }
        yield {
          type: 'RUN_FINISHED',
          threadId: 'thread',
          runId: 'run',
          finishReason: 'tool_calls',
        }
      },
    }
    for await (const _chunk of chat({
      adapter,
      tools,
      messages: [{ role: 'user', content: 'Read selected evidence' }],
      agentLoopStrategy: maxIterations(1),
    })) {
    }
    expect(read).toHaveBeenCalledOnce()
    expect(read).toHaveBeenCalledWith(
      kind === 'resource-template'
        ? expect.objectContaining({
            kind: 'resource',
            target: { method: 'resources/read', uri: 'test://items/item' },
          })
        : entry,
      kind === 'resource-template' ? {} : supplied,
      'native-read-id',
    )
  },
)
