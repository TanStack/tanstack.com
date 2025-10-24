import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig } from 'vite'
import contentCollections from '@content-collections/vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import { analyzer } from 'vite-bundle-analyzer'
import viteReact from '@vitejs/plugin-react'
import netlify from '@netlify/vite-plugin-tanstack-start'

export default defineConfig({
  server: {
    port: 3000,
  },
  ssr: {
    noExternal: [],
    external: ['@tanstack/cta-engine', '@tanstack/cta-framework-react-cra'],
  },
  optimizeDeps: {
    exclude: ['@tanstack/cta-engine', '@tanstack/cta-framework-react-cra'],
  },
  plugins: [
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),

    tanstackStart(),
    netlify(),
    viteReact(),

    sentryVitePlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: 'tanstack',
      project: 'tanstack-com',
    }),
    contentCollections(),
    tailwindcss(),
    analyzer({
      enabled: false,
      openAnalyzer: true,
      defaultSizes: 'gzip',
    }),
  ],
})
