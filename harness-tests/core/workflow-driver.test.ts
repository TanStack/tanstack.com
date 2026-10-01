import { expect, it, vi } from 'vitest'
vi.mock('cloudflare:workers', () => ({
  WorkflowEntrypoint: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}))
import { TanChatWorkflow } from '../../src/chat/server/workflow-driver'

it('reconciles through stable durable steps and persists status only', async () => {
  const advance = vi
    .fn()
    .mockResolvedValueOnce({
      request: { deadline: Date.now() + 30000 },
      steps: [{ status: 'dispatched' }],
    })
    .mockResolvedValueOnce({
      request: { deadline: Date.now() + 30000 },
      steps: [{ status: 'completed' }],
    })
  const driver = new TanChatWorkflow(
    {} as never,
    {
      CONVERSATIONS: { getByName: () => ({ advanceWorkflowRun: advance }) },
    } as never,
  )
  const receipts: unknown[] = []
  const step = {
    do: vi.fn(async (_name, _config, fn) => {
      const result = await fn()
      receipts.push(result)
      return result
    }),
    sleep: vi.fn(async () => {}),
  }
  const params = {
    owner: { workspaceId: 'w', userId: 'u', botId: 'b', conversationId: 'c' },
    runId: crypto.randomUUID(),
  }
  const result = await driver.run({ payload: params } as never, step as never)
  expect(result).toEqual({ runId: params.runId, status: 'completed' })
  expect(step.do.mock.calls.map((call) => call[0])).toEqual([
    'reconcile-0',
    'reconcile-1',
  ])
  expect(advance).toHaveBeenCalledWith(params.owner, params.runId)
  expect(receipts[0]).toEqual({
    status: 'running',
    deadline: expect.any(Number),
    checkedAt: expect.any(Number),
  })
  expect(step.sleep).toHaveBeenCalledOnce()
})
it('does not report success or start another model loop when reconciliation fails', async () => {
  const driver = new TanChatWorkflow(
    {} as never,
    {
      CONVERSATIONS: {
        getByName: () => ({
          advanceWorkflowRun: async () => {
            throw Error('Unavailable')
          },
        }),
      },
    } as never,
  )
  const step = {
    do: async (_name: string, _config: unknown, fn: () => Promise<unknown>) =>
      fn(),
    sleep: vi.fn(),
  }
  await expect(
    driver.run(
      {
        payload: {
          owner: {
            workspaceId: 'w',
            userId: 'u',
            botId: 'b',
            conversationId: 'c',
          },
          runId: crypto.randomUUID(),
        },
      } as never,
      step as never,
    ),
  ).rejects.toThrow('Unavailable')
  expect(step.sleep).not.toHaveBeenCalled()
})
