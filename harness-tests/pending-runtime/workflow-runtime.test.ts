import type { SqlStorage } from '@cloudflare/workers-types'
import { expect, it } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'
import { WorkflowRuns } from '../../src/chat/server/workflow-runs'

async function setup() {
  const owner = {
    workspaceId: 'w',
    userId: '00000000-0000-4000-8000-000000000001',
    botId: 'b',
    conversationId: 'main-conversation',
  }
  const h = await conversationHarness({ identity: owner })
  const store = new WorkflowRuns(h.ctx.storage.sql as unknown as SqlStorage)
  const now = Date.now(),
    id = crypto.randomUUID(),
    execution = crypto.randomUUID()
  store.create({
    id,
    workflowId: crypto.randomUUID(),
    definitionRevision: 1,
    definition: {
      version: 1,
      name: 'Runtime test',
      steps: [
        {
          id: 'read',
          name: 'Read',
          objective: 'Read a synthetic note',
          dependsOn: [],
          inputs: [],
          failure: 'stop',
        },
      ],
    },
    scope: owner,
    model: { provider: 'included', model: h.env.INCLUDED_MODEL },
    sources: [],
    operationLimits: { model: 1, tool: 1, repair: 0 },
    triggerId: 'manual',
    createdAt: now,
    deadline: now + 60000,
    concurrency: 1,
  })
  const admission = store.claim(id, 'read', execution, now).steps[0].admission!
  await h.db`INSERT INTO chat_conversations(id,bot_id,user_id,created_at) VALUES(${execution},'b',${owner.userId},${now})`
  return {
    ...h,
    store,
    id,
    admission,
    child: { ...owner, conversationId: execution },
    operation: {
      id: 'attempt',
      executionId: execution,
      kind: 'model' as const,
    },
  }
}
it('checks and reserves workflow authority through an idle Conversation host and reconstruction', async () => {
  const h = await setup()
  expect((await h.c.snapshot()).assistantTask).toBeUndefined()
  expect(await h.c.workflowGrant(h.child, h.admission)).toEqual(h.admission)
  const receipt = await h.c.reserveWorkflowOperation(
    h.child,
    h.admission,
    h.operation,
  )
  const restored = await h.reconstruct()
  expect(
    await restored.reserveWorkflowOperation(h.child, h.admission, h.operation),
  ).toEqual(receipt)
  expect(h.store.get(h.id)!.operations).toHaveLength(1)
  await expect(
    restored.reserveWorkflowOperation(h.child, h.admission, {
      ...h.operation,
      id: 'second',
    }),
  ).rejects.toThrow('shared model limit')
  expect((await restored.snapshot()).messages).toEqual([])
})
it('rejects cancelled authority after reconstruction without clearing its receipt', async () => {
  const h = await setup()
  h.store.cancel(h.id, 'user', Date.now())
  const restored = await h.reconstruct()
  await expect(restored.workflowGrant(h.child, h.admission)).rejects.toThrow(
    'no longer active',
  )
  await expect(
    restored.reserveWorkflowOperation(h.child, h.admission, h.operation),
  ).rejects.toThrow('no longer active')
  expect(h.store.get(h.id)!.operations).toEqual([])
  expect(h.store.get(h.id)!.steps[0].admission).toEqual(h.admission)
})
it('rechecks membership and exact child identity through the host RPC', async () => {
  const h = await setup()
  await expect(
    h.c.workflowGrant({ ...h.child, userId: 'other' }, h.admission),
  ).rejects.toThrow('Conversation not found')
  await h.db`DELETE FROM chat_memberships WHERE user_id=${h.child.userId}`
  const restored = await h.reconstruct()
  await expect(
    restored.reserveWorkflowOperation(h.child, h.admission, h.operation),
  ).rejects.toThrow('Conversation not found')
  expect(h.store.get(h.id)!.operations).toEqual([])
})
