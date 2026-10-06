import { afterEach, expect, it, vi } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'
import { Skills } from '../../src/chat/server/skills'
import { defaultPolicy } from '../../src/chat/core/types'

// This suite deliberately uses production discovery, without loaded-assistant-tools.
afterEach(() => vi.restoreAllMocks())
const identity = {
  workspaceId: 'w',
  userId: '00000000-0000-4000-8000-000000000001',
  botId: 'b',
  conversationId: 'main-conversation',
}
function reply(name?: string, args = {}) {
  const frame = (delta: unknown, finish_reason: string | null = null) =>
    `data: ${JSON.stringify({ id: crypto.randomUUID(), choices: [{ index: 0, delta, finish_reason }] })}\n\n`
  return new Response(
    frame(
      name
        ? {
            role: 'assistant',
            tool_calls: [
              {
                index: 0,
                id: crypto.randomUUID(),
                type: 'function',
                function: { name, arguments: JSON.stringify(args) },
              },
            ],
          }
        : { role: 'assistant', content: 'Finished.' },
    ) +
      frame({}, name ? 'tool_calls' : 'stop') +
      'data: [DONE]\n\n',
    { headers: { 'content-type': 'text/event-stream' } },
  )
}
const names = (request: any) =>
  request.tools.map((tool: any) => tool.function.name)
const system = (request: any) =>
  request.messages
    .filter((message: any) => message.role === 'system')
    .map((message: any) => message.content)
    .join('\n')

it('discovers skill metadata on demand and loads full instructions only after reading', async () => {
  const h = await conversationHarness()
  const skillId = crypto.randomUUID()
  await new Skills(identity).command({
    type: 'create',
    id: skillId,
    commandId: crypto.randomUUID(),
    document: {
      name: 'test-review',
      description: 'Review tests for useful coverage.',
      instructions:
        'INSTRUCTIONS_LOADED_ONLY_AFTER_READ. Inspect assertions before suggesting changes.',
    },
  })
  const requests: any[] = []
  const run = vi.fn(async (_model, request) => {
    requests.push(structuredClone(request))
    if (requests.length === 1)
      return reply('list_skills', { query: 'test-review' })
    if (requests.length === 2)
      return reply('read_skill', { skillId, version: 1 })
    return reply()
  })
  Object.assign(h.env, { AI: { run } })
  await h.c.begin({
    ...h.input('skill-discovery', 'Review these tests.'),
    fixture: false,
    policy: { ...defaultPolicy, allowKody: false, allowMcp: false },
  })
  await h.settle()
  expect((await h.c.snapshot()).error).toBeUndefined()
  expect(requests).toHaveLength(3)
  expect(system(requests[0])).not.toContain(skillId)
  expect(names(requests[0])).toContain('list_skills')
  expect(JSON.stringify(requests[1].messages)).toContain(skillId)
  expect(JSON.stringify(requests[1].messages)).toContain(
    'Review tests for useful coverage.',
  )
  expect(system(requests[0])).not.toContain(
    'INSTRUCTIONS_LOADED_ONLY_AFTER_READ',
  )
  expect(system(requests[1])).not.toContain(
    'INSTRUCTIONS_LOADED_ONLY_AFTER_READ',
  )
  expect(system(requests[2])).toContain('INSTRUCTIONS_LOADED_ONLY_AFTER_READ')
  expect((await h.c.snapshot()).assistantTask?.loadedSkills).toEqual([
    { skillId, version: 1 },
  ])
  const steps = h.local
    .prepare('SELECT json FROM usage_steps')
    .all()
    .map((row) => JSON.parse(row.json as string))
  expect(
    steps.filter((step) => step.kind === 'model').at(-1).instructions.sections,
  ).toContainEqual({ id: 'context.loaded-skills', version: '2' })
})

it('loads native tools, retains them through approval and reconstruction, and resets discovery for a new task', async () => {
  const h = await conversationHarness()
  const requests: any[] = []
  const spec = {
    name: 'Discovery check',
    objective: 'Summarize synthetic notes.',
    timezone: 'America/Denver',
    recurrence: { kind: 'daily', hour: 9, minute: 15 },
    runModel: {
      provider: 'included',
      model: h.env.INCLUDED_MODEL,
      reasoning: 'off',
    },
  }
  const replies = [
    reply('load_tools', { names: ['manage_schedule'] }),
    reply('manage_schedule', { type: 'create', spec }),
    reply(),
    reply(),
  ]
  const run = vi.fn(async (_model, request) => {
    requests.push(structuredClone(request))
    return replies.shift()!
  })
  Object.assign(h.env, { AI: { run } })
  const input = {
    ...h.input(
      'discover-and-schedule',
      'Summarize synthetic notes every morning at 9:15 in America/Denver.',
    ),
    fixture: false,
    policy: { ...defaultPolicy, allowKody: false, allowMcp: false },
  }
  await h.c.begin(input)
  await h.settle()
  const waiting = await h.c.snapshot()
  expect(waiting.error).toBeUndefined()
  expect(waiting.assistantTask).toMatchObject({
    status: 'waiting',
    loadedTools: ['manage_schedule'],
  })
  expect(waiting.approvals).toHaveLength(1)
  expect(names(requests[0])).not.toContain('manage_schedule')
  expect(names(requests[0])).toContain('load_tools')
  expect(system(requests[0])).toContain('manage_schedule')
  expect(names(requests[1])).toContain('manage_schedule')
  expect(system(requests[1])).toContain('call list_schedules first')
  expect((await h.c.scheduleSnapshot(identity)).schedules).toHaveLength(0)
  const restored = await h.reconstruct()
  await restored.decideApproval(waiting.approvals[0].id, true, input)
  await h.settle()
  expect((await restored.snapshot()).error).toBeUndefined()
  expect(names(requests[2])).toContain('manage_schedule')
  expect((await restored.scheduleSnapshot(identity)).schedules).toHaveLength(1)
  await restored.begin({ ...input, messageId: 'new-task', text: 'Hello.' })
  await h.settle()
  expect(requests).toHaveLength(4)
  expect(names(requests[3])).not.toContain('manage_schedule')
  expect((await restored.snapshot()).assistantTask?.loadedTools).toBeUndefined()
})
