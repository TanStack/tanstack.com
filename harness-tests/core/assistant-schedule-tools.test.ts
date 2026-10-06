import type { SqlStorage } from '@cloudflare/workers-types'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { convertSchemaToJsonSchema } from '@tanstack/ai'
import { assistantScheduleTools } from '../../src/chat/server/assistant-schedule-tools'
import {
  ScheduleStore,
  ScheduleStoreError,
} from '../../src/chat/server/schedules'
import {
  scheduleCommandSchema,
  type ScheduleCommand,
  type ScheduleSnapshot,
} from '../../src/chat/core/schedules'

const identity = {
  workspaceId: 'workspace',
  userId: 'viewer',
  botId: 'assistant',
  conversationId: 'exact:child/conversation',
}
const spec = {
  name: 'Morning review',
  objective: 'Review new messages.',
  timezone: 'America/Denver',
  recurrence: { kind: 'daily' as const, hour: 9, minute: 0 },
}
const context = (toolCallId = 'call') => ({
  toolCallId,
  emitCustomEvent: () => {},
})
const databases: DatabaseSync[] = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const db of databases.splice(0)) db.close()
})

function fixture(taskId = 'manual-task', canManage = true) {
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
  const store = new ScheduleStore(sql)
  const list = vi.fn(async (): Promise<ScheduleSnapshot> => store.snapshot())
  const change = vi.fn(async (command: ScheduleCommand) => {
    try {
      store.command(identity, command, Date.parse('2026-09-23T12:00:00Z'))
      return { ok: true as const, snapshot: store.snapshot() }
    } catch (cause) {
      if (cause instanceof ScheduleStoreError)
        return {
          ok: false as const,
          status: cause.status,
          error: cause.message,
        }
      throw cause
    }
  })
  const tools = assistantScheduleTools({ taskId, canManage, list, change })
  const read = tools.find((tool) => tool.name === 'list_schedules')!
  const manage = tools.find((tool) => tool.name === 'manage_schedule')
  return { db, store, list, change, tools, read, manage }
}

describe('native schedule tool boundaries', () => {
  it('resolves a one-time date from one clock reading without changing schedules', async () => {
    const f = fixture()
    const clock = vi
      .spyOn(Date, 'now')
      .mockReturnValue(Date.parse('2026-09-23T12:00:00Z'))
    const resolver = f.tools.find(
      (tool) => tool.name === 'resolve_schedule_time',
    )!
    const result = await resolver.execute!({
      timezone: 'UTC',
      delaySeconds: 1200,
    } as never)
    expect(result).toMatchObject({
      now: {
        at: Date.parse('2026-09-23T12:00:00Z'),
        iso: '2026-09-23T12:00:00.000Z',
      },
      resolved: {
        at: Date.parse('2026-09-23T12:20:00Z'),
        iso: '2026-09-23T12:20:00.000Z',
        timezone: 'UTC',
      },
    })
    expect(clock).toHaveBeenCalledTimes(1)
    expect(f.change).not.toHaveBeenCalled()
    expect(f.list).not.toHaveBeenCalled()
    expect(f.store.snapshot().schedules).toEqual([])
  })

  it('returns authoritative next-run dates for model answers without changing stored schedule data', async () => {
    const f = fixture()
    const created = (await f.manage!.execute!(
      { type: 'create', spec } as never,
      context(),
    )) as any
    const schedule = created.snapshot.schedules[0]
    expect(schedule.nextRun).toEqual({
      iso: '2026-09-23T15:00:00.000Z',
      local: expect.stringContaining('September 23, 2026'),
      timezone: 'America/Denver',
    })
    expect(schedule.nextRun.local).toContain('Wednesday')
    expect(schedule.nextRun.local).toContain('9:00:00 AM')
    const listed = (await f.read.execute!({})) as any
    expect(listed.schedules[0].nextRun).toEqual(schedule.nextRun)
    expect(f.store.snapshot().schedules[0]).not.toHaveProperty('nextRun')
    const paused = (await f.manage!.execute!(
      { type: 'pause', id: schedule.id, revision: schedule.revision } as never,
      context('pause'),
    )) as any
    expect(paused.snapshot.schedules[0].nextRun).toBeNull()
  })

  it('advertises named function parameters while enforcing command-specific fields at execution', async () => {
    const f = fixture()
    const schema = convertSchemaToJsonSchema(f.manage!.inputSchema!) as any
    expect(schema.type).toBe('object')
    expect(schema.required).toEqual(['type'])
    expect(Object.keys(schema.properties).sort()).toEqual([
      'id',
      'occurrenceId',
      'revision',
      'spec',
      'type',
    ])
    expect(schema.oneOf).toBeUndefined()
    const id = crypto.randomUUID()
    for (const input of [
      { type: 'create' },
      { type: 'create', spec, id, revision: 1 },
      { type: 'update', spec },
      { type: 'pause', id },
      { type: 'resume', id, revision: 1, spec },
      { type: 'delete', id, revision: 1, occurrenceId: id },
      { type: 'run-now', id, revision: 1, spec },
      { type: 'cancel-run', id, revision: 1 },
      { type: 'cancel-run', occurrenceId: id, spec },
    ]) {
      await expect(
        f.manage!.execute!(input as never, context()),
      ).rejects.toThrow()
    }
    expect(f.change).not.toHaveBeenCalled()
    expect(f.store.snapshot().schedules).toEqual([])
  })

  it('exports provider-portable reference schemas while retaining strict execute-time validation', async () => {
    const f = fixture()
    const schema = convertSchemaToJsonSchema(f.manage!.inputSchema)
    const patterns: string[] = []
    const visit = (value: unknown) => {
      if (!value || typeof value !== 'object') return
      for (const [key, item] of Object.entries(value)) {
        if (key === 'pattern' && typeof item === 'string') patterns.push(item)
        else visit(item)
      }
    }
    visit(schema)
    expect(patterns.length).toBeGreaterThan(0)
    for (const pattern of patterns) expect(pattern).not.toMatch(/\\[pP]\{/)
    for (const reference of [
      { kind: 'conversation', botId: 'bad/id' },
      { kind: 'connection', serverId: 'hidden\u200bserver' },
      { kind: 'tool', serverId: 'server', toolName: 'hidden\u200btool' },
      { kind: 'tool', serverId: 'server', toolName: 'bad\nname' },
      { kind: 'tool', serverId: 'server', toolName: '\ud800' },
    ]) {
      await expect(
        f.manage!.execute!(
          {
            type: 'create',
            spec: { ...spec, references: [reference] },
          } as never,
          context(),
        ),
      ).rejects.toThrow()
    }
    expect(f.change).not.toHaveBeenCalled()
    expect(f.store.snapshot().schedules).toEqual([])
  })
  it('lists only the injected exact-conversation callback result and current UTC time', async () => {
    const f = fixture()
    f.store.command(
      identity,
      { type: 'create', commandId: crypto.randomUUID(), spec },
      Date.parse('2026-09-23T12:00:00Z'),
    )
    const before = Date.now()
    const result = (await f.read.execute!({})) as ScheduleSnapshot & {
      now: string
    }
    expect(f.list).toHaveBeenCalledExactlyOnceWith()
    expect(f.change).not.toHaveBeenCalled()
    expect(result.schedules).toHaveLength(1)
    expect(result.schedules[0].identity).toEqual(identity)
    expect(Date.parse(result.now)).toBeGreaterThanOrEqual(before)
    expect(Date.parse(result.now)).toBeLessThanOrEqual(Date.now())
    expect(
      (f.read.inputSchema as any).safeParse({ conversationId: 'other' })
        .success,
    ).toBe(false)
  })

  it('exposes mutation capability only when the host permits manual management', async () => {
    const scheduled = fixture('scheduled-task', false)
    expect(scheduled.tools.map((tool) => tool.name)).toEqual(['list_schedules'])
    await scheduled.read.execute!({})
    expect(scheduled.change).not.toHaveBeenCalled()
    expect(fixture('manual-task', true).tools.map((tool) => tool.name)).toEqual(
      ['list_schedules', 'manage_schedule', 'resolve_schedule_time'],
    )
  })

  it('rejects a missing call ID and already-aborted requests before mutation', async () => {
    const f = fixture()
    const abort = new AbortController()
    abort.abort()
    for (const ctx of [
      undefined,
      context(''),
      { ...context(), abortSignal: abort.signal },
    ])
      expect(
        await f.manage!.execute!({ type: 'create', spec } as never, ctx),
      ).toMatchObject({
        ok: false,
        error: 'The scheduling request is no longer active.',
      })
    expect(f.change).not.toHaveBeenCalled()
    expect(f.store.snapshot().schedules).toEqual([])
  })

  it('rechecks cancellation after asynchronous command hashing', async () => {
    const f = fixture()
    const abort = new AbortController()
    const digest = crypto.subtle.digest.bind(crypto.subtle)
    vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (...args) => {
      const result = await digest(...args)
      abort.abort()
      return result
    })
    expect(
      await f.manage!.execute!({ type: 'create', spec } as never, {
        ...context(),
        abortSignal: abort.signal,
      }),
    ).toMatchObject({ ok: false, error: 'The scheduling request was stopped.' })
    expect(f.change).not.toHaveBeenCalled()
  })

  it('reuses a valid command UUID across reconstruction and same-call retries without duplicate schedules', async () => {
    const f = fixture()
    const input = { type: 'create', spec }
    const first = await f.manage!.execute!(input as never, context())
    const rebuilt = assistantScheduleTools({
      taskId: 'manual-task',
      canManage: true,
      list: f.list,
      change: f.change,
    }).find((tool) => tool.name === 'manage_schedule')!
    expect(await rebuilt.execute!(input as never, context())).toEqual(first)
    expect(f.change).toHaveBeenCalledTimes(2)
    const [one, two] = f.change.mock.calls.map(([command]) => command)
    expect(one.commandId).toBe(two.commandId)
    expect(scheduleCommandSchema.safeParse(one).success).toBe(true)
    expect(f.store.snapshot().schedules).toHaveLength(1)
    expect(one).not.toHaveProperty('identity')
  })

  it('keeps the same retry ID for changed payload and lets the real store reject the conflict', async () => {
    const f = fixture()
    await f.manage!.execute!({ type: 'create', spec } as never, context())
    const result = await f.manage!.execute!(
      {
        type: 'create',
        spec: { ...spec, objective: 'A different objective' },
      } as never,
      context(),
    )
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      error: 'This command ID was used for different settings.',
    })
    expect(f.change.mock.calls[1][0].commandId).toBe(
      f.change.mock.calls[0][0].commandId,
    )
    expect(f.store.snapshot().schedules).toHaveLength(1)
    expect(f.store.snapshot().schedules[0].spec.objective).toBe(spec.objective)
  })

  it('uses distinct identities for different tasks and different calls, including ambiguous concatenations', async () => {
    const commands: ScheduleCommand[] = []
    for (const [taskId, callId] of [
      ['task', 'call'],
      ['other-task', 'call'],
      ['task', 'other-call'],
      ['ab', 'c'],
      ['a', 'bc'],
    ]) {
      const tool = assistantScheduleTools({
        taskId,
        canManage: true,
        list: async () => ({ schedules: [], occurrences: [] }),
        change: async (command) => {
          commands.push(command)
          return { ok: true, snapshot: { schedules: [], occurrences: [] } }
        },
      })[1]
      await tool.execute!({ type: 'create', spec } as never, context(callId))
    }
    expect(new Set(commands.map((command) => command.commandId)).size).toBe(
      commands.length,
    )
  })

  it('rejects forged scope and origin fields and exposes no commandId grant in the input schema', async () => {
    const f = fixture()
    for (const field of [
      'workspaceId',
      'userId',
      'botId',
      'conversationId',
      'origin',
    ]) {
      const input = { type: 'create', spec, [field]: 'forged' }
      expect((f.manage!.inputSchema as any).safeParse(input).success).toBe(
        false,
      )
      await expect(
        f.manage!.execute!(input as never, context()),
      ).rejects.toThrow()
    }
    const schema = convertSchemaToJsonSchema(f.manage!.inputSchema!)
    expect(JSON.stringify(schema)).not.toContain('commandId')
    expect(
      (f.manage!.inputSchema as any).safeParse({
        type: 'create',
        spec,
        commandId: crypto.randomUUID(),
      }).success,
    ).toBe(false)
    expect(f.change).not.toHaveBeenCalled()
  })
})
