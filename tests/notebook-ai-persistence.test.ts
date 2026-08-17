import assert from 'node:assert/strict'
import test from 'node:test'
import { reduceNotebookAiActivity } from '../src/utils/notebook-ai-activity'
import {
  createNotebookAiThreadId,
  listNotebookAiThreads,
  loadNotebookAiTranscript,
  removeNotebookAiThread,
  saveNotebookAiTranscript,
  touchNotebookAiThread,
  type NotebookAiTranscriptMessage,
} from '../src/utils/notebook-ai-persistence.client'

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
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

class FakeRequest<TResult> {
  result: TResult
  error: DOMException | null = null
  onsuccess: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(result: TResult) {
    this.result = result
  }
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

test('notebook AI persistence is scoped, UTF-8 measured, and LRU bounded', async () => {
  assert.equal(listNotebookAiThreads('missing').length, 0)
  assert.equal(await loadNotebookAiTranscript('missing', 'missing'), undefined)
  await saveNotebookAiTranscript('missing', 'missing', [])
  await removeNotebookAiThread('missing', 'missing')

  const firstId = createNotebookAiThreadId()
  const secondId = createNotebookAiThreadId()
  assert.notEqual(firstId, secondId)
  assert.match(firstId, /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i)

  const localStorageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'localStorage',
  )
  const indexedDbDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'indexedDB',
  )
  const localStorage = new MemoryStorage()
  const indexedDb = new FakeIndexedDb()

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: localStorage,
  })
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: indexedDb,
  })

  try {
    const scope = 'user-1:notebook-1'
    const firstMessage: NotebookAiTranscriptMessage = {
      id: 'thread-0-user',
      role: 'user',
      content: '  Make   a 🙂 chart  ',
    }
    await saveNotebookAiTranscript(scope, 'thread-0', [firstMessage])

    const expectedState = {
      messages: [
        {
          id: firstMessage.id,
          role: firstMessage.role,
          parts: [{ type: 'text', content: firstMessage.content }],
        },
      ],
    }
    const expectedBytes = new TextEncoder().encode(
      JSON.stringify(expectedState),
    ).byteLength
    const initialThreads = listNotebookAiThreads(scope)
    assert.equal(initialThreads[0]?.title, 'Make a 🙂 chart')
    assert.equal(initialThreads[0]?.sizeBytes, expectedBytes)
    assert.deepEqual(await loadNotebookAiTranscript(scope, 'thread-0'), [
      firstMessage,
    ])
    assert.deepEqual(listNotebookAiThreads('user-2:notebook-1'), [])

    for (let index = 1; index < 50; index++) {
      await saveNotebookAiTranscript(scope, `thread-${index}`, [
        {
          id: `thread-${index}-user`,
          role: 'user',
          content: `Message ${index}`,
        },
      ])
    }

    touchNotebookAiThread(scope, 'thread-0')
    await saveNotebookAiTranscript(scope, 'thread-50', [
      { id: 'thread-50-user', role: 'user', content: 'Message 50' },
    ])

    const retainedIds = listNotebookAiThreads(scope).map((thread) => thread.id)
    assert.equal(retainedIds.length, 50)
    assert.equal(retainedIds.includes('thread-0'), true)
    assert.equal(retainedIds.includes('thread-1'), false)
    assert.equal(retainedIds.includes('thread-50'), true)
    assert.equal(indexedDb.values.size, 50)
    assert.equal(
      [...indexedDb.values.keys()].some((key) => key.endsWith('"thread-1"]')),
      false,
    )

    await removeNotebookAiThread(scope, 'thread-50')
    assert.equal(indexedDb.values.size, 49)
    assert.equal(
      listNotebookAiThreads(scope).some((thread) => thread.id === 'thread-50'),
      false,
    )

    let activity = reduceNotebookAiActivity(undefined, {
      type: 'run-started',
      runId: 'activity-run',
      timestamp: 1_000,
    })
    activity = reduceNotebookAiActivity(activity, {
      type: 'item-running',
      runId: 'activity-run',
      itemId: 'edit-1',
      source: 'tool',
      name: 'replace_file',
      timestamp: 1_100,
      input: {
        path: '/index.tsx',
        content: 'RAW_REPLACEMENT_MUST_NOT_PERSIST',
      },
    })
    activity = reduceNotebookAiActivity(activity, {
      type: 'item-completed',
      runId: 'activity-run',
      itemId: 'edit-1',
      source: 'tool',
      name: 'replace_file',
      timestamp: 1_200,
      output: { path: '/index.tsx', characters: 32 },
    })
    activity = reduceNotebookAiActivity(activity, {
      type: 'run-completed',
      runId: 'activity-run',
      timestamp: 1_300,
    })
    const activityMessage: NotebookAiTranscriptMessage = {
      id: 'activity-assistant',
      role: 'assistant',
      content: 'Updated the chart.',
      activity,
    }
    await saveNotebookAiTranscript(scope, 'activity-thread', [activityMessage])
    assert.deepEqual(await loadNotebookAiTranscript(scope, 'activity-thread'), [
      activityMessage,
    ])
    const activityBlob = [...indexedDb.values.entries()].find(([key]) =>
      key.endsWith('"activity-thread"]'),
    )?.[1]
    assert.ok(activityBlob)
    assert.doesNotMatch(
      JSON.stringify(activityBlob),
      /RAW_REPLACEMENT_MUST_NOT_PERSIST/,
    )

    await saveNotebookAiTranscript(scope, 'corrupt', [
      { id: 'corrupt-user', role: 'user', content: 'Corrupt me' },
    ])
    const corruptKey = [...indexedDb.values.keys()].find((key) =>
      key.endsWith('"corrupt"]'),
    )
    if (!corruptKey) throw new Error('Missing corrupt transcript fixture')
    indexedDb.values.set(corruptKey, { messages: 'invalid' })
    assert.equal(await loadNotebookAiTranscript(scope, 'corrupt'), undefined)
    assert.equal(indexedDb.values.has(corruptKey), false)

    const indexKey = localStorage.key(0)
    assert.ok(indexKey)
    localStorage.setItem(indexKey, '{')
    assert.deepEqual(listNotebookAiThreads(scope), [])
    assert.equal(localStorage.getItem(indexKey), null)
  } finally {
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
