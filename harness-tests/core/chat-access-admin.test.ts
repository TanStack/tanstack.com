import { beforeEach, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const mocks = vi.hoisted(() => {
  const rows: unknown[][] = []
  const filters: (SQL | undefined)[] = []
  return {
    rows,
    filters,
    requireCapability: vi.fn(),
    select: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    lock: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    createInvite: vi.fn(),
  }
})
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => new Request('https://tanstack.com/admin/chat-access'),
}))
vi.mock('~/auth/index.server', () => ({
  getAuthGuards: () => ({ requireCapability: mocks.requireCapability }),
}))
vi.mock('~/chat/access.server', () => ({
  createChatInvite: mocks.createInvite,
}))
vi.mock('~/db/client', () => {
  function query() {
    const rows = mocks.rows.shift() ?? []
    const chain = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: (filter: SQL | undefined) => {
        mocks.filters.push(filter)
        return chain
      },
      orderBy: () => chain,
      limit: (size: number) => {
        mocks.limit(size)
        return chain
      },
      offset: (offset: number) => {
        mocks.offset(offset)
        return chain
      },
      returning: () => chain,
      then: (resolve: (value: unknown[]) => unknown) =>
        Promise.resolve(rows).then(resolve),
    }
    return chain
  }
  const db = {
    select: (...args: unknown[]) => {
      mocks.select(...args)
      return query()
    },
    execute: mocks.lock,
    insert: () => ({
      values: (values: unknown) => {
        mocks.insert(values)
        return { onConflictDoNothing: vi.fn() }
      },
    }),
    update: () => ({
      set: (values: unknown) => {
        mocks.update(values)
        return query()
      },
    }),
    transaction: (run: (tx: unknown) => unknown) => run(db),
  }
  return { db }
})
import {
  createChatInviteAdmin,
  expireChatInviteAdmin,
  grantChatAccessAdmin,
  listChatInvitesAdmin,
  listChatWaitlistAdmin,
} from '~/chat/access-admin.server'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.rows.length = 0
  mocks.filters.length = 0
  mocks.requireCapability.mockResolvedValue({ userId: 'admin' })
})

it.each([
  {
    name: 'waitlist',
    run: () => listChatWaitlistAdmin({ page: 0, status: 'waiting' }),
  },
  {
    name: 'invites',
    run: () => listChatInvitesAdmin({ page: 0, status: 'pending' }),
  },
  { name: 'grant', run: () => grantChatAccessAdmin('person') },
  { name: 'create', run: () => createChatInviteAdmin() },
  { name: 'expire', run: () => expireChatInviteAdmin('hash') },
])('requires admin before $name reads or writes', async ({ run }) => {
  mocks.requireCapability.mockRejectedValue(new Error('Missing admin'))
  await expect(run()).rejects.toThrow('Missing admin')
  expect(mocks.requireCapability).toHaveBeenCalledWith(
    expect.any(Request),
    'admin',
  )
  expect(mocks.select).not.toHaveBeenCalled()
  expect(mocks.insert).not.toHaveBeenCalled()
  expect(mocks.update).not.toHaveBeenCalled()
  expect(mocks.createInvite).not.toHaveBeenCalled()
})

it('bounds waitlist reads and sorts oldest requests first', async () => {
  mocks.rows.push([], [{ total: 80 }])
  expect(await listChatWaitlistAdmin({ page: 2, status: 'waiting' })).toEqual({
    entries: [],
    total: 80,
    pageSize: 25,
  })
  expect(mocks.limit).toHaveBeenCalledWith(25)
  expect(mocks.offset).toHaveBeenCalledWith(50)
  const filter = mocks.filters[0]
  if (!filter) throw new Error('Missing waiting filter')
  expect(new PgDialect().sqlToQuery(filter).sql).toContain('is null')
})

it('only lists unredeemed, unexpired invites as pending', async () => {
  mocks.rows.push([], [{ total: 3 }])
  await listChatInvitesAdmin({ page: 0, status: 'pending' })
  const filter = mocks.filters[0]
  if (!filter) throw new Error('Missing pending filter')
  const sql = new PgDialect().sqlToQuery(filter).sql
  expect(sql).toContain('"redeemed_at" is null')
  expect(sql).toContain('"expires_at" >')
  expect(mocks.limit).toHaveBeenCalledWith(25)
})

it('locks the user before granting access and preserves an existing grant', async () => {
  mocks.rows.push([{ userId: 'person' }])
  await grantChatAccessAdmin('person')
  expect(mocks.lock).toHaveBeenCalledOnce()
  expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.insert.mock.invocationCallOrder[0],
  )
  expect(mocks.insert).toHaveBeenCalledWith({
    userId: 'person',
    invitedBy: 'admin',
  })
})

it('does not grant access to a user outside the waitlist', async () => {
  mocks.rows.push([])
  await expect(grantChatAccessAdmin('person')).rejects.toThrow(
    'not on the TanChat waitlist',
  )
  expect(mocks.insert).not.toHaveBeenCalled()
})

it('creates admin invites through the existing hashed-token flow', async () => {
  mocks.createInvite.mockResolvedValue({ token: 'new-invite' })
  expect(await createChatInviteAdmin()).toEqual({ token: 'new-invite' })
  expect(mocks.createInvite).toHaveBeenCalledWith({ userId: 'admin' })
})

it('expires only unused, active invites without deleting quota history', async () => {
  mocks.rows.push([{ tokenHash: 'hash' }])
  await expireChatInviteAdmin('hash')
  expect(mocks.update).toHaveBeenCalledWith({ expiresAt: expect.any(Date) })
  const filter = mocks.filters[0]
  if (!filter) throw new Error('Missing expiry filter')
  const sql = new PgDialect().sqlToQuery(filter).sql
  expect(sql).toContain('"redeemed_at" is null')
  expect(sql).toContain('"expires_at" >')
})

it('reports when redemption won the race against expiry', async () => {
  mocks.rows.push([])
  await expect(expireChatInviteAdmin('hash')).rejects.toThrow(
    'already been used or expired',
  )
})
