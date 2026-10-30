import { describe, expect, it, vi } from 'vitest'
import {
  RetryDraftConflictError,
  RetryDraftStorageError,
  RetryDraftStore,
  type RetryDraftLock,
  type RetryDraftSeed,
  type RetryDraftStorage,
} from '../../src/chat/core/retry-draft'

const scope = {
  userId: 'user',
  workspaceId: 'workspace',
  botId: 'target',
  conversationId: 'target-conversation',
}
const attemptId = 'abcdef00-1234-4567-89ab-012345678901'
const messageId = 'abcdef00-1234-4567-89ab-012345678902'
const seed = (): RetryDraftSeed => ({
  attemptId,
  target: { botId: scope.botId, conversationId: scope.conversationId },
  evidenceDigest: 'a'.repeat(43),
  request: {
    text: '  Original request\n',
    attachments: [
      {
        id: 'abcdef00-1234-4567-89ab-012345678903',
        botId: scope.botId,
        conversationId: scope.conversationId,
        name: 'original.txt',
        mediaType: 'text/plain',
        size: 7,
        sha256: 'b'.repeat(64),
        source: 'upload',
        state: 'ready',
        createdAt: 1,
      },
    ],
    references: [
      {
        kind: 'file',
        botId: 'source',
        conversationId: 'source-conversation',
        fileId: 'abcdef00-1234-4567-89ab-012345678904',
        label: 'Reference.txt',
      },
    ],
    runModel: { provider: 'openai', model: 'original-model', reasoning: 'low' },
  },
})
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
  override = {},
) => new RetryDraftStore({ storage, scope, attemptId, lock, ...override })

describe('atomic retry drafts', () => {
  it('saves unfinished upload identity atomically and replaces it with the verified target snapshot', async () => {
    const m = memory(),
      drafts = store(m.storage)
    const original = await drafts.adoptRetrySeed(seed())
    const pending = {
      id: 'abcdef00-1234-4567-89ab-012345678905',
      name: 'sketch.png',
      size: 10,
      mediaType: 'image/png',
      sha256: 'c'.repeat(64),
      generated: true as const,
    }
    const added = await drafts.update(0, {
      ...original.draft,
      pendingAttachments: [pending],
    })
    expect(store(m.storage).read()?.draft.pendingAttachments).toEqual([pending])
    const completed = await drafts.update(added.revision, {
      ...added.draft,
      pendingAttachments: [],
      attachments: [
        ...added.draft.attachments,
        {
          ...pending,
          botId: scope.botId,
          conversationId: scope.conversationId,
          source: 'upload',
          state: 'ready',
          createdAt: 2,
        },
      ],
    })
    expect(completed.draft.attachments.map((file) => file.id)).toEqual([
      original.draft.attachments[0].id,
      pending.id,
    ])
    expect(completed.draft.pendingAttachments).toEqual([])
    expect(completed.draft.references).toEqual(original.draft.references)
    expect(completed.draft.runModel).toEqual(original.draft.runModel)
  })

  it('rejects duplicate or excessive pending selections without changing the saved draft', async () => {
    const m = memory(),
      drafts = store(m.storage)
    const original = await drafts.adoptRetrySeed(seed())
    const file = original.draft.attachments[0]
    const pending = {
      id: file.id.toUpperCase(),
      name: file.name,
      size: file.size,
      mediaType: file.mediaType,
      sha256: file.sha256,
    }
    expect(() =>
      drafts.update(0, { ...original.draft, pendingAttachments: [pending] }),
    ).toThrow()
    expect(() =>
      drafts.update(0, {
        ...original.draft,
        pendingAttachments: Array.from({ length: 4 }, (_, index) => ({
          ...pending,
          id: `abcdef00-1234-4567-89ab-01234567890${index + 5}`,
        })),
      }),
    ).toThrow()
    expect(drafts.read()).toEqual(original)
    expect(() =>
      store(memory().storage).adoptRetrySeed({
        ...seed(),
        request: {
          ...seed().request,
          pendingAttachments: [{ ...pending, id: messageId }],
        },
      }),
    ).toThrow('unfinished uploads')
  })

  it('adopts all fields in one write without changing the existing normal draft', async () => {
    const m = memory()
    m.values.set('gum.draft:existing', 'Keep this normal draft')
    const drafts = store(m.storage)
    const original = seed()
    const adopted = await drafts.adoptRetrySeed(original)
    expect(adopted).toMatchObject({
      version: 1,
      scope,
      revision: 0,
      draft: original.request,
      seed: original,
    })
    expect(m.storage.setItem).toHaveBeenCalledTimes(1)
    expect(m.values.get('gum.draft:existing')).toBe('Keep this normal draft')
    expect(m.values.size).toBe(2)
    adopted.draft.text = 'Only returned object changed'
    original.request.attachments[0].name = 'Only caller changed'
    expect(drafts.read()?.draft).toEqual(seed().request)
  })

  it('does not overwrite edits, even an empty draft, when the server seed returns again', async () => {
    const m = memory(),
      drafts = store(m.storage)
    await drafts.adoptRetrySeed(seed())
    const edited = await drafts.update(0, {
      text: '',
      attachments: [],
      references: [],
      runModel: { provider: 'openai', model: 'different-model' },
    })
    const reloaded = store(m.storage)
    expect(await reloaded.adoptRetrySeed(seed())).toEqual(edited)
    expect(m.storage.setItem).toHaveBeenCalledTimes(2)
  })

  it('keeps the saved draft when a same-attempt seed changes inputs or evidence', async () => {
    const m = memory(),
      drafts = store(m.storage)
    const original = await drafts.adoptRetrySeed(seed())
    for (const changed of [
      { ...seed(), evidenceDigest: 'c'.repeat(43) },
      { ...seed(), request: { ...seed().request, text: 'Changed source' } },
    ])
      await expect(drafts.adoptRetrySeed(changed)).rejects.toBeInstanceOf(
        RetryDraftConflictError,
      )
    expect(drafts.read()).toEqual(original)
    expect(m.storage.setItem).toHaveBeenCalledTimes(1)
  })

  it('rejects another target or attempt without writing any data', () => {
    const m = memory(),
      drafts = store(m.storage)
    for (const changed of [
      { ...seed(), target: { ...scope, botId: 'another' } },
      { ...seed(), target: { botId: scope.botId, conversationId: 'sibling' } },
      { ...seed(), attemptId: messageId },
    ])
      expect(() => drafts.adoptRetrySeed(changed as RetryDraftSeed)).toThrow()
    expect(m.storage.setItem).not.toHaveBeenCalled()
  })

  it('serializes simultaneous adoption and rejects a stale concurrent edit', async () => {
    const m = memory(),
      lock = sharedLock()
    const first = store(m.storage, lock),
      second = store(m.storage, lock)
    const [a, b] = await Promise.all([
      first.adoptRetrySeed(seed()),
      second.adoptRetrySeed(seed()),
    ])
    expect(a).toEqual(b)
    expect(m.storage.setItem).toHaveBeenCalledTimes(1)
    const changes = await Promise.allSettled([
      first.update(0, { ...a.draft, text: 'First editor' }),
      second.update(0, { ...b.draft, text: 'Second editor' }),
    ])
    expect(changes[0].status).toBe('fulfilled')
    expect(changes[1]).toMatchObject({
      status: 'rejected',
      reason: expect.any(RetryDraftConflictError),
    })
    expect(first.read()?.draft.text).toBe('First editor')
    expect(b.draft.text).toBe(seed().request.text)
  })

  it('retains later edits while recording the accepted older revision and never re-seeds', async () => {
    const m = memory(),
      lock = sharedLock()
    const first = store(m.storage, lock),
      second = store(m.storage, lock)
    const adopted = await first.adoptRetrySeed(seed())
    await second.update(0, {
      ...adopted.draft,
      text: 'Keep my later unsent edit',
    })
    const receipt = { draftRevision: 0, messageId }
    const consumed = await first.consume(receipt)
    expect(consumed).toMatchObject({
      revision: 1,
      draft: { text: 'Keep my later unsent edit' },
      consumed: receipt,
    })
    const remount = store(m.storage, lock)
    expect(await remount.adoptRetrySeed(seed())).toEqual(consumed)
    expect(await remount.consume(receipt)).toEqual(consumed)
    await expect(remount.update(1, adopted.draft)).rejects.toBeInstanceOf(
      RetryDraftConflictError,
    )
    await expect(
      remount.consume({ draftRevision: 1, messageId }),
    ).rejects.toBeInstanceOf(RetryDraftConflictError)
    await expect(
      remount.consume({ draftRevision: 0, messageId: attemptId }),
    ).rejects.toBeInstanceOf(RetryDraftConflictError)
    expect(remount.read()).toEqual(consumed)
  })

  it('does not let a stale editor remove a concurrent consumption marker', async () => {
    const m = memory(),
      lock = sharedLock()
    const first = store(m.storage, lock),
      second = store(m.storage, lock)
    const adopted = await first.adoptRetrySeed(seed())
    const results = await Promise.allSettled([
      first.consume({ draftRevision: 0, messageId }),
      second.update(0, { ...adopted.draft, text: 'Stale update' }),
    ])
    expect(results[0].status).toBe('fulfilled')
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: expect.any(RetryDraftConflictError),
    })
    expect(second.read()?.consumed).toEqual({ draftRevision: 0, messageId })
    expect(second.read()?.draft.text).toBe(seed().request.text)
  })

  it('rejects receipt revisions that do not exist and edits before adoption', async () => {
    const m = memory(),
      drafts = store(m.storage)
    await expect(drafts.update(0, seed().request)).rejects.toBeInstanceOf(
      RetryDraftConflictError,
    )
    await expect(
      drafts.consume({ draftRevision: 0, messageId }),
    ).rejects.toBeInstanceOf(RetryDraftConflictError)
    await drafts.adoptRetrySeed(seed())
    await expect(
      drafts.consume({ draftRevision: 1, messageId }),
    ).rejects.toBeInstanceOf(RetryDraftConflictError)
    expect(drafts.read()?.consumed).toBeUndefined()
  })

  it('does not treat unreadable, corrupt or wrong-owner storage as empty', async () => {
    const m = memory(),
      drafts = store(m.storage)
    const valid = await drafts.adoptRetrySeed(seed())
    for (const raw of [
      '{broken',
      'x'.repeat(1024 * 1024 + 1),
      JSON.stringify({ ...valid, scope: { ...scope, userId: 'other' } }),
    ]) {
      m.values.set(drafts.key, raw)
      m.storage.setItem.mockClear()
      await expect(drafts.adoptRetrySeed(seed())).rejects.toBeInstanceOf(
        RetryDraftStorageError,
      )
      expect(m.storage.setItem).not.toHaveBeenCalled()
      expect(m.values.get(drafts.key)).toBe(raw)
    }
    m.storage.getItem.mockImplementation(() => {
      throw new Error('Disabled')
    })
    await expect(drafts.adoptRetrySeed(seed())).rejects.toBeInstanceOf(
      RetryDraftStorageError,
    )
  })

  it('rejects failed or unconfirmed writes instead of claiming a draft was adopted', async () => {
    for (const write of [
      () => {
        throw new Error('Quota exceeded')
      },
      () => {},
    ]) {
      const m = memory()
      m.storage.setItem.mockImplementation(write)
      await expect(
        store(m.storage).adoptRetrySeed(seed()),
      ).rejects.toBeInstanceOf(RetryDraftStorageError)
      expect(m.values.size).toBe(0)
    }
  })

  it('recovers the same document after a write commits but its acknowledgement fails', async () => {
    const m = memory(),
      drafts = store(m.storage)
    m.storage.setItem.mockImplementationOnce((key, value) => {
      m.values.set(key, value)
      throw new Error('Lost acknowledgement')
    })
    await expect(drafts.adoptRetrySeed(seed())).rejects.toBeInstanceOf(
      RetryDraftStorageError,
    )
    const reloaded = store(m.storage)
    const recovered = await reloaded.adoptRetrySeed(seed())
    expect(recovered.draft).toEqual(seed().request)
    expect(m.storage.setItem).toHaveBeenCalledTimes(1)
  })

  it('retains edits after a failed update and recovers a committed consumption marker', async () => {
    const m = memory(),
      drafts = store(m.storage)
    const initial = await drafts.adoptRetrySeed(seed())
    m.storage.setItem.mockImplementationOnce(() => {
      throw new Error('Quota exceeded')
    })
    await expect(
      drafts.update(0, { ...initial.draft, text: 'Do not pretend this saved' }),
    ).rejects.toBeInstanceOf(RetryDraftStorageError)
    expect(drafts.read()).toEqual(initial)
    m.storage.setItem.mockImplementationOnce((key, value) => {
      m.values.set(key, value)
      throw new Error('Lost acknowledgement')
    })
    const receipt = { draftRevision: 0, messageId }
    await expect(drafts.consume(receipt)).rejects.toBeInstanceOf(
      RetryDraftStorageError,
    )
    expect((await store(m.storage).consume(receipt)).consumed).toEqual(receipt)
  })

  it('keeps account, workspace, conversation and attempt draft namespaces separate', async () => {
    const m = memory(),
      first = store(m.storage)
    await first.adoptRetrySeed(seed())
    for (const override of [
      { scope: { ...scope, userId: 'other' } },
      { scope: { ...scope, workspaceId: 'other' } },
      { scope: { ...scope, conversationId: 'sibling' } },
      { attemptId: messageId },
    ])
      expect(store(m.storage, sharedLock(), override).read()).toBeNull()
    expect(first.read()?.draft).toEqual(seed().request)
  })

  it('refuses original-source file IDs presented as imported target attachments', async () => {
    const m = memory(),
      drafts = store(m.storage)
    const wrong = seed()
    wrong.request.attachments[0].conversationId = 'original-source'
    expect(() => drafts.adoptRetrySeed(wrong)).toThrow()
    expect(m.storage.setItem).not.toHaveBeenCalled()
    await drafts.adoptRetrySeed(seed())
    for (const change of [
      { conversationId: 'sibling' },
      { conversationId: undefined },
      { botId: 'different-bot' },
    ]) {
      const draft = seed().request
      Object.assign(draft.attachments[0], change)
      expect(() => drafts.update(0, draft)).toThrow(RetryDraftConflictError)
    }
    expect(m.storage.setItem).toHaveBeenCalledTimes(1)
  })

  it('validates total file count and duplicate references before writing', async () => {
    const m = memory(),
      drafts = store(m.storage)
    await drafts.adoptRetrySeed(seed())
    const content = seed().request
    expect(() =>
      drafts.update(0, {
        ...content,
        references: [content.references[0], content.references[0]],
      }),
    ).toThrow()
    expect(() =>
      drafts.update(0, {
        ...content,
        attachments: Array.from({ length: 5 }, (_, index) => ({
          ...content.attachments[0],
          id: `abcdef00-1234-4567-89ab-${String(index + 10).padStart(12, '0')}`,
        })),
      }),
    ).toThrow()
    expect(m.storage.setItem).toHaveBeenCalledTimes(1)
  })
})
