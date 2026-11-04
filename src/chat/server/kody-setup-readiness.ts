import type { KodyEnvironment } from './kody'
import type { AssistantTask } from '../core/assistant-task'
import type { Policy } from '../core/types'
import { z } from 'zod'
import { kodyCall } from './kody'
import { kodyInternalReadArgs } from './kody-internal-read'
import {
  assertKodyReferenceAccountUnchanged,
  kodyReferenceAccount,
} from './kody-reference-access'

/** Kody currently reports a missing named integration as an error message. */
export function missingKodyIntegration(result: unknown) {
  if (!result || typeof result !== 'object' || !('isError' in result))
    return undefined
  if (result.isError !== true || !('content' in result)) return undefined
  if (!Array.isArray(result.content)) return undefined
  const names = new Set<string>()
  for (const part of result.content) {
    if (part?.type !== 'text' || typeof part.text !== 'string') continue
    for (const line of part.text.split('\n')) {
      const message = line
        .trim()
        .replace(/^conversationId: [A-Za-z0-9_-]{1,80} /, '')
      const match =
        /^(?:Error: )?Integration "([^"\r]{1,120})" was not found\.$/.exec(
          message,
        )
      if (match) names.add(match[1])
    }
  }
  return names.size === 1 ? [...names][0] : undefined
}

/** Bind a setup handoff only to the failed action whose own guide supplied it. */
export function requiredKodyIntegration(
  observations: AssistantTask['observations'],
  evidenceRef: string,
  url: string,
) {
  for (let index = observations.length - 1; index >= 0; index--) {
    const observation = observations[index]
    if (
      observation.outcome === 'failed' &&
      observation.kodyEntity?.startsWith('package:') &&
      observation.packageDocumentation?.entity === evidenceRef &&
      observation.packageDocumentation.content.includes(url)
    ) {
      const name =
        observation.missingKodyIntegration ??
        missingKodyIntegration(observation.result)
      if (name) return name
    }
  }
  return undefined
}

export const KODY_INTEGRATION_READINESS_CODE = `import { kody } from 'kody:runtime'
export default async function main(params) {
  const result = await kody.integrationGet({ name: params.name })
  const integration = result?.integration
  return {
    found: integration?.name === params.name,
    authFailed: integration?.name === params.name && Boolean(integration.lastAuthFailure),
  }
}`

export function projectKodyIntegrationReadiness(raw: unknown) {
  const parsed = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.object({
        result: z.object({
          found: z.boolean(),
          authFailed: z.boolean(),
        }),
      }),
    })
    .safeParse(raw)
  if (!parsed.success || parsed.data.isError)
    throw new Error('Could not check Kody integrations. Try again.')
  return parsed.data.structuredContent.result
}

export async function assertKodyIntegrationReady(
  env: KodyEnvironment,
  userId: string,
  workspaceId: string,
  policy: Policy,
  fixture: boolean,
  name: string,
  call: typeof kodyCall = kodyCall,
) {
  const scope = { workspaceId, userId }
  const options = { policy, fixture }
  const before = await kodyReferenceAccount(env, scope, options)
  if (!before.enabled) throw new Error('Connect Kody before continuing.')
  let raw: unknown
  try {
    raw = await call(
      env,
      userId,
      'execute',
      kodyInternalReadArgs({
        code: KODY_INTEGRATION_READINESS_CODE,
        params: { name },
        responseLimit: 2000,
      }),
      AbortSignal.timeout(15000),
    )
  } catch {
    throw new Error('Could not check Kody integrations. Try again.')
  }
  await assertKodyReferenceAccountUnchanged(env, scope, options, before)
  const readiness = projectKodyIntegrationReadiness(raw)
  if (!readiness.found)
    throw new Error(`Finish connecting ${name} in Kody before continuing.`)
  if (readiness.authFailed)
    throw new Error(
      `Kody reports an authentication problem for ${name}. Check the connection in Kody before continuing.`,
    )
}
