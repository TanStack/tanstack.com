import assert from 'node:assert/strict'
import test from 'node:test'
import { DbClient } from '@tanstack/react-db'
import {
  createReplayableCollectionOptions,
  createReplayableEventController,
  createReplayableOptimisticAction,
  openReplayableEventSource,
  ReplayableCollectionStoppedError,
  writeReplayableEvent,
  type ReplayableStreamContext,
} from '../src/utils/replayable-collection.client'

interface Item {
  id: string
  text: string
}

test('replayable collection applies ordered batches and closes its stream', async () => {
  let stream: ReplayableStreamContext<Item, string> | undefined
  let closed = false
  const options = createReplayableCollectionOptions<Item, string>({
    id: 'replayable-items',
    getKey: (item) => item.id,
    openStream: (context) => {
      stream = context
      return () => {
        closed = true
      }
    },
  })
  const client = new DbClient()
  const collection = client.collection(options)
  const ready = collection.preload()

  const activeStream = requireStream(stream)
  activeStream.publish({
    sequence: 1,
    changes: [{ type: 'insert', value: { id: 'one', text: 'first' } }],
  })
  activeStream.publish({
    sequence: 2,
    changes: [{ type: 'update', value: { id: 'one', text: 'second' } }],
  })
  activeStream.publish({
    sequence: 2,
    changes: [{ type: 'update', value: { id: 'one', text: 'duplicate' } }],
  })
  activeStream.markCaughtUp()
  await ready

  assert.equal(collection.get('one')?.id, 'one')
  assert.equal(collection.get('one')?.text, 'second')
  assert.equal(collection.utils.lastSequence, 2)

  activeStream.publish({
    sequence: 3,
    changes: [{ type: 'delete', key: 'one' }],
  })
  assert.equal(collection.has('one'), false)

  const signal = activeStream.signal
  const pendingConfirmation = collection.utils.waitForSequence(4)
  await collection.cleanup()

  assert.equal(signal.aborted, true)
  assert.equal(closed, true)
  await assert.rejects(pendingConfirmation, ReplayableCollectionStoppedError)
})

test('DbClient hydration restores rows and resumes after the dehydrated cursor', async () => {
  const streams: Array<ReplayableStreamContext<Item, string>> = []
  const options = createReplayableCollectionOptions<Item, string>({
    id: 'hydrated-replayable-items',
    getKey: (item) => item.id,
    openStream: (context) => {
      streams.push(context)
    },
  })
  const serverClient = new DbClient()
  const serverCollection = serverClient.collection(options)
  const serverReady = serverCollection.preload()

  streams[0]?.publish({
    sequence: 12,
    changes: [{ type: 'insert', value: { id: 'one', text: 'hydrated' } }],
  })
  streams[0]?.markCaughtUp()
  await serverReady

  const state = serverClient.dehydrate()
  const browserClient = new DbClient()
  browserClient.hydrate(state)
  const browserCollection = browserClient.collection(options)

  assert.equal(browserCollection.get('one')?.id, 'one')
  assert.equal(browserCollection.get('one')?.text, 'hydrated')

  const browserReady = browserCollection.preload()
  assert.equal(streams[1]?.after, 12)
  streams[1]?.markCaughtUp()
  await browserReady

  await Promise.all([serverClient.cleanup(), browserClient.cleanup()])
})

test('optimistic actions remain overlaid until their event is replayed', async () => {
  let stream: ReplayableStreamContext<Item, string> | undefined
  const options = createReplayableCollectionOptions<Item, string>({
    id: 'optimistic-replayable-items',
    getKey: (item) => item.id,
    openStream: (context) => {
      stream = context
    },
  })
  const client = new DbClient()
  const collection = client.collection(options)
  const ready = collection.preload()

  const activeStream = requireStream(stream)
  activeStream.publish({
    sequence: 1,
    changes: [{ type: 'insert', value: { id: 'one', text: 'before' } }],
  })
  activeStream.markCaughtUp()
  await ready

  const rename = createReplayableOptimisticAction({
    client,
    onMutate: (text: string) => {
      collection.update('one', (draft) => {
        draft.text = text
      })
    },
    persist: async () => 2,
    waitForSequence: collection.utils.waitForSequence,
  })
  const transaction = rename('optimistic')
  let completed = false
  void transaction.isPersisted.promise.then(() => {
    completed = true
  })

  assert.equal(collection.get('one')?.text, 'optimistic')
  await Promise.resolve()
  assert.equal(completed, false)

  activeStream.publish({
    sequence: 2,
    changes: [{ type: 'update', value: { id: 'one', text: 'confirmed' } }],
  })
  await transaction.isPersisted.promise

  assert.equal(completed, true)
  assert.equal(collection.get('one')?.text, 'confirmed')
  await client.cleanup()
})

test('query collection stream writes use one direct-write batch', () => {
  const calls: Array<string> = []

  writeReplayableEvent<Item, string>(
    {
      writeBatch: (callback) => {
        calls.push('begin')
        callback()
        calls.push('commit')
      },
      writeInsert: (item) => calls.push(`insert:${item.id}`),
      writeUpdate: (item) => calls.push(`update:${item.id}`),
      writeDelete: (key) => calls.push(`delete:${key}`),
    },
    {
      sequence: 4,
      changes: [
        { type: 'insert', value: { id: 'one', text: 'one' } },
        { type: 'update', value: { id: 'two', text: 'two' } },
        { type: 'delete', key: 'three' },
      ],
    },
  )

  assert.deepEqual(calls, [
    'begin',
    'insert:one',
    'update:two',
    'delete:three',
    'commit',
  ])
})

test('query collection event controller deduplicates and confirms cursors', async () => {
  const controller = createReplayableEventController(7)
  const calls: Array<number> = []
  const confirmation = controller.waitForSequence(9)

  assert.equal(
    controller.apply(7, () => {
      calls.push(7)
    }),
    false,
  )
  assert.equal(
    controller.apply(9, () => {
      calls.push(9)
    }),
    true,
  )
  await confirmation

  assert.deepEqual(calls, [9])
  assert.equal(controller.lastSequence, 9)

  const pending = controller.waitForSequence(10)
  controller.stop()
  await assert.rejects(pending, ReplayableCollectionStoppedError)
})

test('replayable EventSource resumes from a cursor and closes on abort', () => {
  const abortController = new AbortController()
  const listeners = new Map<string, (event: MessageEvent<string>) => void>()
  const received: Array<{ sequence: number }> = []
  let openedUrl = ''
  let closeCount = 0

  openReplayableEventSource({
    url: '/api/builder/projects/project-id/sync?mode=events',
    after: 14,
    signal: abortController.signal,
    eventType: 'project-event',
    parse: (value) => {
      if (
        typeof value !== 'object' ||
        value === null ||
        !('sequence' in value) ||
        typeof value.sequence !== 'number'
      ) {
        throw new Error('Invalid event')
      }
      return { sequence: value.sequence }
    },
    onEvent: (event) => received.push(event),
    onError: (error) => {
      throw error
    },
    createEventSource: (url) => {
      openedUrl = url
      return {
        readyState: 1,
        addEventListener: (type, listener) => {
          listeners.set(type, listener)
        },
        removeEventListener: (type) => {
          listeners.delete(type)
        },
        close: () => {
          closeCount += 1
        },
      }
    },
  })

  assert.equal(
    openedUrl,
    '/api/builder/projects/project-id/sync?mode=events&stream=1&after=14',
  )
  listeners
    .get('project-event')
    ?.call(
      undefined,
      new MessageEvent('project-event', { data: '{"sequence":15}' }),
    )
  assert.deepEqual(received, [{ sequence: 15 }])

  abortController.abort()
  assert.equal(closeCount, 1)
})

test('replayable EventSource recovers only after a terminal native error', () => {
  const listeners = new Map<string, (event: MessageEvent<string>) => void>()
  const errors: Array<unknown> = []
  let readyState = 0
  let closeCount = 0

  const cleanup = openReplayableEventSource({
    url: '/api/builder/projects/project-id/sync',
    after: 0,
    signal: new AbortController().signal,
    eventType: 'project-event',
    parse: (value) => value,
    onEvent: () => undefined,
    onError: (error) => errors.push(error),
    createEventSource: () => ({
      get readyState() {
        return readyState
      },
      addEventListener: (type, listener) => {
        listeners.set(type, listener)
      },
      removeEventListener: (type) => {
        listeners.delete(type)
      },
      close: () => {
        closeCount += 1
      },
    }),
  })

  listeners
    .get('error')
    ?.call(undefined, new MessageEvent('error', { data: '' }))
  assert.deepEqual(errors, [])
  assert.equal(closeCount, 0)

  readyState = 2
  listeners
    .get('error')
    ?.call(undefined, new MessageEvent('error', { data: '' }))
  assert.equal(errors.length, 1)
  assert.match(String(errors[0]), /event stream closed/)
  assert.equal(closeCount, 1)

  cleanup()
  assert.equal(listeners.size, 0)
  assert.equal(closeCount, 1)
})

function requireStream<T>(stream: T | undefined): T {
  if (!stream) throw new Error('Stream did not open')
  return stream
}
