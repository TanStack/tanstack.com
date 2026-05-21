import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/api/v1/intent/packages/$name/versions/$version/skills',
)({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request
        params: { name: string; version: string }
      }) => {
        const [
          {
            applyIntentRateLimit,
            intentJsonResponse,
            intentErrorResponse,
            buildSkillContentUrls,
          },
          fns,
        ] = await Promise.all([
          import('~/utils/intent-api.server'),
          import('~/utils/intent.functions'),
        ])

        const decision = await applyIntentRateLimit(request)
        if (decision.limited) return decision.response

        const result = await fns.getIntentVersionSkills({
          data: { packageName: params.name, version: params.version },
        })

        if (!result) {
          return intentErrorResponse(
            `Version not found: ${params.name}@${params.version}`,
            'NOT_FOUND',
            404,
            decision.rl,
          )
        }

        return intentJsonResponse(
          {
            ...result,
            skills: result.skills.map((skill) => ({
              ...skill,
              content: buildSkillContentUrls(
                params.name,
                params.version,
                skill.skillPath,
              ),
            })),
          },
          decision.rl,
        )
      },
    },
  },
})
