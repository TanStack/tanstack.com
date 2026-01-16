import { z } from 'zod'
import {
  partners,
  partnerCategories,
  partnerCategoryLabels,
} from '~/utils/partners'

export const ecosystemSchema = z.object({
  category: z
    .string()
    .optional()
    .describe(
      'Filter by category: database, auth, deployment, monitoring, cms, api, data-grid, code-review, learning',
    ),
  library: z
    .string()
    .optional()
    .describe('Filter by TanStack library (e.g., start, router, query, table)'),
})

export type EcosystemInput = z.infer<typeof ecosystemSchema>

const categoryAliases: Record<string, string> = {
  db: 'database',
  postgres: 'database',
  sql: 'database',
  login: 'auth',
  authentication: 'auth',
  hosting: 'deployment',
  deploy: 'deployment',
  serverless: 'deployment',
  errors: 'monitoring',
  logging: 'monitoring',
  content: 'cms',
  'api-keys': 'api',
  grid: 'data-grid',
  review: 'code-review',
  courses: 'learning',
}

type Category = (typeof partnerCategories)[number]

function resolveCategory(input: string): Category | undefined {
  const normalized = input.toLowerCase().trim()
  const resolved = categoryAliases[normalized] || normalized
  return partnerCategories.includes(resolved as Category)
    ? (resolved as Category)
    : undefined
}

export async function ecosystem(input: EcosystemInput) {
  const resolvedCategory = input.category
    ? resolveCategory(input.category)
    : undefined
  const lib = input.library?.toLowerCase().trim()

  const results = partners
    .filter((p) => p.status === 'active')
    .filter((p) => !resolvedCategory || p.category === resolvedCategory)
    .filter((p) => !lib || p.libraries?.some((l) => l === lib))
    .sort((a, b) => b.score - a.score)
    .map((p) => ({
      id: p.id,
      name: p.name,
      tagline: p.tagline,
      description: p.llmDescription,
      category: p.category,
      categoryLabel: partnerCategoryLabels[p.category],
      url: p.href,
      libraries: p.libraries || [],
    }))

  return {
    query: {
      category: input.category,
      categoryResolved: resolvedCategory,
      library: input.library,
    },
    count: results.length,
    partners: results,
  }
}
