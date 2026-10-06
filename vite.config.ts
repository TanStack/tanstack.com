import { sentryTanstackStart } from '@sentry/tanstackstart-react/vite'
import { defineConfig, loadEnv } from 'vite'
import type { PluginOption, UserConfig } from 'vite'
import { redact } from '@tanstack/redact/vite'
import contentCollections from '@content-collections/vite'
import { devtools as tanstackDevtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { analyzer } from 'vite-bundle-analyzer'
import viteReact from '@vitejs/plugin-react'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  getImportFallbackRepoDirs,
  localDocsDevPath,
  localDocsDevTokenHeader,
} from './src/utils/local-repo-path.server'
import { startLocalMcpEgress } from './scripts/local-mcp-egress'
import { localBuilderAi } from './scripts/local-builder-ai-vite'

const isDev = process.env.NODE_ENV !== 'production'
const shouldUseRedact = process.env.DISABLE_REDACT !== 'true'
const localRedactPackageRoot = process.env.LOCAL_REDACT_PACKAGE_ROOT
const shouldUseSentryPlugin =
  process.env.NODE_ENV === 'production' &&
  Boolean(process.env.SENTRY_AUTH_TOKEN)
const shouldBuildSourcemaps =
  shouldUseSentryPlugin || process.env.BUILD_SOURCEMAPS === 'true'
const SITE_URL = 'https://tanstack.com'
const localDocsDevToken = isDev ? randomUUID() : ''

function localDocsDevFiles(): PluginOption {
  return {
    name: 'tanstack-local-docs-files',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url) return next()

        const url = new URL(request.url, 'http://localhost')
        if (url.pathname !== localDocsDevPath) return next()

        if (
          request.method !== 'GET' ||
          request.headers[localDocsDevTokenHeader] !== localDocsDevToken
        ) {
          response.statusCode = 404
          response.end()
          return
        }

        const repo = url.searchParams.get('repo')
        const filepath = url.searchParams.get('path')

        if (
          !repo ||
          !/^[a-zA-Z0-9._-]+$/.test(repo) ||
          !filepath ||
          !isContainedRepoPath(filepath)
        ) {
          response.statusCode = 400
          response.end()
          return
        }

        const documentsModuleUrl = pathToFileURL(
          path.join(server.config.root, 'src/utils/documents.server.ts'),
        ).href
        const repoDirs = Array.from(
          new Set([
            ...(process.env.TANSTACK_LOCAL_REPOS_DIR
              ? [path.resolve(process.env.TANSTACK_LOCAL_REPOS_DIR, repo)]
              : []),
            path.resolve(os.homedir(), 'GitHub', repo),
            ...getImportFallbackRepoDirs(documentsModuleUrl, repo),
          ]),
        )

        const localFilePath = repoDirs
          .map((repoDir) => ({
            filepath: path.resolve(repoDir, filepath),
            repoDir,
          }))
          .find(
            (candidate) =>
              isPathInside(candidate.repoDir, candidate.filepath) &&
              fs.existsSync(candidate.filepath) &&
              fs.statSync(candidate.filepath).isFile(),
          )?.filepath

        if (!localFilePath) {
          response.statusCode = 404
          response.end()
          return
        }

        try {
          const content = await fs.promises.readFile(localFilePath)
          response.statusCode = 200
          response.setHeader('Cache-Control', 'no-store')
          response.setHeader('Content-Type', 'text/plain; charset=utf-8')
          response.end(content)
        } catch (error) {
          next(error)
        }
      })
    },
  }
}

function isContainedRepoPath(filepath: string) {
  const normalized = path.normalize(filepath)
  return (
    !normalized.startsWith('..') &&
    !normalized.includes(`${path.sep}..${path.sep}`) &&
    !path.isAbsolute(normalized)
  )
}

function isPathInside(parent: string, child: string) {
  const relativePath = path.relative(parent, child)
  return (
    relativePath !== '' &&
    !relativePath.startsWith('..') &&
    !path.isAbsolute(relativePath)
  )
}

// Runtime-specific `react-dom/server` variants aren't in @tanstack/redact/vite's
// default alias map. Funnel them all to `@tanstack/redact/server` at the
// top-level resolve so Workers get a single server implementation.
const serverVariantAliases: Record<string, string> = {
  'react-dom/server': '@tanstack/redact/server',
  'react-dom/server.edge': '@tanstack/redact/server',
  'react-dom/server.node': '@tanstack/redact/server',
  'react-dom/server.bun': '@tanstack/redact/server',
  'react-dom/server.browser': '@tanstack/redact/server',
  'react-dom/static.edge': '@tanstack/redact/server',
  'react-dom/static.node': '@tanstack/redact/server',
  'react-dom/static': '@tanstack/redact/server',
}

// These browser-facing packages are imported by SSR assets. Bundle them into
// Worker server output so the runtime never loads their raw package entries.
const serverBundledClientPackages = [
  ...(shouldUseRedact ? ['@tanstack/redact'] : []),
  /^@radix-ui\//,
  /^@tanstack\/ai(?:-|$)/,
  '@tanstack/highlight',
  '@tanstack/markdown',
  '@tanstack/react-hotkeys',
  '@tanstack/react-pacer',
  '@tanstack/react-table',
  'zustand',
  /^@fingerprintjs\//,
]

const routerSsrPackages = [
  '@tanstack/history',
  '@tanstack/query-core',
  '@tanstack/react-query',
  '@tanstack/react-router',
  '@tanstack/react-router-ssr-query',
  '@tanstack/react-router/ssr',
  '@tanstack/react-router/ssr/server',
  '@tanstack/router-core',
]

function chatBuildId() {
  const root = __dirname
  const digest = createHash('sha256')
  const add = (filePath: string) =>
    digest
      .update(path.relative(root, filePath))
      .update('\0')
      .update(fs.readFileSync(filePath))
      .update('\0')
  const walk = (filePath: string) => {
    for (const entry of fs
      .readdirSync(filePath, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const child = path.resolve(filePath, entry.name)
      if (entry.isDirectory()) walk(child)
      else if (entry.isFile()) add(child)
    }
  }
  for (const directory of ['src', 'public', 'scripts'])
    walk(path.resolve(root, directory))
  for (const file of [
    'package.json',
    'pnpm-lock.yaml',
    'vite.config.ts',
    'wrangler.jsonc',
  ])
    add(path.resolve(root, file))
  return digest.digest('hex')
}

export default defineConfig(async ({ command, mode }) => {
  const localEnv = { ...loadEnv(mode, __dirname, ''), ...process.env }
  const useRemoteAi = Boolean(localEnv.CLOUDFLARE_API_TOKEN)
  const egress = command === 'serve' ? await startLocalMcpEgress() : undefined
  const config: UserConfig = {
    envDir: __dirname,
    define: {
      __GUM_LOCAL_DEVELOPMENT__: JSON.stringify(command === 'serve'),
      __GUM_BUILD_ID__: JSON.stringify(isDev ? 'development' : chatBuildId()),
      __TANSTACK_ENABLE_SERVER_BUILDER_GENERATION__: JSON.stringify(true),
      __TANSTACK_ENABLE_IMAGE_TRANSFORMATIONS__: JSON.stringify(!isDev),
      __TANSTACK_LOCAL_DOCS_TOKEN__: JSON.stringify(localDocsDevToken),
      __TANSTACK_SITE_URL__: JSON.stringify(SITE_URL),
    },
    resolve: {
      alias: {
        '~': path.resolve(__dirname, './src'),
        ejs: path.resolve(
          __dirname,
          './src/server/runtime/ejs-compat.server.ts',
        ),
        'unicorn-magic': 'unicorn-magic/node',
        ...(shouldUseRedact
          ? {
              'use-sync-external-store/shim/index.js': '@tanstack/redact',
              ...serverVariantAliases,
            }
          : {}),
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
    environments: {
      ssr: {
        optimizeDeps: {
          // Resolve SSR dependencies through Redact instead of a separate prebundle.
          exclude: ['@tanstack/create'],
          noDiscovery: shouldUseRedact,
          include: [],
        },
        resolve: {
          noExternal: [...serverBundledClientPackages, ...routerSsrPackages],
        },
      },
    },
    ssr: {
      external: [],
      noExternal: [
        '@uploadthing/react',
        'file-selector',
        'normalize-wheel',
        '@tanstack/react-hotkeys',
        '@webcontainer/api',
        ...serverBundledClientPackages,
        ...routerSsrPackages,
      ],
    },
    optimizeDeps: {
      exclude: [
        'postgres',
        // CTA packages use execa which has a broken unicorn-magic dependency
        '@tanstack/create',
        'discord-interactions',
        // Don't pre-bundle CLI so we always get fresh changes during dev
        ...(isDev ? ['@tanstack/cli'] : []),
      ],
    },
    build: {
      // The lazy iconography route intentionally ships the complete Phosphor
      // registry so every icon can be browsed without follow-up requests.
      chunkSizeWarningLimit: 4_000,
      minify: 'esbuild',
      sourcemap: shouldBuildSourcemaps,
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (
              id.includes('/node_modules/@tanstack/react-start') ||
              id.includes('/node_modules/@tanstack/start-')
            ) {
              return 'tanstack-start'
            }

            if (
              id.includes('/src/db/types.ts') ||
              id.includes('/src/libraries/ids.ts')
            ) {
              return 'shared-constants'
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
      localBuilderAi(),
      localDocsDevFiles(),
      ...(egress
        ? [
            {
              name: 'tanchat-local-mcp-egress',
              configureServer(server) {
                server.httpServer?.once('close', () => {
                  void egress.dispose()
                })
              },
              async closeBundle() {
                await egress.dispose()
              },
            } satisfies PluginOption,
          ]
        : []),
      cloudflare({
        viteEnvironment: { name: 'ssr' },
        remoteBindings: useRemoteAi,
        config: (config) => {
          if (command !== 'serve') return
          config.hyperdrive = []
          if (!useRemoteAi) delete config.ai
          if (localEnv.CLOUDFLARE_ACCOUNT_ID)
            config.account_id = localEnv.CLOUDFLARE_ACCOUNT_ID
          config.vars = {
            ...config.vars,
            ...egress?.vars,
            APP_MODE: 'development',
          }
        },
      }),
      ...(shouldUseRedact
        ? [
            redact(
              localRedactPackageRoot
                ? {
                    packageRoots: {
                      '@tanstack/redact': localRedactPackageRoot,
                    },
                  }
                : undefined,
            ),
          ]
        : []),
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
        server: {
          build: {
            inlineCss: false,
          },
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
  }
  return config
})
