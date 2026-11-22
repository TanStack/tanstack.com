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
  identity: vi.fn(),
  runtime: vi.fn(),
  api: vi.fn(),
  importFile: vi.fn(),
  fileScope: vi.fn(),
}))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: m.user }),
}))
vi.mock('~/server/runtime/host.server', () => ({
  getHostRuntimeEnv: m.runtime,
}))
vi.mock('../../src/chat/workspace-policy.server', () => ({
  readWorkspacePolicy: m.policy,
  WorkspacePolicyError: class extends Error {
    status = 403
  },
}))
vi.mock('../../src/chat/conversation-identity.server', () => ({
  resolveConversationIdentity: m.identity,
  ConversationIdentityError: class extends Error {
    status = 404
  },
}))
vi.mock('../../src/chat/server/file-api', () => ({ fileApi: m.api }))
vi.mock('../../src/chat/server/saved-files', () => ({
  SavedFileError: class extends Error {
    status = 404
  },
  SavedFiles: class {
    constructor(env: unknown, scope: unknown) {
      m.fileScope(env, scope)
    }
    importFrom(...args: unknown[]) {
      return m.importFile(...args)
    }
  },
}))
import {
  handleFiles,
  handleFileImport,
} from '../../src/chat/server/file-http.server'
const url =
  'https://tanstack.com/api/chat/bots/bot/files/file/content?workspaceId=workspace'
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.identity.mockResolvedValue({
    workspaceId: 'workspace',
    userId: 'owner',
    botId: 'bot',
    conversationId: 'main',
  })
  m.runtime.mockResolvedValue({
    FILES: { get: vi.fn(), put: vi.fn(), head: vi.fn() },
  })
})
it('passes through the original file response after scoped identity resolution', async () => {
  const response = new Response('file', {
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': 'attachment',
    },
  })
  m.api.mockResolvedValue(response)
  const request = new Request(url)
  expect(await handleFiles(request, 'bots', 'bot', 'file', true)).toBe(response)
  expect(m.identity).toHaveBeenCalledWith({
    workspaceId: 'workspace',
    userId: 'owner',
    botId: 'bot',
  })
  expect(m.api.mock.calls[0][2]).toEqual({
    workspaceId: 'workspace',
    userId: 'owner',
    botId: 'bot',
    conversationId: 'main',
  })
  expect(m.api.mock.calls[0].slice(3)).toEqual(['file', true])
})
it('does not access R2 when conversation ownership fails', async () => {
  const { ConversationIdentityError } =
    await import('../../src/chat/conversation-identity.server')
  m.identity.mockRejectedValue(new ConversationIdentityError())
  expect(
    (await handleFiles(new Request(url), 'conversations', 'other', 'file'))
      .status,
  ).toBe(404)
  expect(m.runtime).not.toHaveBeenCalled()
  expect(m.api).not.toHaveBeenCalled()
})
it('keeps draft file scope owned by the session account', async () => {
  m.api.mockResolvedValue(Response.json({ files: [] }))
  await handleFiles(
    new Request(url + '&userId=attacker'),
    'bot-drafts',
    'draft',
  )
  expect(m.api.mock.calls[0][2]).toEqual({
    workspaceId: 'workspace',
    userId: 'owner',
    draftId: 'draft',
  })
  expect(m.identity).not.toHaveBeenCalled()
})
it('denies cross-origin uploads before account or storage access', async () => {
  expect(
    (
      await handleFiles(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://other.example' },
        }),
        'bots',
        'bot',
      )
    ).status,
  ).toBe(403)
  expect(m.user).not.toHaveBeenCalled()
  expect(m.api).not.toHaveBeenCalled()
})

it('imports through the original saved file service with server-owned target identity', async () => {
  const sourceFileId = '1528b06f-2912-48f6-bda5-bc3bb7c4113b',
    targetFileId = '149fd608-2ec1-4da1-9d93-f85816d74ccc',
    expectedSha256 = 'a'.repeat(64)
  m.importFile.mockResolvedValue({ id: targetFileId })
  const request = new Request(
    'https://tanstack.com/api/chat/conversations/main/files/import?workspaceId=workspace',
    {
      method: 'POST',
      headers: {
        Origin: 'https://tanstack.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceConversationId: 'source',
        sourceFileId,
        targetFileId,
        expectedSha256,
      }),
    },
  )
  expect(await (await handleFileImport(request, 'main')).json()).toEqual({
    id: targetFileId,
  })
  expect(m.identity).toHaveBeenCalledWith({
    workspaceId: 'workspace',
    userId: 'owner',
    conversationId: 'main',
  })
  expect(m.fileScope).toHaveBeenCalledWith(expect.any(Object), {
    workspaceId: 'workspace',
    userId: 'owner',
    botId: 'bot',
    conversationId: 'main',
  })
  expect(m.importFile).toHaveBeenCalledWith(
    'source',
    sourceFileId,
    targetFileId,
    expectedSha256,
    { signal: request.signal },
  )
})
