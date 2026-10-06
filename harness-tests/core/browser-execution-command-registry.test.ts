import { createHash, randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  ConfirmedExecutionFailure,
  ExecutionCommandRegistry,
  UnknownExecutionOutcome,
  type ExecutionCommandAdapter,
} from '../../src/chat/client/execution-command-registry'
import {
  executionBridgeRequestSchema,
  executionBridgeResponseSchema,
  executionConnectSchema,
  executionDeliverySchema,
  type ExecutionDelivery,
} from '../../src/chat/core/execution-bridge'
import {
  browserExecutionRuntime,
  type ExecutionOperation,
  type ExecutionResult,
} from '../../src/chat/core/execution-sessions'
import {
  encodeProjectSnapshot,
  inspectProjectSnapshot,
} from '../../src/chat/core/execution-project-snapshot'

const scope = {
  sessionId: randomUUID(),
  runtimeId: randomUUID(),
  hostGeneration: 1,
}
const hash = (text: string) => createHash('sha256').update(text).digest('hex')
function delivery(
  operation: ExecutionOperation = {
    type: 'read_file',
    path: '/project/readme.txt',
  },
): ExecutionDelivery {
  return {
    id: randomUUID(),
    ...scope,
    digest: hash(JSON.stringify(operation)),
    origin: { kind: 'user' },
    operation,
    state: 'dispatched',
    stopRequested: false,
    createdAt: 1,
    dispatchedAt: 2,
    ...(operation.type === 'spawn' ? { processId: randomUUID() } : {}),
    ...(operation.type === 'preview_open' ? { previewId: randomUUID() } : {}),
  }
}
const readResult = (text = 'hello'): ExecutionResult => ({
  type: 'read_file',
  text,
  byteLength: Buffer.byteLength(text),
  sha256: hash(text),
})
const closed: ExecutionResult = { type: 'close', shutdownAcknowledged: true }
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function adapter(
  execute: ExecutionCommandAdapter['execute'] = async () => readResult(),
) {
  return { execute: vi.fn(execute), close: vi.fn(async () => {}) }
}

describe('committed browser execution registry', () => {
  it('registers before synchronous adapter code and reuses the same pending and settled promise', async () => {
    const item = delivery()
    const pending = deferred<ExecutionResult>()
    let recursive: ReturnType<ExecutionCommandRegistry['execute']> | undefined
    const sdk = adapter(() => {
      recursive = registry.execute({
        ...item,
        state: 'running',
        stopRequested: true,
      })
      return pending.promise
    })
    const registry = new ExecutionCommandRegistry(scope, sdk)
    const first = registry.execute(item)
    expect(recursive).toBe(first)
    expect(registry.execute(item)).toBe(first)
    expect(sdk.execute).toHaveBeenCalledTimes(1)
    pending.resolve(readResult())
    expect(await first).toMatchObject({
      commandId: item.id,
      digest: item.digest,
      outcome: 'succeeded',
    })
    expect(registry.execute(item)).toBe(first)
  })

  it('rejects a changed payload even with the same claimed digest and command ID', async () => {
    const sdk = adapter()
    const registry = new ExecutionCommandRegistry(scope, sdk)
    const item = delivery()
    await registry.execute(item)
    for (const changed of [
      { ...item, operation: { type: 'read_file', path: '/project/other.txt' } },
      { ...item, digest: hash('forged') },
      { ...item, dispatchedAt: 3 },
    ])
      await expect(registry.execute(changed)).rejects.toMatchObject({
        code: 'COMMAND_CONFLICT',
      })
    expect(sdk.execute).toHaveBeenCalledTimes(1)
  })

  it('rejects another session, generation, or runtime before adapter invocation', async () => {
    const sdk = adapter()
    const registry = new ExecutionCommandRegistry(scope, sdk)
    for (const changed of [
      { sessionId: randomUUID() },
      { runtimeId: randomUUID() },
      { hostGeneration: 2 },
    ])
      await expect(
        registry.execute({ ...delivery(), ...changed }),
      ).rejects.toMatchObject({ code: 'WRONG_RUNTIME' })
    expect(sdk.execute).not.toHaveBeenCalled()
  })

  it('accepts only dispatched receipts with exact reserved handle fields and bounded UTF-8 arguments', async () => {
    const sdk = adapter()
    const registry = new ExecutionCommandRegistry(scope, sdk)
    const item = delivery()
    for (const malformed of [
      { ...item, state: 'queued' },
      { ...item, dispatchedAt: undefined },
      { ...item, leaseProof: 'secret' },
      { ...item, processId: randomUUID() },
      {
        ...item,
        operation: {
          type: 'write_file',
          path: '/project/f.txt',
          text: '界'.repeat(3000),
        },
      },
      {
        ...delivery({
          type: 'spawn',
          command: 'node',
          args: [],
          cwd: '/project',
          timeoutMs: 1000,
        }),
        processId: undefined,
      },
      {
        ...delivery({
          type: 'preview_open',
          processId: randomUUID(),
          port: 3000,
          path: '/',
        }),
        previewId: undefined,
      },
    ])
      await expect(registry.execute(malformed)).rejects.toMatchObject({
        code: 'INVALID_DELIVERY',
      })
    expect(sdk.execute).not.toHaveBeenCalled()
  })

  it('clones and freezes arguments before invoking the adapter', async () => {
    const pending = deferred<ExecutionResult>()
    const sdk = adapter(() => pending.promise)
    const registry = new ExecutionCommandRegistry(scope, sdk)
    const item = delivery()
    const first = registry.execute(item)
    item.operation = { type: 'read_file', path: '/project/changed.txt' }
    const dispatched = sdk.execute.mock.calls[0][0]
    expect(dispatched.operation).toEqual({
      type: 'read_file',
      path: '/project/readme.txt',
    })
    expect(Object.isFrozen(dispatched.operation)).toBe(true)
    pending.resolve(readResult())
    const outcome = await first
    expect(Object.isFrozen(outcome)).toBe(true)
    if (outcome.outcome === 'succeeded')
      expect(Object.isFrozen(outcome.result)).toBe(true)
  })

  it('allows an urgent stop during ordinary work but rejects a second stop for the same process', async () => {
    const pending = deferred<ExecutionResult>()
    const processId = randomUUID()
    const stop = delivery({ type: 'stop_process', processId })
    const sdk = adapter(async (item) =>
      item.operation.type === 'stop_process'
        ? {
            type: 'stop_process',
            processId,
            exitCode: 0,
            signal: null,
            outputDrained: true,
            disposed: true,
          }
        : pending.promise,
    )
    const registry = new ExecutionCommandRegistry(scope, sdk)
    const ordinary = registry.execute(delivery())
    await expect(registry.execute(delivery())).rejects.toMatchObject({
      code: 'COMMAND_IN_FLIGHT',
    })
    const stopping = registry.execute(stop)
    expect(registry.execute(stop)).toBe(stopping)
    await expect(
      registry.execute(delivery({ type: 'stop_process', processId })),
    ).rejects.toMatchObject({ code: 'STOP_ALREADY_REGISTERED' })
    expect((await stopping).outcome).toBe('succeeded')
    pending.resolve(readResult())
    expect((await ordinary).outcome).toBe('succeeded')
  })

  it('fences immediately on Close and never treats a late write as a confirmed result', async () => {
    const pending = deferred<ExecutionResult>()
    const text = '\ufeffline\r\n'
    const sdk = adapter(async (item) =>
      item.operation.type === 'close' ? closed : pending.promise,
    )
    const registry = new ExecutionCommandRegistry(scope, sdk)
    const write = delivery({ type: 'write_file', path: '/project/f.txt', text })
    const writing = registry.execute(write)
    const close = delivery({ type: 'close' })
    expect(registry.isClosing).toBe(false)
    await expect(
      registry.execute({ ...close, state: 'queued' }),
    ).rejects.toMatchObject({ code: 'INVALID_DELIVERY' })
    expect(registry.isClosing).toBe(false)
    const closing = registry.execute(close)
    expect(registry.isClosing).toBe(true)
    await expect(registry.execute(delivery())).rejects.toMatchObject({
      code: 'RUNTIME_CLOSING',
    })
    expect((await closing).outcome).toBe('succeeded')
    pending.resolve({
      type: 'write_file',
      byteLength: Buffer.byteLength(text),
      sha256: hash(text),
    })
    expect(await writing).toMatchObject({
      outcome: 'unknown',
      error: { code: 'CLOSED_DURING_OPERATION' },
    })
    expect(registry.execute(write)).toBe(writing)
    expect(registry.execute(close)).toBe(closing)
    expect(await registry.shutdown()).toEqual({ confirmed: true })
    expect(sdk.close).not.toHaveBeenCalled()
    expect(sdk.execute).toHaveBeenCalledTimes(2)
  })

  it('permits new work after confirmed failure but fences unknown errors without leaking SDK error text', async () => {
    const sdk = adapter()
    sdk.execute.mockRejectedValueOnce(
      new ConfirmedExecutionFailure('NOT_FOUND', 'The file was not found.'),
    )
    const registry = new ExecutionCommandRegistry(scope, sdk)
    expect(await registry.execute(delivery())).toMatchObject({
      outcome: 'failed',
      error: { code: 'NOT_FOUND' },
    })
    expect((await registry.execute(delivery())).outcome).toBe('succeeded')
    sdk.execute.mockRejectedValueOnce(
      new DOMException('Authorization: Bearer private-value', 'AbortError'),
    )
    const outcome = await registry.execute(delivery())
    expect(outcome.outcome).toBe('unknown')
    expect(JSON.stringify(outcome)).not.toContain('private-value')
    await expect(registry.execute(delivery())).rejects.toMatchObject({
      code: 'OUTCOME_UNKNOWN',
    })
    sdk.execute.mockResolvedValueOnce(closed)
    expect((await registry.execute(delivery({ type: 'close' }))).outcome).toBe(
      'succeeded',
    )
  })

  it('retains an explicit unknown outcome and allows only shutdown afterward', async () => {
    const sdk = adapter(async () => {
      throw new UnknownExecutionOutcome(
        'WRITE_TIMEOUT',
        'The write did not settle.',
      )
    })
    const registry = new ExecutionCommandRegistry(scope, sdk)
    const item = delivery({
      type: 'write_file',
      path: '/project/f.txt',
      text: 'a',
    })
    const attempt = registry.execute(item)
    expect(await attempt).toMatchObject({
      outcome: 'unknown',
      error: { code: 'WRITE_TIMEOUT' },
    })
    expect(registry.execute(item)).toBe(attempt)
    await expect(
      registry.execute(
        delivery({ type: 'stop_process', processId: randomUUID() }),
      ),
    ).rejects.toMatchObject({ code: 'OUTCOME_UNKNOWN' })
    const first = registry.shutdown()
    expect(registry.shutdown()).toBe(first)
    expect(await first).toEqual({ confirmed: true })
    expect(sdk.close).toHaveBeenCalledTimes(1)
  })

  it('fences malformed results and mismatched operation, process, preview, or byte evidence', async () => {
    const spawn = delivery({
      type: 'spawn',
      command: 'node',
      args: [],
      cwd: '/project',
      timeoutMs: 1000,
    })
    const preview = delivery({
      type: 'preview_open',
      processId: randomUUID(),
      port: 3000,
      path: '/',
    })
    const inspect = delivery({
      type: 'preview_inspect',
      previewId: randomUUID(),
    })
    const cases: Array<[ExecutionDelivery, unknown]> = [
      [delivery(), { ...readResult(), leaseProof: 'secret' }],
      [delivery(), closed],
      [delivery(), { ...readResult(), byteLength: 0 }],
      [delivery(), { ...readResult(), sha256: hash('wrong') }],
      [
        spawn,
        { type: 'spawn', processId: randomUUID(), pid: 1, status: 'running' },
      ],
      [
        preview,
        {
          type: 'preview_open',
          processId: randomUUID(),
          previewId: preview.previewId,
          title: '',
          text: '',
          truncated: false,
        },
      ],
      [
        inspect,
        {
          type: 'preview_inspect',
          previewId: randomUUID(),
          title: '',
          text: '',
          truncated: false,
        },
      ],
    ]
    for (const [item, value] of cases) {
      const sdk = adapter(async () => value as ExecutionResult)
      const registry = new ExecutionCommandRegistry(scope, sdk)
      expect(await registry.execute(item)).toMatchObject({
        outcome: 'unknown',
        error: { code: 'INVALID_RESULT' },
      })
      await expect(registry.execute(delivery())).rejects.toMatchObject({
        code: 'OUTCOME_UNKNOWN',
      })
    }
  })

  it('accepts exact reserved process and preview handles and exact UTF-8 file receipts', async () => {
    const spawn = delivery({
      type: 'spawn',
      command: 'node',
      args: [],
      cwd: '/project',
      timeoutMs: 1000,
    })
    const preview = delivery({
      type: 'preview_open',
      processId: spawn.processId!,
      port: 3000,
      path: '/',
    })
    const text = '\ufefffirst\r\n界😀\n'
    const sdk = adapter(async (item) => {
      if (item.operation.type === 'spawn')
        return {
          type: 'spawn',
          processId: item.processId!,
          pid: 42,
          status: 'running',
        }
      if (item.operation.type === 'preview_open')
        return {
          type: 'preview_open',
          previewId: item.previewId!,
          processId: item.operation.processId,
          title: 'App',
          text: 'Ready',
          truncated: false,
        }
      if (item.operation.type === 'write_file')
        return {
          type: 'write_file',
          byteLength: Buffer.byteLength(text),
          sha256: hash(text),
        }
      return readResult(text)
    })
    const registry = new ExecutionCommandRegistry(scope, sdk)
    for (const item of [
      spawn,
      preview,
      delivery({ type: 'write_file', path: '/project/f.txt', text }),
      delivery(),
    ])
      expect((await registry.execute(item)).outcome).toBe('succeeded')
  })

  it('retains a failed command close for later shutdown without invoking cleanup twice', async () => {
    const sdk = adapter(async () => {
      throw new UnknownExecutionOutcome(
        'CLOSE_TIMEOUT',
        'Shutdown did not settle.',
      )
    })
    const registry = new ExecutionCommandRegistry(scope, sdk)
    expect((await registry.execute(delivery({ type: 'close' }))).outcome).toBe(
      'unknown',
    )
    const first = registry.shutdown()
    expect(registry.shutdown()).toBe(first)
    expect(await first).toEqual({
      confirmed: false,
      error: { code: 'CLOSE_TIMEOUT', message: 'Shutdown did not settle.' },
    })
    expect(sdk.close).not.toHaveBeenCalled()
  })

  it('registers direct shutdown before adapter cleanup and keeps its first rejection', async () => {
    const sdk = adapter()
    const pending = deferred<void>()
    let recursive: ReturnType<ExecutionCommandRegistry['shutdown']> | undefined
    sdk.close.mockImplementation(() => {
      recursive = registry.shutdown()
      return pending.promise
    })
    const registry = new ExecutionCommandRegistry(scope, sdk)
    const first = registry.shutdown()
    expect(recursive).toBe(first)
    await expect(registry.execute(delivery())).rejects.toMatchObject({
      code: 'RUNTIME_CLOSING',
    })
    pending.reject(new Error('private SDK detail'))
    expect(await first).toMatchObject({
      confirmed: false,
      error: { code: 'OUTCOME_UNKNOWN' },
    })
    expect(registry.shutdown()).toBe(first)
    expect(sdk.close).toHaveBeenCalledTimes(1)
  })

  it('keeps all receipts and reserves capacity for Close after the ordinary limit', async () => {
    const sdk = adapter(async (item) =>
      item.operation.type === 'close' ? closed : readResult(),
    )
    const registry = new ExecutionCommandRegistry(scope, sdk)
    const first = delivery()
    const original = registry.execute(first)
    await original
    for (let index = 1; index < 30; index++) await registry.execute(delivery())
    await expect(registry.execute(delivery())).rejects.toMatchObject({
      code: 'COMMAND_LIMIT',
    })
    expect(registry.execute(first)).toBe(original)
    expect((await registry.execute(delivery({ type: 'close' }))).outcome).toBe(
      'succeeded',
    )
    expect(sdk.execute).toHaveBeenCalledTimes(31)
  })
})

describe('bounded execution bridge protocol', () => {
  it('carries only the public scope and pinned runtime, rejecting lease or cookie fields', () => {
    const connect = {
      type: 'gum-execution-connect',
      version: 1,
      nonce: randomUUID(),
      ...scope,
      project: { source: 'trusted-fixture', digest: hash('fixture') },
    }
    expect(executionConnectSchema.safeParse(connect).success).toBe(true)
    expect(
      executionConnectSchema.safeParse({ ...connect, leaseProof: 'secret' })
        .success,
    ).toBe(false)
    expect(
      executionConnectSchema.safeParse({
        ...connect,
        cookies: 'session=secret',
      }).success,
    ).toBe(false)
    expect(
      executionBridgeResponseSchema.safeParse({
        type: 'ready',
        version: 1,
        nonce: connect.nonce,
        runtime: browserExecutionRuntime,
      }).success,
    ).toBe(true)
    const request = {
      type: 'execute',
      requestId: randomUUID(),
      delivery: delivery(),
    }
    expect(executionBridgeRequestSchema.safeParse(request).success).toBe(true)
    expect(
      executionBridgeRequestSchema.safeParse({ ...request, method: 'eval' })
        .success,
    ).toBe(false)
    expect(
      executionDeliverySchema.safeParse({
        ...request.delivery,
        completedAt: 10,
        result: readResult(),
      }).success,
    ).toBe(false)
  })

  it('bounds binary output without JSON conversion and distinguishes gaps, faults, and observed exits', () => {
    const output = {
      type: 'output',
      commandId: randomUUID(),
      sequence: 0,
      stream: 'stdout',
      bytes: new Uint8Array(16384),
    }
    expect(executionBridgeResponseSchema.safeParse(output).success).toBe(true)
    for (const bytes of [
      new Uint8Array(16385),
      new Uint8Array(0),
      [1, 2],
      'secret',
    ])
      expect(
        executionBridgeResponseSchema.safeParse({ ...output, bytes }).success,
      ).toBe(false)
    expect(
      executionBridgeResponseSchema.safeParse({
        type: 'output-gap',
        commandId: output.commandId,
        droppedBytes: 1,
      }).success,
    ).toBe(true)
    expect(
      executionBridgeResponseSchema.safeParse({
        type: 'output-gap',
        commandId: output.commandId,
        droppedBytes: 0,
      }).success,
    ).toBe(false)
    const exit = {
      type: 'process-exit',
      commandId: output.commandId,
      processId: randomUUID(),
      exitCode: 0,
      signal: null,
      outputDrained: true,
    }
    expect(executionBridgeResponseSchema.safeParse(exit).success).toBe(true)
    expect(
      executionBridgeResponseSchema.safeParse({ ...exit, exitCode: null })
        .success,
    ).toBe(false)
    expect(
      executionBridgeResponseSchema.safeParse({ ...exit, outputDrained: false })
        .success,
    ).toBe(false)
    expect(
      executionBridgeResponseSchema.safeParse({
        type: 'fault',
        error: {
          code: 'OUTPUT_LOST',
          message: 'Process output could not be drained.',
        },
      }).success,
    ).toBe(true)
  })

  it('does not allow success with an error, an unconfirmed close without evidence, or a fake result', () => {
    const base = {
      type: 'result',
      requestId: randomUUID(),
      commandId: randomUUID(),
      digest: hash('x'),
    }
    expect(
      executionBridgeResponseSchema.safeParse({
        ...base,
        outcome: 'succeeded',
        result: readResult(),
      }).success,
    ).toBe(true)
    expect(
      executionBridgeResponseSchema.safeParse({
        ...base,
        outcome: 'succeeded',
        result: readResult(),
        error: { code: 'X', message: 'X' },
      }).success,
    ).toBe(false)
    expect(
      executionBridgeResponseSchema.safeParse({
        ...base,
        outcome: 'unknown',
        result: readResult(),
      }).success,
    ).toBe(false)
    expect(
      executionBridgeResponseSchema.safeParse({
        type: 'shutdown-result',
        requestId: base.requestId,
        confirmed: false,
      }).success,
    ).toBe(false)
  })
})

describe('snapshot command identity', () => {
  it('rejects a save result that invents a different snapshot ID', async () => {
    const item = delivery({ type: 'save_snapshot' })
    const bytes = encodeProjectSnapshot({ version: 1, files: {} })
    const sdk = adapter(async () => ({
      type: 'save_snapshot',
      snapshotId: randomUUID(),
      ...(await inspectProjectSnapshot(bytes)),
    }))
    const registry = new ExecutionCommandRegistry(scope, sdk)
    expect(await registry.execute(item)).toMatchObject({
      outcome: 'unknown',
      error: { code: 'INVALID_RESULT' },
    })
    await expect(
      registry.readSnapshot(item.id, item.digest),
    ).rejects.toMatchObject({ code: 'SNAPSHOT_UNAVAILABLE' })
    expect(sdk.execute).toHaveBeenCalledOnce()
  })
  it('never recaptures when retained snapshot bytes no longer match the successful receipt', async () => {
    const item = delivery({ type: 'save_snapshot' })
    const original = encodeProjectSnapshot({
      version: 1,
      files: { '/project/a': new Uint8Array([1]) },
    })
    const changed = encodeProjectSnapshot({
      version: 1,
      files: { '/project/a': new Uint8Array([2]) },
    })
    const sdk = {
      ...adapter(async () => ({
        type: 'save_snapshot',
        snapshotId: item.id,
        ...(await inspectProjectSnapshot(original)),
      })),
      readSnapshot: vi.fn(async () => changed),
    }
    const registry = new ExecutionCommandRegistry(scope, sdk)
    expect(await registry.execute(item)).toMatchObject({ outcome: 'succeeded' })
    await expect(
      registry.readSnapshot(item.id, item.digest),
    ).rejects.toMatchObject({ code: 'SNAPSHOT_UNAVAILABLE' })
    expect(sdk.execute).toHaveBeenCalledOnce()
    expect(sdk.readSnapshot).toHaveBeenCalledWith(item.id, item.digest)
  })
})

const taskOrigin = {
  kind: 'run' as const,
  runId: 'run',
  taskId: 'task',
  messageId: 'message',
  taskGeneration: 1,
  modelPass: 1,
  toolCallId: 'call',
}
describe('model cancellation authority', () => {
  it('registers a stopped command before any SDK call and never replays it from a later stale delivery', async () => {
    const sdk = adapter(),
      registry = new ExecutionCommandRegistry(scope, sdk)
    const d = { ...delivery(), origin: taskOrigin }
    const stopped = registry.stopCommand({
      ...d,
      state: 'unknown',
      stopRequested: true,
    })
    expect(await stopped).toMatchObject({
      outcome: 'failed',
      error: { code: 'COMMAND_CANCELLED_BEFORE_START' },
    })
    expect(registry.execute(d)).toBe(stopped)
    expect(sdk.execute).not.toHaveBeenCalled()
    expect(sdk.close).not.toHaveBeenCalled()
  })
  it('rejects a changed task origin or a user command even with the same claimed digest', async () => {
    const pending = deferred<ExecutionResult>(),
      sdk = {
        ...adapter(() => pending.promise),
        stopCommand: vi.fn(async () => {}),
      },
      registry = new ExecutionCommandRegistry(scope, sdk)
    const d = { ...delivery(), origin: taskOrigin }
    const running = registry.execute(d)
    await expect(
      registry.stopCommand({
        ...d,
        origin: { ...taskOrigin, taskGeneration: 2 },
        stopRequested: true,
      }),
    ).rejects.toMatchObject({ code: 'COMMAND_CONFLICT' })
    await expect(
      registry.stopCommand({
        ...d,
        origin: { kind: 'user' },
        stopRequested: true,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_STOP' })
    expect(sdk.stopCommand).not.toHaveBeenCalled()
    registry.stopCommand({ ...d, stopRequested: true })
    registry.stopCommand({ ...d, state: 'unknown', stopRequested: true })
    pending.resolve(readResult())
    expect(await running).toMatchObject({ outcome: 'succeeded' })
    expect(sdk.stopCommand).toHaveBeenCalledOnce()
    expect(sdk.execute).toHaveBeenCalledOnce()
  })
})
