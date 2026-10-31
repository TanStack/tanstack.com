import { z } from 'zod'
import {
  builderProjectSyncCommandOutcomeSchema,
  builderProjectSyncCommandResultSchema,
  builderProjectSyncCommandSchema,
  isBuilderProjectSyncCommandRejection,
  type BuilderProjectSyncCommand,
  type BuilderProjectSyncCommandRejection,
  type BuilderProjectSyncCommandResult,
} from './builder-project-sync'

const databaseName = 'tanstack-builder-project-sync'
const databaseVersion = 1
const objectStoreName = 'commands'
const storedEntryVersion = 1
const maxProjectCommandCount = 100
const maxProjectCommandBytes = 50 * 1024 * 1024

const projectIdSchema = z.uuid()
const storedEntrySchema = z
  .object({
    version: z.literal(storedEntryVersion),
    projectId: projectIdSchema,
    clientMutationId: z.uuid(),
    command: builderProjectSyncCommandSchema,
    createdAt: z.number().int().nonnegative().safe(),
    sizeBytes: z.number().int().nonnegative().safe(),
  })
  .strict()

type StoredOutboxEntry = z.infer<typeof storedEntrySchema>

export type BuilderProjectSyncOutboxEntry = Omit<StoredOutboxEntry, 'version'>

export type BuilderProjectSyncOutboxSender = (
  command: BuilderProjectSyncCommand,
  entry: BuilderProjectSyncOutboxEntry,
) => Promise<unknown>

export class BuilderProjectSyncOutboxUnavailableError extends Error {
  override readonly name = 'BuilderProjectSyncOutboxUnavailableError'
}

export class BuilderProjectSyncOutboxCapacityError extends Error {
  override readonly name = 'BuilderProjectSyncOutboxCapacityError'
}

export class BuilderProjectSyncOutboxConflictError extends Error {
  override readonly name = 'BuilderProjectSyncOutboxConflictError'
}

export class BuilderProjectSyncOutboxAcknowledgementError extends Error {
  override readonly name = 'BuilderProjectSyncOutboxAcknowledgementError'
}

export class BuilderProjectSyncOutboxDeferredError extends Error {
  override readonly name = 'BuilderProjectSyncOutboxDeferredError'
}

export class BuilderProjectSyncCommandRejectedError extends Error {
  override readonly name = 'BuilderProjectSyncCommandRejectedError'

  constructor(readonly rejection: BuilderProjectSyncCommandRejection) {
    super(rejection.message)
  }
}

export interface BuilderProjectSyncOutboxReplayResult {
  acknowledgements: ReadonlyArray<BuilderProjectSyncCommandResult>
  rejections: ReadonlyArray<BuilderProjectSyncCommandRejection>
}

export async function enqueueBuilderProjectSyncCommand(
  projectId: string,
  command: BuilderProjectSyncCommand,
) {
  const [entry] = await enqueueBuilderProjectSyncCommands(projectId, [command])
  if (!entry) {
    throw new BuilderProjectSyncOutboxUnavailableError(
      'Builder project sync command was not queued',
    )
  }
  return entry
}

export async function enqueueBuilderProjectSyncCommands(
  projectId: string,
  commands: ReadonlyArray<BuilderProjectSyncCommand>,
) {
  const parsedProjectId = projectIdSchema.parse(projectId)
  const parsedCommands = commands.map((command) =>
    builderProjectSyncCommandSchema.parse(command),
  )
  const mutationIds = new Set(
    parsedCommands.map((command) => command.clientMutationId),
  )
  if (mutationIds.size !== parsedCommands.length) {
    throw new BuilderProjectSyncOutboxConflictError(
      'Builder project sync commands must have distinct mutation IDs',
    )
  }

  return mutateOutbox((entries, store) => {
    const projectEntries = entries.filter(
      (candidate) => candidate.entry.projectId === parsedProjectId,
    )
    const existingByMutationId = new Map(
      projectEntries.map((candidate) => [
        candidate.entry.clientMutationId,
        candidate.entry,
      ]),
    )
    const additions: Array<StoredOutboxEntry> = []
    const queued: Array<BuilderProjectSyncOutboxEntry> = []
    let latestCreatedAt = projectEntries.reduce(
      (latest, candidate) => Math.max(latest, candidate.entry.createdAt),
      -1,
    )

    for (const parsedCommand of parsedCommands) {
      const existing = existingByMutationId.get(parsedCommand.clientMutationId)
      if (existing) {
        if (!commandsMatch(existing.command, parsedCommand)) {
          throw new BuilderProjectSyncOutboxConflictError(
            `Builder project mutation ${parsedCommand.clientMutationId} already has a different command`,
          )
        }
        queued.push(toPublicEntry(existing))
        continue
      }

      latestCreatedAt = Math.max(Date.now(), latestCreatedAt + 1)
      const entry: StoredOutboxEntry = {
        version: storedEntryVersion,
        projectId: parsedProjectId,
        clientMutationId: parsedCommand.clientMutationId,
        command: parsedCommand,
        createdAt: latestCreatedAt,
        sizeBytes: getUtf8ByteLength(parsedCommand),
      }
      additions.push(entry)
      queued.push(toPublicEntry(entry))
    }

    const nextCount = projectEntries.length + additions.length
    const nextBytes =
      projectEntries.reduce(
        (total, candidate) => total + candidate.entry.sizeBytes,
        0,
      ) + additions.reduce((total, entry) => total + entry.sizeBytes, 0)

    if (
      nextCount > maxProjectCommandCount ||
      nextBytes > maxProjectCommandBytes
    ) {
      throw new BuilderProjectSyncOutboxCapacityError(
        'Builder project sync outbox capacity reached',
      )
    }

    for (const entry of additions) {
      store.put(entry, storageKey(entry.projectId, entry.clientMutationId))
    }
    return queued
  })
}

export async function listBuilderProjectSyncOutbox(
  projectId: string,
): Promise<Array<BuilderProjectSyncOutboxEntry>> {
  const parsedProjectId = projectIdSchema.parse(projectId)

  return mutateOutbox((entries) =>
    entries
      .map((candidate) => candidate.entry)
      .filter((entry) => entry.projectId === parsedProjectId)
      .sort(compareEntries)
      .map(toPublicEntry),
  )
}

export async function acknowledgeBuilderProjectSyncCommand(
  projectId: string,
  acknowledgement: BuilderProjectSyncCommandResult,
) {
  const parsedProjectId = projectIdSchema.parse(projectId)
  const parsedAcknowledgement =
    builderProjectSyncCommandResultSchema.parse(acknowledgement)

  await deleteOutboxEntry(
    storageKey(parsedProjectId, parsedAcknowledgement.clientMutationId),
  )
}

export async function discardBuilderProjectSyncCommand(
  projectId: string,
  clientMutationId: string,
) {
  const parsedProjectId = projectIdSchema.parse(projectId)
  const parsedMutationId = z.uuid().parse(clientMutationId)
  await deleteOutboxEntry(storageKey(parsedProjectId, parsedMutationId))
}

export async function replayBuilderProjectSyncOutbox(
  projectId: string,
  send: BuilderProjectSyncOutboxSender,
): Promise<BuilderProjectSyncOutboxReplayResult> {
  const entries = await listBuilderProjectSyncOutbox(projectId)
  const acknowledgements: Array<BuilderProjectSyncCommandResult> = []
  const rejections: Array<BuilderProjectSyncCommandRejection> = []

  for (const entry of entries) {
    let response: unknown
    try {
      response = await send(entry.command, entry)
    } catch (error) {
      if (error instanceof BuilderProjectSyncOutboxDeferredError) break
      if (!(error instanceof BuilderProjectSyncCommandRejectedError)) {
        throw error
      }
      response = error.rejection
    }

    const outcome = parseOutcome(entry.clientMutationId, response)
    if (isBuilderProjectSyncCommandRejection(outcome)) {
      rejections.push(outcome)
      if (outcome.code === 'project-revision-conflict') break
      await deleteOutboxEntry(storageKey(projectId, outcome.clientMutationId))
      continue
    }
    await deleteOutboxEntry(storageKey(projectId, outcome.clientMutationId))
    acknowledgements.push(outcome)
  }

  return { acknowledgements, rejections }
}

export async function sendBuilderProjectSyncCommandFromOutbox(
  projectId: string,
  command: BuilderProjectSyncCommand,
  send: BuilderProjectSyncOutboxSender,
) {
  const queued = await enqueueBuilderProjectSyncCommand(projectId, command)
  const replay = await replayBuilderProjectSyncOutbox(projectId, send)
  const [rejection] = replay.rejections
  if (rejection) throw new BuilderProjectSyncCommandRejectedError(rejection)
  const acknowledgement = replay.acknowledgements.find(
    (candidate) => candidate.clientMutationId === queued.clientMutationId,
  )

  if (acknowledgement) return acknowledgement

  throw new BuilderProjectSyncOutboxAcknowledgementError(
    `Builder project mutation ${queued.clientMutationId} was not acknowledged`,
  )
}

function parseOutcome(clientMutationId: string, value: unknown) {
  const result = builderProjectSyncCommandOutcomeSchema.safeParse(value)
  if (!result.success || result.data.clientMutationId !== clientMutationId) {
    throw new BuilderProjectSyncOutboxAcknowledgementError(
      `Builder project mutation ${clientMutationId} received an invalid acknowledgement`,
    )
  }
  return result.data
}

function compareEntries(left: StoredOutboxEntry, right: StoredOutboxEntry) {
  return (
    left.createdAt - right.createdAt ||
    left.clientMutationId.localeCompare(right.clientMutationId)
  )
}

function toPublicEntry(
  entry: StoredOutboxEntry,
): BuilderProjectSyncOutboxEntry {
  return {
    projectId: entry.projectId,
    clientMutationId: entry.clientMutationId,
    command: entry.command,
    createdAt: entry.createdAt,
    sizeBytes: entry.sizeBytes,
  }
}

function commandsMatch(
  left: BuilderProjectSyncCommand,
  right: BuilderProjectSyncCommand,
) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function getUtf8ByteLength(command: BuilderProjectSyncCommand) {
  return new TextEncoder().encode(JSON.stringify(command)).byteLength
}

function parseStoredEntry(value: unknown) {
  try {
    const result = storedEntrySchema.safeParse(value)
    if (!result.success) return undefined
    if (result.data.clientMutationId !== result.data.command.clientMutationId) {
      return undefined
    }
    if (result.data.sizeBytes !== getUtf8ByteLength(result.data.command)) {
      return undefined
    }
    return result.data
  } catch {
    return undefined
  }
}

function storageKey(projectId: string, clientMutationId: string) {
  return JSON.stringify([projectId, clientMutationId])
}

type ValidStoredEntry = {
  key: IDBValidKey
  entry: StoredOutboxEntry
}

async function mutateOutbox<TResult>(
  mutate: (
    entries: ReadonlyArray<ValidStoredEntry>,
    store: IDBObjectStore,
  ) => TResult,
) {
  const database = await openOutboxDatabase()

  try {
    return await new Promise<TResult>((resolve, reject) => {
      const transaction = database.transaction(objectStoreName, 'readwrite')
      const store = transaction.objectStore(objectStoreName)
      const valuesRequest = store.getAll()
      const keysRequest = store.getAllKeys()
      let values: Array<unknown> | undefined
      let keys: Array<IDBValidKey> | undefined
      let resultState: { ready: false } | { ready: true; value: TResult } = {
        ready: false,
      }
      let rejected = false

      const rejectTransaction = (error: unknown) => {
        if (rejected) return
        rejected = true
        reject(error)
      }

      const runMutation = () => {
        if (!values || !keys || resultState.ready || rejected) return

        try {
          const entries: Array<ValidStoredEntry> = []
          const recordCount = Math.max(values.length, keys.length)

          for (let index = 0; index < recordCount; index++) {
            const key = keys[index]
            const entry = parseStoredEntry(values[index])
            if (
              key === undefined ||
              !entry ||
              key !== storageKey(entry.projectId, entry.clientMutationId)
            ) {
              if (key !== undefined) store.delete(key)
              continue
            }
            entries.push({ key, entry })
          }

          resultState = { ready: true, value: mutate(entries, store) }
        } catch (error) {
          rejectTransaction(error)
          transaction.abort()
        }
      }

      valuesRequest.onsuccess = () => {
        values = valuesRequest.result
        runMutation()
      }
      keysRequest.onsuccess = () => {
        keys = keysRequest.result
        runMutation()
      }
      transaction.oncomplete = () => {
        if (!resultState.ready || rejected) return
        resolve(resultState.value)
      }
      transaction.onerror = () => {
        rejectTransaction(
          createUnavailableError(
            'Builder project sync outbox failed',
            transaction.error,
          ),
        )
      }
      transaction.onabort = () => {
        if (!rejected) {
          rejectTransaction(
            createUnavailableError(
              'Builder project sync outbox transaction was aborted',
              transaction.error,
            ),
          )
        }
      }
    })
  } finally {
    database.close()
  }
}

async function deleteOutboxEntry(key: IDBValidKey) {
  const database = await openOutboxDatabase()

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(objectStoreName, 'readwrite')
      transaction.objectStore(objectStoreName).delete(key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () =>
        reject(
          createUnavailableError(
            'Builder project sync acknowledgement could not be saved',
            transaction.error,
          ),
        )
      transaction.onabort = () =>
        reject(
          createUnavailableError(
            'Builder project sync acknowledgement transaction was aborted',
            transaction.error,
          ),
        )
    })
  } finally {
    database.close()
  }
}

function openOutboxDatabase() {
  const indexedDb = getIndexedDb()

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDb.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(objectStoreName)) {
        request.result.createObjectStore(objectStoreName)
      }
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      resolve(database)
    }
    request.onerror = () =>
      reject(
        createUnavailableError(
          'Builder project sync outbox could not be opened',
          request.error,
        ),
      )
    request.onblocked = () =>
      reject(
        new BuilderProjectSyncOutboxUnavailableError(
          'Builder project sync outbox upgrade was blocked',
        ),
      )
  })
}

function getIndexedDb() {
  try {
    if (typeof globalThis.indexedDB === 'undefined') {
      throw new BuilderProjectSyncOutboxUnavailableError(
        'Builder project sync outbox is unavailable outside the browser',
      )
    }
    return globalThis.indexedDB
  } catch (error) {
    if (error instanceof BuilderProjectSyncOutboxUnavailableError) throw error
    throw createUnavailableError(
      'Builder project sync outbox is unavailable',
      error,
    )
  }
}

function createUnavailableError(message: string, cause: unknown) {
  return new BuilderProjectSyncOutboxUnavailableError(message, { cause })
}
