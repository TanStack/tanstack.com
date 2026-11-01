import type { SqlStorage } from '@cloudflare/workers-types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { newAssistantTask } from '../../src/chat/core/assistant-task'
import { ConversationRuns } from '../../src/chat/server/conversation-runs'
import { KodyMemoryError } from '../../src/chat/server/kody-memory'
import { conversationHarness } from './fixtures/conversation-runtime'

const apply = vi.hoisted(() => vi.fn())
vi.mock('../../src/chat/server/kody-memory-create', () => ({
  reviewKodyMemoryCreate: vi.fn(),
  applyKodyMemoryCreate: apply,
}))

afterEach(() => {
  vi.restoreAllMocks()
  apply.mockReset()
})

async function setup() {
  const request = 'Remember this across my agents.'
  const task = newAssistantTask(request, 'message')
  const h = await conversationHarness({
    currentRunId: 'message',
    assistantTask: task,
    messages: [
      {
        id: 'message',
        role: 'user',
        parts: [{ type: 'text', content: request }],
      },
    ],
  })
  const runs = new ConversationRuns(h.ctx.storage.sql as unknown as SqlStorage)
  runs.accept({
    id: 'message',
    origin: { kind: 'user', messageId: 'message' },
    identity: {
      workspaceId: 'w',
      userId: '00000000-0000-4000-8000-000000000001',
      botId: 'b',
      conversationId: 'main-conversation',
    },
    mode: 'assistant',
    status: 'running',
    createdAt: Date.now(),
    startedAt: Date.now(),
    assistantTaskId: task.id,
    executionId: 'execution',
  })
  const approval = (h.c as any).approval('Save to Kody memory: My fact', '')
  approval.kodyMemoryCreate = {
    token: 'review-token',
    candidate: { subject: 'My fact', summary: 'A test fact', details: '' },
    related: [],
  }
  approval.resumeRequest = request
  await (h.c as any).save()
  const continuation = vi
    .spyOn(h.c as any, 'resumeAssistantAction')
    .mockResolvedValue(undefined)
  return {
    ...h,
    approval,
    continuation,
    input: { ...h.input('message'), fixture: false },
  }
}

describe('assistant Kody memory approval', () => {
  it('only reports a save after Kody confirms it, using the reviewed token', async () => {
    const h = await setup()
    apply.mockResolvedValue({ id: 'memory-1', subject: 'My fact' })
    await h.c.decideApproval(h.approval.id, true, h.input)
    await h.settle()
    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply.mock.calls[0][3]).toBe('review-token')
    expect(h.approval.status).toBe('done')
    expect(h.approval.executionOutcome).toBe('succeeded')
    expect(h.continuation).toHaveBeenCalledWith(
      h.approval,
      h.input,
      'succeeded',
      expect.objectContaining({ scope: 'kody-shared' }),
    )
  })

  it('keeps an uncertain write pending for retry with the same token', async () => {
    const h = await setup()
    apply
      .mockRejectedValueOnce(new KodyMemoryError('Kody may have saved it.'))
      .mockResolvedValueOnce({ id: 'memory-1', subject: 'My fact' })
    await h.c.decideApproval(h.approval.id, true, h.input)
    await h.settle()
    expect(h.approval.status).toBe('pending')
    expect(h.approval.executionOutcome).toBe('unknown')
    expect(h.continuation).not.toHaveBeenCalled()
    await h.c.decideApproval(h.approval.id, true, h.input)
    await h.settle()
    expect(apply.mock.calls.map((call) => call[3])).toEqual([
      'review-token',
      'review-token',
    ])
    expect(h.approval.executionOutcome).toBe('succeeded')
  })

  it('does not retry a confirmed review conflict', async () => {
    const h = await setup()
    apply.mockRejectedValue(new KodyMemoryError('Review changed.', 409))
    await h.c.decideApproval(h.approval.id, true, h.input)
    await h.settle()
    expect(h.approval.status).toBe('error')
    expect(h.approval.executionOutcome).toBe('failed')
    expect(h.continuation).toHaveBeenCalledWith(h.approval, h.input, 'failed', {
      ok: false,
      error: 'Review changed.',
    })
  })

  it('does not call Kody when the person cancels the review', async () => {
    const h = await setup()
    await h.c.decideApproval(h.approval.id, false, h.input)
    await h.settle()
    expect(apply).not.toHaveBeenCalled()
    expect(h.approval.executionOutcome).toBe('rejected')
  })

  it('keeps the same review available after an interrupted write', async () => {
    const h = await setup()
    h.approval.status = 'running'
    ;(h.c as any).state.status = 'running'
    await (h.c as any).save()
    const restored = await h.reconstruct()
    const review = (await restored.snapshot()).approvals.find(
      (item) => item.id === h.approval.id,
    )!
    expect(review).toMatchObject({
      status: 'pending',
      executionOutcome: 'unknown',
      kodyMemoryCreate: { token: 'review-token' },
    })
    expect(apply).not.toHaveBeenCalled()
  })
})
