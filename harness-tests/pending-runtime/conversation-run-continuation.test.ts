import type { SqlStorage } from '@cloudflare/workers-types'
import { expect, it } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'
import { newAssistantTask } from '../../src/chat/core/assistant-task'
import { ConversationRuns } from '../../src/chat/server/conversation-runs'
import type { Approval } from '../../src/chat/core/types'

const identity = {
  workspaceId: 'w',
  userId: '00000000-0000-4000-8000-000000000001',
  botId: 'b',
  conversationId: 'main-conversation',
}
async function waiting(kind: 'setup' | 'approval', indexed = true) {
  const task = {
    ...newAssistantTask('Finish the task', 'original'),
    status: 'waiting' as const,
  }
  const approval: Approval = {
    id: 'approval',
    title: 'Reviewed action',
    code: 'export default () => "synthetic result"',
    status: 'pending',
    messageId: 'original',
    assistantTaskId: task.id,
    resumeRequest: task.objective,
    turnId: task.id,
  }
  const h = await conversationHarness({
    identity,
    currentRunId: 'original',
    assistantTask: task,
    turnTimings: { original: { startedAt: 1 } },
    messages: [
      {
        id: 'original',
        role: 'user',
        parts: [{ type: 'text', content: task.objective }],
      },
    ],
    ...(kind === 'setup'
      ? {
          pendingTask: {
            id: 'setup',
            kind: 'external-step',
            turnId: task.id,
            request: task.objective,
            title: 'Connect account',
            instructions: 'Finish setup',
            url: 'https://example.com/setup',
            evidenceRef: 'guide:setup',
          },
        }
      : { approvals: [approval] }),
  })
  const runs = new ConversationRuns(h.ctx.storage.sql as unknown as SqlStorage)
  if (indexed) {
    runs.accept({
      id: 'original',
      origin: { kind: 'user', messageId: 'original' },
      identity,
      mode: 'assistant',
      status: 'running',
      createdAt: 1,
      startedAt: 1,
      assistantTaskId: task.id,
      executionId: 'initial-execution',
    })
    runs.update('original', {
      status: kind === 'setup' ? 'waiting_user' : 'waiting_approval',
      updatedAt: 2,
    })
  }
  return { ...h, task, runs }
}

it('continues setup under the same durable run and original start time', async () => {
  const h = await waiting('setup')
  const accepted = await h.c.continueTask('setup', h.input('unused'))
  expect(accepted).toMatchObject({
    runId: 'original',
    executionId: expect.any(String),
  })
  expect(h.runs.list().items).toHaveLength(1)
  expect(h.runs.get('original')).toMatchObject({
    status: 'running',
    startedAt: 1,
    assistantTaskId: h.task.id,
    executionId: accepted.executionId,
  })
  await h.settle()
  expect(h.runs.list().items).toHaveLength(1)
  expect(h.runs.get('original')).toMatchObject({
    status: 'completed',
    startedAt: 1,
    assistantTaskId: h.task.id,
  })
  await expect(h.c.continueTask('setup', h.input('unused'))).rejects.toThrow(
    'no longer waiting',
  )
  await h.c.begin(h.input('next', 'A different task'))
  await h.settle()
  expect(h.runs.list().items.map((r) => r.id)).toEqual(['next', 'original'])
})

it.each([true, false])(
  'keeps the same receipt after approval decision %s and settles once',
  async (approve) => {
    const h = await waiting('approval')
    await h.c.decideApproval('approval', approve, h.input('unused'))
    await h.settle()
    const state = await h.c.snapshot()
    expect(state.error).toBeUndefined()
    expect(h.runs.list().items).toHaveLength(1)
    expect(h.runs.get('original')).toMatchObject({
      status: 'completed',
      startedAt: 1,
      assistantTaskId: h.task.id,
    })
    expect(state.approvals[0].executionOutcome).toBe(
      approve ? 'succeeded' : 'rejected',
    )
    await expect(
      h.c.decideApproval('approval', approve, h.input('unused')),
    ).rejects.toThrow('already been handled')
  },
)

it('does not invent a new admission when continuing an older unindexed task', async () => {
  const h = await waiting('setup', false)
  await h.c.continueTask('setup', h.input('unused'))
  await h.settle()
  expect((await h.c.snapshot()).error).toBeUndefined()
  expect(h.runs.list().items).toEqual([])
})

it('reset cancels a waiting task, keeps its receipt and cannot replay its original send', async () => {
  const h = await waiting('setup')
  await h.c.reset()
  expect((await h.c.snapshot()).messages).toEqual([])
  expect(h.runs.get('original')).toMatchObject({
    status: 'cancelled',
    completedAt: expect.any(Number),
  })
  expect(await h.c.begin(h.input('original'))).toEqual({ duplicate: true })
  expect((await h.c.snapshot()).messages).toEqual([])
  expect(await h.c.sendReceipt('original')).toEqual({ accepted: true })
})

it('does not revive a cancelled task if publishing the reset snapshot fails', async () => {
  const h = await waiting('setup')
  const transaction = h.ctx.storage.transactionSync
  let commits = 0
  h.ctx.storage.transactionSync = (work) => {
    if (++commits === 2) throw new Error('Snapshot persistence interrupted')
    return transaction(work)
  }
  await expect(h.c.reset()).rejects.toThrow('Snapshot persistence interrupted')
  h.ctx.storage.transactionSync = transaction
  const restored = await h.reconstruct()
  const state = await restored.snapshot()
  expect(state.messages).toEqual([])
  expect(state.pendingTask).toBeUndefined()
  expect(state.runs).toMatchObject([{ id: 'original', status: 'cancelled' }])
  await expect(
    restored.continueTask('setup', h.input('unused')),
  ).rejects.toThrow('no longer waiting')
})
