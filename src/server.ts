import './instrument.server.mjs'

export { StreamObject } from '@durable-streams/server-cloudflare'
export { WorkspaceSync } from './chat/server/workspace-sync-object'
export { Conversation } from './chat/server/conversation'
export { TanChatWorkflow } from './chat/server/workflow-driver'

import { wrapFetchWithSentry } from '@sentry/tanstackstart-react'
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { runWithDatabaseContext, runWithDatabaseRequest } from '~/db/client'
import { runScheduledTasks } from '~/server/scheduled.server'
import {
  runWithHostRuntimeContext,
  runWithHostRuntimeEnv,
} from '~/server/runtime/host.server'
import {
  installProductionFetchProbe,
  installProductionProcessProbe,
  logRequestEnd,
  logRequestError,
  logRequestStart,
  runWithRequestDiagnostics,
} from '~/utils/prod-diagnostics.server'
import { docsContentNegotiationVaryHeader } from '~/utils/http'
import { isFrameEmbeddingAllowed } from '~/utils/frame-embedding'
import { redirectChatOrigin } from './chat/server/origin-redirect'

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
const SCARF_EVENTS_URL = 'https://tanstack.gateway.scarf.sh/site-events'
const MAX_CLIPBOARD_EVENT_BYTES = 4096

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

  if (isFrameEmbeddingAllowed(url.pathname)) {
    headers.delete('X-Frame-Options')
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

function getAnalyticsProxyHeaders(request: Request) {
  const headers = new Headers()

  for (const headerName of ['accept', 'accept-language', 'user-agent']) {
    const value = request.headers.get(headerName)
    if (value) {
      headers.set(headerName, value)
    }
  }

  const contentType = request.headers.get('content-type')
  if (contentType) {
    headers.set('content-type', contentType)
  }

  return headers
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
    headers: getAnalyticsProxyHeaders(request),
    redirect: 'follow',
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
  }

  const response = await fetch(upstreamUrl, init)
  return applyHostingHeaders(response, url)
}

async function proxyScarfClipboardEvent(request: Request, url: URL) {
  if (url.pathname !== '/_a/scarf/clipboard') return null

  if (
    request.method !== 'POST' ||
    request.headers.get('content-type') !== 'application/json' ||
    Number(request.headers.get('content-length')) > MAX_CLIPBOARD_EVENT_BYTES
  ) {
    return applyHostingHeaders(new Response(null, { status: 400 }), url)
  }

  const rawBody = await request.text()
  if (new TextEncoder().encode(rawBody).length > MAX_CLIPBOARD_EVENT_BYTES) {
    return applyHostingHeaders(new Response(null, { status: 400 }), url)
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return applyHostingHeaders(new Response(null, { status: 400 }), url)
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('event' in body) ||
    (body.event !== 'copy' && body.event !== 'paste') ||
    !('page' in body) ||
    typeof body.page !== 'string' ||
    !body.page.startsWith('/') ||
    body.page.length > 512 ||
    !('text' in body) ||
    typeof body.text !== 'string' ||
    body.text.length > 512 ||
    !('truncated' in body) ||
    typeof body.truncated !== 'boolean'
  ) {
    return applyHostingHeaders(new Response(null, { status: 400 }), url)
  }

  const headers = new Headers({ 'Content-Type': 'application/json' })
  for (const headerName of ['user-agent', 'dnt', 'sec-gpc']) {
    const value = request.headers.get(headerName)
    if (value) headers.set(headerName, value)
  }
  const clientIp = request.headers.get('cf-connecting-ip')
  if (clientIp) headers.set('X-Scarf-IP', clientIp)

  try {
    await fetch(SCARF_EVENTS_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: body.event,
        page: body.page,
        text: body.text,
        truncated: body.truncated,
      }),
    })
  } catch {
    // Telemetry failures must not affect the page.
  }

  return applyHostingHeaders(new Response(null, { status: 204 }), url)
}

const server = createServerEntry(
  wrapFetchWithSentry({
    async fetch(request) {
      return runWithRequestDiagnostics(request, async (context) => {
        return runWithDatabaseRequest(async () => {
          const url = new URL(request.url)
          logRequestStart(context)

          try {
            const scarfResponse = await proxyScarfClipboardEvent(request, url)
            if (scarfResponse) {
              logRequestEnd(context, scarfResponse.status, {
                analyticsProxy: true,
              })
              return scarfResponse
            }

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
  fetch(request: Request, env: unknown, context: unknown) {
    const canonicalChat = redirectChatOrigin(request)
    if (canonicalChat) return canonicalChat
    return runWithHostRuntimeEnv(env, () =>
      runWithHostRuntimeContext(context, () => server.fetch(request)),
    )
  },
  scheduled(
    controller: ScheduledController,
    env: unknown,
    context: WorkerExecutionContext,
  ) {
    context.waitUntil(
      runWithHostRuntimeEnv(env, () =>
        runWithHostRuntimeContext(context, () =>
          runWithDatabaseContext(() =>
            runScheduledTasks(controller.cron, controller.scheduledTime),
          ),
        ),
      ),
    )
  },
}
