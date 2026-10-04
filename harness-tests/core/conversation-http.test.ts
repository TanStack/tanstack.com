// These HTTP fixtures represent admitted accounts. Access grants are tested in chat-access.test.ts.
vi.mock('~/chat/access.server', () => ({
  hasChatAccess: async (user: { capabilities: string[] }) =>
    user.capabilities.includes('builder') ||
    user.capabilities.includes('admin'),
}))
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  worker: vi.fn(),
  owner: vi.fn(),
  cancelDelegation: vi.fn(),
  changeSchedule: vi.fn(),
  schedules: vi.fn(),
  delegations: vi.fn(),
  delegationHistory: vi.fn(),
  policy: vi.fn(),
  retrySource: vi.fn(),
  boundary: vi.fn(),
  runs: vi.fn(),
  usage: vi.fn(),
  historicalUsage: vi.fn(),
  evidence: vi.fn(),
  navigation: vi.fn(),
  archive: vi.fn(),
  archivedMessage: vi.fn(),
  mark: vi.fn(),
  readVersion: vi.fn(),
  receipt: vi.fn(),
  lifecycle: vi.fn(),
  context: vi.fn(),
  begin: vi.fn(),
  currentUser: vi.fn(),
  resolveIdentity: vi.fn(),
  runtime: vi.fn(),
  bind: vi.fn(),
  history: vi.fn(),
  stream: vi.fn(),
  getByName: vi.fn(),
}))
vi.mock('../../src/chat/workspace-policy.server', () => ({
  readWorkspacePolicy: mocks.policy,
  WorkspacePolicyError: class extends Error {
    status = 403
  },
}))
vi.mock('../../src/chat/server/bot-activity', () => ({
  markConversationRead: mocks.mark,
  readConversationReadVersion: mocks.readVersion,
}))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: mocks.currentUser }),
}))
vi.mock('~/server/runtime/host.server', () => ({
  getHostRuntimeEnv: mocks.runtime,
}))
vi.mock('../../src/chat/conversation-identity.server', () => ({
  resolveConversationIdentity: mocks.resolveIdentity,
  ConversationIdentityError: class extends Error {
    status = 404
  },
}))
vi.mock('../../src/chat/server/conversation-database', () => ({
  readConversationWorkflowWorker: mocks.worker,
  readConversationWorkflowOwner: mocks.owner,
  readConversationLifecycle: mocks.lifecycle,
  readConversationRunContext: mocks.context,
}))
import {
  handleConversationRead,
  handleConversationSend,
} from '../../src/chat/server/conversation-http.server'
const request = () =>
  new Request(
    'https://tanstack.com/api/chat/conversations/c/history?workspaceId=personal:user',
  )
beforeEach(() => {
  vi.resetAllMocks()
  mocks.owner.mockResolvedValue(null)
  mocks.worker.mockResolvedValue(null)
  mocks.currentUser.mockResolvedValue({
    userId: 'user',
    capabilities: ['builder'],
  })
  mocks.resolveIdentity.mockResolvedValue({
    userId: 'user',
    workspaceId: 'personal:user',
    botId: 'bot',
    conversationId: 'authorized',
  })
  mocks.getByName.mockReturnValue({
    changeSchedule: mocks.changeSchedule,
    cancelDelegatedTask: mocks.cancelDelegation,
    scheduleSnapshot: mocks.schedules,
    taskDelegations: mocks.delegations,
    delegationHistory: mocks.delegationHistory,
    captureRetrySourceJson: mocks.retrySource,
    copyBoundary: mocks.boundary,
    runHistory: mocks.runs,
    taskUsage: mocks.usage,
    historicalTaskUsage: mocks.historicalUsage,
    actionEvidenceJson: mocks.evidence,
    transcriptNavigation: mocks.navigation,
    archivedHistory: mocks.archive,
    archivedMessage: mocks.archivedMessage,
    sendReceipt: mocks.receipt,
    begin: mocks.begin,
    bindIdentity: mocks.bind,
    streamSnapshot: mocks.history,
    readStream: mocks.stream,
  })
  mocks.runtime.mockResolvedValue({
    CONVERSATIONS: { getByName: mocks.getByName },
  })
  mocks.history.mockResolvedValue({ messages: [] })
})
it('rejects signed-out requests before identity or storage lookup', async () => {
  mocks.currentUser.mockResolvedValue(null)
  expect((await handleConversationRead(request(), 'c', 'history')).status).toBe(
    401,
  )
  expect(mocks.resolveIdentity).not.toHaveBeenCalled()
  expect(mocks.runtime).not.toHaveBeenCalled()
})
it('does not access storage if ownership authorization fails', async () => {
  mocks.resolveIdentity.mockRejectedValue(new Error('authorization failed'))
  await expect(
    handleConversationRead(request(), 'c', 'history'),
  ).rejects.toThrow('authorization failed')
  expect(mocks.runtime).not.toHaveBeenCalled()
  expect(mocks.getByName).not.toHaveBeenCalled()
})
it('uses the resolved identity and binds it before reading', async () => {
  const result = await handleConversationRead(request(), 'c', 'history')
  expect(result.status).toBe(200)
  expect(mocks.resolveIdentity).toHaveBeenCalledWith({
    userId: 'user',
    workspaceId: 'personal:user',
    conversationId: 'c',
  })
  expect(mocks.getByName).toHaveBeenCalledWith('authorized')
  expect(mocks.bind.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.history.mock.invocationCallOrder[0],
  )
})
it('rejects missing capability before workspace authorization', async () => {
  mocks.currentUser.mockResolvedValue({ userId: 'user', capabilities: [] })
  expect((await handleConversationRead(request(), 'c', 'history')).status).toBe(
    403,
  )
  expect(mocks.resolveIdentity).not.toHaveBeenCalled()
})
it('rejects ambiguous workspace selectors without accessing storage', async () => {
  const duplicate = new Request(request().url + '&workspaceId=other')
  expect((await handleConversationRead(duplicate, 'c', 'history')).status).toBe(
    400,
  )
  expect(mocks.resolveIdentity).not.toHaveBeenCalled()
})

it.each(['signed-out', 'locked'] as const)(
  'rejects %s sends before looking up the conversation object',
  async (access) => {
    mocks.currentUser.mockResolvedValue(
      access === 'signed-out' ? null : { userId: 'user', capabilities: [] },
    )
    const req = new Request(request().url, {
      method: 'POST',
      headers: { Origin: 'https://tanstack.com' },
      body: JSON.stringify({ text: 'hello', messageId: 'message' }),
    })
    expect((await handleConversationSend(req, 'c', 'send')).status).toBe(
      access === 'signed-out' ? 401 : 403,
    )
    expect(mocks.resolveIdentity).not.toHaveBeenCalled()
    expect(mocks.getByName).not.toHaveBeenCalled()
    expect(mocks.begin).not.toHaveBeenCalled()
  },
)
it('rejects sends whose ownership check fails before accessing the object', async () => {
  mocks.resolveIdentity.mockRejectedValue(new Error('authorization failed'))
  const req = new Request(request().url, {
    method: 'POST',
    headers: { Origin: 'https://tanstack.com' },
    body: JSON.stringify({ text: 'hello', messageId: 'message' }),
  })
  await expect(handleConversationSend(req, 'c', 'send')).rejects.toThrow(
    'authorization failed',
  )
  expect(mocks.getByName).not.toHaveBeenCalled()
  expect(mocks.begin).not.toHaveBeenCalled()
})
it('denies cross-origin submission before looking up the account', async () => {
  const req = new Request(request().url, {
    method: 'POST',
    headers: { Origin: 'https://other.example' },
  })
  expect((await handleConversationSend(req, 'c', 'send')).status).toBe(403)
  expect(mocks.currentUser).not.toHaveBeenCalled()
})
it('denies archived submission before accessing the object', async () => {
  mocks.lifecycle.mockResolvedValue({
    bot: { archived_at: 1, deleted_at: null },
    thread: null,
  })
  const req = new Request(request().url, {
    method: 'POST',
    headers: { Origin: 'https://tanstack.com' },
  })
  expect((await handleConversationSend(req, 'c', 'send')).status).toBe(409)
  expect(mocks.getByName).not.toHaveBeenCalled()
})
it('uses server identity and context rather than request-supplied values', async () => {
  mocks.lifecycle.mockResolvedValue({
    bot: { archived_at: null, deleted_at: null },
    thread: null,
  })
  mocks.context.mockResolvedValue({
    userId: 'user',
    bot: { id: 'bot' },
    policy: {},
    recipes: [],
  })
  mocks.begin.mockResolvedValue({ ok: true })
  const req = new Request(request().url, {
    method: 'POST',
    headers: { Origin: 'https://tanstack.com' },
    body: JSON.stringify({
      text: 'hello',
      messageId: 'message',
      userId: 'attacker',
      fixture: true,
      policy: { evil: true },
    }),
  })
  expect((await handleConversationSend(req, 'c', 'send')).status).toBe(200)
  expect(mocks.bind).not.toHaveBeenCalled()
  expect(mocks.begin.mock.calls[0][0]).toMatchObject({
    userId: 'user',
    fixture: false,
    policy: {},
    conversationId: 'authorized',
    text: 'hello',
  })
})

it('resolves a bot route to the authorized main conversation before reading', async () => {
  expect(
    (await handleConversationRead(request(), 'bot', 'history', 'bot')).status,
  ).toBe(200)
  expect(mocks.resolveIdentity).toHaveBeenCalledWith({
    userId: 'user',
    workspaceId: 'personal:user',
    botId: 'bot',
  })
  expect(mocks.getByName).toHaveBeenCalledWith('authorized')
})
it('resolves bot submissions through server-owned main conversation identity', async () => {
  mocks.lifecycle.mockResolvedValue({
    bot: { archived_at: null, deleted_at: null },
    thread: null,
  })
  mocks.context.mockResolvedValue({
    userId: 'user',
    bot: { id: 'bot' },
    policy: {},
    recipes: [],
  })
  mocks.begin.mockResolvedValue({ ok: true })
  const req = new Request(request().url, {
    method: 'POST',
    headers: { Origin: 'https://tanstack.com' },
    body: JSON.stringify({ text: 'hello', messageId: 'message' }),
  })
  expect((await handleConversationSend(req, 'bot', 'send', 'bot')).status).toBe(
    200,
  )
  expect(mocks.resolveIdentity).toHaveBeenCalledWith({
    userId: 'user',
    workspaceId: 'personal:user',
    botId: 'bot',
  })
  expect(mocks.begin.mock.calls[0][0]).toMatchObject({
    conversationId: 'authorized',
    userId: 'user',
  })
})

it('reads committed send receipts from the authorized conversation', async () => {
  mocks.receipt.mockResolvedValue({ status: 'accepted' })
  const result = await handleConversationRead(
    new Request(request().url + '&message=message'),
    'bot',
    'send-receipt',
    'bot',
  )
  expect(result.status).toBe(200)
  expect(await result.json()).toEqual({ status: 'accepted' })
  expect(mocks.receipt).toHaveBeenCalledWith('message')
  expect(mocks.bind.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.receipt.mock.invocationCallOrder[0],
  )
})
it('rejects missing receipt identifiers without calling receipt storage', async () => {
  expect(
    (await handleConversationRead(request(), 'c', 'send-receipt')).status,
  ).toBe(400)
  expect(mocks.receipt).not.toHaveBeenCalled()
})

it('acknowledges read state for the authorized main conversation without opening its object', async () => {
  mocks.readVersion.mockResolvedValue(8)
  const result = await handleConversationSend(
    new Request(request().url, {
      method: 'POST',
      headers: { Origin: 'https://tanstack.com' },
      body: JSON.stringify({ version: 8 }),
    }),
    'bot',
    'read',
    'bot',
  )
  expect(await result.json()).toEqual({ ok: true, readVersion: 8 })
  expect(mocks.mark).toHaveBeenCalledWith(
    'personal:user',
    'user',
    'authorized',
    8,
  )
  expect(mocks.getByName).not.toHaveBeenCalled()
})

it('passes bounded navigation cursors and epochs to original transcript navigation', async () => {
  mocks.navigation.mockResolvedValue({ ok: true, page: { turns: [] } })
  const result = await handleConversationRead(
    new Request(request().url + '&before=5&epoch=version'),
    'c',
    'navigation',
  )
  expect(await result.json()).toEqual({ turns: [] })
  expect(mocks.navigation).toHaveBeenCalledWith({ before: 5, epoch: 'version' })
})
it('rejects duplicate navigation cursors without reading transcript pages', async () => {
  expect(
    (
      await handleConversationRead(
        new Request(request().url + '&before=5&before=6'),
        'c',
        'navigation',
      )
    ).status,
  ).toBe(400)
  expect(mocks.navigation).not.toHaveBeenCalled()
})
it('returns original archived message output through the authorized object', async () => {
  mocks.archivedMessage.mockResolvedValue({ message: { id: 'older' } })
  expect(
    await (
      await handleConversationRead(
        new Request(request().url + '&message=older'),
        'c',
        'archive',
      )
    ).json(),
  ).toEqual({ message: { id: 'older' } })
  expect(mocks.archivedMessage).toHaveBeenCalledWith('older')
})

const operationRequest = (operation: string, query = '') =>
  new Request(
    `https://tanstack.com/api/chat/conversations/c/${operation}?workspaceId=personal:user${query}`,
  )
it('forwards bounded run history to the authorized conversation', async () => {
  mocks.runs.mockResolvedValue({ runs: [], cursor: null })
  expect(
    await (
      await handleConversationRead(
        operationRequest('runs', '&limit=20&cursor=next'),
        'c',
        'runs',
      )
    ).json(),
  ).toEqual({ runs: [], cursor: null })
  expect(mocks.runs).toHaveBeenCalledWith(
    {
      userId: 'user',
      workspaceId: 'personal:user',
      botId: 'bot',
      conversationId: 'authorized',
    },
    { limit: 20, cursor: 'next' },
  )
})
it('rejects duplicate or excessive run pagination before its RPC', async () => {
  for (const query of ['&limit=51', '&limit=1&limit=2', '&cursor='])
    expect(
      (
        await handleConversationRead(
          operationRequest('runs', query),
          'c',
          'runs',
        )
      ).status,
    ).toBe(400)
  expect(mocks.runs).not.toHaveBeenCalled()
})
it('preserves safe invalid run cursor errors returned by the RPC', async () => {
  mocks.runs.mockRejectedValue(new Error('Invalid run history cursor.'))
  expect(
    (
      await handleConversationRead(
        operationRequest('runs', '&cursor=invalid'),
        'c',
        'runs',
      )
    ).status,
  ).toBe(400)
})
it('selects retained usage only for the original history view', async () => {
  mocks.historicalUsage.mockResolvedValue({ taskId: 'task', total: 1 })
  expect(
    (
      await handleConversationRead(
        operationRequest('task-usage', '&task=task&view=history'),
        'c',
        'task-usage',
      )
    ).status,
  ).toBe(200)
  expect(mocks.historicalUsage).toHaveBeenCalledWith(
    expect.objectContaining({ conversationId: 'authorized' }),
    'task',
  )
  expect(mocks.usage).not.toHaveBeenCalled()
})
it('retains missing usage status and rejects ambiguous task selectors', async () => {
  mocks.usage.mockResolvedValue(null)
  expect(
    (
      await handleConversationRead(
        operationRequest('task-usage', '&task=task'),
        'c',
        'task-usage',
      )
    ).status,
  ).toBe(404)
  mocks.usage.mockClear()
  expect(
    (
      await handleConversationRead(
        operationRequest('task-usage', '&task=one&task=two'),
        'c',
        'task-usage',
      )
    ).status,
  ).toBe(400)
  expect(mocks.usage).not.toHaveBeenCalled()
})
it('reads action evidence using the authorized immutable identity', async () => {
  mocks.evidence.mockResolvedValue(JSON.stringify({ records: [] }))
  expect(
    await (
      await handleConversationRead(
        operationRequest('action-evidence'),
        'c',
        'action-evidence',
      )
    ).json(),
  ).toEqual({ records: [] })
  expect(mocks.evidence).toHaveBeenCalledWith(
    expect.objectContaining({ userId: 'user', conversationId: 'authorized' }),
  )
})

it('captures the original before-message copy boundary', async () => {
  mocks.lifecycle.mockResolvedValue({ bot: { deleted_at: null }, thread: null })
  mocks.boundary.mockResolvedValue({ ok: true, sequence: 4 })
  expect(
    await (
      await handleConversationRead(
        operationRequest('copy-boundary', '&message=message&side=before'),
        'c',
        'copy-boundary',
      )
    ).json(),
  ).toEqual({ ok: true, sequence: 4 })
  expect(mocks.boundary).toHaveBeenCalledWith('message', 'before')
})
it('denies copying deleted conversations before boundary capture', async () => {
  mocks.lifecycle.mockResolvedValue({ bot: { deleted_at: 1 }, thread: null })
  expect(
    (
      await handleConversationRead(
        operationRequest('copy-boundary'),
        'c',
        'copy-boundary',
      )
    ).status,
  ).toBe(409)
  expect(mocks.boundary).not.toHaveBeenCalled()
})

it('loads server policy for retry capture and retains original failure status', async () => {
  mocks.lifecycle.mockResolvedValue({ bot: { deleted_at: null }, thread: null })
  mocks.policy.mockResolvedValue({ models: ['included'] })
  mocks.retrySource.mockResolvedValue(
    JSON.stringify({
      ok: false,
      status: 409,
      code: 'not_ready',
      error: 'Still working.',
    }),
  )
  const response = await handleConversationRead(
    operationRequest('retry-source', '&message=message'),
    'c',
    'retry-source',
  )
  expect(response.status).toBe(409)
  expect(mocks.policy).toHaveBeenCalledWith('personal:user', 'user')
  expect(mocks.retrySource).toHaveBeenCalledWith(
    expect.objectContaining({ conversationId: 'authorized' }),
    'message',
    { policy: { models: ['included'] }, fixture: false },
  )
})
it('rejects retry query spoofing before capturing evidence', async () => {
  mocks.lifecycle.mockResolvedValue({ bot: { deleted_at: null }, thread: null })
  expect(
    (
      await handleConversationRead(
        operationRequest('retry-source', '&message=message&fixture=true'),
        'c',
        'retry-source',
      )
    ).status,
  ).toBe(400)
  expect(mocks.retrySource).not.toHaveBeenCalled()
  expect(mocks.policy).not.toHaveBeenCalled()
})
it('denies retry review for deleted conversations', async () => {
  mocks.lifecycle.mockResolvedValue({ bot: { deleted_at: 1 }, thread: null })
  expect(
    (
      await handleConversationRead(
        operationRequest('retry-source', '&message=message'),
        'c',
        'retry-source',
      )
    ).status,
  ).toBe(409)
  expect(mocks.retrySource).not.toHaveBeenCalled()
})

it('reads current delegations through the original parent task selector', async () => {
  mocks.delegations.mockResolvedValue({ children: [] })
  expect(
    await (
      await handleConversationRead(
        operationRequest('delegations', '&task=task'),
        'c',
        'delegations',
      )
    ).json(),
  ).toEqual({ children: [] })
  expect(mocks.delegations).toHaveBeenCalledWith(
    expect.objectContaining({ conversationId: 'authorized' }),
    'task',
  )
})
it('retains bounded delegation history and rejects mixed selectors', async () => {
  mocks.delegationHistory.mockResolvedValue({ ok: true, page: { items: [] } })
  expect(
    (
      await handleConversationRead(
        operationRequest('delegations', '&view=history&limit=10'),
        'c',
        'delegations',
      )
    ).status,
  ).toBe(200)
  expect(mocks.delegationHistory).toHaveBeenCalledWith(
    expect.objectContaining({ userId: 'user' }),
    { limit: 10 },
  )
  mocks.delegationHistory.mockClear()
  expect(
    (
      await handleConversationRead(
        operationRequest('delegations', '&view=history&task=task'),
        'c',
        'delegations',
      )
    ).status,
  ).toBe(400)
  expect(mocks.delegationHistory).not.toHaveBeenCalled()
})
it('reads schedules with the same authorized identity', async () => {
  mocks.schedules.mockResolvedValue({ schedules: [] })
  expect(
    await (
      await handleConversationRead(
        operationRequest('schedules'),
        'c',
        'schedules',
      )
    ).json(),
  ).toEqual({ schedules: [] })
  expect(mocks.schedules).toHaveBeenCalledWith(
    expect.objectContaining({ conversationId: 'authorized' }),
  )
})

it('rejects direct controls on workflow children before touching the coordinator', async () => {
  mocks.owner.mockResolvedValue('parent')
  const response = await handleConversationSend(
    new Request(operationRequest('delegations').url, {
      method: 'POST',
      headers: { Origin: 'https://tanstack.com' },
      body: '{}',
    }),
    'c',
    'delegations',
  )
  expect(response.status).toBe(409)
  expect(mocks.getByName).not.toHaveBeenCalled()
  expect(mocks.cancelDelegation).not.toHaveBeenCalled()
})
it('forwards the original delegated-task stop command then reads updated children', async () => {
  mocks.lifecycle.mockResolvedValue({
    bot: { archived_at: null, deleted_at: null },
    thread: null,
  })
  mocks.delegations.mockResolvedValue({ children: [] })
  const command = {
    type: 'stop',
    taskId: 'task',
    id: '11111111-1111-4111-8111-111111111111',
  }
  const response = await handleConversationSend(
    new Request(operationRequest('delegations').url, {
      method: 'POST',
      headers: { Origin: 'https://tanstack.com' },
      body: JSON.stringify(command),
    }),
    'c',
    'delegations',
  )
  expect(response.status).toBe(200)
  expect(mocks.cancelDelegation).toHaveBeenCalledWith(
    expect.objectContaining({ conversationId: 'authorized' }),
    command.id,
    'task',
  )
  expect(mocks.delegations).toHaveBeenCalledWith(
    expect.objectContaining({ userId: 'user' }),
    'task',
  )
})

it('retains original workflow child metadata in history snapshots', async () => {
  const worker = {
    ownerConversationId: 'parent',
    runId: 'run',
    stepId: 'review',
  }
  mocks.worker.mockResolvedValue(worker)
  expect(
    await (await handleConversationRead(request(), 'c', 'history')).json(),
  ).toEqual({ messages: [], workflowWorker: worker })
  expect(mocks.worker).toHaveBeenCalledWith('authorized')
})
