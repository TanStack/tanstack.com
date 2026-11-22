import { createHash, randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  openExecutionBrowserBridge,
  type ExecutionHostEvent,
} from '../../src/chat/client/execution-browser-bridge'
import {
  browserExecutionRuntime,
  type ExecutionOperation,
} from '../../src/chat/core/execution-sessions'
import type {
  ExecutionBridgeConnect,
  ExecutionDelivery,
} from '../../src/chat/core/execution-bridge'
import {
  encodeProjectSnapshot,
  inspectProjectSnapshot,
  maxProjectSnapshotBytes,
} from '../../src/chat/core/execution-project-snapshot'

const hash = (text: string) => createHash('sha256').update(text).digest('hex')
class Port {
  onmessage: ((event: { data: unknown }) => void) | null = null
  onmessageerror: (() => void) | null = null
  sent: any[] = []
  closed = false
  throwOnPost = false
  start = vi.fn()
  postMessage(value: unknown) {
    if (this.throwOnPost) throw new Error('secret transport detail')
    this.sent.push(structuredClone(value))
  }
  close() {
    this.closed = true
  }
  receive(data: unknown) {
    this.onmessage?.({ data })
  }
}
class Channel {
  static all: Channel[] = []
  port1 = new Port()
  port2 = new Port()
  constructor() {
    Channel.all.push(this)
  }
}
class Frame extends EventTarget {
  credentialless = false
  title = ''
  referrerPolicy = ''
  style: Record<string, string> = {}
  attributes: Record<string, string> = {}
  removed = false
  configuredBeforeSrc = false
  private source = ''
  contentWindow = { postMessage: vi.fn() }
  set src(value: string) {
    this.configuredBeforeSrc = this.credentialless
    this.source = value
  }
  get src() {
    return this.source
  }
  setAttribute(key: string, value: string) {
    this.attributes[key] = value
  }
  remove() {
    this.removed = true
  }
}
let frames: Frame[]
let appended: Frame[]
let supported: boolean
const connect = (): ExecutionBridgeConnect => ({
  type: 'gum-execution-connect',
  version: 1,
  nonce: randomUUID(),
  sessionId: randomUUID(),
  runtimeId: randomUUID(),
  hostGeneration: 1,
  project: { source: 'trusted-fixture', digest: hash('fixture') },
})
function delivery(
  config: ExecutionBridgeConnect,
  operation: ExecutionOperation = { type: 'read_file', path: '/project/a.txt' },
): ExecutionDelivery {
  return {
    id: randomUUID(),
    sessionId: config.sessionId,
    runtimeId: config.runtimeId,
    hostGeneration: config.hostGeneration,
    digest: hash(JSON.stringify(operation)),
    origin: { kind: 'user' },
    operation,
    state: 'dispatched',
    stopRequested: false,
    createdAt: 1,
    dispatchedAt: 2,
    ...(operation.type === 'spawn' ? { processId: randomUUID() } : {}),
  }
}
const textResult = {
  type: 'read_file',
  text: 'a',
  byteLength: 1,
  sha256: hash('a'),
}
function begin(config = connect()) {
  const controller = new AbortController()
  const events: ExecutionHostEvent[] = []
  const opening = openExecutionBrowserBridge(
    config,
    (event) => events.push(event),
    controller.signal,
    {
      append: (frame: Frame) => appended.push(frame),
    } as unknown as HTMLElement,
  )
  const frame = frames.at(-1)!
  const channel = Channel.all.at(-1)!
  return {
    config,
    controller,
    events,
    opening,
    frame,
    port: channel?.port1,
    channel,
  }
}
async function opened() {
  const state = begin()
  state.frame.dispatchEvent(new Event('load'))
  state.port.receive({
    type: 'ready',
    version: 1,
    nonce: state.config.nonce,
    runtime: browserExecutionRuntime,
  })
  return { ...state, bridge: await state.opening }
}
function respond(
  port: Port,
  index = 0,
  overrides: Record<string, unknown> = {},
) {
  const request = port.sent[index]
  port.receive({
    type: 'result',
    requestId: request.requestId,
    commandId: request.delivery.id,
    digest: request.delivery.digest,
    outcome: 'succeeded',
    result: textResult,
    ...overrides,
  })
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv('DEV', true)
  frames = []
  appended = []
  supported = true
  Channel.all = []
  vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:3002' } })
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      expect(tag).toBe('iframe')
      const frame = new Frame()
      if (!supported) delete (frame as Partial<Frame>).credentialless
      frames.push(frame)
      return frame
    },
  })
  vi.stubGlobal('MessageChannel', Channel)
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('parent browser execution bridge', () => {
  it('sets credentialless before navigation and transfers only public connection data to the exact loaded origin', async () => {
    const state = begin()
    expect(appended).toEqual([state.frame])
    expect(state.frame.configuredBeforeSrc).toBe(true)
    expect(state.frame.attributes.sandbox).toBe(
      'allow-scripts allow-same-origin',
    )
    expect(state.frame.referrerPolicy).toBe('no-referrer')
    expect(state.frame.src).toBe(
      `http://127.0.0.1:4320/gum-broker.html?nonce=${state.config.nonce}`,
    )
    expect(state.frame.contentWindow.postMessage).not.toHaveBeenCalled()
    state.frame.dispatchEvent(new Event('load'))
    expect(
      state.frame.contentWindow.postMessage,
    ).toHaveBeenCalledExactlyOnceWith(state.config, 'http://127.0.0.1:4320', [
      state.channel.port2,
    ])
    state.port.receive({
      type: 'ready',
      version: 1,
      nonce: state.config.nonce,
      runtime: browserExecutionRuntime,
    })
    const bridge = await state.opening
    expect(bridge.runtime).toEqual(browserExecutionRuntime)
    const closing = bridge.shutdown()
    expect(bridge.shutdown()).toBe(closing)
    expect(state.port.closed).toBe(false)
    const request = state.port.sent[0]
    state.port.receive({
      type: 'shutdown-result',
      requestId: request.requestId,
      confirmed: true,
    })
    expect(await closing).toEqual({ confirmed: true })
    expect(state.port.closed).toBe(false)
    bridge.dispose()
    expect(state.port.closed).toBe(true)
    expect(state.frame.removed).toBe(true)
  })

  it('refuses production, a different owner origin, unsupported credentialless, and an already-aborted setup', async () => {
    vi.stubEnv('DEV', false)
    await expect(begin().opening).rejects.toMatchObject({
      code: 'HOST_UNAVAILABLE',
    })
    vi.stubEnv('DEV', true)
    vi.stubGlobal('window', { location: { origin: 'http://localhost:3002' } })
    await expect(begin().opening).rejects.toMatchObject({
      code: 'HOST_UNAVAILABLE',
    })
    vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:3002' } })
    supported = false
    await expect(begin().opening).rejects.toMatchObject({
      code: 'CREDENTIALLESS_UNAVAILABLE',
    })
    const controller = new AbortController()
    controller.abort()
    await expect(
      openExecutionBrowserBridge(
        connect(),
        () => {},
        controller.signal,
        {} as HTMLElement,
      ),
    ).rejects.toMatchObject({ code: 'SETUP_ABORTED' })
    expect(appended).toHaveLength(0)
    expect(Channel.all).toHaveLength(0)
  })

  it('rejects mismatched ready nonce, artifact, or a runtime missing capabilities', async () => {
    for (const change of [
      { nonce: randomUUID() },
      { runtime: { ...browserExecutionRuntime, apiVersion: 6 } },
      { runtime: { ...browserExecutionRuntime, capabilities: ['close'] } },
    ]) {
      const state = begin()
      const rejected = expect(state.opening).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      })
      state.frame.dispatchEvent(new Event('load'))
      state.port.receive({
        type: 'ready',
        version: 1,
        nonce: state.config.nonce,
        runtime: browserExecutionRuntime,
        ...change,
      })
      await rejected
      expect(state.frame.removed).toBe(true)
      expect(state.events[0]).toMatchObject({ type: 'fault' })
    }
  })

  it('bounds setup waiting and does not claim clean shutdown when readiness is lost', async () => {
    const state = begin()
    const rejected = expect(state.opening).rejects.toMatchObject({
      code: 'SETUP_TIMEOUT',
    })
    state.frame.dispatchEvent(new Event('load'))
    await vi.advanceTimersByTimeAsync(45_000)
    await rejected
    expect(state.frame.removed).toBe(true)
    expect(state.port.closed).toBe(true)
    expect(state.events).toEqual([
      {
        type: 'fault',
        error: {
          code: 'SETUP_TIMEOUT',
          message: expect.stringContaining('Cleanup is not confirmed'),
        },
      },
    ])
  })

  it('caches a command promise and rejects changed or cross-runtime delivery without another message', async () => {
    const state = await opened()
    const item = delivery(state.config)
    const first = state.bridge.execute(item)
    expect(state.bridge.execute({ ...item, state: 'running' })).toBe(first)
    await expect(
      state.bridge.execute({
        ...item,
        operation: { type: 'read_file', path: '/project/b.txt' },
      }),
    ).rejects.toMatchObject({ code: 'COMMAND_CONFLICT' })
    await expect(
      state.bridge.execute({ ...item, runtimeId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'WRONG_RUNTIME' })
    expect(state.port.sent).toHaveLength(1)
    respond(state.port)
    expect(await first).toMatchObject({
      outcome: 'succeeded',
      result: textResult,
    })
    expect(state.bridge.execute(item)).toBe(first)
    state.bridge.dispose()
  })

  it('fences mismatched command, digest, operation, and reserved process results as unknown', async () => {
    for (const overrides of [
      { commandId: randomUUID() },
      { digest: hash('wrong') },
      { result: { type: 'close', shutdownAcknowledged: true } },
      {
        result: {
          type: 'spawn',
          processId: randomUUID(),
          pid: 9,
          status: 'running',
        },
      },
    ]) {
      const state = await opened()
      const item =
        overrides.result?.type === 'spawn'
          ? delivery(state.config, {
              type: 'spawn',
              command: 'node',
              args: [],
              cwd: '/project',
              timeoutMs: 1000,
            })
          : delivery(state.config)
      const pending = state.bridge.execute(item)
      respond(state.port, 0, overrides)
      expect(await pending).toMatchObject({
        outcome: 'unknown',
        error: { code: 'INVALID_RESPONSE' },
      })
      await expect(
        state.bridge.execute(delivery(state.config)),
      ).rejects.toMatchObject({ code: 'BRIDGE_FENCED' })
      expect(state.events).toHaveLength(1)
      state.bridge.dispose()
    }
  })

  it('does not turn an RPC timeout into failure or upgrade its outcome on a late reply', async () => {
    const state = await opened()
    const item = delivery(state.config)
    const pending = state.bridge.execute(item)
    await vi.advanceTimersByTimeAsync(45_000)
    const outcome = await pending
    expect(outcome).toMatchObject({
      outcome: 'unknown',
      error: { code: 'COMMAND_TIMEOUT' },
    })
    respond(state.port)
    expect(await state.bridge.execute(item)).toBe(outcome)
    expect(state.port.sent).toHaveLength(1)
    expect(state.events).toHaveLength(1)
    state.bridge.dispose()
  })

  it('fences unknown Close and unrelated unknown errors even when shutdown is underway', async () => {
    for (const operation of ['close', 'read_file']) {
      const state = await opened()
      const pending = state.bridge.execute(
        delivery(
          state.config,
          operation === 'close'
            ? { type: 'close' }
            : { type: 'read_file', path: '/project/a.txt' },
        ),
      )
      const shuttingDown = state.bridge.shutdown()
      const request = state.port.sent[0]
      state.port.receive({
        type: 'result',
        requestId: request.requestId,
        commandId: request.delivery.id,
        digest: request.delivery.digest,
        outcome: 'unknown',
        error: { code: 'OUTPUT_LOST', message: 'Output could not be drained.' },
      })
      expect((await pending).outcome).toBe('unknown')
      expect(state.events).toEqual([
        {
          type: 'fault',
          error: {
            code: 'OUTPUT_LOST',
            message: 'Output could not be drained.',
          },
        },
      ])
      state.bridge.dispose()
      await shuttingDown
    }
  })

  it('does not emit a spurious fault for a valid late ordinary unknown while Close is pending', async () => {
    const state = await opened()
    const work = state.bridge.execute(delivery(state.config))
    const close = state.bridge.execute(
      delivery(state.config, { type: 'close' }),
    )
    const first = state.port.sent[0]
    state.port.receive({
      type: 'result',
      requestId: first.requestId,
      commandId: first.delivery.id,
      digest: first.delivery.digest,
      outcome: 'unknown',
      error: {
        code: 'CLOSED_DURING_OPERATION',
        message: 'Shutdown began before confirmation.',
      },
    })
    expect((await work).outcome).toBe('unknown')
    expect(state.events).toHaveLength(0)
    respond(state.port, 1, {
      result: { type: 'close', shutdownAcknowledged: true },
    })
    expect((await close).outcome).toBe('succeeded')
    state.bridge.dispose()
  })

  it('retains shutdown timeout and does not retry or accept a late success', async () => {
    const state = await opened()
    const pending = state.bridge.shutdown()
    await vi.advanceTimersByTimeAsync(35_000)
    const outcome = await pending
    expect(outcome).toMatchObject({
      confirmed: false,
      error: { code: 'SHUTDOWN_TIMEOUT' },
    })
    state.port.receive({
      type: 'shutdown-result',
      requestId: state.port.sent[0].requestId,
      confirmed: true,
    })
    expect(state.bridge.shutdown()).toBe(pending)
    expect(await pending).toBe(outcome)
    expect(state.port.sent).toHaveLength(1)
    state.bridge.dispose()
  })

  it('disposes an interrupted setup with explicit uncertainty instead of accepting late readiness', async () => {
    const state = begin()
    const rejected = expect(state.opening).rejects.toMatchObject({
      code: 'SETUP_ABORTED',
    })
    state.frame.dispatchEvent(new Event('load'))
    state.controller.abort()
    await rejected
    expect(state.port.closed).toBe(true)
    expect(state.frame.removed).toBe(true)
    state.port.receive({
      type: 'ready',
      version: 1,
      nonce: state.config.nonce,
      runtime: browserExecutionRuntime,
    })
    expect(state.port.sent).toHaveLength(0)
  })

  it('attempts shutdown after an established owner abort and disposes only after its result', async () => {
    const state = await opened()
    const pending = state.bridge.execute(delivery(state.config))
    state.controller.abort()
    expect((await pending).outcome).toBe('unknown')
    expect(state.frame.removed).toBe(false)
    const request = state.port.sent.at(-1)
    expect(request.type).toBe('shutdown')
    state.port.receive({
      type: 'shutdown-result',
      requestId: request.requestId,
      confirmed: true,
    })
    expect(await state.bridge.shutdown()).toEqual({ confirmed: true })
    await Promise.resolve()
    expect(state.frame.removed).toBe(true)
  })

  it('forwards bounded output and exact process exit evidence without converting it into a durable result', async () => {
    const state = await opened()
    const item = delivery(state.config, {
      type: 'spawn',
      command: 'node',
      args: [],
      cwd: '/project',
      timeoutMs: 1000,
    })
    const pending = state.bridge.execute(item)
    const output = {
      type: 'output',
      commandId: item.id,
      processId: item.processId,
      sequence: 1,
      stream: 'stdout',
      bytes: new Uint8Array([1, 2, 3]),
    }
    state.port.receive(output)
    respond(state.port, 0, {
      result: {
        type: 'spawn',
        processId: item.processId,
        pid: 5,
        status: 'running',
      },
    })
    expect((await pending).outcome).toBe('succeeded')
    const exit = {
      type: 'process-exit',
      commandId: item.id,
      processId: item.processId,
      exitCode: 0,
      signal: null,
      outputDrained: true,
    }
    state.port.receive(exit)
    state.port.receive({
      type: 'output-gap',
      commandId: item.id,
      processId: item.processId,
      droppedBytes: 4,
    })
    expect(state.events).toEqual([
      output,
      exit,
      {
        type: 'output-gap',
        commandId: item.id,
        processId: item.processId,
        droppedBytes: 4,
      },
    ])
    state.bridge.dispose()
  })

  it('rejects oversized output backing buffers, foreign process events, repeated sequence, and deeply nested payloads', async () => {
    for (const variant of ['buffer', 'process', 'sequence', 'gap', 'nested']) {
      const state = await opened()
      const item = delivery(state.config, {
        type: 'spawn',
        command: 'node',
        args: [],
        cwd: '/project',
        timeoutMs: 1000,
      })
      const pending = state.bridge.execute(item)
      const output = {
        type: 'output',
        commandId: item.id,
        processId: item.processId,
        sequence: 1,
        stream: 'stdout',
        bytes: new Uint8Array([1]),
      }
      if (variant === 'buffer')
        state.port.receive({
          ...output,
          bytes: new Uint8Array(new ArrayBuffer(100_000), 0, 1),
        })
      if (variant === 'process')
        state.port.receive({ ...output, processId: randomUUID() })
      if (variant === 'sequence') {
        state.port.receive(output)
        state.port.receive(output)
      }
      if (variant === 'gap') state.port.receive({ ...output, sequence: 2 })
      if (variant === 'nested') {
        let nested: unknown = 'x'
        for (let depth = 0; depth < 100; depth++) nested = { nested }
        state.port.receive(nested)
      }
      expect(await pending).toMatchObject({
        outcome: 'unknown',
        error: { code: 'INVALID_RESPONSE' },
      })
      expect(state.events.at(-1)).toMatchObject({ type: 'fault' })
      state.bridge.dispose()
    }
  })

  it('fences unreadable ports, rejected commands, unsolicited replies, and repeated iframe loads', async () => {
    for (const variant of ['port', 'rejected', 'unknown-id', 'reload']) {
      const state = await opened()
      const pending = state.bridge.execute(delivery(state.config))
      if (variant === 'port') state.port.onmessageerror?.()
      if (variant === 'rejected')
        state.port.receive({
          type: 'rejected',
          requestId: state.port.sent[0].requestId,
          error: {
            code: 'COMMAND_CONFLICT',
            message: 'Already registered differently.',
          },
        })
      if (variant === 'unknown-id')
        respond(state.port, 0, { requestId: randomUUID() })
      if (variant === 'reload') state.frame.dispatchEvent(new Event('load'))
      expect((await pending).outcome).toBe('unknown')
      expect(state.events).toHaveLength(1)
      state.bridge.dispose()
    }
  })

  it('reserves a shutdown slot within the 32-call bound and never evicts accepted commands', async () => {
    const state = await opened()
    const pending = Array.from({ length: 31 }, () =>
      state.bridge.execute(delivery(state.config)),
    )
    await expect(
      state.bridge.execute(delivery(state.config)),
    ).rejects.toMatchObject({ code: 'COMMAND_LIMIT' })
    const shutdown = state.bridge.shutdown()
    expect(state.port.sent).toHaveLength(32)
    state.bridge.dispose()
    expect(
      (await Promise.all(pending)).every(
        (result) => result.outcome === 'unknown',
      ),
    ).toBe(true)
    expect((await shutdown).confirmed).toBe(false)
  })

  it('does not leak transport exceptions and settles an unsendable shutdown without waiting for a timer', async () => {
    const state = await opened()
    state.port.throwOnPost = true
    const pending = state.bridge.execute(delivery(state.config))
    expect(await pending).toMatchObject({
      outcome: 'unknown',
      error: { code: 'BRIDGE_SEND_FAILED' },
    })
    expect(JSON.stringify(state.events)).not.toContain(
      'secret transport detail',
    )
    expect(await state.bridge.shutdown()).toMatchObject({
      confirmed: false,
      error: { code: 'SHUTDOWN_UNAVAILABLE' },
    })
    state.bridge.dispose()
  })
})

describe('bounded project snapshot bridge', () => {
  it('allows a large snapshot only in its typed data envelope, retaining command and digest identity', async () => {
    const f = await opened(),
      item = delivery(f.config, { type: 'save_snapshot' })
    const bytes = encodeProjectSnapshot({
      version: 1,
      files: { '/project/binary': new Uint8Array(40_000).fill(255) },
    })
    const metadata = await inspectProjectSnapshot(bytes)
    const running = f.bridge.execute(item)
    respond(f.port, 0, {
      result: { type: 'save_snapshot', snapshotId: item.id, ...metadata },
    })
    await running
    const reading = f.bridge.readSnapshot(item.id, item.digest)
    const request = f.port.sent.at(-1)
    expect(request).toEqual({
      type: 'read_snapshot',
      requestId: expect.any(String),
      commandId: item.id,
      digest: item.digest,
    })
    f.port.receive({
      type: 'snapshot_data',
      requestId: request.requestId,
      commandId: item.id,
      digest: item.digest,
      bytes,
    })
    expect(await reading).toEqual(bytes)
    expect(f.events).toEqual([])
    f.bridge.dispose()
  })
  it('fences mismatched or oversized saved bytes, while ordinary output limits stay unchanged', async () => {
    const f = await opened(),
      item = delivery(f.config, { type: 'save_snapshot' })
    const bytes = encodeProjectSnapshot({ version: 1, files: {} })
    const running = f.bridge.execute(item)
    respond(f.port, 0, {
      result: {
        type: 'save_snapshot',
        snapshotId: item.id,
        ...(await inspectProjectSnapshot(bytes)),
      },
    })
    await running
    const reading = f.bridge.readSnapshot(item.id, item.digest)
    const rejection = expect(reading).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
    f.port.receive({
      type: 'snapshot_data',
      requestId: f.port.sent.at(-1).requestId,
      commandId: item.id,
      digest: item.digest,
      bytes: new Uint8Array(
        new ArrayBuffer(maxProjectSnapshotBytes + 1),
        0,
        20,
      ),
    })
    await rejection
    expect(f.events.at(-1)).toMatchObject({
      type: 'fault',
      error: { code: 'INVALID_RESPONSE' },
    })
    f.bridge.dispose()
  })
  it('transfers saved bytes only in explicit snapshot setup and keeps authentication out of the broker', async () => {
    const bytes = encodeProjectSnapshot({
      version: 1,
      files: { '/project/note': new Uint8Array([1]) },
    })
    const config: ExecutionBridgeConnect = {
      ...connect(),
      project: {
        source: 'snapshot',
        snapshotId: randomUUID(),
        digest: (await inspectProjectSnapshot(bytes)).sha256,
      },
      snapshotBytes: bytes,
    }
    const f = begin(config)
    f.frame.dispatchEvent(new Event('load'))
    expect(f.frame.contentWindow.postMessage).toHaveBeenCalledWith(
      config,
      'http://127.0.0.1:4320',
      [f.channel.port2, bytes.buffer],
    )
    expect(Object.keys(config)).not.toContain('leaseProof')
    f.port.receive({
      type: 'ready',
      version: 1,
      nonce: config.nonce,
      runtime: browserExecutionRuntime,
    })
    const bridge = await f.opening
    bridge.dispose()
  })
})

const modelTaskOrigin = {
  kind: 'run' as const,
  runId: 'run',
  taskId: 'task',
  messageId: 'message',
  taskGeneration: 1,
  modelPass: 1,
  toolCallId: 'call',
}
describe('model command stop bridge', () => {
  it('forwards one exact stopped envelope and keeps the original result promise and runtime', async () => {
    const f = await opened(),
      d = { ...delivery(f.config), origin: modelTaskOrigin }
    const running = f.bridge.execute(d)
    const stopped = { ...d, state: 'unknown' as const, stopRequested: true }
    expect(f.bridge.stopCommand(stopped)).toBe(running)
    expect(f.bridge.stopCommand(stopped)).toBe(running)
    expect(f.port.sent).toHaveLength(2)
    expect(f.port.sent[1]).toEqual({
      type: 'stop_command',
      requestId: expect.any(String),
      delivery: stopped,
    })
    respond(f.port, 1)
    expect(await running).toMatchObject({ outcome: 'succeeded' })
    expect(f.frame.removed).toBe(false)
    expect(f.events).toEqual([])
    f.bridge.dispose()
  })
  it('refuses a forged task generation and cannot selectively stop a user command', async () => {
    const f = await opened(),
      d = { ...delivery(f.config), origin: modelTaskOrigin }
    const running = f.bridge.execute(d)
    await expect(
      f.bridge.stopCommand({
        ...d,
        origin: { ...modelTaskOrigin, taskGeneration: 2 },
        stopRequested: true,
      }),
    ).rejects.toMatchObject({ code: 'COMMAND_CONFLICT' })
    await expect(
      f.bridge.stopCommand({
        ...d,
        origin: { kind: 'user' },
        stopRequested: true,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_STOP' })
    expect(f.port.sent).toHaveLength(1)
    respond(f.port)
    await running
    f.bridge.dispose()
  })
  it('sends a pre-start cancellation directly as a stop control and accepts only its original receipt', async () => {
    const f = await opened(),
      d = {
        ...delivery(f.config),
        origin: modelTaskOrigin,
        state: 'unknown' as const,
        stopRequested: true,
      }
    const stopping = f.bridge.stopCommand(d)
    expect(f.port.sent[0]).toMatchObject({ type: 'stop_command', delivery: d })
    f.port.receive({
      type: 'result',
      requestId: f.port.sent[0].requestId,
      commandId: d.id,
      digest: d.digest,
      outcome: 'failed',
      error: {
        code: 'COMMAND_CANCELLED_BEFORE_START',
        message: 'No SDK call was made.',
      },
    })
    expect(await stopping).toMatchObject({
      outcome: 'failed',
      error: { code: 'COMMAND_CANCELLED_BEFORE_START' },
    })
    f.bridge.dispose()
  })
})

describe('persistent preview frame presentation', () => {
  const bounds = {
    left: 200,
    top: 80,
    width: 400,
    height: 300,
    clip: { top: 20, right: 10, bottom: 30, left: 0 },
  }
  it('changes only geometry/accessibility on the same credentialless iframe and keeps messages unchanged', async () => {
    const f = await opened(),
      source = f.frame.src
    expect(f.frame.attributes['aria-hidden']).toBe('true')
    expect(f.frame.style.visibility).toBe('hidden')
    expect(f.frame.title).toBe('Local execution runtime')
    expect(f.bridge.setPreviewViewport(bounds)).toBe(true)
    expect(f.frame.title).toBe('Workspace preview')
    expect(f.frame.style.clipPath).toBe('inset(20px 10px 30px 0px)')
    expect(f.frame.attributes['aria-hidden']).toBe('false')
    expect((f.frame as unknown as HTMLIFrameElement).inert).toBe(false)
    f.bridge.setPreviewViewport(null)
    expect(f.frame.style.visibility).toBe('hidden')
    expect(f.frame.style.width).toBe('400px')
    expect(f.frame.style.height).toBe('300px')
    expect(f.frame.title).toBe('Local execution runtime')
    expect((f.frame as unknown as HTMLIFrameElement).inert).toBe(true)
    expect(f.bridge.setPreviewViewport({ ...bounds, width: 320 })).toBe(true)
    expect(f.frame.src).toBe(source)
    expect(f.frame.credentialless).toBe(true)
    expect(f.frame.removed).toBe(false)
    expect(frames).toHaveLength(1)
    expect(appended).toEqual([f.frame])
    expect(f.port.sent).toHaveLength(0)
    f.bridge.dispose()
  })
  it('fails closed for invalid geometry, fullscreen outside the host, shutdown and disposal', async () => {
    const f = await opened()
    for (const bad of [
      { ...bounds, width: NaN },
      { ...bounds, width: 0 },
      { ...bounds, clip: { ...bounds.clip, left: 500 } },
    ])
      expect(f.bridge.setPreviewViewport(bad)).toBe(false)
    Object.assign(document, { fullscreenElement: { contains: () => false } })
    expect(f.bridge.setPreviewViewport(bounds)).toBe(false)
    Object.assign(document, { fullscreenElement: { contains: () => true } })
    expect(f.bridge.setPreviewViewport(bounds)).toBe(true)
    const closing = f.bridge.shutdown()
    expect(f.frame.style.visibility).toBe('hidden')
    expect(f.bridge.setPreviewViewport(bounds)).toBe(false)
    f.port.receive({
      type: 'shutdown-result',
      requestId: f.port.sent.at(-1).requestId,
      confirmed: true,
    })
    await closing
    f.bridge.dispose()
    expect(f.bridge.setPreviewViewport(bounds)).toBe(false)
  })
})
