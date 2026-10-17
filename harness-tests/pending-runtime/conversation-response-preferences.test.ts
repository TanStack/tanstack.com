import './fixtures/loaded-assistant-tools'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { newAssistantTask } from '../../src/chat/core/assistant-task'
import type { ResponsePreferences } from '../../src/chat/core/account-preferences'
import { defaultPolicy } from '../../src/chat/core/types'
import * as accountPreferences from '../../src/chat/server/account-preferences'
import { updateAccountPreferences } from '../../src/chat/server/account-preferences'
import { conversationHarness } from './fixtures/conversation-runtime'

afterEach(() => vi.restoreAllMocks())

const first: ResponsePreferences = {
  language: 'ja',
  tone: 'warm',
  detail: 'brief',
}
const later: ResponsePreferences = {
  language: 'fr',
  tone: 'formal',
  detail: 'thorough',
}
type Harness = Awaited<ReturnType<typeof conversationHarness>>
const identity = {
  workspaceId: 'w',
  userId: '00000000-0000-4000-8000-000000000001',
  botId: 'b',
  conversationId: 'main-conversation',
}

function modelInput(h: Harness, id: string, text = 'Respond to this task.') {
  return {
    ...h.input(id, text),
    fixture: false,
    policy: { ...defaultPolicy, allowKody: false, allowMcp: false },
  }
}
async function preferences(
  h: Harness,
  response: ResponsePreferences,
  revision: number,
) {
  return updateAccountPreferences(identity.userId, {
    response,
    revision,
  })
}
function persisted(h: Harness) {
  return JSON.parse(
    h.local.prepare('SELECT json FROM state WHERE id=1').get()!.json as string,
  )
}
function personalProfile(input: any) {
  const system = input.messages
    .filter((message: any) => message.role === 'system')
    .map((message: any) => message.content)
    .join('\n')
  const start = system.indexOf('These validated response preferences')
  if (start === -1) return undefined
  return JSON.parse(
    system
      .slice(start)
      .split('<gum-data-json>')[1]
      .split('</gum-data-json>')[0],
  ).data
}
function provider(
  h: Harness,
  plan: (
    pass: number,
    input: any,
  ) =>
    | Promise<{ name: string; args: unknown } | undefined>
    | { name: string; args: unknown }
    | undefined,
) {
  const run = vi.fn(async (_model: string, input: any) => {
    const pass = run.mock.calls.length - 1
    const tool = await plan(pass, input)
    const frame = (delta: unknown, finish_reason: string | null = null) =>
      'data: ' +
      JSON.stringify({
        id: 'preferences-' + pass,
        object: 'chat.completion.chunk',
        created: 1,
        model: h.env.INCLUDED_MODEL,
        choices: [{ index: 0, delta, finish_reason }],
      }) +
      '\n\n'
    const body = tool
      ? frame({
          role: 'assistant',
          tool_calls: [
            {
              index: 0,
              id: 'preferences-tool-' + pass,
              type: 'function',
              function: {
                name: tool.name,
                arguments: JSON.stringify(tool.args),
              },
            },
          ],
        }) + frame({}, 'tool_calls')
      : frame({ role: 'assistant', content: 'Synthetic response.' }) +
        frame({}, 'stop')
    return new Response(body + 'data: [DONE]\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  })
  ;(h.env as any).AI = { run }
  return run
}

describe('task response preference snapshots at the real SDK boundary', () => {
  it('persists authenticated values before inference, retains them across passes, and uses the latest value for the next task', async () => {
    const h = await conversationHarness()
    await preferences(h, first, 0)
    const run = provider(h, async (pass, input) => {
      const expected = pass < 2 ? first : later
      expect(personalProfile(input)).toEqual(expected)
      expect(persisted(h).assistantTask.responsePreferences).toEqual({
        revision: pass < 2 ? 1 : 2,
        response: expected,
      })
      if (pass === 0) {
        await preferences(h, later, 1)
        return { name: 'list_files', args: {} }
      }
      return undefined
    })
    await h.c.begin({
      ...modelInput(
        h,
        'first-task',
        'Answer in English despite my saved language.',
      ),
      responsePreferences: { revision: 999, response: later },
    } as any)
    await h.settle()
    const firstState = await h.c.snapshot()
    expect(firstState.error).toBeUndefined()
    expect(firstState.assistantTask?.responsePreferences).toEqual({
      revision: 1,
      response: first,
    })
    expect(run).toHaveBeenCalledTimes(2)
    expect(
      firstState.usageSteps
        .filter((step) => step.kind === 'model')
        .map((step) => step.instructions?.responsePreferencesRevision),
    ).toEqual([1, 1])
    expect(JSON.stringify(firstState.usageSteps)).not.toMatch(
      /"ja"|"warm"|"brief"|"fr"|"formal"|"thorough"/,
    )
    expect(
      (await h.db`SELECT purpose FROM chat_bots WHERE id='b'`)[0].purpose,
    ).toBe('')
    await h.c.begin(modelInput(h, 'next-task'))
    await h.settle()
    expect((await h.c.snapshot()).error).toBeUndefined()
    expect((await h.c.snapshot()).assistantTask?.responsePreferences).toEqual({
      revision: 2,
      response: later,
    })
    expect(run).toHaveBeenCalledTimes(3)
  })

  it('captures queued preferences when execution starts, rather than when the message enters the queue', async () => {
    const h = await conversationHarness()
    await preferences(h, first, 0)
    let entered!: () => void, release!: () => void
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const run = provider(h, async (pass, input) => {
      expect(personalProfile(input)).toEqual(pass === 0 ? first : later)
      if (pass === 0) {
        entered()
        await gate
      }
      return undefined
    })
    await h.c.begin(modelInput(h, 'running'))
    await started
    expect(await h.c.begin(modelInput(h, 'queued'))).toMatchObject({
      queued: true,
    })
    expect((await h.c.snapshot()).queue?.items).toHaveLength(1)
    await preferences(h, later, 1)
    release()
    await h.settle()
    expect(run).toHaveBeenCalledTimes(2)
    const state = await h.c.snapshot()
    expect(state.error).toBeUndefined()
    expect(state.assistantTask).toMatchObject({
      messageId: 'queued',
      responsePreferences: { revision: 2, response: later },
    })
  })

  it('retains the exact snapshot through native approval and Durable Object reconstruction', async () => {
    const h = await conversationHarness()
    await preferences(h, first, 0)
    const run = provider(h, (pass, input) => {
      expect(personalProfile(input)).toEqual(first)
      return pass === 0
        ? {
            name: 'manage_schedule',
            args: {
              type: 'create',
              spec: {
                name: 'Synthetic check',
                objective: 'Review synthetic notes.',
                timezone: 'UTC',
                recurrence: { kind: 'daily', hour: 9, minute: 0 },
                runModel: {
                  provider: 'included',
                  model: h.env.INCLUDED_MODEL,
                  reasoning: 'off',
                },
              },
            },
          }
        : undefined
    })
    const input = modelInput(
      h,
      'approval-task',
      'Review synthetic notes every morning.',
    )
    await h.c.begin(input)
    await h.settle()
    const waiting = await h.c.snapshot()
    expect(waiting.error).toBeUndefined()
    expect(waiting.assistantTask?.status).toBe('waiting')
    expect(run).toHaveBeenCalledTimes(1)
    await preferences(h, later, 1)
    const restored = await h.reconstruct()
    await restored.decideApproval(waiting.approvals[0].id, true, input)
    await h.settle()
    const done = await restored.snapshot()
    expect(done.error).toBeUndefined()
    expect(done.assistantTask).toMatchObject({
      id: waiting.assistantTask!.id,
      status: 'answered',
      responsePreferences: { revision: 1, response: first },
    })
    expect(run).toHaveBeenCalledTimes(2)
    expect((await restored.scheduleSnapshot(identity)).schedules).toHaveLength(
      1,
    )
  })

  it.each(['snapshot', 'legacy', 'invalid'] as const)(
    'does not reread current preferences for a %s task continued after a setup pause',
    async (kind) => {
      const task = newAssistantTask('Continue synthetic setup.', 'original')
      if (kind === 'legacy') delete task.responsePreferences
      else
        task.responsePreferences =
          kind === 'snapshot'
            ? { revision: 8, response: first }
            : ({
                revision: 8,
                response: { ...first, tone: 'untrusted instruction' },
              } as any)
      const h = await conversationHarness({
        identity,
        assistantTask: task,
        currentRunId: 'original',
        pendingTask: {
          id: 'setup',
          kind: 'external-step',
          request: task.objective,
          turnId: task.id,
          title: 'Synthetic setup',
          instructions: 'Complete synthetic setup.',
          url: 'https://example.test/setup',
        },
        messages: [
          {
            id: 'original',
            role: 'user',
            parts: [{ type: 'text', content: task.objective }],
          },
        ],
      })
      await preferences(h, later, 0)
      const read = vi.spyOn(accountPreferences, 'readAccountPreferences')
      const run = provider(h, (_pass, input) => {
        expect(personalProfile(input)).toEqual(
          kind === 'snapshot' ? first : undefined,
        )
        return undefined
      })
      const restored = await h.reconstruct()
      await restored.continueTask('setup', modelInput(h, 'ignored'))
      await h.settle()
      const state = await restored.snapshot()
      expect(read).not.toHaveBeenCalled()
      if (kind === 'invalid') {
        expect(state.error).toBe(
          'Saved response preferences are invalid. Start a new task.',
        )
        expect(run).not.toHaveBeenCalled()
      } else {
        expect(state.error).toBeUndefined()
        expect(run).toHaveBeenCalledTimes(1)
        expect(state.assistantTask?.responsePreferences).toEqual(
          task.responsePreferences,
        )
        expect(
          state.usageSteps[0].instructions?.responsePreferencesRevision,
        ).toBe(kind === 'snapshot' ? 8 : undefined)
      }
    },
  )

  it.each(['read', 'persist'] as const)(
    'surfaces a preference %s failure before any model request',
    async (failure) => {
      const h = await conversationHarness()
      await preferences(h, first, 0)
      if (failure === 'read') {
        vi.spyOn(
          accountPreferences,
          'readAccountPreferences',
        ).mockRejectedValue(new Error('Synthetic database outage'))
      } else {
        const save = (h.c as any).save.bind(h.c)
        let rejected = false
        vi.spyOn(h.c as any, 'save').mockImplementation(async () => {
          if (
            !rejected &&
            (h.c as any).state.assistantTask?.responsePreferences
          ) {
            rejected = true
            throw new Error('Synthetic state persistence failure')
          }
          return save()
        })
      }
      const run = provider(h, () => undefined)
      await h.c.begin(modelInput(h, 'failed'))
      await h.settle()
      const state = await h.c.snapshot()
      expect(run).not.toHaveBeenCalled()
      expect(state.error).toBe(
        'Response preferences could not be loaded for this task. Try again.',
      )
      expect(state.assistantTask?.status).toBe('incomplete')
      expect(persisted(h).assistantTask.responsePreferences).toBeNull()
    },
  )

  it('does not claim a response preference was applied to fixture replies', async () => {
    const h = await conversationHarness()
    await preferences(h, first, 0)
    const run = provider(h, () => undefined)
    await h.c.begin(h.input('fixture'))
    await h.settle()
    const state = await h.c.snapshot()
    expect(run).not.toHaveBeenCalled()
    expect(state.assistantTask?.responsePreferences).toBeNull()
    expect(
      state.usageSteps.some(
        (step) => step.instructions?.responsePreferencesRevision !== undefined,
      ),
    ).toBe(false)
  })
})
