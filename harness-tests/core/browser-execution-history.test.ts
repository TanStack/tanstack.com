import { describe, expect, it, vi } from 'vitest'
import { readExecutionHistory } from '../../src/chat/client/execution-history'
import type { ExecutionHttp } from '../../src/chat/client/execution-http'
import { ExecutionHttpError } from '../../src/chat/client/execution-http'
import { decodeExecutionOutput } from '../../src/chat/components/ExecutionSessionEvidence'
import {
  encodeExecutionBytes,
  executionEventPageSchema,
  type ExecutionEvent,
  type ExecutionEventPage,
  type ExecutionEventSummary,
} from '../../src/chat/core/execution-events'
import { parseExecutionSnapshot } from '../../src/chat/core/execution-snapshot'
import {
  browserExecutionRuntime,
  type ExecutionIdentity,
  type ExecutionReceipt,
  type ExecutionSessionSnapshot,
} from '../../src/chat/core/execution-sessions'

const identity: ExecutionIdentity = {
  userId: 'user',
  workspaceId: 'workspace',
  botId: 'bot',
  conversationId: 'main',
}
const signal = () => new AbortController().signal
function totals(events: readonly ExecutionEvent[]): ExecutionEventSummary {
  return {
    lastSequence: events.at(-1)?.sequence ?? 0,
    outputBytes: events.reduce(
      (sum, event) =>
        sum +
        (event.type === 'output'
          ? Buffer.from(event.dataBase64, 'base64').length
          : 0),
      0,
    ),
    outputEvents: events.filter((event) => event.type === 'output').length,
    droppedBytes: events.reduce(
      (sum, event) =>
        sum + (event.type === 'output-gap' ? event.droppedBytes : 0),
      0,
    ),
  }
}

function fixture(text = '\ufeffcafé 🌱\r\n') {
  const sessionId = crypto.randomUUID(),
    runtimeId = crypto.randomUUID()
  const runId = crypto.randomUUID(),
    spawnId = crypto.randomUUID(),
    processId = crypto.randomUUID()
  const run: ExecutionReceipt = {
    id: runId,
    sessionId,
    runtimeId,
    hostGeneration: 1,
    digest: 'a'.repeat(64),
    origin: { kind: 'user' },
    operation: {
      type: 'run',
      command: 'node',
      args: [],
      cwd: '/project',
      timeoutMs: 30_000,
    },
    state: 'unknown',
    stopRequested: false,
    createdAt: 1,
    dispatchedAt: 2,
    completedAt: 3,
  }
  const spawn: ExecutionReceipt = {
    ...run,
    id: spawnId,
    processId,
    digest: 'b'.repeat(64),
    state: 'succeeded',
    operation: {
      ...run.operation,
      type: 'spawn',
    } as ExecutionReceipt['operation'],
    result: { type: 'spawn', processId, pid: 1, status: 'running' },
  }
  const output = (
    command: ExecutionReceipt,
    sequence: number,
    bytes: Uint8Array,
    stream: 'stdout' | 'stderr' = 'stdout',
  ): ExecutionEvent => ({
    type: 'output',
    sequence,
    commandId: command.id,
    digest: command.digest,
    ...(command.processId ? { processId: command.processId } : {}),
    stream,
    dataBase64: encodeExecutionBytes(bytes),
  })
  const bytes = new TextEncoder().encode(text)
  const events: ExecutionEvent[] = [
    output(run, 1, bytes.slice(0, 7)),
    output(run, 2, new TextEncoder().encode('warning\r\n'), 'stderr'),
    output(run, 3, bytes.slice(7)),
    output(spawn, 4, new Uint8Array([0xf0, 0x9f])),
    {
      type: 'output-gap',
      sequence: 5,
      commandId: spawnId,
      digest: spawn.digest,
      processId,
      droppedBytes: 3,
    },
    output(spawn, 6, new TextEncoder().encode('ready\r\n')),
    {
      type: 'process-exit',
      sequence: 7,
      commandId: spawnId,
      digest: spawn.digest,
      processId,
      exitCode: 0,
      signal: null,
      outputDrained: true,
    },
  ]
  const snapshot: ExecutionSessionSnapshot = {
    session: {
      id: sessionId,
      identity: { ...identity },
      version: 4,
      status: 'disconnected',
      runtimeId,
      hostGeneration: 1,
      ownerInstanceId: crypto.randomUUID(),
      authority: { lifecycleGeneration: 0, membershipGeneration: 0 },
      runtime: structuredClone(browserExecutionRuntime),
      project: { source: 'trusted-fixture', digest: 'c'.repeat(64) },
      createdAt: 0,
      updatedAt: 3,
    },
    commands: [run, spawn],
    processes: [
      {
        id: processId,
        sessionId,
        runtimeId,
        hostGeneration: 1,
        commandId: spawnId,
        pid: 1,
        state: 'exited',
        createdAt: 2,
        exit: { exitCode: 0, signal: null },
        stoppedBy: 'process_event',
      },
    ],
    events: totals(events),
    savedSnapshots: [],
    deferred: [],
  }
  parseExecutionSnapshot(snapshot, identity)
  return {
    snapshot,
    events,
    sessionId,
    runtimeId,
    runId,
    spawnId,
    processId,
    text,
  }
}
type Fixture = ReturnType<typeof fixture>
function page(f: Fixture, after: number, size = 3): ExecutionEventPage {
  const events = f.events.slice(after, after + size)
  const nextSequence = events.at(-1)?.sequence ?? after
  return executionEventPageSchema.parse({
    sessionId: f.sessionId,
    runtimeId: f.runtimeId,
    hostGeneration: 1,
    after,
    nextSequence,
    events,
    summary: totals(f.events),
    hasMore: nextSequence < f.events.length,
  })
}
function reader(f: Fixture) {
  return {
    session: vi.fn<ExecutionHttp['session']>(async () =>
      structuredClone(f.snapshot),
    ),
    events: vi.fn<ExecutionHttp['events']>(async (read) => page(f, read.after)),
  } satisfies Pick<ExecutionHttp, 'session' | 'events'>
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('read-only execution history loader', () => {
  it('keeps two same-conversation sessions and their output separate with read methods alone', async () => {
    const first = fixture('\ufefffirst session 🌱\r\n'),
      second = fixture('\ufeffsecond session 🌱\r\n')
    const fixtures = new Map<string, Fixture>(
      [first, second].map((f) => [f.sessionId, f]),
    )
    const http = {
      session: vi.fn<ExecutionHttp['session']>(async (id) =>
        structuredClone(fixtures.get(id)!.snapshot),
      ),
      events: vi.fn<ExecutionHttp['events']>(async (read) =>
        page(fixtures.get(read.sessionId)!, read.after),
      ),
    } satisfies Pick<ExecutionHttp, 'session' | 'events'>
    const results = await Promise.all(
      [first, second].map((f) =>
        readExecutionHistory(http, identity, f.sessionId, signal()),
      ),
    )
    for (const [index, f] of [first, second].entries()) {
      const result = results[index]
      expect(result.snapshot.session!.id).toBe(f.sessionId)
      expect(
        new Set(
          result.events.map((event) =>
            'commandId' in event ? event.commandId : undefined,
          ),
        ),
      ).toEqual(new Set([f.runId, f.spawnId]))
      expect(
        decodeExecutionOutput(result.events)
          .filter(
            (part) => part.commandId === f.runId && part.stream === 'stdout',
          )
          .map((part) => part.text)
          .join(''),
      ).toBe(f.text)
    }
    expect(Object.keys(http)).toEqual(['session', 'events'])
    expect(http.session).toHaveBeenCalledTimes(2)
    expect(http.events).toHaveBeenCalledTimes(6)
  })

  it('preserves split UTF-8, per-stream mapping, gaps and exit evidence across bounded pages', async () => {
    const f = fixture(),
      http = reader(f),
      abort = signal()
    const result = await readExecutionHistory(
      http,
      identity,
      f.sessionId,
      abort,
    )
    expect(http.session).toHaveBeenCalledWith(f.sessionId, abort)
    expect(http.events.mock.calls.map(([read]) => read)).toEqual(
      [0, 3, 6].map((after) => ({ sessionId: f.sessionId, after })),
    )
    for (const [, passedSignal] of http.events.mock.calls)
      expect(passedSignal).toBe(abort)
    const outputs = result.events.filter((event) => event.type === 'output')
    expect(
      outputs.map((event) => [
        event.sequence,
        event.commandId,
        event.stream,
        Array.from(event.bytes),
      ]),
    ).toEqual(
      f.events
        .filter((event) => event.type === 'output')
        .map((event) => [
          event.sequence,
          event.commandId,
          event.stream,
          Array.from(Buffer.from(event.dataBase64, 'base64')),
        ]),
    )
    expect(
      result.events.every(
        (event) => !('digest' in event) && !('dataBase64' in event),
      ),
    ).toBe(true)
    expect(result.events.at(-1)).toEqual({
      type: 'process-exit',
      commandId: f.spawnId,
      processId: f.processId,
      exitCode: 0,
      signal: null,
      outputDrained: true,
    })
    const parts = decodeExecutionOutput(result.events)
    expect(
      parts
        .filter(
          (part) => part.commandId === f.runId && part.stream === 'stdout',
        )
        .map((part) => part.text)
        .join(''),
    ).toBe(f.text)
    expect(
      parts
        .filter((part) => part.stream === 'stderr')
        .map((part) => part.text)
        .join(''),
    ).toBe('warning\r\n')
    expect(
      parts
        .filter((part) => part.commandId === f.spawnId)
        .map((part) => part.text)
        .join(''),
    ).toBe('ready\r\n')
    expect(result).toMatchObject({
      droppedBytes: 3,
      eventStatus: {
        persistedThrough: 7,
        receivedThrough: 7,
        pendingEvents: 0,
        loading: false,
      },
    })
  })

  it('returns an empty saved session without requesting output', async () => {
    const f = fixture()
    f.snapshot.commands = []
    f.snapshot.processes = []
    f.snapshot.events = totals([])
    const http = reader(f)
    const result = await readExecutionHistory(
      http,
      identity,
      f.sessionId,
      signal(),
    )
    expect(result.events).toEqual([])
    expect(result.eventStatus.receivedThrough).toBe(0)
    expect(http.events).not.toHaveBeenCalled()
  })

  it.each(['userId', 'workspaceId', 'botId', 'conversationId'] as const)(
    'rejects a saved session from another %s before reading output',
    async (key) => {
      const f = fixture(),
        http = reader(f)
      f.snapshot.session!.identity[key] = 'other'
      await expect(
        readExecutionHistory(http, identity, f.sessionId, signal()),
      ).rejects.toThrow()
      expect(http.events).not.toHaveBeenCalled()
    },
  )

  it('rejects a null or different same-conversation session before reading output', async () => {
    for (const variant of ['null', 'other']) {
      const f = fixture(),
        http = reader(f)
      if (variant === 'null') {
        f.snapshot.session = null
        f.snapshot.commands = []
        f.snapshot.processes = []
        f.snapshot.events = totals([])
      }
      await expect(
        readExecutionHistory(http, identity, crypto.randomUUID(), signal()),
      ).rejects.toThrow('does not match')
      expect(http.events).not.toHaveBeenCalled()
    }
  })

  it.each([
    'session',
    'generation',
    'runtime',
    'cursor',
    'command',
    'digest',
    'process',
    'sequence',
    'bytes',
    'size',
  ])(
    'rejects a malicious page with mismatched %s without returning partial evidence',
    async (kind) => {
      const f = fixture(),
        http = reader(f)
      const bad = page(f, 3)
      if (kind === 'session') bad.sessionId = crypto.randomUUID()
      if (kind === 'generation') bad.hostGeneration++
      if (kind === 'runtime') bad.runtimeId = crypto.randomUUID()
      if (kind === 'cursor') bad.after++
      if (kind === 'command') bad.events[0].commandId = crypto.randomUUID()
      if (kind === 'digest') bad.events[0].digest = 'd'.repeat(64)
      if (kind === 'process') bad.events[0].processId = crypto.randomUUID()
      if (kind === 'sequence') bad.events[0].sequence++
      if (kind === 'bytes' && bad.events[0].type === 'output')
        bad.events[0].dataBase64 = '***='
      if (kind === 'size') bad.events = Array(65).fill(bad.events[0])
      http.events.mockImplementation(async (read) =>
        read.after === 0 ? page(f, 0) : bad,
      )
      const publish = vi.fn()
      await expect(
        readExecutionHistory(http, identity, f.sessionId, signal()).then(
          publish,
        ),
      ).rejects.toThrow()
      expect(http.events).toHaveBeenCalledTimes(2)
      expect(publish).not.toHaveBeenCalled()
    },
  )

  it('rejects missing pages and false cumulative totals, including decreases after remote growth', async () => {
    for (const kind of ['stalled', 'short', 'over', 'decrease', 'dropped']) {
      const f = fixture(),
        http = reader(f)
      if (kind === 'short') f.snapshot.events.outputBytes++
      if (kind === 'over') f.snapshot.events.outputBytes--
      if (kind === 'dropped') f.snapshot.events.droppedBytes++
      http.events.mockImplementation(async (read) => {
        const value = page(f, read.after)
        if (kind === 'stalled' && read.after > 0) {
          value.events = []
          value.nextSequence = read.after
        }
        if (kind === 'short') value.summary.outputBytes++
        if (kind === 'dropped') value.summary.droppedBytes++
        if (kind === 'decrease' && read.after === 0) value.summary.outputBytes++
        return value
      })
      await expect(
        readExecutionHistory(http, identity, f.sessionId, signal()),
      ).rejects.toThrow()
      expect(http.events.mock.calls.length).toBeLessThanOrEqual(3)
    }
  })

  it('stops at the initial snapshot watermark when later output and new commands arrive', async () => {
    const f = fixture(),
      http = reader(f)
    f.events.push({
      type: 'output',
      sequence: 8,
      commandId: crypto.randomUUID(),
      digest: 'e'.repeat(64),
      stream: 'stdout',
      dataBase64: Buffer.from('new command').toString('base64'),
    })
    http.events.mockImplementation(async (read) => page(f, read.after, 64))
    const result = await readExecutionHistory(
      http,
      identity,
      f.sessionId,
      signal(),
    )
    expect(http.events).toHaveBeenCalledOnce()
    expect(result.events).toHaveLength(7)
    expect(result.snapshot.events.lastSequence).toBe(7)
    expect(result.eventStatus.receivedThrough).toBe(7)
    expect(
      decodeExecutionOutput(result.events).some((part) =>
        part.text.includes('new command'),
      ),
    ).toBe(false)
  })

  it('makes no read after cancellation before the first request', async () => {
    const f = fixture(),
      http = reader(f),
      abort = new AbortController()
    abort.abort()
    await expect(
      readExecutionHistory(http, identity, f.sessionId, abort.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(http.session).not.toHaveBeenCalled()
    expect(http.events).not.toHaveBeenCalled()
  })

  it.each(['snapshot', 'last page'])(
    'does not publish a noncooperative late %s after abort',
    async (stage) => {
      const f = fixture(),
        http = reader(f),
        abort = new AbortController(),
        waiting = deferred<any>()
      if (stage === 'snapshot')
        http.session.mockImplementation(() => waiting.promise)
      else
        http.events.mockImplementation(async (read) =>
          read.after === 6 ? waiting.promise : page(f, read.after),
        )
      const publish = vi.fn()
      const result = readExecutionHistory(
        http,
        identity,
        f.sessionId,
        abort.signal,
      ).then(publish)
      await vi.waitFor(() =>
        expect(
          stage === 'snapshot' ? http.session : http.events,
        ).toHaveBeenCalledTimes(stage === 'snapshot' ? 1 : 3),
      )
      abort.abort()
      waiting.resolve(stage === 'snapshot' ? f.snapshot : page(f, 6))
      await expect(result).rejects.toMatchObject({ name: 'AbortError' })
      expect(publish).not.toHaveBeenCalled()
      if (stage === 'snapshot') expect(http.events).not.toHaveBeenCalled()
    },
  )

  it.each([401, 403, 404])(
    'rejects the whole read on an output-page %s',
    async (status) => {
      const f = fixture(),
        http = reader(f),
        error = new ExecutionHttpError(status, 'Access unavailable.', false)
      http.events.mockImplementation(async (read) => {
        if (read.after > 0) throw error
        return page(f, read.after)
      })
      const publish = vi.fn()
      await expect(
        readExecutionHistory(http, identity, f.sessionId, signal()).then(
          publish,
        ),
      ).rejects.toBe(error)
      expect(publish).not.toHaveBeenCalled()
      expect(http.events).toHaveBeenCalledTimes(2)
    },
  )
})
