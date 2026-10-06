import { describe, expect, it, vi } from 'vitest'
import type {
  RetryDraftLock,
  RetryDraftStorage,
} from '../../src/chat/core/retry-draft'
import {
  RetryPreparationConflictError,
  RetryPreparationStorageError,
  RetryPreparationStore,
  retryPreparationKey,
  type RetryPreparationScope,
} from '../../src/chat/core/retry-preparation'

const scope = {
  userId: 'user',
  workspaceId: 'workspace',
  botId: 'source-bot',
  conversationId: 'source-conversation',
}
const messageId = 'source-message'
const attemptId = 'abcdef00-1234-4567-89ab-012345678901'
const otherAttemptId = 'abcdef00-1234-4567-89ab-012345678902'

function memory() {
  const values = new Map<string, string>()
  return {
    values,
    storage: {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        values.set(key, value)
      }),
    },
  }
}

function sharedLock(): RetryDraftLock {
  const queues = new Map<string, Promise<unknown>>()
  return (key, operation) => {
    const next = (queues.get(key) ?? Promise.resolve()).then(operation)
    queues.set(
      key,
      next.catch(() => {}),
    )
    return next
  }
}

const store = (
  storage: RetryDraftStorage,
  lock = sharedLock(),
  owner = scope,
) => new RetryPreparationStore({ storage, scope: owner, lock })

describe('durable retry preparation', () => {
  it('persists one scoped identity before create and recovers it after interruption or a lost response', async () => {
    const m = memory(),
      first = store(m.storage)
    m.values.set('gum.draft:existing', 'Keep the normal draft')
    expect(first.read()).toBeNull()
    const started = await first.start(messageId)
    expect(started).toEqual({
      version: 1,
      scope,
      messageId,
      idempotencyKey: expect.any(String),
      handled: false,
    })
    expect(started.idempotencyKey).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    )
    // Neither a remount before create nor an unknown create outcome can rotate
    // the key. The server can safely replay create with the recovered identity.
    expect(await store(m.storage).start(messageId)).toEqual(started)
    expect(await store(m.storage).start(messageId)).toEqual(started)
    expect(m.storage.setItem).toHaveBeenCalledTimes(1)
    expect(m.values.get('gum.draft:existing')).toBe('Keep the normal draft')
    expect(m.values.size).toBe(2)
    expect(Object.keys(JSON.parse(m.values.get(first.key)!)).sort()).toEqual(
      ['version', 'scope', 'currentMessageId', 'records'].sort(),
    )
  })

  it('serializes repeated clicks across tabs into one preparation', async () => {
    const m = memory(),
      lock = sharedLock()
    const first = store(m.storage, lock),
      second = store(m.storage, lock)
    const requests = await Promise.all([
      first.start(messageId),
      second.start(messageId),
      first.start(messageId),
      second.start(messageId),
    ])
    expect(
      requests.every(
        (value) => value.idempotencyKey === requests[0].idempotencyKey,
      ),
    ).toBe(true)
    expect(m.storage.setItem).toHaveBeenCalledTimes(1)
  })

  it('preserves unknown create outcomes when concurrent tabs switch to another message', async () => {
    const m = memory(),
      lock = sharedLock()
    const first = store(m.storage, lock),
      second = store(m.storage, lock)
    const [started, other] = await Promise.all([
      first.start(messageId),
      second.start('another-message'),
    ])
    expect(first.read()).toEqual(other)
    await expect(
      first.rememberAttempt(started.idempotencyKey, attemptId),
    ).rejects.toThrow(RetryPreparationConflictError)
    await expect(first.markHandled(started.idempotencyKey)).rejects.toThrow(
      RetryPreparationConflictError,
    )
    await expect(
      first.restart(started.idempotencyKey, messageId),
    ).rejects.toThrow(RetryPreparationConflictError)
    expect(first.read()).toEqual(other)
    const reloaded = store(m.storage)
    expect(await reloaded.start(messageId)).toEqual(started)
    await reloaded.rememberAttempt(started.idempotencyKey, attemptId)
    expect(await reloaded.start('another-message')).toEqual(other)
    expect(await reloaded.start(messageId)).toEqual({ ...started, attemptId })
    expect(m.values.size).toBe(1)
  })

  it('remembers one attempt and preserves it across handled retries and repeated callbacks', async () => {
    const m = memory(),
      first = store(m.storage)
    const started = await first.start(messageId)
    const remembered = await first.rememberAttempt(
      started.idempotencyKey,
      attemptId,
    )
    expect(remembered).toEqual({ ...started, attemptId })
    expect(
      await first.rememberAttempt(started.idempotencyKey, attemptId),
    ).toEqual(remembered)
    const handled = await first.markHandled(started.idempotencyKey)
    expect(handled).toEqual({ ...remembered, handled: true })
    expect(await first.markHandled(started.idempotencyKey)).toEqual(handled)
    const reloaded = store(m.storage)
    expect(await reloaded.start(messageId)).toEqual(handled)
    expect(
      await reloaded.rememberAttempt(started.idempotencyKey, attemptId),
    ).toEqual(handled)
    expect(m.storage.setItem).toHaveBeenCalledTimes(3)
  })

  it('rejects conflicting attempt IDs without replacing the accepted identity', async () => {
    const m = memory(),
      lock = sharedLock()
    const first = store(m.storage, lock),
      second = store(m.storage, lock)
    const started = await first.start(messageId)
    const results = await Promise.allSettled([
      first.rememberAttempt(started.idempotencyKey, attemptId),
      second.rememberAttempt(started.idempotencyKey, otherAttemptId),
    ])
    expect(results[0].status).toBe('fulfilled')
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: expect.any(RetryPreparationConflictError),
    })
    expect(first.read()).toEqual({ ...started, attemptId })
    expect(m.storage.setItem).toHaveBeenCalledTimes(2)
  })

  it('keeps a handled message and its known attempt when another message is selected', async () => {
    const m = memory(),
      first = store(m.storage)
    const started = await first.start(messageId)
    await first.rememberAttempt(started.idempotencyKey, attemptId)
    await first.markHandled(started.idempotencyKey)
    const next = await first.start('another-message')
    expect(next).toMatchObject({ messageId: 'another-message', handled: false })
    expect(next.idempotencyKey).not.toBe(started.idempotencyKey)
    expect(next.attemptId).toBeUndefined()
    expect(await first.start(messageId)).toEqual({
      ...started,
      attemptId,
      handled: true,
    })
    expect(m.values.size).toBe(1)
  })

  it('allocates a fresh key only through explicit restart of a known attempt', async () => {
    const m = memory(),
      first = store(m.storage)
    const started = await first.start(messageId)
    await expect(
      first.restart(started.idempotencyKey, messageId),
    ).rejects.toThrow(RetryPreparationConflictError)
    await first.rememberAttempt(started.idempotencyKey, attemptId)
    await expect(
      first.restart(started.idempotencyKey, 'another-message'),
    ).rejects.toThrow(RetryPreparationConflictError)
    expect((await first.start(messageId)).idempotencyKey).toBe(
      started.idempotencyKey,
    )
    // The caller has confirmed with the server that this attempt is terminal.
    const next = await first.restart(started.idempotencyKey, messageId)
    expect(next).toEqual({ ...started, idempotencyKey: expect.any(String) })
    expect(next.idempotencyKey).not.toBe(started.idempotencyKey)
    expect(await store(m.storage).start(messageId)).toEqual(next)
    expect(m.values.size).toBe(1)
  })

  it('rejects old callbacks and competing restarts after a new preparation wins', async () => {
    const m = memory(),
      lock = sharedLock()
    const first = store(m.storage, lock),
      second = store(m.storage, lock)
    const started = await first.start(messageId)
    await first.rememberAttempt(started.idempotencyKey, attemptId)
    await first.markHandled(started.idempotencyKey)
    const results = await Promise.allSettled([
      first.restart(started.idempotencyKey, messageId),
      second.restart(started.idempotencyKey, messageId),
      second.rememberAttempt(started.idempotencyKey, attemptId),
      second.markHandled(started.idempotencyKey),
    ])
    expect(results[0].status).toBe('fulfilled')
    for (const result of results.slice(1))
      expect(result).toMatchObject({
        status: 'rejected',
        reason: expect.any(RetryPreparationConflictError),
      })
    expect(first.read()).toEqual(
      results[0].status === 'fulfilled' && results[0].value,
    )
    expect(first.read()?.handled).toBe(false)
    expect(first.read()?.attemptId).toBeUndefined()
  })

  it('rejects callbacks before preparation exists', async () => {
    const m = memory(),
      first = store(m.storage)
    await expect(first.rememberAttempt(attemptId, attemptId)).rejects.toThrow(
      RetryPreparationConflictError,
    )
    await expect(first.markHandled(attemptId)).rejects.toThrow(
      RetryPreparationConflictError,
    )
    await expect(first.restart(attemptId, messageId)).rejects.toThrow(
      RetryPreparationConflictError,
    )
    expect(m.storage.setItem).not.toHaveBeenCalled()
  })

  it('separates all four scope fields and rejects a foreign record placed in its key', async () => {
    const m = memory(),
      first = store(m.storage)
    const started = await first.start(messageId)
    for (const field of Object.keys(scope) as (keyof RetryPreparationScope)[]) {
      const otherScope = { ...scope, [field]: 'other' }
      const other = store(m.storage, sharedLock(), otherScope)
      expect(other.key).not.toBe(first.key)
      expect(other.read()).toBeNull()
      const raw = JSON.stringify({ ...started, scope: otherScope })
      m.values.set(first.key, raw)
      await expect(first.start(messageId)).rejects.toThrow(
        RetryPreparationStorageError,
      )
      expect(m.values.get(first.key)).toBe(raw)
    }
    expect(m.storage.setItem).toHaveBeenCalledTimes(1)
    expect(
      retryPreparationKey({ ...scope, botId: 'a:b', conversationId: 'c' }),
    ).not.toBe(
      retryPreparationKey({ ...scope, botId: 'a', conversationId: 'b:c' }),
    )
  })

  it('fails closed on corrupt, oversized or unexpected records without overwriting them', async () => {
    const m = memory(),
      first = store(m.storage)
    const started = await first.start(messageId)
    const badRecords = [
      '{broken',
      'null',
      'x'.repeat(256 * 1024 + 1),
      JSON.stringify({ ...started, version: 2 }),
      JSON.stringify({ ...started, idempotencyKey: 'invalid' }),
      JSON.stringify({ ...started, attemptId: 'invalid' }),
      JSON.stringify({ ...started, handled: 'false' }),
      JSON.stringify({
        ...started,
        text: 'Do not keep source request text here',
      }),
      JSON.stringify({ ...started, scope: { ...scope, extra: 'unexpected' } }),
    ]
    for (const raw of badRecords) {
      m.values.set(first.key, raw)
      expect(() => first.read()).toThrow(RetryPreparationStorageError)
      await expect(first.start(messageId)).rejects.toThrow(
        RetryPreparationStorageError,
      )
      await expect(
        first.rememberAttempt(started.idempotencyKey, attemptId),
      ).rejects.toThrow(RetryPreparationStorageError)
      await expect(first.markHandled(started.idempotencyKey)).rejects.toThrow(
        RetryPreparationStorageError,
      )
      await expect(
        first.restart(started.idempotencyKey, messageId),
      ).rejects.toThrow(RetryPreparationStorageError)
      expect(m.values.get(first.key)).toBe(raw)
    }
    expect(m.storage.setItem).toHaveBeenCalledTimes(1)
  })

  it('does not discard a rejected message without an attempt ID when another request is tried', async () => {
    const m = memory(),
      first = store(m.storage)
    const rejected = await first.start('unsupported-source')
    const next = await first.start(messageId)
    await first.rememberAttempt(next.idempotencyKey, attemptId)
    expect(await store(m.storage).start('unsupported-source')).toEqual(rejected)
    expect(await store(m.storage).start(messageId)).toEqual({
      ...next,
      attemptId,
    })
  })

  it('recovers a switched selection after its write acknowledgement is lost', async () => {
    const m = memory(),
      first = store(m.storage)
    const original = await first.start(messageId)
    m.storage.setItem.mockImplementationOnce((key, value) => {
      m.values.set(key, value)
      throw new Error('Lost acknowledgement')
    })
    await expect(first.start('another-message')).rejects.toThrow(
      RetryPreparationStorageError,
    )
    const switched = first.read()!
    expect(switched.messageId).toBe('another-message')
    expect(await first.start('another-message')).toEqual(switched)
    expect(await first.start(messageId)).toEqual(original)
  })

  it('preserves a legacy single-message record when adding the first separate request', async () => {
    const m = memory(),
      first = store(m.storage)
    const original = {
      version: 1,
      scope,
      messageId,
      idempotencyKey: attemptId,
      handled: false,
    }
    m.values.set(first.key, JSON.stringify(original))
    expect(first.read()).toEqual(original)
    await first.start('another-message')
    expect(await first.start(messageId)).toEqual(original)
    expect(JSON.parse(m.values.get(first.key)!).records).toHaveLength(2)
  })

  it('bounds saved requests without evicting unresolved identities', async () => {
    const m = memory(),
      first = store(m.storage)
    const original = await first.start(messageId)
    for (let index = 1; index < 256; index++)
      await first.start(`message-${index}`)
    const full = m.values.get(first.key)
    await expect(first.start('one-too-many')).rejects.toThrow(
      RetryPreparationConflictError,
    )
    expect(m.values.get(first.key)).toBe(full)
    expect(await first.start(messageId)).toEqual(original)
    expect(JSON.parse(m.values.get(first.key)!).records).toHaveLength(256)
  })

  it('rejects ambiguous, missing and unexpected records in the scoped document', async () => {
    const m = memory(),
      first = store(m.storage)
    await first.start(messageId)
    const valid = JSON.parse(m.values.get(first.key)!)
    for (const invalid of [
      { ...valid, currentMessageId: 'missing' },
      { ...valid, records: [] },
      {
        ...valid,
        records: [
          ...valid.records,
          { ...valid.records[0], idempotencyKey: otherAttemptId },
        ],
      },
      {
        ...valid,
        records: [
          ...valid.records,
          { ...valid.records[0], messageId: 'same-key' },
        ],
      },
      {
        ...valid,
        records: [{ ...valid.records[0], text: 'Sensitive request' }],
      },
    ]) {
      const raw = JSON.stringify(invalid)
      m.values.set(first.key, raw)
      await expect(first.start(messageId)).rejects.toThrow(
        RetryPreparationStorageError,
      )
      expect(m.values.get(first.key)).toBe(raw)
    }
  })

  it('fails closed on unavailable storage and unavailable cross-tab locking', async () => {
    const m = memory()
    m.storage.getItem.mockImplementation(() => {
      throw new Error('Storage disabled')
    })
    await expect(store(m.storage).start(messageId)).rejects.toThrow(
      RetryPreparationStorageError,
    )
    expect(m.storage.setItem).not.toHaveBeenCalled()
    const unavailableLock: RetryDraftLock = async () => {
      throw new Error('Cross-tab locking unavailable')
    }
    const other = memory()
    await expect(
      store(other.storage, unavailableLock).start(messageId),
    ).rejects.toThrow('Cross-tab locking unavailable')
    expect(other.storage.getItem).not.toHaveBeenCalled()
    expect(other.storage.setItem).not.toHaveBeenCalled()
  })

  it('rejects failed and unconfirmed writes before returning a usable identity', async () => {
    for (const write of [
      () => {
        throw new Error('Quota exceeded')
      },
      () => {},
    ]) {
      const m = memory()
      m.storage.setItem.mockImplementation(write)
      await expect(store(m.storage).start(messageId)).rejects.toThrow(
        RetryPreparationStorageError,
      )
      expect(m.values.size).toBe(0)
    }
    const m = memory(),
      first = store(m.storage)
    m.storage.setItem.mockImplementation((key, value) => {
      m.values.set(key, value)
      m.storage.getItem.mockImplementationOnce(() => {
        throw new Error('Readback unavailable')
      })
    })
    await expect(first.start(messageId)).rejects.toThrow(
      RetryPreparationStorageError,
    )
    const committed = first.read()!
    expect(await first.start(messageId)).toEqual(committed)
    expect(m.storage.setItem).toHaveBeenCalledTimes(1)
  })

  it('recovers writes that committed before their acknowledgement was lost', async () => {
    const m = memory(),
      first = store(m.storage)
    const loseAcknowledgement = () =>
      m.storage.setItem.mockImplementationOnce((key, value) => {
        m.values.set(key, value)
        throw new Error('Lost write acknowledgement')
      })
    loseAcknowledgement()
    await expect(first.start(messageId)).rejects.toThrow(
      RetryPreparationStorageError,
    )
    const started = await store(m.storage).start(messageId)
    expect(m.storage.setItem).toHaveBeenCalledTimes(1)
    loseAcknowledgement()
    await expect(
      first.rememberAttempt(started.idempotencyKey, attemptId),
    ).rejects.toThrow(RetryPreparationStorageError)
    expect(
      (
        await store(m.storage).rememberAttempt(
          started.idempotencyKey,
          attemptId,
        )
      ).attemptId,
    ).toBe(attemptId)
    loseAcknowledgement()
    await expect(first.markHandled(started.idempotencyKey)).rejects.toThrow(
      RetryPreparationStorageError,
    )
    expect(
      (await store(m.storage).markHandled(started.idempotencyKey)).handled,
    ).toBe(true)
    loseAcknowledgement()
    await expect(
      first.restart(started.idempotencyKey, messageId),
    ).rejects.toThrow(RetryPreparationStorageError)
    const restarted = await store(m.storage).start(messageId)
    expect(restarted.idempotencyKey).not.toBe(started.idempotencyKey)
    expect(restarted.attemptId).toBeUndefined()
    expect(restarted.handled).toBe(false)
    expect(m.storage.setItem).toHaveBeenCalledTimes(4)
  })

  it('keeps prior state when attempt, handled or restart writes fail', async () => {
    const m = memory(),
      first = store(m.storage)
    const started = await first.start(messageId)
    const failWrite = () =>
      m.storage.setItem.mockImplementationOnce(() => {
        throw new Error('Quota exceeded')
      })
    failWrite()
    await expect(
      first.rememberAttempt(started.idempotencyKey, attemptId),
    ).rejects.toThrow(RetryPreparationStorageError)
    expect(first.read()).toEqual(started)
    const remembered = await first.rememberAttempt(
      started.idempotencyKey,
      attemptId,
    )
    failWrite()
    await expect(first.markHandled(started.idempotencyKey)).rejects.toThrow(
      RetryPreparationStorageError,
    )
    expect(first.read()).toEqual(remembered)
    failWrite()
    await expect(
      first.restart(started.idempotencyKey, messageId),
    ).rejects.toThrow(RetryPreparationStorageError)
    expect(first.read()).toEqual(remembered)
  })

  it('validates identities and detaches caller and reader objects from stored state', async () => {
    const m = memory(),
      owner = { ...scope }
    const first = store(m.storage, sharedLock(), owner)
    owner.userId = 'changed-after-construction'
    const started = await first.start(messageId)
    const saved = first.read()
    started.scope.userId = 'changed-return-value'
    expect(first.read()).toEqual(saved)
    expect(() => first.start('')).toThrow()
    expect(() => first.start('x'.repeat(129))).toThrow()
    expect(() => first.rememberAttempt('invalid', attemptId)).toThrow()
    expect(() =>
      first.rememberAttempt(saved!.idempotencyKey, 'invalid'),
    ).toThrow()
    expect(() => first.markHandled('invalid')).toThrow()
    expect(() => first.restart(saved!.idempotencyKey, '')).toThrow()
    expect(() =>
      store(m.storage, sharedLock(), { ...scope, userId: '' }),
    ).toThrow()
    expect(m.storage.setItem).toHaveBeenCalledTimes(1)
  })
})
