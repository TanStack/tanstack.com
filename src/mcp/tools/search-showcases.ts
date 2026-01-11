import { z } from 'zod'
import {
  searchShowcasesCore,
  validLibraryIds,
  validUseCases,
} from '~/utils/showcase.server'

export const searchShowcasesSchema = z.object({
  query: z
    .string()
    .optional()
    .describe('Text search across name, tagline, description, and URL'),
  libraryIds: z
    .array(z.string())
    .optional()
    .describe(
      `Filter by TanStack library IDs. Valid: ${validLibraryIds.join(', ')}`,
    ),
  useCases: z
    .array(z.string())
    .optional()
    .describe(`Filter by use cases. Valid: ${validUseCases.join(', ')}`),
  hasSourceCode: z
    .boolean()
    .optional()
    .describe('Filter to only open source projects with source code'),
  featured: z.boolean().optional().describe('Filter to only featured projects'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe('Max results to return (default 20, max 100)'),
  offset: z
    .number()
    .min(0)
    .optional()
    .describe('Pagination offset (default 0)'),
})

export type SearchShowcasesInput = z.infer<typeof searchShowcasesSchema>

export async function searchShowcases(input: SearchShowcasesInput) {
  const limit = Math.min(input.limit ?? 20, 100)
  const offset = input.offset ?? 0
  const page = Math.floor(offset / limit) + 1

  const result = await searchShowcasesCore({
    filters: {
      libraryIds: input.libraryIds,
      useCases: input.useCases,
      featured: input.featured,
      hasSourceCode: input.hasSourceCode,
      q: input.query,
    },
    pagination: { page, pageSize: limit },
  })

  return {
    showcases: result.showcases.map((s) => ({
      id: s.showcase.id,
      name: s.showcase.name,
      tagline: s.showcase.tagline,
      url: s.showcase.url,
      sourceUrl: s.showcase.sourceUrl,
      screenshotUrl: s.showcase.screenshotUrl,
      libraries: s.showcase.libraries,
      useCases: s.showcase.useCases,
      voteScore: s.showcase.voteScore,
      isFeatured: s.showcase.isFeatured,
      createdAt: s.showcase.createdAt?.toISOString(),
    })),
    pagination: {
      total: result.pagination.total,
      limit,
      offset,
      hasMore: offset + result.showcases.length < result.pagination.total,
    },
  }
}
