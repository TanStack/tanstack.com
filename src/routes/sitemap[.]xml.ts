import { createFileRoute } from '@tanstack/react-router'
import { setResponseHeader } from '@tanstack/react-start/server'
import { generateSitemapXml, getSiteOrigin } from '~/utils/sitemap'

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        let content: string
        try {
          content = await generateSitemapXml(getSiteOrigin())
        } catch (error) {
          console.error('[sitemap] Generation failed', error)
          return new Response('Sitemap temporarily unavailable', {
            status: 503,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'no-store',
              'Cloudflare-CDN-Cache-Control': 'no-store',
              'Retry-After': '60',
            },
          })
        }

        console.info('[sitemap] Generation succeeded')

        setResponseHeader('Content-Type', 'application/xml; charset=utf-8')
        setResponseHeader(
          'Cache-Control',
          'public, max-age=300, must-revalidate',
        )
        setResponseHeader(
          'Cloudflare-CDN-Cache-Control',
          'public, max-age=3600, stale-while-revalidate=3600',
        )

        return new Response(content)
      },
    },
  },
})
