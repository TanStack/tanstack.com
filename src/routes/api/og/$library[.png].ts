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
        let result: ReturnType<typeof generateOgImageResponse>
        try {
          result = generateOgImageResponse(
            {
              libraryId,
              title: url.searchParams.get('title') ?? undefined,
              description: url.searchParams.get('description') ?? undefined,
            },
            { headers: CACHE_HEADERS },
          )
        } catch (error) {
          console.error('Failed to construct OG response', error)
          return new Response('Failed to generate OG image', { status: 500 })
        }

        if ('kind' in result) {
          return new Response(`Unknown library: ${libraryId}`, { status: 404 })
        }

        // ImageResponse builds the Response synchronously and renders inside
        // a ReadableStream. Await the ready promise so render errors surface
        // as 500s instead of an empty 200 cached at the edge.
        try {
          await result.ready
        } catch (error) {
          console.error('Failed to generate OG image', error)
          return new Response('Failed to generate OG image', { status: 500 })
        }

        return result
      },
    },
  },
})
