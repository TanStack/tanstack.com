import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig } from '@tanstack/start/config'
import tsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  server: {
    preset: 'netlify',
  },
  vite: {
    plugins: [tsConfigPaths()],
  },
  routers: {
    client: {
      vite: {
        plugins: [
          sentryVitePlugin({
            authToken: process.env.SENTRY_AUTH_TOKEN,
            org: 'tanstack',
            project: 'tanstack-com',
          }),
        ],
      },
    },
  },
})
