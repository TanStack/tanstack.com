import { createApp } from 'vinxi'
import reactRefresh from '@vitejs/plugin-react'
import { serverFunctions } from '@vinxi/server-functions/plugin'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'
import { config } from 'vinxi/plugins/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import { serverTransform } from '@vinxi/server-functions/server'
import { normalize } from 'vinxi/lib/path'
import { resolve } from 'import-meta-resolve'
import path from 'path'
import { fileURLToPath } from 'url'

const customVite = () =>
  config('dev', (router, app, env) => ({
    // ssr: {
    //   noExternal: [/start\/dist\/esm\/server-runtime/],
    //   external: ['react', 'react-dom'],
    // },
    // optimizeDeps: {
    //   include: [
    //     'node_modules@tanstack/start/**/*.js',
    //     'react-icons',
    //     'shiki',
    //   ],
    // },
    resolve: {
      dedupe: [
        ...(env.command !== 'build'
          ? [
              'react',
              'react-dom',
              '@tanstack/store',
              '@tanstack/react-store',
              '@tanstack/react-router',
              '@tanstack/start',
              '@tanstack/react-cross-context',
              '@tanstack/history',
              'use-sync-external-store',
            ]
          : []),
      ],
    },
    // plugins: [
    //   {
    //     name: 'inline-env-vars-as-prefix',
    //     // Write the env vars for some specific keys into the bundle at the very beginning of the file
    //     // using a (globalThis || window).tsr_env object.
    //     intro: `(globalThis || window).ROUTER_NAME = import.meta.env.ROUTER_NAME`,
    //   },
    // ],
  }))

export default createApp({
  server: {
    preset: 'vercel',
    experimental: {
      asyncStorage: true,
      asyncContext: true,
    },
  },
  routers: [
    {
      name: 'public',
      type: 'static',
      dir: './public',
      base: '/',
    },
    {
      name: 'ssr',
      type: 'http',
      handler: './app/server.tsx',
      target: 'server',
      plugins: () => [
        customVite(),
        TanStackRouterVite({
          experimental: {
            enableCodeSplitting: true,
          },
        }),
        tsconfigPaths(),
        serverTransform({
          runtime: `@tanstack/start/server-runtime`,
        }),
      ],
      link: {
        client: 'client',
      },
    },
    {
      name: 'client',
      type: 'client',
      handler: './app/client.tsx',
      target: 'browser',
      base: '/_build',
      plugins: () => [
        TanStackRouterVite({
          experimental: {
            enableCodeSplitting: true,
          },
        }),
        customVite(),
        tsconfigPaths(),
        serverFunctions.client({
          runtime: `@tanstack/start/client-runtime`,
        }),
        reactRefresh(),
      ],
    },
    serverFunctions.router({
      name: 'server',
      plugins: () => [customVite(), tsconfigPaths()],
      handler: resolveToRelative('@tanstack/start/server-handler'),
      runtime: `@tanstack/start/server-runtime`,
    }),
  ],
})

function resolveToRelative(p) {
  const toAbsolute = (file) => file.split('://').at(-1)

  const resolved = toAbsolute(resolve(p, import.meta.url))

  const relative = path.relative(
    path.resolve(toAbsolute(import.meta.url), '..'),
    resolved
  )

  return relative
}
