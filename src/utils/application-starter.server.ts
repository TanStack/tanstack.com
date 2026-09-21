import { inferApplicationStarterPartnerIntent } from './application-starter-intent.server'
import { z } from 'zod'
import {
  getInferredApplicationStarterLibraryIds,
  resolveApplicationStarterDeterministically,
  type ApplicationStarterAnalysis,
  type ApplicationStarterRequest,
  type ApplicationStarterResult,
} from '~/utils/application-starter'
import {
  partners,
  getApplicationStarterCompatiblePartnerIds,
  getInferredApplicationStarterPartnerIdsFromUserInput,
} from '~/utils/partners'

export const applicationStarterRequestSchema = z.object({
  context: z.enum(['application-starter', 'home', 'router', 'start']),
  input: z.string().trim().min(1).max(4000),
})

export async function resolveApplicationStarterServer({
  data,
}: {
  data: ApplicationStarterRequest
}) {
  const request = applicationStarterRequestSchema.parse(data)
  return resolveApplicationStarterDeterministically(request)
}

export async function analyzeApplicationStarterServer({
  data,
}: {
  data: ApplicationStarterRequest
}) {
  const request = applicationStarterRequestSchema.parse(data)
  const deterministicResult =
    await resolveApplicationStarterDeterministically(request)

  return {
    ...buildDeterministicApplicationStarterAnalysis({
      deterministicResult,
      request,
    }),
    partnerIntent:
      request.context === 'home'
        ? await inferApplicationStarterPartnerIntent(
            request.input,
            partners.filter((partner) => partner.status === 'active'),
          )
        : null,
  }
}

function buildDeterministicApplicationStarterAnalysis({
  deterministicResult,
  request,
}: {
  deterministicResult: ApplicationStarterResult
  request: ApplicationStarterRequest
}): ApplicationStarterAnalysis {
  return {
    inferredLibraryIds: getInferredApplicationStarterLibraryIds(request.input),
    inferredPartnerIds: getApplicationStarterCompatiblePartnerIds(
      getInferredApplicationStarterPartnerIdsFromUserInput(request.input, []),
    ),
    rationale: deterministicResult.rationale,
    recipe: deterministicResult.recipe,
    summary: deterministicResult.summary,
  }
}
