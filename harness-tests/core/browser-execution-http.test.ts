import type { SqlStorage } from '@cloudflare/workers-types'
import { createHash, randomBytes } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  browserExecutionRuntime,
  maxExecutionCommands,
  maxExecutionResponseBytes,
  maxExecutionSessions,
  type ExecutionIdentity,
  type ExecutionSessionCommand,
  type ExecutionSessionSnapshot,
} from '../../src/chat/core/execution-sessions'
import { parseExecutionSnapshot } from '../../src/chat/core/execution-snapshot'
import {
  createExecutionHttp,
  ExecutionHttpError,
} from '../../src/chat/client/execution-http'
import { ExecutionSessions } from '../../src/chat/server/execution-sessions'
import {
  encodeProjectSnapshot,
  inspectProjectSnapshot,
  maxProjectSnapshotBytes,
} from '../../src/chat/core/execution-project-snapshot'

const identity: ExecutionIdentity = {
  userId: 'u',
  workspaceId: 'w/编码',
  botId: 'b',
  conversationId: 'c/私有',
}
const empty: ExecutionSessionSnapshot = {
  session: null,
  commands: [],
  processes: [],
  events: { lastSequence: 0, outputBytes: 0, outputEvents: 0, droppedBytes: 0 },
  savedSnapshots: [],
  deferred: [],
}
const hash = (text: string) => createHash('sha256').update(text).digest('hex')
const create = (): Extract<ExecutionSessionCommand, { type: 'create' }> => ({
  type: 'create',
  commandId: crypto.randomUUID(),
  runtime: structuredClone(browserExecutionRuntime),
  project: { source: 'trusted-fixture', digest: hash('fixture') },
})
const databases: DatabaseSync[] = []
afterEach(() => {
  vi.useRealTimers()
  for (const db of databases.splice(0)) db.close()
})
function ledger() {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  const sql = {
    exec(query: string, ...args: any[]) {
      const statement = db.prepare(query)
      const rows = statement.columns().length
        ? statement.all(...args)
        : (statement.run(...args), [])
      return { toArray: () => rows }
    },
  } as unknown as SqlStorage
  const store = new ExecutionSessions(sql)
  const call = (input: ExecutionSessionCommand) =>
    store.command(
      identity,
      input,
      { lifecycleGeneration: 0, membershipGeneration: 0 },
      100,
    )
  const first = call(create())
  const claim = {
    type: 'claim' as const,
    commandId: crypto.randomUUID(),
    sessionId: first.session!.id,
    expectedVersion: 1,
    ownerInstanceId: crypto.randomUUID(),
    runtimeId: crypto.randomUUID(),
    leaseProof: randomBytes(32).toString('base64url'),
    runtime: structuredClone(browserExecutionRuntime),
  }
  const ready = call(claim)
  const host = {
    sessionId: first.session!.id,
    ownerInstanceId: claim.ownerInstanceId,
    runtimeId: claim.runtimeId,
    leaseProof: claim.leaseProof,
    hostGeneration: 1,
  }
  const enqueue = (
    operation: Extract<
      ExecutionSessionCommand,
      { type: 'enqueue' }
    >['operation'],
  ) =>
    call({
      type: 'enqueue',
      sessionId: first.session!.id,
      commandId: crypto.randomUUID(),
      expectedVersion: store.snapshot(identity).session!.version,
      operation,
    })
  const dispatch = () => call({ type: 'dispatch', ...host })
  return { store, call, first, ready, host, enqueue, dispatch }
}
function transport(
  fetcher: typeof fetch,
  options: { timeoutMs?: number; backoffMs?: number } = {},
) {
  return createExecutionHttp(identity, {
    fetch: fetcher,
    backoffMs: 0,
    ...options,
  })
}
const fetchMock = (
  implementation: (...args: Parameters<typeof fetch>) => Promise<Response>,
) => vi.fn(implementation) as ReturnType<typeof vi.fn<typeof fetch>>

describe('strict execution snapshots', () => {
  it('emits current deferred metadata while accepting the exact legacy marker', () => {
    const h = ledger()
    expect(h.ready.deferred).toEqual([])
    expect(parseExecutionSnapshot(h.ready, identity)).toEqual(h.ready)
    const legacy = { ...h.ready, deferred: ['model_tools'] }
    expect(parseExecutionSnapshot(legacy, identity)).toEqual(legacy)
    for (const deferred of [
      ['unknown_feature'],
      ['model_tools', 'model_tools'],
      undefined,
    ]) {
      expect(() =>
        parseExecutionSnapshot({ ...h.ready, deferred }, identity),
      ).toThrow()
    }
  })

  it('accepts actual ledger projections through claim, dispatch, process stop and close', () => {
    const h = ledger()
    const check = (snapshot: ExecutionSessionSnapshot) =>
      expect(parseExecutionSnapshot(snapshot, identity)).toEqual(snapshot)
    check(empty)
    check(h.first)
    check(h.ready)
    check(
      h.enqueue({
        type: 'spawn',
        command: 'node',
        args: [],
        cwd: '/project',
        timeoutMs: 30_000,
      }),
    )
    const spawned = h.dispatch()
    check(spawned)
    const command = spawned.delivery!
    check(
      h.call({
        type: 'acknowledge',
        eventsThrough: 0,
        ...h.host,
        commandId: command.id,
        digest: command.digest,
        outcome: 'succeeded',
        result: {
          type: 'spawn',
          processId: command.processId!,
          pid: 7,
          status: 'running',
        },
      }),
    )
    h.enqueue({ type: 'stop_process', processId: command.processId! })
    const stop = h.dispatch().delivery!
    check(
      h.call({
        type: 'acknowledge',
        eventsThrough: 0,
        ...h.host,
        commandId: stop.id,
        digest: stop.digest,
        outcome: 'succeeded',
        result: {
          type: 'stop_process',
          processId: command.processId!,
          exitCode: null,
          signal: 'SIGTERM',
          outputDrained: true,
          disposed: true,
        },
      }),
    )
    h.enqueue({ type: 'close' })
    const close = h.dispatch().delivery!
    check(
      h.call({
        type: 'acknowledge',
        eventsThrough: 0,
        ...h.host,
        commandId: close.id,
        digest: close.digest,
        outcome: 'succeeded',
        result: { type: 'close', shutdownAcknowledged: true },
      }),
    )
  })

  it('accepts cancelled and unknown receipts after lease expiry', () => {
    const h = ledger()
    h.enqueue({ type: 'read_file', path: '/project/a' })
    h.dispatch()
    h.enqueue({ type: 'read_file', path: '/project/b' })
    h.store.expire(60_100)
    const value = h.store.snapshot(identity)
    expect(value.commands.map((command) => command.state)).toEqual([
      'unknown',
      'cancelled',
    ])
    expect(parseExecutionSnapshot(value, identity)).toEqual(value)
  })

  it.each(['userId', 'workspaceId', 'botId', 'conversationId'] as const)(
    'rejects another %s',
    (key) => {
      const value = ledger().ready
      value.session!.identity[key] = 'someone else'
      expect(() => parseExecutionSnapshot(value, identity)).toThrow(
        'invalid for this conversation',
      )
    },
  )

  it('rejects hidden authority, fabricated delivery, duplicate/count overflow and mismatched result types', () => {
    const h = ledger()
    h.enqueue({ type: 'read_file', path: '/project/a' })
    const snapshot = h.dispatch()
    const variants: unknown[] = [
      { ...snapshot, leaseProof: 'secret' },
      { ...snapshot, session: { ...snapshot.session, leaseProof: 'secret' } },
      { ...snapshot, session: null },
      { ...snapshot, commands: [...snapshot.commands, snapshot.commands[0]] },
      {
        ...snapshot,
        commands: Array.from(
          { length: maxExecutionCommands + 1 },
          (_, index) => ({
            ...snapshot.commands[0],
            id: crypto.randomUUID(),
            createdAt: index,
          }),
        ),
      },
      {
        ...snapshot,
        delivery: { ...snapshot.delivery, digest: 'b'.repeat(64) },
      },
      {
        ...snapshot,
        delivery: { ...snapshot.delivery, operation: { type: 'close' } },
      },
      {
        ...snapshot,
        commands: [{ ...snapshot.commands[0], sessionId: crypto.randomUUID() }],
      },
      {
        ...snapshot,
        commands: [
          {
            ...snapshot.commands[0],
            state: 'succeeded',
            completedAt: 101,
            result: { type: 'close', shutdownAcknowledged: true },
          },
        ],
      },
      { ...empty, extra: 'unexpected' },
    ]
    for (const variant of variants)
      expect(() => parseExecutionSnapshot(variant, identity)).toThrow(
        'invalid for this conversation',
      )
  })
})

describe('authenticated execution HTTP', () => {
  it('retries a lost committed response with exactly one durable create and unchanged bytes', async () => {
    const h = ledger()
    // Abandon the helper's session so this request creates its own one.
    h.store.expire(60_100)
    const current = h.store.snapshot(identity).session!
    h.call({
      type: 'abandon',
      commandId: crypto.randomUUID(),
      sessionId: current.id,
      expectedVersion: current.version,
    })
    const bodies: string[] = [],
      snapshots: ExecutionSessionSnapshot[] = []
    const fake = fetchMock(async (_url, options) => {
      bodies.push(options!.body as string)
      snapshots.push(h.call(JSON.parse(options!.body as string)))
      if (bodies.length === 1) throw new TypeError('private transport details')
      return Response.json(snapshots.at(-1))
    })
    const response = await transport(fake).command(create())
    expect(bodies).toHaveLength(2)
    expect(bodies[0]).toBe(bodies[1])
    expect(response.session!.id).toBe(snapshots[0].session!.id)
    expect(snapshots[0]).toEqual(snapshots[1])
    expect(fake.mock.calls[0][0]).toBe(
      '/api/chat/conversations/c%2F%E7%A7%81%E6%9C%89/execution?workspaceId=w%2F%E7%BC%96%E7%A0%81',
    )
    expect(fake.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    })
  })

  it('captures identity and command bytes before callers mutate their inputs', async () => {
    const scope = { ...identity },
      input = create(),
      response = ledger().ready
    const fake = fetchMock(async () => Response.json(response))
    const http = createExecutionHttp(scope, { fetch: fake, backoffMs: 0 })
    const pending = http.command(input)
    scope.conversationId = 'changed'
    input.commandId = crypto.randomUUID()
    const result = await pending
    expect(result).toEqual(response)
    expect(fake.mock.calls[0][0]).not.toContain('changed')
    expect(
      JSON.parse(fake.mock.calls[0][1]!.body as string).commandId,
    ).not.toBe(input.commandId)
  })

  it('retries network and 5xx failures at most three times without reflecting private errors', async () => {
    const fake = fetchMock(async () => {
      throw new Error('leaseProof=private-token')
    })
    const failure = await transport(fake)
      .command(create())
      .catch((error) => error)
    expect(fake).toHaveBeenCalledTimes(3)
    expect(failure).toBeInstanceOf(ExecutionHttpError)
    expect(failure).toMatchObject({ status: null, uncertain: true })
    expect(failure.message).not.toContain('private-token')
    const unavailable = fetchMock(
      async () => new Response('private server details', { status: 503 }),
    )
    await expect(
      transport(unavailable).command(create()),
    ).rejects.toMatchObject({ status: 503, uncertain: true })
    expect(unavailable).toHaveBeenCalledTimes(3)
    expect(
      new Set(unavailable.mock.calls.map((call) => call[1]!.body)).size,
    ).toBe(1)
  })

  it.each([401, 403, 404, 409])(
    'preserves HTTP %s without reading its HTML body or retrying',
    async (status) => {
      let cancelled = false
      const fake = fetchMock(
        async () =>
          new Response(
            new ReadableStream({
              cancel() {
                cancelled = true
              },
            }),
            { status, headers: { 'Content-Type': 'text/html' } },
          ),
      )
      const error = await transport(fake)
        .command(create())
        .catch((value) => value)
      expect(error).toMatchObject({ status, uncertain: false })
      expect(fake).toHaveBeenCalledTimes(1)
      expect(cancelled).toBe(true)
    },
  )

  it('keeps prior mutation uncertainty when a later retry gets an authorization failure', async () => {
    let calls = 0
    const fake = fetchMock(async () => {
      if (++calls === 1) throw new TypeError('lost')
      return new Response('', { status: 403 })
    })
    await expect(transport(fake).command(create())).rejects.toMatchObject({
      status: 403,
      uncertain: true,
    })
    expect(fake).toHaveBeenCalledTimes(2)
  })

  it.each(['invalid JSON', 'wrong identity'])(
    'rejects %s without retrying a successful HTTP response',
    async (scenario) => {
      const value = ledger().ready
      value.session!.identity.userId = 'different'
      const fake = fetchMock(async () =>
        scenario === 'invalid JSON'
          ? new Response('secret invalid body')
          : Response.json(value),
      )
      const error = await transport(fake)
        .command(create())
        .catch((value) => value)
      expect(error).toMatchObject({ status: 200, uncertain: true })
      expect(error.message).not.toContain('secret')
      expect(fake).toHaveBeenCalledTimes(1)
    },
  )

  it('uses authenticated no-store GET and does not claim mutation uncertainty for a failed read', async () => {
    const fake = fetchMock(async () => Response.json(empty))
    expect(await transport(fake).snapshot()).toEqual(empty)
    expect(fake.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      body: undefined,
    })
    const failed = fetchMock(async () => {
      throw new TypeError('offline')
    })
    await expect(transport(failed).snapshot()).rejects.toMatchObject({
      uncertain: false,
    })
  })

  it('rejects a null mutation response or another session in the same conversation', async () => {
    const h = ledger()
    const other = ledger().ready
    expect(other.session!.id).not.toBe(h.ready.session!.id)
    const fake = fetchMock(async () => Response.json(other))
    await expect(
      transport(fake).command({ type: 'renew', ...h.host }),
    ).rejects.toMatchObject({ status: 200, uncertain: true })
    expect(fake).toHaveBeenCalledTimes(1)
    const missing = fetchMock(async () => Response.json(empty))
    await expect(transport(missing).command(create())).rejects.toMatchObject({
      status: 200,
      uncertain: true,
    })
  })

  it('bounds response bytes even without a content-length header and cancels its stream', async () => {
    let cancelled = false,
      reads = 0
    const fake = fetchMock(
      async () =>
        new Response(
          new ReadableStream({
            pull(controller) {
              reads++
              controller.enqueue(new Uint8Array(64 * 1024))
            },
            cancel() {
              cancelled = true
            },
          }),
        ),
    )
    await expect(transport(fake).command(create())).rejects.toMatchObject({
      status: 200,
      uncertain: true,
      message: 'Execution response exceeds its size limit.',
    })
    expect(cancelled).toBe(true)
    expect(reads).toBeLessThanOrEqual(
      maxExecutionResponseBytes / (64 * 1024) + 2,
    )
    expect(fake).toHaveBeenCalledTimes(1)
  })

  it('rejects oversized declared length before waiting for an empty body', async () => {
    const fake = fetchMock(
      async () =>
        new Response(new ReadableStream(), {
          headers: { 'Content-Length': String(maxExecutionResponseBytes + 1) },
        }),
    )
    await expect(transport(fake).snapshot()).rejects.toMatchObject({
      message: 'Execution response exceeds its size limit.',
      uncertain: false,
    })
  })

  it('does not send an already cancelled request', async () => {
    const controller = new AbortController()
    controller.abort()
    const fake = fetchMock(async () => Response.json(empty))
    await expect(
      transport(fake).command(create(), controller.signal),
    ).rejects.toMatchObject({ status: null, uncertain: false })
    expect(fake).not.toHaveBeenCalled()
  })

  it('cancels and bounds a body read after headers arrive, without replay', async () => {
    let cancelled = false
    const controller = new AbortController()
    const fake = fetchMock(
      async () =>
        new Response(
          new ReadableStream({
            cancel() {
              cancelled = true
            },
          }),
        ),
    )
    const result = transport(fake)
      .command(create(), controller.signal)
      .catch((error) => error)
    await vi.waitFor(() => expect(fake.mock.results[0]?.type).toBe('return'))
    await Promise.resolve()
    await Promise.resolve()
    controller.abort()
    expect(await result).toMatchObject({
      status: 200,
      uncertain: true,
      message: 'Execution request cancelled.',
    })
    expect(cancelled).toBe(true)
    expect(fake).toHaveBeenCalledTimes(1)
  })

  it('applies its deadline to body reads and aborts the underlying fetch signal', async () => {
    vi.useFakeTimers()
    let cancelled = false
    const fake = fetchMock(
      async () =>
        new Response(
          new ReadableStream({
            cancel() {
              cancelled = true
            },
          }),
        ),
    )
    const result = transport(fake, { timeoutMs: 25 })
      .command(create())
      .catch((error) => error)
    await vi.advanceTimersByTimeAsync(25)
    expect(await result).toMatchObject({
      status: 200,
      uncertain: true,
      message: 'Execution request timed out.',
    })
    expect(fake.mock.calls[0][1]!.signal!.aborted).toBe(true)
    expect(cancelled).toBe(true)
    expect(fake).toHaveBeenCalledTimes(1)
  })

  it('bounds a fetch that ignores abort and cancels a response arriving after timeout', async () => {
    vi.useFakeTimers()
    let resolve!: (response: Response) => void,
      cancelled = false
    const fake = fetchMock(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const result = transport(fake, { timeoutMs: 25 })
      .command(create())
      .catch((error) => error)
    await vi.advanceTimersByTimeAsync(25)
    expect(await result).toMatchObject({
      status: null,
      uncertain: true,
      message: 'Execution request timed out.',
    })
    resolve(
      new Response(
        new ReadableStream({
          cancel() {
            cancelled = true
          },
        }),
      ),
    )
    await Promise.resolve()
    await Promise.resolve()
    expect(cancelled).toBe(true)
    expect(fake).toHaveBeenCalledTimes(1)
  })

  it('cancels retry backoff without another attempt', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const fake = fetchMock(async () => {
      throw new TypeError('offline')
    })
    const result = transport(fake, { backoffMs: 100 })
      .command(create(), controller.signal)
      .catch((error) => error)
    await vi.advanceTimersByTimeAsync(1)
    controller.abort()
    expect(await result).toMatchObject({
      uncertain: true,
      message: 'Execution request cancelled.',
    })
    await vi.advanceTimersByTimeAsync(1000)
    expect(fake).toHaveBeenCalledTimes(1)
  })
})

describe('read-only execution history HTTP', () => {
  it('reads the scoped history and exact older session without selecting or mutating the current runtime', async () => {
    const h = ledger()
    h.enqueue({ type: 'close' })
    const close = h.dispatch().delivery!
    const closed = h.call({
      type: 'acknowledge',
      eventsThrough: 0,
      ...h.host,
      commandId: close.id,
      digest: close.digest,
      outcome: 'succeeded',
      result: { type: 'close', shutdownAcknowledged: true },
    })
    const current = h.call(create())
    const history = { sessions: [current.session!, closed.session!] }
    const endpoint = '/api/chat/conversations/c%2F%E7%A7%81%E6%9C%89/execution'
    const fake = fetchMock(async (url) => {
      if (url === `${endpoint}?history=1&workspaceId=w%2F%E7%BC%96%E7%A0%81`)
        return Response.json(history)
      if (
        url ===
        `${endpoint}?sessionId=${closed.session!.id}&workspaceId=w%2F%E7%BC%96%E7%A0%81`
      )
        return Response.json(closed)
      throw new Error('Unexpected route.')
    })
    const http = transport(fake)
    expect(await http.history()).toEqual(history)
    expect(await http.session(closed.session!.id)).toEqual(closed)
    expect(h.store.snapshot(identity).session!.id).toBe(current.session!.id)
    expect(fake).toHaveBeenCalledTimes(2)
    for (const [, init] of fake.mock.calls) {
      expect(init).toMatchObject({
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        body: undefined,
        headers: undefined,
      })
    }
  })

  it('accepts empty history and exactly the bounded number of scoped sessions', async () => {
    const session = ledger().ready.session!
    const sessions = Array.from({ length: maxExecutionSessions }, () => ({
      ...session,
      id: crypto.randomUUID(),
    }))
    const fake = fetchMock(async () => Response.json({ sessions }))
    expect(await transport(fake).history()).toEqual({ sessions })
    const emptyHistory = fetchMock(async () => Response.json({ sessions: [] }))
    expect(await transport(emptyHistory).history()).toEqual({ sessions: [] })
  })

  it.each(['userId', 'workspaceId', 'botId', 'conversationId'] as const)(
    'rejects history and exact reads containing another %s',
    async (key) => {
      const snapshot = ledger().ready
      snapshot.session!.identity[key] = 'not this scope'
      const fake = fetchMock(async (url) =>
        Response.json(
          String(url).endsWith('?history=1')
            ? { sessions: [snapshot.session] }
            : snapshot,
        ),
      )
      const http = transport(fake)
      for (const read of [http.history(), http.session(snapshot.session!.id)]) {
        await expect(read).rejects.toMatchObject({
          status: 200,
          uncertain: false,
        })
      }
      expect(fake).toHaveBeenCalledTimes(2)
    },
  )

  it('rejects malformed, duplicate, over-limit and secret-bearing history without retrying', async () => {
    const session = ledger().ready.session!
    for (const value of [
      null,
      [],
      { sessions: null },
      { sessions: [session, session] },
      { sessions: [session], leaseProof: 'private' },
      { sessions: [{ ...session, leaseProof: 'private' }] },
      { sessions: [{ ...session, runtimeId: undefined }] },
      {
        sessions: Array.from({ length: maxExecutionSessions + 1 }, () => ({
          ...session,
          id: crypto.randomUUID(),
        })),
      },
    ]) {
      const fake = fetchMock(async () => Response.json(value))
      const error = await transport(fake)
        .history()
        .catch((error) => error)
      expect(error).toBeInstanceOf(ExecutionHttpError)
      expect(error).toMatchObject({ status: 200, uncertain: false })
      expect(error.message).not.toContain('private')
      expect(fake).toHaveBeenCalledOnce()
    }
  })

  it('never substitutes a null snapshot or another session in the same conversation', async () => {
    const requested = crypto.randomUUID()
    for (const value of [empty, ledger().ready]) {
      const fake = fetchMock(async () => Response.json(value))
      await expect(transport(fake).session(requested)).rejects.toMatchObject({
        status: 200,
        uncertain: false,
      })
      expect(fake).toHaveBeenCalledOnce()
    }
  })

  it('rejects malformed session IDs before any fetch', async () => {
    const fake = fetchMock(async () => Response.json(empty))
    const http = transport(fake)
    for (const id of [
      '',
      '../other',
      'not-a-uuid',
      `${crypto.randomUUID()}?history=1`,
      crypto.randomUUID().replace(/.$/, 'g'),
    ]) {
      await expect(http.session(id)).rejects.toMatchObject({
        status: null,
        uncertain: false,
        message: 'Invalid execution session.',
      })
    }
    expect(fake).not.toHaveBeenCalled()
  })

  it.each(['history', 'session'] as const)(
    'cancels %s before dispatch and during body receipt without mutation or retry',
    async (kind) => {
      const cancelled = vi.fn()
      const fake = fetchMock(
        async () => new Response(new ReadableStream({ cancel: cancelled })),
      )
      const http = transport(fake)
      const read = (signal: AbortSignal) =>
        kind === 'history'
          ? http.history(signal)
          : http.session(crypto.randomUUID(), signal)
      const before = new AbortController()
      before.abort()
      await expect(read(before.signal)).rejects.toMatchObject({
        status: null,
        uncertain: false,
      })
      expect(fake).not.toHaveBeenCalled()

      const during = new AbortController()
      const result = read(during.signal).catch((error) => error)
      await vi.waitFor(() => expect(fake.mock.results[0]?.type).toBe('return'))
      await Promise.resolve()
      await Promise.resolve()
      during.abort()
      expect(await result).toMatchObject({
        status: 200,
        uncertain: false,
        message: 'Execution request cancelled.',
      })
      expect(cancelled).toHaveBeenCalledOnce()
      expect(fake).toHaveBeenCalledOnce()
      expect(fake.mock.calls[0][1]).toMatchObject({
        method: 'GET',
        body: undefined,
      })
    },
  )

  it('enforces the existing response byte bound on history before parsing', async () => {
    const cancelled = vi.fn()
    const fake = fetchMock(
      async () =>
        new Response(new ReadableStream({ cancel: cancelled }), {
          headers: { 'Content-Length': String(maxExecutionResponseBytes + 1) },
        }),
    )
    await expect(transport(fake).history()).rejects.toMatchObject({
      status: 200,
      uncertain: false,
      message: 'Execution response exceeds its size limit.',
    })
    expect(cancelled).toHaveBeenCalledOnce()
    expect(fake).toHaveBeenCalledOnce()
  })
})

describe('execution output HTTP transport', () => {
  const withOutput = () => {
    const h = ledger()
    h.enqueue({
      type: 'run',
      command: 'node',
      args: [],
      cwd: '/project',
      timeoutMs: 30_000,
    })
    const delivery = h.dispatch().delivery!
    const input: Extract<ExecutionSessionCommand, { type: 'append_events' }> = {
      type: 'append_events',
      ...h.host,
      events: [
        {
          type: 'output',
          sequence: 1,
          commandId: delivery.id,
          digest: delivery.digest,
          stream: 'stdout',
          dataBase64: Buffer.from('\ufeffcafé 😀\r\n').toString('base64'),
        },
      ],
    }
    return { ...h, input }
  }

  it('retries a lost committed append with the exact same batch and one stored event', async () => {
    const h = withOutput()
    const bodies: string[] = []
    const fake = fetchMock(async (_url, options) => {
      bodies.push(options!.body as string)
      const snapshot = h.call(JSON.parse(bodies.at(-1)!))
      if (bodies.length === 1) throw new TypeError('lost upload response')
      return Response.json(snapshot)
    })
    const result = await transport(fake).command(h.input)
    expect(bodies).toHaveLength(2)
    expect(bodies[0]).toBe(bodies[1])
    expect(result.events).toMatchObject({
      lastSequence: 1,
      outputEvents: 1,
      outputBytes: Buffer.byteLength('\ufeffcafé 😀\r\n'),
    })
    const page = h.store.events(identity, {
      sessionId: h.host.sessionId,
      after: 0,
    })
    expect(page.events).toEqual(h.input.events)
  })

  it('uses an explicit exact session cursor and preserves raw UTF-8 bytes across a split response', async () => {
    const h = withOutput()
    h.call(h.input)
    const page = h.store.events(identity, {
      sessionId: h.host.sessionId,
      after: 0,
    })
    const data = new TextEncoder().encode(JSON.stringify(page))
    const fake = fetchMock(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              for (let i = 0; i < data.length; i += 7)
                controller.enqueue(data.slice(i, i + 7))
              controller.close()
            },
          }),
        ),
    )
    const read = { sessionId: h.host.sessionId, after: 0 }
    const pending = transport(fake).events(read)
    read.sessionId = crypto.randomUUID()
    const actual = await pending
    expect(actual).toEqual(page)
    const url = new URL(String(fake.mock.calls[0][0]), 'http://127.0.0.1:3002')
    expect(url.pathname).toBe(
      '/api/chat/conversations/c%2F%E7%A7%81%E6%9C%89/execution',
    )
    expect(url.searchParams.get('sessionId')).toBe(h.host.sessionId)
    expect(url.searchParams.get('after')).toBe('0')
    expect(url.searchParams.get('workspaceId')).toBe(identity.workspaceId)
    expect(fake.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    })
    expect(fake.mock.calls[0][1]!.body).toBeUndefined()
  })

  it.each(['session', 'cursor', 'bytes', 'sequence', 'secret'] as const)(
    'rejects an invalid %s page without retry or exposing its body',
    async (field) => {
      const h = withOutput()
      h.call(h.input)
      const page = h.store.events(identity, {
        sessionId: h.host.sessionId,
        after: 0,
      }) as any
      if (field === 'session') page.sessionId = crypto.randomUUID()
      if (field === 'cursor') {
        page.after = 1
        page.nextSequence = 1
        page.events = []
      }
      if (field === 'bytes') page.events[0].dataBase64 = '%PRIVATE%'
      if (field === 'sequence') page.events[0].sequence = 2
      if (field === 'secret') page.leaseProof = 'PRIVATE'
      const fake = fetchMock(async () => Response.json(page))
      const error = await transport(fake)
        .events({ sessionId: h.host.sessionId, after: 0 })
        .catch((value) => value)
      expect(error).toMatchObject({ status: 200, uncertain: false })
      expect(error.message).not.toContain('PRIVATE')
      expect(fake).toHaveBeenCalledTimes(1)
    },
  )

  it('bounds a hanging event page body and cancels it without another request', async () => {
    vi.useFakeTimers()
    let cancelled = false
    const fake = fetchMock(
      async () =>
        new Response(
          new ReadableStream({
            cancel() {
              cancelled = true
            },
          }),
        ),
    )
    const pending = transport(fake, { timeoutMs: 25 })
      .events({ sessionId: crypto.randomUUID(), after: 0 })
      .catch((error) => error)
    await vi.advanceTimersByTimeAsync(25)
    expect(await pending).toMatchObject({
      status: 200,
      uncertain: false,
      message: 'Execution request timed out.',
    })
    expect(cancelled).toBe(true)
    expect(fake).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid event cursors before any network call', async () => {
    const fake = fetchMock(async () => Response.json({}))
    await expect(
      transport(fake).events({ sessionId: crypto.randomUUID(), after: -1 }),
    ).rejects.toMatchObject({ uncertain: false })
    expect(fake).not.toHaveBeenCalled()
  })
})

describe('authenticated project snapshot transport', () => {
  async function savedProject() {
    const h = ledger()
    h.enqueue({ type: 'save_snapshot' })
    const command = h.dispatch().delivery!
    const bytes = encodeProjectSnapshot({
      version: 1,
      files: {
        '/project/data.bin': new Uint8Array([0, 255, 13, 10, 239, 187, 191]),
      },
    })
    const metadata = {
      snapshotId: command.id,
      ...(await inspectProjectSnapshot(bytes)),
    }
    const upload = {
      ...h.host,
      commandId: command.id,
      digest: command.digest,
      snapshot: metadata,
    }
    const publish = () => {
      h.store.saveProjectSnapshot(
        identity,
        upload,
        { lifecycleGeneration: 0, membershipGeneration: 0 },
        100,
      )
      return h.store.saveProjectSnapshot(
        identity,
        upload,
        { lifecycleGeneration: 0, membershipGeneration: 0 },
        100,
        true,
      )
    }
    return { h, command, bytes, metadata, upload, publish }
  }
  it('retries one immutable upload after a lost committed response, with private proof only on same-origin HTTP', async () => {
    const f = await savedProject(),
      requests: RequestInit[] = []
    const fetcher = fetchMock(async (url, options) => {
      expect(url).toBe(
        `/api/chat/conversations/c%2F%E7%A7%81%E6%9C%89/execution/snapshots/${f.command.id}?workspaceId=w%2F%E7%BC%96%E7%A0%81`,
      )
      requests.push(options!)
      const ready = f.publish()
      if (requests.length === 1)
        throw new TypeError('Lost after committed upload')
      return Response.json(ready)
    })
    const response = await transport(fetcher).uploadSnapshot(f.upload, f.bytes)
    expect(response.savedSnapshots[0].state).toBe('ready')
    expect(requests).toHaveLength(2)
    expect(requests[1].body).toEqual(f.bytes)
    expect(requests[0].body).toBe(requests[1].body)
    expect(requests[0]).toMatchObject({
      method: 'PUT',
      credentials: 'same-origin',
      redirect: 'error',
      cache: 'no-store',
    })
    expect(requests[0].headers).toEqual(requests[1].headers)
    expect(
      JSON.parse(
        (requests[0].headers as Record<string, string>)[
          'x-gum-execution-snapshot'
        ],
      ),
    ).toEqual(f.upload)
    expect(f.h.store.snapshot(identity).savedSnapshots).toHaveLength(1)
  })
  it('loads exact ready metadata then raw bytes without JSON, UTF-8 conversion or arbitrary endpoints', async () => {
    const f = await savedProject(),
      record = f.publish().savedSnapshots[0]
    const fetcher = fetchMock(async (url, options) => {
      expect(options).toMatchObject({
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
      })
      return new URL(String(url), 'https://tanstack.com').searchParams.get(
        'metadata',
      ) === '1'
        ? Response.json(record)
        : new Response(f.bytes)
    })
    const api = transport(fetcher)
    expect(await api.projectSnapshot(record.snapshotId)).toEqual(record)
    expect(await api.snapshotBytes(record)).toEqual(f.bytes)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('rejects wrong-scope metadata, corrupted bytes and oversized response headers', async () => {
    const f = await savedProject(),
      record = f.publish().savedSnapshots[0]
    await expect(
      transport(
        fetchMock(async () =>
          Response.json({
            ...record,
            identity: { ...identity, conversationId: 'other' },
          }),
        ),
      ).projectSnapshot(record.snapshotId),
    ).rejects.toBeInstanceOf(ExecutionHttpError)
    const changed = f.bytes.slice()
    changed[changed.length - 1] ^= 1
    await expect(
      transport(fetchMock(async () => new Response(changed))).snapshotBytes(
        record,
      ),
    ).rejects.toThrow('recorded bytes')
    const cancelled = vi.fn()
    const body = new ReadableStream({ cancel: cancelled })
    await expect(
      transport(
        fetchMock(
          async () =>
            new Response(body, {
              headers: {
                'Content-Length': String(maxProjectSnapshotBytes + 1),
              },
            }),
        ),
      ).snapshotBytes(record),
    ).rejects.toThrow('size limit')
    expect(cancelled).toHaveBeenCalledOnce()
  })
  it('does not dispatch mismatched upload bytes or allow a secret to reach a different scope', async () => {
    const f = await savedProject(),
      fetcher = fetchMock(async () => Response.json(f.publish()))
    const bytes = f.bytes.slice()
    bytes[bytes.length - 1] ^= 1
    await expect(
      transport(fetcher).uploadSnapshot(f.upload, bytes),
    ).rejects.toThrow('metadata')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
