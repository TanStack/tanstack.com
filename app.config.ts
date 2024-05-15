import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig } from '@tanstack/start/config'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'

export default defineConfig({
  vite: {
    plugins: () => [
      TanStackRouterVite({
        experimental: {
          enableCodeSplitting: true,
        },
      }),
      sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: 'tanstack',
        project: 'tanstack-com',
      }),
    ],
  },
})
