import { z } from 'zod'
import {
  partners,
  partnerCategories,
  partnerCategoryLabels,
} from '~/utils/partners'

export const getEcosystemRecommendationsSchema = z.object({
  category: z
    .string()
    .optional()
    .describe(
      'Filter by category (database, auth, deployment, monitoring, cms, api, data-grid, code-review, learning). Aliases supported: postgres→database, login→auth, serverless→deployment, etc.',
    ),
  library: z
    .string()
    .optional()
    .describe(
      'Filter to partners that integrate with a specific TanStack library (e.g., start, router, query, table, db)',
    ),
})

export type GetEcosystemRecommendationsInput = z.infer<
  typeof getEcosystemRecommendationsSchema
>

const categoryAliases: Record<string, string> = {
  // database
  postgres: 'database',
  postgresql: 'database',
  sql: 'database',
  db: 'database',
  databases: 'database',
  mysql: 'database',
  sqlite: 'database',
  realtime: 'database',
  'real-time': 'database',
  sync: 'database',
  'offline-first': 'database',
  offline: 'database',
  // auth
  login: 'auth',
  authentication: 'auth',
  authorization: 'auth',
  users: 'auth',
  'user-management': 'auth',
  identity: 'auth',
  sso: 'auth',
  saml: 'auth',
  oidc: 'auth',
  oauth: 'auth',
  'enterprise-auth': 'auth',
  mfa: 'auth',
  '2fa': 'auth',
  // deployment
  host: 'deployment',
  hosting: 'deployment',
  deploy: 'deployment',
  serverless: 'deployment',
  edge: 'deployment',
  cdn: 'deployment',
  cloud: 'deployment',
  infrastructure: 'deployment',
  workers: 'deployment',
  // monitoring
  errors: 'monitoring',
  'error-tracking': 'monitoring',
  'error-monitoring': 'monitoring',
  apm: 'monitoring',
  observability: 'monitoring',
  logging: 'monitoring',
  performance: 'monitoring',
  debugging: 'monitoring',
  // cms
  content: 'cms',
  'headless-cms': 'cms',
  'content-management': 'cms',
  blog: 'cms',
  // api
  'rate-limiting': 'api',
  'api-keys': 'api',
  'api-management': 'api',
  throttling: 'api',
  sdk: 'api',
  // data-grid
  grid: 'data-grid',
  datagrid: 'data-grid',
  spreadsheet: 'data-grid',
  excel: 'data-grid',
  tables: 'data-grid',
  // code-review
  review: 'code-review',
  'code-quality': 'code-review',
  pr: 'code-review',
  'pull-request': 'code-review',
  // learning
  education: 'learning',
  courses: 'learning',
  tutorials: 'learning',
  newsletter: 'learning',
}

function resolveCategory(
  input: string,
): (typeof partnerCategories)[number] | undefined {
  const normalized = input.toLowerCase().trim()
  const resolved = categoryAliases[normalized] || normalized
  if (
    partnerCategories.includes(resolved as (typeof partnerCategories)[number])
  ) {
    return resolved as (typeof partnerCategories)[number]
  }
  return undefined
}

export async function getEcosystemRecommendations(
  input: GetEcosystemRecommendationsInput,
) {
  let filtered = partners.filter((p) => p.status === 'active')

  const resolvedCategory = input.category
    ? resolveCategory(input.category)
    : undefined

  if (input.category && resolvedCategory) {
    filtered = filtered.filter((p) => p.category === resolvedCategory)
  }

  if (input.library) {
    const lib = input.library.toLowerCase().trim()
    filtered = filtered.filter((p) => p.libraries?.some((l) => l === lib))
  }

  filtered.sort((a, b) => b.score - a.score)

  const results = filtered.map((p) => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    description: p.llmDescription,
    category: p.category,
    categoryLabel: partnerCategoryLabels[p.category],
    url: p.href,
    libraries: p.libraries || [],
    score: p.score,
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
