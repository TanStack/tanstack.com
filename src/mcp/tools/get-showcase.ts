import { z } from 'zod'
import { getShowcaseCore } from '~/utils/showcase.server'
import type { McpAuthContext } from '../server'

export const getShowcaseSchema = z.object({
  id: z.string().uuid().describe('Showcase UUID'),
})

export type GetShowcaseInput = z.infer<typeof getShowcaseSchema>

export async function getShowcase(
  input: GetShowcaseInput,
  authContext?: McpAuthContext,
) {
  const result = await getShowcaseCore(input.id, {
    userId: authContext?.userId,
  })

  return {
    id: result.showcase.id,
    name: result.showcase.name,
    tagline: result.showcase.tagline,
    description: result.showcase.description,
    url: result.showcase.url,
    sourceUrl: result.showcase.sourceUrl,
    screenshotUrl: result.showcase.screenshotUrl,
    logoUrl: result.showcase.logoUrl,
    libraries: result.showcase.libraries,
    useCases: result.showcase.useCases,
    status: result.showcase.status,
    voteScore: result.showcase.voteScore,
    isFeatured: result.showcase.isFeatured,
    createdAt: result.showcase.createdAt?.toISOString(),
    updatedAt: result.showcase.updatedAt?.toISOString(),
    submittedBy: result.user
      ? {
          id: result.user.id,
          name: result.user.name,
          image: result.user.image,
        }
      : null,
  }
}
