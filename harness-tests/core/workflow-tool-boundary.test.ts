import { expect, it, vi } from 'vitest'
const services = vi.hoisted(() => ({
  command: vi.fn(),
  list: vi.fn(),
  read: vi.fn(),
}))
vi.mock('../../src/chat/server/workflows', async (original) => ({
  ...(await original()),
  Workflows: class {
    command = services.command
    list = services.list
    read = services.read
  },
}))
import { workflowDefinitionSchema } from '../../src/chat/core/workflows'
import { assistantWorkflowTools } from '../../src/chat/server/assistant-workflow-tools'
const identity = {
  workspaceId: 'personal',
  userId: '00000000-0000-4000-8000-000000000001',
  botId: 'assistant',
  conversationId: 'chat',
}
const base = {
  identity,
  env: { CONVERSATIONS: { getByName: vi.fn() } },
  assertCurrent: () => {},
  userOrigin: true,
}
it('exposes no workflow tools to a non-user task', () => {
  expect(assistantWorkflowTools({ ...base, userOrigin: false })).toEqual([])
})
it('requires task identity for definitions and execution tools', () => {
  const names = assistantWorkflowTools(base).map((tool) => tool.name)
  expect(names).toContain('read_workflow')
  expect(names).not.toContain('create_workflow')
  expect(names).not.toContain('start_workflow')
})
it('retries the same definition with stable workflow and command identities', async () => {
  services.command.mockResolvedValue({ revision: 1 })
  const tool = assistantWorkflowTools({ ...base, taskId: 'task' }).find(
    (tool) => tool.name === 'create_workflow',
  )!
  const input = {
    definition: workflowDefinitionSchema.parse({
      version: 1,
      name: 'Review',
      steps: [
        { id: 'review', name: 'Review', objective: 'Review supplied notes' },
      ],
    }),
  }
  await tool.execute!(input)
  await tool.execute!(input)
  expect(services.command.mock.calls[0][0]).toEqual(
    services.command.mock.calls[1][0],
  )
  expect(services.command.mock.calls[0][0].expectedRevision).toBe(0)
  expect(base.env.CONVERSATIONS.getByName).not.toHaveBeenCalled()
})
