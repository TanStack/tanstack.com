// These HTTP fixtures represent admitted accounts. Access grants are tested in chat-access.test.ts.
vi.mock('~/chat/access.server', () => ({
  hasChatAccess: async (user: { capabilities: string[] }) =>
    user.capabilities.includes('builder') ||
    user.capabilities.includes('admin'),
}))
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ user: vi.fn(), draft: vi.fn() }))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: mocks.user }),
}))
vi.mock('../../src/chat/server/composer-drafts', () => ({
  composerDraftApi: mocks.draft,
}))
import { handleComposerDraft } from '../../src/chat/server/composer-draft-http.server'
const url = 'https://tanstack.com/api/chat/account/composer-drafts/owner/scope'
beforeEach(() => {
  vi.resetAllMocks()
  mocks.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  mocks.draft.mockResolvedValue(Response.json({ value: 'draft', revision: 2 }))
})
it('denies another account before touching draft storage', async () => {
  expect(
    (await handleComposerDraft(new Request(url), 'other', 'scope')).status,
  ).toBe(403)
  expect(mocks.draft).not.toHaveBeenCalled()
})
it('denies signed-out draft reads', async () => {
  mocks.user.mockResolvedValue(null)
  expect(
    (await handleComposerDraft(new Request(url), 'owner', 'scope')).status,
  ).toBe(401)
  expect(mocks.draft).not.toHaveBeenCalled()
})
it('denies cross-origin writes before authentication', async () => {
  expect(
    (
      await handleComposerDraft(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://elsewhere.example' },
          body: '{}',
        }),
        'owner',
        'scope',
      )
    ).status,
  ).toBe(403)
  expect(mocks.user).not.toHaveBeenCalled()
})
it('passes revision and scope to the original native draft service', async () => {
  const body = { value: 'new draft', revision: 2 }
  const request = new Request(url, {
    method: 'POST',
    headers: { Origin: 'https://tanstack.com' },
    body: JSON.stringify(body),
  })
  expect(
    (await handleComposerDraft(request, 'owner', 'thread:example')).status,
  ).toBe(200)
  expect(mocks.draft).toHaveBeenCalledWith(
    request,
    'owner',
    'thread:example',
    body,
  )
})
it('rejects malformed writes without changing storage', async () => {
  expect(
    (
      await handleComposerDraft(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://tanstack.com' },
          body: 'bad json',
        }),
        'owner',
        'scope',
      )
    ).status,
  ).toBe(400)
  expect(mocks.draft).not.toHaveBeenCalled()
})
