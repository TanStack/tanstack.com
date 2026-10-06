import { and, eq, sql } from 'drizzle-orm'
import { db } from '~/db/client'
import {
  oauthAccounts,
  chatAccess,
  chatInvites,
  chatWaitlist,
} from '~/db/schema'
import { allMaintainers } from '~/libraries/maintainers'
import { getAuthGuards } from '~/auth/index.server'
import type { AuthUser } from '~/auth/types'

const maintainers = new Set(
  allMaintainers
    .filter(
      (person) =>
        person.isCoreMaintainer ||
        person.creatorOf?.length ||
        person.maintainerOf?.length,
    )
    .map((person) => person.github.toLowerCase()),
)
const identities = new Map<string, { login: string; expires: number }>()
async function unlimited(user: AuthUser) {
  if (user.capabilities.includes('admin')) return true
  const accounts = await db
    .select({ id: oauthAccounts.providerAccountId })
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.userId, user.userId),
        eq(oauthAccounts.provider, 'github'),
      ),
    )
  for (const account of accounts) {
    if (!/^\d+$/.test(account.id)) continue
    let identity = identities.get(account.id)
    if (!identity || identity.expires < Date.now()) {
      const response = await fetch(
        `https://api.github.com/user/${account.id}`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'TanChat',
          },
        },
      )
      if (!response.ok) continue
      const profile: unknown = await response.json()
      if (
        !profile ||
        typeof profile !== 'object' ||
        !('login' in profile) ||
        typeof profile.login !== 'string' ||
        !('id' in profile) ||
        String(profile.id) !== account.id
      )
        continue
      identity = {
        login: profile.login.toLowerCase(),
        expires: Date.now() + 3600000,
      }
      identities.set(account.id, identity)
    }
    if (maintainers.has(identity.login)) return true
  }
  return false
}
export async function readChatAccess(user: AuthUser) {
  const elevated = await unlimited(user)
  const [grant] = await db
    .select()
    .from(chatAccess)
    .where(eq(chatAccess.userId, user.userId))
  const [usage] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chatInvites)
    .where(eq(chatInvites.createdBy, user.userId))
  return {
    unlocked: elevated || !!grant,
    unlimited: elevated,
    remaining: elevated ? null : Math.max(0, 3 - usage.count),
  }
}
export async function hasChatAccess(user: AuthUser) {
  if (await unlimited(user)) return true
  const [grant] = await db
    .select({ id: chatAccess.userId })
    .from(chatAccess)
    .where(eq(chatAccess.userId, user.userId))
  return !!grant
}
export async function requireChatUser(request: Request) {
  const user = await getAuthGuards().requireAuth(request)
  if (!(await hasChatAccess(user)))
    throw new Error('TanChat requires an invite.')
  return user
}
async function digest(token: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}
export async function createChatInvite(user: AuthUser) {
  const elevated = await unlimited(user)
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`
  const tokenHash = await digest(token)
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from users where id = ${user.userId} for update`,
    )
    const [grant] = await tx
      .select()
      .from(chatAccess)
      .where(eq(chatAccess.userId, user.userId))
    if (!elevated && !grant) throw new Error('TanChat requires an invite.')
    const [usage] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(chatInvites)
      .where(eq(chatInvites.createdBy, user.userId))
    if (!elevated && usage.count >= 3)
      throw new Error('You have used your three invites.')
    await tx.insert(chatInvites).values({
      tokenHash,
      createdBy: user.userId,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    })
  })
  return { token }
}
export async function redeemChatInvite(user: AuthUser, token: string) {
  const elevated = await unlimited(user)
  const tokenHash = await digest(token)
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from users where id = ${user.userId} for update`,
    )
    if (elevated) return
    const [grant] = await tx
      .select()
      .from(chatAccess)
      .where(eq(chatAccess.userId, user.userId))
    if (grant) return
    const [invite] = await tx
      .select()
      .from(chatInvites)
      .where(eq(chatInvites.tokenHash, tokenHash))
      .for('update')
    if (
      !invite ||
      invite.redeemedAt ||
      invite.expiresAt.getTime() <= Date.now() ||
      invite.createdBy === user.userId
    )
      throw new Error('This invite is invalid, expired, or already used.')
    await tx
      .insert(chatAccess)
      .values({ userId: user.userId, invitedBy: invite.createdBy })
    await tx
      .update(chatInvites)
      .set({ redeemedBy: user.userId, redeemedAt: new Date() })
      .where(eq(chatInvites.tokenHash, tokenHash))
  })
  return { unlocked: true }
}

export async function readChatWaitlist(user: AuthUser) {
  const [entry] = await db
    .select({ userId: chatWaitlist.userId })
    .from(chatWaitlist)
    .where(eq(chatWaitlist.userId, user.userId))
  return !!entry
}
export async function joinChatWaitlist(user: AuthUser) {
  await db
    .insert(chatWaitlist)
    .values({ userId: user.userId })
    .onConflictDoNothing()
}
