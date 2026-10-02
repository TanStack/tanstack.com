import { describe, expect, it, vi } from 'vitest'
import type { ModelMessage } from '@tanstack/ai'
import {
  checkAssistantCall,
  newAssistantTask,
} from '../../src/chat/core/assistant-task'
import { projectAssistantContext } from '../../src/chat/server/assistant-context'
import { assistantMcpTools } from '../../src/chat/server/assistant-mcp-tools'
import type { CatalogEntry } from '../../src/chat/server/mcp-catalog'

function memory() {
  const values = new Map<string, unknown>()
  return {
    values,
    put: async (id: string, v: unknown) => {
      values.set(id, v)
    },
    get: async (id: string) => values.get(id),
  }
}

describe('task recovery boundaries', () => {
  it('permits reads before their outcomes are known, leaving cycle detection to post-call observations', () => {
    const task = newAssistantTask('Check a record', 'message')
    for (let i = 0; i < 3; i++)
      expect(checkAssistantCall(task, 'read', { b: 2, a: 1 })).toBeUndefined()
    expect(checkAssistantCall(task, 'read', { a: 1, b: 2 })).toBeUndefined()
    task.executionRevision++
    expect(checkAssistantCall(task, 'read', { a: 1, b: 2 })).toBeUndefined()
  })
  it('retains the budget across serialized approval resumes', () => {
    const task = newAssistantTask('Multiple steps', 'message')
    for (let i = 0; i < 48; i++)
      expect(checkAssistantCall(task, 'inspect', { id: i })).toBeUndefined()
    const resumed = JSON.parse(JSON.stringify(task))
    expect(checkAssistantCall(resumed, 'inspect', { id: 49 })).toContain(
      'limit',
    )
    expect(resumed.toolCalls).toBe(48)
  })
})

describe('retrievable context', () => {
  it('preserves the last request and complete tool exchanges while archiving older turns', async () => {
    const store = memory()
    const messages: ModelMessage[] = []
    for (let i = 0; i < 25; i++)
      messages.push(
        { role: 'user', content: `Question ${i}` },
        {
          role: 'assistant',
          content: null,
          toolCalls: [
            {
              id: `call${i}`,
              type: 'function',
              function: { name: 'read', arguments: '{}' },
            },
          ],
        },
        {
          role: 'tool',
          toolCallId: `call${i}`,
          content: 'evidence '.repeat(600),
        },
        { role: 'assistant', content: `Answer ${i}` },
      )
    messages.push({
      role: 'user',
      content: 'Compare the last result with the first one.',
    })
    const projected = await projectAssistantContext(messages, store, 20000)
    expect(projected.at(-1)).toEqual(messages.at(-1))
    const calls = new Set(
      projected.flatMap((m) => m.toolCalls?.map((c) => c.id) ?? []),
    )
    for (const m of projected)
      if (m.role === 'tool') expect(calls.has(m.toolCallId!)).toBe(true)
    expect(
      new TextEncoder().encode(JSON.stringify(projected)).length,
    ).toBeLessThanOrEqual(20000)
    const ref = JSON.parse(projected[0].content as string).earlierContext
    expect(await store.get(ref)).toContainEqual(messages[0])
    expect(messages).toHaveLength(101)
  })
  it('archives large unicode evidence without losing its exact content', async () => {
    const store = memory()
    const content = '📚 verified evidence '.repeat(2000)
    const result = await projectAssistantContext(
      [{ role: 'tool', toolCallId: 'x', content }],
      store,
    )
    expect(result[0].toolCallId).toBe('x')
    const ref = JSON.parse(result[0].content as string).archivedMessage
    expect(await store.get(ref)).toEqual({
      role: 'tool',
      toolCallId: 'x',
      content,
    })
  })
})

describe('server-neutral MCP actions', () => {
  it('discovers unrelated capabilities, validates arguments, and proposes without executing', async () => {
    const entry: CatalogEntry = {
      id: 'calendar:create',
      serverId: 'calendar',
      serverLabel: 'Calendar',
      kind: 'tool',
      name: 'create_event',
      title: 'Create event',
      description: 'Create a calendar entry',
      target: { method: 'tools/call', name: 'create_event' },
      inputSchema: {
        type: 'object',
        properties: { title: { type: 'string' } },
        required: ['title'],
        additionalProperties: false,
      },
    }
    const propose = vi.fn(async () => ({ status: 'awaiting_user_approval' }))
    const read = vi.fn()
    const tools = assistantMcpTools({
      connections: [
        {
          id: 'calendar',
          label: 'Calendar',
          url: 'https://calendar.example/mcp',
        },
      ],
      catalog: async () => ({
        serverId: 'calendar',
        entries: [entry],
        fetchedAt: Date.now(),
        complete: true,
        scope: 'server-advertised',
        warnings: [],
      }),
      propose,
      read,
    })
    const invoke = (name: string, args: any) =>
      tools.find((t) => t.name === name)!.execute!(args)
    await expect(
      invoke('call_connected_tool', {
        entryId: entry.id,
        arguments: { title: 'Review' },
      }),
    ).rejects.toThrow('List this server first')
    await expect(
      invoke('call_connected_tool', {
        entryId: 'capability:mcp:home:get_status',
        arguments: {},
      }),
    ).rejects.toThrow('Kody entity reference')
    await expect(
      invoke('list_connected_tools', { serverId: 'home' }),
    ).rejects.toThrow('does not show servers connected inside Kody')
    await invoke('list_connected_tools', { serverId: 'calendar' })
    expect(
      await invoke('inspect_connected_tool', { entryId: entry.id }),
    ).toEqual(entry)
    expect(
      await invoke('call_connected_tool', { entryId: entry.id, arguments: {} }),
    ).toMatchObject({ status: 'invalid_arguments' })
    expect(propose).not.toHaveBeenCalled()
    expect(
      await invoke('call_connected_tool', {
        entryId: entry.id,
        arguments: { title: 'Review' },
      }),
    ).toMatchObject({ status: 'awaiting_user_approval' })
    expect(propose).toHaveBeenCalledWith(entry, { title: 'Review' })
    expect(read).not.toHaveBeenCalled()
  })
})

describe('real TanStack agent loop', () => {
  it('feeds a tool error back to the model, repairs arguments, and reaches a final answer', async () => {
    const { chat, maxIterations, toolDefinition } = await import('@tanstack/ai')
    const { z } = await import('zod')
    const received: ModelMessage[][] = []
    let pass = 0
    const adapter: any = {
      kind: 'text',
      name: 'test',
      model: 'scripted',
      async *chatStream(options: any) {
        received.push(structuredClone(options.messages))
        const current = pass++
        if (current < 2) {
          const id = `call-${current}`
          yield {
            type: 'TOOL_CALL_START',
            toolCallId: id,
            toolCallName: 'lookup',
            parentMessageId: `m${current}`,
          }
          yield {
            type: 'TOOL_CALL_ARGS',
            toolCallId: id,
            delta: JSON.stringify({
              record: current === 0 ? 'missing' : 'existing',
            }),
          }
          yield { type: 'TOOL_CALL_END', toolCallId: id }
        } else {
          yield {
            type: 'TEXT_MESSAGE_START',
            messageId: 'answer',
            role: 'assistant',
          }
          yield {
            type: 'TEXT_MESSAGE_CONTENT',
            messageId: 'answer',
            delta: 'The record is ready.',
          }
          yield { type: 'TEXT_MESSAGE_END', messageId: 'answer' }
        }
        yield {
          type: 'RUN_FINISHED',
          threadId: 'test',
          runId: `run${current}`,
          finishReason: current < 2 ? 'tool_calls' : 'stop',
        }
      },
    }
    const lookup = toolDefinition({
      name: 'lookup',
      description: 'Find a record',
      inputSchema: z.object({ record: z.string() }),
    }).server(async ({ record }) => {
      if (record === 'missing')
        throw new Error('Record missing. Available record: existing.')
      return { record, status: 'ready' }
    })
    const chunks = []
    for await (const chunk of chat({
      adapter,
      messages: [{ role: 'user', content: 'Find the record status' }],
      tools: [lookup],
      agentLoopStrategy: maxIterations(4),
    }))
      chunks.push(chunk)
    expect(pass).toBe(3)
    expect(JSON.stringify(received[1])).toContain('Record missing')
    expect(JSON.stringify(received[2])).toContain('ready')
    expect(
      chunks.some(
        (c) =>
          c.type === 'TEXT_MESSAGE_CONTENT' &&
          c.delta === 'The record is ready.',
      ),
    ).toBe(true)
  })
})

it('compacts a resumed context starting with parallel tool calls without retaining orphan calls', async () => {
  const store = memory()
  const messages: ModelMessage[] = []
  for (let i = 0; i < 10; i++) {
    messages.push({
      role: 'assistant',
      content: null,
      toolCalls: ['a', 'b'].map((suffix) => ({
        id: `${i}${suffix}`,
        type: 'function',
        function: { name: 'read', arguments: '{}' },
      })),
    })
    for (const suffix of ['a', 'b'])
      messages.push({
        role: 'tool',
        toolCallId: `${i}${suffix}`,
        content: 'evidence '.repeat(500),
      })
  }
  messages.push({ role: 'assistant', content: 'Compare the results.' })
  const projected = await projectAssistantContext(messages, store, 18000)
  const calls = projected.flatMap((m) => m.toolCalls?.map((c) => c.id) ?? [])
  const results = projected
    .filter((m) => m.role === 'tool')
    .map((m) => m.toolCallId)
  expect(calls.sort()).toEqual(results.sort())
  expect(projected.at(-1)).toEqual(messages.at(-1))
  expect(
    await store.get(JSON.parse(projected[0].content as string).earlierContext),
  ).toContainEqual(messages[0])
})

it('expands only an advertised resource template and validates prompt arguments before reading', async () => {
  const template: CatalogEntry = {
    id: 'docs:record',
    serverId: 'docs',
    serverLabel: 'Documents',
    kind: 'resource-template',
    name: 'record',
    title: 'Record',
    description: 'Read a record by ID',
    target: { method: 'resources/read', uriTemplate: 'notes://records/{id}' },
  }
  const prompt: CatalogEntry = {
    ...template,
    id: 'docs:prompt',
    kind: 'prompt',
    name: 'summarize',
    target: { method: 'prompts/get', name: 'summarize' },
    arguments: [{ name: 'topic', required: true }],
  }
  const read = vi.fn(async () => ({ content: 'record content' }))
  const propose = vi.fn()
  const tools = assistantMcpTools({
    connections: [
      { id: 'docs', label: 'Documents', url: 'https://docs.example/mcp' },
    ],
    catalog: async () => ({
      serverId: 'docs',
      entries: [template, prompt],
      fetchedAt: Date.now(),
      complete: true,
      scope: 'server-advertised',
      warnings: [],
    }),
    read,
    propose,
  })
  const invoke = (name: string, args: any) =>
    tools.find((t) => t.name === name)!.execute!(args)
  await invoke('list_connected_tools', { serverId: 'docs' })
  expect(
    await invoke('inspect_connected_tool', { entryId: template.id }),
  ).toMatchObject({ templateVariables: ['id'] })
  await expect(
    invoke('call_connected_tool', {
      entryId: template.id,
      arguments: { uri: 'notes://other' },
    }),
  ).rejects.toThrow('only variables')
  await expect(
    invoke('call_connected_tool', { entryId: prompt.id, arguments: {} }),
  ).rejects.toThrow('Missing prompt arguments')
  expect(read).not.toHaveBeenCalled()
  await invoke('call_connected_tool', {
    entryId: template.id,
    arguments: { id: 'a/b' },
  })
  expect(read).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'resource',
      serverId: 'docs',
      target: { method: 'resources/read', uri: 'notes://records/a%2Fb' },
    }),
    {},
    undefined,
  )
  await invoke('call_connected_tool', {
    entryId: prompt.id,
    arguments: { topic: 'Planning' },
  })
  expect(read).toHaveBeenLastCalledWith(
    prompt,
    { topic: 'Planning' },
    undefined,
  )
  expect(propose).not.toHaveBeenCalled()
})

it('rejects oversized assistant evidence before it can enter the persisted transcript', async () => {
  const { StoredResults } = await import('../../src/chat/server/stored-results')
  const store = memory()
  const results = new StoredResults(store, 12000, 'reject')
  await expect(
    results.retain({ content: 'x'.repeat(4 * 1024 * 1024) }),
  ).rejects.toThrow('Request a smaller page')
  expect(store.values.size).toBe(0)
})

it('makes read MCP setup documentation available to the generic setup flow', async () => {
  const { SetupEvidence } = await import('../../src/chat/server/setup-evidence')
  const evidence = new SetupEvidence()
  const entry: CatalogEntry = {
    id: 'docs:setup',
    serverId: 'docs',
    serverLabel: 'Documents',
    name: 'setup',
    title: 'Setup',
    description: 'Connection instructions',
    kind: 'resource',
    target: { method: 'resources/read', uri: 'docs://setup' },
  }
  const tools = assistantMcpTools({
    connections: [
      { id: 'docs', label: 'Documents', url: 'https://docs.example/mcp' },
    ],
    catalog: async () => ({
      serverId: 'docs',
      entries: [entry],
      fetchedAt: Date.now(),
      complete: true,
      scope: 'server-advertised',
      warnings: [],
    }),
    read: async () => ({
      contents: [
        { text: 'Connect at https://docs.example/connect?service=notes' },
      ],
    }),
    propose: async () => {
      throw new Error('No action should execute')
    },
    observe: (entry, result) => evidence.register(entry.id, result),
  })
  const invoke = (name: string, args: any) =>
    tools.find((t) => t.name === name)!.execute!(args)
  await invoke('list_connected_tools', { serverId: 'docs' })
  expect(() =>
    evidence.resolve(entry.id, 'https://docs.example/connect?service=notes'),
  ).toThrow()
  await invoke('call_connected_tool', { entryId: entry.id, arguments: {} })
  expect(
    evidence.resolve(entry.id, 'https://docs.example/connect?service=notes'),
  ).toBe('https://docs.example/connect?service=notes')
  expect(() =>
    evidence.resolve(entry.id, 'https://docs.example/connect?service=other'),
  ).toThrow()
})
