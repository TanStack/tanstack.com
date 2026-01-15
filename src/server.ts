import './instrument.server.mjs'

import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

export default createServerEntry({
  async fetch(request) {
    const url = new URL(request.url)

    // Redirect to markdown version if AI/LLM requests text/markdown for doc pages
    const acceptHeader = request.headers.get('Accept') || ''
    if (
      acceptHeader.includes('text/markdown') &&
      url.pathname.includes('/docs/') &&
      !url.pathname.endsWith('.md')
    ) {
      return new Response(null, {
        status: 303,
        headers: {
          Location: `${url.pathname}.md`,
        },
      })
    }

    const response = await handler.fetch(request)

    // Add COOP/COEP headers for /builder route (required for WebContainer)
    if (url.pathname === '/builder' || url.pathname.startsWith('/builder/')) {
      const newHeaders = new Headers(response.headers)
      newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin')
      newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp')

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      })
    }

    return response
  },
})
