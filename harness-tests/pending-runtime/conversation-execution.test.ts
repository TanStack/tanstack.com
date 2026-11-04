import { afterEach, expect, it, vi } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'
import { handleConversationExecution } from '../../src/chat/server/conversation-execution-http.server'
import {
  bindRuntimeEnv,
  getRuntimeEnv,
  getRuntimeAuth,
  prepareSharedSessionRuntime,
  createSharedSession,
} from './fixtures/shared-session-runtime'
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => getRuntimeAuth(),
}))
vi.mock(import('../../src/server/runtime/host.server'), async (original) => ({
  ...(await original()),
  getHostRuntimeEnv: async () => getRuntimeEnv(),
}))
async function api(request: Request, env: Record<string, unknown>) {
  bindRuntimeEnv(env)
  const match = new URL(request.url).pathname.match(
    /^\/api\/chat\/conversations\/([^/]+)\/execution$/,
  )
  if (!match) return new Response(null, { status: 404 })
  return handleConversationExecution(request, decodeURIComponent(match[1]))
}
import {
  encodeExecutionBytes,
  executionEventPageSchema,
} from '../../src/chat/core/execution-events'
import {
  parseExecutionSessionHistory,
  parseExecutionSnapshot,
} from '../../src/chat/core/execution-snapshot'
import {
  browserExecutionRuntime,
  executionSessionCommandSchema,
  type ExecutionSessionCommand,
  type ExecutionSessionSnapshot,
} from '../../src/chat/core/execution-sessions'

const identity = {
  workspaceId: 'w',
  userId: '00000000-0000-4000-8000-000000000001',
  botId: 'b',
  conversationId: 'main-conversation',
}
const origin = 'http://127.0.0.1:3002'
const path = '/api/chat/conversations/main-conversation/execution'
const createCommand = (): ExecutionSessionCommand => ({
  type: 'create',
  commandId: crypto.randomUUID(),
  runtime: browserExecutionRuntime,
  project: { source: 'trusted-fixture', digest: 'a'.repeat(64) },
})
function snapshot(
  result: Awaited<
    ReturnType<
      Awaited<ReturnType<typeof conversationHarness>>['c']['executionSnapshot']
    >
  >,
) {
  if (!result.ok) throw new Error(result.error)
  return result.snapshot
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function setup() {
  vi.stubGlobal('__GUM_LOCAL_DEVELOPMENT__', true)
  let now = Date.parse('2030-01-01T00:00:00Z')
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const h = await conversationHarness()
  Object.assign(h.env, { APP_MODE: 'auth-test', GUM_DEV_EXECUTION: 'enabled' })
  const getByName = vi.fn((id: string) => {
    if (id !== identity.conversationId) throw new Error('Unexpected DO routing')
    return h.c
  })
  Object.assign(h.env.CONVERSATIONS, { getByName })
  const env = h.env
  await prepareSharedSessionRuntime(h)
  const cookie = await createSharedSession(identity.userId)
  const request = (
    body?: unknown,
    options: {
      cookie?: string
      origin?: string
      url?: string
      method?: string
    } = {},
  ) => {
    const url = new URL(options.url ?? origin + path)
    if (!url.searchParams.has('workspaceId'))
      url.searchParams.set('workspaceId', 'w')
    return new Request(url, {
      method: options.method ?? (body === undefined ? 'GET' : 'POST'),
      headers: {
        cookie: options.cookie ?? cookie,
        origin: options.origin ?? origin,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  }
  const create = async () =>
    snapshot(await h.c.changeExecution(identity, createCommand()))
  const claim = async (value: ExecutionSessionSnapshot) => {
    const claimCommand = executionSessionCommandSchema.parse({
      type: 'claim',
      commandId: crypto.randomUUID(),
      sessionId: value.session!.id,
      expectedVersion: value.session!.version,
      ownerInstanceId: crypto.randomUUID(),
      runtimeId: crypto.randomUUID(),
      leaseProof: Buffer.alloc(32, 71).toString('base64url'),
      runtime: browserExecutionRuntime,
    })
    if (claimCommand.type !== 'claim') throw new Error('Invalid fixture')
    const claimed = snapshot(await h.c.changeExecution(identity, claimCommand))
    const fence = {
      sessionId: claimed.session!.id,
      hostGeneration: claimed.session!.hostGeneration,
      ownerInstanceId: claimCommand.ownerInstanceId,
      runtimeId: claimCommand.runtimeId,
      leaseProof: claimCommand.leaseProof,
    }
    return { claimed, fence, claimCommand }
  }
  return {
    ...h,
    env,
    cookie,
    request,
    getByName,
    create,
    claim,
    advance: (ms: number) => {
      now += ms
    },
  }
}

async function outputSetup() {
  const h = await setup()
  const { claimed, fence } = await h.claim(await h.create())
  snapshot(
    await h.c.changeExecution(identity, {
      type: 'enqueue',
      sessionId: fence.sessionId,
      commandId: crypto.randomUUID(),
      expectedVersion: claimed.session!.version,
      operation: {
        type: 'run',
        command: 'node',
        args: ['demo.cjs'],
        cwd: '/project',
        timeoutMs: 30_000,
      },
    }),
  )
  const delivered = snapshot(
    await h.c.changeExecution(identity, { type: 'dispatch', ...fence }),
  ).delivery!
  const event = {
    type: 'output' as const,
    sequence: 1,
    commandId: delivered.id,
    digest: delivered.digest,
    stream: 'stdout' as const,
    dataBase64: encodeExecutionBytes(new Uint8Array([0, 255, 128, 240, 159])),
  }
  return { ...h, fence, delivered, event }
}

it('replays exact historical output after reconstruction without changing an unknown command outcome', async () => {
  const h = await outputSetup()
  const append = {
    type: 'append_events' as const,
    ...h.fence,
    events: [h.event],
  }
  const first = snapshot(await h.c.changeExecution(identity, append))
  expect(first.events).toEqual({
    lastSequence: 1,
    outputBytes: 5,
    outputEvents: 1,
    droppedBytes: 0,
  })
  expect(snapshot(await h.c.changeExecution(identity, append)).events).toEqual(
    first.events,
  )
  const query = `?sessionId=${h.fence.sessionId}&after=0`
  const response = await api(
    h.request(undefined, { url: origin + path + query }),
    h.env,
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  const page = executionEventPageSchema.parse(await response.json())
  expect(page.events).toEqual([h.event])
  expect(JSON.stringify(page)).not.toContain(h.fence.leaseProof)
  const restored = await h.reconstruct()
  expect(
    await restored.executionEvents(identity, {
      sessionId: h.fence.sessionId,
      after: 0,
    }),
  ).toEqual({ ok: true, page })
  h.advance(60_001)
  const expired = snapshot(await restored.executionSnapshot(identity))
  expect(expired.commands[0].state).toBe('unknown')
  snapshot(
    await restored.changeExecution(identity, {
      type: 'abandon',
      sessionId: h.fence.sessionId,
      commandId: crypto.randomUUID(),
      expectedVersion: expired.session!.version,
    }),
  )
  const fresh = snapshot(
    await restored.changeExecution(identity, createCommand()),
  )
  expect(fresh.session!.id).not.toBe(h.fence.sessionId)
  expect(fresh.events.lastSequence).toBe(0)
  const historyResult = await restored.executionHistory(identity)
  expect(
    historyResult.ok &&
      historyResult.history.sessions.map((session) => session.id),
  ).toEqual([fresh.session!.id, h.fence.sessionId])
  const historical = snapshot(
    await restored.executionSnapshot(identity, h.fence.sessionId),
  )
  expect(historical.session?.status).toBe('abandoned')
  expect(historical.commands[0].state).toBe('unknown')
  expect(historical.events).toEqual(first.events)
  expect(
    await restored.executionEvents(identity, {
      sessionId: h.fence.sessionId,
      after: 0,
    }),
  ).toEqual({ ok: true, page })
})

it('rejects ambiguous output cursors and unauthorized reads or uploads without leaking bytes', async () => {
  const h = await outputSetup()
  const append = {
    type: 'append_events' as const,
    ...h.fence,
    events: [h.event],
  }
  expect(
    await h.c.changeExecution(identity, {
      ...append,
      leaseProof: Buffer.alloc(32, 72).toString('base64url'),
    }),
  ).toMatchObject({ ok: false, status: 403 })
  expect(
    snapshot(await h.c.executionSnapshot(identity)).events.lastSequence,
  ).toBe(0)
  snapshot(await h.c.changeExecution(identity, append))
  for (const query of [
    `?sessionId=${h.fence.sessionId}&sessionId=${h.fence.sessionId}`,
    '?after=0',
    `?sessionId=${h.fence.sessionId}&after=`,
    `?sessionId=${h.fence.sessionId}&after=0&after=1`,
    `?sessionId=${h.fence.sessionId}&after=0&extra=1`,
    `?sessionId=${h.fence.sessionId}&after=1e0`,
  ])
    expect(
      (await api(h.request(undefined, { url: origin + path + query }), h.env))
        .status,
    ).toBe(400)
  const read = { sessionId: h.fence.sessionId, after: 0 }
  expect(
    await h.c.executionEvents({ ...identity, userId: 'other' }, read),
  ).toMatchObject({ ok: false, status: 404 })
  expect(
    await h.c.executionEvents(
      { ...identity, conversationId: 'sibling-conversation' },
      read,
    ),
  ).toMatchObject({ ok: false, status: 404 })
  await h.db`DELETE FROM chat_memberships WHERE workspace_id='w' AND user_id=${identity.userId}`
  const response = await api(
    h.request(undefined, {
      url: origin + path + `?sessionId=${h.fence.sessionId}&after=0`,
    }),
    h.env,
  )
  expect(response.status).toBe(404)
  expect(await response.text()).not.toContain(h.event.dataBase64)
})

it('reads exact session history through authenticated GETs, rejects ambiguous queries and rechecks revoked access', async () => {
  const h = await outputSetup()
  snapshot(
    await h.c.changeExecution(identity, {
      type: 'append_events',
      ...h.fence,
      events: [h.event],
    }),
  )
  h.advance(60_001)
  const get = (query: string, cookie?: string) =>
    api(h.request(undefined, { url: origin + path + query, cookie }), h.env)
  const historyResponse = await get('?history=1')
  expect(historyResponse.status).toBe(200)
  expect(historyResponse.headers.get('cache-control')).toBe('no-store')
  const history = parseExecutionSessionHistory(
    await historyResponse.json(),
    identity,
  )
  expect(history.sessions).toHaveLength(1)
  expect(history.sessions[0]).toMatchObject({
    id: h.fence.sessionId,
    status: 'disconnected',
  })
  expect(JSON.stringify(history)).not.toContain(h.fence.leaseProof)
  const exact = await get(`?sessionId=${h.fence.sessionId}`)
  expect(exact.status).toBe(200)
  expect(exact.headers.get('cache-control')).toBe('no-store')
  const retained = parseExecutionSnapshot(await exact.json(), identity)
  expect(retained.commands[0].state).toBe('unknown')
  expect(retained.events.outputBytes).toBe(5)
  expect((await get(`?sessionId=${crypto.randomUUID()}`)).status).toBe(404)
  for (const query of [
    '?history=0',
    '?history=',
    '?history=true',
    '?history=1&history=1',
    '?history=1&after=0',
    `?history=1&sessionId=${h.fence.sessionId}`,
    '?sessionId=',
    '?sessionId=invalid',
    `?sessionId=${h.fence.sessionId}&sessionId=${h.fence.sessionId}`,
    `?sessionId=${h.fence.sessionId}&extra=1`,
  ])
    expect((await get(query)).status).toBe(400)
  for (const key of Object.keys(identity))
    expect(
      await h.c.executionHistory({ ...identity, [key]: 'other' }),
    ).toMatchObject({ ok: false, status: 404 })
  await h.db`INSERT INTO users(id,email,name,capabilities,session_version,signup_sources,created_at,updated_at) VALUES('00000000-0000-4000-8000-000000000002','other@example.invalid','Other',ARRAY['builder']::capability[],0,'[]',now(),now())`
  await h.db`INSERT INTO chat_access(user_id) VALUES('00000000-0000-4000-8000-000000000002')`
  await h.db`INSERT INTO chat_memberships(workspace_id,user_id,role) VALUES('w','00000000-0000-4000-8000-000000000002','member')`
  const other = (
    await createSharedSession('00000000-0000-4000-8000-000000000002')
  ).split(';')[0]
  for (const query of ['?history=1', `?sessionId=${h.fence.sessionId}`]) {
    expect((await get(query, '')).status).toBe(401)
    expect((await get(query, other)).status).toBe(404)
  }
  await h.db`DELETE FROM chat_memberships WHERE workspace_id='w' AND user_id=${identity.userId}`
  for (const query of ['?history=1', `?sessionId=${h.fence.sessionId}`]) {
    const denied = await get(query)
    expect(denied.status).toBe(404)
    const body = await denied.text()
    expect(body).not.toContain(h.fence.sessionId)
    expect(body).not.toContain(h.event.dataBase64)
  }
  expect(await h.c.executionHistory(identity)).toMatchObject({
    ok: false,
    status: 404,
  })
  expect(
    await h.c.executionSnapshot(identity, h.fence.sessionId),
  ).toMatchObject({ ok: false, status: 404 })
})

it('keeps a rejected output batch atomic even though the boundary commits lifecycle reconciliation', async () => {
  const h = await outputSetup()
  const failed = await h.c.changeExecution(identity, {
    type: 'append_events',
    ...h.fence,
    events: [
      h.event,
      { ...h.event, sequence: 2, commandId: crypto.randomUUID() },
    ],
  })
  expect(failed).toMatchObject({ ok: false })
  expect(
    snapshot(await h.c.executionSnapshot(identity)).events.lastSequence,
  ).toBe(0)
  snapshot(
    await h.c.changeExecution(identity, {
      type: 'append_events',
      ...h.fence,
      events: [h.event],
    }),
  )
  const read = await h.c.executionEvents(identity, {
    sessionId: h.fence.sessionId,
    after: 0,
  })
  expect(read.ok && read.page.events).toEqual([h.event])
})

it('routes only authenticated exact conversations and does not expose lease proofs', async () => {
  const h = await setup()
  const created = await api(h.request(createCommand()), h.env)
  expect(created.status).toBe(200)
  expect(created.headers.get('cache-control')).toBe('no-store')
  const publicState = (await created.json()) as ExecutionSessionSnapshot
  expect(publicState.session?.identity).toEqual(identity)
  expect(h.getByName).toHaveBeenLastCalledWith('main-conversation')
  const { fence } = await h.claim(publicState)
  const read = await api(h.request(), h.env)
  expect(await read.text()).not.toContain(fence.leaseProof)

  await h.db`INSERT INTO users(id,email,name,capabilities,session_version,signup_sources,created_at,updated_at) VALUES('00000000-0000-4000-8000-000000000002','other@example.invalid','Other',ARRAY['builder']::capability[],0,'[]',now(),now())`
  await h.db`INSERT INTO chat_access(user_id) VALUES('00000000-0000-4000-8000-000000000002')`
  await h.db`INSERT INTO chat_memberships(workspace_id,user_id,role) VALUES('w','00000000-0000-4000-8000-000000000002','member')`
  const other = (
    await createSharedSession('00000000-0000-4000-8000-000000000002')
  ).split(';')[0]
  h.getByName.mockClear()
  expect((await api(h.request(undefined, { cookie: '' }), h.env)).status).toBe(
    401,
  )
  expect(
    (await api(h.request(undefined, { cookie: other }), h.env)).status,
  ).toBe(404)
  expect(
    (
      await api(
        h.request(createCommand(), { origin: 'https://untrusted.invalid' }),
        h.env,
      )
    ).status,
  ).toBe(403)
  expect(
    (
      await api(
        h.request(undefined, {
          url: origin + '/api/workspaces/w/bots/b/execution',
        }),
        h.env,
      )
    ).status,
  ).toBe(404)
  expect(
    (
      await api(
        h.request({
          ...createCommand(),
          identity: { ...identity, userId: 'other' },
        }),
        h.env,
      )
    ).status,
  ).toBe(400)
  expect(h.getByName).not.toHaveBeenCalled()
  await h.db.unsafe(
    "INSERT INTO chat_workspaces(id,owner_id,name,policy) SELECT 'other-workspace','00000000-0000-4000-8000-000000000001','Other',policy FROM chat_workspaces WHERE id='w'",
  )
  expect(
    (
      await api(
        h.request(undefined, {
          url:
            origin +
            '/api/chat/conversations/main-conversation/execution?workspaceId=other-workspace',
        }),
        h.env,
      )
    ).status,
  ).toBe(404)
  await h.db`INSERT INTO chat_conversations(id,bot_id,user_id,created_at) VALUES('sibling-conversation','b',${identity.userId},to_timestamp(0.001))`
  expect(
    await h.c.executionSnapshot({
      ...identity,
      conversationId: 'sibling-conversation',
    }),
  ).toMatchObject({ ok: false, status: 404 })
})

it('does not accept a lease in a production build, on a remote host, or with fixture auth', async () => {
  const h = await setup()
  vi.stubGlobal('__GUM_LOCAL_DEVELOPMENT__', false)
  expect((await api(h.request(createCommand()), h.env)).status).toBe(404)
  expect(await h.c.changeExecution(identity, createCommand())).toMatchObject({
    ok: false,
    status: 404,
  })
  vi.stubGlobal('__GUM_LOCAL_DEVELOPMENT__', true)
  expect(
    (
      await api(
        h.request(createCommand(), {
          url: 'https://gum.example.invalid' + path,
          origin: 'https://gum.example.invalid',
        }),
        h.env,
      )
    ).status,
  ).toBe(404)
  Object.assign(h.env, { APP_MODE: 'fixture' })
  expect(await h.c.changeExecution(identity, createCommand())).toMatchObject({
    ok: false,
    status: 404,
  })
  expect(
    (
      await api(
        h.request(createCommand(), {
          cookie: '',
          url:
            origin +
            '/api/workspaces/personal%3Afixture/conversations/chat%3Akody%3Afixture%3Afixture/execution',
        }),
        h.env,
      )
    ).status,
  ).toBe(404)
  expect(h.getByName).not.toHaveBeenCalled()
})

it('retains a live owner through DO reconstruction and marks dispatched work unknown on expiry', async () => {
  const h = await setup()
  const { claimed, fence } = await h.claim(await h.create())
  const queued = snapshot(
    await h.c.changeExecution(identity, {
      type: 'enqueue',
      sessionId: fence.sessionId,
      commandId: crypto.randomUUID(),
      expectedVersion: claimed.session!.version,
      operation: {
        type: 'write_file',
        path: '/project/result.txt',
        text: 'exact\nbytes\n',
      },
    }),
  )
  const delivered = snapshot(
    await h.c.changeExecution(identity, { type: 'dispatch', ...fence }),
  )
  expect(delivered.delivery?.id).toBe(queued.commands[0].id)
  expect(delivered.delivery?.state).toBe('dispatched')
  // User-owned execution is independent of whether a transcript is still being
  // written. It blocks destructive lifecycle actions, not ordinary chat/copy.
  expect(h.c.lifecycleState().running).toBe(false)
  expect(await h.c.copyBoundary()).toMatchObject({ ok: true })
  const restored = await h.reconstruct()
  expect(snapshot(await restored.executionSnapshot(identity)).session).toEqual(
    delivered.session,
  )
  const again = snapshot(
    await restored.changeExecution(identity, { type: 'dispatch', ...fence }),
  )
  expect(again.delivery?.id).toBe(delivered.delivery?.id)
  h.advance(60_001)
  await h.ctx.storage.deleteAlarm()
  await restored.alarm()
  const expired = snapshot(await restored.executionSnapshot(identity))
  expect(expired.session?.status).toBe('disconnected')
  expect(expired.commands[0].state).toBe('unknown')
  expect(
    await restored.changeExecution(identity, { type: 'renew', ...fence }),
  ).toMatchObject({ ok: false, status: 403 })
  await expect(restored.reset()).rejects.toThrow('Close or abandon')
  expect((await restored.reserveDeletion('archive-check')).reserved).toBe(false)
})

it.each(['membership', 'archive'] as const)(
  'invalidates ownership after %s is revoked then restored between polls',
  async (kind) => {
    const h = await setup()
    const { fence } = await h.claim(await h.create())
    if (kind === 'membership') {
      await h.db`DELETE FROM chat_memberships WHERE workspace_id='w' AND user_id=${identity.userId}`
      await h.db`INSERT INTO chat_memberships(workspace_id,user_id,role) VALUES('w',${identity.userId},'owner')`
    } else {
      await h.db`UPDATE chat_bots SET archived_at=to_timestamp(0.001) WHERE id='b'`
      await h.db`UPDATE chat_bots SET archived_at=NULL WHERE id='b'`
    }
    const restored = await h.reconstruct()
    expect(
      await restored.changeExecution(identity, { type: 'renew', ...fence }),
    ).toMatchObject({ ok: false, status: 403 })
    const invalidated = snapshot(await restored.executionSnapshot(identity))
    expect(invalidated.session?.status).toBe('disconnected')
    // Explicit abandon retains the old evidence but releases reset's lifecycle gate.
    snapshot(
      await restored.changeExecution(identity, {
        type: 'abandon',
        commandId: crypto.randomUUID(),
        sessionId: fence.sessionId,
        expectedVersion: invalidated.session!.version,
      }),
    )
    await restored.reset()
    expect(
      snapshot(await restored.executionSnapshot(identity)).session?.status,
    ).toBe('abandoned')
  },
)

it('commits the lease alarm with ownership and preserves an earlier unrelated alarm', async () => {
  const h = await setup()
  const created = await h.create()
  await h.ctx.storage.setAlarm(Date.now() + 500)
  const { claimed } = await h.claim(created)
  expect(await h.ctx.storage.getAlarm()).toBe(Date.now() + 500)
  expect(claimed.session?.leaseExpiresAt).toBe(Date.now() + 60_000)

  const other = await setup()
  const awaiting = await other.create()
  await other.ctx.storage.deleteAlarm()
  other.ctx.storage.setAlarm.mockRejectedValueOnce(
    new Error('Synthetic alarm failure'),
  )
  await expect(other.claim(awaiting)).rejects.toThrow('Synthetic alarm failure')
  const afterFailure = snapshot(await other.c.executionSnapshot(identity))
  expect(afterFailure.session?.status).toBe('awaiting_host')
  expect(afterFailure.session?.hostGeneration).toBe(0)
  expect(afterFailure.session?.ownerInstanceId).toBeUndefined()
  expect(await other.ctx.storage.getAlarm()).toBe(null)
})

it.each(['tampered', 'expired', 'revoked', 'chat-access'] as const)(
  'rejects an execution request with %s shared session authority before host routing',
  async (kind) => {
    const h = await setup()
    let cookie = h.cookie
    if (kind === 'tampered') cookie += 'x'
    if (kind === 'expired') h.advance(30 * 24 * 60 * 60 * 1000 + 1)
    if (kind === 'revoked')
      await h.db`UPDATE users SET session_version=1 WHERE id=${identity.userId}`
    if (kind === 'chat-access')
      await h.db`DELETE FROM chat_access WHERE user_id=${identity.userId}`
    h.getByName.mockClear()
    const response = await api(h.request(undefined, { cookie }), h.env)
    expect(response.status).toBe(kind === 'chat-access' ? 403 : 401)
    expect(h.getByName).not.toHaveBeenCalled()
  },
)
