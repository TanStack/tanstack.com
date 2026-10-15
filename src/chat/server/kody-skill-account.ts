import { and, eq } from 'drizzle-orm'
import { db } from '~/db/client'
import { chatWorkspaces, chatMemberships, chatKodyLinks } from '~/db/schema'
import { policySchema } from '../core/types'
import { readCredentials } from './credentials'
import { hash } from './crypto'
import { SkillError, type SkillScope } from './skills'
import type { KodyEnvironment } from './kody'

/** Source catalog identity protocol, shared by cache reads and sync publication. */
export async function kodySkillAccount(
  env: KodyEnvironment & { APP_MODE?: string },
  scope: SkillScope,
) {
  if (env.APP_MODE === 'fixture' || !env.KODY_ORIGIN) return undefined
  const [row] = await db
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
  if (!row) throw new SkillError('Workspace access is unavailable.', 403)
  const parsed = policySchema.safeParse(row.policy)
  if (!parsed.success)
    throw new SkillError('Workspace policy is unavailable.', 403)
  if (!parsed.data.allowKody) return undefined
  const credentials = await readCredentials(env, scope.userId)
  if (!credentials?.kody) return undefined
  return {
    fingerprint: await hash(
      JSON.stringify([
        'kody-skills-v1',
        env.KODY_ORIGIN,
        row.subject,
        credentials.kody.client_id,
        ...(row.subject ? [] : [credentials.kody.access_token]),
      ]),
    ),
  }
}
