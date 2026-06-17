import { createFileRoute } from '@tanstack/react-router'
import { getIntentSkillMarkdown } from '~/utils/intent.functions'
import { decodePkgName } from './$packageName'

export const Route = createFileRoute('/intent/registry/$packageName/{$}.md')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url)
        const version = url.searchParams.get('version')
        const skillName = params._splat

        if (!version || !skillName) {
          return new Response('Missing version', { status: 400 })
        }

        const content = await getIntentSkillMarkdown({
          data: {
            packageName: decodePkgName(params.packageName),
            skillName,
            version,
          },
        })

        if (!content) {
          return new Response('Not found', { status: 404 })
        }

        return new Response(content, {
          headers: {
            'Cache-Control': 'public, max-age=0, must-revalidate',
            'Content-Type': 'text/markdown',
          },
        })
      },
    },
  },
})
