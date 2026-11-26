import { describe, expect, it } from 'vitest'
import { emptyExecutionEventSummary } from '../../src/chat/core/execution-events'
import {
  browserExecutionRuntime,
  type ExecutionReceipt,
  type ExecutionSessionSnapshot,
} from '../../src/chat/core/execution-sessions'
import {
  canDisplayExecutionPreview,
  deriveExecutionPreviews,
  openExecutionPreview,
} from '../../src/chat/core/execution-preview'

const sessionId = '10000000-0000-4000-8000-000000000001'
const runtimeId = '10000000-0000-4000-8000-000000000002'
const processId = '10000000-0000-4000-8000-000000000003'
const previewId = '10000000-0000-4000-8000-000000000004'
const spawnId = '10000000-0000-4000-8000-000000000005'
const openId = '10000000-0000-4000-8000-000000000006'
const local = { localOwner: true, phase: 'ready' }
function receipt(change: Partial<ExecutionReceipt>): ExecutionReceipt {
  return {
    id: crypto.randomUUID(),
    sessionId,
    runtimeId,
    hostGeneration: 1,
    digest: 'a'.repeat(64),
    origin: { kind: 'user' },
    operation: { type: 'read_file', path: '/project/a.txt' },
    state: 'succeeded',
    stopRequested: false,
    createdAt: 1,
    dispatchedAt: 2,
    completedAt: 3,
    ...change,
  }
}
function fixture(): ExecutionSessionSnapshot {
  return {
    session: {
      id: sessionId,
      identity: {
        userId: 'u',
        workspaceId: 'w',
        botId: 'b',
        conversationId: 'c',
      },
      version: 1,
      status: 'ready',
      runtimeId,
      hostGeneration: 1,
      ownerInstanceId: crypto.randomUUID(),
      leaseExpiresAt: 60000,
      authority: { lifecycleGeneration: 1, membershipGeneration: 1 },
      runtime: browserExecutionRuntime,
      project: { source: 'trusted-fixture', digest: 'b'.repeat(64) },
      createdAt: 0,
      updatedAt: 1,
    },
    commands: [
      receipt({
        id: spawnId,
        processId,
        operation: {
          type: 'spawn',
          command: 'node',
          args: ['server.cjs'],
          cwd: '/project',
          timeoutMs: 30000,
        },
        result: { type: 'spawn', processId, pid: 2, status: 'running' },
      }),
      receipt({
        id: openId,
        previewId,
        operation: {
          type: 'preview_open',
          processId,
          port: 8080,
          path: '/app',
        },
        result: {
          type: 'preview_open',
          processId,
          previewId,
          title: 'Page',
          text: 'Open evidence',
          truncated: false,
        },
        completedAt: 4,
      }),
    ],
    processes: [
      {
        id: processId,
        sessionId,
        runtimeId,
        hostGeneration: 1,
        commandId: spawnId,
        pid: 2,
        state: 'running',
        createdAt: 3,
      },
    ],
    savedSnapshots: [],
    events: emptyExecutionEventSummary(),
    deferred: [],
  }
}
function close(state: ExecutionReceipt['state']) {
  return receipt({
    operation: { type: 'preview_close', previewId },
    state,
    ...(state === 'succeeded'
      ? {
          result: {
            type: 'preview_close' as const,
            previewId,
            closed: true as const,
          },
        }
      : {}),
  })
}

describe('execution preview evidence and display eligibility', () => {
  it('retains exact port/path metadata, but requires a ready local owner to label it live', () => {
    const snapshot = fixture()
    expect(deriveExecutionPreviews(snapshot)).toEqual([
      {
        id: previewId,
        openCommandId: openId,
        processId,
        port: 8080,
        path: '/app',
        data: { title: 'Page', text: 'Open evidence', truncated: false },
        closed: false,
        closing: false,
        live: false,
      },
    ])
    expect(openExecutionPreview(snapshot, previewId)?.live).toBe(true)
    expect(deriveExecutionPreviews(snapshot, local)[0].live).toBe(true)
    expect(canDisplayExecutionPreview(snapshot, previewId, local)).toBe(true)
    expect(
      canDisplayExecutionPreview(snapshot, previewId, {
        localOwner: false,
        phase: 'ready',
      }),
    ).toBe(false)
    expect(
      canDisplayExecutionPreview(snapshot, previewId, {
        localOwner: true,
        phase: 'disconnected',
      }),
    ).toBe(false)
    expect(openExecutionPreview(snapshot, crypto.randomUUID())).toBeUndefined()
    expect(deriveExecutionPreviews(null)).toEqual([])
    expect(deriveExecutionPreviews(undefined)).toEqual([])
  })

  it('keeps historical text after process exit/Stop while refusing interactive display', () => {
    for (const state of ['exited', 'stopped', 'unknown'] as const) {
      const snapshot = fixture()
      snapshot.processes[0].state = state
      expect(openExecutionPreview(snapshot, previewId)).toBeUndefined()
      expect(deriveExecutionPreviews(snapshot, local)[0]).toMatchObject({
        closed: false,
        live: false,
        data: { text: 'Open evidence' },
      })
    }
    const snapshot = fixture()
    const exits = new Set([processId])
    expect(openExecutionPreview(snapshot, previewId, exits)).toBeUndefined()
    expect(
      deriveExecutionPreviews(snapshot, {
        ...local,
        exitedProcessIds: exits,
      })[0].live,
    ).toBe(false)
    expect(snapshot.processes[0].state).toBe('running')
    expect(deriveExecutionPreviews(snapshot, local)[0].closed).toBe(false)
  })

  it('does not revive previews from closed, closing or historical disconnected sessions', () => {
    for (const status of [
      'closing',
      'closed',
      'disconnected',
      'abandoned',
      'awaiting_host',
    ] as const) {
      const snapshot = fixture()
      snapshot.session!.status = status
      expect(openExecutionPreview(snapshot, previewId)).toBeUndefined()
      expect(deriveExecutionPreviews(snapshot, local)[0].live).toBe(false)
      expect(deriveExecutionPreviews(snapshot, local)[0].data.text).toBe(
        'Open evidence',
      )
      expect(deriveExecutionPreviews(snapshot, local)[0].closed).toBe(
        status === 'closed',
      )
      expect(deriveExecutionPreviews(snapshot, local)[0].closing).toBe(
        status === 'closing',
      )
    }
  })

  it('hides accepted Close immediately, retains uncertainty, and distinguishes cancellation from confirmed closure', () => {
    for (const state of [
      'queued',
      'dispatched',
      'running',
      'unknown',
      'succeeded',
    ] as const) {
      const snapshot = fixture()
      snapshot.commands.push(close(state))
      expect(openExecutionPreview(snapshot, previewId)).toBeUndefined()
      const preview = deriveExecutionPreviews(snapshot, local)[0]
      expect(preview).toMatchObject({
        closed: state === 'succeeded',
        closing: state !== 'succeeded',
        live: false,
      })
    }
    for (const state of ['cancelled', 'failed'] as const) {
      const snapshot = fixture()
      snapshot.commands.push(close(state))
      expect(openExecutionPreview(snapshot, previewId)?.live).toBe(true)
    }
  })

  it('requires exact runtime, generation, process and acquired spawn identity, even before parser validation', () => {
    const changes: Array<(snapshot: ExecutionSessionSnapshot) => void> = [
      (s) => {
        s.commands[1].runtimeId = crypto.randomUUID()
      },
      (s) => {
        s.commands[1].sessionId = crypto.randomUUID()
      },
      (s) => {
        s.commands[1].hostGeneration = 2
      },
      (s) => {
        s.commands[1].result = {
          ...s.commands[1].result!,
          processId: crypto.randomUUID(),
        } as never
      },
      (s) => {
        s.processes[0].runtimeId = crypto.randomUUID()
      },
      (s) => {
        s.processes[0].sessionId = crypto.randomUUID()
      },
      (s) => {
        s.processes[0].hostGeneration = 2
      },
      (s) => {
        s.processes[0].commandId = crypto.randomUUID()
      },
      (s) => {
        s.processes[0].pid = 9
      },
      (s) => {
        s.commands[0].state = 'failed'
      },
      (s) => {
        s.commands[0].runtimeId = crypto.randomUUID()
      },
      (s) => {
        s.commands.push({ ...s.commands[1], id: crypto.randomUUID() })
      },
    ]
    for (const change of changes) {
      const snapshot = fixture()
      change(snapshot)
      expect(openExecutionPreview(snapshot, previewId)).toBeUndefined()
      expect(canDisplayExecutionPreview(snapshot, previewId, local)).toBe(false)
    }
  })

  it('uses the newest matching completed inspection, not failed, pending or foreign evidence', () => {
    const snapshot = fixture()
    const inspect = (completedAt: number, text: string) =>
      receipt({
        operation: { type: 'preview_inspect', previewId },
        result: {
          type: 'preview_inspect',
          previewId,
          title: 'Inspected',
          text,
          truncated: true,
        },
        completedAt,
      })
    snapshot.commands.push(
      inspect(10, 'Latest evidence'),
      inspect(8, 'Older completion'),
    )
    snapshot.commands.push({ ...inspect(12, 'Pending text'), state: 'running' })
    snapshot.commands.push({
      ...inspect(13, 'Wrong runtime'),
      runtimeId: crypto.randomUUID(),
    })
    snapshot.commands.push({
      ...inspect(14, 'Wrong target'),
      result: {
        type: 'preview_inspect',
        previewId: crypto.randomUUID(),
        title: 'Wrong',
        text: 'Wrong target',
        truncated: false,
      },
    })
    expect(deriveExecutionPreviews(snapshot, local)[0].data).toEqual({
      title: 'Inspected',
      text: 'Latest evidence',
      truncated: true,
    })
    snapshot.commands.push(close('succeeded'))
    expect(deriveExecutionPreviews(snapshot, local)[0]).toMatchObject({
      closed: true,
      live: false,
      data: { text: 'Latest evidence' },
    })
  })
})
