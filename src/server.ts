import './instrument.server.mjs'

import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import {
  installProductionFetchProbe,
  installProductionProcessProbe,
  logRequestEnd,
  logRequestError,
  logRequestStart,
  runWithRequestDiagnostics,
} from '~/utils/prod-diagnostics.server'

installProductionFetchProbe()
installProductionProcessProbe()

export default createServerEntry({
  async fetch(request) {
    return runWithRequestDiagnostics(request, async (context) => {
      const url = new URL(request.url)
      logRequestStart(context)

      try {
        const acceptHeader = request.headers.get('Accept') || ''
        if (
          acceptHeader.includes('text/markdown') &&
          url.pathname.includes('/docs/') &&
          !url.pathname.endsWith('.md')
        ) {
          logRequestEnd(context, 303, { redirectToMarkdown: true })
          return new Response(null, {
            status: 303,
            headers: {
              Location: `${url.pathname}.md`,
            },
          })
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
})
