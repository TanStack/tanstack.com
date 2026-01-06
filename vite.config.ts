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
    external: ['postgres'],
    noExternal: ['drizzle-orm'],
  },
  optimizeDeps: {
    exclude: ['postgres'],
  },
  build: {
    rollupOptions: {
      external: (id) => {
        // Externalize postgres from client bundle
        return id.includes('postgres')
      },
      output: {
        manualChunks: (id) => {
          // Vendor chunk splitting for better caching
          if (id.includes('node_modules')) {
            // Search-related deps (only loaded when search modal opens)
            if (
              id.includes('algoliasearch') ||
              id.includes('instantsearch') ||
              id.includes('react-instantsearch')
            ) {
              return 'search'
            }
            // Syntax highlighting (lazy-loaded via mermaid/shiki)
            if (id.includes('shiki') || id.includes('mermaid')) {
              return 'syntax-highlight'
            }
            // Radix UI components (used throughout)
            if (id.includes('@radix-ui/')) {
              return 'radix-ui'
            }
            // Markdown processing (unified/remark/rehype)
            if (
              id.includes('unified') ||
              id.includes('remark') ||
              id.includes('rehype') ||
              id.includes('hast-') ||
              id.includes('mdast-')
            ) {
              return 'markdown-processing'
            }
            // Charting deps (only loaded on stats/admin pages)
            if (
              id.includes('@observablehq/plot') ||
              (id.includes('d3') && !id.includes('d3-'))
            ) {
              return 'd3-charts'
            }
            // Visualization deps
            if (id.includes('@visx/')) {
              return 'visx'
            }
            // Lucide icons (tree-shaken but still significant)
            if (id.includes('lucide-react')) {
              return 'icons'
            }
          }
        },
      },
    },
  },
  plugins: [
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),

    tanstackStart({
      router: {
        codeSplittingOptions: {
          defaultBehavior: [
            [
              'component',
              'pendingComponent',
              'errorComponent',
              'notFoundComponent',
              'loader',
            ],
          ],
        },
      },
    }),
    // Only enable Netlify plugin during build or when NETLIFY env is set
    ...(process.env.NETLIFY || process.env.NODE_ENV === 'production'
      ? [netlify()]
      : []),
    viteReact(),

    sentryVitePlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: 'tanstack',
      project: 'tanstack-com',
    }),
    contentCollections(),
    tailwindcss(),
    ...(process.env.ANALYZE
      ? [
          analyzer({
            analyzerMode: 'json',
            fileName: 'bundle-analysis',
            defaultSizes: 'stat',
          }),
        ]
      : []),
  ],
})
