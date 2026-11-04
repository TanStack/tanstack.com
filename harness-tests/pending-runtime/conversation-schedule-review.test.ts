import type { SqlStorage } from '@cloudflare/workers-types'
import './fixtures/loaded-assistant-tools'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { newAssistantTask } from '../../src/chat/core/assistant-task'
import type {
  ScheduleCommand,
  ScheduleSpec,
} from '../../src/chat/core/schedules'
import { defaultPolicy } from '../../src/chat/core/types'
import { updateAccountPreferences } from '../../src/chat/server/account-preferences'
import { ConversationRuns } from '../../src/chat/server/conversation-runs'
import { conversationHarness } from './fixtures/conversation-runtime'

const identity = {
  workspaceId: 'w',
  userId: '00000000-0000-4000-8000-000000000001',
  botId: 'b',
  conversationId: 'main-conversation',
}
const now = Date.parse('2030-01-01T00:00:00Z')
const request = 'Review my notes every morning.'
const timezone = 'America/Denver'
const otherTimezone = 'Europe/London'

afterEach(() => vi.restoreAllMocks())

function spec(zone = timezone): ScheduleSpec {
  return {
    name: 'Morning notes',
    objective: 'Review synthetic notes and summarize the changes.',
    timezone: zone,
    recurrence: { kind: 'daily', hour: 9, minute: 15 },
    runModel: {
      provider: 'included',
      model: '@cf/moonshotai/kimi-k2.6',
      reasoning: 'off',
    },
  }
}

function create(zone = timezone): Extract<ScheduleCommand, { type: 'create' }> {
  return { type: 'create', commandId: crypto.randomUUID(), spec: spec(zone) }
}

async function setup(accountTimezone: string | null = null) {
  vi.spyOn(Date, 'now').mockReturnValue(now)
  const task = newAssistantTask(request, 'original')
  const h = await conversationHarness({
    identity,
    currentRunId: 'original',
    assistantTask: task,
    messages: [
      {
        id: 'original',
        role: 'user',
        parts: [{ type: 'text', content: request }],
      },
    ],
  })
  const runs = new ConversationRuns(h.ctx.storage.sql as unknown as SqlStorage)
  runs.accept({
    id: 'original',
    origin: { kind: 'user', messageId: 'original' },
    identity,
    mode: 'assistant',
    status: 'running',
    createdAt: now,
    startedAt: now,
    assistantTaskId: task.id,
    executionId: 'original-execution',
  })
  // Invoke the native tool at its normal point inside a running model pass.
  // No model call is needed to exercise the production mutation boundary.
  ;(h.c as any).state.status = 'running'
  ;(h.c as any).abort = new AbortController()
  if (accountTimezone !== null)
    await updateAccountPreferences('00000000-0000-4000-8000-000000000001', {
      timezone: accountTimezone,
      revision: 0,
    })
  // The transaction and authorization paths remain production code. Only the
  // later model continuation is excluded from this local approval boundary test.
  const continuation = vi
    .spyOn(h.c as any, 'resumeAssistantAction')
    .mockResolvedValue(undefined)
  const kody = vi
    .spyOn(h.c as any, 'measuredKody')
    .mockRejectedValue(new Error('Unexpected Kody execution'))
  const input = { ...h.input('unused'), fixture: false }
  return {
    ...h,
    task,
    runs,
    continuation,
    kody,
    approvalInput: input,
    propose: (command: ScheduleCommand) =>
      (h.c as any).changeAssistantSchedule(task.id, request, command),
  }
}

async function pending(
  h: Awaited<ReturnType<typeof setup>>,
  command: ScheduleCommand = create(),
) {
  const result = await h.propose(command)
  expect(result).toEqual({
    approvalId: expect.any(String),
    status: 'awaiting_user_approval',
  })
  // The calling assistant loop ends its pass after receiving this result.
  ;(h.c as any).state.status = 'idle'
  ;(h.c as any).state.assistantTask.status = 'waiting'
  await (h.c as any).save()
  const approval = (await h.c.snapshot()).approvals.find(
    (item) => item.id === result.approvalId,
  )!
  expect(approval.status).toBe('pending')
  return approval
}

function scheduleRows(h: Awaited<ReturnType<typeof setup>>) {
  return h.local
    .prepare('SELECT json FROM schedules ORDER BY id')
    .all()
    .map((row) => JSON.parse(row.json as string))
}

function receiptCount(h: Awaited<ReturnType<typeof setup>>) {
  return h.local
    .prepare('SELECT count(*) AS count FROM schedule_commands')
    .get()?.count
}

function pauseValidation(h: Awaited<ReturnType<typeof setup>>) {
  let enter!: () => void
  let resume!: () => void
  const entered = {
    promise: new Promise<void>((resolve) => {
      enter = resolve
    }),
    resolve: () => enter(),
  }
  const release = {
    promise: new Promise<void>((resolve) => {
      resume = resolve
    }),
    resolve: () => resume(),
  }
  const validate = (h.c as any).validateScheduleSpec.bind(h.c)
  vi.spyOn(h.c as any, 'validateScheduleSpec').mockImplementation(
    async (...args: unknown[]) => {
      await validate(...args)
      entered.resolve()
      await release.promise
    },
  )
  return { entered: entered.promise, release: () => release.resolve() }
}

describe('native assistant schedule review', () => {
  it('pauses the real SDK loop for review and resumes the same task after native approval', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const h = await conversationHarness()
    const requested = spec()
    const acknowledgement =
      'Scheduled Morning notes daily at 9:15 AM in America/Denver.'
    const run = vi.fn(async (_model: string, _inputs: unknown) => {
      const pass = run.mock.calls.length - 1
      if (pass > 1) throw new Error('Unexpected extra provider request')
      const frame = (delta: unknown, finishReason: string | null = null) =>
        'data: ' +
        JSON.stringify({
          id: 'schedule-completion-' + pass,
          object: 'chat.completion.chunk',
          created: 1,
          model: h.env.INCLUDED_MODEL,
          choices: [{ index: 0, delta, finish_reason: finishReason }],
        }) +
        '\n\n'
      const body =
        pass === 0
          ? frame({
              role: 'assistant',
              tool_calls: [
                {
                  index: 0,
                  id: 'schedule-call',
                  type: 'function',
                  function: {
                    name: 'manage_schedule',
                    arguments: JSON.stringify({
                      type: 'create',
                      spec: requested,
                    }),
                  },
                },
              ],
            }) + frame({}, 'tool_calls')
          : frame({ role: 'assistant', content: acknowledgement }) +
            frame({}, 'stop')
      return new Response(body + 'data: [DONE]\n\n', {
        headers: { 'Content-Type': 'text/event-stream' },
      })
    })
    ;(h.env as any).AI = { run }
    const kody = vi
      .spyOn(h.c as any, 'measuredKody')
      .mockRejectedValue(new Error('Unexpected Kody execution'))
    const input = {
      ...h.input('schedule-sdk-run', request),
      fixture: false,
      policy: { ...defaultPolicy, allowKody: false, allowMcp: false },
    }
    await h.c.begin(input)
    await h.settle()
    const waiting = await h.c.snapshot()
    expect(run).toHaveBeenCalledTimes(1)
    expect(waiting.error).toBeUndefined()
    expect(waiting.assistantTask).toMatchObject({
      status: 'waiting',
      messageId: input.messageId,
      modelPasses: 1,
      toolCalls: 1,
    })
    expect(waiting.approvals).toHaveLength(1)
    const approval = waiting.approvals[0]
    expect(approval).toMatchObject({
      status: 'pending',
      assistantTaskId: waiting.assistantTask!.id,
      schedule: {
        reason: 'timezone-unset',
        command: { type: 'create', spec: requested },
      },
    })
    expect((await h.c.scheduleSnapshot(identity)).schedules).toEqual([])
    expect((await h.c.runHistory(identity)).items).toMatchObject([
      { id: input.messageId, status: 'waiting_approval' },
    ])
    await h.c.decideApproval(approval.id, true, input)
    await h.settle()
    const done = await h.c.snapshot()
    expect(run).toHaveBeenCalledTimes(2)
    expect(done.error).toBeUndefined()
    expect(done.assistantTask).toMatchObject({
      id: waiting.assistantTask!.id,
      status: 'answered',
      messageId: input.messageId,
      modelPasses: 2,
      toolCalls: 1,
    })
    expect(done.assistantTask!.observations).toMatchObject([
      { approvalId: approval.id, outcome: 'succeeded' },
    ])
    expect(done.approvals[0]).toMatchObject({
      id: approval.id,
      status: 'done',
      executionOutcome: 'succeeded',
    })
    expect((await h.c.scheduleSnapshot(identity)).schedules).toMatchObject([
      { spec: requested, revision: 1, status: 'active' },
    ])
    expect((await h.c.scheduleSnapshot(identity)).schedules).toHaveLength(1)
    expect((await h.c.runHistory(identity)).items).toMatchObject([
      {
        id: input.messageId,
        status: 'completed',
        assistantTaskId: waiting.assistantTask!.id,
      },
    ])
    expect((await h.c.runHistory(identity)).items).toHaveLength(1)
    expect(
      done.messages
        .flatMap((message) => message.parts)
        .filter(
          (part) => part.type === 'text' && part.content === acknowledgement,
        ),
    ).toHaveLength(1)
    const exchange = done.messages
      .flatMap((message) => message.parts)
      .find((part) => part.type === 'tool-call' && part.id === 'schedule-call')
    expect(exchange).toMatchObject({
      type: 'tool-call',
      name: 'manage_schedule',
      output: {
        approvalId: approval.id,
        status: 'done',
        executionOutcome: 'succeeded',
      },
    })
    const continuationInput = JSON.stringify(run.mock.calls[1][1])
    expect(continuationInput).toContain(approval.id)
    expect(continuationInput).toContain('succeeded')
    expect(continuationInput).toContain(requested.timezone)
    expect(kody).not.toHaveBeenCalled()
  })

  it('persists an exact proposal and next-run preview without creating a schedule', async () => {
    const h = await setup()
    const command = create()
    const approval = await pending(h, command)
    expect(approval).toMatchObject({
      assistantTaskId: h.task.id,
      resumeRequest: request,
      code: '',
      schedule: {
        command,
        reason: 'timezone-unset',
        nextRun: {
          iso: '2030-01-01T16:15:00.000Z',
          timezone,
          local: expect.stringContaining('9:15:00 AM'),
        },
      },
    })
    expect(approval.schedule).not.toHaveProperty('previousTimezone')
    expect(scheduleRows(h)).toEqual([])
    expect(receiptCount(h)).toBe(0)
    expect(await h.ctx.storage.getAlarm()).toBeNull()
    expect(h.continuation).not.toHaveBeenCalled()
    expect(h.kody).not.toHaveBeenCalled()
    expect(await h.propose(command)).toEqual({
      approvalId: approval.id,
      status: 'awaiting_user_approval',
    })
    expect((await h.c.snapshot()).approvals).toHaveLength(1)
  })

  it('creates directly in the confirmed account timezone and retains that zone on later updates', async () => {
    const h = await setup(timezone)
    const command = create()
    expect(await h.propose(command)).toMatchObject({ ok: true })
    const first = scheduleRows(h)[0]
    expect(first.spec).toEqual(command.spec)
    expect((await h.c.snapshot()).approvals).toEqual([])
    await updateAccountPreferences('00000000-0000-4000-8000-000000000001', {
      timezone: otherTimezone,
      revision: 1,
    })
    const changed = { ...command.spec, name: 'Updated notes' }
    expect(
      await h.propose({
        type: 'update',
        commandId: crypto.randomUUID(),
        id: first.id,
        revision: first.revision,
        spec: changed,
      }),
    ).toMatchObject({ ok: true })
    expect(scheduleRows(h)[0]).toMatchObject({ revision: 2, spec: changed })
    expect((await h.c.snapshot()).approvals).toEqual([])
    expect(h.kody).not.toHaveBeenCalled()
  })

  it('approves the frozen proposal even if the account default changes during review', async () => {
    const h = await setup(otherTimezone)
    const command = create()
    const approval = await pending(h, command)
    expect(approval.schedule).toMatchObject({
      reason: 'timezone-change',
      previousTimezone: otherTimezone,
    })
    await updateAccountPreferences('00000000-0000-4000-8000-000000000001', {
      timezone: 'Asia/Tokyo',
      revision: 1,
    })
    await h.c.decideApproval(approval.id, true, h.approvalInput)
    await h.settle()
    expect(scheduleRows(h)).toHaveLength(1)
    expect(scheduleRows(h)[0].spec).toEqual(command.spec)
    expect(receiptCount(h)).toBe(1)
    expect((await h.c.snapshot()).approvals[0]).toMatchObject({
      status: 'done',
      executionOutcome: 'succeeded',
      schedule: { command },
    })
    expect(h.continuation).toHaveBeenCalledWith(
      expect.objectContaining({ id: approval.id }),
      h.approvalInput,
      'succeeded',
      expect.objectContaining({ ok: true }),
    )
    expect(h.kody).not.toHaveBeenCalled()
  })

  it('commits and continues once for concurrent and repeated approval requests', async () => {
    const h = await setup()
    const approval = await pending(h)
    await Promise.all([
      h.c.decideApproval(approval.id, true, h.approvalInput),
      h.c.decideApproval(approval.id, true, h.approvalInput),
    ])
    await h.settle()
    await h.c.decideApproval(approval.id, true, h.approvalInput)
    await h.settle()
    expect(scheduleRows(h)).toHaveLength(1)
    expect(receiptCount(h)).toBe(1)
    expect(h.continuation).toHaveBeenCalledTimes(1)
    expect(h.kody).not.toHaveBeenCalled()
  })

  it('rejects a proposal without creating a schedule or alarm and keeps rejection idempotent', async () => {
    const h = await setup()
    const approval = await pending(h)
    await h.c.decideApproval(approval.id, false, h.approvalInput)
    await h.settle()
    await h.c.decideApproval(approval.id, false, h.approvalInput)
    await h.settle()
    expect(scheduleRows(h)).toEqual([])
    expect(receiptCount(h)).toBe(0)
    expect(await h.ctx.storage.getAlarm()).toBeNull()
    expect((await h.c.snapshot()).approvals[0]).toMatchObject({
      status: 'rejected',
      executionOutcome: 'rejected',
    })
    expect(h.continuation).toHaveBeenCalledTimes(1)
    expect(h.continuation.mock.calls[0][2]).toBe('rejected')
    expect(h.kody).not.toHaveBeenCalled()
  })

  it('rejects changed settings under the same pending command ID', async () => {
    const h = await setup()
    const command = create()
    const approval = await pending(h, command)
    expect(
      await h.propose({
        ...command,
        spec: { ...command.spec, name: 'Different settings' },
      }),
    ).toMatchObject({ ok: false, status: 409 })
    expect((await h.c.snapshot()).approvals).toEqual([approval])
    expect(scheduleRows(h)).toEqual([])
  })

  it('rejects an update that became stale during review without overwriting the newer settings', async () => {
    const h = await setup(timezone)
    await h.propose(create())
    const initial = scheduleRows(h)[0]
    const approval = await pending(h, {
      type: 'update',
      commandId: crypto.randomUUID(),
      id: initial.id,
      revision: initial.revision,
      spec: spec(otherTimezone),
    })
    const newer = { ...initial.spec, name: 'Newer manual settings' }
    expect(
      await h.c.changeSchedule(identity, {
        type: 'update',
        commandId: crypto.randomUUID(),
        id: initial.id,
        revision: initial.revision,
        spec: newer,
      }),
    ).toMatchObject({ ok: true })
    await h.c.decideApproval(approval.id, true, h.approvalInput)
    await h.settle()
    expect(scheduleRows(h)).toHaveLength(1)
    expect(scheduleRows(h)[0]).toMatchObject({ revision: 2, spec: newer })
    expect(receiptCount(h)).toBe(2)
    expect((await h.c.snapshot()).approvals[0]).toMatchObject({
      status: 'error',
      executionOutcome: 'failed',
      result: expect.stringContaining('schedule changed'),
    })
    expect(h.continuation.mock.calls[0][2]).toBe('failed')
  })

  it('rechecks the stored workspace policy instead of trusting the approval request policy', async () => {
    const h = await setup()
    const approval = await pending(h)
    await h.db`UPDATE chat_workspaces SET policy=${h.db.json({ ...defaultPolicy, allowChatModels: false })} WHERE id='w'`
    await h.c.decideApproval(approval.id, true, h.approvalInput)
    await h.settle()
    expect(scheduleRows(h)).toEqual([])
    expect(receiptCount(h)).toBe(0)
    expect((await h.c.snapshot()).approvals[0]).toMatchObject({
      status: 'error',
      executionOutcome: 'failed',
      result: expect.stringContaining('allowed Assistant model'),
    })
    expect(h.kody).not.toHaveBeenCalled()
  })

  it.each(['membership', 'archive'] as const)(
    'rechecks %s access before accepting approval',
    async (change) => {
      const h = await setup()
      const approval = await pending(h)
      if (change === 'membership')
        await h.db`DELETE FROM chat_memberships WHERE user_id=${identity.userId}`
      else
        await h.db`UPDATE chat_bots SET archived_at=${new Date(now)} WHERE id='b'`
      await expect(
        h.c.decideApproval(approval.id, true, h.approvalInput),
      ).rejects.toThrow(
        change === 'membership'
          ? 'Conversation not found'
          : 'Restore this conversation',
      )
      expect(scheduleRows(h)).toEqual([])
      expect(receiptCount(h)).toBe(0)
      expect((await h.c.snapshot()).approvals[0].status).toBe('pending')
      expect(h.continuation).not.toHaveBeenCalled()
      expect(h.kody).not.toHaveBeenCalled()
    },
  )

  it('rolls back the definition and success receipt when its alarm cannot be saved', async () => {
    const h = await setup()
    const approval = await pending(h)
    h.ctx.storage.setAlarm.mockRejectedValueOnce(
      new Error('Alarm write failed'),
    )
    await h.c.decideApproval(approval.id, true, h.approvalInput)
    await h.settle()
    expect(scheduleRows(h)).toEqual([])
    expect(receiptCount(h)).toBe(0)
    expect(await h.ctx.storage.getAlarm()).toBeNull()
    const state = await h.c.snapshot()
    expect(state.approvals[0]).toMatchObject({
      status: 'error',
      executionOutcome: 'failed',
    })
    expect(h.continuation.mock.calls[0][2]).toBe('failed')
    const restored = await h.reconstruct()
    expect((await restored.snapshot()).approvals[0]).toEqual(state.approvals[0])
    expect((await restored.scheduleSnapshot(identity)).schedules).toEqual([])
    expect(h.kody).not.toHaveBeenCalled()
  })

  it('can retry approval when saving its initial running state fails before execution', async () => {
    const h = await setup()
    const approval = await pending(h)
    vi.spyOn(h.ctx.storage, 'transactionSync').mockImplementationOnce(() => {
      throw new Error('Initial approval state could not be saved')
    })
    await expect(
      h.c.decideApproval(approval.id, true, h.approvalInput),
    ).rejects.toThrow('Initial approval state could not be saved')
    expect(scheduleRows(h)).toEqual([])
    expect(h.continuation).not.toHaveBeenCalled()
    await h.c.decideApproval(approval.id, true, h.approvalInput)
    await h.settle()
    expect(scheduleRows(h)).toHaveLength(1)
    expect(receiptCount(h)).toBe(1)
    expect(h.continuation).toHaveBeenCalledTimes(1)
  })

  it('can retry rejection when saving the decision fails before continuation', async () => {
    const h = await setup()
    const approval = await pending(h)
    vi.spyOn(h.ctx.storage, 'transactionSync').mockImplementationOnce(() => {
      throw new Error('Rejection state could not be saved')
    })
    await expect(
      h.c.decideApproval(approval.id, false, h.approvalInput),
    ).rejects.toThrow('Rejection state could not be saved')
    await h.c.decideApproval(approval.id, false, h.approvalInput)
    await h.settle()
    const saved = JSON.parse(
      h.local.prepare('SELECT json FROM state WHERE id=1').get()!
        .json as string,
    )
    expect(saved.approvals[0]).toMatchObject({
      status: 'rejected',
      executionOutcome: 'rejected',
    })
    expect(scheduleRows(h)).toEqual([])
    expect(h.continuation).toHaveBeenCalledTimes(1)
  })

  it('restores the exact pending command and records one native result after reconstruction', async () => {
    const h = await setup()
    const command = create()
    const approval = await pending(h, command)
    const restored = await h.reconstruct()
    const continuation = vi
      .spyOn(restored as any, 'resumeAssistantAction')
      .mockResolvedValue(undefined)
    const kody = vi
      .spyOn(restored as any, 'measuredKody')
      .mockRejectedValue(new Error('Unexpected Kody execution'))
    expect((await restored.snapshot()).approvals[0]).toEqual(approval)
    await restored.decideApproval(approval.id, true, h.approvalInput)
    await h.settle()
    expect(scheduleRows(h)).toHaveLength(1)
    expect(scheduleRows(h)[0].spec).toEqual(command.spec)
    const completed = (await restored.snapshot()).approvals[0]
    expect(completed).toMatchObject({
      status: 'done',
      executionOutcome: 'succeeded',
      schedule: { command },
    })
    const again = await h.reconstruct()
    expect((await again.snapshot()).approvals[0]).toEqual(completed)
    await again.decideApproval(approval.id, true, h.approvalInput)
    await h.settle()
    expect(scheduleRows(h)).toHaveLength(1)
    expect(receiptCount(h)).toBe(1)
    expect(continuation).toHaveBeenCalledTimes(1)
    expect(kody).not.toHaveBeenCalled()
  })

  it('preserves a committed success if the later assistant continuation fails', async () => {
    const h = await setup()
    const approval = await pending(h)
    h.continuation.mockRejectedValueOnce(new Error('Continuation interrupted'))
    await h.c.decideApproval(approval.id, true, h.approvalInput)
    await h.settle()
    expect(scheduleRows(h)).toHaveLength(1)
    const state = await h.c.snapshot()
    expect(state.status).toBe('error')
    expect(state.approvals[0]).toMatchObject({
      status: 'done',
      executionOutcome: 'succeeded',
      result: expect.any(String),
    })
    const restored = await h.reconstruct()
    expect((await restored.snapshot()).approvals[0]).toEqual(state.approvals[0])
    await restored.decideApproval(approval.id, true, h.approvalInput)
    await h.settle()
    expect(scheduleRows(h)).toHaveLength(1)
    expect(receiptCount(h)).toBe(1)
    expect(h.kody).not.toHaveBeenCalled()
  })

  it('does not commit an approved schedule after Stop during asynchronous validation', async () => {
    const h = await setup()
    const approval = await pending(h)
    const validation = pauseValidation(h)
    await h.c.decideApproval(approval.id, true, h.approvalInput)
    await validation.entered
    await h.c.stop()
    validation.release()
    await h.settle()
    expect(scheduleRows(h)).toEqual([])
    expect(receiptCount(h)).toBe(0)
    expect(await h.ctx.storage.getAlarm()).toBeNull()
    expect((await h.c.snapshot()).approvals[0]).toMatchObject({
      status: 'error',
      executionOutcome: 'failed',
    })
    expect(h.kody).not.toHaveBeenCalled()
  })

  it('does not directly create a matching-timezone schedule after Stop during validation', async () => {
    const h = await setup(timezone)
    const validation = pauseValidation(h)
    const change = h.propose(create())
    await validation.entered
    await h.c.stop()
    validation.release()
    expect(await change).toMatchObject({ ok: false, status: 409 })
    expect(scheduleRows(h)).toEqual([])
    expect(receiptCount(h)).toBe(0)
    expect((await h.c.snapshot()).approvals).toEqual([])
    expect(await h.ctx.storage.getAlarm()).toBeNull()
  })

  it('recovers an interrupted running review as pending with its exact proposal and no effect', async () => {
    const h = await setup()
    const command = create()
    const approval = await pending(h, command)
    const validation = pauseValidation(h)
    await h.c.decideApproval(approval.id, true, h.approvalInput)
    await validation.entered
    const saved = JSON.parse(
      h.local.prepare('SELECT json FROM state WHERE id=1').get()!
        .json as string,
    )
    expect(saved.approvals[0].status).toBe('running')
    expect(scheduleRows(h)).toEqual([])
    // Reconstruct the persisted pre-commit crash image in an isolated runtime.
    // Settle the abandoned writer first so it cannot write into that runtime.
    await h.c.stop()
    validation.release()
    await h.settle()
    const recovered = await conversationHarness(saved)
    expect((await recovered.c.snapshot()).approvals[0]).toMatchObject({
      id: approval.id,
      status: 'pending',
      schedule: { command },
    })
    expect(
      (await recovered.c.snapshot()).approvals[0].executionOutcome,
    ).toBeUndefined()
    expect((await recovered.c.scheduleSnapshot(identity)).schedules).toEqual([])
    expect(await recovered.ctx.storage.getAlarm()).toBeNull()
  })
})
