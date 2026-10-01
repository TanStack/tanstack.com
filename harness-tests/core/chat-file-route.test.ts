// These HTTP fixtures represent admitted accounts. Access grants are tested in chat-access.test.ts.
vi.mock('~/chat/access.server', () => ({
  hasChatAccess: async (user: { capabilities: string[] }) =>
    user.capabilities.includes('builder') ||
    user.capabilities.includes('admin'),
}))
import { beforeEach, describe, expect, it, vi } from 'vitest'
const dependencies = vi.hoisted(() => ({
  user: vi.fn(),
  files: vi.fn(),
  environment: vi.fn(),
}))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: dependencies.user }),
}))
vi.mock('~/chat/server/file-api', () => ({ fileApi: dependencies.files }))
vi.mock('~/chat/server/file-environment.server', () => ({
  getFileEnvironment: dependencies.environment,
}))
import { handleFileRequest } from '../../src/routes/api/chat/files'
import { SavedFileError } from '../../src/chat/server/saved-file-contract'
const request = (
  query = 'workspaceId=personal&botId=assistant',
  init?: RequestInit,
) => new Request(`https://tanstack.com/api/chat/files?${query}`, init)
beforeEach(() => {
  vi.clearAllMocks()
  dependencies.user.mockResolvedValue({
    userId: 'trusted-account',
    capabilities: ['builder'],
  })
  dependencies.environment.mockResolvedValue({ FILES: {} })
  dependencies.files.mockImplementation(async () =>
    Response.json({ files: [] }),
  )
})
describe('authenticated chat file boundary', () => {
  it('requires a real session before touching file storage', async () => {
    dependencies.user.mockResolvedValue(null)
    expect((await handleFileRequest(request())).status).toBe(401)
    expect(dependencies.environment).not.toHaveBeenCalled()
  })
  it('enforces the existing site capability', async () => {
    dependencies.user.mockResolvedValue({
      userId: 'trusted-account',
      capabilities: [],
    })
    expect((await handleFileRequest(request())).status).toBe(403)
    expect(dependencies.files).not.toHaveBeenCalled()
  })
  it('takes file ownership only from the session', async () => {
    expect(
      (
        await handleFileRequest(
          request('workspaceId=personal&botId=assistant&userId=someone-else'),
        )
      ).status,
    ).toBe(200)
    expect(dependencies.files.mock.calls[0][2]).toEqual({
      workspaceId: 'personal',
      userId: 'trusted-account',
      botId: 'assistant',
      conversationId: undefined,
    })
  })
  it('rejects a cross-origin upload before authentication or storage', async () => {
    expect(
      (
        await handleFileRequest(
          request('workspaceId=personal&botId=assistant', {
            method: 'PUT',
            headers: { Origin: 'https://other.example' },
          }),
        )
      ).status,
    ).toBe(403)
    expect(dependencies.user).not.toHaveBeenCalled()
    expect(dependencies.files).not.toHaveBeenCalled()
  })
  it('rejects mixed draft and conversation scope', async () => {
    expect(
      (
        await handleFileRequest(
          request(
            'workspaceId=personal&botId=assistant&draftId=88888888-8888-4888-8888-888888888888',
          ),
        )
      ).status,
    ).toBe(400)
    expect(dependencies.files).not.toHaveBeenCalled()
  })
  it('requires a valid file identity for content requests', async () => {
    expect(
      (
        await handleFileRequest(
          request('workspaceId=personal&botId=assistant&content=1'),
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await handleFileRequest(
          request('workspaceId=personal&botId=assistant&id=invalid'),
        )
      ).status,
    ).toBe(400)
  })
  it('returns storage errors without pretending the file succeeded', async () => {
    dependencies.environment.mockRejectedValue(
      new SavedFileError('File storage is unavailable.', 503),
    )
    expect((await handleFileRequest(request())).status).toBe(503)
    expect(dependencies.files).not.toHaveBeenCalled()
  })
})
