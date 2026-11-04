import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  lte,
  sql,
} from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { getRequest } from '@tanstack/react-start/server'
import { getAuthGuards } from '~/auth/index.server'
import { db } from '~/db/client'
import { chatAccess, chatInvites, chatWaitlist, users } from '~/db/schema'
import { createChatInvite } from './access.server'

const pageSize = 25

export async function listChatWaitlistAdmin(input: {
  page: number
  status: 'waiting' | 'granted' | 'all'
}) {
  await getAuthGuards().requireCapability(getRequest(), 'admin')
  const filter =
    input.status === 'waiting'
      ? isNull(chatAccess.userId)
      : input.status === 'granted'
        ? isNotNull(chatAccess.userId)
        : undefined
  const [entries, [count]] = await Promise.all([
    db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        joinedAt: chatWaitlist.createdAt,
        grantedAt: chatAccess.createdAt,
      })
      .from(chatWaitlist)
      .innerJoin(users, eq(users.id, chatWaitlist.userId))
      .leftJoin(chatAccess, eq(chatAccess.userId, chatWaitlist.userId))
      .where(filter)
      .orderBy(asc(chatWaitlist.createdAt), asc(chatWaitlist.userId))
      .limit(pageSize)
      .offset(input.page * pageSize),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(chatWaitlist)
      .leftJoin(chatAccess, eq(chatAccess.userId, chatWaitlist.userId))
      .where(filter),
  ])
  return { entries, total: count.total, pageSize }
}

export async function listChatInvitesAdmin(input: {
  page: number
  status: 'pending' | 'redeemed' | 'expired' | 'all'
}) {
  await getAuthGuards().requireCapability(getRequest(), 'admin')
  const now = new Date()
  const filter =
    input.status === 'pending'
      ? and(isNull(chatInvites.redeemedAt), gt(chatInvites.expiresAt, now))
      : input.status === 'redeemed'
        ? isNotNull(chatInvites.redeemedAt)
        : input.status === 'expired'
          ? and(isNull(chatInvites.redeemedAt), lte(chatInvites.expiresAt, now))
          : undefined
  const recipient = alias(users, 'invite_recipient')
  const [entries, [count]] = await Promise.all([
    db
      .select({
        tokenHash: chatInvites.tokenHash,
        createdBy: users.email,
        redeemedBy: recipient.email,
        createdAt: chatInvites.createdAt,
        expiresAt: chatInvites.expiresAt,
        redeemedAt: chatInvites.redeemedAt,
      })
      .from(chatInvites)
      .innerJoin(users, eq(users.id, chatInvites.createdBy))
      .leftJoin(recipient, eq(recipient.id, chatInvites.redeemedBy))
      .where(filter)
      .orderBy(desc(chatInvites.createdAt), asc(chatInvites.tokenHash))
      .limit(pageSize)
      .offset(input.page * pageSize),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(chatInvites)
      .where(filter),
  ])
  return { entries, total: count.total, pageSize, serverTime: now }
}

export async function grantChatAccessAdmin(userId: string) {
  const admin = await getAuthGuards().requireCapability(getRequest(), 'admin')
  await db.transaction(async (tx) => {
    // Use the same user lock as invite redemption so approval cannot race it.
    await tx.execute(sql`select id from users where id = ${userId} for update`)
    const [entry] = await tx
      .select({ userId: chatWaitlist.userId })
      .from(chatWaitlist)
      .where(eq(chatWaitlist.userId, userId))
    if (!entry) throw new Error('This user is not on the TanChat waitlist.')
    await tx
      .insert(chatAccess)
      .values({ userId, invitedBy: admin.userId })
      .onConflictDoNothing()
  })
  return { userId }
}

export async function createChatInviteAdmin() {
  const admin = await getAuthGuards().requireCapability(getRequest(), 'admin')
  return createChatInvite(admin)
}

export async function expireChatInviteAdmin(tokenHash: string) {
  await getAuthGuards().requireCapability(getRequest(), 'admin')
  const now = new Date()
  const [invite] = await db
    .update(chatInvites)
    .set({ expiresAt: now })
    .where(
      and(
        eq(chatInvites.tokenHash, tokenHash),
        isNull(chatInvites.redeemedAt),
        gt(chatInvites.expiresAt, now),
      ),
    )
    .returning({ tokenHash: chatInvites.tokenHash })
  if (!invite) throw new Error('This invite has already been used or expired.')
  return invite
}
