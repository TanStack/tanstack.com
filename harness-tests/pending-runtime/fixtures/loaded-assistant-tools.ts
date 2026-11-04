import { vi } from 'vitest'

// These downstream capability tests start after tool discovery. Keep real tool
// definitions, executors, and authorization, but seed the loaded inventory so
// their scripted model replies can focus on files, approvals, delegation, etc.
// assistant-discovery*.test.ts exercise initial loading and persistence separately.
vi.mock('../../../src/chat/server/assistant-discovery', async (original) => {
  const actual =
    await original<
      typeof import('../../../src/chat/server/assistant-discovery')
    >()
  return {
    ...actual,
    assistantToolDiscovery: (
      options: Parameters<typeof actual.assistantToolDiscovery>[0],
    ) =>
      actual.assistantToolDiscovery({
        ...options,
        loadedNames: options.tools.map((tool) => tool.name),
      }),
  }
})
