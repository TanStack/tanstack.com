import { createFileRoute } from '@tanstack/react-router'
import { getIntentSkillMarkdown } from '~/utils/intent.functions'
import {
  getPackageVersions,
  getSkillsForVersion,
} from '~/utils/intent-db.server'
import { buildSkillContentUrls } from '~/utils/intent-api.server'
import { decodePkgName } from './$packageName'

export const Route = createFileRoute(
  '/intent/registry/$packageName/{$}.md',
)({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url)
        const version = url.searchParams.get('version')
        const skillName = params._splat

        if (!version || !skillName) {
          return new Response('Missing version', { status: 400 })
        }

        const packageName = decodePkgName(params.packageName)

        const versions = await getPackageVersions(packageName)
        const versionRecord = versions.find((v) => v.version === version)

        if (versionRecord) {
          const skills = await getSkillsForVersion(versionRecord.id)
          const skill = skills.find((s) => s.name === skillName)

          if (skill?.skillPath) {
            const urls = buildSkillContentUrls(
              packageName,
              version,
              skill.skillPath,
            )
            if (urls) {
              return Response.redirect(urls.unpkg, 302)
            }
          }
        }

        // Fallback: legacy records without skillPath. Serve from DB.
        const content = await getIntentSkillMarkdown({
          data: { packageName, skillName, version },
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
