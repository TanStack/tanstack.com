import { expect, it, vi } from 'vitest'
import { validateWorkspaceSearch } from '../../src/chat/core/navigation'

const entry = vi.hoisted(() => {
  const components: (() => unknown)[] = []
  return { components, navigate: vi.fn(), setQueryData: vi.fn() }
})
const search = validateWorkspaceSearch({
  settings: 'appearance',
  sort: 'activity',
  code: 'private',
})
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: { component: () => unknown }) => {
    entry.components.push(options.component)
    return { options, useSearch: () => search }
  },
  useNavigate: () => entry.navigate,
}))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useEffect: (effect: () => void) => effect(),
}))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: () => ({
    data: {
      workspace: { id: 'personal:shared-user', ownerId: 'shared-user' },
      assistantId: 'assistant:shared-user',
      conversationId: 'conversation',
    },
  }),
  useQueryClient: () => ({ setQueryData: entry.setQueryData }),
}))
vi.mock('../../src/chat/workspace.functions', () => ({
  loadChatWorkspace: vi.fn(),
  resolveChatRoute: vi.fn(),
}))

it('preserves validated navigation while opening the personal assistant without a blocking route loader', async () => {
  const { Route } = await import('../../src/routes/chat.index')
  expect(Route.options.beforeLoad).toBeUndefined()
  entry.components[0]()
  expect(entry.navigate).toHaveBeenCalledWith({
    to: '/chat/c/$conversationId',
    params: { conversationId: 'conversation' },
    search: { ...search, conversation: undefined },
    replace: true,
  })
  expect(entry.setQueryData).toHaveBeenCalledWith(
    ['chat-identity', 'conversation'],
    {
      conversationId: 'conversation',
      botId: 'assistant:shared-user',
      workspaceId: 'personal:shared-user',
      userId: 'shared-user',
    },
  )
  expect(search).not.toHaveProperty('code')
  expect(search.settings).toBe('appearance')
})
