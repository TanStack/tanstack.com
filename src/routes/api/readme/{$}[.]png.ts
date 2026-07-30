import { createFileRoute } from '@tanstack/react-router'
import { findLibrary } from '~/libraries'
import type { Framework } from '~/libraries/types'

type GenerateReadmeHeaderResponse = typeof import(
  '~/server/og/generate.server'
)['generateReadmeHeaderResponse']

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=3600',
  'Cloudflare-CDN-Cache-Control':
    'public, max-age=86400, stale-while-revalidate=604800',
} as const

export const Route = createFileRoute('/api/readme/{$}.png')({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request
        params: { _splat: string }
      }) => {
        const libraryId = params._splat.replace(/\.png$/, '')
        const library = findLibrary(libraryId)
        if (!library) {
          return new Response(`Unknown library: ${libraryId}`, { status: 404 })
        }

        const url = new URL(request.url)

        // Validated rather than ignored: a typo'd framework in a README should
        // surface as a broken image, not as a banner naming the wrong package.
        const framework = url.searchParams.get('framework') ?? undefined
        if (framework && !library.frameworks.includes(framework as Framework)) {
          return new Response(
            `Unknown framework "${framework}" for ${library.name}. Expected one of: ${library.frameworks.join(', ')}`,
            { status: 400 },
          )
        }

        let result: Awaited<ReturnType<GenerateReadmeHeaderResponse>>
        try {
          const { generateReadmeHeaderResponse } = await import(
            '~/server/og/generate.server'
          )
          result = await generateReadmeHeaderResponse(
            {
              libraryId,
              requestUrl: request.url,
              framework: framework as Framework | undefined,
              title: url.searchParams.get('title') ?? undefined,
              subtitle: url.searchParams.get('subtitle') ?? undefined,
            },
            { headers: CACHE_HEADERS },
          )
        } catch (error) {
          console.error('Failed to construct README header response', error)
          return new Response('Failed to generate README header', {
            status: 500,
          })
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
          console.error('Failed to generate README header', error)
          return new Response('Failed to generate README header', {
            status: 500,
          })
        }

        return result
      },
    },
  },
})
