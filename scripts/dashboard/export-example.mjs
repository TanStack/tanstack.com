import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
const destination = process.argv[2]
if (!destination)
  throw new Error('Usage: pnpm dashboard:extract /path/to/new-directory')
const root = resolve(destination)
await mkdir(root) // Never overwrite an existing project.
const put = async (name, content) => {
  const path = resolve(root, name)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}
for (const path of [
  'src/components/dashboard',
  'src/server/runtime/blob-storage.server.ts',
  'src/components/charts/Chart.tsx',
  'src/components/npm-stats/Resizable.tsx',
  'public/data/dashboard',
  'scripts/dashboard/seed.ts',
  'scripts/dashboard/local-db.ts',
  'scripts/dashboard/regression.mjs',
  'scripts/dashboard/benchmark.ts',
  'tests/dashboard.test.ts',
  'tests/dashboard-grid.test.ts',
  'tests/dashboard-query.test.ts',
  'tests/dashboard-cache.test.ts',
  'tests/dashboard-server.test.ts',
  'tests/dashboard-keyboard.test.ts',
  'src/routes/examples.dashboard.tsx',
  'src/routes/api/dashboard-export.ts',
  'docs/dashboard',
]) {
  await mkdir(dirname(resolve(root, path)), { recursive: true })
  await cp(path, resolve(root, path), { recursive: true })
}
const routePath = 'src/routes/examples.dashboard.tsx'
await put(
  routePath,
  (await readFile(resolve(root, routePath), 'utf8')).replace(
    '  staticData: { showNavbar: false },\n',
    '',
  ),
)
const source = JSON.parse(await readFile('package.json', 'utf8'))
const names = [
  '@tanstack/react-start',
  '@tanstack/react-router',
  '@tanstack/react-router-ssr-query',
  '@tanstack/react-query',
  '@tanstack/react-table',
  '@tanstack/react-virtual',
  '@tanstack/react-db',
  '@tanstack/charts',
  '@base-ui/react',
  '@mui/material',
  '@emotion/react',
  '@emotion/styled',
  '@phosphor-icons/react',
  'd3-scale',
  'react',
  'react-dom',
  'zod',
  'postgres',
  '@electric-sql/pglite',
  '@electric-sql/pglite-socket',
  'playwright-core',
]
const devNames = [
  'vite',
  '@vitejs/plugin-react',
  '@tailwindcss/vite',
  'tailwindcss',
  'typescript',
  'tsx',
  '@types/react',
  '@types/react-dom',
  '@types/node',
  '@types/d3-scale',
]
const versions = { ...source.dependencies, ...source.devDependencies }
for (const name of [...names, ...devNames])
  if (!versions[name]) throw new Error(`Missing dependency ${name}`)
await put(
  'package.json',
  JSON.stringify(
    {
      name: 'tanstack-dashboard-example',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite --host 127.0.0.1',
        build: 'vite build',
        'dashboard:db': 'tsx scripts/dashboard/local-db.ts',
        'dashboard:seed': 'tsx scripts/dashboard/seed.ts',
        'test:browser': 'node scripts/dashboard/regression.mjs',
        test: 'tsx --test tests/dashboard*.test.ts',
        'dashboard:benchmark': 'tsx scripts/dashboard/benchmark.ts',
      },
      dependencies: Object.fromEntries(
        names.map((name) => [name, versions[name]]),
      ),
      devDependencies: Object.fromEntries(
        devNames.map((name) => [name, versions[name]]),
      ),
    },
    null,
    2,
  ),
)
await put(
  'vite.config.ts',
  `import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
export default defineConfig({ resolve: { alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) } }, plugins: [tailwind(), tanstackStart(), react()] })
`,
)
await put(
  'tsconfig.json',
  JSON.stringify(
    {
      include: ['src', 'vite.config.ts'],
      compilerOptions: {
        strict: true,
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        jsx: 'react-jsx',
        esModuleInterop: true,
        skipLibCheck: true,
        noEmit: true,
        paths: { '~/*': ['./src/*'] },
      },
    },
    null,
    2,
  ),
)
await put(
  'src/server/runtime/host.server.ts',
  `export async function getHostRuntimeEnv(): Promise<Record<string, unknown>> { return process.env }\nexport function isIsolateRuntime() { return false }\n`,
)
await put(
  'src/styles.css',
  '@import "tailwindcss";\nbody { margin: 0; font-family: system-ui, sans-serif; }\n',
)
await put(
  'src/routes/__root.tsx',
  `import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import styles from '../styles.css?url'
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({ head: () => ({ meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }], links: [{ rel: 'stylesheet', href: styles }] }), component: () => <html><head><HeadContent /></head><body><Outlet /><Scripts /></body></html> })
`,
)
await put(
  'src/routes/index.tsx',
  `import { createFileRoute, redirect } from '@tanstack/react-router'
import { dashboardSearch } from '../components/dashboard/model'
export const Route = createFileRoute('/')({ beforeLoad: () => { throw redirect({ to: '/examples/dashboard', search: dashboardSearch.parse({}) }) } })
`,
)
await put(
  'src/router.tsx',
  `import { createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'
export function getRouter() {
  const queryClient = new QueryClient()
  const router = createRouter({ routeTree, context: { queryClient } })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}
declare module '@tanstack/react-router' { interface Register { router: ReturnType<typeof getRouter> } }
`,
)
await put('src/vite-env.d.ts', '/// <reference types="vite/client" />\n')
await put('.gitignore', 'node_modules\ndist\n.dashboard-db\n.env*\n')
await put(
  'README.md',
  `# TanStack dashboard reference\n\nRun pnpm install, then pnpm dashboard:db in one terminal. In another:\n\n\`\`\`sh\nexport DASHBOARD_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5441/postgres\npnpm dashboard:seed\npnpm dev --port 3211\n\`\`\`\n\nOpen /examples/dashboard. Use source=client without a database.\n\nThis project uses standard React, not the site's Redact adapter. It has no site authentication, analytics, production database binding, or content build. The two shared presentation components are copied explicitly. See docs/dashboard/reference.md for the data contract and replacement guide, and docs/dashboard/production.md before deployment.\n`,
)
console.log(root)
