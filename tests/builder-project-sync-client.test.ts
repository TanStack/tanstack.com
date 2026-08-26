import assert from 'node:assert/strict'
import test from 'node:test'
import {
  builderProjectSyncProjectRow,
  builderProjectSyncRowKey,
  builderProjectSyncThreadRow,
  createBuilderProjectSyncClient as createBuilderProjectSyncClientImpl,
  getBuilderProjectBrowserSessionId,
  getBuilderProjectSyncEventChanges,
  type BuilderProjectBrowserSessionLockManager,
  type BuilderProjectSyncRow,
} from '../src/utils/builder-project-sync.client'
import {
  BuilderProjectSyncCommandRejectedError,
  listBuilderProjectSyncOutbox,
} from '../src/utils/builder-project-sync-outbox.client'
import {
  builderProjectSyncRequestSchema,
  type BuilderProjectSyncCommand,
  type BuilderProjectSyncEvent,
  type BuilderProjectSyncProject,
  type BuilderProjectSyncRun,
  type BuilderProjectSyncSnapshot,
  type BuilderProjectSyncThread,
} from '../src/utils/builder-project-sync'
import { createSharedExampleProject } from '../src/utils/example-project'
import { createExampleWorkspace } from '../src/utils/example-workspace'

const projectId = '11111111-1111-4111-8111-111111111111'
const ownerId = '22222222-2222-4222-8222-222222222222'
const revisionId = '33333333-3333-4333-8333-333333333333'
const threadId = '44444444-4444-4444-8444-444444444444'
const mutationId = '55555555-5555-4555-8555-555555555555'
const eventId = '66666666-6666-4666-8666-666666666666'
const sessionId = '77777777-7777-4777-8777-777777777777'
const runId = '88888888-8888-4888-8888-888888888888'
const heartbeatMutationId = '99999999-9999-4999-8999-999999999999'
const timestamp = '2026-08-20T12:00:00.000Z'
const snapshotHash = 'a'.repeat(64)

const project: BuilderProjectSyncProject = {
  id: projectId,
  ownerId,
  forkedFromId: null,
  title: 'Builder project',
  description: '',
  snapshotHash,
  currentRevisionId: revisionId,
  currentRevisionNumber: 1,
  lastEventSequence: 4,
  createdAt: timestamp,
  updatedAt: timestamp,
}

const snapshot: BuilderProjectSyncSnapshot = {
  project,
  cursor: 4,
  threads: [],
  messages: [],
  runs: [],
}

test('Builder project events update entity rows and advance the project cursor', () => {
  const thread = createThread('Server thread')
  const threadEvent = createEvent({
    sequence: 5,
    type: 'thread.created',
    threadId,
    payload: { thread },
  })
  const threadChanges = getBuilderProjectSyncEventChanges(project, threadEvent)

  assert.deepEqual(threadChanges.changes, [
    { type: 'update', value: builderProjectSyncThreadRow(thread) },
    {
      type: 'update',
      value: builderProjectSyncProjectRow({
        ...project,
        lastEventSequence: 5,
      }),
    },
  ])
  assert.equal(threadChanges.project?.lastEventSequence, 5)

  const updatedProject = {
    ...project,
    title: 'Updated project',
    lastEventSequence: 5,
  }
  const projectEvent = createEvent({
    sequence: 6,
    type: 'project.updated',
    payload: { project: updatedProject },
  })
  const projectChanges = getBuilderProjectSyncEventChanges(
    threadChanges.project ?? project,
    projectEvent,
  )

  assert.equal(projectChanges.project?.title, 'Updated project')
  assert.equal(projectChanges.project?.lastEventSequence, 6)
  const projectChange = projectChanges.changes[0]
  assert.equal(
    projectChange?.type === 'update' && projectChange.value.kind === 'project'
      ? projectChange.value.value.lastEventSequence
      : undefined,
    6,
  )
})

test('Builder project browser sessions remain stable in session storage', () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }

  assert.equal(
    getBuilderProjectBrowserSessionId({
      storage,
      createId: () => sessionId,
    }),
    sessionId,
  )
  assert.equal(
    getBuilderProjectBrowserSessionId({
      storage,
      createId: () => crypto.randomUUID(),
    }),
    sessionId,
  )
})

test('durable project revisions enter the outbox before upload', async () => {
  await withFakeIndexedDb(async (indexedDb) => {
    const nextRevisionId = uuid(50)
    const nextProject = createSharedExampleProject({
      title: 'Durable title',
      description: 'Saved through the project stream.',
      initialFile: '/index.tsx',
      workspace: createExampleWorkspace({
        entry: '/index.tsx',
        files: { '/index.tsx': 'export default 42' },
      }),
    })
    const command: BuilderProjectSyncCommand = {
      type: 'project.revise',
      clientMutationId: uuid(51),
      revisionId: nextRevisionId,
      expectedRevisionNumber: 1,
      project: nextProject,
    }
    const authoritativeProject: BuilderProjectSyncProject = {
      ...project,
      title: nextProject.title,
      description: nextProject.description,
      snapshotHash: 'b'.repeat(64),
      currentRevisionId: nextRevisionId,
      currentRevisionNumber: 2,
      lastEventSequence: 5,
      updatedAt: '2026-08-20T12:01:00.000Z',
    }
    const event = createEvent({
      sequence: 5,
      type: 'project.updated',
      clientMutationId: command.clientMutationId,
      payload: { project: authoritativeProject },
    })
    const listeners = new Map<string, (event: MessageEvent<string>) => void>()
    let durableBeforeSend = false

    const client = await createBuilderProjectSyncClient({
      projectId,
      sessionStorage: memoryStorage(),
      createBrowserSessionId: () => sessionId,
      fetch: async (_input, init) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return jsonSnapshotPage(snapshot)
        }
        const sent = parsePostedCommand(init)
        durableBeforeSend = (
          await listBuilderProjectSyncOutbox(projectId)
        ).some((entry) => entry.clientMutationId === sent.clientMutationId)
        queueMicrotask(() => {
          listeners.get('project-event')?.(
            new MessageEvent('project-event', {
              data: JSON.stringify(event),
            }),
          )
        })
        return jsonResponse({
          cursor: 5,
          results: [
            {
              clientMutationId: sent.clientMutationId,
              sequence: 5,
              events: [event],
            },
          ],
        })
      },
      createEventSource: () => ({
        readyState: 1,
        addEventListener: (type, listener) => listeners.set(type, listener),
        removeEventListener: (type) => listeners.delete(type),
        close: () => undefined,
      }),
    })

    const pending = client.executeCommand(command)
    const optimisticProject = client.collection.get(
      builderProjectSyncRowKey('project', projectId),
    )
    assert.equal(
      optimisticProject?.kind === 'project'
        ? optimisticProject.value.title
        : undefined,
      nextProject.title,
    )
    await pending

    assert.equal(durableBeforeSend, true)
    assert.equal(indexedDb.values.size, 0)
    const syncedProject = client.collection.get(
      builderProjectSyncRowKey('project', projectId),
    )
    assert.equal(
      syncedProject?.kind === 'project'
        ? syncedProject.value.currentRevisionId
        : undefined,
      nextRevisionId,
    )
    await client.cleanup()
  })
})

test('a thread and its first run enter the ordered outbox before either is sent', async () => {
  await withFakeIndexedDb(async () => {
    const threadCommand: Extract<
      BuilderProjectSyncCommand,
      { type: 'thread.create' }
    > = {
      type: 'thread.create',
      clientMutationId: uuid(52),
      thread: { id: threadId, title: 'New conversation' },
    }
    const runCommand = createRunEnqueueCommand(53)
    const posted: Array<BuilderProjectSyncCommand['type']> = []
    let durableBeforeFirstSend: Array<BuilderProjectSyncCommand['type']> = []

    const client = await createBuilderProjectSyncClient({
      projectId,
      sessionStorage: memoryStorage(),
      createBrowserSessionId: () => sessionId,
      fetch: async (_input, init) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return jsonSnapshotPage(snapshot)
        }
        const command = parsePostedCommand(init)
        if (posted.length === 0) {
          durableBeforeFirstSend = (
            await listBuilderProjectSyncOutbox(projectId)
          ).map((entry) => entry.command.type)
        }
        posted.push(command.type)
        return jsonResponse({
          cursor: snapshot.cursor,
          results: [
            {
              clientMutationId: command.clientMutationId,
              sequence: snapshot.cursor,
              events: [],
            },
          ],
        })
      },
      createEventSource: () => ({
        readyState: 1,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        close: () => undefined,
      }),
    })

    const result = await client.executeRunEnqueue({
      thread: threadCommand,
      run: runCommand,
    })
    assert.equal(result.clientMutationId, runCommand.clientMutationId)
    assert.deepEqual(durableBeforeFirstSend, ['thread.create', 'run.enqueue'])
    assert.deepEqual(posted, ['thread.create', 'run.enqueue'])
    assert.deepEqual(await listBuilderProjectSyncOutbox(projectId), [])

    await client.cleanup()
  })
})

test('offline enqueue remains accepted and replays the same run once after reconnect', async () => {
  await withFakeIndexedDb(async () => {
    const threadCommand: Extract<
      BuilderProjectSyncCommand,
      { type: 'thread.create' }
    > = {
      type: 'thread.create',
      clientMutationId: uuid(54),
      thread: { id: threadId, title: 'New conversation' },
    }
    const runCommand = createRunEnqueueCommand(55)
    const firstClient = await createBuilderProjectSyncClient({
      projectId,
      sessionStorage: memoryStorage(),
      createBrowserSessionId: () => sessionId,
      fetch: async (_input, init) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return jsonSnapshotPage(snapshot)
        }
        throw new Error('Connection lost before the first command was sent')
      },
      createEventSource: () => ({
        readyState: 1,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        close: () => undefined,
      }),
    })

    const accepted = await firstClient.executeRunEnqueue({
      thread: threadCommand,
      run: runCommand,
    })
    assert.equal(accepted.clientMutationId, runCommand.clientMutationId)
    assert.deepEqual(
      (await listBuilderProjectSyncOutbox(projectId)).map(
        (entry) => entry.command.type,
      ),
      ['thread.create', 'run.enqueue'],
    )
    await firstClient.cleanup()

    const postedAfterReload: Array<BuilderProjectSyncCommand> = []
    const reloadedClient = await createBuilderProjectSyncClient({
      projectId,
      sessionStorage: memoryStorage(),
      createBrowserSessionId: () => sessionId,
      fetch: async (_input, init) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return jsonSnapshotPage(snapshot)
        }
        const command = parsePostedCommand(init)
        postedAfterReload.push(command)
        return jsonResponse({
          cursor: snapshot.cursor,
          results: [
            {
              clientMutationId: command.clientMutationId,
              sequence: snapshot.cursor,
              events: [],
            },
          ],
        })
      },
      createEventSource: () => ({
        readyState: 1,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        close: () => undefined,
      }),
    })

    await reloadedClient.flushOutbox()
    assert.deepEqual(postedAfterReload, [threadCommand, runCommand])
    assert.deepEqual(await listBuilderProjectSyncOutbox(projectId), [])

    await reloadedClient.cleanup()
  })
})

test('retryable enqueue failures replay with backoff without reconnecting', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })

  await withFakeIndexedDb(async (indexedDb) => {
    const runCommand = createRunEnqueueCommand(56)
    let postAttemptCount = 0
    let notifySecondAttempt: (() => void) | undefined
    let notifyThirdAttempt: (() => void) | undefined
    let notifyBackgroundFailure: (() => void) | undefined
    const secondAttempt = new Promise<void>((resolve) => {
      notifySecondAttempt = resolve
    })
    const thirdAttempt = new Promise<void>((resolve) => {
      notifyThirdAttempt = resolve
    })
    const backgroundFailure = new Promise<void>((resolve) => {
      notifyBackgroundFailure = resolve
    })

    const client = await createBuilderProjectSyncClient({
      projectId,
      sessionStorage: memoryStorage(),
      createBrowserSessionId: () => sessionId,
      fetch: async (_input, init) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return jsonSnapshotPage({
            ...snapshot,
            threads: [createThread('Durable thread')],
          })
        }

        postAttemptCount += 1
        if (postAttemptCount === 1) {
          return new Response(JSON.stringify({ error: 'Try again later' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        if (postAttemptCount === 2) {
          notifySecondAttempt?.()
          throw new DOMException('The operation timed out', 'TimeoutError')
        }

        notifyThirdAttempt?.()
        const command = parsePostedCommand(init)
        return jsonResponse({
          cursor: snapshot.cursor,
          results: [
            {
              clientMutationId: command.clientMutationId,
              sequence: snapshot.cursor,
              events: [],
            },
          ],
        })
      },
      createEventSource: () => ({
        readyState: 1,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        close: () => undefined,
      }),
      onBackgroundError: () => notifyBackgroundFailure?.(),
    })

    const accepted = await client.executeRunEnqueue({ run: runCommand })
    assert.equal(accepted.clientMutationId, runCommand.clientMutationId)
    assert.equal(postAttemptCount, 1)
    assert.equal(indexedDb.values.size, 1)

    context.mock.timers.tick(499)
    await Promise.resolve()
    assert.equal(postAttemptCount, 1)

    context.mock.timers.tick(1)
    await secondAttempt
    await backgroundFailure
    assert.equal(postAttemptCount, 2)

    context.mock.timers.tick(999)
    await Promise.resolve()
    assert.equal(postAttemptCount, 2)

    context.mock.timers.tick(1)
    await thirdAttempt
    for (let index = 0; index < 50 && indexedDb.values.size > 0; index++) {
      await Promise.resolve()
    }
    assert.equal(postAttemptCount, 3)
    assert.equal(indexedDb.values.size, 0)

    await client.cleanup()
  })
})

test('Builder bootstrap assembles bounded pages before replaying concurrent events', async () => {
  await withFakeIndexedDb(async () => {
    const secondThreadId = uuid(200)
    const firstThread = createThread('First page thread')
    const secondThread: BuilderProjectSyncThread = {
      ...createThread('Second page thread'),
      id: secondThreadId,
    }
    const replayedThread: BuilderProjectSyncThread = {
      ...secondThread,
      title: 'Concurrent event thread',
    }
    const event = createEvent({
      sequence: 5,
      type: 'thread.updated',
      threadId: secondThreadId,
      payload: { thread: replayedThread },
    })
    const listeners = new Map<string, (event: MessageEvent<string>) => void>()
    const requestedUrls: Array<string> = []
    let openedStreamUrl = ''
    let deliverEvent: (() => void) | undefined
    let notifyStreamOpened: (() => void) | undefined
    const streamOpened = new Promise<void>((resolve) => {
      notifyStreamOpened = resolve
    })

    const pendingClient = createBuilderProjectSyncClient({
      projectId,
      sessionStorage: memoryStorage(),
      createBrowserSessionId: () => sessionId,
      fetch: async (input, init) => {
        assert.equal(init?.method ?? 'GET', 'GET')
        const url = String(input)
        requestedUrls.push(url)
        if (!url.includes('continuation=')) {
          return jsonResponse({
            ...snapshot,
            threads: [firstThread],
            headCursor: snapshot.cursor,
            continuation: 'next-page',
          })
        }
        return jsonResponse({
          project: null,
          cursor: snapshot.cursor,
          headCursor: 5,
          threads: [secondThread],
          messages: [],
          runs: [],
          continuation: null,
        })
      },
      createEventSource: (url) => {
        openedStreamUrl = url
        deliverEvent = () => {
          listeners.get('project-event')?.call(
            undefined,
            new MessageEvent('project-event', {
              data: JSON.stringify(event),
            }),
          )
        }
        notifyStreamOpened?.()
        return {
          readyState: 1,
          addEventListener: (type, listener) => {
            listeners.set(type, listener)
          },
          removeEventListener: (type) => {
            listeners.delete(type)
          },
          close: () => undefined,
        }
      },
    })

    let clientSettled = false
    void pendingClient.then(() => {
      clientSettled = true
    })
    await settlesWithin(streamOpened)
    await Promise.resolve()
    assert.equal(clientSettled, false)
    deliverEvent?.()
    const client = await settlesWithin(pendingClient)
    assert.equal(client.collection.utils.lastSequence, 5)
    assert.deepEqual(requestedUrls, [
      `/api/builder/projects/${projectId}/sync`,
      `/api/builder/projects/${projectId}/sync?continuation=next-page`,
    ])
    assert.match(openedStreamUrl, /stream=1&after=4$/)
    assert.equal(
      getThreadTitle(
        client.collection.get(
          builderProjectSyncRowKey('thread', firstThread.id),
        ),
      ),
      'First page thread',
    )
    assert.equal(
      getThreadTitle(
        client.collection.get(
          builderProjectSyncRowKey('thread', secondThreadId),
        ),
      ),
      'Concurrent event thread',
    )

    await client.cleanup()
  })
})

test('a terminal Builder EventSource recovers from an authoritative snapshot', async () => {
  await withFakeIndexedDb(async () => {
    const staleThread = createThread('Stale thread')
    let snapshotRequestCount = 0
    let streamOpenCount = 0
    let markReopened: (() => void) | undefined
    const reopened = new Promise<void>((resolve) => {
      markReopened = resolve
    })

    const client = await createBuilderProjectSyncClient({
      projectId,
      sessionStorage: memoryStorage(),
      createBrowserSessionId: () => sessionId,
      fetch: async (_input, init) => {
        assert.equal(init?.method ?? 'GET', 'GET')
        snapshotRequestCount += 1
        return jsonSnapshotPage({
          ...snapshot,
          threads: snapshotRequestCount === 1 ? [staleThread] : [],
        })
      },
      createEventSource: () => {
        streamOpenCount += 1
        const listeners = new Map<
          string,
          (event: MessageEvent<string>) => void
        >()
        if (streamOpenCount === 1) {
          queueMicrotask(() => {
            listeners
              .get('error')
              ?.call(undefined, new MessageEvent('error', { data: '' }))
          })
        } else {
          markReopened?.()
        }
        return {
          readyState: streamOpenCount === 1 ? 2 : 1,
          addEventListener: (type, listener) => {
            listeners.set(type, listener)
          },
          removeEventListener: (type) => {
            listeners.delete(type)
          },
          close: () => undefined,
        }
      },
    })

    await settlesWithin(reopened)
    assert.equal(snapshotRequestCount, 2)
    assert.equal(streamOpenCount, 2)
    assert.equal(client.collection.utils.lastSequence, snapshot.cursor)
    assert.equal(
      client.collection.get(builderProjectSyncRowKey('thread', staleThread.id)),
      undefined,
    )

    await client.cleanup()
  })
})

test('Builder stream recovery backs off repeated snapshot failures', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })

  await withFakeIndexedDb(async () => {
    let snapshotRequestCount = 0
    let notifySecondRequest: (() => void) | undefined
    let notifyThirdRequest: (() => void) | undefined
    let notifyFourthRequest: (() => void) | undefined
    let backgroundErrorCount = 0
    let notifyFirstSnapshotFailure: (() => void) | undefined
    let notifySecondSnapshotFailure: (() => void) | undefined
    let notifyThirdSnapshotFailure: (() => void) | undefined
    const secondRequest = new Promise<void>((resolve) => {
      notifySecondRequest = resolve
    })
    const thirdRequest = new Promise<void>((resolve) => {
      notifyThirdRequest = resolve
    })
    const fourthRequest = new Promise<void>((resolve) => {
      notifyFourthRequest = resolve
    })
    const firstSnapshotFailure = new Promise<void>((resolve) => {
      notifyFirstSnapshotFailure = resolve
    })
    const secondSnapshotFailure = new Promise<void>((resolve) => {
      notifySecondSnapshotFailure = resolve
    })
    const thirdSnapshotFailure = new Promise<void>((resolve) => {
      notifyThirdSnapshotFailure = resolve
    })

    const client = await createBuilderProjectSyncClient({
      projectId,
      sessionStorage: memoryStorage(),
      createBrowserSessionId: () => sessionId,
      fetch: async (_input, init) => {
        assert.equal(init?.method ?? 'GET', 'GET')
        snapshotRequestCount += 1
        if (snapshotRequestCount === 1) return jsonSnapshotPage(snapshot)

        if (snapshotRequestCount === 2) notifySecondRequest?.()
        if (snapshotRequestCount === 3) notifyThirdRequest?.()
        if (snapshotRequestCount === 4) notifyFourthRequest?.()
        return new Response(JSON.stringify({ error: 'Try again later' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      },
      createEventSource: () => {
        const listeners = new Map<
          string,
          (event: MessageEvent<string>) => void
        >()
        queueMicrotask(() => {
          listeners
            .get('error')
            ?.call(undefined, new MessageEvent('error', { data: '' }))
        })
        return {
          readyState: 2,
          addEventListener: (type, listener) => {
            listeners.set(type, listener)
          },
          removeEventListener: (type) => {
            listeners.delete(type)
          },
          close: () => undefined,
        }
      },
      onBackgroundError: () => {
        backgroundErrorCount += 1
        if (backgroundErrorCount === 2) notifyFirstSnapshotFailure?.()
        if (backgroundErrorCount === 3) notifySecondSnapshotFailure?.()
        if (backgroundErrorCount === 4) notifyThirdSnapshotFailure?.()
      },
    })

    await secondRequest
    await firstSnapshotFailure
    assert.equal(snapshotRequestCount, 2)

    context.mock.timers.tick(499)
    await Promise.resolve()
    assert.equal(snapshotRequestCount, 2)

    context.mock.timers.tick(1)
    await thirdRequest
    await secondSnapshotFailure
    assert.equal(snapshotRequestCount, 3)

    context.mock.timers.tick(999)
    await Promise.resolve()
    assert.equal(snapshotRequestCount, 3)

    context.mock.timers.tick(1)
    await fourthRequest
    await thirdSnapshotFailure
    assert.equal(snapshotRequestCount, 4)

    await client.cleanup()
  })
})

test('Builder project sync commands are optimistic, durable, and confirmed by replay', async () => {
  await withFakeIndexedDb(async (indexedDb) => {
    const eventListeners = new Map<
      string,
      (event: MessageEvent<string>) => void
    >()
    let closeCount = 0
    const authoritativeThread = createThread('Authoritative thread')
    const event = createEvent({
      sequence: 5,
      type: 'thread.created',
      threadId,
      clientMutationId: mutationId,
      browserSessionId: sessionId,
      payload: { thread: authoritativeThread },
    })
    const command: BuilderProjectSyncCommand = {
      type: 'thread.create',
      clientMutationId: mutationId,
      thread: {
        id: threadId,
        title: 'Optimistic thread',
        createdAt: timestamp,
      },
    }
    const requests: Array<{ method: string; body: unknown }> = []

    const client = await createBuilderProjectSyncClient({
      projectId,
      sessionStorage: memoryStorage(),
      createBrowserSessionId: () => sessionId,
      fetch: async (_input, init) => {
        const method = init?.method ?? 'GET'
        if (method === 'GET') return jsonSnapshotPage(snapshot)

        const body =
          typeof init?.body === 'string' ? JSON.parse(init.body) : null
        const request = builderProjectSyncRequestSchema.parse(body)
        const [sentCommand] = request.commands
        if (!sentCommand) throw new Error('Expected a sync command')
        requests.push({ method, body })
        if (sentCommand.type === 'thread.create') {
          queueMicrotask(() => {
            eventListeners.get('project-event')?.call(
              undefined,
              new MessageEvent('project-event', {
                data: JSON.stringify(event),
              }),
            )
          })
        }
        return jsonResponse({
          cursor: 5,
          results: [
            {
              clientMutationId: sentCommand.clientMutationId,
              sequence: 5,
              events: sentCommand.type === 'thread.create' ? [event] : [],
              ...(sentCommand.type === 'run.heartbeat'
                ? { leaseFencingToken: sentCommand.leaseFencingToken }
                : {}),
            },
          ],
        })
      },
      createEventSource: () => ({
        readyState: 1,
        addEventListener: (type, listener) => {
          eventListeners.set(type, listener)
        },
        removeEventListener: (type) => {
          eventListeners.delete(type)
        },
        close: () => {
          closeCount += 1
        },
      }),
    })

    const pending = client.executeCommand(command)

    assert.equal(
      getThreadTitle(
        client.collection.get(builderProjectSyncRowKey('thread', threadId)),
      ),
      'Optimistic thread',
    )

    const acknowledgement = await pending
    assert.equal(acknowledgement.sequence, 5)
    assert.equal(requests.length, 1)
    assert.deepEqual(requests[0]?.body, { commands: [command] })
    assert.equal(
      getThreadTitle(
        client.collection.get(builderProjectSyncRowKey('thread', threadId)),
      ),
      'Authoritative thread',
    )
    const projectRow = client.collection.get(
      builderProjectSyncRowKey('project', projectId),
    )
    assert.equal(
      projectRow?.kind === 'project'
        ? projectRow.value.lastEventSequence
        : undefined,
      5,
    )
    assert.equal(indexedDb.values.size, 0)
    const durablePutCount = indexedDb.putCount

    await client.executeCommand({
      type: 'run.heartbeat',
      clientMutationId: heartbeatMutationId,
      runId,
      leaseOwnerId: sessionId,
      leaseFencingToken: 1,
    })
    assert.equal(requests.length, 2)
    assert.equal(indexedDb.putCount, durablePutCount)

    await client.cleanup()
    assert.ok(closeCount > 0)
  })
})

test('Builder project sync rejects stale finishes without retaining a blocking outbox entry', async () => {
  await withFakeIndexedDb(async (indexedDb) => {
    const requests: Array<BuilderProjectSyncCommand['type']> = []
    const client = await createBuilderProjectSyncClient({
      projectId,
      sessionStorage: memoryStorage(),
      createBrowserSessionId: () => sessionId,
      fetch: async (_input, init) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return jsonSnapshotPage(createRunningSnapshot())
        }
        const command = parsePostedCommand(init)
        requests.push(command.type)
        if (command.type === 'run.finish') {
          return jsonResponse({
            cursor: 4,
            results: [
              {
                clientMutationId: command.clientMutationId,
                rejected: true,
                code: 'run-lease-invalid',
                message: 'Builder project run lease is no longer valid',
              },
            ],
          })
        }
        return jsonResponse({
          cursor: 4,
          results: [
            {
              clientMutationId: command.clientMutationId,
              sequence: 4,
              events: [],
              ...(command.type === 'run.heartbeat'
                ? { leaseFencingToken: command.leaseFencingToken }
                : {}),
            },
          ],
        })
      },
      createEventSource: () => ({
        readyState: 1,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        close: () => undefined,
      }),
    })

    const finishCommand = createFinishCommand(1)
    await assert.rejects(
      client.executeCommand(finishCommand),
      (error: unknown) => {
        if (!(error instanceof BuilderProjectSyncCommandRejectedError)) {
          return false
        }
        assert.equal(
          error.rejection.clientMutationId,
          finishCommand.clientMutationId,
        )
        return true
      },
    )
    assert.equal(getRunStatus(client, runId), 'running')
    assert.equal(indexedDb.values.size, 0)

    await client.executeCommand({
      type: 'run.heartbeat',
      clientMutationId: heartbeatMutationId,
      runId,
      leaseOwnerId: sessionId,
      leaseFencingToken: 1,
    })
    assert.deepEqual(requests, ['run.finish', 'run.heartbeat'])

    await client.cleanup()
  })
})

test('revision conflicts wait for the durable fallback before they surface', async () => {
  await withFakeIndexedDb(async () => {
    const listeners = new Map<string, (event: MessageEvent<string>) => void>()
    const runningSnapshot = createRunningSnapshot()
    const runningRun = runningSnapshot.runs[0]
    if (!runningRun) throw new Error('Expected a running Builder run')
    const failedRun: BuilderProjectSyncRun = {
      ...runningRun,
      status: 'failed',
      leaseOwnerId: null,
      leaseExpiresAt: null,
      error: { message: 'The project changed before the edit was saved.' },
      completedAt: timestamp,
      updatedAt: timestamp,
    }
    const fallbackEvent = createEvent({
      sequence: 5,
      type: 'run.failed',
      payload: { run: failedRun },
      threadId,
      runId,
    })

    const client = await createBuilderProjectSyncClient({
      projectId,
      sessionStorage: memoryStorage(),
      createBrowserSessionId: () => sessionId,
      fetch: async (_input, init) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return jsonSnapshotPage(runningSnapshot)
        }
        const command = parsePostedCommand(init)
        return jsonResponse({
          cursor: 5,
          results: [
            {
              clientMutationId: command.clientMutationId,
              rejected: true,
              code: 'project-revision-conflict',
              message: 'Builder project revision changed',
              sequence: 5,
            },
          ],
        })
      },
      createEventSource: () => ({
        readyState: 1,
        addEventListener: (type, listener) => listeners.set(type, listener),
        removeEventListener: (type) => listeners.delete(type),
        close: () => undefined,
      }),
    })

    let settled = false
    const finish = client
      .executeCommand(createFinishCommand(91))
      .finally(() => {
        settled = true
      })
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(settled, false)

    listeners.get('project-event')?.(
      new MessageEvent('project-event', {
        data: JSON.stringify(fallbackEvent),
      }),
    )
    await assert.rejects(finish, BuilderProjectSyncCommandRejectedError)
    assert.equal(getRunStatus(client, runId), 'failed')

    await client.cleanup()
  })
})

test('Builder heartbeats and run claims bypass the durable outbox', async () => {
  const timeoutDescriptor = Object.getOwnPropertyDescriptor(
    AbortSignal,
    'timeout',
  )
  const requestTimeouts: Array<number> = []
  Object.defineProperty(AbortSignal, 'timeout', {
    configurable: true,
    value: (milliseconds: number) => {
      requestTimeouts.push(milliseconds)
      return new AbortController().signal
    },
  })

  try {
    await withFakeIndexedDb(async () => {
      let resolveFinishResponse: ((response: Response) => void) | undefined
      const finishResponse = new Promise<Response>((resolve) => {
        resolveFinishResponse = resolve
      })
      let notifyFinishStarted: (() => void) | undefined
      const finishStarted = new Promise<void>((resolve) => {
        notifyFinishStarted = resolve
      })
      const posted: Array<BuilderProjectSyncCommand['type']> = []
      const requestSignals: Array<AbortSignal | null | undefined> = []

      const client = await createBuilderProjectSyncClient({
        projectId,
        sessionStorage: memoryStorage(),
        createBrowserSessionId: () => sessionId,
        fetch: async (_input, init) => {
          if ((init?.method ?? 'GET') === 'GET') {
            return jsonSnapshotPage(createRunningSnapshot())
          }
          const command = parsePostedCommand(init)
          posted.push(command.type)
          requestSignals.push(init?.signal)
          if (command.type === 'run.finish') {
            notifyFinishStarted?.()
            return finishResponse
          }
          return jsonResponse({
            cursor: 4,
            results: [
              {
                clientMutationId: command.clientMutationId,
                sequence: 4,
                events: [],
                ...(command.type === 'run.claim'
                  ? { leaseFencingToken: 2 }
                  : command.type === 'run.heartbeat'
                    ? { leaseFencingToken: command.leaseFencingToken }
                    : {}),
              },
            ],
          })
        },
        createEventSource: () => ({
          readyState: 1,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          close: () => undefined,
        }),
      })

      const finishCommand = createFinishCommand(2)
      const pendingFinish = client.executeCommand(finishCommand)
      await settlesWithin(finishStarted)

      const heartbeat = await settlesWithin(
        client.executeCommand({
          type: 'run.heartbeat',
          clientMutationId: uuid(3),
          runId,
          leaseOwnerId: sessionId,
          leaseFencingToken: 1,
        }),
      )
      assert.equal(heartbeat.leaseFencingToken, 1)
      assert.deepEqual(posted, ['run.finish', 'run.heartbeat'])

      resolveFinishResponse?.(
        jsonResponse({
          cursor: 4,
          results: [
            {
              clientMutationId: finishCommand.clientMutationId,
              sequence: 4,
              events: [],
              leaseFencingToken: 1,
            },
          ],
        }),
      )
      await pendingFinish

      const claimResult = await settlesWithin(
        client.executeCommand({
          type: 'run.claim',
          clientMutationId: uuid(4),
          runId,
          leaseOwnerId: sessionId,
        }),
      )
      assert.equal(claimResult.leaseFencingToken, 2)
      assert.deepEqual(posted, ['run.finish', 'run.heartbeat', 'run.claim'])
      assert.deepEqual(requestTimeouts, [20_000, 8_000, 20_000])
      assert.equal(
        requestSignals.every((signal) => signal instanceof AbortSignal),
        true,
      )

      await client.cleanup()
    })
  } finally {
    if (timeoutDescriptor) {
      Object.defineProperty(AbortSignal, 'timeout', timeoutDescriptor)
    }
  }
})

test('a duplicated tab rotates its claimed session before any recovery', async () => {
  await withFakeIndexedDb(async () => {
    const duplicateSessionId = uuid(8_200)
    const lockManager = memoryLockManager()
    const firstStorage = memoryStorage()
    const duplicateStorage = memoryStorage()
    const eventSource = () => ({
      readyState: 1,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      close: () => undefined,
    })

    const firstClient = await createBuilderProjectSyncClient({
      projectId,
      sessionStorage: firstStorage,
      browserSessionLockManager: lockManager,
      createBrowserSessionId: () => sessionId,
      fetch: async () => jsonSnapshotPage(snapshot),
      createEventSource: eventSource,
    })

    assert.equal(
      getBuilderProjectBrowserSessionId({
        storage: duplicateStorage,
        createId: () => sessionId,
      }),
      sessionId,
    )
    const duplicateClient = await createBuilderProjectSyncClient({
      projectId,
      sessionStorage: duplicateStorage,
      browserSessionLockManager: lockManager,
      createBrowserSessionId: () => duplicateSessionId,
      fetch: async () => jsonSnapshotPage(snapshot),
      createEventSource: eventSource,
    })

    assert.equal(firstClient.browserSessionId, sessionId)
    assert.equal(duplicateClient.browserSessionId, duplicateSessionId)

    await duplicateClient.cleanup()
    await firstClient.cleanup()

    const reclaimedStorage = memoryStorage()
    getBuilderProjectBrowserSessionId({
      storage: reclaimedStorage,
      createId: () => sessionId,
    })
    const reclaimedClient = await createBuilderProjectSyncClient({
      projectId,
      sessionStorage: reclaimedStorage,
      browserSessionLockManager: lockManager,
      createBrowserSessionId: () => uuid(8_400),
      fetch: async () => jsonSnapshotPage(snapshot),
      createEventSource: eventSource,
    })
    assert.equal(reclaimedClient.browserSessionId, sessionId)
    await reclaimedClient.cleanup()
  })
})

function createThread(title: string): BuilderProjectSyncThread {
  return {
    id: threadId,
    projectId,
    ownerId,
    clientMutationId: mutationId,
    title,
    lastMessagePosition: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
  }
}

function getThreadTitle(row: BuilderProjectSyncRow | undefined) {
  return row?.kind === 'thread' ? row.value.title : undefined
}

function getRunStatus(
  client: Awaited<ReturnType<typeof createBuilderProjectSyncClient>>,
  id: string,
) {
  const row = client.collection.get(builderProjectSyncRowKey('run', id))
  return row?.kind === 'run' ? row.value.status : undefined
}

function createRunningSnapshot(): BuilderProjectSyncSnapshot {
  const run: BuilderProjectSyncRun = {
    id: runId,
    projectId,
    ownerId,
    threadId,
    clientMutationId: uuid(100),
    queueKind: 'queue',
    status: 'running',
    provider: 'openai',
    model: 'gpt-5.6-luna',
    baseRevisionId: revisionId,
    resultRevisionId: null,
    leaseOwnerId: sessionId,
    leaseFencingToken: 1,
    leaseExpiresAt: timestamp,
    lastHeartbeatAt: timestamp,
    activity: null,
    error: null,
    startedAt: timestamp,
    completedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  return {
    ...snapshot,
    threads: [createThread('Durable thread')],
    runs: [run],
  }
}

function createFinishCommand(index: number): BuilderProjectSyncCommand {
  return {
    type: 'run.finish',
    clientMutationId: uuid(index),
    runId,
    leaseOwnerId: sessionId,
    leaseFencingToken: 1,
    status: 'cancelled',
  }
}

function createRunEnqueueCommand(
  index: number,
): Extract<BuilderProjectSyncCommand, { type: 'run.enqueue' }> {
  return {
    type: 'run.enqueue',
    clientMutationId: uuid(index),
    run: {
      id: uuid(index + 1_000),
      threadId,
      queueKind: 'queue',
      provider: 'openai',
      model: 'gpt-5.6-luna',
    },
    userMessage: {
      id: uuid(index + 2_000),
      clientMutationId: uuid(index + 3_000),
      content: 'Continue building',
      parts: [{ type: 'text', content: 'Continue building' }],
    },
  }
}

function parsePostedCommand(init: RequestInit | undefined) {
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null
  const request = builderProjectSyncRequestSchema.parse(body)
  const [command] = request.commands
  if (!command) throw new Error('Expected a sync command')
  return command
}

async function settlesWithin<TResult>(promise: Promise<TResult>) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Builder sync operation did not settle')),
          500,
        )
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function uuid(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

function createEvent({
  sequence,
  type,
  payload,
  threadId: eventThreadId = null,
  clientMutationId = null,
  browserSessionId = null,
  runId: eventRunId = null,
}: {
  sequence: number
  type: BuilderProjectSyncEvent['type']
  payload: BuilderProjectSyncEvent['payload']
  threadId?: string | null
  clientMutationId?: string | null
  browserSessionId?: string | null
  runId?: string | null
}): BuilderProjectSyncEvent {
  return {
    version: 1,
    id: eventId,
    projectId,
    ownerId,
    sequence,
    type,
    payload,
    clientEventId: eventId,
    clientMutationId,
    browserSessionId,
    threadId: eventThreadId,
    messageId: null,
    runId: eventRunId,
    revisionId: null,
    occurredAt: timestamp,
    createdAt: timestamp,
  }
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { 'Content-Type': 'application/json' },
  })
}

function jsonSnapshotPage(value: BuilderProjectSyncSnapshot) {
  return jsonResponse({
    ...value,
    headCursor: value.cursor,
    continuation: null,
  })
}

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

function memoryLockManager(): BuilderProjectBrowserSessionLockManager {
  const held = new Set<string>()
  return {
    request: async (name, _options, callback) => {
      if (held.has(name)) {
        await callback(null)
        return
      }

      held.add(name)
      try {
        await callback({})
      } finally {
        held.delete(name)
      }
    },
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

  constructor(
    private readonly values: Map<string, unknown>,
    private readonly onPut: () => void,
  ) {}

  objectStore() {
    return new FakeObjectStore(this.values, this, this.onPut)
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
    private readonly onPut: () => void,
  ) {}

  getAll() {
    return this.transaction.request(() => [...this.values.values()])
  }

  getAllKeys() {
    return this.transaction.request(() => [...this.values.keys()])
  }

  put(value: unknown, key: IDBValidKey) {
    return this.transaction.request(() => {
      this.onPut()
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

  constructor(
    private readonly values: Map<string, unknown>,
    private readonly onPut: () => void,
  ) {}

  close() {}

  createObjectStore() {}

  transaction() {
    return new FakeTransaction(this.values, this.onPut)
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
  putCount = 0

  open() {
    const request = new FakeOpenRequest(
      new FakeDatabase(this.values, () => {
        this.putCount += 1
      }),
    )
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
    restoreSyncClientGlobals()
    if (descriptor) Object.defineProperty(globalThis, 'indexedDB', descriptor)
    else Reflect.deleteProperty(globalThis, 'indexedDB')
  }
}

const syncClientGlobalRestores: Array<() => void> = []

function restoreSyncClientGlobals() {
  while (syncClientGlobalRestores.length > 0) {
    syncClientGlobalRestores.pop()?.()
  }
}

function createBuilderProjectSyncClient(options: {
  projectId: string
  fetch: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>
  createEventSource: (url: string) => {
    readonly readyState: number
    addEventListener: (
      type: string,
      listener: (event: MessageEvent<string>) => void,
    ) => void
    removeEventListener: (
      type: string,
      listener?: (event: MessageEvent<string>) => void,
    ) => void
    close: () => void
  }
  sessionStorage?: Pick<Storage, 'getItem' | 'setItem'>
  createBrowserSessionId?: () => string
  browserSessionLockManager?: BuilderProjectBrowserSessionLockManager
  onBackgroundError?: (error: unknown) => void
}) {
  const restore: Array<() => void> = []
  const previousFetch = globalThis.fetch
  globalThis.fetch = options.fetch as typeof fetch
  restore.push(() => {
    globalThis.fetch = previousFetch
  })

  const previousEventSource = globalThis.EventSource
  globalThis.EventSource = class {
    constructor(url: string | URL) {
      return options.createEventSource(String(url)) as EventSource
    }
  } as typeof EventSource
  restore.push(() => {
    globalThis.EventSource = previousEventSource
  })

  const previousSessionStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    'sessionStorage',
  )
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: options.sessionStorage ?? memoryStorage(),
  })
  restore.push(() => {
    if (previousSessionStorage) {
      Object.defineProperty(
        globalThis,
        'sessionStorage',
        previousSessionStorage,
      )
    } else {
      Reflect.deleteProperty(globalThis, 'sessionStorage')
    }
  })

  if (options.createBrowserSessionId) {
    const previousRandomUUID = crypto.randomUUID.bind(crypto)
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: options.createBrowserSessionId,
    })
    restore.push(() => {
      Object.defineProperty(crypto, 'randomUUID', {
        configurable: true,
        value: previousRandomUUID,
      })
    })
  }

  if (options.browserSessionLockManager) {
    const previousNavigator = Object.getOwnPropertyDescriptor(
      globalThis,
      'navigator',
    )
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { locks: options.browserSessionLockManager },
    })
    restore.push(() => {
      if (previousNavigator) {
        Object.defineProperty(globalThis, 'navigator', previousNavigator)
      } else {
        Reflect.deleteProperty(globalThis, 'navigator')
      }
    })
  }

  syncClientGlobalRestores.push(() => {
    for (const fn of restore.reverse()) fn()
  })

  return createBuilderProjectSyncClientImpl({
    projectId: options.projectId,
    ...(options.onBackgroundError
      ? { onBackgroundError: options.onBackgroundError }
      : {}),
  })
}
