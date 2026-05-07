import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/api/v1/intent/packages/$name/versions/$version/skills/$skill',
)({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request
        params: { name: string; version: string; skill: string }
      }) => {
        const [
          {
            applyIntentRateLimit,
            intentJsonResponse,
            intentErrorResponse,
            buildSkillContentUrls,
          },
          fns,
          dbModule,
        ] = await Promise.all([
          import('~/utils/intent-api.server'),
          import('~/utils/intent.functions'),
          import('~/utils/intent-db.server'),
        ])

        const decision = await applyIntentRateLimit(request)
        if (decision.limited) return decision.response

        const versions = await dbModule.getPackageVersions(params.name)
        const versionRecord = versions.find((v) => v.version === params.version)
        if (!versionRecord) {
          return intentErrorResponse(
            `Version not found: ${params.name}@${params.version}`,
            'NOT_FOUND',
            404,
            decision.rl,
          )
        }

        const skills = await dbModule.getSkillsForVersion(versionRecord.id)
        const skill = skills.find((s) => s.name === params.skill)

        if (!skill) {
          return intentErrorResponse(
            `Skill not found: ${params.skill} in ${params.name}@${params.version}`,
            'NOT_FOUND',
            404,
            decision.rl,
          )
        }

        // Markdown body is kept as an undocumented escape hatch only fetched
        // when the caller explicitly opts in (?include=markdown). Default
        // responses point at the CDN to keep our egress near zero.
        const url = new URL(request.url)
        const includeMarkdown = url.searchParams
          .get('include')
          ?.split(',')
          .includes('markdown')

        const markdown = includeMarkdown
          ? await fns.getIntentSkillMarkdown({
              data: {
                packageName: params.name,
                version: params.version,
                skillName: params.skill,
              },
            })
          : undefined

        return intentJsonResponse(
          {
            packageName: params.name,
            version: params.version,
            skill: {
              id: skill.id,
              name: skill.name,
              description: skill.description,
              type: skill.type,
              framework: skill.framework,
              requires: skill.requires,
              skillPath: skill.skillPath,
              contentHash: skill.contentHash,
              lineCount: skill.lineCount,
            },
            content: buildSkillContentUrls(
              params.name,
              params.version,
              skill.skillPath,
            ),
            ...(includeMarkdown ? { markdown } : {}),
          },
          decision.rl,
        )
      },
    },
  },
})
