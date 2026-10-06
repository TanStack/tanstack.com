import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { WorkspaceProjection } from '../../src/chat/core/workspace-sync'
import type { DurableObjectState } from '@cloudflare/workers-types'
import type { WorkspaceSyncEnvironment } from '../../src/chat/server/workspace-sync'
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  projection: vi.fn(),
  member: vi.fn(),
  execute: vi.fn(),
}))
vi.mock('@durable-streams/server-cloudflare', () => ({
  createStreamsHandler: () => mocks.fetch,
}))
vi.mock('../../src/chat/server/workspace-sync-projection', () => ({
  readSyncProjection: mocks.projection,
  syncMembership: mocks.member,
}))
vi.mock('~/db/client', () => ({ db: { execute: mocks.execute } }))
import { WorkspaceSyncPublisher } from '../../src/chat/server/workspace-sync'
let durable: DatabaseSync,
  ctx: DurableObjectState,
  env: WorkspaceSyncEnvironment,
  publisher: WorkspaceSyncPublisher,
  batches: Map<string, string>
let membership: string | undefined, revision: number, state: WorkspaceProjection
beforeEach(() => {
  durable = new DatabaseSync(':memory:')
  batches = new Map()
  membership = 'member-1'
  revision = 1
  state = {
    workspaceId: 'w',
    userId: 'one',
    bots: [
      {
        id: 'b',
        workspace_id: 'w',
        parent_id: null,
        name: 'Name',
        purpose: '',
        created_at: 1,
        version: 0,
        archived_at: null,
        deleted_at: null,
        updated_at: 1,
        pinned: false,
        section_id: null,
        position: 0,
        tags: [],
      },
    ],
    sections: [],
    activity: {},
  }
  // The original source test's Durable Object storage fixture is retained.
  ctx = {
    storage: {
      sql: {
        exec: (sql: string, ...args: SQLInputValue[]) => {
          const rows = durable.prepare(sql).all(...args)
          return { toArray: () => rows }
        },
      },
      setAlarm: vi.fn(async () => {}),
      deleteAlarm: vi.fn(async () => {}),
    },
  } as unknown as DurableObjectState
  env = {} as WorkspaceSyncEnvironment
  mocks.projection.mockImplementation(async () =>
    membership
      ? { generation: membership, revision, state: structuredClone(state) }
      : undefined,
  )
  mocks.member.mockImplementation(async () =>
    membership ? { generation: membership } : undefined,
  )
  mocks.execute.mockResolvedValue([{ revision: 1 }])
  mocks.fetch.mockImplementation(async (request: Request) => {
    if (request.method === 'PUT') return new Response(null, { status: 200 })
    if (request.method === 'HEAD')
      return new Response(null, {
        headers: { 'Stream-Next-Offset': String(batches.size) },
      })
    const key =
        new URL(request.url).pathname +
        ':' +
        request.headers.get('Producer-Seq'),
      body = await request.text()
    if (batches.has(key)) {
      expect(body).toBe(batches.get(key))
      return new Response(null, {
        status: 204,
        headers: {
          'Producer-Epoch': '0',
          'Producer-Seq': request.headers.get('Producer-Seq')!,
        },
      })
    }
    batches.set(key, body)
    return new Response(null, {
      headers: { 'Stream-Next-Offset': String(batches.size) },
    })
  })
  publisher = new WorkspaceSyncPublisher(ctx, env)
})
afterEach(() => {
  durable.close()
  vi.clearAllMocks()
})
it('retains original pending bytes after a lost acknowledgement and restart', async () => {
  const original = mocks.fetch.getMockImplementation()!
  let lose = true
  mocks.fetch.mockImplementation(async (request: Request) => {
    const response = await original(request)
    if (request.method === 'POST' && lose) {
      lose = false
      throw new Error('Lost acknowledgment')
    }
    return response
  })
  await expect(publisher.snapshot('w', 'one')).rejects.toThrow(
    'Lost acknowledgment',
  )
  expect(
    durable.prepare('SELECT pending FROM viewers').get()!.pending,
  ).toBeTruthy()
  publisher = new WorkspaceSyncPublisher(ctx, env)
  expect((await publisher.snapshot('w', 'one'))?.state.bots[0].name).toBe(
    'Name',
  )
  expect(batches.size).toBe(1)
  expect(
    durable.prepare('SELECT pending FROM viewers').get()!.pending,
  ).toBeNull()
})
it('serializes concurrent snapshots into one published version', async () => {
  const results = await Promise.all(
    Array.from({ length: 8 }, () => publisher.snapshot('w', 'one')),
  )
  expect(results.every((result) => result?.version === 0)).toBe(true)
  expect(batches.size).toBe(1)
})
it('retires revoked membership and refuses its previous stream cursor after rejoin', async () => {
  const old = await publisher.snapshot('w', 'one')
  membership = undefined
  expect(await publisher.snapshot('w', 'one')).toBeUndefined()
  expect(
    (await publisher.read('w', 'one', old!.generation, '?offset=0')).status,
  ).toBe(409)
  membership = 'member-2'
  const next = await publisher.snapshot('w', 'one')
  expect(next?.generation).not.toBe(old?.generation)
  expect(
    (await publisher.read('w', 'one', old!.generation, '?offset=0')).status,
  ).toBe(409)
})
it('rotates a bounded generation without dropping its snapshot', async () => {
  const old = await publisher.snapshot('w', 'one')
  durable.exec('UPDATE viewers SET bytes=1000001')
  const next = await publisher.snapshot('w', 'one')
  expect(next?.generation).not.toBe(old?.generation)
  expect(next?.version).toBe(0)
  expect(next?.state).toEqual(old?.state)
  expect(JSON.parse([...batches.values()].at(-1)!)[0].reset).toBe(true)
})
it('rebases an expired stream using retained pending state', async () => {
  const old = await publisher.snapshot('w', 'one')
  revision++
  state.bots[0].name = 'After expiry'
  const original = mocks.fetch.getMockImplementation()!
  let expired = true
  mocks.fetch.mockImplementation(async (request: Request) => {
    if (request.method === 'PUT' && expired) {
      expired = false
      return new Response(null, { status: 201 })
    }
    return original(request)
  })
  await publisher.publish('w')
  const next = await publisher.snapshot('w', 'one')
  expect(next?.generation).not.toBe(old?.generation)
  expect(next?.state.bots[0].name).toBe('After expiry')
  expect(next?.version).toBe(0)
})
it('withholds snapshots when membership changes during append', async () => {
  const original = mocks.fetch.getMockImplementation()!
  mocks.fetch.mockImplementation(async (request: Request) => {
    const response = await original(request)
    if (request.method === 'POST') membership = 'member-2'
    return response
  })
  expect(await publisher.snapshot('w', 'one')).toBeUndefined()
})
