import type { Policy, Provider, Recipe } from './types'
export type Route =
  | { type: 'model' }
  | { type: 'answer'; text: string }
  | { type: 'recipe'; recipe: Recipe }
  | { type: 'kody-answer'; packageName: string }
export interface RoutingContext {
  text: string
  recipes: Recipe[]
  policy: Policy
  answerPackage?: string
}
export interface RouteCandidate {
  id: string
  description: string
  route: Route
}
export interface RoutingPlugin {
  id: string
  description: string
  /** Advertise choices. Never execute a tool or model before Jev selects one. */
  candidates(context: RoutingContext): Promise<RouteCandidate[]>
}
export function enforceModel(
  policy: Policy,
  provider: Provider,
  model: string,
) {
  if (!policy.allowChatModels)
    throw new Error('Chat models are disabled by workspace policy.')
  if (!policy.allowedProviders.includes(provider))
    throw new Error('This AI provider is not allowed in this workspace.')
  if (policy.allowedModels.length && !policy.allowedModels.includes(model))
    throw new Error('This model is not allowed in this workspace.')
}
export const savedActionPlugin: RoutingPlugin = {
  id: 'saved-actions',
  description: 'Offer saved actions that can run unchanged after approval.',
  async candidates({ recipes, policy }) {
    if (!policy.allowKody || !policy.allowChatModels) return []
    // Arbitrary saved code cannot promise that its dependencies avoid chat models.
    return recipes.slice(0, 80).map((recipe) => ({
      id: `recipe:${recipe.id}`,
      description: `${recipe.title}: ${recipe.description}. Choose for /${recipe.title}, or an exact request to run it unchanged. Execution requires approval.`,
      route: { type: 'recipe', recipe },
    }))
  },
}
export const answerQuestionPlugin: RoutingPlugin = {
  id: 'kody-answer',
  description:
    'Answer a factual public-information question with cited evidence.',
  async candidates({ policy, answerPackage }) {
    if (!policy.allowKody || !answerPackage) return []
    return [
      {
        id: 'kody-answer',
        description:
          'Research stable factual questions with Wikipedia search and article tools. TanChat uses Jev to choose each step and verify evidence. Handles follow-ups using recent conversation. Does not support live facts, general web search, writing, personal advice, or private accounts. Prefer this over a model for encyclopedic questions.',
        route: { type: 'kody-answer', packageName: answerPackage },
      },
    ]
  },
}
export const customPlugins: RoutingPlugin[] = [
  savedActionPlugin,
  answerQuestionPlugin,
]
export async function routeCandidates(
  context: RoutingContext,
  plugins = customPlugins,
) {
  const candidates: RouteCandidate[] = []
  for (const plugin of plugins) {
    for (const candidate of await plugin.candidates(context)) {
      if (candidates.some((c) => c.id === candidate.id))
        throw new Error('Duplicate routing capability.')
      candidates.push(candidate)
    }
  }
  return candidates
}
export const clarification: Route = {
  type: 'answer',
  text: 'Could you be more specific about what you want me to find or do?',
}
export function selectJevRoute(
  value: string,
  probability: number,
  candidates: RouteCandidate[],
  noChatModels = false,
): Route {
  if (!Number.isFinite(probability) || probability < 0.8 || probability > 1)
    return clarification
  const route = candidates.find((c) => c.id === value)?.route
  if (!route) return clarification
  if (noChatModels && (route.type === 'model' || route.type === 'recipe')) {
    return {
      type: 'answer',
      text: 'I cannot complete that request with chat models disabled. I can look up factual questions through Kody without using one.',
    }
  }
  return route
}
