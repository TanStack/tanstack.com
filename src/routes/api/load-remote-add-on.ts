import { createFileRoute } from '@tanstack/react-router'
import { AddOnCompiledSchema, handleSpecialURL } from '@tanstack/cta-engine'

export const Route = createFileRoute('/api/load-remote-add-on')({
  // @ts-expect-error server property not in route types yet
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url)
        const addOnUrl = url.searchParams.get('url')

        if (!addOnUrl) {
          return new Response(JSON.stringify({ error: 'URL is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        try {
          const fixedUrl = handleSpecialURL(addOnUrl)
          const response = await fetch(fixedUrl)
          const data = await response.json()
          const parsed = AddOnCompiledSchema.safeParse(data)

          if (!parsed.success) {
            return new Response(JSON.stringify({ error: 'Invalid add-on data' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          return new Response(
            JSON.stringify({
              id: fixedUrl,
              name: parsed.data.name,
              description: parsed.data.description,
              version: parsed.data.version,
              author: parsed.data.author,
              license: parsed.data.license,
              link: parsed.data.link,
              smallLogo: parsed.data.smallLogo,
              logo: parsed.data.logo,
              type: parsed.data.type,
              modes: parsed.data.modes,
            }),
            {
              headers: { 'Content-Type': 'application/json' },
            },
          )
        } catch {
          return new Response(JSON.stringify({ error: 'Failed to load add-on' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
