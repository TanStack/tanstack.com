import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../../src/auth/types'
const mocks = vi.hoisted(() => ({
  rows: [] as unknown[][],
  writes: vi.fn(),
  locks: vi.fn(),
}))
vi.mock('~/libraries/maintainers', () => ({
  allMaintainers: [{ github: 'maintainer', maintainerOf: ['query'] }],
}))
vi.mock('~/auth/index.server', () => ({ getAuthGuards: vi.fn() }))
vi.mock('~/db/client', () => {
  const query = () => {
    const rows = mocks.rows.shift() ?? []
    const chain = {
      from: () => chain,
      where: () => chain,
      for: () => chain,
      then: (resolve: (value: unknown[]) => unknown) =>
        Promise.resolve(rows).then(resolve),
    }
    return chain
  }
  const db = {
    select: query,
    execute: mocks.locks,
    insert: () => ({ values: mocks.writes }),
    update: () => ({ set: () => ({ where: mocks.writes }) }),
    transaction: (run: (tx: unknown) => unknown) => run(db),
  }
  return { db }
})
import {
  createChatInvite,
  hasChatAccess,
  redeemChatInvite,
} from '../../src/chat/access.server'
const user: AuthUser = {
  userId: 'test',
  email: 'person@example.com',
  name: null,
  image: null,
  oauthImage: null,
  displayUsername: null,
  capabilities: ['builder'],
  adsDisabled: null,
  interestedInHidingAds: null,
  lastUsedFramework: null,
  signupSources: [],
}
beforeEach(() => {
  mocks.rows.length = 0
  mocks.writes.mockReset()
  mocks.locks.mockReset()
  vi.unstubAllGlobals()
})
describe('TanChat invites', () => {
  it('does not grant access from Builder or a signed-in account alone', async () => {
    mocks.rows.push([], [])
    expect(await hasChatAccess(user)).toBe(false)
  })
  it('gives admins automatic access', async () => {
    expect(await hasChatAccess({ ...user, capabilities: ['admin'] })).toBe(true)
  })
  it('recognizes maintainers using their linked GitHub numeric ID', async () => {
    mocks.rows.push([{ id: '1234' }])
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ id: 1234, login: 'maintainer' })),
        ),
    )
    expect(await hasChatAccess(user)).toBe(true)
  })
  it('rejects a fourth invite and locks quota checks inside the transaction', async () => {
    mocks.rows.push([], [{ userId: 'test' }], [{ count: 3 }])
    await expect(createChatInvite(user)).rejects.toThrow('three invites')
    expect(mocks.locks).toHaveBeenCalledOnce()
    expect(mocks.writes).not.toHaveBeenCalled()
  })
  it('stores only a hash and returns a shareable token', async () => {
    mocks.rows.push([], [{ userId: 'test' }], [{ count: 2 }])
    const { token } = await createChatInvite(user)
    const saved = mocks.writes.mock.calls[0][0]
    expect(saved.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(saved.tokenHash).not.toBe(token)
    expect(saved).not.toHaveProperty('token')
  })
  it.each(['expired', 'used', 'missing'])(
    'rejects an %s invite without unlocking access',
    async (kind) => {
      mocks.rows.push(
        [],
        [],
        kind === 'missing'
          ? []
          : [
              {
                createdBy: 'other',
                expiresAt: new Date(
                  kind === 'expired' ? 0 : Date.now() + 10000,
                ),
                redeemedAt: kind === 'used' ? new Date() : null,
              },
            ],
      )
      await expect(redeemChatInvite(user, 'a'.repeat(72))).rejects.toThrow(
        'invalid, expired, or already used',
      )
      expect(mocks.writes).not.toHaveBeenCalled()
    },
  )
  it('grants access and consumes an invite together', async () => {
    mocks.rows.push(
      [],
      [],
      [
        {
          createdBy: 'other',
          expiresAt: new Date(Date.now() + 10000),
          redeemedAt: null,
        },
      ],
    )
    await redeemChatInvite(user, 'a'.repeat(72))
    expect(mocks.writes).toHaveBeenCalledTimes(2)
    expect(mocks.writes.mock.calls[0][0]).toEqual({
      userId: 'test',
      invitedBy: 'other',
    })
  })
})
