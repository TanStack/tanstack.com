import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createNotebookAiCheckpoint,
  listNotebookAiCheckpoints,
  loadLatestNotebookAiCheckpoint,
  loadNotebookAiCheckpoint,
  notebookAiCheckpointMatchesExecution,
  removeNotebookAiCheckpoint,
  updateNotebookAiCheckpointExpectedExecution,
} from '../src/utils/notebook-ai-checkpoints.client'
import type { NotebookAiExecution } from '../src/utils/notebook-ai'

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

class FakeRequest<TResult> {
  error: DOMException | null = null
  onsuccess: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(readonly result: TResult) {}
}

class FakeTransaction {
  error: DOMException | null = null
  oncomplete: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null

  constructor(private readonly values: Map<string, unknown>) {}

  objectStore() {
    return new FakeObjectStore(this.values, this)
  }
}

class FakeObjectStore {
  constructor(
    private readonly values: Map<string, unknown>,
    private readonly transaction: FakeTransaction,
  ) {}

  get(key: IDBValidKey) {
    return this.complete(this.values.get(String(key)))
  }

  put(value: unknown, key: IDBValidKey) {
    return this.complete(key, () => this.values.set(String(key), value))
  }

  delete(key: IDBValidKey) {
    return this.complete(undefined, () => this.values.delete(String(key)))
  }

  private complete<TResult>(result: TResult, update?: () => void) {
    const request = new FakeRequest(result)
    queueMicrotask(() => {
      update?.()
      request.onsuccess?.()
      this.transaction.oncomplete?.()
    })
    return request
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

function createExecution(
  source: string,
  files: Record<string, string> = { '/index.tsx': source },
): NotebookAiExecution {
  return {
    runtime: {
      type: 'webcontainer',
      install: { command: 'pnpm', args: ['install'] },
      start: { command: 'pnpm', args: ['dev'] },
    },
    workspace: {
      version: 1,
      entry: '/index.tsx',
      files,
      binaryFiles: { '/pixel.png': 'AA==' },
      imports: { react: 'https://esm.sh/react' },
    },
  }
}

test('notebook AI checkpoints deduplicate, roll back, and stay LRU bounded', async () => {
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'localStorage',
  )
  const indexedDbDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'indexedDB',
  )
  const originalNow = Date.now
  const localStorage = new MemoryStorage()
  const indexedDb = new FakeIndexedDb()
  let now = 1_000

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: localStorage,
  })
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: indexedDb,
  })
  Date.now = () => now

  try {
    const firstExecution = createExecution('export default "first"', {
      '/other.ts': 'export const other = true',
      '/index.tsx': 'export default "first"',
    })
    const sameExecution = createExecution('export default "first"', {
      '/index.tsx': 'export default "first"',
      '/other.ts': 'export const other = true',
    })
    const first = await createNotebookAiCheckpoint(
      'notebook-1:thread-1',
      'turn-1',
      firstExecution,
    )
    now += 1
    const duplicate = await createNotebookAiCheckpoint(
      'notebook-1:thread-1',
      'turn-2',
      sameExecution,
    )

    assert.ok(first)
    assert.ok(duplicate)
    assert.equal(first.executionId, duplicate.executionId)
    assert.equal(first.expectedExecutionId, first.executionId)
    assert.match(first.executionId, /^[0-9a-f]{64}$/)
    assert.equal(indexedDb.values.size, 1)
    assert.equal(listNotebookAiCheckpoints('notebook-2:thread-1').length, 0)

    const stagedExecution = createExecution('export default "staged"')
    assert.equal(
      await notebookAiCheckpointMatchesExecution(first, firstExecution),
      true,
    )
    assert.equal(
      await notebookAiCheckpointMatchesExecution(first, stagedExecution),
      false,
    )
    const updated = await updateNotebookAiCheckpointExpectedExecution(
      'notebook-1:thread-1',
      'turn-1',
      stagedExecution,
    )
    assert.ok(updated)
    assert.notEqual(updated.expectedExecutionId, updated.executionId)
    assert.equal(indexedDb.values.size, 1)
    assert.equal(
      await notebookAiCheckpointMatchesExecution(updated, stagedExecution),
      true,
    )
    assert.equal(
      await notebookAiCheckpointMatchesExecution(updated, firstExecution),
      false,
    )
    assert.deepEqual(
      await loadNotebookAiCheckpoint('notebook-1:thread-1', 'turn-1'),
      firstExecution,
    )

    const storedIndex = Array.from(localStorage.values.values()).join('\n')
    assert.doesNotMatch(storedIndex, /apiKey|transcript|toolCall|rawBody/)
    assert.deepEqual(
      await loadNotebookAiCheckpoint('notebook-1:thread-1', 'turn-1'),
      firstExecution,
    )

    const loaded = await loadNotebookAiCheckpoint(
      'notebook-1:thread-1',
      'turn-1',
    )
    assert.ok(loaded)
    loaded.workspace.files['/index.tsx'] = 'mutated after load'
    assert.deepEqual(
      await loadNotebookAiCheckpoint('notebook-1:thread-1', 'turn-1'),
      firstExecution,
    )

    await removeNotebookAiCheckpoint('notebook-1:thread-1', 'turn-1')
    assert.equal(indexedDb.values.size, 1)
    await removeNotebookAiCheckpoint('notebook-1:thread-1', 'turn-2')
    assert.equal(indexedDb.values.size, 0)

    const replaceFirst = await createNotebookAiCheckpoint(
      'notebook-1:replacement',
      'turn-1',
      firstExecution,
    )
    assert.ok(replaceFirst)
    now += 1
    const replacementExecution = createExecution('export default "replacement"')
    const replacement = await createNotebookAiCheckpoint(
      'notebook-1:replacement',
      'turn-1',
      replacementExecution,
    )
    assert.ok(replacement)
    assert.notEqual(replacement.executionId, replaceFirst.executionId)
    assert.equal(indexedDb.values.has(replaceFirst.executionId), false)
    assert.deepEqual(
      await loadNotebookAiCheckpoint('notebook-1:replacement', 'turn-1'),
      replacementExecution,
    )
    await removeNotebookAiCheckpoint('notebook-1:replacement', 'turn-1')

    await createNotebookAiCheckpoint(
      'notebook-1:thread-2',
      'turn-1',
      firstExecution,
    )
    now += 1
    const secondExecution = createExecution('export default "second"')
    const second = await createNotebookAiCheckpoint(
      'notebook-1:thread-2',
      'turn-2',
      secondExecution,
    )
    assert.ok(second)

    now += 1
    await loadNotebookAiCheckpoint('notebook-1:thread-2', 'turn-1')
    const latest = await loadLatestNotebookAiCheckpoint('notebook-1:thread-2')
    assert.equal(latest?.checkpoint.id, 'turn-2')
    assert.deepEqual(latest?.execution, secondExecution)

    const corruptValue = indexedDb.values.get(second.executionId)
    assert.equal(typeof corruptValue, 'string')
    indexedDb.values.set(second.executionId, '{')
    assert.equal(
      await loadNotebookAiCheckpoint('notebook-1:thread-2', 'turn-2'),
      undefined,
    )
    assert.equal(indexedDb.values.has(second.executionId), false)
    assert.equal(
      listNotebookAiCheckpoints('notebook-1:thread-2').some(
        (checkpoint) => checkpoint.id === 'turn-2',
      ),
      false,
    )

    const fallbackExecution = createExecution('export default "fallback"')
    now += 1
    await createNotebookAiCheckpoint(
      'notebook-1:fallback',
      'turn-1',
      fallbackExecution,
    )
    now += 1
    const corruptLatest = await createNotebookAiCheckpoint(
      'notebook-1:fallback',
      'turn-2',
      createExecution('export default "corrupt latest"'),
    )
    assert.ok(corruptLatest)
    indexedDb.values.set(corruptLatest.executionId, '{')
    assert.deepEqual(
      (await loadLatestNotebookAiCheckpoint('notebook-1:fallback'))?.execution,
      fallbackExecution,
    )

    for (let index = 0; index < 51; index += 1) {
      now += 1
      await createNotebookAiCheckpoint(
        'notebook-lru:thread-1',
        `turn-${index}`,
        createExecution(`export default ${index}`),
      )
    }

    const retained = listNotebookAiCheckpoints('notebook-lru:thread-1')
    assert.equal(retained.length, 50)
    assert.equal(
      retained.some((checkpoint) => checkpoint.id === 'turn-0'),
      false,
    )
    assert.equal(
      retained.some((checkpoint) => checkpoint.id === 'turn-50'),
      true,
    )
    assert.equal(indexedDb.values.size, 50)

    const storedEntry = Array.from(localStorage.values.entries()).find(
      ([key]) => key.includes('checkpoints'),
    )
    assert.ok(storedEntry)
    const [storedKey, storedValue] = storedEntry
    const invalidExpectedExecutionId = storedValue.replace(
      /("expectedExecutionId":")[0-9a-f]{64}(")/,
      '$1invalid$2',
    )
    assert.notEqual(invalidExpectedExecutionId, storedValue)
    localStorage.setItem(storedKey, invalidExpectedExecutionId)
    assert.deepEqual(listNotebookAiCheckpoints('notebook-lru:thread-1'), [])
    assert.equal(localStorage.getItem(storedKey), null)

    const missingExpectedExecutionId = storedValue.replace(
      /,"expectedExecutionId":"[0-9a-f]{64}"/,
      '',
    )
    assert.notEqual(missingExpectedExecutionId, storedValue)
    localStorage.setItem(storedKey, missingExpectedExecutionId)
    assert.deepEqual(listNotebookAiCheckpoints('notebook-lru:thread-1'), [])
    assert.equal(localStorage.getItem(storedKey), null)
  } finally {
    Date.now = originalNow
    if (localStorageDescriptor) {
      Object.defineProperty(globalThis, 'localStorage', localStorageDescriptor)
    } else {
      Reflect.deleteProperty(globalThis, 'localStorage')
    }
    if (indexedDbDescriptor) {
      Object.defineProperty(globalThis, 'indexedDB', indexedDbDescriptor)
    } else {
      Reflect.deleteProperty(globalThis, 'indexedDB')
    }
  }
})
