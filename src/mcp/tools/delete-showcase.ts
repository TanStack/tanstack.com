import { z } from 'zod'
import { deleteShowcaseCore } from '~/utils/showcase.server'
import { checkWriteRateLimit } from '../auth.server'
import type { McpAuthContext } from '../server'

export const deleteShowcaseSchema = z.object({
  id: z.string().uuid().describe('Showcase UUID to delete'),
})

export type DeleteShowcaseInput = z.infer<typeof deleteShowcaseSchema>

export async function deleteShowcase(
  input: DeleteShowcaseInput,
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

  await deleteShowcaseCore(input.id, {
    userId: authContext.userId,
    source: 'mcp',
  })

  return {
    success: true,
    message: 'Showcase deleted successfully',
  }
}
