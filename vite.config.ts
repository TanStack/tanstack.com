import { sentryTanstackStart } from '@sentry/tanstackstart-react/vite'
import { defineConfig } from 'vite'
import contentCollections from '@content-collections/vite'
import { devtools as tanstackDevtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import { analyzer } from 'vite-bundle-analyzer'
import viteReact from '@vitejs/plugin-react'
import netlify from '@netlify/vite-plugin-tanstack-start'
import path from 'node:path'

const isDev = process.env.NODE_ENV !== 'production'
const shouldUseSentryPlugin =
  process.env.NODE_ENV === 'production' &&
  Boolean(process.env.SENTRY_AUTH_TOKEN)

export default defineConfig({
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: Number(process.env.PORT) || 3000,
    // WebContainer headers for /builder route (SharedArrayBuffer support)
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    // Watch linked @tanstack/cli for hot reload during development
    watch: isDev
      ? {
          ignored: ['!**/node_modules/@tanstack/cli/**'],
        }
      : undefined,
  },
  ssr: {
    external: [
      'postgres',
      // CTA packages use execa which has a broken unicorn-magic dependency
      '@tanstack/create',
      // Externalize CLI so server reloads it on changes
      '@tanstack/cli',
    ],
    noExternal: [
      'drizzle-orm',
      '@uploadthing/react',
      'file-selector',
      'normalize-wheel',
      '@tanstack/react-hotkeys',
      '@webcontainer/api',
    ],
  },
  optimizeDeps: {
    exclude: [
      'postgres',
      // CTA packages use execa which has a broken unicorn-magic dependency
      '@tanstack/create',
      // Don't pre-bundle CLI so we always get fresh changes during dev
      ...(isDev ? ['@tanstack/cli'] : []),
    ],
  },
  build: {
    sourcemap: process.env.NODE_ENV === 'production',
    rollupOptions: {
      external: (id) => {
        // Externalize postgres from client bundle
        return id.includes('postgres')
      },
      output: {
        manualChunks: (id) => {
          // Keep the app shell and docs runtime from shattering into dozens of
          // tiny eagerly preloaded chunks.
          if (
            id.includes('/src/components/Navbar') ||
            id.includes('/src/components/Theme') ||
            id.includes('/src/components/SearchButton') ||
            id.includes('/src/components/NetlifyImage') ||
            id.includes('/src/components/Card') ||
            id.includes('/src/components/Footer') ||
            id.includes('/src/components/ToastProvider') ||
            id.includes('/src/components/icons/') ||
            id.includes('/src/contexts/SearchContext') ||
            id.includes('/src/hooks/useCurrentUser') ||
            id.includes('/src/hooks/useCapabilities') ||
            id.includes('/src/libraries/libraries.ts') ||
            id.includes('/src/ui/')
          ) {
            return 'app-shell'
          }

          if (
            id.includes('/node_modules/@tanstack/react-router') ||
            id.includes('/node_modules/@tanstack/router-core') ||
            id.includes('/node_modules/@tanstack/history')
          ) {
            return 'tanstack-router'
          }

          if (
            id.includes('/node_modules/@tanstack/react-query') ||
            id.includes('/node_modules/@tanstack/query-core')
          ) {
            return 'tanstack-query'
          }

          // Vendor chunk splitting for better caching
          if (id.includes('node_modules')) {
            // Lucide icons (tree-shaken but still significant)
            if (id.includes('lucide-react')) {
              return 'icons'
            }

            if (
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'react'
            }
          }
        },
      },
    },
  },
  plugins: [
    ...(isDev ? [tanstackDevtools()] : []),
    tanstackStart({
      importProtection: {
        behavior: 'error',
        client: {
          files: ['**/*.server.*', '**/server/**'],
          specifiers: [
            '@tanstack/react-start/server',
            'uploadthing/server',
            /^@modelcontextprotocol\/sdk\/server\//,
            'discord-interactions',
          ],
        },
      },
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

    ...(shouldUseSentryPlugin
      ? [
          sentryTanstackStart({
            authToken: process.env.SENTRY_AUTH_TOKEN,
            org: 'tanstack',
            project: 'tanstack-com',
          }),
        ]
      : []),
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
