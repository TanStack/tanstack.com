import { and, eq } from 'drizzle-orm'
import { db } from '~/db/client'
import { chatWorkspaces, chatMemberships, chatKodyLinks } from '~/db/schema'
import type { KodyEnvironment } from './kody'
import { z } from 'zod'
import type { KodyJobChange } from '../core/kody-jobs'
import { policySchema } from '../core/types'
import { KodyConnectionError, kodyCall } from './kody'

export class KodyJobError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message)
    this.name = 'KodyJobError'
  }
}

const readCode = `import { kody } from 'kody:runtime'
export default async function main(params) {
  const value = await kody.jobGet({ id: params.id })
  const job = value.job
  return { id: job.id, source_id: job.source_id, published_commit: job.published_commit, enabled: job.enabled, kill_switch_enabled: job.kill_switch_enabled, expired: job.expired, updated_at: job.updated_at }
}`
const updateCode = `import { kody } from 'kody:runtime'
export default async function main(params) {
  const job = await kody.jobUpdate({ id: params.id, enabled: params.enabled })
  return { id: job.job_id, source_id: job.source_id, published_commit: job.published_commit, enabled: job.enabled, updated_at: job.updated_at }
}`
const jobSchema = z.object({
  id: z.string(),
  source_id: z.string(),
  published_commit: z.string().nullable(),
  enabled: z.boolean(),
  updated_at: z.string(),
  kill_switch_enabled: z.boolean().optional(),
  expired: z.boolean().optional(),
})
const envelopeSchema = z.object({
  isError: z.boolean().optional(),
  structuredContent: z.object({ result: z.unknown() }).optional(),
})

function job(raw: unknown) {
  try {
    const envelope = envelopeSchema.parse(raw)
    if (envelope.isError || !envelope.structuredContent)
      throw new KodyJobError('Kody could not confirm this job change.', 502)
    return jobSchema.parse(envelope.structuredContent.result)
  } catch {
    throw new KodyJobError('Kody could not confirm this job change.', 502)
  }
}

async function callJob(
  call: typeof kodyCall,
  env: KodyEnvironment,
  userId: string,
  code: string,
  params: { id: string; enabled?: boolean },
  signal?: AbortSignal,
) {
  try {
    return job(
      await call(
        env,
        userId,
        'execute',
        { code, params, responseLimit: 4000 },
        signal,
      ),
    )
  } catch (error) {
    if (error instanceof KodyConnectionError)
      throw new KodyJobError(error.message, 401)
    throw new KodyJobError('Kody could not confirm this job change.', 502)
  }
}

async function binding(
  env: KodyEnvironment,
  workspaceId: string,
  userId: string,
) {
  const [stored] = await db
    .select({ policy: chatWorkspaces.policy, subject: chatKodyLinks.subject })
    .from(chatWorkspaces)
    .innerJoin(
      chatMemberships,
      eq(chatMemberships.workspaceId, chatWorkspaces.id),
    )
    .innerJoin(chatKodyLinks, eq(chatKodyLinks.userId, chatMemberships.userId))
    .where(
      and(
        eq(chatWorkspaces.id, workspaceId),
        eq(chatMemberships.userId, userId),
      ),
    )
  const row = stored
    ? { policy: JSON.stringify(stored.policy), subject: stored.subject }
    : undefined
  if (!row) throw new KodyJobError('Kody is unavailable here.', 403)
  try {
    if (!policySchema.parse(JSON.parse(row.policy)).allowKody)
      throw new KodyJobError('Kody is unavailable here.', 403)
  } catch {
    throw new KodyJobError('Kody is unavailable here.', 403)
  }
  return row
}

/** Desired-state update. A retry reads Kody first, so a lost response does not toggle twice. */
export async function changeKodyJob(
  env: KodyEnvironment,
  scope: { workspaceId: string; userId: string },
  id: string,
  change: KodyJobChange,
  signal?: AbortSignal,
  call: typeof kodyCall = kodyCall,
) {
  const before = await binding(env, scope.workspaceId, scope.userId)
  const current = await callJob(
    call,
    env,
    scope.userId,
    readCode,
    { id },
    signal,
  )
  if (
    current.id !== id ||
    current.source_id !== change.expected.sourceId ||
    current.published_commit !== change.expected.publishedCommit
  )
    throw new KodyJobError('This job changed in Kody. Refresh and try again.')
  if (
    current.kill_switch_enabled === undefined ||
    current.expired === undefined
  )
    throw new KodyJobError('Kody did not return the full job state.', 502)
  if (current.enabled === change.enabled)
    return {
      id,
      enabled: current.enabled,
      changed: false,
      updatedAt: current.updated_at,
    }
  if (
    current.updated_at !== change.expected.updatedAt ||
    current.enabled !== change.expected.enabled
  )
    throw new KodyJobError('This job changed in Kody. Refresh and try again.')
  if (change.enabled && (current.kill_switch_enabled || current.expired))
    throw new KodyJobError(
      'This job cannot resume while Kody has stopped or expired it.',
    )
  const after = await binding(env, scope.workspaceId, scope.userId)
  if (after.subject !== before.subject || after.policy !== before.policy)
    throw new KodyJobError('Kody access changed. Refresh and try again.')
  const updated = await callJob(
    call,
    env,
    scope.userId,
    updateCode,
    { id, enabled: change.enabled },
    signal,
  )
  if (
    updated.id !== id ||
    updated.source_id !== current.source_id ||
    updated.published_commit !== current.published_commit ||
    updated.enabled !== change.enabled
  )
    throw new KodyJobError('Kody did not confirm the requested job state.', 502)
  return {
    id,
    enabled: updated.enabled,
    changed: true,
    updatedAt: updated.updated_at,
  }
}
