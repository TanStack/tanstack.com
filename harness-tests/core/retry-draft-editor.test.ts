import { describe, expect, it, vi } from 'vitest'
import {
  RetryDraftEditor,
  retryDraftSendInput,
  retryDraftBlocksNavigation,
} from '../../src/chat/core/retry-draft-editor'
import {
  RetryDraftStore,
  type RetryDraftLock,
  type RetryDraftSeed,
} from '../../src/chat/core/retry-draft'

const scope = {
  userId: 'user',
  workspaceId: 'workspace',
  botId: 'target',
  conversationId: 'room',
}
const attemptId = 'abcdef00-1234-4567-89ab-012345678901'
const messageId = 'abcdef00-1234-4567-89ab-012345678902'
const seed: RetryDraftSeed = {
  attemptId,
  target: { botId: scope.botId, conversationId: scope.conversationId },
  evidenceDigest: 'a'.repeat(43),
  request: {
    text: 'Original',
    attachments: [],
    references: [],
    runModel: { provider: 'openai', model: 'original', reasoning: 'low' },
  },
}
function fixture() {
  const data = new Map<string, string>()
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value)
    }),
  }
  let queue: Promise<unknown> = Promise.resolve()
  const lock: RetryDraftLock = (_key, operation) => {
    const next = queue.then(operation)
    queue = next.catch(() => {})
    return next
  }
  const create = () =>
    new RetryDraftEditor(
      new RetryDraftStore({ storage, scope, attemptId, lock }),
    )
  return { data, storage, create }
}
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('retry draft editor', () => {
  it('keeps edits which race the accepted marker and refuses to finish cleanup until explicit review', async () => {
    const f = fixture(),
      editor = f.create()
    await editor.load(seed)
    const entered = deferred(),
      release = deferred()
    const consume = editor.store.consume.bind(editor.store)
    vi.spyOn(editor.store, 'consume').mockImplementationOnce(
      async (...args) => {
        const result = await consume(...args)
        entered.resolve()
        await release.promise
        return result
      },
    )
    const consuming = editor.consume({ draftRevision: 0, messageId })
    await entered.promise
    expect(
      await editor.change((draft) => ({
        ...draft,
        text: 'Keep this raced edit',
      })),
    ).toBe(false)
    release.resolve()
    await expect(consuming).rejects.toThrow('later edits are not saved')
    expect(editor.snapshot()).toMatchObject({
      dirty: true,
      draft: { text: 'Keep this raced edit' },
      document: { consumed: { draftRevision: 0, messageId } },
    })
    expect(await editor.keepLocal()).toBe(false)
    expect(editor.snapshot().draft?.text).toBe('Keep this raced edit')
    expect(await editor.useSaved()).toBe(true)
    expect(await editor.consume({ draftRevision: 0, messageId })).toMatchObject(
      { consumed: { draftRevision: 0, messageId } },
    )
    expect(editor.snapshot()).toMatchObject({
      dirty: false,
      error: '',
      draft: seed.request,
    })
  })

  it('navigation waits for a successful save but blocks a buffer which could be lost', async () => {
    const f = fixture(),
      editor = f.create()
    await editor.load(seed)
    expect(await retryDraftBlocksNavigation(editor)).toBe(false)
    const entered = deferred(),
      release = deferred()
    const update = editor.store.update.bind(editor.store)
    vi.spyOn(editor.store, 'update').mockImplementationOnce(async (...args) => {
      entered.resolve()
      await release.promise
      return update(...args)
    })
    const saving = editor.change((draft) => ({
      ...draft,
      text: 'Save before leaving',
    }))
    await entered.promise
    const navigation = retryDraftBlocksNavigation(editor)
    release.resolve()
    await saving
    expect(await navigation).toBe(false)
    f.storage.setItem.mockImplementationOnce(() => {
      throw new Error('Unavailable')
    })
    await editor.change((draft) => ({
      ...draft,
      text: 'Do not silently drop me',
    }))
    expect(await retryDraftBlocksNavigation(editor)).toBe(true)
    await editor.useSaved()
    await editor.consume({ draftRevision: 1, messageId })
    expect(await retryDraftBlocksNavigation(editor)).toBe(false)
  })
  it('builds only the saved request inputs with exact revision and queue delivery', async () => {
    const f = fixture(),
      editor = f.create()
    await editor.load(seed)
    const file = {
      id: 'abcdef00-1234-4567-89ab-012345678903',
      botId: scope.botId,
      conversationId: scope.conversationId,
      name: 'direct.txt',
      size: 2,
      sha256: 'c'.repeat(64),
      mediaType: 'text/plain',
      state: 'ready' as const,
      source: 'upload' as const,
      createdAt: 1,
    }
    await editor.change((draft) => ({
      ...draft,
      text: '  Exact input\n',
      attachments: [file],
      references: [
        {
          kind: 'file',
          botId: 'source',
          conversationId: 'source-room',
          fileId: 'abcdef00-1234-4567-89ab-012345678904',
          label: 'Reference',
        },
      ],
    }))
    const doc = (await editor.flush())!
    expect(retryDraftSendInput(doc)).toEqual({
      text: '  Exact input\n',
      fileIds: [file.id],
      references: [
        {
          kind: 'file',
          botId: 'source',
          conversationId: 'source-room',
          fileId: 'abcdef00-1234-4567-89ab-012345678904',
        },
      ],
      runModel: seed.request.runModel,
      proposeToolsOnly: false,
      refreshCatalog: false,
      systemOne: false,
      delivery: 'queue',
      retry: { attemptId, draftRevision: 1 },
    })
    expect(() =>
      retryDraftSendInput({
        ...doc,
        consumed: { messageId, draftRevision: 1 },
      }),
    ).toThrow('already sent')
    expect(() =>
      retryDraftSendInput({
        ...doc,
        draft: {
          ...doc.draft,
          attachments: [],
          pendingAttachments: [
            {
              id: file.id,
              name: file.name,
              size: file.size,
              sha256: file.sha256,
              mediaType: file.mediaType,
            },
          ],
        },
      }),
    ).toThrow('unfinished uploads')
    expect(() =>
      retryDraftSendInput({
        ...doc,
        draft: { text: ' ', attachments: [], references: [] },
      }),
    ).toThrow('Write a request')
  })
  it('serializes rapid edits without losing newer text, references or model intent', async () => {
    const f = fixture(),
      editor = f.create()
    await editor.load(seed)
    const text = editor.change((draft) => ({ ...draft, text: '  Revised\n' }))
    const references = editor.change((draft) => ({
      ...draft,
      references: [
        { kind: 'conversation', botId: 'another', label: 'Other conversation' },
      ],
    }))
    const model = editor.change((draft) => ({
      ...draft,
      runModel: { provider: 'anthropic', model: 'chosen' },
    }))
    expect(editor.snapshot()).toMatchObject({
      dirty: true,
      saving: true,
      draft: { text: '  Revised\n' },
    })
    await Promise.all([text, references, model])
    const saved = await editor.flush()
    expect(saved).toMatchObject({
      revision: 3,
      draft: {
        text: '  Revised\n',
        references: [{ kind: 'conversation', botId: 'another' }],
        runModel: { provider: 'anthropic', model: 'chosen' },
      },
    })
    const reloaded = f.create()
    await reloaded.load(seed)
    expect(reloaded.snapshot().draft).toEqual(saved?.draft)
  })

  it('keeps a stale tab buffer until its owner explicitly resolves the conflict', async () => {
    const f = fixture(),
      first = f.create(),
      second = f.create()
    await Promise.all([first.load(seed), second.load(seed)])
    await first.change((draft) => ({ ...draft, text: 'First tab' }))
    expect(
      await second.change((draft) => ({ ...draft, text: 'Second tab' })),
    ).toBe(false)
    expect(second.snapshot()).toMatchObject({
      dirty: true,
      draft: { text: 'Second tab' },
      conflict: { draft: { text: 'First tab' } },
    })
    await second.refresh()
    await second.load(seed)
    expect(second.snapshot().draft?.text).toBe('Second tab')
    expect(await second.flush()).toBeNull()
    expect(await second.keepLocal()).toBe(true)
    await first.refresh()
    expect(first.snapshot()).toMatchObject({
      dirty: false,
      draft: { text: 'Second tab' },
    })
    expect(second.store.read()?.revision).toBe(2)
  })

  it('keeps edits typed during conflict resolution and saves the complete latest buffer', async () => {
    const f = fixture(),
      first = f.create(),
      second = f.create()
    await Promise.all([first.load(seed), second.load(seed)])
    await first.change((draft) => ({ ...draft, text: 'Other view' }))
    await second.change((draft) => ({ ...draft, text: 'My draft' }))
    const entered = deferred(),
      release = deferred()
    const update = second.store.update.bind(second.store)
    vi.spyOn(second.store, 'update').mockImplementationOnce(async (...args) => {
      entered.resolve()
      await release.promise
      return update(...args)
    })
    const resolving = second.keepLocal()
    await entered.promise
    await second.change((draft) => ({
      ...draft,
      text: 'My draft plus new typing',
    }))
    release.resolve()
    expect(await resolving).toBe(true)
    expect(await second.flush()).toMatchObject({
      revision: 3,
      draft: { text: 'My draft plus new typing' },
    })
  })

  it('allows explicitly using the saved draft after a conflict', async () => {
    const f = fixture(),
      first = f.create(),
      second = f.create()
    await Promise.all([first.load(seed), second.load(seed)])
    await first.change((draft) => ({ ...draft, text: 'Saved elsewhere' }))
    await second.change((draft) => ({ ...draft, text: 'Unsaved here' }))
    expect(await second.useSaved()).toBe(true)
    expect(second.snapshot()).toMatchObject({
      dirty: false,
      error: '',
      draft: { text: 'Saved elsewhere' },
    })
  })

  it('retains full local input after a storage failure and can recover a committed write with a lost reply', async () => {
    const f = fixture(),
      editor = f.create()
    await editor.load(seed)
    f.storage.setItem.mockImplementationOnce((key, value) => {
      f.data.set(key, value)
      throw new Error('Lost write confirmation')
    })
    expect(
      await editor.change((draft) => ({
        ...draft,
        text: 'Do not lose me',
        references: [
          { kind: 'conversation', botId: 'other', label: 'Shared reference' },
        ],
      })),
    ).toBe(false)
    expect(editor.snapshot()).toMatchObject({
      dirty: true,
      draft: { text: 'Do not lose me' },
      conflict: { revision: 1 },
    })
    expect(await editor.flush()).toBeNull()
    await editor.keepLocal()
    expect(await editor.flush()).toMatchObject({
      revision: 2,
      draft: { text: 'Do not lose me', references: [{ botId: 'other' }] },
    })
  })

  it('does not mark accepted input consumed while unsaved edits could disappear', async () => {
    const f = fixture(),
      editor = f.create()
    await editor.load(seed)
    f.storage.setItem.mockImplementationOnce(() => {
      throw new Error('Disk full')
    })
    await editor.change((draft) => ({ ...draft, text: 'Unsaved after send' }))
    await expect(
      editor.consume({ draftRevision: 0, messageId }),
    ).rejects.toThrow('later edits are not saved')
    expect(editor.store.read()?.consumed).toBeUndefined()
    expect(editor.snapshot().draft?.text).toBe('Unsaved after send')
    await editor.keepLocal()
    await editor.consume({ draftRevision: 0, messageId })
    expect(editor.store.read()).toMatchObject({
      revision: 1,
      draft: { text: 'Unsaved after send' },
      consumed: { draftRevision: 0, messageId },
    })
    const reload = f.create()
    await reload.load(seed)
    expect(reload.snapshot().draft?.text).toBe('Unsaved after send')
    expect(
      await reload.change((draft) => ({ ...draft, text: 'Cannot resend' })),
    ).toBe(false)
  })

  it('records exact accepted revision without clearing a saved newer draft', async () => {
    const f = fixture(),
      editor = f.create()
    await editor.load(seed)
    await editor.change((draft) => ({ ...draft, text: 'Later edit' }))
    await editor.consume({ draftRevision: 0, messageId })
    expect(editor.snapshot()).toMatchObject({
      dirty: false,
      document: { revision: 1, consumed: { draftRevision: 0, messageId } },
      draft: { text: 'Later edit' },
    })
    expect(await editor.flush()).toBeNull()
    await expect(
      editor.consume({ draftRevision: 1, messageId }),
    ).rejects.toThrow('different accepted send')
  })

  it('refresh and repeated server seed wait for in-flight saves without falsely overwriting them', async () => {
    const f = fixture(),
      editor = f.create()
    await editor.load(seed)
    const entered = deferred(),
      release = deferred()
    const update = editor.store.update.bind(editor.store)
    vi.spyOn(editor.store, 'update').mockImplementationOnce(async (...args) => {
      entered.resolve()
      await release.promise
      return update(...args)
    })
    const saving = editor.change((draft) => ({
      ...draft,
      text: 'Typing while the attempt refetches',
    }))
    await entered.promise
    const refresh = editor.refresh(),
      refetch = editor.load(seed)
    release.resolve()
    await Promise.all([saving, refresh, refetch])
    expect(editor.snapshot()).toMatchObject({
      dirty: false,
      error: '',
      draft: { text: 'Typing while the attempt refetches' },
    })
  })

  it('handles an accepted server attempt without a local seed and supports retrying failed first adoption', async () => {
    const f = fixture(),
      editor = f.create()
    await editor.load()
    expect(editor.snapshot()).toMatchObject({
      ready: true,
      document: null,
      draft: null,
    })
    expect(await editor.consume({ draftRevision: 0, messageId })).toBeNull()
    f.storage.setItem.mockImplementationOnce(() => {
      throw new Error('Unavailable')
    })
    await editor.load(seed)
    expect(editor.snapshot().error).not.toBe('')
    await editor.load(seed)
    expect(editor.snapshot()).toMatchObject({
      ready: true,
      error: '',
      draft: seed.request,
    })
  })
})
