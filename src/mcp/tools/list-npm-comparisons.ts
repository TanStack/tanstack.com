import { z } from 'zod'
import { getPopularComparisons } from '~/routes/stats/npm/-comparisons'

export const listNpmComparisonsSchema = z.object({
  category: z
    .string()
    .optional()
    .describe('Filter by category name (case-insensitive partial match)'),
})

export type ListNpmComparisonsInput = z.infer<typeof listNpmComparisonsSchema>

export async function listNpmComparisons(input: ListNpmComparisonsInput) {
  const comparisons = getPopularComparisons()

  let filtered = comparisons

  if (input.category) {
    const search = input.category.toLowerCase()
    filtered = comparisons.filter((c) => c.title.toLowerCase().includes(search))
  }

  return {
    comparisons: filtered.map((comparison) => ({
      id: comparison.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: comparison.title,
      packages: comparison.packageGroups.flatMap((group) =>
        group.packages.filter((pkg) => !pkg.hidden).map((pkg) => pkg.name),
      ),
    })),
    total: filtered.length,
  }
}
