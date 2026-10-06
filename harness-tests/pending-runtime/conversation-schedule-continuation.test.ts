import { afterEach, expect, it, vi } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'
import { readScheduledRunOrigin } from '../../src/chat/core/conversation-runs'
import type { RunInput } from '../../src/chat/server/conversation'

const identity = {
  workspaceId: 'w',
  userId: '00000000-0000-4000-8000-000000000001',
  botId: 'b',
  conversationId: 'main-conversation',
}
afterEach(() => vi.restoreAllMocks())

it('keeps a scheduled setup continuation in its original occurrence and records only the actual human resume action', async () => {
  let now = Date.parse('2030-01-01T00:00:00Z')
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const h = await conversationHarness()
  const objective = 'Summarize synthetic notes after setup.'
  const created = await h.c.changeSchedule(identity, {
    type: 'create',
    commandId: crypto.randomUUID(),
    spec: {
      name: 'Scheduled setup continuation',
      objective,
      timezone: 'UTC',
      recurrence: { kind: 'once', at: now + 1000 },
    },
  })
  if (!created.ok) throw new Error(created.error)
  const originalRun = (h.c as any).run.bind(h.c)
  const inputs: RunInput[] = []
  vi.spyOn(h.c as any, 'run').mockImplementation(async (raw) => {
    const input = raw as RunInput
    inputs.push(input)
    if (inputs.length > 1) return originalRun(input)
    // Stop at a real durable external-step boundary after normal scheduled
    // admission. No external account setup or provider request is needed.
    const state = (h.c as any).state
    state.assistantTask.status = 'waiting'
    state.pendingTask = {
      id: 'synthetic-setup-step',
      kind: 'external-step',
      turnId: state.assistantTask.id,
      request: input.text,
      title: 'Complete synthetic setup',
      instructions: 'Finish the synthetic setup step.',
      url: 'https://synthetic.invalid/setup',
      evidenceRef: 'synthetic-setup',
    }
    state.status = 'idle'
    state.activeRun = null
    await (h.c as any).save()
  })
  now += 1000
  await h.ctx.storage.deleteAlarm()
  await h.c.alarm()
  await h.settle()
  const waiting = await h.c.snapshot()
  const original = waiting.messages[0]
  const origin = readScheduledRunOrigin(original)
  expect(origin).toMatchObject({
    kind: 'schedule',
    scheduleId: created.snapshot.schedules[0].id,
    revision: 1,
    occurrenceId: original.id,
  })
  expect(waiting.currentRunId).toBe(original.id)
  expect(waiting.activity?.messageCount).toBe(0)
  expect((await h.c.runHistory(identity)).items).toMatchObject([
    { id: original.id, status: 'waiting_user', origin },
  ])

  now += 1000
  await h.c.continueTask('synthetic-setup-step', h.input('unused'))
  await h.settle()
  const resumed = await h.c.snapshot()
  const prompts = resumed.messages.filter((message) => message.role === 'user')
  expect(prompts).toHaveLength(2)
  expect(prompts[0]).toEqual(original)
  expect(readScheduledRunOrigin(prompts[0])).toEqual(origin)
  expect(prompts[1].parts).toEqual([
    {
      type: 'text',
      content:
        'I am ready to continue. Verify whether the required step succeeded before proceeding.',
    },
  ])
  expect(readScheduledRunOrigin(prompts[1])).toBeUndefined()
  expect(inputs).toHaveLength(2)
  expect(inputs[1].text).toBe(objective)
  expect(resumed.currentRunId).toBe(original.id)
  expect(resumed.assistantTask?.messageId).toBe(original.id)
  expect(resumed.activity?.messageCount).toBe(
    1 + resumed.messages.filter((message) => message.role !== 'user').length,
  )
  expect((await h.c.runHistory(identity)).items).toMatchObject([
    { id: original.id, status: 'completed', origin },
  ])
  expect((await h.c.scheduleSnapshot(identity)).occurrences).toMatchObject([
    { id: original.id, status: 'completed' },
  ])
})
