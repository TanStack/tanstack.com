import { collectionOptions, type DbClient } from '@tanstack/react-db'

const eventSourceClosedReadyState = 2

export type ReplayableRowChange<
  TItem extends object,
  TKey extends string | number,
> =
  | { type: 'insert'; value: TItem }
  | { type: 'update'; value: TItem }
  | { type: 'delete'; key: TKey }

export interface ReplayableEvent<
  TItem extends object,
  TKey extends string | number,
> {
  sequence: number
  changes: ReadonlyArray<ReplayableRowChange<TItem, TKey>>
}

export interface ReplayableStreamContext<
  TItem extends object,
  TKey extends string | number,
> {
  after: number
  signal: AbortSignal
  publish: (event: ReplayableEvent<TItem, TKey>) => void
  replace: (snapshot: ReplayableEvent<TItem, TKey>) => void
  markCaughtUp: () => void
}

export interface ReplayableCollectionUtils {
  readonly lastSequence: number
  waitForSequence: (sequence: number) => Promise<void>
}

export interface ReplayableCollectionOptions<
  TItem extends object,
  TKey extends string | number,
> {
  id: string
  getKey: (item: TItem) => TKey
  openStream: (
    context: ReplayableStreamContext<TItem, TKey>,
  ) => void | (() => void)
  gcTime?: number
}

export class ReplayableCollectionStoppedError extends Error {
  constructor() {
    super('The replayable collection stopped before the event was confirmed.')
    this.name = 'ReplayableCollectionStoppedError'
  }
}

export interface ReplayableEventController {
  readonly lastSequence: number
  apply: (sequence: number, applyEvent: () => void) => boolean
  waitForSequence: (sequence: number) => Promise<void>
  stop: () => void
}

export function createReplayableEventController(
  initialSequence = 0,
): ReplayableEventController {
  let lastSequence = initialSequence
  let stopped = false
  const waiters = new Set<{
    sequence: number
    resolve: () => void
    reject: (error: Error) => void
  }>()

  const settleWaiters = () => {
    for (const waiter of waiters) {
      if (waiter.sequence <= lastSequence) {
        waiters.delete(waiter)
        waiter.resolve()
      }
    }
  }

  return {
    get lastSequence() {
      return lastSequence
    },
    apply(sequence, applyEvent) {
      if (stopped) throw new ReplayableCollectionStoppedError()
      if (sequence <= lastSequence) return false

      applyEvent()
      lastSequence = sequence
      settleWaiters()
      return true
    },
    waitForSequence(sequence) {
      if (sequence <= lastSequence) return Promise.resolve()
      if (stopped) {
        return Promise.reject(new ReplayableCollectionStoppedError())
      }

      return new Promise<void>((resolve, reject) => {
        waiters.add({ sequence, resolve, reject })
      })
    },
    stop() {
      if (stopped) return
      stopped = true

      const error = new ReplayableCollectionStoppedError()
      for (const waiter of waiters) waiter.reject(error)
      waiters.clear()
    },
  }
}

export function createReplayableCollectionOptions<
  TItem extends object,
  TKey extends string | number,
>(options: ReplayableCollectionOptions<TItem, TKey>) {
  return collectionOptions(options.id, () => {
    let lastSequence = 0
    let activeController: AbortController | undefined
    const waiters = new Set<{
      sequence: number
      resolve: () => void
      reject: (error: Error) => void
    }>()

    const settleWaiters = () => {
      for (const waiter of waiters) {
        if (waiter.sequence <= lastSequence) {
          waiters.delete(waiter)
          waiter.resolve()
        }
      }
    }

    const utils: ReplayableCollectionUtils = {
      get lastSequence() {
        return lastSequence
      },
      waitForSequence(sequence) {
        if (sequence <= lastSequence) return Promise.resolve()

        return new Promise<void>((resolve, reject) => {
          waiters.add({ sequence, resolve, reject })
        })
      },
    }

    return {
      id: options.id,
      getKey: options.getKey,
      gcTime: options.gcTime,
      syncMode: 'eager',
      startSync: false,
      utils,
      sync: {
        rowUpdateMode: 'full',
        exportSyncMeta: () => ({ sequence: lastSequence }),
        importSyncMeta: (metadata: unknown) => {
          lastSequence = Math.max(lastSequence, readSequence(metadata))
          settleWaiters()
        },
        mergeSyncMeta: (current: unknown, incoming: unknown) => ({
          sequence: Math.max(readSequence(current), readSequence(incoming)),
        }),
        sync: ({ begin, write, commit, markReady }) => {
          const controller = new AbortController()
          activeController = controller
          let caughtUp = false

          const closeStream = options.openStream({
            after: lastSequence,
            signal: controller.signal,
            publish: (event) => {
              if (controller.signal.aborted || event.sequence <= lastSequence) {
                return
              }

              begin({ immediate: true })
              for (const change of event.changes) {
                if (change.type === 'delete') {
                  write(change)
                } else {
                  write({ type: change.type, value: change.value })
                }
              }
              commit()
              lastSequence = event.sequence
              settleWaiters()
            },
            replace: (snapshot) => {
              if (controller.signal.aborted) return

              begin({ immediate: true })
              for (const change of snapshot.changes) {
                if (change.type === 'delete') {
                  write(change)
                } else {
                  write({ type: change.type, value: change.value })
                }
              }
              commit()
              lastSequence = snapshot.sequence
              settleWaiters()
            },
            markCaughtUp: () => {
              if (caughtUp || controller.signal.aborted) return
              caughtUp = true
              markReady()
            },
          })

          return () => {
            controller.abort()
            closeStream?.()

            if (activeController !== controller) return
            activeController = undefined
            lastSequence = 0

            const error = new ReplayableCollectionStoppedError()
            for (const waiter of waiters) waiter.reject(error)
            waiters.clear()
          }
        },
      },
    }
  })
}

export interface ReplayableDirectWriteUtils<
  TItem extends object,
  TKey extends string | number,
> {
  writeInsert: (item: TItem) => void
  writeUpdate: (item: Partial<TItem>) => void
  writeDelete: (key: TKey) => void
  writeBatch: (callback: () => void) => void
}

interface EventSourceLike {
  readonly readyState: number
  addEventListener: (
    type: string,
    listener: (event: MessageEvent<string>) => void,
  ) => void
  removeEventListener: (
    type: string,
    listener: (event: MessageEvent<string>) => void,
  ) => void
  close: () => void
}

export interface ReplayableEventSourceOptions<TEvent> {
  url: string
  after: number
  signal: AbortSignal
  eventType: string
  parse: (value: unknown) => TEvent
  onEvent: (event: TEvent) => void
  onError: (error: unknown) => void
  createEventSource?: (url: string) => EventSourceLike
}

export function openReplayableEventSource<TEvent>(
  options: ReplayableEventSourceOptions<TEvent>,
) {
  const separator = options.url.includes('?') ? '&' : '?'
  const url = `${options.url}${separator}stream=1&after=${options.after}`
  const source = options.createEventSource
    ? options.createEventSource(url)
    : new EventSource(url)
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    source.close()
  }
  const onMessage = (event: MessageEvent<string>) => {
    try {
      const value: unknown = JSON.parse(event.data)
      options.onEvent(options.parse(value))
    } catch (error) {
      close()
      options.onError(error)
    }
  }
  const onSourceError = () => {
    if (closed || source.readyState !== eventSourceClosedReadyState) return
    close()
    options.onError(new Error('The replayable event stream closed'))
  }

  source.addEventListener(options.eventType, onMessage)
  source.addEventListener('error', onSourceError)
  if (options.signal.aborted) {
    close()
  } else {
    options.signal.addEventListener('abort', close, { once: true })
  }

  return () => {
    options.signal.removeEventListener('abort', close)
    source.removeEventListener(options.eventType, onMessage)
    source.removeEventListener('error', onSourceError)
    close()
  }
}

export function writeReplayableEvent<
  TItem extends object,
  TKey extends string | number,
>(
  utils: ReplayableDirectWriteUtils<TItem, TKey>,
  event: ReplayableEvent<TItem, TKey>,
) {
  utils.writeBatch(() => {
    for (const change of event.changes) {
      if (change.type === 'insert') {
        utils.writeInsert(change.value)
      } else if (change.type === 'update') {
        utils.writeUpdate(change.value)
      } else {
        utils.writeDelete(change.key)
      }
    }
  })
}

export interface ReplayableOptimisticActionOptions<TVariables> {
  client: Pick<DbClient, 'createTransaction'>
  onMutate: (variables: TVariables) => void
  persist: (variables: TVariables) => Promise<number>
  waitForSequence: (sequence: number) => Promise<void>
}

export function createReplayableOptimisticAction<TVariables>(
  options: ReplayableOptimisticActionOptions<TVariables>,
) {
  return (variables: TVariables) => {
    const transaction = options.client.createTransaction({
      mutationFn: async () => {
        const sequence = await options.persist(variables)
        await options.waitForSequence(sequence)
      },
    })

    transaction.mutate(() => {
      options.onMutate(variables)
    })

    return transaction
  }
}

function readSequence(metadata: unknown) {
  if (
    typeof metadata !== 'object' ||
    metadata === null ||
    !('sequence' in metadata) ||
    typeof metadata.sequence !== 'number'
  ) {
    return 0
  }

  return metadata.sequence
}
