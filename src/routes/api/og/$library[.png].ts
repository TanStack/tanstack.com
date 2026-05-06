import { createFileRoute } from '@tanstack/react-router'
import { generateOgImageResponse } from '~/server/og/generate.server'

const CACHE_HEADERS = {
  'Cache-Control':
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
} as const

export const Route = createFileRoute('/api/og/$library.png')({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request
        params: { [key: string]: string }
      }) => {
        // TanStack Router encodes the param name from the filename segment
        // "$library[.png]" as "library.png" (with the literal dot included).
        // Grab the value under either key and strip any trailing ".png" suffix.
        const rawParam = params['library.png'] ?? params['library'] ?? ''
        const libraryId = rawParam.replace(/\.png$/, '')

        const url = new URL(request.url)
        const result = generateOgImageResponse(
          {
            libraryId,
            title: url.searchParams.get('title') ?? undefined,
            description: url.searchParams.get('description') ?? undefined,
          },
          { headers: CACHE_HEADERS },
        )

        if ('kind' in result) {
          return new Response(`Unknown library: ${libraryId}`, { status: 404 })
        }

        return result
      },
    },
  },
})
