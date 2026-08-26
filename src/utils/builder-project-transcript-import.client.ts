import { isBuilderJsonObject } from './builder-project-events'
import { compactBuilderAiActivityForDurableSync } from './builder-ai-activity'
import {
  readBuilderAiTranscriptScopeSnapshot,
  removeBuilderAiTranscriptScopeSnapshot,
  type BuilderAiTranscriptScopeSnapshot,
} from './builder-ai-persistence.client'
import { isBuilderProjectId } from './builder-project'
import {
  builderProjectTranscriptImportMaxMessages,
  builderProjectTranscriptImportMaxRequestBytes,
  builderProjectTranscriptImportMaxRuns,
  builderProjectTranscriptImportMaxThreads,
  getBuilderProjectSyncCommandRequestBytes,
  type BuilderProjectSyncCommand,
  type BuilderProjectSyncMessage,
  type BuilderProjectSyncRun,
  type BuilderProjectSyncThread,
} from './builder-project-sync'
import {
  postBuilderProjectSyncCommand,
  type BuilderProjectSyncRow,
} from './builder-project-sync.client'
import {
  BuilderProjectSyncCommandRejectedError,
  BuilderProjectSyncOutboxAcknowledgementError,
  enqueueBuilderProjectSyncCommands,
  listBuilderProjectSyncOutbox,
  replayBuilderProjectSyncOutbox,
} from './builder-project-sync-outbox.client'

type TranscriptImportCommand = Extract<
  BuilderProjectSyncCommand,
  { type: 'transcript.import' }
>
type TranscriptImportThread = TranscriptImportCommand['threads'][number]
type TranscriptImportMessage = TranscriptImportCommand['messages'][number]
type TranscriptImportRun = TranscriptImportCommand['runs'][number]

type TranscriptImportUnit = {
  thread: TranscriptImportThread
  message?: TranscriptImportMessage
  run?: TranscriptImportRun
}

type TranscriptImportChunk = {
  mutationNamespace: string
  threads: Array<TranscriptImportThread>
  messages: Array<TranscriptImportMessage>
  runs: Array<TranscriptImportRun>
  threadIds: Set<string>
  runIds: Set<string>
  requestBytes: number
}

type TranscriptImportData = {
  threads: Array<TranscriptImportThread>
  messages: Array<TranscriptImportMessage>
  runs: Array<TranscriptImportRun>
}

export type PreparedBuilderProjectForkTranscriptImport = {
  commands: Array<TranscriptImportCommand>
  localSnapshot?: BuilderAiTranscriptScopeSnapshot
}

export async function createBuilderProjectTranscriptImportCommand(
  scope: string,
  clientMutationId?: string,
): Promise<TranscriptImportCommand | undefined> {
  const commands = await createBuilderProjectTranscriptImportCommands(
    scope,
    clientMutationId,
  )
  if (commands.length > 1) {
    throw new Error('Builder project transcript import requires chunking')
  }
  return commands[0]
}

export async function createBuilderProjectTranscriptImportCommands(
  scope: string,
  clientMutationId?: string,
): Promise<Array<TranscriptImportCommand>> {
  const snapshot = await readBuilderAiTranscriptScopeSnapshot(scope)
  return createLocalBuilderProjectTranscriptImportCommands(
    snapshot,
    clientMutationId,
  )
}

async function createLocalBuilderProjectTranscriptImportCommands(
  snapshot: BuilderAiTranscriptScopeSnapshot,
  clientMutationId?: string,
) {
  const { threads, messages, runs } =
    getLocalBuilderProjectTranscriptImportData(snapshot)

  const firstThread = threads[0]
  if (!firstThread) return []
  return chunkTranscriptImport({
    clientMutationId: clientMutationId ?? firstThread.id,
    threads,
    messages,
    runs,
  })
}

export async function createBuilderProjectForkTranscriptImportCommands(input: {
  clientMutationId: string
  source:
    | { type: 'local'; scope: string }
    | { type: 'sync'; rows: ReadonlyArray<BuilderProjectSyncRow> }
}): Promise<Array<TranscriptImportCommand>> {
  return (await prepareBuilderProjectForkTranscriptImport(input)).commands
}

export async function prepareBuilderProjectForkTranscriptImport({
  clientMutationId,
  source,
}: {
  clientMutationId: string
  source:
    | { type: 'local'; scope: string }
    | { type: 'sync'; rows: ReadonlyArray<BuilderProjectSyncRow> }
}): Promise<PreparedBuilderProjectForkTranscriptImport> {
  const localSnapshot =
    source.type === 'local'
      ? await readBuilderAiTranscriptScopeSnapshot(source.scope)
      : undefined
  const data = localSnapshot
    ? getLocalBuilderProjectTranscriptImportData(localSnapshot)
    : source.type === 'sync'
      ? getSyncedBuilderProjectTranscriptImportData(source.rows)
      : { threads: [], messages: [], runs: [] }
  if (data.threads.length === 0) {
    return {
      commands: [],
      ...(localSnapshot ? { localSnapshot } : {}),
    }
  }

  const remapped = await remapBuilderProjectTranscriptImportData(
    data,
    clientMutationId,
  )
  return {
    commands: await chunkTranscriptImport({
      clientMutationId,
      ...remapped,
    }),
    ...(localSnapshot ? { localSnapshot } : {}),
  }
}

function getLocalBuilderProjectTranscriptImportData(
  snapshot: BuilderAiTranscriptScopeSnapshot,
): TranscriptImportData {
  if (snapshot.threads.length === 0) {
    return { threads: [], messages: [], runs: [] }
  }

  const threads: Array<TranscriptImportThread> = []
  const messages: Array<TranscriptImportMessage> = []
  const runs: Array<TranscriptImportRun> = []

  for (const storedThread of snapshot.threads) {
    const transcript = storedThread.messages
    if (transcript.length === 0) continue
    const createdAt = new Date(storedThread.createdAt)
    threads.push({
      id: storedThread.id,
      title: storedThread.title,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      archivedAt: null,
    })

    const runByMessageIndex = new Map<number, string>()
    for (const [index, message] of transcript.entries()) {
      if (message.role !== 'assistant' || !message.activity) continue
      const runId = message.activity.id
      runByMessageIndex.set(index, runId)
      const activity = toJsonObject(
        compactBuilderAiActivityForDurableSync(message.activity),
      )
      runs.push({
        id: runId,
        threadId: storedThread.id,
        status:
          message.activity.status === 'complete'
            ? 'completed'
            : message.activity.status === 'error'
              ? 'failed'
              : 'cancelled',
        provider: 'legacy',
        model: 'unknown',
        activity,
        ...(message.activity.error
          ? { error: { message: message.activity.error } }
          : {}),
        startedAt: new Date(message.activity.startedAt).toISOString(),
        completedAt: new Date(
          message.activity.completedAt ?? createdAt.getTime() + index,
        ).toISOString(),
      })
    }

    for (const [index, message] of transcript.entries()) {
      const timestamp = new Date(createdAt.getTime() + index).toISOString()
      messages.push({
        id: message.id,
        threadId: storedThread.id,
        ...(runByMessageIndex.has(index)
          ? { runId: runByMessageIndex.get(index) }
          : {}),
        role: message.role,
        content: message.content,
        parts: [],
        position: index + 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    }
  }

  return { threads, messages, runs }
}

function getSyncedBuilderProjectTranscriptImportData(
  rows: ReadonlyArray<BuilderProjectSyncRow>,
): TranscriptImportData {
  const threads: Array<BuilderProjectSyncThread> = []
  const messages: Array<BuilderProjectSyncMessage> = []
  const runs: Array<BuilderProjectSyncRun> = []

  for (const row of rows) {
    if (row.kind === 'thread') threads.push(row.value)
    if (row.kind === 'message') messages.push(row.value)
    if (row.kind === 'run') runs.push(row.value)
  }

  const terminalRuns = runs.filter(
    (
      run,
    ): run is BuilderProjectSyncRun & {
      status: TranscriptImportRun['status']
    } => run.status !== 'pending' && run.status !== 'running',
  )
  const terminalRunIds = new Set(terminalRuns.map((run) => run.id))

  return {
    threads: threads.map((thread) => ({
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      archivedAt: thread.archivedAt,
    })),
    messages: messages.map((message) => ({
      id: message.id,
      threadId: message.threadId,
      ...(message.runId && terminalRunIds.has(message.runId)
        ? { runId: message.runId }
        : {}),
      role: message.role,
      content: message.content,
      parts: message.parts,
      position: message.position,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    })),
    runs: terminalRuns.map((run) => ({
      id: run.id,
      threadId: run.threadId,
      status: run.status,
      provider: run.provider,
      model: run.model,
      ...(run.error ? { error: run.error } : {}),
      ...(run.activity ? { activity: run.activity } : {}),
      ...(run.startedAt ? { startedAt: run.startedAt } : {}),
      completedAt: run.completedAt ?? run.updatedAt,
    })),
  }
}

async function remapBuilderProjectTranscriptImportData(
  data: TranscriptImportData,
  namespace: string,
): Promise<TranscriptImportData> {
  const [threadIds, messageIds, runIds] = await Promise.all([
    createTranscriptCopyIdMap(
      namespace,
      'thread',
      data.threads.map((thread) => thread.id),
    ),
    createTranscriptCopyIdMap(
      namespace,
      'message',
      data.messages.map((message) => message.id),
    ),
    createTranscriptCopyIdMap(
      namespace,
      'run',
      data.runs.map((run) => run.id),
    ),
  ])

  return {
    threads: data.threads.map((thread) => ({
      ...thread,
      id: requireRemappedId(threadIds, thread.id),
    })),
    messages: data.messages.map((message) => ({
      ...message,
      id: requireRemappedId(messageIds, message.id),
      threadId: requireRemappedId(threadIds, message.threadId),
      ...(message.runId
        ? { runId: requireRemappedId(runIds, message.runId) }
        : {}),
    })),
    runs: data.runs.map((run) => {
      const id = requireRemappedId(runIds, run.id)
      return {
        ...run,
        id,
        threadId: requireRemappedId(threadIds, run.threadId),
        ...(run.activity
          ? { activity: toJsonObject({ ...run.activity, id }) }
          : {}),
      }
    }),
  }
}

async function createTranscriptCopyIdMap(
  namespace: string,
  kind: 'thread' | 'message' | 'run',
  sourceIds: ReadonlyArray<string>,
) {
  const remapped = await Promise.all(
    sourceIds.map(async (sourceId) => ({
      sourceId,
      id: await deriveTranscriptCopyId(namespace, kind, sourceId),
    })),
  )
  const ids = new Map<string, string>()
  for (const entry of remapped) ids.set(entry.sourceId, entry.id)
  return ids
}

async function deriveTranscriptCopyId(
  namespace: string,
  kind: 'thread' | 'message' | 'run',
  sourceId: string,
) {
  return deriveUuidFromText(`${namespace}:${kind}:${sourceId}`)
}

async function deriveUuidFromText(value: string) {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
  ).slice(0, 16)
  digest[6] = ((digest[6] ?? 0) & 0x0f) | 0x40
  digest[8] = ((digest[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
    .slice(6, 8)
    .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`
}

function requireRemappedId(ids: ReadonlyMap<string, string>, sourceId: string) {
  const id = ids.get(sourceId)
  if (!id) throw new Error('Builder project transcript reference is missing')
  return id
}

export async function promoteBuilderProjectTranscript({
  projectId,
  scope,
  clientMutationId,
}: {
  projectId: string
  scope: string
  clientMutationId: string
}) {
  const snapshot = await readBuilderAiTranscriptScopeSnapshot(scope)
  if (snapshot.threads.length === 0) return

  const queuedByMutationId = new Map(
    (await listBuilderProjectSyncOutbox(projectId)).map((entry) => [
      entry.clientMutationId,
      entry.command,
    ]),
  )
  const generatedCommands =
    await createLocalBuilderProjectTranscriptImportCommands(
      snapshot,
      clientMutationId,
    )
  const commands = generatedCommands.map((command) => {
    const queued = queuedByMutationId.get(command.clientMutationId)
    return queued
      ? getQueuedTranscriptImportCommand(queued, command.clientMutationId)
      : command
  })

  if (commands.length === 0) return

  const acknowledgement = await importBuilderProjectTranscriptCommands({
    projectId,
    commands,
  })

  await removeBuilderAiTranscriptScopeSnapshot(snapshot)
  return acknowledgement
}

export async function importBuilderProjectTranscriptCommands({
  projectId,
  commands,
}: {
  projectId: string
  commands: ReadonlyArray<TranscriptImportCommand>
}) {
  if (commands.length === 0) return

  await enqueueBuilderProjectSyncCommands(projectId, commands)
  const replay = await replayBuilderProjectSyncOutbox(projectId, (command) =>
    postBuilderProjectSyncCommand(projectId, command),
  )
  const mutationIds = new Set(
    commands.map((command) => command.clientMutationId),
  )
  const rejection = replay.rejections.find((candidate) =>
    mutationIds.has(candidate.clientMutationId),
  )
  if (rejection) throw new BuilderProjectSyncCommandRejectedError(rejection)

  const acknowledgements = replay.acknowledgements.filter((candidate) =>
    mutationIds.has(candidate.clientMutationId),
  )
  if (acknowledgements.length !== commands.length) {
    throw new BuilderProjectSyncOutboxAcknowledgementError(
      'Builder project transcript import was not fully acknowledged',
    )
  }

  return acknowledgements.reduce((latest, acknowledgement) =>
    acknowledgement.sequence > latest.sequence ? acknowledgement : latest,
  )
}

export function getBuilderProjectDraftPromotionIds(draftId: string) {
  if (!isBuilderProjectId(draftId)) {
    throw new Error('Invalid Builder project draft ID')
  }

  return {
    revisionId: derivePromotionId(draftId, 1),
    transcriptImportMutationId:
      getBuilderProjectTranscriptImportMutationId(draftId),
  }
}

export function getBuilderProjectTranscriptImportMutationId(projectId: string) {
  if (!isBuilderProjectId(projectId)) {
    throw new Error('Invalid Builder project ID')
  }
  return derivePromotionId(projectId, 2)
}

async function chunkTranscriptImport({
  clientMutationId,
  threads,
  messages,
  runs,
}: {
  clientMutationId: string
  threads: Array<TranscriptImportThread>
  messages: Array<TranscriptImportMessage>
  runs: Array<TranscriptImportRun>
}) {
  if (!isBuilderProjectId(clientMutationId)) {
    throw new Error('Invalid Builder project transcript import mutation ID')
  }
  assertDistinctTranscriptImportIds(threads, messages, runs)

  const threadById = new Map(threads.map((thread) => [thread.id, thread]))
  const runById = new Map(runs.map((run) => [run.id, run]))
  const messagesByThreadId = new Map<string, Array<TranscriptImportMessage>>()
  const runsByThreadId = new Map<string, Array<TranscriptImportRun>>()
  const referencedRunIds = new Set<string>()
  const positions = new Set<string>()

  for (const run of runs) {
    if (!threadById.has(run.threadId)) {
      throw new Error('Builder project transcript run has no thread')
    }
    const threadRuns = runsByThreadId.get(run.threadId) ?? []
    threadRuns.push(run)
    runsByThreadId.set(run.threadId, threadRuns)
  }

  for (const message of messages) {
    if (!threadById.has(message.threadId)) {
      throw new Error('Builder project transcript message has no thread')
    }
    const position = `${message.threadId}:${message.position}`
    if (positions.has(position)) {
      throw new Error('Builder project transcript message position is reused')
    }
    positions.add(position)

    if (message.runId) {
      const run = runById.get(message.runId)
      if (!run || run.threadId !== message.threadId) {
        throw new Error('Builder project transcript message has no run')
      }
      referencedRunIds.add(run.id)
    }
    const threadMessages = messagesByThreadId.get(message.threadId) ?? []
    threadMessages.push(message)
    messagesByThreadId.set(message.threadId, threadMessages)
  }

  const units: Array<TranscriptImportUnit> = []
  for (const thread of threads) {
    const threadMessages = messagesByThreadId.get(thread.id) ?? []
    const unreferencedRuns = (runsByThreadId.get(thread.id) ?? []).filter(
      (run) => !referencedRunIds.has(run.id),
    )
    if (threadMessages.length === 0 && unreferencedRuns.length === 0) {
      units.push({ thread })
    }
    for (const message of threadMessages) {
      units.push({
        thread,
        message,
        ...(message.runId ? { run: runById.get(message.runId) } : {}),
      })
    }
    for (const run of unreferencedRuns) units.push({ thread, run })
  }

  const commands: Array<TranscriptImportCommand> = []
  let chunk = createEmptyTranscriptImportChunk(clientMutationId)
  for (const unit of units) {
    if (addTranscriptImportUnit(chunk, unit)) continue
    if (chunk.threads.length === 0) {
      throw new Error('Builder project transcript import item is too large')
    }
    commands.push(await finalizeTranscriptImportChunk(chunk))
    chunk = createEmptyTranscriptImportChunk(clientMutationId)
    if (!addTranscriptImportUnit(chunk, unit)) {
      throw new Error('Builder project transcript import item is too large')
    }
  }
  if (chunk.threads.length > 0) {
    commands.push(await finalizeTranscriptImportChunk(chunk))
  }
  return commands
}

function createEmptyTranscriptImportChunk(
  clientMutationId: string,
): TranscriptImportChunk {
  const command: TranscriptImportCommand = {
    type: 'transcript.import',
    clientMutationId,
    threads: [],
    messages: [],
    runs: [],
  }
  return {
    mutationNamespace: clientMutationId,
    threads: [],
    messages: [],
    runs: [],
    threadIds: new Set(),
    runIds: new Set(),
    requestBytes: getBuilderProjectSyncCommandRequestBytes(command),
  }
}

function addTranscriptImportUnit(
  chunk: TranscriptImportChunk,
  unit: TranscriptImportUnit,
) {
  const addThread = !chunk.threadIds.has(unit.thread.id)
  const run = unit.run
  const addRun = run !== undefined && !chunk.runIds.has(run.id)
  const nextThreadCount = chunk.threads.length + (addThread ? 1 : 0)
  const nextMessageCount = chunk.messages.length + (unit.message ? 1 : 0)
  const nextRunCount = chunk.runs.length + (addRun ? 1 : 0)
  const nextRequestBytes =
    chunk.requestBytes +
    (addThread ? getArrayItemBytes(chunk.threads.length, unit.thread) : 0) +
    (unit.message
      ? getArrayItemBytes(chunk.messages.length, unit.message)
      : 0) +
    (addRun ? getArrayItemBytes(chunk.runs.length, run) : 0)

  if (
    nextThreadCount > builderProjectTranscriptImportMaxThreads ||
    nextMessageCount > builderProjectTranscriptImportMaxMessages ||
    nextRunCount > builderProjectTranscriptImportMaxRuns ||
    nextRequestBytes > builderProjectTranscriptImportMaxRequestBytes
  ) {
    return false
  }

  if (addThread) {
    chunk.threadIds.add(unit.thread.id)
    chunk.threads.push(unit.thread)
  }
  if (unit.message) chunk.messages.push(unit.message)
  if (addRun && run) {
    chunk.runIds.add(run.id)
    chunk.runs.push(run)
  }
  chunk.requestBytes = nextRequestBytes
  return true
}

async function finalizeTranscriptImportChunk(
  chunk: TranscriptImportChunk,
): Promise<TranscriptImportCommand> {
  const clientMutationId = await deriveUuidFromText(
    `${chunk.mutationNamespace}:chunk:${canonicalJson({
      threads: chunk.threads,
      messages: chunk.messages,
      runs: chunk.runs,
    })}`,
  )
  const command: TranscriptImportCommand = {
    type: 'transcript.import',
    clientMutationId,
    threads: chunk.threads,
    messages: chunk.messages,
    runs: chunk.runs,
  }
  if (
    getBuilderProjectSyncCommandRequestBytes(command) !== chunk.requestBytes ||
    chunk.requestBytes > builderProjectTranscriptImportMaxRequestBytes
  ) {
    throw new Error('Builder project transcript import chunk is too large')
  }
  return command
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) {
      throw new Error('Builder transcript contains non-JSON data')
    }
    return serialized
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (!isRecord(value)) {
    throw new Error('Builder transcript contains non-JSON data')
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(',')}}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getArrayItemBytes(currentLength: number, value: unknown) {
  return (
    new TextEncoder().encode(JSON.stringify(value)).byteLength +
    (currentLength === 0 ? 0 : 1)
  )
}

function assertDistinctTranscriptImportIds(
  threads: Array<TranscriptImportThread>,
  messages: Array<TranscriptImportMessage>,
  runs: Array<TranscriptImportRun>,
) {
  if (new Set(threads.map((thread) => thread.id)).size !== threads.length) {
    throw new Error('Builder project transcript thread ID is reused')
  }
  if (new Set(messages.map((message) => message.id)).size !== messages.length) {
    throw new Error('Builder project transcript message ID is reused')
  }
  if (new Set(runs.map((run) => run.id)).size !== runs.length) {
    throw new Error('Builder project transcript run ID is reused')
  }
}

function derivePromotionId(draftId: string, discriminator: number) {
  const firstNibble = Number.parseInt(draftId[0] ?? '', 16)
  return `${(firstNibble ^ discriminator).toString(16)}${draftId.slice(1)}`
}

function getQueuedTranscriptImportCommand(
  command: BuilderProjectSyncCommand,
  clientMutationId: string,
) {
  if (command.type !== 'transcript.import') {
    throw new Error(
      `Builder project mutation ${clientMutationId} is not a transcript import`,
    )
  }
  return command
}

function toJsonObject(value: unknown) {
  const serialized: unknown = JSON.parse(JSON.stringify(value))
  if (!isBuilderJsonObject(serialized)) {
    throw new Error('Invalid Builder activity')
  }
  return serialized
}
