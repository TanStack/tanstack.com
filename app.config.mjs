import { createApp } from 'vinxi'
import reactRefresh from '@vitejs/plugin-react'
import { serverFunctions } from '@vinxi/server-functions/plugin'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'
import { config } from 'vinxi/plugins/config'
import tsconfigPaths from 'vite-tsconfig-paths'

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
        '@tanstack/react-router-server',
        'use-sync-external-store',
      ],
    },
  })

export default createApp({
  routers: [
    {
      name: 'public',
      mode: 'static',
      dir: './public',
      base: '/',
    },
    {
      name: 'ssr',
      mode: 'handler',
      // middleware: './app/middleware.tsx',
      handler: './app/server.tsx',
      target: 'server',
      plugins: () => [
        customVite(),
        tsconfigPaths(),
        reactRefresh(),
        TanStackRouterVite(),
      ],
    },
    {
      name: 'client',
      mode: 'build',
      handler: './app/client.tsx',
      target: 'browser',
      plugins: () => [
        customVite(),
        tsconfigPaths(),
        serverFunctions.client(),
        reactRefresh(),
        // TanStackRouterVite(),
      ],
      base: '/_build',
    },
    serverFunctions.router({
      plugins: () => [tsconfigPaths()],
    }),
  ],
})
