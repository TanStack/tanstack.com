import { z } from 'zod'
import { getMyShowcasesCore } from '~/utils/showcase.server'
import type { McpAuthContext } from '../server'

export const listMyShowcasesSchema = z.object({
  status: z
    .enum(['pending', 'approved', 'denied'])
    .optional()
    .describe('Filter by status'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe('Max results (default 20, max 100)'),
  offset: z
    .number()
    .min(0)
    .optional()
    .describe('Pagination offset (default 0)'),
})

export type ListMyShowcasesInput = z.infer<typeof listMyShowcasesSchema>

export async function listMyShowcases(
  input: ListMyShowcasesInput,
  authContext?: McpAuthContext,
) {
  if (!authContext) {
    throw new Error('Authentication required')
  }

  const limit = Math.min(input.limit ?? 20, 100)
  const offset = input.offset ?? 0
  const page = Math.floor(offset / limit) + 1

  const result = await getMyShowcasesCore({
    userId: authContext.userId,
    pagination: { page, pageSize: limit },
    status: input.status,
  })

  return {
    showcases: result.showcases.map((s) => ({
      id: s.id,
      name: s.name,
      tagline: s.tagline,
      url: s.url,
      sourceUrl: s.sourceUrl,
      status: s.status,
      moderationNote: s.status === 'denied' ? s.moderationNote : undefined,
      createdAt: s.createdAt?.toISOString(),
      updatedAt: s.updatedAt?.toISOString(),
    })),
    pagination: {
      total: result.pagination.total,
      limit,
      offset,
      hasMore: offset + result.showcases.length < result.pagination.total,
    },
  }
}
