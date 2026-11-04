import { chat, maxIterations, toolDefinition } from '@tanstack/ai'
import { createCloudflareText } from '@tanstack/ai-cloudflare'
import { expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  assistantToolDiscovery,
  compactDirectory,
  readSkillDirectory,
} from '../../src/chat/server/assistant-discovery'
import { buildAssistantInstructions } from '../../src/chat/server/assistant-instructions'
import { newAssistantTask } from '../../src/chat/core/assistant-task'
import type { SkillSummary } from '../../src/chat/core/skills'

const model = '@cf/zai-org/glm-5.3-flash'
function response(name?: string, args = {}) {
  const delta = name
    ? {
        role: 'assistant',
        tool_calls: [
          {
            index: 0,
            id: `call-${name}`,
            type: 'function',
            function: { name, arguments: JSON.stringify(args) },
          },
        ],
      }
    : { role: 'assistant', content: 'Done.' }
  return new Response(
    `data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', model, choices: [{ index: 0, delta, finish_reason: name ? 'tool_calls' : 'stop' }] })}\n\ndata: [DONE]\n\n`,
    { headers: { 'content-type': 'text/event-stream' } },
  )
}
const tool = (
  name: string,
  execute: (args: { recordId: string }) => Promise<{ ok: boolean }> = vi.fn(
    async () => ({ ok: true }),
  ),
) =>
  toolDefinition({
    name,
    description: 'Read a private record.',
    inputSchema: z.object({ recordId: z.string() }),
  }).server(execute)

it('loads schemas on the next real TanStack AI pass and executes the original authorized handler', async () => {
  const execute = vi.fn(async (_args: { recordId: string }) => ({ ok: true }))
  const save = vi.fn(async (_names: string[]) => {})
  const discovery = assistantToolDiscovery({
    tools: [tool('read_record', execute)],
    onLoad: save,
  })
  const requests: any[] = []
  const replies = [
    response('load_tools', { names: ['read_record'] }),
    response('read_record', { recordId: 'one' }),
    response(),
  ]
  const run = vi.fn(async (_model, request) => {
    requests.push(request)
    return replies.shift()!
  })
  for await (const _ of chat({
    adapter: createCloudflareText(model, { binding: { run } as never }),
    messages: [{ role: 'user', content: 'Read record one.' }],
    tools: discovery.tools(),
    middleware: [discovery.middleware],
    agentLoopStrategy: maxIterations(3),
  })) {
  }
  const names = (request: any) =>
    request.tools.map((item: any) => item.function.name)
  expect(names(requests[0])).toEqual(['list_available_tools', 'load_tools'])
  expect(names(requests[1])).toContain('read_record')
  expect(names(requests[2])).toContain('read_record')
  expect(save).toHaveBeenCalledWith(['read_record'])
  expect(execute).toHaveBeenCalledOnce()
  expect(execute.mock.calls[0][0]).toEqual({ recordId: 'one' })
})

it('does not execute a deferred tool if the model guesses its name before loading', async () => {
  const execute = vi.fn(async () => ({ ok: true }))
  const discovery = assistantToolDiscovery({
    tools: [tool('read_record', execute)],
    onLoad: async () => {},
  })
  const run = vi.fn(async () => response('read_record', { recordId: 'one' }))
  for await (const _ of chat({
    adapter: createCloudflareText(model, { binding: { run } as never }),
    messages: [{ role: 'user', content: 'Read it.' }],
    tools: discovery.tools(),
    middleware: [discovery.middleware],
    agentLoopStrategy: maxIterations(1),
  })) {
  }
  expect(execute).not.toHaveBeenCalled()
})

it('restores only currently available tools and never treats saved names as authorization', () => {
  const discovery = assistantToolDiscovery({
    tools: [tool('read_record')],
    loadedNames: ['read_record', 'revoked_tool'],
    onLoad: async () => {},
  })
  expect(discovery.tools().map((item) => item.name)).toContain('read_record')
  expect(JSON.stringify(discovery.directory)).not.toContain('revoked_tool')
  expect(discovery.tools().map((item) => item.name)).not.toContain(
    'revoked_tool',
  )
})

it('rejects an unknown load atomically and preserves state when persistence fails', async () => {
  const onLoad = vi.fn(async () => {
    throw new Error('Save failed')
  })
  const discovery = assistantToolDiscovery({
    tools: [tool('read_record')],
    onLoad,
  })
  const load = discovery.tools().find((item) => item.name === 'load_tools')!
  expect(
    await load.execute!({ names: ['read_record', 'missing'] }),
  ).toMatchObject({ ok: false })
  expect(onLoad).not.toHaveBeenCalled()
  await expect(load.execute!({ names: ['read_record'] })).rejects.toThrow(
    'Save failed',
  )
  expect(discovery.tools().map((item) => item.name)).not.toContain(
    'read_record',
  )
})

const skill = (id: string) =>
  ({
    id,
    name: 'audit',
    version: 2,
    description: 'Review tests',
    instructions: 'MUST NOT APPEAR',
  }) as unknown as SkillSummary
it('includes metadata across catalog pages without skill bodies or extra fields', async () => {
  const list = vi
    .fn()
    .mockResolvedValueOnce({ items: [skill('local')], nextCursor: 'more' })
    .mockResolvedValueOnce({ items: [skill('kody:one')] })
  const directory = await readSkillDirectory(list)
  expect(list).toHaveBeenNthCalledWith(2, 'more')
  expect(directory).toMatchObject({
    status: 'ready',
    limited: false,
    items: [{ id: 'local', version: 2 }, { id: 'kody:one' }],
  })
  expect(JSON.stringify(directory)).not.toContain('MUST NOT APPEAR')
  const built = buildAssistantInstructions(
    { name: 'Kody', purpose: '' },
    newAssistantTask('Audit', 'm'),
    [],
    { enabledTools: ['read_skill'], skillDirectory: directory },
  )
  expect(built.systemPrompts.join('\n')).toContain('kody:one')
  expect(built.systemPrompts.join('\n')).toContain(
    'read its exact id and version',
  )
})
it('keeps whole metadata entries within the budget and distinguishes failure from an empty catalog', async () => {
  const items = Array.from({ length: 100 }, (_, i) => ({
    ...skill(`skill-${i}`),
    description: 'x'.repeat(1000),
  }))
  const directory = await readSkillDirectory(async () => ({ items }))
  expect(directory.limited).toBe(true)
  expect(JSON.stringify(directory.items).length).toBeLessThanOrEqual(8000)
  expect(directory.items.length).toBeGreaterThan(0)
  expect(
    await readSkillDirectory(async () => {
      throw new Error('No access')
    }),
  ).toEqual({ status: 'unavailable', items: [], limited: true })
  expect(await readSkillDirectory(async () => ({ items: [] }))).toEqual({
    status: 'ready',
    items: [],
    limited: false,
  })
  expect(compactDirectory([{ id: 'long-id' }], 5)).toEqual({
    items: [],
    limited: true,
  })
})

it('serializes concurrent loads so persistence retains both selections', async () => {
  let saved: string[] = []
  const discovery = assistantToolDiscovery({
    tools: [tool('one'), tool('two')],
    onLoad: async (names) => {
      await Promise.resolve()
      saved = names
    },
  })
  const load = discovery.tools().find((item) => item.name === 'load_tools')!
  await Promise.all([
    load.execute!({ names: ['one'] }),
    load.execute!({ names: ['two'] }),
  ])
  expect(saved).toEqual(['one', 'two'])
})

it('keeps exact selected references even when their reader is outside the compact directory', () => {
  const result = buildAssistantInstructions(
    { name: 'Kody', purpose: '' },
    newAssistantTask('Read selected chat', 'm'),
    [],
    {
      enabledTools: ['load_tools'],
      availableToolNames: ['read_conversation'],
      availableTools: { items: [], limited: true },
      references: [
        { kind: 'conversation', botId: 'selected-bot', label: 'Notes' },
      ],
    },
  )
  expect(result.systemPrompts.join('\n')).toContain('selected-bot')
})
