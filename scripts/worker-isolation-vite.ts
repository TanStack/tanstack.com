import type { PluginOption } from 'vite'

// Check every uploaded module, including lazy chunks. Lazy loading alone does
// not remove a dependency from a Cloudflare Worker deployment.
const excludedSiteModules = [
  '/src/server/og/generate.server.ts',
  '/src/chat/server/conversation.ts',
  '/src/chat/server/run-models.ts',
  '/src/chat/server/workflow-driver.ts',
  '/src/chat/server/workspace-sync-object.ts',
  '/src/chat/components/App.tsx',
  '/src/components/ds/phosphor-icons.generated.ts',
  '/src/application-starter/api/create-worker.ts',
  '/src/chat/server/http/',
  '/src/application-starter/api/http/',
  '/node_modules/@tanstack/create/',
]

export function workerIsolation(): PluginOption {
  return {
    name: 'tanstack-worker-isolation',
    apply: 'build',
    applyToEnvironment: (environment) => environment.name === 'ssr',
    generateBundle(_options, bundle) {
      const violations = new Set<string>()
      for (const item of Object.values(bundle)) {
        if (item.type !== 'chunk') continue
        for (const [id, module] of Object.entries(item.modules)) {
          // The site's existing example deployment API uses these six small provider templates.
          const providerTemplate =
            /\/generated\/worker\/frameworks\/(react|solid)\/add-ons\/(cloudflare|netlify|railway)\.js$/.test(
              id,
            )
          if (
            module.renderedLength &&
            !providerTemplate &&
            excludedSiteModules.some((path) => id.includes(path))
          )
            violations.add(id)
        }
      }
      if (violations.size)
        this.error(
          `Heavy features must stay out of the site Worker:\n${[...violations].sort().join('\n')}`,
        )
    },
  }
}
