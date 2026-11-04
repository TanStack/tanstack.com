import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLiveQueryCollection } from '@tanstack/react-db'
import { createWorkspaceCollections } from '../../src/chat/client/workspace-collections'
import {
  workspaceCommit,
  type WorkspaceProjection,
  type WorkspaceSyncSnapshot,
} from '../../src/chat/core/workspace-sync'
import { ApiError } from '../../src/chat/components/WorkspaceApi'

const transport = vi.hoisted(() => ({
  callbacks: [] as Array<(batch: any) => Promise<void>>,
  failures: [] as Array<(error: unknown) => void>,
}))
vi.mock('@durable-streams/client', () => ({
  DurableStream: class {
    async stream({ signal }: any) {
      return {
        subscribeJson(fn: any) {
          transport.callbacks.push(fn)
          return () => {}
        },
        closed: new Promise((_, reject) => {
          transport.failures.push(reject)
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          )
        }),
      }
    }
  },
}))
const cleanups: Array<() => Promise<unknown>> = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup()
  transport.callbacks = []
  transport.failures = []
})
const state = (): WorkspaceProjection => ({
  workspaceId: 'workspace',
  userId: 'viewer',
  bots: ['a', 'b'].map((id, position) => ({
    id,
    workspace_id: 'workspace',
    name: id,
    purpose: '',
    parent_id: null,
    created_at: 1,
    updated_at: 1,
    version: 0,
    archived_at: null,
    deleted_at: null,
    pinned: false,
    section_id: 'one',
    position,
    tags: [],
  })),
  sections: [{ id: 'one', name: 'One', version: 0, position: 0 }],
  activity: {},
})
const snapshot = (
  value: WorkspaceProjection,
  version = 0,
  generation = 'epoch',
): WorkspaceSyncSnapshot => ({
  protocol: 1,
  state: structuredClone(value),
  version,
  generation,
  offset: String(version),
})
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { resolve, reject, promise }
}
async function setup(initial = state()) {
  let server = snapshot(initial)
  const saves: Array<ReturnType<typeof deferred<unknown>>> = []
  const request = vi.fn(
    async (path: string, _body?: unknown, method = 'GET') => {
      if (method === 'GET') return server
      const reply = deferred<unknown>()
      saves.push(reply)
      return reply.promise
    },
  )
  const store = createWorkspaceCollections({
    request,
    initial,
    initialActivity: initial.activity,
    streamUrl: 'http://fixture/workspace-sync/stream',
  })
  const release = store.retain()
  cleanups.push(async () => {
    release()
    await Promise.resolve()
    await store.db.cleanup()
  })
  await vi.waitFor(() => expect(store.getStatus().isPending).toBe(false))
  const bot = (id = 'a') => store.read().bots.find((row) => row.id === id)!
  return {
    store,
    request,
    saves,
    bot,
    accept(value: WorkspaceProjection, version = 1, n = 0) {
      server = snapshot(value, version)
      saves[n].resolve({ index: value, sync: server })
    },
  }
}
describe('workspace stream collections', () => {
  it('clears a stream warning when a same-version snapshot reconnects', async () => {
    const { store } = await setup()
    await vi.waitFor(() => expect(transport.failures).toHaveLength(1))
    transport.failures[0](new Error('Stream dropped'))
    await vi.waitFor(() =>
      expect(store.getStatus().error?.message).toBe('Stream dropped'),
    )
    await vi.waitFor(() => expect(store.getStatus().error).toBeNull(), {
      timeout: 2000,
    })
  })
  it('keeps optimistic edits until the canonical stream receipt and ignores older delivery', async () => {
    const { store, bot, saves, accept } = await setup()
    const pending = store.request(
      'bots/a',
      { version: 0, name: 'Saved' },
      'PATCH',
    )
    expect(bot().name).toBe('Saved')
    await vi.waitFor(() => expect(saves).toHaveLength(1))
    const next = state()
    Object.assign(next.bots[0], { name: 'Saved', version: 1 })
    accept(next)
    await pending
    await store.applyCommit(workspaceCommit(undefined, state(), 'epoch', 0))
    expect(bot().name).toBe('Saved')
  })
  it('publishes a section removal and all references in one observable commit', async () => {
    const { store } = await setup()
    const seen: boolean[] = []
    const unsubscribe = store.entities.subscribeChanges(() => {
      const s = store.read()
      seen.push(
        !s.sections.length && s.bots.every((b) => b.section_id === null),
      )
    })
    const next = state()
    next.sections = []
    next.bots = next.bots.map((bot) => ({ ...bot, section_id: null }))
    await store.applyCommit(workspaceCommit(state(), next, 'epoch', 1))
    expect(seen).toEqual([true])
    unsubscribe.unsubscribe()
  })
  it('updates a TanStack live query when another client archives a conversation', async () => {
    const { store } = await setup()
    const query = createLiveQueryCollection({
      query: (q) => q.from({ row: store.entities }),
    })
    await query.preload()
    cleanups.unshift(() => query.cleanup())
    const next = state()
    next.bots[0].archived_at = 10
    await store.applyCommit(workspaceCommit(state(), next, 'epoch', 1))
    expect(query.get('bot:a')?.value.archived_at).toBe(10)
  })
  it('rolls back rejection while retaining an unrelated pending edit', async () => {
    const { store, bot, saves, accept } = await setup()
    const first = store.request(
      'bots/a',
      { version: 0, name: 'Rejected' },
      'PATCH',
    )
    const rejected = expect(first).rejects.toThrow('No')
    const second = store.request(
      'bots/b',
      { version: 0, name: 'Keep' },
      'PATCH',
    )
    await vi.waitFor(() => expect(saves).toHaveLength(1))
    saves[0].reject(new ApiError('No', 409))
    await rejected
    expect(bot('b').name).toBe('Keep')
    await vi.waitFor(() => expect(saves).toHaveLength(2))
    const next = state()
    Object.assign(next.bots[1], { name: 'Keep', version: 1 })
    accept(next, 1, 1)
    await second
    expect(bot('a').name).toBe('a')
    expect(bot('b').name).toBe('Keep')
  })
  it('serializes consecutive edits and never flashes back to an earlier canonical value', async () => {
    const { store, bot, saves, accept } = await setup()
    const first = store.request(
      'bots/a',
      { version: 0, name: 'First' },
      'PATCH',
    )
    const second = store.request(
      'bots/a',
      { version: 1, name: 'Second' },
      'PATCH',
    )
    const visible: string[] = []
    const sub = store.entities.subscribeChanges(() => visible.push(bot().name))
    await vi.waitFor(() => expect(saves).toHaveLength(1))
    const next = state()
    Object.assign(next.bots[0], { name: 'First', version: 1 })
    accept(next, 1)
    await first
    expect(bot().name).toBe('Second')
    await vi.waitFor(() => expect(saves).toHaveLength(2))
    Object.assign(next.bots[0], { name: 'Second', version: 2 })
    accept(next, 2, 1)
    await second
    expect(visible.every((name) => name === 'Second')).toBe(true)
    sub.unsubscribe()
  })
  it('rejects a dependent edit before sending it after predecessor rollback', async () => {
    const { store, saves } = await setup()
    const first = store.request(
      'bots/a',
      { version: 0, name: 'First' },
      'PATCH',
    )
    const one = expect(first).rejects.toThrow()
    const second = store.request(
      'bots/a',
      { version: 1, name: 'Second' },
      'PATCH',
    )
    const two = expect(second).rejects.toThrow()
    await vi.waitFor(() => expect(saves).toHaveLength(1))
    saves[0].reject(new ApiError('Conflict', 409))
    await one
    await two
    expect(saves).toHaveLength(1)
  })
  it('persists a no-op command and acknowledges its receipt', async () => {
    const { store, saves, accept } = await setup()
    const pending = store.request(
      'bots/a/organization',
      { pinned: false },
      'PATCH',
    )
    await vi.waitFor(() => expect(saves).toHaveLength(1))
    accept(state())
    await pending
  })
  it('rejects wrong scopes and gaps without changing visible rows', async () => {
    const { store, bot } = await setup()
    const wrong = state()
    wrong.userId = 'other'
    await expect(store.applySnapshot(snapshot(wrong, 1))).rejects.toThrow(
      'account',
    )
    await expect(
      store.applyCommit(workspaceCommit(state(), state(), 'epoch', 2)),
    ).rejects.toThrow('gap')
    expect(bot().name).toBe('a')
  })
  it('ignores messages from a retired generation', async () => {
    const { store, bot } = await setup()
    const next = state()
    next.bots[0].name = 'New'
    await store.applySnapshot(snapshot(next, 0, 'new-epoch'))
    await store.applyCommit(workspaceCommit(state(), state(), 'epoch', 1))
    expect(bot().name).toBe('New')
  })
  it('materializes exactly the same final state after duplicate commits', async () => {
    const { store } = await setup()
    const next = state()
    next.bots = []
    const event = workspaceCommit(state(), next, 'epoch', 1)
    await store.applyCommit(event)
    await store.applyCommit(event)
    expect(store.read()).toEqual(next)
  })
})
it('does not let an older snapshot overwrite an already applied receipt, even in the same tick', async () => {
  const { store, bot } = await setup()
  const newer = state()
  newer.bots[0].name = 'Latest'
  await Promise.all([
    store.applySnapshot(snapshot(newer, 3)),
    store.applySnapshot(snapshot(state(), 2)),
  ])
  expect(bot().name).toBe('Latest')
})
it('does not resurrect a retired generation from a late snapshot response', async () => {
  const { store, bot } = await setup()
  const newer = state()
  newer.bots[0].name = 'Latest'
  await store.applySnapshot(snapshot(newer, 0, 'next'))
  await store.applySnapshot(snapshot(state(), 10, 'epoch'))
  expect(bot().name).toBe('Latest')
})
it('keeps a saved edit while delivery is pending and only retries reads', async () => {
  const { store, bot, request, saves } = await setup()
  const pending = store.request(
    'bots/a',
    { version: 0, name: 'Saved' },
    'PATCH',
  )
  await vi.waitFor(() => expect(saves).toHaveLength(1))
  const updated = state()
  updated.bots[0].name = 'Saved'
  updated.bots[0].version = 1
  request.mockImplementationOnce(async () => snapshot(updated, 1))
  saves[0].resolve({ syncPending: true })
  await pending
  expect(bot().name).toBe('Saved')
  expect(saves).toHaveLength(1)
})
it('applies activity and read state through the same commit as conversation changes', async () => {
  const { store } = await setup()
  const updated = state()
  updated.activity.a = {
    status: 'completed',
    activity_at: 1,
    event_version: 3,
    read_version: 2,
    preview: 'Finished',
    message_count: 2,
  }
  await store.applyCommit(workspaceCommit(state(), updated, 'epoch', 1))
  expect(store.read().activity).toEqual(updated.activity)
})

it('undoes and redoes a saved archive without capturing unrelated synced changes', async () => {
  const { store, request, saves, accept, bot } = await setup()
  const pending = store.request(
    'bots/a',
    { version: 0, archived: true },
    'PATCH',
  )
  expect(store.canUndo()).toBe(false)
  await vi.waitFor(() => expect(saves).toHaveLength(1))
  const archived = state()
  archived.bots[0].archived_at = 100
  archived.bots[0].version = 1
  archived.bots[1].pinned = true
  accept(archived)
  await pending
  expect(store.canUndo()).toBe(true)
  const undo = store.undo()
  await vi.waitFor(() => expect(saves).toHaveLength(2))
  const command = request.mock.calls.at(-1)!
  expect(command[0]).toBe('workspace-history')
  expect((command[1] as any).bots.map((c: any) => c.before.id)).toEqual(['a'])
  const restored = structuredClone(archived)
  restored.bots[0].archived_at = null
  restored.bots[0].version = 2
  accept(restored, 2, 1)
  await undo
  expect(bot().archived_at).toBeNull()
  expect(store.canRedo()).toBe(true)
  expect(store.canUndo()).toBe(false)
  const redo = store.redo()
  await vi.waitFor(() => expect(saves).toHaveLength(3))
  accept(archived, 3, 2)
  await redo
  expect(store.canUndo()).toBe(true)
  expect(store.canRedo()).toBe(false)
})
