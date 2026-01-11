import { z } from 'zod'
import {
  updateShowcaseCore,
  validateShowcaseOwnership,
  validLibraryIds,
  validUseCases,
} from '~/utils/showcase.server'
import { checkWriteRateLimit } from '../auth.server'
import type { McpAuthContext } from '../server'

export const updateShowcaseSchema = z.object({
  id: z.string().uuid().describe('Showcase UUID to update'),
  name: z.string().min(1).max(255).describe('Project name'),
  tagline: z.string().min(1).max(500).describe('Short description'),
  description: z.string().optional().describe('Full description'),
  url: z.string().url().describe('Project URL'),
  sourceUrl: z
    .string()
    .url()
    .optional()
    .nullable()
    .describe('Source code URL (null to remove)'),
  screenshotUrl: z.string().url().describe('Screenshot URL'),
  logoUrl: z
    .string()
    .url()
    .optional()
    .nullable()
    .describe('Logo URL (null to remove)'),
  libraries: z
    .array(z.string())
    .min(1)
    .describe(
      `TanStack library IDs used. Valid IDs: ${validLibraryIds.join(', ')}`,
    ),
  useCases: z
    .array(z.string())
    .min(1)
    .describe(`Use case categories. Valid: ${validUseCases.join(', ')}`),
})

export type UpdateShowcaseInput = z.infer<typeof updateShowcaseSchema>

export async function updateShowcase(
  input: UpdateShowcaseInput,
  authContext?: McpAuthContext,
) {
  if (!authContext) {
    throw new Error('Authentication required')
  }

  // Check write rate limit
  const rateLimit = await checkWriteRateLimit(authContext.userId)
  if (!rateLimit.allowed) {
    throw new Error(
      `Write rate limit exceeded. Try again after ${rateLimit.resetAt.toISOString()}`,
    )
  }

  // Validate ownership
  await validateShowcaseOwnership(input.id, authContext.userId)

  await updateShowcaseCore(
    {
      showcaseId: input.id,
      name: input.name,
      tagline: input.tagline,
      description: input.description,
      url: input.url,
      logoUrl: input.logoUrl ?? undefined,
      screenshotUrl: input.screenshotUrl,
      sourceUrl: input.sourceUrl,
      libraries: input.libraries,
      useCases: input.useCases,
    },
    { userId: authContext.userId, source: 'mcp' },
  )

  return {
    id: input.id,
    message:
      'Showcase updated successfully. It will be re-reviewed by moderators.',
  }
}
