import { createFileRoute } from '@tanstack/react-router'
import { StarterCompiledSchema, handleSpecialURL } from '@tanstack/cta-engine'

export const Route = createFileRoute('/api/load-starter')({
  // @ts-expect-error server property not in route types yet
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url)
        const starterUrl = url.searchParams.get('url')

        if (!starterUrl) {
          return new Response(JSON.stringify({ error: 'URL is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        try {
          const fixedUrl = handleSpecialURL(starterUrl)
          const response = await fetch(fixedUrl)
          const data = await response.json()
          const parsed = StarterCompiledSchema.safeParse(data)

          if (!parsed.success) {
            return new Response(JSON.stringify({ error: 'Invalid starter data' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          return new Response(
            JSON.stringify({
              url: fixedUrl,
              id: parsed.data.id,
              name: parsed.data.name,
              description: parsed.data.description,
              version: parsed.data.version,
              author: parsed.data.author,
              license: parsed.data.license,
              dependsOn: parsed.data.dependsOn,
              mode: parsed.data.mode,
              typescript: parsed.data.typescript,
              tailwind: parsed.data.tailwind,
              banner: parsed.data.banner
                ? fixedUrl.replace('starter.json', parsed.data.banner)
                : undefined,
            }),
            {
              headers: { 'Content-Type': 'application/json' },
            },
          )
        } catch {
          return new Response(JSON.stringify({ error: 'Failed to load starter' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
