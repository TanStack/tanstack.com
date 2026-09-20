import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearBuilderProjectWorkingCopy,
  listBuilderProjectWorkingCopies,
  loadBuilderProjectWorkingCopy,
  reconcileBuilderProjectWorkingCopy,
  saveBuilderProjectWorkingCopy,
  type BuilderProjectWorkingCopy,
} from '../src/utils/builder-project-working-copy.client'
import { createSharedExampleProject } from '../src/utils/example-project'
import { createExampleWorkspace } from '../src/utils/example-workspace'

const projectId = '11111111-1111-4111-8111-111111111111'
const clientMutationId = '22222222-2222-4222-8222-222222222222'
const revisionId = '33333333-3333-4333-8333-333333333333'
const baseRevisionId = '44444444-4444-4444-8444-444444444444'
const otherRevisionId = '55555555-5555-4555-8555-555555555555'
const otherClientMutationId = '66666666-6666-4666-8666-666666666666'

function createWorkingCopy(): BuilderProjectWorkingCopy {
  return {
    projectId,
    clientMutationId,
    revisionId,
    baseRevisionId,
    expectedRevisionNumber: 4,
    project: createSharedExampleProject({
      title: 'Recovered edit',
      description: 'Stored before the debounce fires.',
      initialFile: '/index.tsx',
      workspace: createExampleWorkspace({
        entry: '/index.tsx',
        files: { '/index.tsx': 'export default 42' },
      }),
    }),
    updatedAt: 1_786_000_000_000,
  }
}

test('Builder project working copies survive a reload and hydrate only on their base revision', async () => {
  await withFakeIndexedDb(async () => {
    const workingCopy = createWorkingCopy()
    await saveBuilderProjectWorkingCopy(workingCopy)

    assert.deepEqual(
      await loadBuilderProjectWorkingCopy(projectId),
      workingCopy,
    )
    assert.deepEqual(
      await reconcileBuilderProjectWorkingCopy({
        projectId,
        currentRevisionId: baseRevisionId,
        currentRevisionNumber: 4,
      }),
      { status: 'ready', workingCopy },
    )
    assert.deepEqual(
      await loadBuilderProjectWorkingCopy(projectId),
      workingCopy,
    )
  })
})

test('an authoritative target revision acknowledges and clears its working copy idempotently', async () => {
  await withFakeIndexedDb(async () => {
    const workingCopy = createWorkingCopy()
    await saveBuilderProjectWorkingCopy(workingCopy)

    assert.deepEqual(
      await reconcileBuilderProjectWorkingCopy({
        projectId,
        currentRevisionId: revisionId,
        currentRevisionNumber: 5,
      }),
      { status: 'acknowledged' },
    )
    assert.equal(await loadBuilderProjectWorkingCopy(projectId), undefined)
    assert.equal(await clearBuilderProjectWorkingCopy(workingCopy), false)
    assert.deepEqual(
      await reconcileBuilderProjectWorkingCopy({
        projectId,
        currentRevisionId: revisionId,
        currentRevisionNumber: 5,
      }),
      { status: 'none' },
    )
  })
})

test('revision conflicts preserve the recoverable working copy', async () => {
  await withFakeIndexedDb(async () => {
    const workingCopy = createWorkingCopy()
    await saveBuilderProjectWorkingCopy(workingCopy)

    assert.deepEqual(
      await reconcileBuilderProjectWorkingCopy({
        projectId,
        currentRevisionId: otherRevisionId,
        currentRevisionNumber: 5,
      }),
      { status: 'conflict', workingCopy },
    )
    assert.equal(
      await clearBuilderProjectWorkingCopy({
        ...workingCopy,
        revisionId: otherRevisionId,
      }),
      false,
    )
    assert.deepEqual(
      await loadBuilderProjectWorkingCopy(projectId),
      workingCopy,
    )
  })
})

test('two tabs retain independent working copies across a crash', async () => {
  await withFakeIndexedDb(async () => {
    const firstTab = createWorkingCopy()
    const secondTab: BuilderProjectWorkingCopy = {
      ...createWorkingCopy(),
      clientMutationId: otherClientMutationId,
      revisionId: otherRevisionId,
      project: createSharedExampleProject({
        title: 'Second tab edit',
        description: 'Saved by another tab before either request was sent.',
        initialFile: '/index.tsx',
        workspace: createExampleWorkspace({
          entry: '/index.tsx',
          files: { '/index.tsx': 'export default 84' },
        }),
      }),
      updatedAt: firstTab.updatedAt + 1,
    }

    await saveBuilderProjectWorkingCopy(firstTab)
    await saveBuilderProjectWorkingCopy(secondTab)

    assert.deepEqual(await listBuilderProjectWorkingCopies(projectId), [
      secondTab,
      firstTab,
    ])
    assert.deepEqual(
      await reconcileBuilderProjectWorkingCopy({
        projectId,
        currentRevisionId: baseRevisionId,
        currentRevisionNumber: 4,
      }),
      { status: 'ready', workingCopy: secondTab },
    )

    assert.equal(await clearBuilderProjectWorkingCopy(secondTab), true)
    assert.deepEqual(await listBuilderProjectWorkingCopies(projectId), [
      firstTab,
    ])
  })
})

test('reconciliation clears only acknowledged copies and retains stale conflicts', async () => {
  await withFakeIndexedDb(async () => {
    const staleTab = createWorkingCopy()
    const acknowledgedTab: BuilderProjectWorkingCopy = {
      ...createWorkingCopy(),
      clientMutationId: otherClientMutationId,
      revisionId: otherRevisionId,
      baseRevisionId,
      updatedAt: staleTab.updatedAt + 1,
    }

    await saveBuilderProjectWorkingCopy(staleTab)
    await saveBuilderProjectWorkingCopy(acknowledgedTab)

    assert.deepEqual(
      await reconcileBuilderProjectWorkingCopy({
        projectId,
        currentRevisionId: acknowledgedTab.revisionId,
        currentRevisionNumber: 5,
      }),
      { status: 'conflict', workingCopy: staleTab },
    )
    assert.deepEqual(await listBuilderProjectWorkingCopies(projectId), [
      staleTab,
    ])
    assert.equal(await clearBuilderProjectWorkingCopy(acknowledgedTab), false)
  })
})

test('reconciliation prefers a valid head candidate over a newer stale candidate', async () => {
  await withFakeIndexedDb(async () => {
    const readyTab = createWorkingCopy()
    const staleTab: BuilderProjectWorkingCopy = {
      ...createWorkingCopy(),
      clientMutationId: otherClientMutationId,
      revisionId: otherRevisionId,
      baseRevisionId: revisionId,
      expectedRevisionNumber: readyTab.expectedRevisionNumber + 1,
      updatedAt: readyTab.updatedAt + 1,
    }

    await saveBuilderProjectWorkingCopy(readyTab)
    await saveBuilderProjectWorkingCopy(staleTab)

    assert.deepEqual(
      await reconcileBuilderProjectWorkingCopy({
        projectId,
        currentRevisionId: baseRevisionId,
        currentRevisionNumber: readyTab.expectedRevisionNumber,
      }),
      { status: 'ready', workingCopy: readyTab },
    )
    assert.deepEqual(await listBuilderProjectWorkingCopies(projectId), [
      staleTab,
      readyTab,
    ])
  })
})

test('legacy project-keyed working copies migrate without being dropped', async () => {
  await withFakeIndexedDb(async (indexedDb) => {
    const workingCopy = createWorkingCopy()
    indexedDb.values.set(projectId, { version: 1, ...workingCopy })

    assert.deepEqual(await listBuilderProjectWorkingCopies(projectId), [
      workingCopy,
    ])
    assert.equal(indexedDb.values.has(projectId), false)
    assert.equal(indexedDb.values.size, 1)
  })
})

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

  getAll() {
    return this.transaction.request(() => [...this.values.values()])
  }

  getAllKeys() {
    return this.transaction.request(() => [...this.values.keys()])
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

async function withFakeIndexedDb(
  run: (indexedDb: FakeIndexedDb) => Promise<void>,
) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')
  const indexedDb = new FakeIndexedDb()
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: indexedDb,
  })
  try {
    await run(indexedDb)
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'indexedDB', descriptor)
    else Reflect.deleteProperty(globalThis, 'indexedDB')
  }
}
