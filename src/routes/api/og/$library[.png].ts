import { readdirSync, existsSync, realpathSync } from 'node:fs'
import { createFileRoute } from '@tanstack/react-router'
import { generateOgImageResponse } from '~/server/og/generate.server'

const CACHE_HEADERS = {
  'Cache-Control':
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
} as const

function listOrError(path: string): string {
  try {
    if (!existsSync(path)) return `(missing) ${path}`
    const real = realpathSync(path)
    const entries = readdirSync(path).slice(0, 80).join(', ')
    return `${path}${path === real ? '' : ` -> ${real}`}: ${entries}`
  } catch (err) {
    return `${path}: ${err instanceof Error ? err.message : String(err)}`
  }
}

function diagnosticErrorResponse(error: unknown): Response {
  const detail =
    error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack ?? ''}\n${
          error.cause instanceof Error
            ? `caused by ${error.cause.name}: ${error.cause.message}\n${error.cause.stack ?? ''}`
            : error.cause
              ? `caused by ${String(error.cause)}`
              : ''
        }`
      : String(error)

  const fsDump = [
    `cwd: ${process.cwd()}`,
    listOrError('/var/task'),
    listOrError('/var/task/node_modules'),
    listOrError('/var/task/node_modules/@takumi-rs'),
    listOrError('/var/task/node_modules/.pnpm'),
    listOrError(
      '/var/task/node_modules/.pnpm/@takumi-rs+wasm@1.1.2_react-dom@19.2.3_react@19.2.3__react@19.2.3/node_modules/@takumi-rs/wasm',
    ),
    listOrError(
      '/var/task/node_modules/.pnpm/@takumi-rs+wasm@1.1.2_react-dom@19.2.3_react@19.2.3__react@19.2.3/node_modules/@takumi-rs/wasm/pkg',
    ),
  ].join('\n\n')

  return new Response(
    `Failed to generate OG image\n\n${detail}\n\n--- fs dump ---\n${fsDump}`,
    {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    },
  )
}

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
          return diagnosticErrorResponse(error)
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
          return diagnosticErrorResponse(error)
        }

        return result
      },
    },
  },
})
