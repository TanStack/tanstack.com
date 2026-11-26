import { assertSendDestination } from '../../src/chat/core/send-receipt'
import { describe, expect, it, vi } from 'vitest'
import {
  referenceKey,
  type ReferenceInput,
} from '../../src/chat/core/message-references'
import {
  PendingSendCoordinator,
  PendingSendStore,
  SendStorageError,
  type NewSend,
  type SendPayload,
  type SendScope,
  type SendStorage,
} from '../../src/chat/core/send-receipt'

const scope: SendScope = {
  userId: 'user',
  workspaceId: 'workspace',
  botId: 'bot',
}
const input = (): NewSend => ({
  text: '  Read the attached notes.  ',
  fileIds: [crypto.randomUUID()],
  proposeToolsOnly: false,
  systemOne: false,
  refreshCatalog: true,
  delivery: 'interrupt',
})
function memory() {
  const values = new Map<string, string>()
  const storage: SendStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
  return { values, storage }
}

it('recovers exact tool identities and cleanup tokens at their escaped bounds', () => {
  const { storage } = memory()
  const store = new PendingSendStore(storage, scope)
  const references: ReferenceInput[] = Array.from(
    { length: 10 },
    (_, index) => ({
      kind: 'tool',
      serverId: '"'.repeat(199) + index,
      toolName: '\\"'.repeat(100),
    }),
  )
  const referenceSelection = references.map((reference) => ({
    key: referenceKey(reference),
    token: crypto.randomUUID(),
  }))
  expect(referenceSelection[0].key.length).toBeGreaterThan(500)
  const created = store.create({
    ...input(),
    text: '\u0000'.repeat(12000),
    references,
    referenceSelection,
  })
  expect(new PendingSendStore(storage, scope).read()).toEqual(created)
})
function serialLock() {
  let previous = Promise.resolve()
  return <T>(operation: () => Promise<T>): Promise<T> => {
    const next = previous.then(operation)
    previous = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }
}
function harness(
  storage = memory().storage,
  owner = scope,
  lock = serialLock(),
) {
  const store = new PendingSendStore(storage, owner)
  const post = vi.fn(async (_payload: SendPayload): Promise<unknown> => ({}))
  const receipt = vi.fn(async (_id: string) => ({ accepted: false }))
  const service = new PendingSendCoordinator({
    store,
    lock,
    post,
    receipt,
    definitiveRejection: (error) =>
      !!error &&
      typeof error === 'object' &&
      'status' in error &&
      typeof error.status === 'number' &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 408,
  })
  return { store, service, post, receipt }
}
const rejected = (status: number) =>
  Object.assign(new Error('Request rejected'), { status })

describe('durable pending sends', () => {
  it('retains the exact retry attempt and draft revision through recovery', async () => {
    const { storage } = memory()
    const retry = {
      attemptId: crypto.randomUUID(),
      draftRevision: Number.MAX_SAFE_INTEGER,
    }
    const first = harness(storage)
    first.post.mockRejectedValue(new Error('Response lost'))
    const pending = await first.service.submit({ ...input(), retry })
    expect(pending.kind).toBe('pending')
    const restored = harness(storage)
    await restored.service.retry()
    expect(restored.post).toHaveBeenCalledWith(
      expect.objectContaining({ retry }),
    )
    expect(restored.store.read()?.payload.retry).toEqual(retry)
  })
  it.each([
    { attemptId: 'not-an-attempt', draftRevision: 0 },
    { attemptId: crypto.randomUUID(), draftRevision: -1 },
    { attemptId: crypto.randomUUID(), draftRevision: 0.5 },
    {
      attemptId: crypto.randomUUID(),
      draftRevision: Number.MAX_SAFE_INTEGER + 1,
    },
    { attemptId: crypto.randomUUID(), draftRevision: 0, extra: true },
  ])('rejects an invalid retry binding: %j', (retry) => {
    const store = new PendingSendStore(memory().storage, scope)
    expect(() => store.create({ ...input(), retry })).toThrow()
    expect(store.read()).toBeNull()
  })
  it('recovers exact opaque conversation identities without truncating cleanup keys', () => {
    const { storage } = memory()
    const store = new PendingSendStore(storage, scope)
    const references: ReferenceInput[] = Array.from(
      { length: 10 },
      (_, index) => ({
        kind: 'conversation',
        botId: '"'.repeat(200),
        conversationId: String(index) + '\u0000'.repeat(999),
      }),
    )
    const referenceSelection = references.map((reference) => ({
      key: referenceKey(reference),
      token: crypto.randomUUID(),
    }))
    expect(referenceSelection[0].key.length).toBeGreaterThan(6000)
    const original = store.create({
      ...input(),
      text: '\u0000'.repeat(12000),
      references,
      referenceSelection,
    })
    const remounted = new PendingSendStore(storage, scope)
    expect(remounted.read()).toEqual(original)
    remounted.clear(original)
    expect(remounted.read()).toBeNull()
  })
  it('recovers schema-maximum escaped text and metadata through acknowledgment and cleanup', () => {
    const { storage } = memory()
    const escapedScope = {
      userId: '\u0000'.repeat(200),
      workspaceId: '\u0000'.repeat(200),
      botId: '\u0000'.repeat(200),
    }
    const store = new PendingSendStore(storage, escapedScope)
    const original = store.create({
      ...input(),
      text: '\u0000'.repeat(12000),
      fileIds: Array.from({ length: 5 }, () => crypto.randomUUID()),
      runModel: {
        provider: 'openai',
        model: '\u0000'.repeat(150),
        reasoning: '\u0000'.repeat(40),
      },
      references: Array.from({ length: 10 }, (_, index) => ({
        kind: 'conversation',
        botId: '"'.repeat(200),
        conversationId: String(index) + '\u0000'.repeat(999),
      })),
      referenceSelection: Array.from({ length: 10 }, (_, index) => ({
        key: String(index) + '\u0000'.repeat(6999),
        token: crypto.randomUUID(),
      })),
    })
    expect(storage.getItem(store.key)!.length).toBeGreaterThan(550000)
    const remounted = new PendingSendStore(storage, escapedScope)
    expect(remounted.read()).toEqual(original)
    const acknowledged = remounted.markAcknowledged(original)
    expect(remounted.read()).toEqual(acknowledged)
    remounted.clear(acknowledged)
    expect(remounted.read()).toBeNull()
  })
  it('persists the original immutable request before posting', async () => {
    const { store, service, post } = harness()
    const value = input()
    post.mockImplementation(async (payload) => {
      expect(store.read()?.payload).toEqual(payload)
      expect(payload).toMatchObject(value)
    })
    const result = await service.submit(value)
    expect(result.kind).toBe('accepted')
    expect(store.read()?.acknowledged).toBe(true)
    expect(post).toHaveBeenCalledTimes(1)
  })
  it('keeps unknown sends unchanged across remount and retries only explicitly', async () => {
    const { storage } = memory()
    const first = harness(storage)
    first.post.mockRejectedValue(new TypeError('Network lost'))
    const value = input()
    expect((await first.service.submit(value)).kind).toBe('pending')
    const original = first.store.read()!
    const remounted = harness(storage)
    expect(await remounted.service.check()).toMatchObject({
      kind: 'pending',
      envelope: original,
    })
    expect(remounted.post).not.toHaveBeenCalled()
    expect(await remounted.service.retry()).toMatchObject({ kind: 'accepted' })
    expect(remounted.post).toHaveBeenCalledWith(original.payload)
    expect(remounted.store.read()?.payload).toEqual(original.payload)
  })
  it('freezes the chosen model and reasoning through an ambiguous response and reload', async () => {
    const { storage } = memory()
    const first = harness(storage)
    first.post.mockRejectedValue(new TypeError('Network lost'))
    const runModel = {
      provider: 'openai' as const,
      model: 'chosen-model',
      reasoning: 'high',
    }
    await first.service.submit({ ...input(), runModel })
    const original = first.store.read()!
    runModel.model = 'changed-after-send'
    const remounted = harness(storage)
    await remounted.service.submit({
      ...input(),
      runModel: { provider: 'included', model: 'new-default' },
    })
    expect(remounted.post).not.toHaveBeenCalled()
    await remounted.service.retry()
    expect(remounted.post).toHaveBeenCalledWith(original.payload)
    expect(original.payload.runModel).toEqual({
      provider: 'openai',
      model: 'chosen-model',
      reasoning: 'high',
    })
  })
  it('keeps reference cleanup tokens outside the HTTP payload through retries', async () => {
    const { storage } = memory()
    const first = harness(storage)
    first.post.mockRejectedValue(new TypeError('Network lost'))
    const references = [{ kind: 'conversation' as const, botId: 'source' }]
    const referenceSelection = [
      { key: '["conversation","source"]', token: crypto.randomUUID() },
    ]
    const result = await first.service.submit({
      ...input(),
      references,
      referenceSelection,
    })
    expect(result.kind).toBe('pending')
    expect(first.store.read()?.referenceSelection).toEqual(referenceSelection)
    expect(first.post.mock.calls[0][0]).toMatchObject({ references })
    expect(first.post.mock.calls[0][0]).not.toHaveProperty('referenceSelection')
    const remounted = harness(storage)
    const retried = await remounted.service.retry()
    expect(retried).toMatchObject({
      kind: 'accepted',
      envelope: { referenceSelection },
    })
    expect(remounted.post.mock.calls[0][0]).toEqual(first.post.mock.calls[0][0])
  })
  it('allows a saved-file-only message but requires an objective for other references', () => {
    const { store } = harness()
    expect(() =>
      store.create({
        ...input(),
        text: '',
        fileIds: [],
        references: [{ kind: 'connection', serverId: 'source' }],
      }),
    ).toThrow()
    expect(
      store.create({
        ...input(),
        text: '',
        fileIds: [],
        references: [
          { kind: 'file', botId: 'source', fileId: crypto.randomUUID() },
        ],
      }).payload.references,
    ).toHaveLength(1)
  })
  it('recovers a committed send after a lost response without posting again', async () => {
    const { storage } = memory()
    const first = harness(storage)
    first.post.mockRejectedValue(new TypeError('Lost response'))
    first.receipt.mockRejectedValue(new TypeError('Offline'))
    await first.service.submit(input())
    const remounted = harness(storage)
    remounted.receipt.mockResolvedValue({ accepted: true })
    const result = await remounted.service.check()
    expect(result.kind).toBe('accepted')
    expect(remounted.post).not.toHaveBeenCalled()
    expect(remounted.store.read()?.acknowledged).toBe(true)
    if (result.kind !== 'accepted') throw new Error('Expected acknowledgment')
    await remounted.service.finishAccepted(result.envelope)
    expect(remounted.store.read()).toBeNull()
  })
  it('survives a crash after acknowledgment but before composer cleanup', async () => {
    const { storage } = memory()
    const first = harness(storage)
    const original = input()
    await first.service.submit(original)
    const remounted = harness(storage)
    remounted.receipt.mockRejectedValue(new TypeError('Offline'))
    const result = await remounted.service.check()
    expect(result).toMatchObject({
      kind: 'accepted',
      envelope: { payload: original, acknowledged: true },
    })
    expect(remounted.receipt).not.toHaveBeenCalled()
    expect(remounted.post).not.toHaveBeenCalled()
    if (result.kind !== 'accepted') throw new Error('Expected acknowledgment')
    // UI cleanup compares with this exact raw text and IDs, preserving later edits.
    expect(result.envelope.payload.text).toBe(original.text)
    await remounted.service.finishAccepted(result.envelope)
    expect(remounted.store.read()).toBeNull()
  })
  it('does not replace an unknown send when the composer has conflicting edits', async () => {
    const { service, store, post } = harness()
    post.mockRejectedValue(new TypeError('Offline'))
    await service.submit(input())
    const original = store.read()!
    const edited = {
      ...input(),
      text: 'A different request',
      delivery: 'queue' as const,
    }
    expect(await service.submit(edited)).toMatchObject({
      kind: 'pending',
      envelope: original,
    })
    expect(store.read()).toEqual(original)
    expect(post).toHaveBeenCalledTimes(1)
    post.mockResolvedValue({})
    await service.retry()
    expect(post).toHaveBeenLastCalledWith(original.payload)
  })
  it('unlocks edits only after a definitive rejection and a negative receipt', async () => {
    const { service, store, post, receipt } = harness()
    post.mockRejectedValue(rejected(415))
    receipt.mockRejectedValue(new Error('Receipt unavailable'))
    expect((await service.submit(input())).kind).toBe('pending')
    expect(store.read()?.rejected).toBe(true)
    receipt.mockResolvedValue({ accepted: false })
    expect((await service.check()).kind).toBe('rejected')
    expect(store.read()).toBeNull()
    post.mockResolvedValue({})
    expect(
      (await service.submit({ ...input(), text: 'Changed after rejection' }))
        .kind,
    ).toBe('accepted')
  })
  it.each([408, 500, 503])(
    'preserves uncertainty after HTTP %i even with a negative receipt',
    async (status) => {
      const { service, store, post } = harness()
      post.mockRejectedValue(rejected(status))
      expect((await service.submit(input())).kind).toBe('pending')
      expect(store.read()?.rejected).toBe(false)
      expect((await service.check()).kind).toBe('pending')
    },
  )
  it('uses acceptance over a conflicting rejection response', async () => {
    const { service, store, post, receipt } = harness()
    post.mockRejectedValue(rejected(409))
    receipt.mockResolvedValue({ accepted: true })
    expect((await service.submit(input())).kind).toBe('accepted')
    expect(store.read()?.acknowledged).toBe(true)
  })
  it('isolates accounts, workspaces, and bots and rejects a mismatched stored owner', () => {
    const { storage, values } = memory()
    const first = harness(storage)
    const original = first.store.create(input())
    for (const owner of [
      { ...scope, userId: 'another' },
      { ...scope, workspaceId: 'another' },
      { ...scope, botId: 'another' },
    ]) {
      const other = harness(storage, owner)
      expect(other.store.read()).toBeNull()
      storage.setItem(other.store.key, JSON.stringify(original))
      expect(() => other.store.read()).toThrow(SendStorageError)
    }
    expect(values.size).toBe(4)
  })
  it('refuses to post when browser storage fails or silently drops writes', async () => {
    for (const setItem of [
      () => {
        throw new Error('Quota exceeded')
      },
      () => {},
    ]) {
      const { storage } = memory()
      storage.setItem = setItem
      const { service, post } = harness(storage)
      await expect(service.submit(input())).rejects.toBeInstanceOf(
        SendStorageError,
      )
      expect(post).not.toHaveBeenCalled()
    }
  })
  it('keeps acceptance recoverable when removing the envelope fails', async () => {
    const { storage } = memory()
    const { service, store, post } = harness(storage)
    const result = await service.submit(input())
    if (result.kind !== 'accepted') throw new Error('Expected acknowledgment')
    storage.removeItem = () => {
      throw new Error('Storage blocked')
    }
    await expect(
      service.finishAccepted(result.envelope),
    ).rejects.toBeInstanceOf(SendStorageError)
    expect(store.read()?.acknowledged).toBe(true)
    expect((await service.retry()).kind).toBe('accepted')
    expect(post).toHaveBeenCalledTimes(1)
  })
  it('serializes concurrent tabs so only one new send can be created', async () => {
    const { storage } = memory()
    const lock = serialLock()
    const first = harness(storage, scope, lock)
    const second = harness(storage, scope, lock)
    first.post.mockRejectedValue(new TypeError('Offline'))
    const results = await Promise.all([
      first.service.submit(input()),
      second.service.submit(input()),
    ])
    expect(results.map((result) => result.kind)).toEqual(['pending', 'pending'])
    expect(first.post).toHaveBeenCalledTimes(1)
    expect(second.post).not.toHaveBeenCalled()
    expect(first.store.read()).toEqual(second.store.read())
  })
  it('does not let a stale acknowledgment remove a newer send', async () => {
    const { service, store } = harness()
    const result = await service.submit(input())
    if (result.kind !== 'accepted') throw new Error('Expected acknowledgment')
    await service.finishAccepted(result.envelope)
    const next = store.create(input())
    expect(await service.finishAccepted(result.envelope)).toEqual(next)
    expect(store.read()).toEqual(next)
  })
})

it('does not recover or clean a main pending request from a sibling and preserves each scope across reloads', async () => {
  const { storage } = memory()
  const main = harness(storage, scope)
  main.post.mockRejectedValueOnce(new TypeError('Lost response'))
  const pending = await main.service.submit(input())
  expect(pending.kind).toBe('pending')
  const mainEnvelope = main.store.read()!
  const siblingScope = { ...scope, conversationId: 'private-sibling' }
  const sibling = harness(storage, siblingScope)
  expect(await sibling.service.check()).toEqual({ kind: 'empty' })
  expect(sibling.receipt).not.toHaveBeenCalled()
  expect(sibling.post).not.toHaveBeenCalled()
  const accepted = await sibling.service.submit({
    ...input(),
    text: 'Sibling only',
  })
  expect(accepted.kind).toBe('accepted')
  if (accepted.kind !== 'accepted') throw Error('Expected accepted sibling')
  await sibling.service.finishAccepted(accepted.envelope)
  expect(main.store.read()).toEqual(mainEnvelope)
  const remounted = harness(storage, scope)
  remounted.receipt.mockResolvedValue({ accepted: true })
  const recovered = await remounted.service.check()
  expect(recovered).toMatchObject({
    kind: 'accepted',
    envelope: { payload: { messageId: mainEnvelope.payload.messageId } },
  })
  expect(remounted.post).not.toHaveBeenCalled()
  expect(new PendingSendStore(storage, siblingScope).read()).toBeNull()
})

it('requires exact send scope or a declared main alias before any recovery operation', () => {
  const destination = {
    ...scope,
    conversationId: 'main',
    isMainConversation: true,
  }
  expect(() => assertSendDestination(scope, destination)).not.toThrow()
  expect(() =>
    assertSendDestination(scope, {
      ...destination,
      conversationId: 'sibling',
      isMainConversation: false,
    }),
  ).toThrow()
  expect(() =>
    assertSendDestination({ ...scope, conversationId: 'sibling' }, destination),
  ).toThrow()
  expect(() =>
    assertSendDestination(
      { ...scope, conversationId: 'sibling' },
      { ...destination, conversationId: 'sibling', isMainConversation: false },
    ),
  ).not.toThrow()
})
