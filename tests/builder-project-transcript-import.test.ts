import assert from 'node:assert/strict'
import test from 'node:test'
import {
  type BuilderAiTranscriptMessage,
  listBuilderAiThreads,
  loadBuilderAiTranscript,
  removeBuilderAiTranscriptScopeSnapshot,
  saveBuilderAiTranscript,
} from '../src/utils/builder-ai-persistence.client'
import {
  createBuilderProjectForkTranscriptImportCommands,
  createBuilderProjectTranscriptImportCommands,
  getBuilderProjectDraftPromotionIds,
  importBuilderProjectTranscriptCommands,
  prepareBuilderProjectForkTranscriptImport,
  promoteBuilderProjectTranscript,
} from '../src/utils/builder-project-transcript-import.client'
import type { BuilderProjectSyncRow } from '../src/utils/builder-project-sync.client'
import { listBuilderProjectSyncOutbox } from '../src/utils/builder-project-sync-outbox.client'
import {
  builderProjectTranscriptImportMaxRequestBytes,
  getBuilderProjectSyncCommandRequestBytes,
  type BuilderProjectSyncCommand,
} from '../src/utils/builder-project-sync'

const projectId = '11111111-1111-4111-8111-111111111111'
const threadId = '22222222-2222-4222-8222-222222222222'
const userMessageId = '33333333-3333-4333-8333-333333333333'
const assistantMessageId = '44444444-4444-4444-8444-444444444444'
const scope = `local-draft:${projectId}`

test('draft promotion IDs are stable, distinct UUIDs', () => {
  const first = getBuilderProjectDraftPromotionIds(projectId)
  const second = getBuilderProjectDraftPromotionIds(projectId)

  assert.deepEqual(first, second)
  assert.notEqual(first.revisionId, projectId)
  assert.notEqual(first.transcriptImportMutationId, projectId)
  assert.notEqual(first.revisionId, first.transcriptImportMutationId)
  assert.match(first.revisionId, /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i)
  assert.match(
    first.transcriptImportMutationId,
    /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i,
  )
  assert.throws(
    () => getBuilderProjectDraftPromotionIds('not-a-project-id'),
    /Invalid Builder project draft ID/,
  )
})

test('draft transcript stays local and queued until the server acknowledges it', async () => {
  await withBrowserStorage(async () => {
    await saveBuilderAiTranscript(scope, threadId, [
      { id: userMessageId, role: 'user', content: 'Build a chart' },
      {
        id: assistantMessageId,
        role: 'assistant',
        content: 'Built the chart.',
      },
    ])

    const { transcriptImportMutationId } =
      getBuilderProjectDraftPromotionIds(projectId)
    const sent: Array<BuilderProjectSyncCommand> = []
    let offline = true
    const send = async (command: BuilderProjectSyncCommand) => {
      sent.push(command)
      const queued = await listBuilderProjectSyncOutbox(projectId)
      assert.deepEqual(
        queued.map((entry) => entry.clientMutationId),
        [command.clientMutationId],
      )
      if (offline) throw new Error('Offline')
      return {
        clientMutationId: command.clientMutationId,
        sequence: 3,
        events: [],
      }
    }

    await assert.rejects(
      promoteBuilderProjectTranscript({
        projectId,
        scope,
        clientMutationId: transcriptImportMutationId,
        send,
      }),
      /Offline/,
    )

    const [queued] = await listBuilderProjectSyncOutbox(projectId)
    assert.ok(queued)
    assert.equal(queued.command.type, 'transcript.import')
    assert.equal(listBuilderAiThreads(scope).length, 1)
    assert.equal((await loadBuilderAiTranscript(scope, threadId))?.length, 2)

    offline = false
    await promoteBuilderProjectTranscript({
      projectId,
      scope,
      clientMutationId: transcriptImportMutationId,
      send,
    })

    assert.deepEqual(sent, [queued.command, queued.command])
    assert.deepEqual(await listBuilderProjectSyncOutbox(projectId), [])
    assert.deepEqual(listBuilderAiThreads(scope), [])
    assert.equal(await loadBuilderAiTranscript(scope, threadId), undefined)
  })
})

test('large transcripts queue stable bounded chunks before sending and clear after every acknowledgement', async () => {
  await withBrowserStorage(async () => {
    const messages: Array<BuilderAiTranscriptMessage> = []
    for (let index = 0; index < 12; index++) {
      messages.push({
        id: uuid(index + 100),
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `${index}:`.padEnd(180_000, 'x'),
      })
    }
    await saveBuilderAiTranscript(scope, threadId, messages)

    const { transcriptImportMutationId } =
      getBuilderProjectDraftPromotionIds(projectId)
    const first = await createBuilderProjectTranscriptImportCommands(
      scope,
      transcriptImportMutationId,
    )
    const second = await createBuilderProjectTranscriptImportCommands(
      scope,
      transcriptImportMutationId,
    )
    assert.ok(first.length > 1)
    assert.deepEqual(
      first.map((command) => command.clientMutationId),
      second.map((command) => command.clientMutationId),
    )
    assert.equal(
      new Set(first.map((command) => command.clientMutationId)).size,
      first.length,
    )
    for (const command of first) {
      assert.match(
        command.clientMutationId,
        /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i,
      )
      assert.ok(
        getBuilderProjectSyncCommandRequestBytes(command) <=
          builderProjectTranscriptImportMaxRequestBytes,
      )
    }

    const chunkIds = first.map((command) => command.clientMutationId)
    const queueSnapshots: Array<Array<string>> = []
    let fail = true
    const send = async (command: BuilderProjectSyncCommand) => {
      queueSnapshots.push(
        (await listBuilderProjectSyncOutbox(projectId)).map(
          (entry) => entry.clientMutationId,
        ),
      )
      if (fail && command.clientMutationId === chunkIds[1]) {
        throw new Error('Offline')
      }
      return {
        clientMutationId: command.clientMutationId,
        sequence: chunkIds.indexOf(command.clientMutationId) + 1,
        events: [],
      }
    }

    await assert.rejects(
      promoteBuilderProjectTranscript({
        projectId,
        scope,
        clientMutationId: transcriptImportMutationId,
        send,
      }),
      /Offline/,
    )
    assert.deepEqual(new Set(queueSnapshots[0]), new Set(chunkIds))
    assert.equal(listBuilderAiThreads(scope).length, 1)
    assert.ok((await loadBuilderAiTranscript(scope, threadId))?.length)

    fail = false
    const retrySnapshotIndex = queueSnapshots.length
    await promoteBuilderProjectTranscript({
      projectId,
      scope,
      clientMutationId: transcriptImportMutationId,
      send,
    })
    assert.deepEqual(
      new Set(queueSnapshots[retrySnapshotIndex]),
      new Set(chunkIds),
    )
    assert.deepEqual(await listBuilderProjectSyncOutbox(projectId), [])
    assert.deepEqual(listBuilderAiThreads(scope), [])
    assert.equal(await loadBuilderAiTranscript(scope, threadId), undefined)
  })
})

test('legacy terminal activity is compacted before transcript import', async () => {
  await withBrowserStorage(async () => {
    await saveBuilderAiTranscript(scope, threadId, [
      {
        id: assistantMessageId,
        role: 'assistant',
        content: 'Finished',
        activity: {
          id: uuid(500),
          status: 'complete',
          startedAt: 1,
          completedAt: 2,
          items: Array.from({ length: 200 }, (_, index) => ({
            id: `activity-${index}`,
            source: 'tool',
            name: 'inspect_file',
            status: 'complete',
            startedAt: 1,
            completedAt: 2,
            details: { message: 'x'.repeat(4_000) },
          })),
        },
      },
    ])

    const [command] = await createBuilderProjectTranscriptImportCommands(
      scope,
      getBuilderProjectDraftPromotionIds(projectId).transcriptImportMutationId,
    )
    const activity = command?.runs[0]?.activity
    assert.ok(activity)
    assert.ok(
      new TextEncoder().encode(JSON.stringify(activity)).byteLength <=
        128 * 1024,
    )
  })
})

test('forking a synced transcript makes a stable bounded copy with destination IDs', async () => {
  const sourceProjectId = uuid(700)
  const ownerId = uuid(701)
  const sourceThreadId = uuid(702)
  const sourceRunId = uuid(703)
  const sourceUserMessageId = uuid(704)
  const sourceAssistantMessageId = uuid(705)
  const rows: Array<BuilderProjectSyncRow> = [
    {
      key: `thread:${sourceThreadId}`,
      kind: 'thread',
      value: {
        id: sourceThreadId,
        projectId: sourceProjectId,
        ownerId,
        clientMutationId: uuid(706),
        title: 'Build a chart',
        lastMessagePosition: 2,
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:01:00.000Z',
        archivedAt: null,
      },
    },
    {
      key: `message:${sourceUserMessageId}`,
      kind: 'message',
      value: {
        id: sourceUserMessageId,
        projectId: sourceProjectId,
        ownerId,
        threadId: sourceThreadId,
        runId: sourceRunId,
        clientMutationId: uuid(707),
        role: 'user',
        content: 'Build a chart',
        parts: [],
        position: 1,
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z',
      },
    },
    {
      key: `message:${sourceAssistantMessageId}`,
      kind: 'message',
      value: {
        id: sourceAssistantMessageId,
        projectId: sourceProjectId,
        ownerId,
        threadId: sourceThreadId,
        runId: sourceRunId,
        clientMutationId: uuid(708),
        role: 'assistant',
        content: 'Built the chart.',
        parts: [],
        position: 2,
        createdAt: '2026-08-20T10:01:00.000Z',
        updatedAt: '2026-08-20T10:01:00.000Z',
      },
    },
    {
      key: `run:${sourceRunId}`,
      kind: 'run',
      value: {
        id: sourceRunId,
        projectId: sourceProjectId,
        ownerId,
        threadId: sourceThreadId,
        clientMutationId: uuid(709),
        queueKind: 'queue',
        status: 'completed',
        provider: 'openai',
        model: 'gpt-5.6-luna',
        baseRevisionId: uuid(710),
        resultRevisionId: uuid(711),
        leaseOwnerId: null,
        leaseFencingToken: 1,
        leaseExpiresAt: null,
        lastHeartbeatAt: '2026-08-20T10:01:00.000Z',
        activity: {
          id: sourceRunId,
          status: 'complete',
          startedAt: 1,
          completedAt: 2,
          items: [],
        },
        error: null,
        startedAt: '2026-08-20T10:00:00.000Z',
        completedAt: '2026-08-20T10:01:00.000Z',
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:01:00.000Z',
      },
    },
  ]
  const clientMutationId = uuid(712)

  const first = await createBuilderProjectForkTranscriptImportCommands({
    clientMutationId,
    source: { type: 'sync', rows },
  })
  const second = await createBuilderProjectForkTranscriptImportCommands({
    clientMutationId,
    source: { type: 'sync', rows },
  })

  assert.deepEqual(first, second)
  assert.equal(first.length, 1)
  const command = first[0]
  assert.ok(command)
  assert.ok(
    getBuilderProjectSyncCommandRequestBytes(command) <=
      builderProjectTranscriptImportMaxRequestBytes,
  )
  assert.notEqual(command.threads[0]?.id, sourceThreadId)
  assert.notEqual(command.messages[0]?.id, sourceUserMessageId)
  assert.notEqual(command.runs[0]?.id, sourceRunId)
  assert.equal(command.threads[0]?.title, 'Build a chart')
  assert.deepEqual(
    command.messages.map((message) => message.content),
    ['Build a chart', 'Built the chart.'],
  )
  assert.equal(command.runs[0]?.provider, 'openai')
  assert.equal(command.runs[0]?.model, 'gpt-5.6-luna')
  assert.equal(command.messages[0]?.threadId, command.threads[0]?.id)
  assert.equal(command.messages[0]?.runId, command.runs[0]?.id)
  assert.equal(command.runs[0]?.threadId, command.threads[0]?.id)
  assert.equal(command.runs[0]?.activity?.id, command.runs[0]?.id)
  assert.equal(rows[0]?.value.id, sourceThreadId)
})

test('a failed fork import keeps its exact commands queued and its local source intact', async () => {
  await withBrowserStorage(async () => {
    const forkScope = `anonymous:${uuid(800)}`
    const forkThreadId = uuid(801)
    await saveBuilderAiTranscript(forkScope, forkThreadId, [
      { id: uuid(802), role: 'user', content: 'Keep this exact request' },
      { id: uuid(803), role: 'assistant', content: 'Keep this exact reply' },
    ])
    const commands = await createBuilderProjectForkTranscriptImportCommands({
      clientMutationId: uuid(804),
      source: { type: 'local', scope: forkScope },
    })

    await assert.rejects(
      importBuilderProjectTranscriptCommands({
        projectId,
        commands,
        send: async () => {
          throw new Error('Offline')
        },
      }),
      /Offline/,
    )

    assert.deepEqual(
      (await listBuilderProjectSyncOutbox(projectId)).map(
        (entry) => entry.command,
      ),
      commands,
    )
    assert.deepEqual(
      (await loadBuilderAiTranscript(forkScope, forkThreadId))?.map(
        (message) => message.content,
      ),
      ['Keep this exact request', 'Keep this exact reply'],
    )
  })
})

test('a concurrent local append prevents cleanup and gets a new content-derived import ID', async () => {
  await withBrowserStorage(async () => {
    const forkScope = `anonymous:${uuid(900)}`
    const forkThreadId = uuid(901)
    const initialMessages: Array<BuilderAiTranscriptMessage> = [
      { id: uuid(902), role: 'user', content: 'Initial request' },
      { id: uuid(903), role: 'assistant', content: 'Initial reply' },
    ]
    await saveBuilderAiTranscript(forkScope, forkThreadId, initialMessages)
    const input = {
      clientMutationId: uuid(904),
      source: { type: 'local', scope: forkScope },
    } satisfies Parameters<typeof prepareBuilderProjectForkTranscriptImport>[0]
    const prepared = await prepareBuilderProjectForkTranscriptImport(input)
    assert.ok(prepared.localSnapshot)

    await saveBuilderAiTranscript(forkScope, forkThreadId, [
      ...initialMessages,
      { id: uuid(905), role: 'user', content: 'Appended in another tab' },
    ])
    const removed = await removeBuilderAiTranscriptScopeSnapshot(
      prepared.localSnapshot,
    )
    assert.equal(removed, false)
    assert.equal(
      (await loadBuilderAiTranscript(forkScope, forkThreadId))?.length,
      3,
    )

    const appended = await prepareBuilderProjectForkTranscriptImport(input)
    assert.notDeepEqual(
      appended.commands.map((command) => command.clientMutationId),
      prepared.commands.map((command) => command.clientMutationId),
    )
  })
})

function uuid(index: number) {
  return `aaaaaaaa-aaaa-4aaa-8aaa-${index.toString(16).padStart(12, '0')}`
}

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
  readonly objectStoreNames = {
    contains: (name: string) => this.stores.has(name),
  }

  constructor(private readonly stores: Map<string, Map<string, unknown>>) {}

  close() {}

  createObjectStore(name: string) {
    this.stores.set(name, new Map())
  }

  transaction(name: string) {
    const values = this.stores.get(name)
    if (!values) throw new Error(`Missing object store ${name}`)
    return new FakeTransaction(values)
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
  private readonly databases = new Map<
    string,
    Map<string, Map<string, unknown>>
  >()

  open(name: string) {
    const stores = this.databases.get(name) ?? new Map()
    const isNew = !this.databases.has(name)
    this.databases.set(name, stores)
    const request = new FakeOpenRequest(new FakeDatabase(stores))
    queueMicrotask(() => {
      if (isNew) request.onupgradeneeded?.()
      request.onsuccess?.()
    })
    return request
  }
}

async function withBrowserStorage(run: () => Promise<void>) {
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'localStorage',
  )
  const indexedDbDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'indexedDB',
  )
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: new MemoryStorage(),
  })
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: new FakeIndexedDb(),
  })

  try {
    await run()
  } finally {
    restoreProperty('localStorage', localStorageDescriptor)
    restoreProperty('indexedDB', indexedDbDescriptor)
  }
}

function restoreProperty(
  name: 'indexedDB' | 'localStorage',
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor)
  } else {
    Reflect.deleteProperty(globalThis, name)
  }
}
