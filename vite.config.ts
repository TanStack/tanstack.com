import { sentryTanstackStart } from '@sentry/tanstackstart-react/vite'
import { defineConfig } from 'vite'
import type { PluginOption } from 'vite'
import { redact } from '@tanstack/redact/vite'
import contentCollections from '@content-collections/vite'
import { devtools as tanstackDevtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import { analyzer } from 'vite-bundle-analyzer'
import viteReact from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import netlify from '@netlify/vite-plugin-tanstack-start'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const isDev = process.env.NODE_ENV !== 'production'
const shouldUseRedact = process.env.DISABLE_REDACT !== 'true'
const shouldUseSentryPlugin =
  process.env.NODE_ENV === 'production' &&
  Boolean(process.env.SENTRY_AUTH_TOKEN)

const rscSsrExternals = [
  // OpenTelemetry uses require-in-the-middle which is CJS-only and breaks
  // under Vite's ESM module runner during dev SSR.
  'require-in-the-middle',
  '@opentelemetry/instrumentation',
  // HTML parsing stack has known CJS/ESM interop issues in SSR module runner.
  'cheerio',
  'iconv-lite',
  'encoding-sniffer',
  'parse5',
  'parse5-parser-stream',
  // Compression/archive stack has known CJS transform issues in dev SSR.
  'jszip',
  'pako',
  // These packages also have known CJS/ESM interop issues in the RSC/SSR path.
  'discord-interactions',
  // OG image generation: takumi ships a native .node binary that cannot
  // be bundled by rolldown — must be externalized for SSR environments.
  '@takumi-rs/core',
  '@takumi-rs/image-response',
  '@takumi-rs/helpers',
  'takumi-js',
]

const sentrySsrExternals = ['@sentry/node', '@sentry/tanstackstart-react']
const dbSsrExternals = ['drizzle-orm', 'drizzle-orm/postgres-js']

const localEnvPath = path.resolve(__dirname, '.env.local')
const defaultCheckoutEnvDir = path.join(os.homedir(), 'GitHub/tanstack.com')
const envDir =
  !fs.existsSync(localEnvPath) &&
  fs.existsSync(path.join(defaultCheckoutEnvDir, '.env.local'))
    ? defaultCheckoutEnvDir
    : __dirname

// Runtime-specific `react-dom/server` variants aren't in @tanstack/redact/vite's
// default alias map — our shim ships a single universal server build, unlike
// React which maintains per-runtime forks (edge/node/bun/browser + static.*).
// @vitejs/plugin-rsc and Netlify's edge adapter import them conditionally, so
// we funnel them all to `@tanstack/redact/server` at the top-level resolve
// (Vite 8's `EnvironmentResolveOptions` doesn't accept `alias`, so env-scoped
// aliasing isn't an option).
const serverVariantAliases: Record<string, string> = {
  'react-dom/server.edge': '@tanstack/redact/server',
  'react-dom/server.node': '@tanstack/redact/server',
  'react-dom/server.bun': '@tanstack/redact/server',
  'react-dom/server.browser': '@tanstack/redact/server',
  'react-dom/static.edge': '@tanstack/redact/server',
  'react-dom/static.node': '@tanstack/redact/server',
  'react-dom/static': '@tanstack/redact/server',
}

const useSyncExternalStoreShimIndexAlias = {
  find: /^use-sync-external-store\/shim\/index\.js$/,
  replacement: '@tanstack/redact',
}

const redactOptimizeDepsExcludes = shouldUseRedact
  ? [
      'react',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react/compiler-runtime',
      'react-dom',
      'react-dom/client',
      'react-dom/server',
      'react-dom/server.edge',
      'react-dom/server.node',
      'react-dom/server.bun',
      'react-dom/server.browser',
      'react-dom/static',
      'react-dom/static.edge',
      'react-dom/static.node',
      'react-dom/test-utils',
      'scheduler',
      'use-sync-external-store',
      'use-sync-external-store/shim',
      'use-sync-external-store/shim/index.js',
      'use-sync-external-store/with-selector',
      'use-sync-external-store/with-selector.js',
      'use-sync-external-store/shim/with-selector',
      'use-sync-external-store/shim/with-selector.js',
    ]
  : []

function redactOptimizeDepsGuard(): PluginOption {
  if (!shouldUseRedact) {
    return null
  }

  const blocked = new Set(redactOptimizeDepsExcludes)
  const prune = (optimizeDeps: { include?: Array<string> } | undefined) => {
    if (!optimizeDeps?.include) {
      return
    }

    optimizeDeps.include = optimizeDeps.include.filter((id) => !blocked.has(id))
  }

  return {
    name: 'tanstack-redact-optimize-deps-guard',
    enforce: 'post',
    configResolved(config) {
      prune(config.optimizeDeps)
      prune(config.environments.client?.optimizeDeps)
      prune(config.environments.ssr?.optimizeDeps)
    },
  }
}

// These browser-facing packages are imported by RSC assets. Bundle them into
// server output so Netlify's Node runtime never loads their raw package entries.
const serverBundledClientPackages = [
  ...(shouldUseRedact ? ['@tanstack/redact'] : []),
  '@kapaai/react-sdk',
  /^@fingerprintjs\//,
]

export default defineConfig({
  envDir,
  resolve: {
    alias: [
      {
        find: '~',
        replacement: path.resolve(__dirname, './src'),
      },
      ...(shouldUseRedact
        ? [
            useSyncExternalStoreShimIndexAlias,
            ...Object.entries(serverVariantAliases).map(
              ([find, replacement]) => ({
                find,
                replacement,
              }),
            ),
          ]
        : []),
    ],
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
  environments: {
    rsc: {
      resolve: {
        noExternal: serverBundledClientPackages,
        external: [
          '@tanstack/react-start-server',
          '@tanstack/react-router/ssr/server',
        ],
      },
    },
    ssr: {
      resolve: {
        noExternal: serverBundledClientPackages,
        external: [
          ...rscSsrExternals,
          ...sentrySsrExternals,
          ...dbSsrExternals,
        ],
      },
    },
  },
  ssr: {
    external: [
      'postgres',
      ...dbSsrExternals,
      // CTA packages use execa which has a broken unicorn-magic dependency
      '@tanstack/create',
      // Externalize CLI so server reloads it on changes
      '@tanstack/cli',
      ...rscSsrExternals,
      ...sentrySsrExternals,
    ],
    noExternal: [
      '@uploadthing/react',
      'file-selector',
      'normalize-wheel',
      '@tanstack/react-hotkeys',
      '@webcontainer/api',
      ...serverBundledClientPackages,
    ],
  },
  optimizeDeps: {
    exclude: [
      'postgres',
      // CTA packages use execa which has a broken unicorn-magic dependency
      '@tanstack/create',
      'discord-interactions',
      // OG image generation: takumi ships a native .node binary
      '@takumi-rs/core',
      '@takumi-rs/image-response',
      '@takumi-rs/helpers',
      'takumi-js',
      // Don't pre-bundle CLI so we always get fresh changes during dev
      ...(isDev ? ['@tanstack/cli'] : []),
      // Redact replaces React in client/SSR environments. If Vite prebundles
      // the real React entries for browser deps, third-party search UI can end
      // up with a different dispatcher than the Redact renderer.
      ...redactOptimizeDepsExcludes,
      // `use client` libraries that plugin-rsc pre-bundles inconsistently
      // across client/ssr/rsc envs when combined with our React shim — each
      // env resolves `react` to a different target, so the optimizer's hash
      // diverges. Excluding from optimize keeps resolution deterministic per
      // env and silences the 50k+ "inconsistently optimized" warning flood.
      'lucide-react',
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
    ...(shouldUseRedact ? [redact()] : []),
    ...(isDev
      ? [
          tanstackDevtools({
            // Console piping mirrors server logs into the browser and browser
            // logs back into Vite. A streamed server error can recursively echo
            // through that bridge and flood the dev server log.
            consolePiping: {
              enabled: false,
            },
            // react-instantsearch's <Configure> forwards all JSX props as
            // Algolia search parameters. Injecting `data-tsd-source` as a
            // JSX attr leaks it into the request and Algolia 400s with
            // "Unknown parameter: data-tsd-source" — breaks site search in dev.
            injectSource: {
              enabled: true,
              ignore: { components: ['Configure'] },
            },
          }),
        ]
      : []),
    tanstackStart({
      rsc: {
        enabled: true,
      },
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
    rsc(),
    redactOptimizeDepsGuard(),
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
