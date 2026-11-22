// These HTTP fixtures represent admitted accounts. Access grants are tested in chat-access.test.ts.
vi.mock('~/chat/access.server', () => ({
  hasChatAccess: async (user: { capabilities: string[] }) =>
    user.capabilities.includes('builder') ||
    user.capabilities.includes('admin'),
}))
import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  user: vi.fn(),
  policy: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: m.user }),
}))
vi.mock('../../src/chat/workspace-policy.server', () => ({
  readWorkspacePolicy: m.policy,
  WorkspacePolicyError: class extends Error {
    status = 403
  },
}))
vi.mock('../../src/chat/server/saved-actions', () => ({
  SavedActions: class {
    create = m.create
    delete = m.remove
  },
}))
import { handleSavedActions } from '../../src/chat/server/saved-actions-http.server'
const url = 'https://tanstack.com/api/chat/recipes?workspaceId=workspace'
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.create.mockResolvedValue({ id: 'saved' })
  m.remove.mockResolvedValue({ ok: true })
})
it('passes bounded creation input after workspace authorization', async () => {
  const body = {
    title: 'Action',
    description: 'Description',
    code: 'export default () => 1',
  }
  expect(
    await (
      await handleSavedActions(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://tanstack.com' },
          body: JSON.stringify(body),
        }),
      )
    ).json(),
  ).toEqual({ id: 'saved' })
  expect(m.policy).toHaveBeenCalledWith('workspace', 'owner')
  expect(m.create).toHaveBeenCalledWith(body)
})
it('deletes by the requested action id within the authorized workspace', async () => {
  expect(
    (
      await handleSavedActions(
        new Request(url, {
          method: 'DELETE',
          headers: { Origin: 'https://tanstack.com' },
        }),
        'saved',
      )
    ).status,
  ).toBe(200)
  expect(m.remove).toHaveBeenCalledWith('saved')
})
it('denies cross-origin changes before account lookup', async () => {
  expect(
    (
      await handleSavedActions(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://other.example' },
          body: '{}',
        }),
      )
    ).status,
  ).toBe(403)
  expect(m.user).not.toHaveBeenCalled()
  expect(m.create).not.toHaveBeenCalled()
})
