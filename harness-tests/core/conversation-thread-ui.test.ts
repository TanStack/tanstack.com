import { describe, expect, it } from 'vitest'
import {
  ThreadRequestStore,
  threadRequestKey,
} from '../../src/chat/components/conversation-thread-state'

class MemoryStorage {
  values = new Map<string, string>()
  getItem(key: string) {
    return this.values.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
  removeItem(key: string) {
    this.values.delete(key)
  }
}
describe('thread creation recovery', () => {
  it('keeps one exact request through a lost response, reload, and retry', () => {
    const storage = new MemoryStorage()
    const key = threadRequestKey(
      'viewer',
      'workspace',
      'parent/room',
      'message',
    )
    const first = new ThreadRequestStore(storage, key).create('message')
    const reloaded = new ThreadRequestStore(storage, key)
    expect(reloaded.read()).toEqual(first)
    expect(reloaded.create('message')).toEqual(first)
    expect(() => reloaded.create('different')).toThrow('changed')
    reloaded.clear({ ...first, idempotencyKey: crypto.randomUUID() })
    expect(reloaded.read()).toEqual(first)
    reloaded.clear(first)
    expect(reloaded.read()).toBeNull()
    expect(reloaded.create('message').idempotencyKey).not.toBe(
      first.idempotencyKey,
    )
  })
  it('scopes commands to viewer, workspace, parent and source without ambiguous separators', () => {
    const keys = [
      threadRequestKey('a', 'b', 'c', 'd'),
      threadRequestKey('x', 'b', 'c', 'd'),
      threadRequestKey('a', 'x', 'c', 'd'),
      threadRequestKey('a', 'b', 'x', 'd'),
      threadRequestKey('a', 'b', 'c', 'x'),
      threadRequestKey('a:b', 'c', 'd', 'e'),
      threadRequestKey('a', 'b:c', 'd', 'e'),
    ]
    expect(new Set(keys).size).toBe(keys.length)
  })
  it('refuses a new request when persistence fails, and preserves corrupt recovery data', () => {
    const storage = new MemoryStorage()
    const key = 'recovery'
    const failed = new ThreadRequestStore(
      {
        ...storage,
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
      key,
    )
    expect(() => failed.create('message')).toThrow('safely')
    storage.setItem(key, '{broken')
    expect(() =>
      new ThreadRequestStore(storage, key).create('message'),
    ).toThrow()
    expect(storage.getItem(key)).toBe('{broken')
  })
  it('round-trips escaped source IDs at the accepted limit', () => {
    const store = new ThreadRequestStore(new MemoryStorage(), 'limit')
    const id = '\u0000'.repeat(128)
    expect(store.read()).toBeNull()
    const command = store.create(id)
    expect(store.read()).toEqual(command)
  })
})

describe('thread descriptor access failures', () => {
  it('distinguishes lost access from a transient refresh failure', async () => {
    const { threadAccessDenied } =
      await import('../../src/chat/components/conversation-thread-state')
    const { ApiError } = await import('../../src/chat/components/WorkspaceApi')
    for (const status of [401, 403, 404])
      expect(threadAccessDenied(new ApiError('Unavailable', status))).toBe(true)
    for (const status of [408, 409, 429, 500, 503])
      expect(threadAccessDenied(new ApiError('Unavailable', status))).toBe(
        false,
      )
    expect(threadAccessDenied(new TypeError('Network error'))).toBe(false)
  })
})
