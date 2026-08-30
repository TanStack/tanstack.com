import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BuilderProjectPendingPromptCapacityError,
  clearBuilderProjectPendingPrompt,
  listBuilderProjectPendingPrompts,
  loadBuilderProjectPendingPrompt,
  saveBuilderProjectPendingPrompt,
  type BuilderProjectPendingPrompt,
} from '../src/utils/builder-project-pending-prompt.client'

const projectId = '11111111-1111-4111-8111-111111111111'
const promptId = '22222222-2222-4222-8222-222222222222'

function createPendingPrompt(): BuilderProjectPendingPrompt {
  return {
    projectId,
    promptId,
    queueKind: 'active',
    threadId: '33333333-3333-4333-8333-333333333333',
    threadCreateClientMutationId: '44444444-4444-4444-8444-444444444444',
    runEnqueueClientMutationId: '55555555-5555-4555-8555-555555555555',
    runClaimClientMutationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    runCancelClientMutationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    runId: '66666666-6666-4666-8666-666666666666',
    userMessageId: '77777777-7777-4777-8777-777777777777',
    userMessageClientMutationId: '88888888-8888-4888-8888-888888888888',
    content: 'Build a durable chart',
    provider: 'openai',
    model: 'gpt-5.6-luna',
    leaseOwnerId: '99999999-9999-4999-8999-999999999999',
    createdAt: '2026-08-20T12:00:00.000Z',
  }
}

test('a submitted Builder prompt survives reload until its start is acknowledged', async () => {
  await withFakeIndexedDb(async () => {
    const pendingPrompt = createPendingPrompt()
    await saveBuilderProjectPendingPrompt(pendingPrompt)

    assert.deepEqual(
      await loadBuilderProjectPendingPrompt(projectId),
      pendingPrompt,
    )
    assert.equal(
      await clearBuilderProjectPendingPrompt(
        projectId,
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ),
      false,
    )
    assert.deepEqual(
      await loadBuilderProjectPendingPrompt(projectId),
      pendingPrompt,
    )
    assert.equal(
      await clearBuilderProjectPendingPrompt(projectId, promptId),
      true,
    )
    assert.equal(await loadBuilderProjectPendingPrompt(projectId), undefined)
  })
})

test('an active prompt and queued prompts survive reload in order', async () => {
  await withFakeIndexedDb(async () => {
    const activePrompt = createPendingPrompt()
    const firstQueuedPrompt = createQueuedPrompt(20, 'Add tooltips')
    const secondQueuedPrompt = createQueuedPrompt(30, 'Animate the bars')

    await saveBuilderProjectPendingPrompt(activePrompt)
    await saveBuilderProjectPendingPrompt(firstQueuedPrompt)
    await saveBuilderProjectPendingPrompt(secondQueuedPrompt)

    assert.deepEqual(await listBuilderProjectPendingPrompts(projectId), [
      activePrompt,
      firstQueuedPrompt,
      secondQueuedPrompt,
    ])
    await clearBuilderProjectPendingPrompt(projectId, activePrompt.promptId)
    assert.deepEqual(await listBuilderProjectPendingPrompts(projectId), [
      firstQueuedPrompt,
      secondQueuedPrompt,
    ])
  })
})

test('pending prompt capacity rejects entry 101 without damaging the queue', async () => {
  await withFakeIndexedDb(async () => {
    const pendingPrompts = Array.from({ length: 100 }, (_, index) =>
      createQueuedPrompt(1_000 + index * 10, `Queued prompt ${index + 1}`),
    )
    for (const pendingPrompt of pendingPrompts) {
      await saveBuilderProjectPendingPrompt(pendingPrompt)
    }

    await assert.rejects(
      saveBuilderProjectPendingPrompt(
        createQueuedPrompt(3_000, 'This prompt exceeds capacity'),
      ),
      (error: unknown) =>
        error instanceof BuilderProjectPendingPromptCapacityError,
    )
    assert.deepEqual(
      await listBuilderProjectPendingPrompts(projectId),
      pendingPrompts,
    )
  })
})

test('a recovered pre-run prompt reuses its durable identity and clears exactly once', async () => {
  await withFakeIndexedDb(async () => {
    const pendingPrompt = createPendingPrompt()
    await saveBuilderProjectPendingPrompt(pendingPrompt)
    await saveBuilderProjectPendingPrompt({
      ...pendingPrompt,
      queueKind: 'active',
    })

    assert.deepEqual(await listBuilderProjectPendingPrompts(projectId), [
      pendingPrompt,
    ])
    assert.equal(
      await clearBuilderProjectPendingPrompt(projectId, pendingPrompt.promptId),
      true,
    )
    assert.equal(
      await clearBuilderProjectPendingPrompt(projectId, pendingPrompt.promptId),
      false,
    )
  })
})

function createQueuedPrompt(
  index: number,
  content: string,
): BuilderProjectPendingPrompt {
  return {
    ...createPendingPrompt(),
    promptId: uuid(index),
    queueKind: 'queue',
    runEnqueueClientMutationId: uuid(index + 1),
    runClaimClientMutationId: uuid(index + 2),
    runCancelClientMutationId: uuid(index + 3),
    runId: uuid(index + 4),
    userMessageId: uuid(index + 5),
    userMessageClientMutationId: uuid(index + 6),
    content,
  }
}

function uuid(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

class FakeRequest<TResult> {
  result!: TResult
  error: DOMException | null = null
  onsuccess: (() => void) | null = null
  onerror: (() => void) | null = null
}

class FakeTransaction {
  error: DOMException | null = null
  oncomplete: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  private pendingRequestCount = 0
  private completionGeneration = 0
  private aborted = false

  constructor(private readonly values: Map<string, unknown>) {}

  objectStore() {
    return new FakeObjectStore(this.values, this)
  }

  request<TResult>(operation: () => TResult) {
    const request = new FakeRequest<TResult>()
    this.pendingRequestCount += 1
    queueMicrotask(() => {
      if (this.aborted) return
      request.result = operation()
      this.pendingRequestCount -= 1
      request.onsuccess?.()
      this.scheduleCompletion()
    })
    return request
  }

  abort() {
    if (this.aborted) return
    this.aborted = true
    queueMicrotask(() => this.onabort?.())
  }

  private scheduleCompletion() {
    const generation = ++this.completionGeneration
    queueMicrotask(() => {
      if (
        !this.aborted &&
        this.pendingRequestCount === 0 &&
        generation === this.completionGeneration
      ) {
        this.oncomplete?.()
      }
    })
  }
}

class FakeObjectStore {
  constructor(
    private readonly values: Map<string, unknown>,
    private readonly transaction: FakeTransaction,
  ) {}

  get(key: IDBValidKey) {
    return this.transaction.request(() => this.values.get(String(key)))
  }

  put(value: unknown, key: IDBValidKey) {
    return this.transaction.request(() => {
      this.values.set(String(key), value)
      return key
    })
  }

  delete(key: IDBValidKey) {
    return this.transaction.request(() => {
      this.values.delete(String(key))
      return undefined
    })
  }
}

class FakeDatabase {
  onversionchange: (() => void) | null = null
  readonly objectStoreNames = { contains: () => false }

  constructor(private readonly values: Map<string, unknown>) {}

  close() {}
  createObjectStore() {}
  transaction() {
    return new FakeTransaction(this.values)
  }
}

class FakeOpenRequest {
  error: DOMException | null = null
  onupgradeneeded: (() => void) | null = null
  onerror: (() => void) | null = null
  onblocked: (() => void) | null = null
  onsuccess: (() => void) | null = null

  constructor(readonly result: FakeDatabase) {}
}

class FakeIndexedDb {
  readonly values = new Map<string, unknown>()

  open() {
    const request = new FakeOpenRequest(new FakeDatabase(this.values))
    queueMicrotask(() => {
      request.onupgradeneeded?.()
      request.onsuccess?.()
    })
    return request
  }
}

async function withFakeIndexedDb(run: () => Promise<void>) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')
  const indexedDb = new FakeIndexedDb()
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: indexedDb,
  })
  try {
    await run()
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'indexedDB', descriptor)
    else Reflect.deleteProperty(globalThis, 'indexedDB')
  }
}
