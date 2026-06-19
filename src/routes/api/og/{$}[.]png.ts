import { createFileRoute } from '@tanstack/react-router'

type GenerateOgImageResponse = typeof import(
  '~/server/og/generate.server'
)['generateOgImageResponse']

const CACHE_HEADERS = {
  'Cache-Control':
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
} as const

export const Route = createFileRoute('/api/og/{$}.png')({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request
        params: { _splat: string }
      }) => {
        const rawParam = params._splat
        const libraryId = rawParam.replace(/\.png$/, '')

        const url = new URL(request.url)
        let result: Awaited<ReturnType<GenerateOgImageResponse>>
        try {
          const { generateOgImageResponse } = await import(
            '~/server/og/generate.server'
          )
          result = await generateOgImageResponse(
            {
              libraryId,
              requestUrl: request.url,
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
