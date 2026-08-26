import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BuilderProjectSyncCommandRejectedError,
  BuilderProjectSyncOutboxAcknowledgementError,
  BuilderProjectSyncOutboxCapacityError,
  BuilderProjectSyncOutboxConflictError,
  BuilderProjectSyncOutboxUnavailableError,
  discardBuilderProjectSyncCommand,
  enqueueBuilderProjectSyncCommand,
  listBuilderProjectSyncOutbox,
  replayBuilderProjectSyncOutbox,
  sendBuilderProjectSyncCommandFromOutbox,
} from '../src/utils/builder-project-sync-outbox.client'
import type {
  BuilderProjectSyncCommand,
  BuilderProjectSyncCommandRejection,
  BuilderProjectSyncCommandResult,
} from '../src/utils/builder-project-sync'

const firstProjectId = '11111111-1111-4111-8111-111111111111'
const secondProjectId = '22222222-2222-4222-8222-222222222222'
const capacityProjectId = '33333333-3333-4333-8333-333333333333'

type ThreadCreateCommand = Extract<
  BuilderProjectSyncCommand,
  { type: 'thread.create' }
>
type RunFinishCommand = Extract<
  BuilderProjectSyncCommand,
  { type: 'run.finish' }
>

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

test('Builder project sync outbox is explicitly unavailable during SSR', async () => {
  const indexedDbDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'indexedDB',
  )
  Reflect.deleteProperty(globalThis, 'indexedDB')

  try {
    await assert.rejects(
      listBuilderProjectSyncOutbox(firstProjectId),
      BuilderProjectSyncOutboxUnavailableError,
    )
  } finally {
    restoreIndexedDb(indexedDbDescriptor)
  }
})

test('Builder project sync outbox is scoped, ordered, idempotent, and bounded', async () => {
  await withFakeIndexedDb(async (indexedDb) => {
    const first = createThreadCommand(1, 'First')
    const second = createThreadCommand(2, 'Second')
    const otherProject = createThreadCommand(3, 'Other project')

    const firstEntry = await enqueueBuilderProjectSyncCommand(
      firstProjectId,
      first,
    )
    const secondEntry = await enqueueBuilderProjectSyncCommand(
      firstProjectId,
      second,
    )
    await enqueueBuilderProjectSyncCommand(secondProjectId, otherProject)

    assert.ok(secondEntry.createdAt > firstEntry.createdAt)
    assert.deepEqual(
      (await listBuilderProjectSyncOutbox(firstProjectId)).map(
        (entry) => entry.clientMutationId,
      ),
      [first.clientMutationId, second.clientMutationId],
    )
    assert.deepEqual(
      (await listBuilderProjectSyncOutbox(secondProjectId)).map(
        (entry) => entry.clientMutationId,
      ),
      [otherProject.clientMutationId],
    )

    const duplicate = await enqueueBuilderProjectSyncCommand(
      firstProjectId,
      first,
    )
    assert.deepEqual(duplicate, firstEntry)
    assert.equal((await listBuilderProjectSyncOutbox(firstProjectId)).length, 2)

    await assert.rejects(
      enqueueBuilderProjectSyncCommand(firstProjectId, {
        ...first,
        thread: { ...first.thread, title: 'Conflicting command' },
      }),
      BuilderProjectSyncOutboxConflictError,
    )

    indexedDb.values.set('corrupt-record', {
      version: 1,
      projectId: firstProjectId,
      command: 'invalid',
    })
    await listBuilderProjectSyncOutbox(firstProjectId)
    assert.equal(indexedDb.values.has('corrupt-record'), false)

    for (let index = 0; index < 100; index++) {
      await enqueueBuilderProjectSyncCommand(
        capacityProjectId,
        createThreadCommand(index + 100),
      )
    }
    await assert.rejects(
      enqueueBuilderProjectSyncCommand(
        capacityProjectId,
        createThreadCommand(201),
      ),
      BuilderProjectSyncOutboxCapacityError,
    )
    assert.equal(
      (await listBuilderProjectSyncOutbox(capacityProjectId)).length,
      100,
    )
  })
})

test('Builder project sync replay removes only authoritative acknowledgements', async () => {
  await withFakeIndexedDb(async () => {
    const first = createThreadCommand(301, 'First replay')
    const second = createThreadCommand(302, 'Second replay')
    await enqueueBuilderProjectSyncCommand(firstProjectId, first)
    await enqueueBuilderProjectSyncCommand(firstProjectId, second)

    const sent: Array<string> = []
    await assert.rejects(
      replayBuilderProjectSyncOutbox(firstProjectId, async (command) => {
        sent.push(command.clientMutationId)
        if (command.clientMutationId === second.clientMutationId) {
          throw new Error('Offline')
        }
        return acknowledgement(command)
      }),
      /Offline/,
    )

    assert.deepEqual(sent, [first.clientMutationId, second.clientMutationId])
    assert.deepEqual(
      (await listBuilderProjectSyncOutbox(firstProjectId)).map(
        (entry) => entry.clientMutationId,
      ),
      [second.clientMutationId],
    )

    await assert.rejects(
      replayBuilderProjectSyncOutbox(firstProjectId, async () =>
        acknowledgement(first),
      ),
      BuilderProjectSyncOutboxAcknowledgementError,
    )
    assert.equal((await listBuilderProjectSyncOutbox(firstProjectId)).length, 1)

    await replayBuilderProjectSyncOutbox(firstProjectId, async (command) =>
      acknowledgement(command),
    )
    assert.deepEqual(await listBuilderProjectSyncOutbox(firstProjectId), [])
  })
})

test('Builder project sync replay discards terminal rejections and continues in order', async () => {
  await withFakeIndexedDb(async () => {
    const staleFinish = createRunFinishCommand(351)
    const laterCommand = createThreadCommand(352, 'After stale finish')
    await enqueueBuilderProjectSyncCommand(firstProjectId, staleFinish)
    await enqueueBuilderProjectSyncCommand(firstProjectId, laterCommand)

    const sent: Array<string> = []
    const replay = await replayBuilderProjectSyncOutbox(
      firstProjectId,
      async (command) => {
        sent.push(command.clientMutationId)
        return command.clientMutationId === staleFinish.clientMutationId
          ? rejection(command)
          : acknowledgement(command)
      },
    )

    assert.deepEqual(sent, [
      staleFinish.clientMutationId,
      laterCommand.clientMutationId,
    ])
    assert.deepEqual(replay.rejections, [rejection(staleFinish)])
    assert.deepEqual(replay.acknowledgements, [acknowledgement(laterCommand)])
    assert.deepEqual(await listBuilderProjectSyncOutbox(firstProjectId), [])

    const rejectedCommand = createRunFinishCommand(353)
    await assert.rejects(
      sendBuilderProjectSyncCommandFromOutbox(
        firstProjectId,
        rejectedCommand,
        async (command) => rejection(command),
      ),
      (error: unknown) => {
        if (!(error instanceof BuilderProjectSyncCommandRejectedError)) {
          return false
        }
        assert.equal(
          error.rejection.clientMutationId,
          rejectedCommand.clientMutationId,
        )
        return true
      },
    )
    assert.deepEqual(await listBuilderProjectSyncOutbox(firstProjectId), [])
  })
})

test('Builder project revision conflicts stay queued and block later commands', async () => {
  await withFakeIndexedDb(async () => {
    const conflictingRevision = createThreadCommand(361, 'Conflicting edit')
    const laterCommand = createThreadCommand(362, 'Blocked edit')
    await enqueueBuilderProjectSyncCommand(firstProjectId, conflictingRevision)
    await enqueueBuilderProjectSyncCommand(firstProjectId, laterCommand)

    const sent: Array<string> = []
    const replay = await replayBuilderProjectSyncOutbox(
      firstProjectId,
      async (command) => {
        sent.push(command.clientMutationId)
        return rejection(command, 'project-revision-conflict')
      },
    )

    assert.deepEqual(sent, [conflictingRevision.clientMutationId])
    assert.deepEqual(replay.acknowledgements, [])
    assert.deepEqual(replay.rejections, [
      rejection(conflictingRevision, 'project-revision-conflict'),
    ])
    assert.deepEqual(
      (await listBuilderProjectSyncOutbox(firstProjectId)).map(
        (entry) => entry.clientMutationId,
      ),
      [conflictingRevision.clientMutationId, laterCommand.clientMutationId],
    )

    await discardBuilderProjectSyncCommand(
      firstProjectId,
      conflictingRevision.clientMutationId,
    )
    await replayBuilderProjectSyncOutbox(firstProjectId, async (command) =>
      acknowledgement(command),
    )
    assert.deepEqual(await listBuilderProjectSyncOutbox(firstProjectId), [])
  })
})

test('Builder project sync send persists before invoking the network sender', async () => {
  await withFakeIndexedDb(async () => {
    const command = createThreadCommand(401, 'Persist before send')

    const result = await sendBuilderProjectSyncCommandFromOutbox(
      firstProjectId,
      command,
      async (queuedCommand) => {
        assert.deepEqual(
          (await listBuilderProjectSyncOutbox(firstProjectId)).map(
            (entry) => entry.clientMutationId,
          ),
          [command.clientMutationId],
        )
        return acknowledgement(queuedCommand)
      },
    )

    assert.equal(result.clientMutationId, command.clientMutationId)
    assert.deepEqual(await listBuilderProjectSyncOutbox(firstProjectId), [])
  })
})

function createThreadCommand(
  index: number,
  title = `Conversation ${index}`,
): ThreadCreateCommand {
  return {
    type: 'thread.create',
    clientMutationId: uuid(index),
    thread: {
      id: uuid(index + 1_000),
      title,
      createdAt: '2026-08-20T12:00:00.000Z',
    },
  }
}

function createRunFinishCommand(index: number): RunFinishCommand {
  return {
    type: 'run.finish',
    clientMutationId: uuid(index),
    runId: uuid(index + 1_000),
    leaseOwnerId: uuid(index + 2_000),
    leaseFencingToken: 1,
    status: 'cancelled',
  }
}

function acknowledgement(
  command: BuilderProjectSyncCommand,
): BuilderProjectSyncCommandResult {
  return {
    clientMutationId: command.clientMutationId,
    sequence: 1,
    events: [],
  }
}

function rejection(
  command: BuilderProjectSyncCommand,
  code: BuilderProjectSyncCommandRejection['code'] = 'run-lease-invalid',
): BuilderProjectSyncCommandRejection {
  return {
    clientMutationId: command.clientMutationId,
    rejected: true,
    code,
    message:
      code === 'run-lease-invalid'
        ? 'Builder project run lease is no longer valid'
        : 'Builder project revision changed',
  }
}

function uuid(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

async function withFakeIndexedDb(
  run: (indexedDb: FakeIndexedDb) => Promise<void>,
) {
  const indexedDbDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'indexedDB',
  )
  const indexedDb = new FakeIndexedDb()
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: indexedDb,
  })

  try {
    await run(indexedDb)
  } finally {
    restoreIndexedDb(indexedDbDescriptor)
  }
}

function restoreIndexedDb(descriptor: PropertyDescriptor | undefined) {
  if (descriptor) {
    Object.defineProperty(globalThis, 'indexedDB', descriptor)
  } else {
    Reflect.deleteProperty(globalThis, 'indexedDB')
  }
}
