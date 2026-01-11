import { z } from 'zod'
import {
  submitShowcaseCore,
  validLibraryIds,
  validUseCases,
} from '~/utils/showcase.server'
import { checkWriteRateLimit } from '../auth.server'
import type { McpAuthContext } from '../server'

export const submitShowcaseSchema = z.object({
  name: z.string().min(1).max(255).describe('Project name'),
  tagline: z
    .string()
    .min(1)
    .max(500)
    .describe('Short description of the project'),
  description: z.string().optional().describe('Full description'),
  url: z.string().url().describe('Project URL'),
  sourceUrl: z
    .string()
    .url()
    .optional()
    .describe('Source code URL (GitHub, etc.)'),
  screenshotUrl: z.string().url().describe('Screenshot URL'),
  logoUrl: z.string().url().optional().describe('Logo URL'),
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

export type SubmitShowcaseInput = z.infer<typeof submitShowcaseSchema>

export async function submitShowcase(
  input: SubmitShowcaseInput,
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

  const result = await submitShowcaseCore(
    {
      name: input.name,
      tagline: input.tagline,
      description: input.description,
      url: input.url,
      logoUrl: input.logoUrl,
      screenshotUrl: input.screenshotUrl,
      sourceUrl: input.sourceUrl,
      libraries: input.libraries,
      useCases: input.useCases,
    },
    { userId: authContext.userId, source: 'mcp' },
  )

  return {
    id: result.id,
    status: result.status,
    message:
      'Showcase submitted successfully. It will be reviewed by moderators.',
  }
}
