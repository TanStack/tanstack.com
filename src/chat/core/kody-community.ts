import { z } from 'zod'

export const kodyCommunityCategorySchema = z.enum([
  'integrations',
  'examples',
  'productivity',
  'apps',
  'utilities',
  'other',
])
export const kodyCommunitySearchInputSchema = z.object({
  query: z.string().trim().max(200).default(''),
  category: kodyCommunityCategorySchema.optional(),
  sort: z.enum(['best', 'newest']).default('best'),
})
export const kodyCommunityListingIdSchema = z.string().uuid()

const kodyUrlSchema = z
  .string()
  .url()
  .max(1000)
  .refine((value) => {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'kody.codes'
  })

const listingSchema = z.object({
  listingId: kodyCommunityListingIdSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  category: kodyCommunityCategorySchema,
  version: z.string().max(100).nullable(),
  publicUrl: kodyUrlSchema,
  forkCount: z.number().int().nonnegative(),
  rating: z.number().min(0).max(5).nullable(),
  ratingCount: z.number().int().nonnegative().optional(),
  effort: z.number().min(1).max(5).nullable().optional(),
  tags: z.array(z.string().max(100)).max(100).default([]),
  publishedAt: z.string().optional(),
  iconUrl: kodyUrlSchema.optional(),
})
export type KodyCommunityListing = z.infer<typeof listingSchema>

export const kodyCommunitySearchSchema = z.object({
  outcome: z.enum(['matches', 'no_matches']),
  items: z.array(listingSchema).max(100),
  categoryCounts: z
    .record(z.string(), z.number().int().nonnegative())
    .optional(),
})

export const kodyCommunityDetailSchema = listingSchema.extend({
  status: z.enum(['active', 'delisted']),
  pinnedCommit: z.string().min(1).max(200),
  readme: z.string().max(50000),
})
