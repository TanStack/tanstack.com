import { and, eq } from 'drizzle-orm'
import { db } from '~/db/client'
import { chatWorkspaces, chatMemberships, chatKodyLinks } from '~/db/schema'
import type { KodyEnvironment } from './kody'
import { policySchema, type Policy } from '../core/types'
import { readCredentials } from './credentials'
import { hash } from './crypto'

export interface KodyReferenceScope {
  workspaceId: string
  userId: string
}
export interface KodyReferenceOptions {
  policy: Policy
  fixture: boolean
}

export async function kodyReferenceAccount(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
) {
  const [stored] = await db
    .select({ policy: chatWorkspaces.policy, subject: chatKodyLinks.subject })
    .from(chatWorkspaces)
    .innerJoin(
      chatMemberships,
      eq(chatMemberships.workspaceId, chatWorkspaces.id),
    )
    .leftJoin(chatKodyLinks, eq(chatKodyLinks.userId, chatMemberships.userId))
    .where(
      and(
        eq(chatWorkspaces.id, scope.workspaceId),
        eq(chatMemberships.userId, scope.userId),
      ),
    )
  const row = stored
    ? { ...stored, policy: JSON.stringify(stored.policy) }
    : undefined
  if (!row) throw new Error('Workspace access is unavailable.')
  let policy: Policy
  try {
    policy = policySchema.parse(JSON.parse(row.policy))
  } catch {
    throw new Error('Workspace policy is unavailable.')
  }
  if (options.fixture || !policy.allowKody || !options.policy.allowKody)
    return {
      enabled: false as const,
      reason: 'blocked' as const,
      policyText: row.policy,
      subject: row.subject,
    }
  const credentials = await readCredentials(env, scope.userId)
  if (!credentials?.kody)
    return {
      enabled: false as const,
      reason: 'disconnected' as const,
      policyText: row.policy,
      subject: row.subject,
    }
  const fingerprint = await hash(
    JSON.stringify([
      'kody-reference-v4',
      env.KODY_ORIGIN,
      row.subject,
      credentials.kody.client_id,
      ...(row.subject ? [] : [credentials.kody.access_token]),
    ]),
  )
  return {
    enabled: true as const,
    policyText: row.policy,
    subject: row.subject,
    fingerprint,
  }
}

export async function assertKodyReferenceAccountUnchanged(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  previous: Awaited<ReturnType<typeof kodyReferenceAccount>>,
) {
  const current = await kodyReferenceAccount(env, scope, options)
  if (
    !current.enabled ||
    !previous.enabled ||
    current.policyText !== previous.policyText ||
    current.fingerprint !== previous.fingerprint ||
    current.subject !== previous.subject
  )
    throw new Error('Kody connection or access changed. Try again.')
  return current
}
