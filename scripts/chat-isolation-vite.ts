import type { PluginOption } from 'vite'

// Route matching needs synchronous search validation. Cloudflare also requires
// its exported classes at startup. Neither may import the chat implementation.
const eagerChatModules = new Set([
  'core/navigation.ts',
  'core/workspace-panels.ts',
  'server/entries.ts',
])

export function chatIsolation(): PluginOption {
  return {
    name: 'tanstack-chat-isolation',
    apply: 'build',
    applyToEnvironment: (environment) =>
      ['client', 'ssr'].includes(environment.name),
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(
        (item) => item.type === 'chunk',
      )
      const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))
      const pending = chunks
        .filter(
          (chunk) =>
            chunk.isEntry ||
            Object.keys(chunk.modules).some((id) =>
              id.endsWith('/src/router.tsx'),
            ),
        )
        .map((chunk) => chunk.fileName)
      const visited = new Set<string>()
      const violations = new Set<string>()
      while (pending.length) {
        const name = pending.pop()!
        if (visited.has(name)) continue
        visited.add(name)
        const chunk = byName.get(name)
        if (!chunk) continue
        pending.push(...chunk.imports)
        for (const [id, module] of Object.entries(chunk.modules)) {
          const chatPath = id.split('/src/chat/')[1]
          if (
            module.renderedLength &&
            chatPath &&
            !eagerChatModules.has(chatPath)
          ) {
            violations.add(chatPath)
          }
        }
      }
      if (violations.size) {
        this.error(
          `TanChat must load on demand. Eager modules:\n${[...violations].sort().join('\n')}`,
        )
      }
    },
  }
}
