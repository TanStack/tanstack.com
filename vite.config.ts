import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig } from 'vite'
import contentCollections from '@content-collections/vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

export default defineConfig({
  plugins: [
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),

    tanstackStart({}),

    sentryVitePlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: 'tanstack',
      project: 'tanstack-com',
    }),
    contentCollections(),
  ],
})
