import type { SqlStorage } from '@cloudflare/workers-types'
import { createHash, randomBytes } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  browserExecutionRuntime,
  maxExecutionCommands,
  type ExecutionIdentity,
  type ExecutionResult,
  type ExecutionSessionCommand,
  type ExecutionSessionSnapshot,
  type ExecutionSnapshotUpload,
} from '../../src/chat/core/execution-sessions'
import type {
  ExecutionBridgeConnect,
  ExecutionCommandOutcome,
  ExecutionDelivery,
} from '../../src/chat/core/execution-bridge'
import { parseExecutionSnapshot } from '../../src/chat/core/execution-snapshot'
import {
  type ExecutionEventPage,
  type ExecutionEventRead,
} from '../../src/chat/core/execution-events'
import {
  ExecutionOwners,
  executionOwnerKey,
  trustedExecutionProject,
} from '../../src/chat/client/execution-owner'
import { ExecutionHttpError } from '../../src/chat/client/execution-http'
import type {
  ExecutionHostBridge,
  ExecutionHostEvent,
} from '../../src/chat/client/execution-browser-bridge'
import {
  ExecutionSessionError,
  ExecutionSessions,
} from '../../src/chat/server/execution-sessions'
import {
  encodeProjectSnapshot,
  inspectProjectSnapshot,
  type ProjectSnapshotRecord,
} from '../../src/chat/core/execution-project-snapshot'

const identity: ExecutionIdentity = {
  userId: 'account-a',
  workspaceId: 'workspace',
  botId: 'assistant',
  conversationId: 'private/conversation',
}
const hash = (text: string) => createHash('sha256').update(text).digest('hex')
const databases: DatabaseSync[] = []
const owners: ExecutionOwners[] = []
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
})
afterEach(async () => {
  for (const owner of owners.splice(0)) owner.shutdownAll()
  await Promise.resolve()
  await Promise.resolve()
  vi.clearAllTimers()
  vi.useRealTimers()
  for (const db of databases.splice(0)) db.close()
})
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function succeeded(
  delivery: ExecutionDelivery,
  result: ExecutionResult,
): ExecutionCommandOutcome {
  return {
    commandId: delivery.id,
    digest: delivery.digest,
    outcome: 'succeeded',
    result,
  }
}
function defaultResult(delivery: ExecutionDelivery): ExecutionResult {
  const operation = delivery.operation
  switch (operation.type) {
    case 'read_file':
      return {
        type: 'read_file',
        text: 'fixture',
        byteLength: 7,
        sha256: hash('fixture'),
      }
    case 'write_file':
      return {
        type: 'write_file',
        byteLength: Buffer.byteLength(operation.text),
        sha256: hash(operation.text),
      }
    case 'run':
      return { type: 'run', exitCode: 0, signal: null, durationMs: 1 }
    case 'spawn':
      return {
        type: 'spawn',
        processId: delivery.processId!,
        pid: 7,
        status: 'running',
      }
    case 'stop_process':
      return {
        type: 'stop_process',
        processId: operation.processId,
        exitCode: 0,
        signal: null,
        outputDrained: true,
        disposed: true,
      }
    case 'close':
      return { type: 'close', shutdownAcknowledged: true }
    case 'preview_open':
      return {
        type: 'preview_open',
        previewId: delivery.previewId!,
        processId: operation.processId,
        title: 'Fixture',
        text: 'Actual preview',
        truncated: false,
      }
    case 'preview_close':
      return {
        type: 'preview_close',
        previewId: operation.previewId,
        closed: true,
      }
    default:
      throw new Error('This fixture does not execute previews.')
  }
}
function fixture() {
  const scopes = new Map<
    string,
    { scope: ExecutionIdentity; store: ExecutionSessions }
  >()
  const calls: {
    identity: ExecutionIdentity
    input: ExecutionSessionCommand
    at: number
  }[] = []
  const bridges: {
    connect: ExecutionBridgeConnect
    bridge: ExecutionHostBridge
    execute: ReturnType<typeof vi.fn<ExecutionHostBridge['execute']>>
    stopCommand: ReturnType<typeof vi.fn<ExecutionHostBridge['stopCommand']>>
    shutdown: ReturnType<typeof vi.fn<ExecutionHostBridge['shutdown']>>
    dispose: ReturnType<typeof vi.fn>
    event: (event: ExecutionHostEvent) => void
    signal: AbortSignal
  }[] = []
  const controls: {
    command?: (
      scope: ExecutionIdentity,
      input: ExecutionSessionCommand,
      proceed: () => ExecutionSessionSnapshot,
    ) => Promise<ExecutionSessionSnapshot>
    snapshot?: (
      scope: ExecutionIdentity,
      proceed: () => ExecutionSessionSnapshot,
    ) => Promise<ExecutionSessionSnapshot>
    events?: (
      scope: ExecutionIdentity,
      read: ExecutionEventRead,
      proceed: () => ExecutionEventPage,
    ) => Promise<ExecutionEventPage>
    open?: (bridge: ExecutionHostBridge) => Promise<ExecutionHostBridge>
    execute?: (delivery: ExecutionDelivery) => Promise<ExecutionCommandOutcome>
    stopCommand?: (
      delivery: ExecutionDelivery,
    ) => Promise<ExecutionCommandOutcome>
    uploadSnapshot?: (
      input: ExecutionSnapshotUpload,
      bytes: Uint8Array,
      proceed: () => ExecutionSessionSnapshot,
    ) => Promise<ExecutionSessionSnapshot>
    snapshotBytes?: (
      record: ProjectSnapshotRecord,
      proceed: () => Uint8Array<ArrayBuffer>,
    ) => Promise<Uint8Array<ArrayBuffer>>
  } = {}
  const savedBytes = new Map<string, Uint8Array<ArrayBuffer>>()
  const projectBytes = encodeProjectSnapshot({
    version: 1,
    files: { '/project/bytes.bin': new Uint8Array([0, 255, 13, 10]) },
  })
  const record = (scope: ExecutionIdentity) => {
    const key = executionOwnerKey(scope)
    let found = scopes.get(key)
    if (found) return found
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
    found = { scope: { ...scope }, store: new ExecutionSessions(sql) }
    scopes.set(key, found)
    return found
  }
  const http = vi.fn((scope: ExecutionIdentity) => {
    const { store } = record(scope)
    return {
      async uploadSnapshot(input: ExecutionSnapshotUpload, bytes: Uint8Array) {
        const proceed = () => {
          store.saveProjectSnapshot(
            scope,
            input,
            { lifecycleGeneration: 0, membershipGeneration: 0 },
            Date.now(),
          )
          savedBytes.set(input.snapshot.snapshotId, bytes.slice())
          return store.saveProjectSnapshot(
            scope,
            input,
            { lifecycleGeneration: 0, membershipGeneration: 0 },
            Date.now(),
            true,
          )
        }
        return controls.uploadSnapshot
          ? controls.uploadSnapshot(input, bytes, proceed)
          : proceed()
      },
      async projectSnapshot(id: string) {
        return store.projectSnapshot(scope, id)
      },
      async snapshotBytes(record: ProjectSnapshotRecord) {
        const proceed = () => savedBytes.get(record.snapshotId)!.slice()
        return controls.snapshotBytes
          ? controls.snapshotBytes(record, proceed)
          : proceed()
      },
      async command(input: ExecutionSessionCommand) {
        calls.push({
          identity: { ...scope },
          input: structuredClone(input),
          at: Date.now(),
        })
        const proceed = () =>
          store.command(
            scope,
            input,
            { lifecycleGeneration: 0, membershipGeneration: 0 },
            Date.now(),
          )
        const result = controls.command
          ? await controls.command(scope, input, proceed)
          : proceed()
        return parseExecutionSnapshot(result, scope)
      },
      async events(read: ExecutionEventRead) {
        const proceed = () => store.events(scope, read)
        return controls.events
          ? controls.events(scope, read, proceed)
          : proceed()
      },
      async snapshot() {
        const proceed = () => {
          store.expire(Date.now())
          return store.snapshot(scope)
        }
        const result = controls.snapshot
          ? await controls.snapshot(scope, proceed)
          : proceed()
        return parseExecutionSnapshot(result, scope)
      },
    }
  })
  const openBridge = vi.fn(
    async (
      connect: ExecutionBridgeConnect,
      event: (event: ExecutionHostEvent) => void,
      signal: AbortSignal,
    ) => {
      const results = new Map<string, Promise<ExecutionCommandOutcome>>()
      const run = async (delivery: ExecutionDelivery) =>
        controls.execute?.(delivery) ??
        (delivery.operation.type === 'save_snapshot'
          ? succeeded(delivery, {
              type: 'save_snapshot',
              snapshotId: delivery.id,
              ...(await inspectProjectSnapshot(projectBytes)),
            })
          : succeeded(delivery, defaultResult(delivery)))
      const execute = vi.fn<ExecutionHostBridge['execute']>((delivery) => {
        const result = run(delivery)
        results.set(delivery.id, result)
        return result
      })
      const stopCommand = vi.fn<ExecutionHostBridge['stopCommand']>(
        (delivery) => {
          const previous = results.get(delivery.id)
          if (controls.stopCommand) return controls.stopCommand(delivery)
          return (
            previous ??
            Promise.resolve({
              commandId: delivery.id,
              digest: delivery.digest,
              outcome: 'failed',
              error: {
                code: 'COMMAND_CANCELLED_BEFORE_START',
                message: 'No SDK call was made.',
              },
            })
          )
        },
      )
      const shutdown = vi.fn<ExecutionHostBridge['shutdown']>(async () => ({
        confirmed: true,
      }))
      const dispose = vi.fn()
      const bridge: ExecutionHostBridge = {
        runtime: structuredClone(browserExecutionRuntime),
        setPreviewViewport: vi.fn((bounds) => bounds !== null),
        execute,
        stopCommand,
        readSnapshot: vi.fn(async () => projectBytes.slice()),
        shutdown,
        dispose,
      }
      bridges.push({
        connect,
        bridge,
        execute,
        stopCommand,
        shutdown,
        dispose,
        event,
        signal,
      })
      return controls.open ? controls.open(bridge) : bridge
    },
  )
  const newOwner = (userId = identity.userId) => {
    const service = new ExecutionOwners({
      http,
      openBridge,
      now: () => Date.now(),
      randomSecret: () => randomBytes(32).toString('base64url'),
    })
    owners.push(service)
    service.setAccount(userId)
    return service
  }
  const owner = newOwner()
  const start = async (scope = identity) => {
    const view = await owner.start(scope)
    await vi.advanceTimersByTimeAsync(0)
    return view
  }
  const snapshot = (scope = identity) => record(scope).store.snapshot(scope)
  const view = (scope = identity) =>
    owner.getSnapshot().find((item) => item.key === executionOwnerKey(scope))!
  return {
    savedBytes,
    projectBytes,
    owner,
    newOwner,
    controls,
    calls,
    bridges,
    http,
    openBridge,
    start,
    snapshot,
    view,
    store: (scope = identity) => record(scope).store,
  }
}

describe('explicit execution session recovery', () => {
  it('inspects a live remote session after reload without adopting it, then abandons expired unknown receipts and starts fresh', async () => {
    const h = fixture(),
      hanging = deferred<ExecutionCommandOutcome>()
    h.controls.execute = () => hanging.promise
    await h.start()
    await h.owner.enqueue(identity, {
      type: 'write_file',
      path: '/project/a',
      text: 'possibly written',
    })
    await vi.advanceTimersByTimeAsync(750)
    h.owner.shutdownAll()
    const reloaded = h.newOwner()
    const remote = await reloaded.inspect(identity)
    expect(remote).toMatchObject({
      phase: 'disconnected',
      localOwner: false,
      snapshot: { session: { status: 'ready' } },
    })
    expect(h.openBridge).toHaveBeenCalledTimes(1)
    expect(h.calls.filter((call) => call.input.type === 'claim')).toHaveLength(
      1,
    )
    await expect(reloaded.enqueue(identity, { type: 'close' })).rejects.toThrow(
      'not connected',
    )
    await expect(reloaded.abandon(identity)).rejects.toThrow(
      'Only an unclaimed or disconnected',
    )
    vi.setSystemTime(60_001)
    const expired = await reloaded.inspect(identity)
    expect(expired.snapshot!.commands[0].state).toBe('unknown')
    const abandoned = await reloaded.abandon(identity)
    expect(abandoned).toMatchObject({
      phase: 'abandoned',
      localOwner: false,
      snapshot: { session: { status: 'abandoned' } },
    })
    expect(abandoned.snapshot!.commands).toEqual(expired.snapshot!.commands)
    expect(abandoned.cleanup).not.toBe('confirmed')
    const oldSession = abandoned.snapshot!.session!.id
    h.controls.execute = undefined
    const next = await reloaded.start(identity)
    expect(next).toMatchObject({ phase: 'ready', localOwner: true })
    expect(next.snapshot!.session!.id).not.toBe(oldSession)
    expect(h.calls.filter((call) => call.input.type === 'create')).toHaveLength(
      2,
    )
    expect(h.calls.filter((call) => call.input.type === 'claim')).toHaveLength(
      2,
    )
  })

  it('recovers a lost create response through GET and explicit abandonment without automatically starting an SDK', async () => {
    const h = fixture()
    h.controls.command = async (_scope, input, proceed) => {
      const snapshot = proceed()
      if (input.type === 'create')
        throw new ExecutionHttpError(null, 'Lost committed response.', true)
      return snapshot
    }
    await expect(h.owner.start(identity)).rejects.toThrow('could not start')
    expect(h.view().snapshot).toBeNull()
    expect(h.openBridge).not.toHaveBeenCalled()
    const recovered = await h.owner.inspect(identity)
    expect(recovered).toMatchObject({
      phase: 'disconnected',
      localOwner: false,
      snapshot: { session: { status: 'awaiting_host' } },
    })
    await expect(h.owner.start(identity)).rejects.toThrow('reconciliation')
    await h.owner.abandon(identity)
    h.controls.command = undefined
    const next = await h.owner.start(identity)
    expect(next.phase).toBe('ready')
    expect(
      h.calls.filter((call) => call.input.type === 'abandon'),
    ).toHaveLength(1)
    expect(h.openBridge).toHaveBeenCalledTimes(1)
  })

  it('rejects another account before HTTP and keeps a sibling inspection separate from the live owner', async () => {
    const h = fixture(),
      otherAccount = { ...identity, userId: 'someone-else' }
    await expect(h.owner.inspect(otherAccount)).rejects.toThrow('Sign in')
    await expect(h.owner.abandon(otherAccount)).rejects.toThrow('Sign in')
    expect(h.http).not.toHaveBeenCalled()
    await h.start()
    const sibling = { ...identity, conversationId: 'same-bot-sibling' }
    const view = await h.owner.inspect(sibling)
    expect(view).toMatchObject({
      identity: sibling,
      phase: 'idle',
      localOwner: false,
      snapshot: { session: null, commands: [], processes: [] },
    })
    expect(h.view().localOwner).toBe(true)
    expect(h.openBridge).toHaveBeenCalledTimes(1)
    await expect(h.owner.abandon(identity)).rejects.toThrow(
      'Close the local owner',
    )
    await expect(h.owner.abandon(sibling)).rejects.toThrow(
      'Only an unclaimed or disconnected',
    )
    h.controls.snapshot = async () => h.snapshot()
    await expect(h.owner.inspect(sibling)).rejects.toThrow(
      'could not be inspected',
    )
    expect(
      h.owner
        .getSnapshot()
        .find((item) => item.key === executionOwnerKey(sibling))!.snapshot!
        .session,
    ).toBeNull()
    expect(h.view().phase).toBe('ready')
  })

  it('fences a live owner when inspection observes durable revocation and retains the new unknown evidence', async () => {
    const h = fixture(),
      hanging = deferred<ExecutionCommandOutcome>()
    h.controls.execute = () => hanging.promise
    await h.start()
    await h.owner.enqueue(identity, { type: 'read_file', path: '/project/a' })
    await vi.advanceTimersByTimeAsync(750)
    h.store().reconcile(
      { lifecycleGeneration: 1, membershipGeneration: 0 },
      Date.now(),
    )
    const inspected = await h.owner.inspect(identity)
    expect(inspected).toMatchObject({
      phase: 'disconnected',
      localOwner: false,
      snapshot: {
        session: { status: 'disconnected' },
        commands: [{ state: 'unknown' }],
      },
    })
    expect(h.bridges[0].shutdown).toHaveBeenCalledTimes(1)
    const before = h.calls.length
    await vi.advanceTimersByTimeAsync(15_000)
    expect(h.calls).toHaveLength(before)
  })

  it('preserves the known snapshot after an inspection failure rather than inventing closure', async () => {
    const h = fixture()
    await h.start()
    h.owner.shutdownAll()
    const known = await h.owner.inspect(identity)
    h.controls.snapshot = async () => {
      throw new ExecutionHttpError(503, 'private server error', true)
    }
    await expect(h.owner.inspect(identity)).rejects.toThrow(
      'could not be inspected',
    )
    expect(h.view().snapshot).toBe(known.snapshot)
    expect(h.view().phase).toBe('disconnected')
    expect(h.view().snapshot!.session!.status).toBe('ready')
    expect(h.view().error).not.toContain('private server error')
  })

  it('uses one UUID and the inspected revision for abandon, preserving the draft snapshot on a real CAS conflict', async () => {
    const h = fixture()
    h.controls.command = async (_scope, input, proceed) => {
      const value = proceed()
      if (input.type === 'create')
        throw new ExecutionHttpError(null, 'lost', true)
      return value
    }
    await h.owner.start(identity).catch(() => {})
    const known = await h.owner.inspect(identity)
    const session = known.snapshot!.session!
    h.store().command(
      identity,
      {
        type: 'abandon',
        commandId: crypto.randomUUID(),
        sessionId: session.id,
        expectedVersion: session.version,
      },
      { lifecycleGeneration: 0, membershipGeneration: 0 },
      Date.now(),
    )
    h.controls.command = async (_scope, _input, proceed) => {
      try {
        return proceed()
      } catch (error) {
        if (error instanceof ExecutionSessionError)
          throw new ExecutionHttpError(error.status, 'Conflict.', false)
        throw error
      }
    }
    await expect(h.owner.abandon(identity)).rejects.toThrow(
      'could not be confirmed',
    )
    const calls = h.calls.filter((call) => call.input.type === 'abandon')
    expect(calls).toHaveLength(1)
    expect(calls[0].input).toMatchObject({
      sessionId: session.id,
      expectedVersion: session.version,
    })
    expect(h.view().snapshot).toBe(known.snapshot)
    expect(h.view().phase).toBe('disconnected')
    expect((await h.owner.inspect(identity)).phase).toBe('abandoned')
  })

  it('retains the last known state after an uncertain committed abandonment until an explicit inspection confirms it', async () => {
    const h = fixture()
    h.controls.command = async (_scope, input, proceed) => {
      const value = proceed()
      if (input.type === 'create')
        throw new ExecutionHttpError(null, 'lost', true)
      return value
    }
    await h.owner.start(identity).catch(() => {})
    const known = await h.owner.inspect(identity)
    h.controls.command = async (_scope, input, proceed) => {
      const value = proceed()
      if (input.type === 'abandon')
        throw new ExecutionHttpError(null, 'response lost', true)
      return value
    }
    await expect(h.owner.abandon(identity)).rejects.toThrow(
      'could not be confirmed',
    )
    expect(h.view().snapshot).toBe(known.snapshot)
    expect(h.view().phase).toBe('disconnected')
    expect(h.snapshot().session!.status).toBe('abandoned')
    expect(
      h.calls.filter((call) => call.input.type === 'abandon'),
    ).toHaveLength(1)
    await expect(h.owner.start(identity)).rejects.toThrow('reconciliation')
    expect((await h.owner.inspect(identity)).phase).toBe('abandoned')
  })

  it.each(['response', '401'] as const)(
    'ignores a late inspection%s after switching accounts',
    async (finish) => {
      const h = fixture(),
        response = deferred<ExecutionSessionSnapshot>()
      await h.start()
      h.owner.shutdownAll()
      const reloaded = h.newOwner(),
        retained = h.snapshot()
      h.controls.snapshot = async (scope, proceed) =>
        scope.userId === identity.userId ? response.promise : proceed()
      const inspecting = reloaded.inspect(identity).catch((error) => error)
      await vi.advanceTimersByTimeAsync(0)
      const next = {
        ...identity,
        userId: 'account-b',
        conversationId: 'other-private',
      }
      reloaded.setAccount(next.userId)
      await reloaded.inspect(next)
      if (finish === '401')
        response.reject(new ExecutionHttpError(401, 'old account', false))
      else response.resolve(retained)
      expect(await inspecting).toBeInstanceOf(Error)
      expect(reloaded.getSnapshot()).toHaveLength(1)
      expect(reloaded.getSnapshot()[0]).toMatchObject({
        identity: next,
        phase: 'idle',
        localOwner: false,
      })
      expect((await reloaded.inspect(next)).phase).toBe('idle')
    },
  )

  it('does not publish or apply a late abandonment response to a replacement account', async () => {
    const h = fixture(),
      response = deferred<ExecutionSessionSnapshot>()
    h.controls.command = async (_scope, input, proceed) => {
      const value = proceed()
      if (input.type === 'create')
        throw new ExecutionHttpError(null, 'lost', true)
      return value
    }
    await h.owner.start(identity).catch(() => {})
    await h.owner.inspect(identity)
    let abandoned!: ExecutionSessionSnapshot
    h.controls.command = async (_scope, input, proceed) => {
      const value = proceed()
      if (input.type === 'abandon') {
        abandoned = value
        return response.promise
      }
      return value
    }
    const abandoning = h.owner.abandon(identity).catch((error) => error)
    await vi.advanceTimersByTimeAsync(0)
    const next = { ...identity, userId: 'account-b' }
    h.owner.setAccount(next.userId)
    await h.owner.inspect(next)
    response.resolve(abandoned)
    expect(await abandoning).toBeInstanceOf(Error)
    expect(h.owner.getSnapshot()).toHaveLength(1)
    expect(h.owner.getSnapshot()[0]).toMatchObject({
      identity: next,
      phase: 'idle',
      localOwner: false,
    })
  })

  it('serializes inspection with abandonment and explicit start while allowing identical read subscribers', async () => {
    const h = fixture(),
      response = deferred<ExecutionSessionSnapshot>()
    let empty!: ExecutionSessionSnapshot
    h.controls.snapshot = async (_scope, proceed) => {
      empty = proceed()
      return response.promise
    }
    const first = h.owner.inspect(identity),
      second = h.owner.inspect(identity)
    expect(second).toBe(first)
    await expect(h.owner.start(identity)).rejects.toThrow('session check')
    await expect(h.owner.abandon(identity)).rejects.toThrow(
      'current session action',
    )
    await vi.advanceTimersByTimeAsync(0)
    response.resolve(empty)
    expect((await first).phase).toBe('idle')
    expect(h.openBridge).not.toHaveBeenCalled()
    expect(h.calls).toHaveLength(0)
    expect((await h.owner.start(identity)).phase).toBe('ready')
  })
})

describe('execution owner identity and lifetime', () => {
  it('permanently retires an idle owner while a fresh successor starts only on explicit request', async () => {
    const h = fixture()
    h.owner.dispose('Workspace code changed.')
    h.owner.dispose()
    h.owner.setAccount(null)
    h.owner.setAccount(identity.userId)
    await expect(h.owner.start(identity)).rejects.toThrow('reload')
    await expect(h.owner.inspect(identity)).rejects.toThrow('reload')
    expect(h.http).not.toHaveBeenCalled()
    expect(h.openBridge).not.toHaveBeenCalled()
    const successor = h.newOwner()
    expect(successor.getSnapshot()).toEqual([])
    expect(h.http).not.toHaveBeenCalled()
    expect(h.openBridge).not.toHaveBeenCalled()
    expect((await successor.inspect(identity)).phase).toBe('idle')
    expect(h.calls).toHaveLength(0)
    expect(h.openBridge).not.toHaveBeenCalled()
    expect((await successor.start(identity)).phase).toBe('ready')
    expect(h.openBridge).toHaveBeenCalledOnce()
    await expect(h.owner.start(identity)).rejects.toThrow('reload')
  })

  it('retirement immediately hides the preview and fences a late SDK result without acknowledging Close', async () => {
    const h = fixture(),
      { previewId } = await openOwnedPreview(h),
      pending = deferred<ExecutionCommandOutcome>()
    const viewport = h.owner.attachPreviewViewport(identity, previewId)
    expect(viewport.update(previewBounds)).toBe(true)
    h.controls.execute = () => pending.promise
    await h.owner.enqueue(identity, {
      type: 'write_file',
      path: '/project/late.txt',
      text: 'possibly written',
    })
    await vi.advanceTimersByTimeAsync(750)
    const bridge = h.bridges[0],
      delivery = bridge.execute.mock.calls.at(-1)![0],
      callsBefore = h.calls.length
    h.owner.dispose('Workspace code changed.')
    h.owner.dispose('Repeated cleanup must not replace the original cause.')
    expect(bridge.signal.aborted).toBe(true)
    expect(bridge.bridge.setPreviewViewport).toHaveBeenLastCalledWith(null)
    expect(viewport.update(previewBounds)).toBe(false)
    expect(h.view()).toMatchObject({
      phase: 'disconnected',
      localOwner: false,
      error: 'Workspace code changed.',
    })
    await expect(
      h.owner.enqueue(identity, {
        type: 'read_file',
        path: '/project/late.txt',
      }),
    ).rejects.toThrow()
    pending.resolve(succeeded(delivery, defaultResult(delivery)))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(h.calls).toHaveLength(callsBefore)
    expect(bridge.shutdown).toHaveBeenCalledOnce()
    expect(bridge.dispose).toHaveBeenCalledOnce()
    expect(h.view()).toMatchObject({
      phase: 'disconnected',
      cleanup: 'confirmed',
      localOwner: false,
    })
    const durable = h.snapshot()
    expect(durable.session?.status).toBe('ready')
    expect(
      durable.commands.find((item) => item.id === delivery.id)?.state,
    ).toBe('dispatched')
    expect(
      durable.commands.some((item) => item.operation.type === 'close'),
    ).toBe(false)
  })

  it('cleans up a runtime that opens after retirement and never claims it', async () => {
    const h = fixture(),
      opening = deferred<ExecutionHostBridge>()
    h.controls.open = () => opening.promise
    const starting = h.owner.start(identity).catch((error) => error)
    await vi.advanceTimersByTimeAsync(0)
    expect(h.bridges).toHaveLength(1)
    h.owner.dispose('Workspace code changed.')
    expect(h.bridges[0].signal.aborted).toBe(true)
    h.owner.setAccount(identity.userId)
    opening.resolve(h.bridges[0].bridge)
    expect(await starting).toBeInstanceOf(Error)
    await vi.advanceTimersByTimeAsync(0)
    expect(h.calls.map((call) => call.input.type)).toEqual(['create'])
    expect(h.bridges[0].shutdown).toHaveBeenCalledOnce()
    expect(h.bridges[0].dispose).toHaveBeenCalledOnce()
    expect(h.snapshot().session?.status).toBe('awaiting_host')
    expect(h.view()).toMatchObject({ phase: 'disconnected', localOwner: false })
    await expect(h.owner.start(identity)).rejects.toThrow('reload')
  })

  it.each(['unconfirmed', 'rejected'] as const)(
    'retains unknown cleanup after %s retirement and does not invent a durable Close',
    async (failure) => {
      const h = fixture()
      await h.start()
      const bridge = h.bridges[0],
        callsBefore = h.calls.length
      if (failure === 'unconfirmed')
        bridge.shutdown.mockResolvedValue({
          confirmed: false,
          error: {
            code: 'shutdown_unconfirmed',
            message: 'The runtime did not confirm shutdown.',
          },
        })
      else
        bridge.shutdown.mockRejectedValue(
          new Error('The runtime did not confirm shutdown.'),
        )
      h.owner.dispose()
      h.owner.dispose()
      await vi.advanceTimersByTimeAsync(30_000)
      expect(h.view()).toMatchObject({
        phase: 'disconnected',
        localOwner: false,
        cleanup: 'unknown',
      })
      expect(h.calls).toHaveLength(callsBefore)
      expect(bridge.shutdown).toHaveBeenCalledOnce()
      expect(bridge.dispose).toHaveBeenCalledOnce()
      expect(h.snapshot().session?.status).toBe('ready')
      expect(h.snapshot().commands).toEqual([])
      await expect(h.owner.inspect(identity)).rejects.toThrow('reload')
    },
  )

  it('shares one start, captures exact scope, and never exposes the lease proof to the bridge or public store', async () => {
    const h = fixture(),
      scope = { ...identity }
    const first = h.owner.start(scope),
      second = h.owner.start({ ...scope })
    expect(second).toBe(first)
    scope.conversationId = 'route changed'
    await first
    await vi.advanceTimersByTimeAsync(0)
    expect(h.calls.filter((call) => call.input.type === 'create')).toHaveLength(
      1,
    )
    expect(h.calls.filter((call) => call.input.type === 'claim')).toHaveLength(
      1,
    )
    expect(h.openBridge).toHaveBeenCalledTimes(1)
    expect(h.http).toHaveBeenCalledWith(identity)
    const claim = h.calls.find((call) => call.input.type === 'claim')!
      .input as Extract<ExecutionSessionCommand, { type: 'claim' }>
    expect(h.bridges[0].connect).toMatchObject({
      sessionId: claim.sessionId,
      runtimeId: claim.runtimeId,
      hostGeneration: 1,
      project: trustedExecutionProject,
    })
    expect(h.bridges[0].connect.nonce).not.toBe(claim.leaseProof)
    expect(JSON.stringify(h.bridges[0].connect)).not.toContain(claim.leaseProof)
    expect(JSON.stringify(h.owner.getSnapshot())).not.toContain(
      claim.leaseProof,
    )
    expect(JSON.stringify(h.owner.getSnapshot())).not.toContain('leaseProof')
    expect(h.view().phase).toBe('ready')
  })

  it('keeps the owner alive when a route or pane unsubscribes', async () => {
    const h = fixture(),
      listener = vi.fn(),
      unsubscribe = h.owner.subscribe(listener)
    await h.start()
    unsubscribe()
    listener.mockClear()
    await vi.advanceTimersByTimeAsync(15_000)
    expect(h.calls.some((call) => call.input.type === 'renew')).toBe(true)
    expect(h.view().phase).toBe('ready')
    expect(h.bridges[0].shutdown).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()
  })

  it('shuts down a bridge that resolves after an account change and never claims it', async () => {
    const h = fixture(),
      opening = deferred<ExecutionHostBridge>()
    h.controls.open = () => opening.promise
    const starting = h.owner.start(identity).catch((error) => error)
    await vi.advanceTimersByTimeAsync(0)
    expect(h.bridges).toHaveLength(1)
    h.owner.setAccount('account-b')
    opening.resolve(h.bridges[0].bridge)
    expect(await starting).toBeInstanceOf(Error)
    await vi.advanceTimersByTimeAsync(0)
    expect(h.calls.some((call) => call.input.type === 'claim')).toBe(false)
    expect(h.bridges[0].shutdown).toHaveBeenCalledTimes(1)
    expect(h.bridges[0].dispose).toHaveBeenCalledTimes(1)
    expect(h.owner.getSnapshot()).toEqual([])
  })

  it('never revives a page-hidden owner after resubscription', async () => {
    const h = fixture()
    await h.start()
    h.owner.pageHidden()
    h.owner.subscribe(() => {})
    await expect(h.owner.start(identity)).rejects.toThrow('reload')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(h.bridges[0].shutdown).toHaveBeenCalledTimes(1)
    expect(h.calls.filter((call) => call.input.type === 'renew')).toHaveLength(
      0,
    )
  })
})

describe('execution owner delivery and stop behavior', () => {
  it('counts repeated committed delivery while an SDK effect is pending without executing it again', async () => {
    const h = fixture(),
      pending = deferred<ExecutionCommandOutcome>()
    h.controls.execute = () => pending.promise
    await h.start()
    expect(h.view().deliveryObservations).toEqual({})
    await h.owner.enqueue(identity, { type: 'read_file', path: '/project/a' })
    await vi.advanceTimersByTimeAsync(3000)
    const delivery = h.bridges[0].execute.mock.calls[0][0]
    expect(h.view().deliveryObservations).toEqual({ [delivery.id]: 4 })
    expect(h.bridges[0].execute).toHaveBeenCalledTimes(1)
    expect(
      h.calls.filter((call) => call.input.type === 'acknowledge'),
    ).toHaveLength(0)
    expect(Object.isFrozen(h.view().deliveryObservations)).toBe(true)
    pending.resolve(succeeded(delivery, defaultResult(delivery)))
    await vi.advanceTimersByTimeAsync(0)
    expect(h.snapshot().commands[0].state).toBe('succeeded')
    expect(h.view().deliveryObservations).toEqual({ [delivery.id]: 4 })
  })

  it('deduplicates a delayed delivery even after the SDK result and durable acknowledgment settled', async () => {
    const h = fixture()
    await h.start()
    let old: ExecutionSessionSnapshot | undefined
    h.controls.command = async (_scope, input, proceed) => {
      if (input.type === 'dispatch' && old) return structuredClone(old)
      const result = proceed()
      if (result.delivery) old = structuredClone(result)
      return result
    }
    await h.owner.enqueue(identity, { type: 'read_file', path: '/project/a' })
    await vi.advanceTimersByTimeAsync(3000)
    expect(h.bridges[0].execute).toHaveBeenCalledTimes(1)
    expect(
      h.calls.filter((call) => call.input.type === 'acknowledge'),
    ).toHaveLength(1)
    expect(h.snapshot().commands[0].state).toBe('succeeded')
    expect(h.view().phase).toBe('ready')
    expect(h.view().deliveryObservations).toEqual({ [old!.delivery!.id]: 4 })
  })

  it('does not count a conflicting same-ID delivery as an identical redelivery', async () => {
    const h = fixture(),
      pending = deferred<ExecutionCommandOutcome>()
    h.controls.execute = () => pending.promise
    await h.start()
    await h.owner.enqueue(identity, { type: 'read_file', path: '/project/a' })
    await vi.advanceTimersByTimeAsync(750)
    const commandId = h.snapshot().commands[0].id
    h.controls.command = async (_scope, input, proceed) => {
      const snapshot = proceed()
      if (input.type === 'dispatch' && snapshot.delivery) {
        snapshot.delivery.digest = 'b'.repeat(64)
        snapshot.commands[0].digest = snapshot.delivery.digest
      }
      return snapshot
    }
    await vi.advanceTimersByTimeAsync(750)
    expect(h.view().deliveryObservations).toEqual({ [commandId]: 1 })
    expect(h.bridges[0].execute).toHaveBeenCalledTimes(1)
    expect(h.view().phase).toBe('disconnected')
  })

  it('dispatches Stop and Close while an ordinary SDK command remains pending', async () => {
    const h = fixture(),
      hanging = deferred<ExecutionCommandOutcome>()
    h.controls.execute = async (delivery) =>
      delivery.operation.type === 'read_file'
        ? hanging.promise
        : succeeded(delivery, defaultResult(delivery))
    await h.start()
    await h.owner.enqueue(identity, {
      type: 'spawn',
      command: 'node',
      args: [],
      cwd: '/project',
      timeoutMs: 30_000,
    })
    await vi.advanceTimersByTimeAsync(750)
    const processId = h.snapshot().processes[0].id
    await h.owner.enqueue(identity, { type: 'read_file', path: '/project/a' })
    await vi.advanceTimersByTimeAsync(750)
    await h.owner.enqueue(identity, { type: 'stop_process', processId })
    await vi.advanceTimersByTimeAsync(750)
    expect(h.snapshot().processes[0].state).toBe('stopped')
    expect(
      h
        .snapshot()
        .commands.find((command) => command.operation.type === 'read_file')!
        .state,
    ).toBe('dispatched')
    await h.owner.enqueue(identity, { type: 'close' })
    await vi.advanceTimersByTimeAsync(750)
    expect(
      h.bridges[0].execute.mock.calls.map(
        ([delivery]) => delivery.operation.type,
      ),
    ).toEqual(['spawn', 'read_file', 'stop_process', 'close'])
    expect(h.snapshot().session!.status).toBe('closed')
    expect(
      h
        .snapshot()
        .commands.find((command) => command.operation.type === 'read_file')!
        .state,
    ).toBe('unknown')
    expect(h.view()).toMatchObject({ phase: 'closed', cleanup: 'confirmed' })
    expect(h.bridges[0].dispose).toHaveBeenCalledTimes(1)
    const read = h.bridges[0].execute.mock.calls.find(
      ([delivery]) => delivery.operation.type === 'read_file',
    )![0]
    hanging.resolve(succeeded(read, defaultResult(read)))
    await vi.advanceTimersByTimeAsync(0)
    expect(
      h.calls.some(
        (call) =>
          call.input.type === 'acknowledge' && call.input.commandId === read.id,
      ),
    ).toBe(false)
    expect(
      h.snapshot().commands.find((command) => command.id === read.id)!.state,
    ).toBe('unknown')
  })

  it('surfaces an enqueue CAS conflict without changing command ID or fencing a valid host', async () => {
    const h = fixture()
    await h.start()
    h.controls.command = async (_scope, input, proceed) => {
      if (input.type === 'enqueue')
        throw new ExecutionHttpError(409, 'conflict', false)
      return proceed()
    }
    await expect(
      h.owner.enqueue(identity, { type: 'read_file', path: '/project/a' }),
    ).rejects.toThrow('Review its current state')
    await vi.advanceTimersByTimeAsync(1500)
    expect(
      h.calls.filter((call) => call.input.type === 'enqueue'),
    ).toHaveLength(1)
    expect(h.view().phase).toBe('ready')
    expect(h.bridges[0].shutdown).not.toHaveBeenCalled()
  })

  it('fences unknown SDK effects without inventing a terminal failed acknowledgment', async () => {
    const h = fixture()
    h.controls.execute = async () => {
      throw new Error('private SDK error with credentials')
    }
    await h.start()
    await h.owner.enqueue(identity, {
      type: 'write_file',
      path: '/project/a',
      text: 'possibly written',
    })
    await vi.advanceTimersByTimeAsync(750)
    expect(h.view().phase).toBe('disconnected')
    expect(
      h.calls.filter((call) => call.input.type === 'acknowledge'),
    ).toHaveLength(0)
    expect(h.snapshot().commands[0].state).toBe('dispatched')
    expect(h.bridges[0].shutdown).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(h.owner.getSnapshot())).not.toContain('credentials')
  })

  it('preserves the owner for reserved Stop and Close after the actual ordinary command limit returns 429', async () => {
    const h = fixture()
    h.controls.command = async (_scope, _input, proceed) => {
      try {
        return proceed()
      } catch (error) {
        // The real API exposes a rejected ledger command as a definite HTTP error.
        if (error instanceof ExecutionSessionError)
          throw new ExecutionHttpError(error.status, 'Command rejected.', false)
        throw error
      }
    }
    await h.start()
    await h.owner.enqueue(identity, {
      type: 'spawn',
      command: 'node',
      args: [],
      cwd: '/project',
      timeoutMs: 30_000,
    })
    await vi.advanceTimersByTimeAsync(750)
    const processId = h.snapshot().processes[0].id
    for (let index = 1; index < maxExecutionCommands - 2; index++) {
      await h.owner.enqueue(identity, {
        type: 'read_file',
        path: `/project/file-${index}`,
      })
    }
    const before = h.calls.filter(
      (call) => call.input.type === 'enqueue',
    ).length
    await expect(
      h.owner.enqueue(identity, {
        type: 'read_file',
        path: '/project/over-limit',
      }),
    ).rejects.toThrow(/limit/i)
    expect(
      h.calls.filter((call) => call.input.type === 'enqueue'),
    ).toHaveLength(before + 1)
    expect(h.snapshot().commands).toHaveLength(maxExecutionCommands - 2)
    expect(h.view().phase).toBe('ready')
    expect(h.bridges[0].shutdown).not.toHaveBeenCalled()
    await h.owner.enqueue(identity, { type: 'stop_process', processId })
    await vi.advanceTimersByTimeAsync(750)
    expect(h.snapshot().processes[0].state).toBe('stopped')
    await h.owner.enqueue(identity, { type: 'close' })
    await vi.advanceTimersByTimeAsync(750)
    expect(h.snapshot().commands).toHaveLength(maxExecutionCommands)
    expect(
      h.bridges[0].execute.mock.calls.map(
        ([delivery]) => delivery.operation.type,
      ),
    ).toEqual(['spawn', 'stop_process', 'close'])
    expect(h.view()).toMatchObject({ phase: 'closed', cleanup: 'confirmed' })
    expect(h.snapshot().session!.status).toBe('closed')
  })

  it('clears optimistic closing after a definite Close429 and waits for a fresh user action', async () => {
    const h = fixture()
    await h.start()
    let rejectClose = true
    h.controls.command = async (_scope, input, proceed) => {
      if (
        input.type === 'enqueue' &&
        input.operation.type === 'close' &&
        rejectClose
      ) {
        rejectClose = false
        throw new ExecutionHttpError(429, 'Command limit.', false)
      }
      return proceed()
    }
    await expect(h.owner.enqueue(identity, { type: 'close' })).rejects.toThrow(
      /limit/i,
    )
    await vi.advanceTimersByTimeAsync(1500)
    const rejected = h.calls.filter((call) => call.input.type === 'enqueue')
    expect(rejected).toHaveLength(1)
    expect(h.view().phase).toBe('ready')
    expect(h.bridges[0].execute).not.toHaveBeenCalled()
    expect(h.bridges[0].shutdown).not.toHaveBeenCalled()
    await h.owner.enqueue(identity, { type: 'close' })
    await vi.advanceTimersByTimeAsync(750)
    expect(h.view().phase).toBe('closed')
    const admitted = h.calls.filter((call) => call.input.type === 'enqueue')
    expect(admitted).toHaveLength(2)
    expect((admitted[1].input as { commandId: string }).commandId).not.toBe(
      (admitted[0].input as { commandId: string }).commandId,
    )
  })

  it('fences an uncertain429 after a lost admitted response instead of assuming no command exists', async () => {
    const h = fixture()
    await h.start()
    h.controls.command = async (_scope, input, proceed) => {
      const snapshot = proceed()
      if (input.type === 'enqueue') {
        // Admission committed, its response was lost, and the transport's later
        // retry received429. It must preserve that earlier uncertainty.
        throw new ExecutionHttpError(429, 'Command limit.', true)
      }
      return snapshot
    }
    await expect(
      h.owner.enqueue(identity, {
        type: 'write_file',
        path: '/project/a',
        text: 'possibly admitted',
      }),
    ).rejects.toThrow('could not be confirmed')
    await vi.advanceTimersByTimeAsync(1500)
    expect(
      h.calls.filter((call) => call.input.type === 'enqueue'),
    ).toHaveLength(1)
    expect(h.snapshot().commands).toHaveLength(1)
    expect(h.snapshot().commands[0].state).toBe('queued')
    expect(h.view().phase).toBe('disconnected')
    expect(h.bridges[0].shutdown).toHaveBeenCalledTimes(1)
    expect(h.bridges[0].execute).not.toHaveBeenCalled()
    await expect(h.owner.enqueue(identity, { type: 'close' })).rejects.toThrow(
      'not connected',
    )
  })
})

describe('execution owner lease and account fencing', () => {
  it('rejects a claim response that arrives after its first-start deadline without ever dispatching', async () => {
    const h = fixture(),
      claim = deferred<ExecutionSessionSnapshot>()
    let retained!: ExecutionSessionSnapshot
    h.controls.command = async (_scope, input, proceed) => {
      const result = proceed()
      if (input.type === 'claim') {
        retained = result
        return claim.promise
      }
      return result
    }
    const starting = h.owner.start(identity).catch((error) => error)
    await vi.advanceTimersByTimeAsync(55_000)
    claim.resolve(retained)
    expect(await starting).toBeInstanceOf(Error)
    await vi.advanceTimersByTimeAsync(0)
    expect(h.view().phase).toBe('disconnected')
    expect(h.calls.some((call) => call.input.type === 'dispatch')).toBe(false)
    expect(h.bridges[0].execute).not.toHaveBeenCalled()
    expect(h.bridges[0].shutdown).toHaveBeenCalledTimes(1)
  })

  it('checks the local deadline when work is requested even if scheduled timers have not run', async () => {
    const h = fixture()
    await h.start()
    vi.setSystemTime(55_000)
    await expect(
      h.owner.enqueue(identity, { type: 'read_file', path: '/project/a' }),
    ).rejects.toThrow('not connected')
    expect(h.calls.some((call) => call.input.type === 'enqueue')).toBe(false)
    expect(h.view().phase).toBe('disconnected')
    expect(h.bridges[0].shutdown).toHaveBeenCalledTimes(1)
  })

  it('uses the renewal request start rather than a delayed response to set its local deadline', async () => {
    const h = fixture(),
      renewal = deferred<ExecutionSessionSnapshot>(),
      nextRenewal = deferred<ExecutionSessionSnapshot>()
    let retained!: ExecutionSessionSnapshot,
      count = 0
    h.controls.command = async (_scope, input, proceed) => {
      if (input.type !== 'renew') return proceed()
      if (++count === 1) {
        retained = proceed()
        return renewal.promise
      }
      return nextRenewal.promise
    }
    await h.start()
    await vi.advanceTimersByTimeAsync(40_000)
    expect(h.calls.find((call) => call.input.type === 'renew')!.at).toBe(15_000)
    renewal.resolve(retained)
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(29_999)
    expect(h.view().phase).toBe('ready')
    await vi.advanceTimersByTimeAsync(1)
    expect(h.view().phase).toBe('disconnected')
    expect(h.bridges[0].shutdown).toHaveBeenCalledTimes(1)
  })

  it('does not revive after a delayed renewal arrives beyond the earlier local deadline', async () => {
    const h = fixture(),
      renewal = deferred<ExecutionSessionSnapshot>()
    let retained!: ExecutionSessionSnapshot
    h.controls.command = async (_scope, input, proceed) => {
      const value = proceed()
      if (input.type === 'renew') {
        retained = value
        return renewal.promise
      }
      return value
    }
    await h.start()
    await vi.advanceTimersByTimeAsync(55_000)
    expect(h.view().phase).toBe('disconnected')
    const before = h.calls.length
    renewal.resolve(retained)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(h.view().phase).toBe('disconnected')
    expect(h.calls).toHaveLength(before)
    expect(h.bridges[0].shutdown).toHaveBeenCalledTimes(1)
  })

  it.each(['renew', 'dispatch'] as const)(
    'fences a %s 409 instead of treating it as an enqueue conflict',
    async (type) => {
      const h = fixture()
      await h.start()
      h.controls.command = async (_scope, input, proceed) => {
        if (input.type === type)
          throw new ExecutionHttpError(409, 'inactive', false)
        return proceed()
      }
      await vi.advanceTimersByTimeAsync(type === 'renew' ? 15_000 : 750)
      expect(h.view().phase).toBe('disconnected')
      expect(h.bridges[0].shutdown).toHaveBeenCalledTimes(1)
    },
  )

  it('fences all current-account owners on an authentication failure', async () => {
    const h = fixture(),
      sibling = { ...identity, conversationId: 'sibling' }
    await h.start()
    await h.start(sibling)
    h.controls.command = async (scope, input, proceed) => {
      if (
        scope.conversationId === identity.conversationId &&
        input.type === 'dispatch'
      )
        throw new ExecutionHttpError(401, 'signed out', false)
      return proceed()
    }
    await vi.advanceTimersByTimeAsync(750)
    expect(h.owner.getSnapshot()).toEqual([])
    expect(
      h.bridges.every((bridge) => bridge.shutdown.mock.calls.length === 1),
    ).toBe(true)
    await expect(h.owner.start(identity)).rejects.toThrow('Sign in')
  })

  it('does not let a late 401 from an old account log out the new account', async () => {
    const h = fixture(),
      stale = deferred<ExecutionSessionSnapshot>()
    await h.start()
    h.controls.command = async (scope, input, proceed) => {
      if (scope.userId === identity.userId && input.type === 'dispatch')
        return stale.promise
      return proceed()
    }
    await vi.advanceTimersByTimeAsync(750)
    const next = {
      ...identity,
      userId: 'account-b',
      conversationId: 'other-account-private',
    }
    h.owner.setAccount(next.userId)
    await h.start(next)
    stale.reject(new ExecutionHttpError(401, 'old session', false))
    await vi.advanceTimersByTimeAsync(0)
    expect(h.owner.getSnapshot()).toHaveLength(1)
    expect(h.view(next).phase).toBe('ready')
    expect(h.bridges[1].shutdown).not.toHaveBeenCalled()
    expect(await h.owner.start(next)).toMatchObject({
      phase: 'ready',
      identity: next,
    })
  })
})

describe('execution owner durable evidence', () => {
  const spawn = async (h: ReturnType<typeof fixture>) => {
    await h.start()
    await h.owner.enqueue(identity, {
      type: 'spawn',
      command: 'node',
      args: [],
      cwd: '/project',
      timeoutMs: 30_000,
    })
    await vi.advanceTimersByTimeAsync(750)
    return h.snapshot().commands[0]
  }
  const emit = (
    h: ReturnType<typeof fixture>,
    command: ExecutionSessionSnapshot['commands'][number],
    text: string,
    sequence = 1,
  ) => {
    h.bridges[0].event({
      type: 'output',
      commandId: command.id,
      ...(command.processId ? { processId: command.processId } : {}),
      sequence,
      stream: 'stdout',
      bytes: new TextEncoder().encode(text),
    })
  }
  const text = (events: readonly ExecutionHostEvent[]) =>
    Buffer.concat(
      events.flatMap((event) =>
        event.type === 'output' ? [Buffer.from(event.bytes)] : [],
      ),
    ).toString('utf8')

  it('retains a separate bounded unsaved spool and fences instead of silently evicting bytes', async () => {
    const h = fixture(),
      command = await spawn(h)
    const blocked = deferred<ExecutionSessionSnapshot>()
    h.controls.command = async (_scope, input, proceed) =>
      input.type === 'append_events' ? blocked.promise : proceed()
    for (let index = 0; index < 20; index++)
      emit(h, command, 'x'.repeat(16_384), index + 1)
    await vi.advanceTimersByTimeAsync(0)
    expect(h.view().events).toHaveLength(16)
    expect(h.view().eventStatus).toMatchObject({
      receivedThrough: 16,
      persistedThrough: 0,
      pendingEvents: 16,
      error: expect.stringContaining('limits'),
    })
    expect(h.view().droppedBytes).toBe(0)
    expect(h.view().phase).toBe('disconnected')
    expect(h.bridges[0].shutdown).toHaveBeenCalledTimes(1)
    const retained = h.view().events
    emit(h, command, 'late', 21)
    expect(h.view().events).toBe(retained)
  })

  it('uploads stable bounded batches, snapshots original bytes, and merges saved/pending output once', async () => {
    const h = fixture(),
      command = await spawn(h)
    const blocked = deferred<void>()
    let first = true
    h.controls.command = async (_scope, input, proceed) => {
      if (input.type === 'append_events' && first) {
        first = false
        await blocked.promise
      }
      return proceed()
    }
    const bytes = new TextEncoder().encode('\ufeffcafé 😀\r\n')
    h.bridges[0].event({
      type: 'output',
      commandId: command.id,
      processId: command.processId,
      sequence: 1,
      stream: 'stdout',
      bytes,
    })
    bytes.fill(0)
    for (let index = 0; index < 5; index++)
      emit(h, command, 'x'.repeat(16_384), index + 2)
    await vi.advanceTimersByTimeAsync(0)
    expect(h.view().eventStatus.pendingEvents).toBe(6)
    expect(h.view().eventStatus.persistedThrough).toBe(0)
    blocked.resolve()
    await vi.advanceTimersByTimeAsync(0)
    const uploads = h.calls
      .filter((call) => call.input.type === 'append_events')
      .map(
        (call) =>
          call.input as Extract<
            ExecutionSessionCommand,
            { type: 'append_events' }
          >,
      )
    expect(uploads).toHaveLength(2)
    expect(
      uploads.flatMap((input) => input.events.map((event) => event.sequence)),
    ).toEqual([1, 2, 3, 4, 5, 6])
    expect(h.view().eventStatus).toMatchObject({
      persistedThrough: 6,
      receivedThrough: 6,
      pendingEvents: 0,
    })
    expect(text(h.view().events)).toBe(
      '\ufeffcafé 😀\r\n' + 'x'.repeat(5 * 16_384),
    )
    await h.owner.inspect(identity)
    expect(h.view().events).toHaveLength(6)
    expect(h.view().phase).toBe('ready')
  })

  it('retains a run result until its output barrier is saved and never invokes the SDK again', async () => {
    const h = fixture()
    await h.start()
    const upload = deferred<void>()
    h.controls.command = async (_scope, input, proceed) => {
      if (input.type === 'append_events') await upload.promise
      return proceed()
    }
    h.controls.execute = async (delivery) => {
      emit(h, delivery, 'exact output')
      return succeeded(delivery, defaultResult(delivery))
    }
    await h.owner.enqueue(identity, {
      type: 'run',
      command: 'node',
      args: [],
      cwd: '/project',
      timeoutMs: 30_000,
    })
    await vi.advanceTimersByTimeAsync(2000)
    expect(h.bridges[0].execute).toHaveBeenCalledTimes(1)
    expect(
      h.calls.filter((call) => call.input.type === 'acknowledge'),
    ).toHaveLength(0)
    expect(h.snapshot().commands[0].state).toBe('dispatched')
    upload.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.snapshot().commands[0]).toMatchObject({
      state: 'succeeded',
      eventsThrough: 1,
    })
    expect(h.view().events).toHaveLength(1)
  })

  it('acknowledges a spawn at its fixed barrier while later output is still uploading', async () => {
    const h = fixture()
    await h.start()
    const firstUpload = deferred<void>(),
      secondUpload = deferred<void>()
    let uploads = 0
    h.controls.command = async (_scope, input, proceed) => {
      if (input.type === 'append_events')
        await (++uploads === 1 ? firstUpload.promise : secondUpload.promise)
      return proceed()
    }
    h.controls.execute = async (delivery) => {
      emit(h, delivery, 'first')
      return succeeded(delivery, defaultResult(delivery))
    }
    await h.owner.enqueue(identity, {
      type: 'spawn',
      command: 'node',
      args: [],
      cwd: '/project',
      timeoutMs: 30_000,
    })
    await vi.advanceTimersByTimeAsync(750)
    const command = h.snapshot().commands[0]
    emit(h, command, 'later', 2)
    firstUpload.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(uploads).toBe(2)
    expect(h.snapshot().commands[0]).toMatchObject({
      state: 'succeeded',
      eventsThrough: 1,
    })
    expect(h.view().eventStatus).toMatchObject({
      persistedThrough: 1,
      receivedThrough: 2,
      pendingEvents: 1,
    })
    secondUpload.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.view().eventStatus.pendingEvents).toBe(0)
    expect(h.snapshot().commands[0].eventsThrough).toBe(1)
  })

  it('continues lease renewal and dispatch while output persistence is waiting', async () => {
    const h = fixture(),
      command = await spawn(h)
    const blocked = deferred<void>()
    h.controls.command = async (_scope, input, proceed) => {
      if (input.type === 'append_events') await blocked.promise
      return proceed()
    }
    emit(h, command, 'pending')
    await vi.advanceTimersByTimeAsync(16_000)
    expect(h.calls.some((call) => call.input.type === 'renew')).toBe(true)
    expect(h.view().phase).toBe('ready')
    expect(h.snapshot().session!.leaseExpiresAt).toBeGreaterThan(60_000)
    expect(
      h.calls.filter((call) => call.input.type === 'dispatch').length,
    ).toBeGreaterThan(10)
    blocked.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.view().eventStatus.pendingEvents).toBe(0)
  })

  it('persists early exit before spawn acknowledgment without inventing a still-running process', async () => {
    const h = fixture()
    await h.start()
    h.controls.execute = async (delivery) => {
      emit(h, delivery, 'done')
      h.bridges[0].event({
        type: 'process-exit',
        commandId: delivery.id,
        processId: delivery.processId!,
        exitCode: 0,
        signal: null,
        outputDrained: true,
      })
      return succeeded(delivery, defaultResult(delivery))
    }
    await h.owner.enqueue(identity, {
      type: 'spawn',
      command: 'node',
      args: [],
      cwd: '/project',
      timeoutMs: 30_000,
    })
    await vi.advanceTimersByTimeAsync(750)
    expect(h.snapshot().events.lastSequence).toBe(2)
    expect(h.snapshot().commands[0]).toMatchObject({
      state: 'succeeded',
      eventsThrough: 2,
    })
    expect(h.snapshot().processes[0]).toMatchObject({
      state: 'exited',
      stoppedBy: 'process_event',
      exit: { exitCode: 0, signal: null },
    })
    expect(h.view().phase).toBe('ready')
  })

  it('sends Close to the SDK while an output upload hangs, then commits Close only after the fixed barrier', async () => {
    const h = fixture(),
      command = await spawn(h)
    const upload = deferred<void>()
    h.controls.command = async (_scope, input, proceed) => {
      if (input.type === 'append_events') await upload.promise
      return proceed()
    }
    emit(h, command, 'before close')
    await vi.advanceTimersByTimeAsync(0)
    await h.owner.enqueue(identity, { type: 'close' })
    await vi.advanceTimersByTimeAsync(750)
    expect(
      h.bridges[0].execute.mock.calls.map((call) => call[0].operation.type),
    ).toEqual(['spawn', 'close'])
    expect(h.snapshot().session!.status).toBe('closing')
    expect(h.bridges[0].dispose).not.toHaveBeenCalled()
    upload.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(
      h.snapshot().commands.find((item) => item.operation.type === 'close'),
    ).toMatchObject({ state: 'succeeded', eventsThrough: 1 })
    expect(h.view().phase).toBe('closed')
    expect(h.bridges[0].dispose).toHaveBeenCalledTimes(1)
  })

  it('ignores a valid append response that arrives after another snapshot confirmed its bytes and Close completed', async () => {
    const h = fixture(),
      command = await spawn(h)
    const response = deferred<void>()
    h.controls.command = async (_scope, input, proceed) => {
      const snapshot = proceed()
      if (input.type === 'append_events') await response.promise
      return snapshot
    }
    emit(h, command, 'saved before reply')
    await vi.advanceTimersByTimeAsync(750)
    expect(h.view().eventStatus).toMatchObject({
      persistedThrough: 1,
      pendingEvents: 0,
    })
    await h.owner.enqueue(identity, { type: 'close' })
    await vi.advanceTimersByTimeAsync(750)
    expect(h.view()).toMatchObject({
      phase: 'closed',
      cleanup: 'confirmed',
      eventStatus: {
        receivedThrough: 1,
        persistedThrough: 1,
        pendingEvents: 0,
        error: undefined,
      },
    })
    const closedVersion = h.view().snapshot!.session!.version
    response.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.view()).toMatchObject({
      phase: 'closed',
      cleanup: 'confirmed',
      eventStatus: { pendingEvents: 0, error: undefined },
    })
    expect(h.view().error).toBeUndefined()
    expect(h.view().snapshot!.session!.version).toBe(closedVersion)
    expect(text(h.view().events)).toBe('saved before reply')
    expect(h.bridges[0].dispose).toHaveBeenCalledTimes(1)
  })

  it.each([403, 503, null])(
    'ignores an uncertain late HTTP %s append failure only after its batch and Close are confirmed',
    async (status) => {
      const h = fixture(),
        command = await spawn(h)
      const retry = deferred<void>()
      h.controls.command = async (_scope, input, proceed) => {
        const snapshot = proceed()
        if (input.type === 'append_events') {
          await retry.promise
          // The initial response was lost. A real replay after closed lease fails.
          if (status === 403)
            expect(proceed).toThrow('lease is no longer valid')
          throw new ExecutionHttpError(status, 'Late retry failed', true)
        }
        return snapshot
      }
      emit(h, command, 'independently confirmed')
      await vi.advanceTimersByTimeAsync(750)
      expect(h.view().eventStatus.persistedThrough).toBe(1)
      await h.owner.enqueue(identity, { type: 'close' })
      await vi.advanceTimersByTimeAsync(750)
      expect(h.view().phase).toBe('closed')
      const version = h.view().snapshot!.session!.version
      retry.resolve()
      await vi.advanceTimersByTimeAsync(0)
      expect(h.view()).toMatchObject({
        phase: 'closed',
        cleanup: 'confirmed',
        eventStatus: {
          persistedThrough: 1,
          pendingEvents: 0,
          error: undefined,
        },
      })
      expect(h.view().error).toBeUndefined()
      expect(h.view().snapshot!.session!.version).toBe(version)
      expect(text(h.view().events)).toBe('independently confirmed')
    },
  )

  it.each([200, 401, 409])(
    'does not suppress late HTTP %s validation/auth/conflict errors after Close',
    async (status) => {
      const h = fixture(),
        command = await spawn(h)
      const response = deferred<void>()
      h.controls.command = async (_scope, input, proceed) => {
        const snapshot = proceed()
        if (input.type === 'append_events') {
          await response.promise
          throw new ExecutionHttpError(
            status,
            'Invalid response or rejected authority',
            true,
          )
        }
        return snapshot
      }
      emit(h, command, 'saved')
      await vi.advanceTimersByTimeAsync(750)
      await h.owner.enqueue(identity, { type: 'close' })
      await vi.advanceTimersByTimeAsync(750)
      response.resolve()
      await vi.advanceTimersByTimeAsync(0)
      expect(h.view().phase).toBe('closed')
      expect(h.view().eventStatus.error).toBeDefined()
    },
  )

  it.each([true, false])(
    'still fences live authorization failure after independent byte confirmation (uncertain=%s)',
    async (uncertain) => {
      const h = fixture(),
        command = await spawn(h)
      const response = deferred<void>()
      h.controls.command = async (_scope, input, proceed) => {
        const snapshot = proceed()
        if (input.type === 'append_events') {
          await response.promise
          throw new ExecutionHttpError(403, 'Permission revoked', uncertain)
        }
        return snapshot
      }
      emit(h, command, 'saved before revocation')
      await vi.advanceTimersByTimeAsync(750)
      expect(h.view().eventStatus.persistedThrough).toBe(1)
      response.resolve()
      await vi.advanceTimersByTimeAsync(0)
      expect(h.view().phase).toBe('disconnected')
      expect(h.view().eventStatus.error).toBeDefined()
      expect(h.bridges[0].shutdown).toHaveBeenCalledTimes(1)
    },
  )

  it('releases confirmed bytes from pending capacity even while their upload response is delayed', async () => {
    const h = fixture(),
      command = await spawn(h)
    const response = deferred<void>()
    let first = true
    h.controls.command = async (_scope, input, proceed) => {
      const snapshot = proceed()
      if (input.type === 'append_events' && first) {
        first = false
        await response.promise
      }
      return snapshot
    }
    emit(h, command, 'a'.repeat(16_384))
    await vi.advanceTimersByTimeAsync(750)
    expect(h.view().eventStatus).toMatchObject({
      persistedThrough: 1,
      pendingEvents: 0,
    })
    for (let i = 0; i < 16; i++) emit(h, command, 'b'.repeat(16_384), i + 2)
    expect(h.view()).toMatchObject({
      phase: 'ready',
      eventStatus: { receivedThrough: 17, pendingEvents: 16, error: undefined },
    })
    expect(h.bridges[0].shutdown).not.toHaveBeenCalled()
    response.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.view().eventStatus).toMatchObject({
      persistedThrough: 17,
      pendingEvents: 0,
      error: undefined,
    })
    expect(h.snapshot().events.outputBytes).toBe(17 * 16_384)
  })

  it('still rejects a late response from a different session after confirmed Close', async () => {
    const h = fixture(),
      command = await spawn(h)
    const response = deferred<void>()
    h.controls.command = async (_scope, input, proceed) => {
      const snapshot = proceed()
      if (input.type === 'append_events') {
        await response.promise
        const foreignSession = crypto.randomUUID()
        snapshot.session!.id = foreignSession
        snapshot.commands.forEach((item) => {
          item.sessionId = foreignSession
        })
        snapshot.processes.forEach((item) => {
          item.sessionId = foreignSession
        })
      }
      return snapshot
    }
    emit(h, command, 'saved')
    await vi.advanceTimersByTimeAsync(750)
    const sessionId = h.view().snapshot!.session!.id
    await h.owner.enqueue(identity, { type: 'close' })
    await vi.advanceTimersByTimeAsync(750)
    response.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.view().phase).toBe('closed')
    expect(h.view().snapshot!.session!.id).toBe(sessionId)
    expect(h.view().eventStatus.error).toBeDefined()
  })

  it('keeps unsaved output truthful and withholds acknowledgment when persistence fails', async () => {
    const h = fixture()
    await h.start()
    h.controls.command = async (_scope, input, proceed) => {
      if (input.type === 'append_events')
        throw new ExecutionHttpError(503, 'Unavailable', true)
      return proceed()
    }
    h.controls.execute = async (delivery) => {
      emit(h, delivery, 'only in this page')
      return succeeded(delivery, defaultResult(delivery))
    }
    await h.owner.enqueue(identity, {
      type: 'run',
      command: 'node',
      args: [],
      cwd: '/project',
      timeoutMs: 30_000,
    })
    await vi.advanceTimersByTimeAsync(750)
    expect(h.snapshot().events.lastSequence).toBe(0)
    expect(h.snapshot().commands[0].state).toBe('dispatched')
    expect(h.view()).toMatchObject({
      phase: 'disconnected',
      eventStatus: {
        persistedThrough: 0,
        pendingEvents: 1,
        error: expect.stringContaining('could not be saved'),
      },
    })
    expect(text(h.view().events)).toBe('only in this page')
    expect(h.bridges[0].shutdown).toHaveBeenCalledTimes(1)
  })

  it('reads persisted output and natural process exit after reload without opening or adopting an SDK', async () => {
    const h = fixture(),
      command = await spawn(h)
    emit(h, command, '\ufeffone\r\n')
    h.bridges[0].event({
      type: 'output-gap',
      commandId: command.id,
      processId: command.processId,
      droppedBytes: 5,
    })
    emit(h, command, 'three😀', 2)
    h.bridges[0].event({
      type: 'process-exit',
      commandId: command.id,
      processId: command.processId!,
      exitCode: 2,
      signal: null,
      outputDrained: true,
    })
    await vi.advanceTimersByTimeAsync(0)
    const reloaded = h.newOwner()
    const view = await reloaded.inspect(identity)
    expect(h.openBridge).toHaveBeenCalledTimes(1)
    expect(view).toMatchObject({
      phase: 'disconnected',
      localOwner: false,
      droppedBytes: 5,
      eventStatus: {
        receivedThrough: 4,
        persistedThrough: 4,
        pendingEvents: 0,
        loading: false,
      },
    })
    expect(text(view.events)).toBe('\ufeffone\r\nthree😀')
    expect(view.snapshot!.processes[0].state).toBe('exited')
    await reloaded.inspect(identity)
    expect(reloaded.getSnapshot()[0].events).toHaveLength(4)
  })

  it('resumes a failed paged read at the last verified page without duplicate bytes', async () => {
    const h = fixture(),
      command = await spawn(h)
    for (let i = 0; i < 5; i++)
      emit(h, command, String(i).repeat(16_384), i + 1)
    await vi.advanceTimersByTimeAsync(0)
    const reads: number[] = []
    h.controls.events = async (_scope, read, proceed) => {
      reads.push(read.after)
      const page = proceed()
      if (read.after === 4) page.summary.outputBytes--
      return page
    }
    const reloaded = h.newOwner()
    await expect(reloaded.inspect(identity)).rejects.toThrow(
      'could not be inspected',
    )
    expect(reads).toEqual([0, 4])
    expect(reloaded.getSnapshot()[0].eventStatus).toMatchObject({
      receivedThrough: 4,
      loading: false,
      error: expect.any(String),
    })
    expect(text(reloaded.getSnapshot()[0].events)).toBe(
      '0'.repeat(16_384) +
        '1'.repeat(16_384) +
        '2'.repeat(16_384) +
        '3'.repeat(16_384),
    )
    h.controls.events = async (_scope, read, proceed) => {
      reads.push(read.after)
      return proceed()
    }
    const recovered = await reloaded.inspect(identity)
    expect(reads).toEqual([0, 4, 4])
    expect(recovered.eventStatus).toMatchObject({
      receivedThrough: 5,
      loading: false,
      error: undefined,
    })
    expect(text(recovered.events).length).toBe(5 * 16_384)
    expect(h.openBridge).toHaveBeenCalledTimes(1)
  })

  it('ignores a late upload response after account replacement without publishing private bytes', async () => {
    const h = fixture(),
      command = await spawn(h)
    const blocked = deferred<ExecutionSessionSnapshot>()
    h.controls.command = async (_scope, input, proceed) =>
      input.type === 'append_events' ? blocked.promise : proceed()
    emit(h, command, 'account-a private output')
    await vi.advanceTimersByTimeAsync(0)
    h.owner.setAccount('account-b')
    blocked.resolve(h.snapshot())
    await vi.advanceTimersByTimeAsync(0)
    expect(h.owner.getSnapshot()).toEqual([])
    expect(h.bridges[0].shutdown).toHaveBeenCalledTimes(1)
  })

  it('retains a newer event watermark when a stale equal-version poll arrives', async () => {
    const h = fixture(),
      command = await spawn(h)
    const stale = h.snapshot()
    emit(h, command, 'retained')
    await vi.advanceTimersByTimeAsync(0)
    expect(h.snapshot().session!.version).toBe(stale.session!.version)
    h.controls.command = async (_scope, input, proceed) =>
      input.type === 'dispatch' ? stale : proceed()
    await vi.advanceTimersByTimeAsync(750)
    expect(h.view().snapshot!.events.lastSequence).toBe(1)
    expect(h.view().eventStatus.persistedThrough).toBe(1)
    expect(text(h.view().events)).toBe('retained')
  })

  it('drops late event reads after an account switch', async () => {
    const h = fixture(),
      command = await spawn(h)
    emit(h, command, 'private output')
    await vi.advanceTimersByTimeAsync(0)
    const blocked = deferred<ExecutionEventPage>()
    h.controls.events = async () => blocked.promise
    const reloaded = h.newOwner()
    const inspecting = reloaded.inspect(identity).catch((error) => error)
    await vi.advanceTimersByTimeAsync(0)
    reloaded.setAccount('account-b')
    blocked.resolve(
      h
        .store()
        .events(identity, { sessionId: h.snapshot().session!.id, after: 0 }),
    )
    expect(await inspecting).toBeInstanceOf(Error)
    expect(reloaded.getSnapshot()).toEqual([])
    expect(h.openBridge).toHaveBeenCalledTimes(1)
  })

  it.each(['runtime', 'digest', 'totals'] as const)(
    'rejects malformed %s replay without publishing its bytes',
    async (field) => {
      const h = fixture(),
        command = await spawn(h)
      emit(h, command, 'untrusted')
      await vi.advanceTimersByTimeAsync(0)
      h.controls.events = async (_scope, _read, proceed) => {
        const page = structuredClone(proceed())
        if (field === 'runtime') page.runtimeId = crypto.randomUUID()
        if (field === 'digest') page.events[0].digest = 'a'.repeat(64)
        if (field === 'totals') page.summary.outputBytes--
        return page
      }
      const reloaded = h.newOwner()
      await expect(reloaded.inspect(identity)).rejects.toThrow(
        'could not be inspected',
      )
      expect(reloaded.getSnapshot()[0].events).toEqual([])
      expect(reloaded.getSnapshot()[0].eventStatus).toMatchObject({
        receivedThrough: 0,
        loading: false,
        error: expect.any(String),
      })
      delete h.controls.events
      await reloaded.inspect(identity)
      expect(text(reloaded.getSnapshot()[0].events)).toBe('untrusted')
    },
  )
})

describe('authenticated project snapshot ownership', () => {
  const save = async (h: ReturnType<typeof fixture>, wait = true) => {
    await h.owner.enqueue(identity, { type: 'save_snapshot' })
    await vi.advanceTimersByTimeAsync(750)
    if (wait)
      await vi.waitFor(() =>
        expect(
          h.snapshot().savedSnapshots.length > 0 ||
            h.view().phase === 'disconnected',
        ).toBe(true),
      )
    return h.snapshot().savedSnapshots[0]
  }
  it('publishes exact bytes before acknowledging Save, retains the receipt through Close, and restores a fresh runtime', async () => {
    const h = fixture(),
      pending = deferred<ExecutionSessionSnapshot>()
    await h.start()
    let publish!: () => ExecutionSessionSnapshot
    h.controls.uploadSnapshot = async (_input, bytes, proceed) => {
      expect(bytes).toEqual(h.projectBytes)
      publish = proceed
      return pending.promise
    }
    await save(h, false)
    await vi.waitFor(() => expect(publish).toBeTypeOf('function'))
    expect(h.calls.filter((c) => c.input.type === 'acknowledge')).toEqual([])
    expect(h.snapshot().commands.at(-1)).toMatchObject({
      operation: { type: 'save_snapshot' },
      state: 'dispatched',
    })
    pending.resolve(publish())
    await vi.waitFor(() =>
      expect(h.snapshot().commands.at(-1)?.state).toBe('succeeded'),
    )
    const saved = h.snapshot().savedSnapshots[0]
    expect(saved.state).toBe('ready')
    expect(h.snapshot().commands.at(-1)?.state).toBe('succeeded')
    const original = h.bridges[0].connect
    await h.owner.enqueue(identity, { type: 'close' })
    await vi.advanceTimersByTimeAsync(750)
    expect(h.view().phase).toBe('closed')
    expect(h.view().snapshot!.savedSnapshots[0]).toEqual(saved)
    await h.owner.start(identity, {
      source: 'snapshot',
      snapshotId: saved.snapshotId,
      digest: saved.sha256,
    })
    const next = h.bridges[1].connect
    expect(next.sessionId).not.toBe(original.sessionId)
    expect(next.runtimeId).not.toBe(original.runtimeId)
    expect(next.snapshotBytes).toEqual(h.projectBytes)
    expect(next.project).toEqual({
      source: 'snapshot',
      snapshotId: saved.snapshotId,
      digest: saved.sha256,
    })
    expect(h.bridges[1].execute).not.toHaveBeenCalled()
  })
  it('does not acknowledge or recapture after an upload failure', async () => {
    const h = fixture()
    await h.start()
    h.controls.uploadSnapshot = async () => {
      throw new ExecutionHttpError(503, 'Unavailable', true)
    }
    await save(h)
    expect(h.snapshot().commands.at(-1)?.state).toBe('dispatched')
    expect(h.calls.filter((c) => c.input.type === 'acknowledge')).toEqual([])
    expect(h.view().phase).toBe('disconnected')
    expect(h.bridges[0].execute).toHaveBeenCalledOnce()
    expect(h.bridges[0].shutdown).toHaveBeenCalledOnce()
  })
  it('loads saved receipt on read-only reload without creating a runtime or uploading again', async () => {
    const h = fixture()
    await h.start()
    const saved = await save(h)
    const reloaded = h.newOwner()
    const view = await reloaded.inspect(identity)
    expect(view.snapshot?.savedSnapshots[0]).toEqual(saved)
    expect(view.localOwner).toBe(false)
    expect(h.openBridge).toHaveBeenCalledOnce()
  })
  it('does not create or open a runtime if authorized restore bytes are corrupt', async () => {
    const h = fixture()
    await h.start()
    const saved = await save(h)
    await h.owner.enqueue(identity, { type: 'close' })
    await vi.advanceTimersByTimeAsync(750)
    const beforeCreates = h.calls.filter(
      (c) => c.input.type === 'create',
    ).length
    h.controls.snapshotBytes = async (_record, proceed) => {
      const bytes = proceed()
      bytes[bytes.length - 1] ^= 1
      return bytes
    }
    await expect(
      h.owner.start(identity, {
        source: 'snapshot',
        snapshotId: saved.snapshotId,
        digest: saved.sha256,
      }),
    ).rejects.toThrow('could not start')
    expect(h.openBridge).toHaveBeenCalledOnce()
    expect(h.calls.filter((c) => c.input.type === 'create')).toHaveLength(
      beforeCreates,
    )
  })
  it('drops an in-flight restore read after account change without starting or exposing the old project', async () => {
    const h = fixture(),
      pending = deferred<Uint8Array<ArrayBuffer>>()
    await h.start()
    const saved = await save(h)
    await h.owner.enqueue(identity, { type: 'close' })
    await vi.advanceTimersByTimeAsync(750)
    h.controls.snapshotBytes = async () => pending.promise
    const restoring = h.owner
      .start(identity, {
        source: 'snapshot',
        snapshotId: saved.snapshotId,
        digest: saved.sha256,
      })
      .catch((error) => error)
    await vi.advanceTimersByTimeAsync(0)
    h.owner.setAccount('account-b')
    pending.resolve(h.projectBytes)
    expect(await restoring).toBeInstanceOf(Error)
    expect(h.owner.getSnapshot()).toEqual([])
    expect(h.openBridge).toHaveBeenCalledOnce()
  })
})

describe('Close during snapshot publication', () => {
  it.each(['ready', 'lease-rejected', 'conflict-rejected'] as const)(
    'retains confirmed Close after a late %s snapshot response without inventing a saved command success',
    async (result) => {
      const h = fixture(),
        pending = deferred<ExecutionSessionSnapshot>()
      let ready: ExecutionSessionSnapshot | undefined
      let uploadStarted = false
      await h.start()
      h.controls.uploadSnapshot = async (_input, _bytes, proceed) => {
        uploadStarted = true
        if (result === 'ready') ready = proceed()
        return pending.promise
      }
      await h.owner.enqueue(identity, { type: 'save_snapshot' })
      await vi.advanceTimersByTimeAsync(750)
      await vi.waitFor(() =>
        expect(h.bridges[0].bridge.readSnapshot).toHaveBeenCalledOnce(),
      )
      if (result === 'ready')
        await vi.waitFor(() => expect(ready).toBeDefined())
      // Snapshot hashing can finish later on CI. Wait for the actual upload,
      // not an elapsed timer, before closing and rejecting its deferred result.
      await vi.waitFor(() => expect(uploadStarted).toBe(true))
      // Refresh the owner's version after the ready fixture commits server state.
      await vi.advanceTimersByTimeAsync(750)
      await h.owner.enqueue(identity, { type: 'close' })
      await vi.advanceTimersByTimeAsync(750)
      await vi.waitFor(() => expect(h.view().phase).toBe('closed'))
      if (result === 'ready') pending.resolve(ready!)
      else
        pending.reject(
          new ExecutionHttpError(
            result === 'lease-rejected' ? 403 : 409,
            'Snapshot publication stopped',
            false,
          ),
        )
      await vi.advanceTimersByTimeAsync(0)
      expect(h.view()).toMatchObject({ phase: 'closed', cleanup: 'confirmed' })
      expect(h.view().error).toBeUndefined()
      const save = h
        .snapshot()
        .commands.find((item) => item.operation.type === 'save_snapshot')!
      expect(save.state).toBe('unknown')
      expect(
        h.calls.some(
          (call) =>
            call.input.type === 'acknowledge' &&
            call.input.commandId === save.id,
        ),
      ).toBe(false)
      expect(h.snapshot().savedSnapshots).toHaveLength(
        result === 'ready' ? 1 : 0,
      )
      expect(h.bridges[0].execute).toHaveBeenCalledTimes(2)
    },
  )
})

function enqueueModelRun(h: ReturnType<typeof fixture>) {
  const authority = { lifecycleGeneration: 0, membershipGeneration: 0 }
  const task = h
    .store()
    .activateTask(
      identity,
      { runId: 'model-run', taskId: 'model-task', messageId: 'message' },
      Date.now(),
    )
  const origin = {
    kind: 'run' as const,
    runId: task.runId,
    taskId: task.taskId,
    messageId: task.messageId,
    taskGeneration: task.taskGeneration,
    modelPass: 1,
    toolCallId: 'model-call',
  }
  const binding = h.store().bindTask(identity, origin, authority, Date.now())
  const receipt = h.store().enqueueTask(
    identity,
    {
      origin,
      binding,
      commandId: crypto.randomUUID(),
      operation: {
        type: 'run',
        command: 'node',
        args: [],
        cwd: '/project',
        timeoutMs: 30_000,
      },
    },
    authority,
    Date.now(),
  )
  return { origin, receipt }
}

describe('task-scoped command stopping through the durable owner', () => {
  it('stops the committed model command once and saves its real late result while keeping the user process and workspace', async () => {
    const h = fixture(),
      running = deferred<ExecutionCommandOutcome>()
    await h.start()
    await h.owner.enqueue(identity, {
      type: 'spawn',
      command: 'node',
      args: [],
      cwd: '/project',
      timeoutMs: 30_000,
    })
    await vi.advanceTimersByTimeAsync(750)
    const userProcess = h.snapshot().processes[0]!
    h.controls.execute = (delivery) =>
      delivery.origin.kind === 'run'
        ? running.promise
        : Promise.resolve(succeeded(delivery, defaultResult(delivery)))
    const task = enqueueModelRun(h)
    await vi.advanceTimersByTimeAsync(750)
    expect(
      h.bridges[0]!.execute.mock.calls.filter(
        ([d]) => d.id === task.receipt.id,
      ),
    ).toHaveLength(1)
    h.store().cancelTask(identity, task.origin.taskId, Date.now())
    await vi.advanceTimersByTimeAsync(1_500)
    expect(h.bridges[0]!.stopCommand).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        id: task.receipt.id,
        digest: task.receipt.digest,
        origin: task.origin,
        state: 'unknown',
        stopRequested: true,
      }),
    )
    expect(
      h.snapshot().commands.find((c) => c.id === task.receipt.id)?.state,
    ).toBe('unknown')
    const delivery = h.bridges[0]!.execute.mock.calls.find(
      ([d]) => d.id === task.receipt.id,
    )![0]
    h.bridges[0]!.event({
      type: 'output',
      commandId: delivery.id,
      sequence: 1,
      stream: 'stdout',
      bytes: new TextEncoder().encode('before stop\n'),
    })
    running.resolve(
      succeeded(delivery, {
        type: 'run',
        exitCode: 1,
        signal: 'SIGTERM',
        durationMs: 1_500,
      }),
    )
    await vi.advanceTimersByTimeAsync(750)
    expect(
      h.snapshot().commands.find((c) => c.id === task.receipt.id),
    ).toMatchObject({
      state: 'succeeded',
      stopRequested: true,
      result: { type: 'run', exitCode: 1, signal: 'SIGTERM' },
    })
    expect(
      h.snapshot().processes.find((p) => p.id === userProcess.id),
    ).toMatchObject({ state: 'running' })
    expect(h.view().phase).toBe('ready')
    expect(h.view().eventStatus.persistedThrough).toBe(1)
    const ack = h.calls.find(
      (c) =>
        c.input.type === 'acknowledge' && c.input.commandId === delivery.id,
    )!.input
    expect(ack).toMatchObject({ eventsThrough: 1, outcome: 'succeeded' })
    expect(h.bridges[0]!.shutdown).not.toHaveBeenCalled()
    expect(h.bridges[0]!.dispose).not.toHaveBeenCalled()
  })

  it('settles a cancelled committed dispatch without invoking an operation the browser never observed', async () => {
    const h = fixture()
    await h.start()
    const task = enqueueModelRun(h)
    const host = h.calls.find((c) => c.input.type === 'dispatch')!.input
    h.store().command(
      identity,
      host,
      { lifecycleGeneration: 0, membershipGeneration: 0 },
      Date.now(),
    )
    h.store().cancelTask(identity, task.origin.taskId, Date.now())
    await vi.advanceTimersByTimeAsync(750)
    expect(h.bridges[0]!.execute).not.toHaveBeenCalled()
    expect(h.bridges[0]!.stopCommand).toHaveBeenCalledOnce()
    expect(
      h.snapshot().commands.find((c) => c.id === task.receipt.id),
    ).toMatchObject({
      state: 'failed',
      stopRequested: true,
      error: { code: 'COMMAND_CANCELLED_BEFORE_START' },
    })
    expect(h.view().phase).toBe('ready')
    expect(h.bridges[0]!.shutdown).not.toHaveBeenCalled()
  })

  it('does not adopt or stop a remote model command during read-only inspection', async () => {
    const h = fixture(),
      pending = deferred<ExecutionCommandOutcome>()
    h.controls.execute = () => pending.promise
    await h.start()
    const task = enqueueModelRun(h)
    await vi.advanceTimersByTimeAsync(750)
    h.store().cancelTask(identity, task.origin.taskId, Date.now())
    const reader = h.newOwner()
    const view = await reader.inspect(identity)
    expect(view).toMatchObject({ localOwner: false, phase: 'disconnected' })
    expect(
      view.snapshot?.commands.find((c) => c.id === task.receipt.id),
    ).toMatchObject({ state: 'unknown', stopRequested: true })
    expect(h.openBridge).toHaveBeenCalledOnce()
    expect(h.bridges[0]!.stopCommand).not.toHaveBeenCalled()
  })
})

describe('model command owner identity fences', () => {
  it('rejects a changed task generation even when the command ID and claimed digest stay the same', async () => {
    const h = fixture(),
      pending = deferred<ExecutionCommandOutcome>()
    h.controls.execute = () => pending.promise
    await h.start()
    const task = enqueueModelRun(h)
    await vi.advanceTimersByTimeAsync(750)
    h.controls.command = async (_scope, input, proceed) => {
      const snapshot = proceed()
      if (
        input.type === 'dispatch' &&
        snapshot.delivery?.origin.kind === 'run'
      ) {
        snapshot.delivery.origin.taskGeneration += 1
        snapshot.commands.find((c) => c.id === task.receipt.id)!.origin = {
          ...snapshot.delivery.origin,
        }
      }
      return snapshot
    }
    await vi.advanceTimersByTimeAsync(750)
    expect(h.bridges[0]!.execute).toHaveBeenCalledOnce()
    expect(h.bridges[0]!.stopCommand).not.toHaveBeenCalled()
    expect(h.view().phase).toBe('disconnected')
    expect(h.view().deliveryObservations[task.receipt.id]).toBe(1)
  })

  it('does not acknowledge a late stopped-command result after the account changes', async () => {
    const h = fixture(),
      pending = deferred<ExecutionCommandOutcome>()
    h.controls.execute = () => pending.promise
    await h.start()
    const task = enqueueModelRun(h)
    await vi.advanceTimersByTimeAsync(750)
    const delivery = h.bridges[0]!.execute.mock.calls[0]![0]
    h.store().cancelTask(identity, task.origin.taskId, Date.now())
    await vi.advanceTimersByTimeAsync(750)
    expect(h.bridges[0]!.stopCommand).toHaveBeenCalledOnce()
    h.owner.setAccount('account-b')
    pending.resolve(
      succeeded(delivery, {
        type: 'run',
        exitCode: 1,
        signal: 'SIGTERM',
        durationMs: 1,
      }),
    )
    await vi.advanceTimersByTimeAsync(750)
    expect(h.calls.filter((c) => c.input.type === 'acknowledge')).toHaveLength(
      0,
    )
    expect(
      h.snapshot().commands.find((c) => c.id === task.receipt.id),
    ).toMatchObject({ state: 'unknown', stopRequested: true })
    expect(h.owner.getSnapshot()).toHaveLength(0)
  })
})

async function openOwnedPreview(h: ReturnType<typeof fixture>) {
  await h.start()
  await h.owner.enqueue(identity, {
    type: 'spawn',
    command: 'node',
    args: [],
    cwd: '/project',
    timeoutMs: 30_000,
  })
  await vi.advanceTimersByTimeAsync(750)
  const process = h.snapshot().processes[0]!
  await h.owner.enqueue(identity, {
    type: 'preview_open',
    processId: process.id,
    port: 8527,
    path: '/',
  })
  await vi.advanceTimersByTimeAsync(750)
  return {
    previewId: h
      .snapshot()
      .commands.find((c) => c.operation.type === 'preview_open')!.previewId!,
    process,
  }
}
const previewBounds = {
  left: 200,
  top: 80,
  width: 400,
  height: 300,
  clip: { left: 0, right: 0, top: 0, bottom: 0 },
}

describe('owner-scoped preview presentation', () => {
  it('shows only the exact locally owned preview and hiding it sends no execution actions', async () => {
    const h = fixture(),
      { previewId } = await openOwnedPreview(h)
    const count = h.calls.length,
      executes = h.bridges[0]!.execute.mock.calls.length
    const viewport = h.owner.attachPreviewViewport(identity, previewId)
    expect(viewport.update(previewBounds)).toBe(true)
    expect(h.bridges[0]!.bridge.setPreviewViewport).toHaveBeenLastCalledWith(
      previewBounds,
    )
    viewport.update(null)
    expect(h.bridges[0]!.bridge.setPreviewViewport).toHaveBeenLastCalledWith(
      null,
    )
    expect(viewport.update(previewBounds)).toBe(true)
    viewport.release()
    expect(viewport.update(previewBounds)).toBe(false)
    expect(h.calls).toHaveLength(count)
    expect(h.bridges[0]!.execute).toHaveBeenCalledTimes(executes)
    expect(h.bridges[0]!.shutdown).not.toHaveBeenCalled()
    expect(h.openBridge).toHaveBeenCalledOnce()
    expect(
      h.owner
        .attachPreviewViewport(
          { ...identity, conversationId: 'sibling' },
          previewId,
        )
        .update(previewBounds),
    ).toBe(false)
    expect(
      h.owner
        .attachPreviewViewport(identity, crypto.randomUUID())
        .update(previewBounds),
    ).toBe(false)
  })

  it('a replaced view release cannot hide its successor, and account changes hide before cleanup', async () => {
    const h = fixture(),
      { previewId } = await openOwnedPreview(h)
    const first = h.owner.attachPreviewViewport(identity, previewId),
      second = h.owner.attachPreviewViewport(identity, previewId)
    expect(second.update(previewBounds)).toBe(true)
    first.release()
    expect(h.bridges[0]!.bridge.setPreviewViewport).toHaveBeenLastCalledWith(
      previewBounds,
    )
    expect(first.update(previewBounds)).toBe(false)
    h.owner.setAccount('someone-else')
    expect(h.bridges[0]!.bridge.setPreviewViewport).toHaveBeenLastCalledWith(
      null,
    )
    expect(second.update(previewBounds)).toBe(false)
  })

  it('hides on an unpersisted process exit, pending preview close, and session close', async () => {
    for (const action of ['exit', 'preview_close', 'close'] as const) {
      const h = fixture(),
        { previewId, process } = await openOwnedPreview(h)
      const viewport = h.owner.attachPreviewViewport(identity, previewId)
      expect(viewport.update(previewBounds)).toBe(true)
      if (action === 'exit') {
        h.controls.command = async (_scope, input, proceed) =>
          input.type === 'append_events' ? new Promise(() => {}) : proceed()
        h.bridges[0]!.event({
          type: 'process-exit',
          commandId: process.commandId,
          processId: process.id,
          exitCode: 0,
          signal: null,
          outputDrained: true,
        })
        expect(h.snapshot().processes[0]!.state).toBe('running')
      } else
        await h.owner.enqueue(
          identity,
          action === 'close'
            ? { type: 'close' }
            : { type: 'preview_close', previewId },
        )
      expect(h.bridges[0]!.bridge.setPreviewViewport).toHaveBeenLastCalledWith(
        null,
      )
      expect(viewport.update(previewBounds)).toBe(false)
    }
  })

  it('remote inspection cannot present a preview and an expired local lease hides it', async () => {
    const h = fixture(),
      { previewId } = await openOwnedPreview(h)
    const reader = h.newOwner()
    await reader.inspect(identity)
    expect(
      reader.attachPreviewViewport(identity, previewId).update(previewBounds),
    ).toBe(false)
    expect(h.openBridge).toHaveBeenCalledOnce()
    const viewport = h.owner.attachPreviewViewport(identity, previewId)
    expect(viewport.update(previewBounds)).toBe(true)
    vi.setSystemTime(60_001)
    expect(viewport.update(previewBounds)).toBe(false)
    expect(h.bridges[0]!.bridge.setPreviewViewport).toHaveBeenLastCalledWith(
      null,
    )
  })
})
