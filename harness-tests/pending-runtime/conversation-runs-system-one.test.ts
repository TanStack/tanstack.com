import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'
import * as connections from '../../src/chat/server/mcp-connections'
import * as catalog from '../../src/chat/server/mcp-catalog'
import * as loop from '../../src/chat/server/system-one-loop'
import * as mcp from '../../src/chat/server/mcp'
import * as evidence from '../../src/chat/server/answer-evidence'
const identity = {
  workspaceId: 'w',
  userId: '00000000-0000-4000-8000-000000000001',
  botId: 'b',
  conversationId: 'main-conversation',
}
const entry: catalog.CatalogEntry = {
  id: 'synthetic:tool',
  serverId: 'synthetic-server',
  serverLabel: 'Synthetic',
  kind: 'tool',
  name: 'lookup',
  title: 'Lookup',
  description: 'Synthetic bounded lookup',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: false },
  target: { method: 'tools/call', name: 'lookup' },
}
const snapshot = {
  serverId: 'synthetic-server',
  serverLabel: 'Synthetic',
  entries: [entry],
  fetchedAt: 1,
  warnings: [],
  key: 'synthetic-catalog',
  cache: 'miss',
}
beforeEach(() => {
  vi.spyOn(connections, 'connectedMcpServers').mockResolvedValue([
    {
      id: 'synthetic-server',
      label: 'Synthetic',
      url: 'https://synthetic.invalid/mcp',
    },
  ])
  vi.spyOn(catalog, 'cachedMcpCatalog').mockResolvedValue(snapshot as any)
  vi.spyOn(catalog, 'fetchMcpCatalog').mockResolvedValue(snapshot as any)
  vi.spyOn(evidence, 'selectAnswerEvidence').mockResolvedValue({} as any)
})
afterEach(() => vi.restoreAllMocks())
function result(status: loop.TaskStatus, request: string) {
  return {
    status,
    reason: 'Synthetic terminal reason',
    state: { request, observations: [], unresolved: [] },
    events: [],
    calls: 1,
  }
}
async function begin(status: loop.TaskStatus) {
  vi.spyOn(loop, 'runSystemOneTask').mockImplementation(async (options) => {
    if (status === 'denied')
      await options.dependencies.authorize(entry, {}, options.signal!)
    return result(status, options.request)
  })
  const h = await conversationHarness()
  await h.c.begin({
    ...h.input('system-task'),
    fixture: false,
    systemOne: true,
  })
  await h.settle()
  expect(loop.runSystemOneTask).toHaveBeenCalledOnce()
  return h
}
it.each([
  'needs-input',
  'unsupported',
  'budget-exhausted',
  'no-progress',
  'unknown-outcome',
] as const)(
  'records ordinary System One %s without claiming completion',
  async (status) => {
    const h = await begin(status)
    expect((await h.c.runHistory(identity)).items[0]).toMatchObject({
      id: 'system-task',
      mode: 'system-one',
      status: status === 'unknown-outcome' ? 'failed' : 'incomplete',
    })
  },
)
it('records confirmed System One done as completed', async () => {
  const h = await begin('done')
  expect((await h.c.runHistory(identity)).items[0]).toMatchObject({
    status: 'completed',
  })
})
it('keeps a denied operation with an actual host approval in waiting_approval', async () => {
  const h = await begin('denied')
  const state = await h.c.snapshot()
  expect(state.approvals).toHaveLength(1)
  expect(state.approvals[0]).toMatchObject({
    status: 'pending',
    mcpTaskCall: { entry: { id: entry.id } },
  })
  expect((await h.c.runHistory(identity)).items[0].status).toBe(
    'waiting_approval',
  )
})
it('records an approved System One transport failure as failed with unknown effect', async () => {
  const h = await begin('denied')
  vi.spyOn(mcp, 'mcpCall').mockRejectedValue(
    new Error('Synthetic transport failure'),
  )
  const approval = (await h.c.snapshot()).approvals[0]
  await h.c.decideApproval(approval.id, true, {
    ...h.input('system-task'),
    fixture: false,
    systemOne: true,
  })
  await h.settle()
  expect(mcp.mcpCall).toHaveBeenCalledOnce()
  expect((await h.c.runHistory(identity)).items[0].status).toBe('failed')
  expect((await h.c.snapshot()).approvals[0]).toMatchObject({
    status: 'error',
    executionOutcome: 'unknown',
  })
})
it('records stopping an approved in-flight System One operation as interrupted, without claiming its effect', async () => {
  const h = await begin('denied')
  let dispatched!: () => void
  const entered = new Promise<void>((resolve) => {
    dispatched = resolve
  })
  vi.spyOn(mcp, 'mcpCall').mockImplementation(
    async (_connection, _name, _args, signal) => {
      dispatched()
      await new Promise((_, reject) => {
        if (signal?.aborted) reject(new Error('Aborted'))
        else
          signal?.addEventListener(
            'abort',
            () => reject(new Error('Aborted')),
            { once: true },
          )
      })
      return { content: [] }
    },
  )
  const approval = (await h.c.snapshot()).approvals[0]
  await h.c.decideApproval(approval.id, true, {
    ...h.input('system-task'),
    fixture: false,
    systemOne: true,
  })
  await entered
  await h.c.stop()
  await h.settle()
  expect((await h.c.runHistory(identity)).items[0].status).toBe('interrupted')
  expect((await h.c.snapshot()).approvals[0]).toMatchObject({
    executionOutcome: 'unknown',
  })
})
