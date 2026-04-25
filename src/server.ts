import './instrument.server.mjs'

import { wrapFetchWithSentry } from '@sentry/tanstackstart-react'
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import {
  installProductionFetchProbe,
  installProductionProcessProbe,
  logRequestEnd,
  logRequestError,
  logRequestStart,
  runWithRequestDiagnostics,
} from '~/utils/prod-diagnostics.server'
import { docsContentNegotiationVaryHeader } from '~/utils/http'

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

export default createServerEntry(
  wrapFetchWithSentry({
    async fetch(request) {
      return runWithRequestDiagnostics(request, async (context) => {
        const url = new URL(request.url)
        logRequestStart(context)

        try {
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
            return markdownResponse
          }

          const response = await handler.fetch(request)

          if (
            url.pathname === '/builder' ||
            url.pathname.startsWith('/builder/')
          ) {
            const newHeaders = new Headers(response.headers)
            newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin')
            newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp')

            logRequestEnd(context, response.status, {
              builderIsolatedHeaders: true,
            })
            return new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: newHeaders,
            })
          }

          logRequestEnd(context, response.status)
          return response
        } catch (error) {
          logRequestError(context, error)
          throw error
        }
      })
    },
  }),
)
