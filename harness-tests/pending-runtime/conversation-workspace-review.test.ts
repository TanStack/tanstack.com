import type { SqlStorage } from '@cloudflare/workers-types'
import * as executionAuthority from '../../src/chat/server/execution-authority'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { newAssistantTask } from '../../src/chat/core/assistant-task'
import {
  browserExecutionRuntime,
  executionSessionCommandSchema,
  type ExecutionOperation,
  type ExecutionSessionSnapshot,
} from '../../src/chat/core/execution-sessions'
import { ConversationRuns } from '../../src/chat/server/conversation-runs'
import { conversationHarness } from './fixtures/conversation-runtime'

vi.mock('@durable-streams/server-cloudflare', () => ({
  createStreamsHandler: () => () => {
    throw new Error('Unexpected stream network request')
  },
}))

const identity = {
  workspaceId: 'w',
  userId: '00000000-0000-4000-8000-000000000001',
  botId: 'b',
  conversationId: 'main-conversation',
}
const now = Date.parse('2030-01-01T00:00:00Z')
const operation = {
  type: 'write_file' as const,
  path: '/project/result.txt',
  text: '  exact text\r\n<script>data</script>\n',
}
function snapshot(result: any): ExecutionSessionSnapshot {
  if (!result.ok) throw new Error(result.error)
  return result.snapshot
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function setup() {
  vi.stubGlobal('__GUM_LOCAL_DEVELOPMENT__', true)
  vi.spyOn(Date, 'now').mockReturnValue(now)
  const task = newAssistantTask(
    'Write the synthetic workspace file.',
    'original',
  )
  task.modelPasses = 1
  const h = await conversationHarness({
    identity,
    currentRunId: 'original',
    assistantTask: task,
    messages: [
      {
        id: 'original',
        role: 'user',
        parts: [{ type: 'text', content: task.objective }],
      },
    ],
  })
  Object.assign(h.env, { APP_MODE: 'auth-test', GUM_DEV_EXECUTION: 'enabled' })
  const runs = new ConversationRuns(h.ctx.storage.sql as unknown as SqlStorage)
  runs.accept({
    id: 'original',
    origin: { kind: 'user', messageId: 'original' },
    identity,
    mode: 'assistant',
    status: 'running',
    createdAt: now,
    startedAt: now,
    assistantTaskId: task.id,
    executionId: 'original-execution',
  })
  const created = snapshot(
    await h.c.changeExecution(identity, {
      type: 'create',
      commandId: crypto.randomUUID(),
      runtime: browserExecutionRuntime,
      project: { source: 'trusted-fixture', digest: 'a'.repeat(64) },
    }),
  )
  const claim = executionSessionCommandSchema.parse({
    type: 'claim',
    commandId: crypto.randomUUID(),
    sessionId: created.session!.id,
    expectedVersion: created.session!.version,
    ownerInstanceId: crypto.randomUUID(),
    runtimeId: crypto.randomUUID(),
    leaseProof: Buffer.alloc(32, 51).toString('base64url'),
    runtime: browserExecutionRuntime,
  })
  if (claim.type !== 'claim') throw new Error('Invalid test claim')
  const claimed = snapshot(await h.c.changeExecution(identity, claim))
  const fence = {
    sessionId: claimed.session!.id,
    hostGeneration: claimed.session!.hostGeneration,
    ownerInstanceId: claim.ownerInstanceId,
    runtimeId: claim.runtimeId,
    leaseProof: claim.leaseProof,
  }
  const c = h.c as any
  c.state.status = 'running'
  c.abort = new AbortController()
  c.executionTaskActivation = {
    runId: 'original',
    taskId: task.id,
    messageId: task.messageId,
  }
  await c.save()
  return {
    ...h,
    private: c,
    task,
    fence,
    approvalInput: { ...h.input('unused'), fixture: false },
    propose: (value: ExecutionOperation = operation, toolCallId = 'call-1') =>
      c.assistantWorkspaceOperation(task.id, value, toolCallId),
    commands: () => snapshotResult(h.c),
  }
}
async function snapshotResult(
  c: Awaited<ReturnType<typeof conversationHarness>>['c'],
) {
  return snapshot(await c.executionSnapshot(identity))
}
async function pending(
  h: Awaited<ReturnType<typeof setup>>,
  value: ExecutionOperation = operation,
) {
  const result = await h.propose(value)
  expect(result).toMatchObject({ status: 'awaiting_user_approval' })
  h.private.state.status = 'idle'
  h.private.state.assistantTask.status = 'waiting'
  await h.private.save()
  return (await h.c.snapshot()).approvals.find(
    (item) => item.id === result.approvalId,
  )!
}
function stored(h: Awaited<ReturnType<typeof setup>>) {
  return JSON.parse(
    h.local.prepare('SELECT json FROM state WHERE id=1').get()!.json as string,
  )
}

describe('native workspace review durability', () => {
  it('keeps exact arguments and binding in a durable pending review without dispatching work', async () => {
    const h = await setup()
    const review = await pending(h)
    expect(review.workspace).toMatchObject({
      operation,
      sessionId: h.fence.sessionId,
      runtimeId: h.fence.runtimeId,
      hostGeneration: h.fence.hostGeneration,
      origin: {
        taskId: h.task.id,
        runId: 'original',
        modelPass: 1,
        toolCallId: 'call-1',
      },
    })
    expect(JSON.parse(review.code)).toEqual(operation)
    expect((await h.commands()).commands).toEqual([])
    expect(stored(h).approvals).toEqual([review])
    expect(await h.propose()).toMatchObject({
      approvalId: review.id,
      status: 'awaiting_user_approval',
    })
    expect(await h.propose({ ...operation, text: 'changed' })).toMatchObject({
      ok: false,
      status: 409,
    })
    expect((await h.c.snapshot()).approvals).toHaveLength(1)
  })

  it('does not retain a phantom proposal after an outer alarm rollback, and retries durably', async () => {
    const h = await setup()
    await h.ctx.storage.deleteAlarm()
    h.ctx.storage.setAlarm.mockRejectedValueOnce(
      new Error('Alarm commit failed'),
    )
    await expect(h.propose()).rejects.toThrow('Alarm commit failed')
    expect(stored(h).approvals).toEqual([])
    expect((await h.c.snapshot()).approvals).toEqual([])
    const review = await pending(h)
    expect(stored(h).approvals).toEqual([review])
    expect((await h.commands()).commands).toEqual([])
  })

  it('restores pending review and no command after an approval SQL failure', async () => {
    const h = await setup()
    const review = await pending(h)
    vi.spyOn(h.ctx.storage, 'transactionSync').mockImplementationOnce(() => {
      throw new Error('Approval SQL failed')
    })
    await expect(
      h.c.decideApproval(review.id, true, h.approvalInput),
    ).rejects.toThrow('Approval SQL failed')
    expect((await h.c.snapshot()).approvals).toEqual(stored(h).approvals)
    expect((await h.c.snapshot()).approvals[0].status).toBe('pending')
    expect((await h.commands()).commands).toEqual([])
    await h.c.stop()
  })

  it('preserves the real stream patch base after an approval alarm rollback and retry', async () => {
    const h = await setup()
    const { ConversationStream } = await vi.importActual<
      typeof import('../../src/chat/server/conversation-stream')
    >('../../src/chat/server/conversation-stream')
    const stream = new ConversationStream(h.ctx as any, h.env as any)
    vi.spyOn(stream, 'flush').mockResolvedValue(undefined)
    h.private.stream = stream
    const review = await pending(h)
    await h.ctx.storage.deleteAlarm()
    h.ctx.storage.setAlarm.mockRejectedValueOnce(
      new Error('Alarm commit failed'),
    )
    await expect(
      h.c.decideApproval(review.id, true, h.approvalInput),
    ).rejects.toThrow('Alarm commit failed')
    expect((await h.c.snapshot()).approvals[0].status).toBe('pending')
    expect((await h.commands()).commands).toEqual([])
    const before = h.local
      .prepare('SELECT max(id) AS id FROM stream_outbox')
      .get()!.id as number
    await h.c.decideApproval(review.id, true, h.approvalInput)
    const events = h.local
      .prepare('SELECT events FROM stream_outbox WHERE id>? ORDER BY id')
      .all(before)
      .map((row) => JSON.parse(row.events as string))
      .flat()
    expect(JSON.stringify(events)).toContain('running')
    expect(JSON.stringify(events)).toContain(review.id)
    expect(events).toContainEqual({
      type: 'RUN_STARTED',
      threadId: identity.conversationId,
      runId: 'session',
    })
    expect((await h.commands()).commands).toHaveLength(1)
    await h.c.stop()
    await h.settle()
  })

  it('cancels a pending review on Stop and refuses a late approval', async () => {
    const h = await setup()
    const review = await pending(h)
    await h.c.stop()
    expect((await h.c.snapshot()).approvals[0]).toMatchObject({
      status: 'rejected',
      executionOutcome: 'rejected',
    })
    await expect(
      h.c.decideApproval(review.id, true, h.approvalInput),
    ).rejects.toThrow('already been handled')
    expect((await h.commands()).commands).toEqual([])
  })

  it('does not enqueue after Stop during the awaited authority read', async () => {
    const h = await setup()
    const review = await pending(h)
    let enter!: () => void
    let resume!: () => void
    const entered = {
      promise: new Promise<void>((resolve) => {
        enter = resolve
      }),
      resolve: () => enter(),
    }
    const release = {
      promise: new Promise<void>((resolve) => {
        resume = resolve
      }),
      resolve: () => resume(),
    }
    const readAuthority = executionAuthority.readExecutionAuthority
    vi.spyOn(executionAuthority, 'readExecutionAuthority').mockImplementation(
      async (...args) => {
        const authority = await readAuthority(...args)
        entered.resolve()
        await release.promise
        return authority
      },
    )
    const decision = h.c.decideApproval(review.id, true, h.approvalInput)
    const rejected = expect(decision).rejects.toThrow('no longer active')
    await entered.promise
    await h.c.stop()
    release.resolve()
    await rejected
    expect((await h.commands()).commands).toEqual([])
    expect((await h.c.snapshot()).approvals[0].status).toBe('rejected')
  })

  it('does not propose a declined operation again under a new model pass and tool call', async () => {
    const h = await setup()
    const review = await pending(h)
    const continuation = vi
      .spyOn(h.private, 'resumeAssistantAction')
      .mockResolvedValue(undefined)
    await h.c.decideApproval(review.id, false, h.approvalInput)
    await h.settle()
    expect(continuation).toHaveBeenCalledOnce()
    h.private.state.assistantTask.modelPasses++
    expect(await h.propose(operation, 'new-call')).toMatchObject({
      approvalId: review.id,
      status: 'already_attempted',
      outcome: 'rejected',
    })
    expect((await h.c.snapshot()).approvals).toHaveLength(1)
    expect((await h.commands()).commands).toEqual([])
  })

  it('admits one command for concurrent approval requests and does not continue after Stop', async () => {
    const h = await setup()
    const review = await pending(h)
    await Promise.all([
      h.c.decideApproval(review.id, true, h.approvalInput),
      h.c.decideApproval(review.id, true, h.approvalInput),
    ])
    expect((await h.commands()).commands).toHaveLength(1)
    const continuation = vi
      .spyOn(h.private, 'resumeAssistantAction')
      .mockResolvedValue(undefined)
    await h.c.stop()
    await h.settle()
    expect((await h.commands()).commands[0]).toMatchObject({
      state: 'cancelled',
      stopRequested: true,
    })
    expect(continuation).not.toHaveBeenCalled()
  })

  it('retains an idle review across reconstruction but does not adopt a replacement runtime', async () => {
    const h = await setup()
    const review = await pending(h)
    const restored = await h.reconstruct()
    expect((await restored.snapshot()).approvals).toEqual([review])
    vi.mocked(Date.now).mockReturnValue(now + 61000)
    const expired = snapshot(await restored.executionSnapshot(identity))
    expect(expired.session!.status).toBe('disconnected')
    await restored.changeExecution(identity, {
      type: 'abandon',
      sessionId: expired.session!.id,
      commandId: crypto.randomUUID(),
      expectedVersion: expired.session!.version,
    })
    const fresh = snapshot(
      await restored.changeExecution(identity, {
        type: 'create',
        commandId: crypto.randomUUID(),
        runtime: browserExecutionRuntime,
        project: { source: 'trusted-fixture', digest: 'b'.repeat(64) },
      }),
    )
    snapshot(
      await restored.changeExecution(identity, {
        type: 'claim',
        sessionId: fresh.session!.id,
        commandId: crypto.randomUUID(),
        expectedVersion: fresh.session!.version,
        ownerInstanceId: crypto.randomUUID(),
        runtimeId: crypto.randomUUID(),
        leaseProof: Buffer.alloc(32, 65).toString('base64url'),
        runtime: browserExecutionRuntime,
      }),
    )
    await expect(
      restored.decideApproval(review.id, true, h.approvalInput),
    ).rejects.toThrow('ready browser workspace')
    expect((await snapshotResult(restored)).commands).toEqual([])
    expect((await restored.snapshot()).approvals[0].workspace).toEqual(
      review.workspace,
    )
  })

  it('cancels the review when its originating model pass is interrupted by reconstruction', async () => {
    const h = await setup()
    const proposed = await h.propose()
    expect(stored(h).status).toBe('running')
    const restored = await h.reconstruct()
    expect((await restored.snapshot()).approvals[0]).toMatchObject({
      id: proposed.approvalId,
      status: 'rejected',
      executionOutcome: 'rejected',
    })
    expect((await snapshotResult(restored)).commands).toEqual([])
  })

  it('updates a stopped unknown review from a late confirmed receipt without resuming the task', async () => {
    const h = await setup()
    const review = await pending(h)
    await h.c.decideApproval(review.id, true, h.approvalInput)
    const delivered = snapshot(
      await h.c.changeExecution(identity, { type: 'dispatch', ...h.fence }),
    ).delivery!
    const continuation = vi
      .spyOn(h.private, 'resumeAssistantAction')
      .mockResolvedValue(undefined)
    await h.c.stop()
    await h.settle()
    expect((await h.c.snapshot()).approvals[0]).toMatchObject({
      status: 'error',
      executionOutcome: 'unknown',
    })
    const flushStream = h.private.flushStream.bind(h.private)
    const streamFlush = vi
      .spyOn(h.private, 'flushStream')
      .mockImplementation(async () => {
        // A stream subscriber must see the durable correction, never a patch
        // from an open transaction that could still roll back.
        expect(h.local.isTransaction).toBe(false)
        expect(stored(h).approvals[0]).toMatchObject({
          status: 'done',
          executionOutcome: 'succeeded',
        })
        await flushStream()
      })
    const activityFlush = vi.spyOn(h.private, 'flushActivity')
    const acknowledgement = {
      type: 'acknowledge' as const,
      ...h.fence,
      commandId: delivered.id,
      digest: delivered.digest,
      eventsThrough: 0,
      outcome: 'succeeded' as const,
      result: {
        type: 'write_file' as const,
        byteLength: Buffer.byteLength(operation.text),
        sha256: createHash('sha256').update(operation.text).digest('hex'),
      },
    }
    const final = snapshot(await h.c.changeExecution(identity, acknowledgement))
    expect(final.commands[0].state).toBe('succeeded')
    expect((await h.c.snapshot()).approvals[0]).toMatchObject({
      status: 'done',
      executionOutcome: 'succeeded',
    })
    expect((await h.c.snapshot()).assistantTask!.status).toBe('interrupted')
    expect(stored(h).approvals[0].executionOutcome).toBe('succeeded')
    expect(streamFlush).toHaveBeenCalledOnce()
    expect(activityFlush).toHaveBeenCalledOnce()
    await h.c.changeExecution(identity, acknowledgement)
    expect(continuation).not.toHaveBeenCalled()
    expect((await h.commands()).commands).toHaveLength(1)
    expect(streamFlush).toHaveBeenCalledOnce()
    expect(activityFlush).toHaveBeenCalledOnce()

    // Ordinary user commands have no assistant review to correct. Their host
    // acknowledgements must not trigger the late-review publication path.
    const userCommandId = crypto.randomUUID()
    snapshot(
      await h.c.changeExecution(identity, {
        type: 'enqueue',
        sessionId: h.fence.sessionId,
        commandId: userCommandId,
        expectedVersion: final.session!.version,
        operation: { ...operation, path: '/project/user-requested.txt' },
      }),
    )
    const userDelivery = snapshot(
      await h.c.changeExecution(identity, {
        type: 'dispatch',
        ...h.fence,
      }),
    ).delivery!
    expect(userDelivery.id).toBe(userCommandId)
    snapshot(
      await h.c.changeExecution(identity, {
        ...acknowledgement,
        commandId: userCommandId,
        digest: userDelivery.digest,
      }),
    )
    expect(streamFlush).toHaveBeenCalledOnce()
    expect(activityFlush).toHaveBeenCalledOnce()
    expect(continuation).not.toHaveBeenCalled()
  })
})
