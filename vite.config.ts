import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig } from 'vite'
import contentCollections from '@content-collections/vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import { analyzer } from 'vite-bundle-analyzer'
import viteReact from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import netlify from '@netlify/vite-plugin-tanstack-start'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDev = process.env.NODE_ENV !== 'production'

// Packages that must be externalized due to CJS/ESM interop issues with RSC
// These packages use patterns that conflict with Vite's ESM module runner
// NOTE: html-react-parser and domhandler were removed to allow RSC to use Markdown component
const rscExternals = [
  // HTML parsing (cheerio uses iconv-lite which has CJS module issues)
  'cheerio',
  'iconv-lite',
  'encoding-sniffer',
  'parse5',
  'parse5-parser-stream',
  // Discord SDK has crypto import issues
  'discord-interactions',
  // OpenTelemetry uses require-in-the-middle which is CJS-only
  'require-in-the-middle',
  '@opentelemetry/instrumentation',
  // jszip has CJS module transformation issues
  'jszip',
  'pako',
]

export default defineConfig({
  resolve: {
    alias: {
      // Force react-is to resolve to the local node_modules version
      // This ensures Vite can pre-bundle the CJS module for browser use
      'react-is': resolve(
        __dirname,
        'node_modules/.pnpm/react-is@19.2.4/node_modules/react-is',
      ),
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
  // RSC environment needs to externalize packages that import react-dom/server
  environments: {
    rsc: {
      resolve: {
        external: [
          '@tanstack/react-start-server',
          '@tanstack/react-router/ssr/server',
        ],
      },
    },
  },
  ssr: {
    external: [
      'postgres',
      // CTA packages use execa which has a broken unicorn-magic dependency
      '@tanstack/create',
      // Externalize CLI so server reloads it on changes
      '@tanstack/cli',
      // RSC compatibility externals
      ...rscExternals,
    ],
    noExternal: [
      'drizzle-orm',
      // react-is is CJS but used by @tanstack/react-start-rsc in client code
      // noExternal forces Vite to bundle it (converting CJS to ESM)
      'react-is',
    ],
  },
  optimizeDeps: {
    include: [
      // react-is is CJS-only but start-rsc imports it in 'use client' code
      // Pre-bundling allows Vite to create proper ESM wrappers for browser
      'react-is',
    ],
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
        if (id.includes('postgres')) return true
        // Externalize Node.js built-in modules that linked packages import
        // These should never be in client bundles
        if (id.startsWith('node:')) return true
        return false
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
      rsc: {
        enabled: true,
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
    rsc({
      // Disable CSS link precedence to prevent React 19 SSR suspension
      // TanStack Start handles CSS preloading via manifest injection instead
      cssLinkPrecedence: false,
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
