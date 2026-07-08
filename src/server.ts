import './instrument.server.mjs'

import { wrapFetchWithSentry } from '@sentry/tanstackstart-react'
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import {
  ContainerProxy,
  getSandbox,
  proxyToSandbox,
  Sandbox as CloudflareSandbox,
  type Sandbox as CloudflareSandboxInstance,
  type SandboxEnv,
} from '@cloudflare/sandbox'
import {
  FORGE_SANDBOX_OPTIONS,
  FORGE_SANDBOX_PREVIEW_PORT,
  restartForgeSandboxPreviewDevServer,
  resolveForgeSandboxPreviewHmrOptions,
} from '~/builder/runtime/sandbox-preview.server'
import { runWithDatabaseContext } from '~/db/client'
import { runScheduledTasks } from '~/server/scheduled.server'
import {
  installProductionFetchProbe,
  installProductionProcessProbe,
  logRequestEnd,
  logRequestError,
  logRequestStart,
  runWithRequestDiagnostics,
} from '~/utils/prod-diagnostics.server'
import { docsContentNegotiationVaryHeader } from '~/utils/http'

export { ForgeSessionDurableObject } from '~/builder/runtime/forge-session-do.server'

export { ContainerProxy }
export class Sandbox extends CloudflareSandbox {}

// The Workers env this entry needs to know about, structurally: the
// `Sandbox` container-host DO binding `proxyToSandbox` routes preview
// subdomain traffic (`*.forge.tanstack.com`) into by hostname. Mirrors
// `ForgeSandboxEnv` in `~/builder/runtime/sandbox-agent.server` — no
// generated `worker-configuration.d.ts` `Env` is relied on here since that
// file is intentionally gitignored.
type ForgeWorkerEnv = SandboxEnv<CloudflareSandboxInstance>

const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
} as const

const GOOGLE_ANALYTICS_SCRIPT_URL =
  'https://www.googletagmanager.com/gtag/js?id=G-JMT1Z50SPS'
const GOOGLE_ANALYTICS_COLLECT_URL =
  'https://www.google-analytics.com/g/collect'

const STATIC_RESPONSE_LINK_HEADERS = {
  filter: ({ phase }: { phase: 'static' | 'dynamic' }) => phase === 'static',
}

type ScheduledController = {
  cron: string
  scheduledTime: number
}

type WorkerExecutionContext = {
  waitUntil(promise: Promise<unknown>): void
}

installProductionFetchProbe()
installProductionProcessProbe()

function isBrowserDocumentRequest(request: Request) {
  return (
    request.headers.get('Sec-Fetch-Dest') === 'document' ||
    request.headers.get('Sec-Fetch-Mode') === 'navigate'
  )
}

function shouldRewriteDocsRequestToMarkdown(request: Request, url: URL) {
  const acceptHeader = request.headers.get('Accept') || ''

  return (
    acceptHeader.includes('text/markdown') &&
    url.pathname.includes('/docs/') &&
    !url.pathname.endsWith('.md') &&
    !isBrowserDocumentRequest(request)
  )
}

function applyHostingHeaders(response: Response, url: URL) {
  const headers = new Headers(response.headers)

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value)
  }

  if (url.pathname === '/builder' || url.pathname.startsWith('/builder/')) {
    headers.set('Cross-Origin-Opener-Policy', 'same-origin')
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp')
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

async function proxyAnalyticsRequest(request: Request, url: URL) {
  const upstreamUrl =
    url.pathname === '/_a/gtag.js'
      ? new URL(GOOGLE_ANALYTICS_SCRIPT_URL)
      : url.pathname === '/_a/g/collect'
        ? new URL(GOOGLE_ANALYTICS_COLLECT_URL)
        : null

  if (!upstreamUrl) {
    return null
  }

  if (url.pathname === '/_a/g/collect') {
    upstreamUrl.search = url.search
  }

  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
    redirect: 'follow',
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
  }

  const response = await fetch(upstreamUrl, init)
  return applyHostingHeaders(response, url)
}

async function repairBlockedForgePreviewRequest({
  env,
  request,
  response,
}: {
  env: ForgeWorkerEnv
  request: Request
  response: Response
}) {
  if (
    response.status !== 403 ||
    !(await response.clone().text()).includes('Blocked request')
  ) {
    return response
  }

  const route = readForgePreviewRoute(new URL(request.url))

  if (!route || route.port !== FORGE_SANDBOX_PREVIEW_PORT) {
    return response
  }

  const sandbox = getSandbox(
    env.Sandbox,
    route.sandboxId,
    FORGE_SANDBOX_OPTIONS,
  )

  const hmr = resolveForgeSandboxPreviewHmrOptions({ previewUrl: request.url })
  const restartResult = await restartForgeSandboxPreviewDevServer(sandbox, {
    ...(hmr ? { hmr } : {}),
    waitTimeoutMs: 45_000,
  }).catch((error: unknown) => {
    console.warn('[forge-preview] repair failed', error)
    return undefined
  })

  if (restartResult?.ok === false) {
    console.warn('[forge-preview] repair did not start preview', {
      logTail: restartResult.logTail,
    })
  }

  const retryResponse = (await proxyToSandbox(request, env)) ?? response
  const headers = new Headers(retryResponse.headers)
  headers.set('X-Forge-Preview-Repair', 'attempted')

  return new Response(retryResponse.body, {
    headers,
    status: retryResponse.status,
    statusText: retryResponse.statusText,
  })
}

function readForgePreviewRoute(url: URL) {
  const dotIndex = url.hostname.indexOf('.')

  if (dotIndex === -1) {
    return undefined
  }

  const subdomain = url.hostname.slice(0, dotIndex)
  const firstHyphen = subdomain.indexOf('-')

  if (firstHyphen === -1) {
    return undefined
  }

  const port = Number.parseInt(subdomain.slice(0, firstHyphen), 10)

  if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 3000) {
    return undefined
  }

  const rest = subdomain.slice(firstHyphen + 1)
  const lastHyphen = rest.lastIndexOf('-')

  if (lastHyphen === -1) {
    return undefined
  }

  const sandboxId = rest.slice(0, lastHyphen)
  const token = rest.slice(lastHyphen + 1)

  if (
    !/^[a-z0-9-]+$/.test(sandboxId) ||
    sandboxId.length === 0 ||
    sandboxId.length > 63 ||
    !/^[a-z0-9_-]+$/.test(token) ||
    token.length === 0 ||
    token.length > 16
  ) {
    return undefined
  }

  return { port, sandboxId }
}

const server = createServerEntry(
  wrapFetchWithSentry({
    async fetch(request) {
      return runWithRequestDiagnostics(request, async (context) => {
        return runWithDatabaseContext(async () => {
          const url = new URL(request.url)
          logRequestStart(context)

          try {
            const analyticsResponse = await proxyAnalyticsRequest(request, url)
            if (analyticsResponse) {
              logRequestEnd(context, analyticsResponse.status, {
                analyticsProxy: true,
              })
              return analyticsResponse
            }

            if (shouldRewriteDocsRequestToMarkdown(request, url)) {
              const mdUrl = new URL(request.url)
              mdUrl.pathname = `${url.pathname}.md`
              const mdRequest = new Request(mdUrl, request)
              const mdResponse = await handler.fetch(mdRequest)
              const markdownHeaders = new Headers(mdResponse.headers)
              markdownHeaders.set('Vary', docsContentNegotiationVaryHeader)

              const markdownResponse = new Response(mdResponse.body, {
                status: mdResponse.status,
                statusText: mdResponse.statusText,
                headers: markdownHeaders,
              })

              logRequestEnd(context, mdResponse.status, {
                rewrittenToMarkdown: true,
              })
              return applyHostingHeaders(markdownResponse, url)
            }

            const response = await handler.fetch(request, {
              responseLinkHeader: STATIC_RESPONSE_LINK_HEADERS,
            })
            const hostedResponse = applyHostingHeaders(response, url)

            logRequestEnd(context, response.status)
            return hostedResponse
          } catch (error) {
            logRequestError(context, error)
            throw error
          }
        })
      })
    },
  }),
)

export default {
  async fetch(request: Request, env: ForgeWorkerEnv) {
    // Preview-subdomain traffic (`*.forge.tanstack.com`) must be routed into
    // the matching sandbox container by hostname BEFORE any other routing —
    // it never reaches the TanStack Start handler below.
    const proxied = await proxyToSandbox(request, env)
    if (proxied) {
      return repairBlockedForgePreviewRequest({
        env,
        request,
        response: proxied,
      })
    }

    return server.fetch(request)
  },
  scheduled(
    controller: ScheduledController,
    _env: unknown,
    context: WorkerExecutionContext,
  ) {
    context.waitUntil(
      runWithDatabaseContext(() =>
        runScheduledTasks(controller.cron, controller.scheduledTime),
      ),
    )
  },
}
