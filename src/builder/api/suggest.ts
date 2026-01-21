import { fetchManifest } from '@tanstack/cli'
import type { ProjectDefinition } from './compile'
import { getAddonsBasePath } from './config'

export interface SuggestRequest {
  description?: string
  current?: Partial<ProjectDefinition>
  intent?: 'full-stack' | 'api-only' | 'static' | 'database' | 'auth' | 'deploy'
}

export interface FeatureSuggestion {
  id: string
  name: string
  reason: string
  confidence: 'high' | 'medium' | 'low'
  category: string
}

export interface SuggestResponse {
  suggestions: Array<FeatureSuggestion>
  reasoning: string
  recommendedTemplate?: string
}

const FEATURE_KEYWORDS: Record<
  string,
  Array<{ keyword: string; weight: number }>
> = {
  'tanstack-query': [
    { keyword: 'data fetching', weight: 1 },
    { keyword: 'api', weight: 0.7 },
    { keyword: 'server state', weight: 1 },
    { keyword: 'cache', weight: 0.8 },
    { keyword: 'react query', weight: 1 },
    { keyword: 'tanstack query', weight: 1 },
  ],
  'tanstack-form': [
    { keyword: 'form', weight: 1 },
    { keyword: 'validation', weight: 0.8 },
    { keyword: 'input', weight: 0.5 },
  ],
  'tanstack-table': [
    { keyword: 'table', weight: 1 },
    { keyword: 'grid', weight: 0.8 },
    { keyword: 'data grid', weight: 1 },
    { keyword: 'sorting', weight: 0.7 },
  ],
  drizzle: [
    { keyword: 'database', weight: 0.9 },
    { keyword: 'sql', weight: 0.8 },
    { keyword: 'postgres', weight: 0.9 },
    { keyword: 'orm', weight: 0.8 },
    { keyword: 'drizzle', weight: 1 },
  ],
  prisma: [
    { keyword: 'prisma', weight: 1 },
    { keyword: 'database', weight: 0.7 },
    { keyword: 'orm', weight: 0.7 },
  ],
  clerk: [
    { keyword: 'auth', weight: 0.8 },
    { keyword: 'authentication', weight: 0.9 },
    { keyword: 'login', weight: 0.8 },
    { keyword: 'clerk', weight: 1 },
  ],
  'better-auth': [
    { keyword: 'auth', weight: 0.7 },
    { keyword: 'self-hosted', weight: 1 },
    { keyword: 'better-auth', weight: 1 },
  ],
  trpc: [
    { keyword: 'trpc', weight: 1 },
    { keyword: 'type-safe api', weight: 0.9 },
    { keyword: 'rpc', weight: 0.7 },
  ],
  ai: [
    { keyword: 'ai', weight: 1 },
    { keyword: 'llm', weight: 0.9 },
    { keyword: 'chatbot', weight: 0.9 },
    { keyword: 'openai', weight: 0.8 },
  ],
  shadcn: [
    { keyword: 'ui', weight: 0.6 },
    { keyword: 'components', weight: 0.6 },
    { keyword: 'shadcn', weight: 1 },
  ],
  sentry: [
    { keyword: 'error tracking', weight: 1 },
    { keyword: 'monitoring', weight: 0.8 },
    { keyword: 'sentry', weight: 1 },
  ],
}

const INTENT_FEATURES: Record<string, Array<string>> = {
  'full-stack': ['tanstack-query', 'drizzle', 'shadcn', 'biome'],
  'api-only': ['tanstack-query', 'drizzle', 'trpc'],
  database: ['drizzle'],
  auth: ['clerk'],
  deploy: ['netlify'],
}

export async function suggestHandler(
  request: SuggestRequest,
): Promise<SuggestResponse> {
  const basePath = getAddonsBasePath()
  const manifest = await fetchManifest(basePath)
  const integrationMap = new Map(
    manifest.integrations.map((i) => [i.id, i] as const),
  )

  const suggestions: Array<FeatureSuggestion> = []
  const reasons: Array<string> = []

  const currentFeatures = new Set(request.current?.features || [])

  // Score features based on description
  if (request.description) {
    const description = request.description.toLowerCase()

    for (const [featureId, keywords] of Object.entries(FEATURE_KEYWORDS)) {
      if (currentFeatures.has(featureId)) continue

      let score = 0
      const matchedKeywords: Array<string> = []

      for (const { keyword, weight } of keywords) {
        if (description.includes(keyword.toLowerCase())) {
          score += weight
          matchedKeywords.push(keyword)
        }
      }

      if (score > 0) {
        const integration = integrationMap.get(featureId)
        if (integration) {
          suggestions.push({
            id: featureId,
            name: integration.name,
            reason: `Matches: ${matchedKeywords.join(', ')}`,
            confidence: score >= 1 ? 'high' : score >= 0.5 ? 'medium' : 'low',
            category: integration.category ?? 'other',
          })
        }
      }
    }

    if (suggestions.length > 0) {
      reasons.push(
        `Based on your description, I identified ${suggestions.length} relevant features.`,
      )
    }
  }

  if (request.intent && INTENT_FEATURES[request.intent]) {
    const intentFeatures = INTENT_FEATURES[request.intent]

    for (const featureId of intentFeatures) {
      if (currentFeatures.has(featureId)) continue
      if (suggestions.some((s) => s.id === featureId)) continue

      const integration = integrationMap.get(featureId)
      if (integration) {
        suggestions.push({
          id: featureId,
          name: integration.name,
          reason: `Recommended for ${request.intent} projects`,
          confidence: 'high',
          category: integration.category ?? 'other',
        })
      }
    }

    reasons.push(`Added recommendations for ${request.intent} development.`)
  }

  const confidenceOrder = { high: 0, medium: 1, low: 2 }
  suggestions.sort(
    (a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence],
  )

  for (const suggestion of [...suggestions]) {
    const integration = integrationMap.get(suggestion.id)
    if (integration?.dependsOn) {
      for (const required of integration.dependsOn) {
        if (
          !currentFeatures.has(required) &&
          !suggestions.some((s) => s.id === required)
        ) {
          const requiredIntegration = integrationMap.get(required)
          if (requiredIntegration) {
            suggestions.push({
              id: required,
              name: requiredIntegration.name,
              reason: `Required by ${suggestion.name}`,
              confidence: 'high',
              category: requiredIntegration.category ?? 'other',
            })
          }
        }
      }
    }
  }

  return {
    suggestions: suggestions.slice(0, 10),
    reasoning: reasons.join(' '),
  }
}
