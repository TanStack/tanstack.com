import { z } from 'zod'
import { kodyUsageSchema } from '../core/kody-usage'
import { KodyConnectionError, kodyCall, type KodyEnvironment } from './kody'
import { kodyInternalReadArgs } from './kody-internal-read'
import {
  assertKodyReferenceAccountUnchanged,
  kodyReferenceAccount,
  type KodyReferenceOptions,
  type KodyReferenceScope,
} from './kody-reference-access'

export class KodyUsageError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message)
    this.name = 'KodyUsageError'
  }
}

export const KODY_USAGE_CODE = `import { kody } from 'kody:runtime'
export default async function main() {
  const usage = await kody.usageGet({})
  return {
    plan: usage.plan,
    day: usage.day,
    weekStart: usage.weekStart,
    resources: usage.resources.map(item => ({
      resource: item.resource,
      label: item.label,
      group: item.group,
      kind: item.kind,
      whatCounts: item.whatCounts,
      current: item.current,
      limit: item.limit,
      percent: item.percent,
      overEightyPercent: item.overEightyPercent,
      week: item.week && {
        current: item.week.current,
        limit: item.week.limit,
        percent: item.week.percent,
        overEightyPercent: item.week.overEightyPercent,
      },
    })),
  }
}`

export function projectKodyUsage(raw: unknown) {
  const envelope = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.object({ result: z.unknown() }),
    })
    .safeParse(raw)
  if (!envelope.success || envelope.data.isError)
    throw new KodyUsageError('Kody usage could not be read.')
  const usage = kodyUsageSchema.safeParse(
    envelope.data.structuredContent.result,
  )
  if (!usage.success)
    throw new KodyUsageError('Kody returned unsupported usage data.')
  return usage.data
}

export async function readKodyUsage(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  signal: AbortSignal,
  call: typeof kodyCall = kodyCall,
) {
  const before = await kodyReferenceAccount(env, scope, options)
  if (!before.enabled)
    throw new KodyUsageError(
      before.reason === 'blocked'
        ? 'Kody is disabled in this workspace.'
        : 'Connect Kody to view its usage.',
      409,
    )
  try {
    const response = await call(
      env,
      scope.userId,
      'execute',
      kodyInternalReadArgs({ code: KODY_USAGE_CODE, responseLimit: 100000 }),
      signal,
    )
    await assertKodyReferenceAccountUnchanged(env, scope, options, before)
    return projectKodyUsage(response)
  } catch (error) {
    if (error instanceof KodyConnectionError)
      throw new KodyUsageError(error.message, 409)
    if (
      error instanceof Error &&
      error.message === 'Kody connection or access changed. Try again.'
    )
      throw new KodyUsageError(error.message, 409)
    if (error instanceof KodyUsageError) throw error
    throw new KodyUsageError('Kody usage could not be checked right now.')
  }
}
