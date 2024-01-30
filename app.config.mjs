import { createApp } from 'vinxi'
import reactRefresh from '@vitejs/plugin-react'
import { serverFunctions } from '@vinxi/server-functions/plugin'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'
import { config } from 'vinxi/plugins/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import { serverTransform } from '@vinxi/server-functions/server'
import { normalize } from 'vinxi/lib/path'

const customVite = () =>
  config('dev', {
    resolve: {
      dedupe: [
        'react',
        'react-dom',
        '@tanstack/store',
        '@tanstack/react-store',
        '@tanstack/react-router',
        '@tanstack/react-router-server',
        '@tanstack/react-cross-context',
        '@tanstack/history',
        'use-sync-external-store',
      ],
    },
  })

export default createApp({
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
        tsconfigPaths(),
        serverTransform({
          runtime: `@tanstack/react-router-server/server-runtime`,
        }),
        reactRefresh(),
        TanStackRouterVite(),
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
      plugins: () => [
        customVite(),
        tsconfigPaths(),
        serverFunctions.client({
          runtime: `@tanstack/react-router-server/client-runtime`,
        }),
        reactRefresh(),
        // TanStackRouterVite(),
      ],
      base: '/_build',
    },
    serverFunctions.router({
      plugins: () => [tsconfigPaths()],
      handler: `@tanstack/react-router-server/server-handler`,
      runtime: `@tanstack/react-router-server/server-runtime`,
    }),
  ],
})
