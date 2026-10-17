import './fixtures/loaded-assistant-tools'
import { expect, it, vi } from 'vitest'
import { defaultPolicy } from '../../src/chat/core/types'
import { conversationHarness } from './fixtures/conversation-runtime'

async function runConversation(plan: (pass: number) => unknown | undefined) {
  const h = await conversationHarness()
  const run = vi.fn(async () => {
    const pass = run.mock.calls.length - 1
    const args = plan(pass)
    const frame = (delta: unknown, finish_reason: string | null = null) =>
      'data: ' +
      JSON.stringify({
        id: 'completion-' + pass,
        object: 'chat.completion.chunk',
        created: 1,
        model: h.env.INCLUDED_MODEL,
        choices: [{ index: 0, delta, finish_reason }],
      }) +
      '\n\n'
    const body =
      args === undefined
        ? frame({ role: 'assistant', content: 'There are no saved files.' }) +
          frame({}, 'stop')
        : frame({
            role: 'assistant',
            tool_calls: [
              {
                index: 0,
                id: 'call-' + pass,
                type: 'function',
                function: {
                  name: 'list_files',
                  arguments: JSON.stringify(args),
                },
              },
            ],
          }) + frame({}, 'tool_calls')
    return new Response(body + 'data: [DONE]\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  })
  ;(h.env as any).AI = { run }
  await h.c.begin({
    ...h.input('task', 'Show the saved files'),
    fixture: false,
    policy: { ...defaultPolicy, allowKody: false, allowMcp: false },
  })
  await h.settle()
  return { ...h, run, state: await h.c.snapshot() }
}

it('stops repeated SDK validation failures before the model cap and persists their accounting', async () => {
  const h = await runConversation(() => ({ unexpected: 'PRIVATE_ARGUMENT' }))
  expect(h.run).toHaveBeenCalledTimes(4)
  expect(h.state.assistantTask?.status).toBe('incomplete')
  expect(h.state.assistantTask?.reason).toContain('no new evidence')
  expect(h.state.assistantTask?.toolCalls).toBe(4)
  expect(h.state.assistantTask?.repairs).toBe(4)
  expect(h.state.assistantTask?.progress?.revision).toBe(0)
  expect(h.state.assistantTask?.progress?.entries).toHaveLength(1)
  const saved = JSON.parse(
    h.local.prepare('SELECT json FROM state WHERE id=1').get()!.json as string,
  )
  expect(saved.assistantTask).toEqual(h.state.assistantTask)
  expect(JSON.stringify(saved.assistantTask)).not.toContain('PRIVATE_ARGUMENT')
  expect(JSON.stringify(saved.assistantTask)).not.toContain('Input validation')
})

it('recovers from invalid arguments and counts the corrected native tool once', async () => {
  const h = await runConversation((pass) =>
    pass === 0 ? { unexpected: true } : pass === 1 ? {} : undefined,
  )
  expect(h.run).toHaveBeenCalledTimes(3)
  expect(h.state.error).toBeUndefined()
  expect(h.state.assistantTask?.status).toBe('answered')
  expect(h.state.assistantTask?.toolCalls).toBe(2)
  expect(h.state.assistantTask?.repairs).toBe(1)
  expect(h.state.assistantTask?.progress?.revision).toBe(1)
})
