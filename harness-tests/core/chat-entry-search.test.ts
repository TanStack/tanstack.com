import { expect, it, vi } from 'vitest'
import { validateWorkspaceSearch } from '../../src/chat/core/navigation'

const entry = vi.hoisted(() => {
  const beforeLoads: ((context: {
    search: ReturnType<typeof validateWorkspaceSearch>
  }) => Promise<never>)[] = []
  return { beforeLoads }
})
vi.mock('@tanstack/react-router', () => ({
  createFileRoute:
    () =>
    (options: { beforeLoad: Parameters<typeof entry.beforeLoads.push>[0] }) => {
      entry.beforeLoads.push(options.beforeLoad)
      return options
    },
  redirect: (options: Record<string, unknown>) => options,
}))
vi.mock('../../src/utils/auth.functions', () => ({
  getCurrentUser: async () => ({ userId: 'shared-user' }),
}))
vi.mock('../../src/chat/workspace.functions', () => ({
  loadChatWorkspace: async () => ({
    workspace: { id: 'personal:shared-user' },
    assistantId: 'assistant:shared-user',
    conversationId: 'conversation',
  }),
}))

it('preserves validated navigation while opening the authenticated personal assistant', async () => {
  await import('../../src/routes/chat.index')
  expect(entry.beforeLoads).toHaveLength(1)
  const search = validateWorkspaceSearch({
    settings: 'appearance',
    sort: 'activity',
    code: 'private',
  })
  await expect(entry.beforeLoads[0]({ search })).rejects.toEqual({
    to: '/chat/c/$conversationId',
    params: {
      conversationId: 'conversation',
    },
    search: { ...search, conversation: undefined },
  })
  expect(search).not.toHaveProperty('code')
  expect(search.settings).toBe('appearance')
})
