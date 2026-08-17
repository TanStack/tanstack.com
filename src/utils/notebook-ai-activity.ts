export type NotebookAiActivitySource = 'tool' | 'harness' | 'reasoning'

export type NotebookAiActivityStatus =
  | 'running'
  | 'complete'
  | 'error'
  | 'stopped'

export type NotebookAiActivityItemStatus =
  | 'preparing'
  | 'running'
  | 'complete'
  | 'error'
  | 'stopped'

export type NotebookAiActivityDetails = {
  path?: string
  paths?: ReadonlyArray<string>
  runtime?: string
  entry?: string
  packageName?: string
  packageVersion?: string
  offset?: number
  nextOffset?: number | null
  totalCharacters?: number
  characters?: number
  diff?: string
  phase?: string
  attempt?: number
  maxAttempts?: number
  message?: string
}

export type NotebookAiActivityItem = {
  id: string
  source: NotebookAiActivitySource
  name: string
  status: NotebookAiActivityItemStatus
  startedAt: number
  completedAt?: number
  details: NotebookAiActivityDetails
  error?: string
}

export type NotebookAiActivity = {
  id: string
  status: NotebookAiActivityStatus
  startedAt: number
  completedAt?: number
  items: ReadonlyArray<NotebookAiActivityItem>
  error?: string
}

type NotebookAiItemEvent = {
  runId: string
  itemId: string
  source: NotebookAiActivitySource
  name: string
  timestamp: number
}

export type NotebookAiActivityEvent =
  | { type: 'run-started'; runId: string; timestamp: number }
  | (NotebookAiItemEvent & { type: 'item-started'; input?: unknown })
  | (NotebookAiItemEvent & { type: 'item-running'; input?: unknown })
  | (NotebookAiItemEvent & { type: 'item-completed'; output?: unknown })
  | (NotebookAiItemEvent & {
      type: 'item-failed'
      error: string
      output?: unknown
    })
  | (NotebookAiItemEvent & { type: 'item-stopped' })
  | { type: 'run-completed'; runId: string; timestamp: number }
  | { type: 'run-failed'; runId: string; timestamp: number; error: string }
  | { type: 'run-stopped'; runId: string; timestamp: number }

const maxDetailCharacters = 4_000
const maxDiffCharacters = 50_000
const maxPaths = 100
const maxItems = 200

export function createNotebookAiActivity(
  runId: string,
  timestamp: number,
): NotebookAiActivity {
  return {
    id: runId,
    status: 'running',
    startedAt: cleanTimestamp(timestamp),
    items: [],
  }
}

export function reduceNotebookAiActivity(
  current: NotebookAiActivity | undefined,
  event: NotebookAiActivityEvent,
): NotebookAiActivity {
  const timestamp = cleanTimestamp(event.timestamp)
  const activity =
    current?.id === event.runId
      ? current
      : createNotebookAiActivity(event.runId, timestamp)

  if (event.type === 'run-started') {
    return {
      id: event.runId,
      status: 'running',
      startedAt: Math.min(activity.startedAt, timestamp),
      items: activity.items,
    }
  }

  if (event.type === 'run-completed') {
    const completedAt = Math.max(activity.startedAt, timestamp)
    return {
      id: activity.id,
      status: 'complete',
      startedAt: activity.startedAt,
      completedAt,
      items: stopPendingItems(activity.items, completedAt),
    }
  }

  if (event.type === 'run-failed') {
    const completedAt = Math.max(activity.startedAt, timestamp)
    return {
      id: activity.id,
      status: 'error',
      startedAt: activity.startedAt,
      completedAt,
      items: stopPendingItems(activity.items, completedAt),
      error: cleanError(event.error),
    }
  }

  if (event.type === 'run-stopped') {
    const completedAt = Math.max(activity.startedAt, timestamp)
    return {
      id: activity.id,
      status: 'stopped',
      startedAt: activity.startedAt,
      completedAt,
      items: stopPendingItems(activity.items, completedAt),
    }
  }

  const existing = activity.items.find((item) => item.id === event.itemId)
  const eventDetails =
    event.type === 'item-started' || event.type === 'item-running'
      ? sanitizeNotebookAiActivityDetails(event.name, event.input, undefined)
      : event.type === 'item-completed' || event.type === 'item-failed'
        ? sanitizeNotebookAiActivityDetails(event.name, undefined, event.output)
        : {}
  const details = { ...existing?.details, ...eventDetails }
  const status = getItemStatus(event.type)
  const error =
    event.type === 'item-failed' ? cleanError(event.error) : undefined
  const completedAt =
    status === 'complete' || status === 'error' || status === 'stopped'
      ? Math.max(existing?.startedAt ?? timestamp, timestamp)
      : undefined
  const item: NotebookAiActivityItem = {
    id: event.itemId,
    source: event.source,
    name: event.name,
    status,
    startedAt: existing?.startedAt ?? timestamp,
    details,
    ...(completedAt === undefined ? {} : { completedAt }),
    ...(error === undefined ? {} : { error }),
  }
  const items = existing
    ? activity.items.map((candidate) =>
        candidate.id === item.id ? item : candidate,
      )
    : [...activity.items, item].slice(-maxItems)

  return {
    id: activity.id,
    status: 'running',
    startedAt: activity.startedAt,
    items,
  }
}

export function sanitizeNotebookAiActivityDetails(
  name: string,
  input: unknown,
  output: unknown,
): NotebookAiActivityDetails {
  const inputRecord = readRecord(input)
  const outputRecord = readRecord(output)
  const details: NotebookAiActivityDetails = {}
  const path =
    readText(inputRecord?.path, maxDetailCharacters) ??
    readText(outputRecord?.path, maxDetailCharacters)
  const paths =
    readPaths(outputRecord?.files) ??
    readPaths(outputRecord?.createdFiles) ??
    readPaths(outputRecord?.changedFiles) ??
    readPaths(outputRecord?.paths) ??
    readPaths(inputRecord?.files) ??
    readPaths(inputRecord?.changedFiles) ??
    readPaths(inputRecord?.paths)

  if (path) details.path = path
  if (paths?.length) details.paths = paths

  const runtime = readText(outputRecord?.runtime, maxDetailCharacters)
  const entry = readText(outputRecord?.entry, maxDetailCharacters)
  if (runtime) details.runtime = runtime
  if (entry) details.entry = entry

  const packageName =
    readText(outputRecord?.packageName, maxDetailCharacters) ??
    readText(outputRecord?.name, maxDetailCharacters) ??
    readText(inputRecord?.name, maxDetailCharacters)
  const packageVersion =
    readText(outputRecord?.packageVersion, maxDetailCharacters) ??
    readText(outputRecord?.version, maxDetailCharacters) ??
    readText(inputRecord?.version, maxDetailCharacters)
  if (
    name === 'install_dependency' ||
    name === 'inspect_module' ||
    name === 'search_package_resources' ||
    name === 'read_package_resource'
  ) {
    if (packageName) details.packageName = packageName
    if (packageVersion) details.packageVersion = packageVersion
  }

  const offset =
    readNumber(outputRecord?.offset) ?? readNumber(inputRecord?.offset)
  const nextOffset = readNullableNumber(outputRecord?.nextOffset)
  const totalCharacters = readNumber(outputRecord?.totalCharacters)
  const characters = readNumber(outputRecord?.characters)
  if (offset !== undefined) details.offset = offset
  if (nextOffset !== undefined) details.nextOffset = nextOffset
  if (totalCharacters !== undefined) details.totalCharacters = totalCharacters
  if (characters !== undefined) details.characters = characters

  if (name === 'read_file' && typeof outputRecord?.content === 'string') {
    details.characters = outputRecord.content.length
  }
  if (name === 'replace_file' && typeof inputRecord?.content === 'string') {
    details.characters = inputRecord.content.length
  }

  const diff =
    readText(outputRecord?.diff, maxDiffCharacters) ??
    readText(inputRecord?.diff, maxDiffCharacters)
  const phase =
    readText(outputRecord?.phase, maxDetailCharacters) ??
    readText(inputRecord?.phase, maxDetailCharacters)
  const attempt =
    readNumber(outputRecord?.attempt) ?? readNumber(inputRecord?.attempt)
  const maxAttempts =
    readNumber(outputRecord?.maxAttempts) ??
    readNumber(inputRecord?.maxAttempts)
  const message =
    readText(outputRecord?.message, maxDetailCharacters) ??
    readText(inputRecord?.message, maxDetailCharacters)
  if (diff) details.diff = diff
  if (phase) details.phase = phase
  if (attempt !== undefined) details.attempt = attempt
  if (maxAttempts !== undefined) details.maxAttempts = maxAttempts
  if (message && name !== 'read_file' && name !== 'replace_file') {
    details.message = message
  }

  return details
}

export function parseNotebookAiActivity(value: unknown): NotebookAiActivity {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'id',
      'status',
      'startedAt',
      'completedAt',
      'items',
      'error',
    ]) ||
    !isBoundedText(value.id, 256) ||
    !isActivityStatus(value.status) ||
    !isTimestamp(value.startedAt) ||
    !Array.isArray(value.items) ||
    value.items.length > maxItems
  ) {
    throw invalidActivity()
  }

  const completedAt = parseCompletedAt(value.completedAt, value.status)
  const error = parseActivityError(value.error, value.status)
  const items = value.items.map(parseNotebookAiActivityItem)
  if (completedAt !== undefined && completedAt < value.startedAt) {
    throw invalidActivity()
  }

  return {
    id: value.id,
    status: value.status,
    startedAt: value.startedAt,
    items,
    ...(completedAt === undefined ? {} : { completedAt }),
    ...(error === undefined ? {} : { error }),
  }
}

export function getNotebookAiActivitySummary(activity: NotebookAiActivity) {
  if (activity.status === 'running') {
    const active = findLastItem(
      activity.items,
      (item) => item.status === 'preparing' || item.status === 'running',
    )
    return active ? getNotebookAiActivityItemLabel(active) : 'Working'
  }

  if (activity.status === 'error') {
    const failed = findLastItem(
      activity.items,
      (item) => item.status === 'error',
    )
    return failed ? getNotebookAiActivityItemLabel(failed) : 'Run failed'
  }

  if (activity.status === 'stopped') return 'Stopped'

  const completed = activity.items.filter((item) => item.status === 'complete')
  const editedFiles = uniquePaths(
    completed.filter(
      (item) => item.name === 'replace_file' || item.name === 'apply_workspace',
    ),
  )
  const installedPackages = completed
    .filter((item) => item.name === 'install_dependency')
    .map((item) => item.details.packageName)
    .filter((name): name is string => Boolean(name))
  const ranNotebook = completed.some((item) => item.name === 'run_notebook')
  const failedRun = findLastItem(
    activity.items,
    (item) => item.name === 'run_notebook' && item.status === 'error',
  )

  if (installedPackages.length) {
    const installed =
      installedPackages.length === 1
        ? installedPackages[0]!
        : `${installedPackages.length} dependencies`
    return ranNotebook
      ? `Installed ${installed} and ran the notebook`
      : `Installed ${installed}`
  }

  if (editedFiles.length && ranNotebook) {
    if (failedRun) {
      const phase = failedRun.details.phase
        ? `${failedRun.details.phase} error`
        : 'preview error'
      return `Edited ${formatCount(editedFiles.length, 'file')}, fixed a ${phase}, and ran the notebook`
    }
    return `Edited ${formatCount(editedFiles.length, 'file')} and ran the notebook`
  }

  if (editedFiles.length) {
    return `Edited ${formatCount(editedFiles.length, 'file')}`
  }

  if (ranNotebook) return 'Ran the notebook'
  if (completed.some((item) => item.name === 'upgrade_runtime')) {
    return 'Switched to WebContainer'
  }

  const readFiles = uniquePaths(
    completed.filter((item) => item.name === 'read_file'),
  )
  if (readFiles.length) {
    return `Inspected ${formatCount(readFiles.length, 'file')}`
  }
  if (
    completed.some(
      (item) =>
        item.name === 'inspect_module' ||
        item.name === 'search_package_resources' ||
        item.name === 'read_package_resource',
    )
  ) {
    return 'Inspected package API'
  }
  if (
    completed.some(
      (item) => item.name === 'describe_notebook' || item.name === 'list_files',
    )
  ) {
    return 'Inspected notebook'
  }
  if (
    completed.some(
      (item) => item.name === 'reasoning' || item.source === 'reasoning',
    )
  ) {
    return 'Thought through approach'
  }
  if (completed.length) {
    return `Completed ${formatCount(completed.length, 'action')}`
  }
  return 'Finished'
}

export function getNotebookAiActivityItemLabel(item: NotebookAiActivityItem) {
  const path = formatPath(item.details.path)
  const failed = item.status === 'error'
  const stopped = item.status === 'stopped'
  const complete = item.status === 'complete'

  if (item.name === 'describe_notebook') {
    if (failed) return 'Notebook inspection failed'
    if (stopped) return 'Notebook inspection stopped'
    return complete ? 'Inspected notebook' : 'Inspecting notebook'
  }
  if (item.name === 'list_files') {
    if (failed) return 'File listing failed'
    if (stopped) return 'File listing stopped'
    const count = item.details.paths?.length
    return complete && count
      ? `Listed ${formatCount(count, 'file')}`
      : complete
        ? 'Listed files'
        : 'Listing files'
  }
  if (item.name === 'read_file') {
    if (failed) return `Failed to read ${path}`
    if (stopped) return `Stopped reading ${path}`
    return complete ? `Read ${path}` : `Reading ${path}`
  }
  if (item.name === 'inspect_module') {
    const packageName = item.details.packageName ?? 'module'
    if (failed) return `Failed to inspect ${packageName}`
    if (stopped) return `Stopped inspecting ${packageName}`
    return complete
      ? `Inspected ${packageName} exports`
      : `Inspecting ${packageName} exports`
  }
  if (item.name === 'search_package_resources') {
    const packageName = item.details.packageName ?? 'package'
    if (failed) return `Failed to search ${packageName}`
    if (stopped) return `Stopped searching ${packageName}`
    return complete
      ? `Searched ${packageName} resources`
      : `Searching ${packageName} resources`
  }
  if (item.name === 'read_package_resource') {
    if (failed) return `Failed to read ${path}`
    if (stopped) return `Stopped reading ${path}`
    return complete ? `Read ${path}` : `Reading ${path}`
  }
  if (item.name === 'replace_file') {
    if (failed) return `Failed to edit ${path}`
    if (stopped) return `Stopped editing ${path}`
    return complete ? `Edited ${path}` : `Editing ${path}`
  }
  if (item.name === 'upgrade_runtime') {
    if (failed) return 'WebContainer setup failed'
    if (stopped) return 'WebContainer setup stopped'
    return complete ? 'Switched to WebContainer' : 'Preparing WebContainer'
  }
  if (item.name === 'install_dependency') {
    const dependency = formatDependency(item.details)
    if (failed) return `Failed to install ${dependency}`
    if (stopped) return `Stopped installing ${dependency}`
    return complete ? `Installed ${dependency}` : `Installing ${dependency}`
  }
  if (item.name === 'apply_workspace') {
    const count = item.details.paths?.length
    if (failed) return 'Failed to apply file changes'
    if (stopped) return 'Stopped applying file changes'
    return complete
      ? count
        ? `Applied ${formatCount(count, 'file change')}`
        : 'Applied file changes'
      : count
        ? `Applying ${formatCount(count, 'file change')}`
        : 'Applying file changes'
  }
  if (item.name === 'run_notebook') {
    if (failed) {
      return item.details.phase
        ? `Preview failed during ${item.details.phase}`
        : 'Preview failed'
    }
    if (stopped) return 'Notebook run stopped'
    return complete ? 'Notebook ran successfully' : 'Running notebook'
  }
  if (item.name === 'repair_notebook') {
    if (failed) return 'Preview repair failed'
    if (stopped) return 'Preview repair stopped'
    return complete ? 'Fixed preview error' : 'Fixing preview error'
  }
  if (item.name === 'rollback_workspace') {
    if (failed) return 'Checkpoint restore failed'
    if (stopped) return 'Checkpoint restore stopped'
    return complete ? 'Restored notebook checkpoint' : 'Restoring checkpoint'
  }
  if (item.name === 'reasoning' || item.source === 'reasoning') {
    if (failed) return 'Reasoning summary failed'
    if (stopped) return 'Thinking stopped'
    return complete ? 'Thought through approach' : 'Thinking'
  }

  const label = humanizeName(item.name)
  if (failed) return `${label} failed`
  if (stopped) return `${label} stopped`
  return complete ? `Completed ${label.toLowerCase()}` : label
}

export function formatNotebookAiActivityDuration(
  activity: NotebookAiActivity,
  now = activity.completedAt ?? activity.startedAt,
) {
  const milliseconds = Math.max(
    0,
    (activity.completedAt ?? cleanTimestamp(now)) - activity.startedAt,
  )
  const seconds = Math.max(1, Math.round(milliseconds / 1_000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) {
    return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

function getItemStatus(
  type:
    | 'item-started'
    | 'item-running'
    | 'item-completed'
    | 'item-failed'
    | 'item-stopped',
): NotebookAiActivityItemStatus {
  if (type === 'item-started') return 'preparing'
  if (type === 'item-running') return 'running'
  if (type === 'item-completed') return 'complete'
  if (type === 'item-failed') return 'error'
  return 'stopped'
}

function stopPendingItems(
  items: ReadonlyArray<NotebookAiActivityItem>,
  timestamp: number,
) {
  return items.map((item): NotebookAiActivityItem => {
    if (item.status !== 'preparing' && item.status !== 'running') return item
    return {
      id: item.id,
      source: item.source,
      name: item.name,
      status: 'stopped',
      startedAt: item.startedAt,
      completedAt: Math.max(item.startedAt, timestamp),
      details: item.details,
    }
  })
}

function uniquePaths(items: ReadonlyArray<NotebookAiActivityItem>) {
  const paths = new Set<string>()
  for (const item of items) {
    if (item.details.path) paths.add(item.details.path)
    for (const path of item.details.paths ?? []) paths.add(path)
  }
  return [...paths]
}

function findLastItem(
  items: ReadonlyArray<NotebookAiActivityItem>,
  predicate: (item: NotebookAiActivityItem) => boolean,
) {
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index]
    if (item && predicate(item)) return item
  }
  return undefined
}

function formatDependency(details: NotebookAiActivityDetails) {
  const name = details.packageName ?? 'dependency'
  return details.packageVersion ? `${name}@${details.packageVersion}` : name
}

function formatPath(path: string | undefined) {
  return path?.replace(/^\//, '') || 'file'
}

function formatCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function humanizeName(name: string) {
  const text = name.replace(/[_-]+/g, ' ').trim() || 'Action'
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readText(value: unknown, maxCharacters: number) {
  if (typeof value !== 'string' || !value) return undefined
  return cleanText(value, maxCharacters)
}

function cleanText(value: string, maxCharacters: number) {
  return value.length <= maxCharacters
    ? value
    : `${value.slice(0, Math.max(0, maxCharacters - 2))}\n…`
}

function cleanError(value: string) {
  return cleanText(value.trim(), maxDetailCharacters) || 'Unknown error'
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined
}

function readNullableNumber(value: unknown) {
  return value === null ? null : readNumber(value)
}

function readPaths(value: unknown) {
  if (!Array.isArray(value)) return undefined
  const paths: Array<string> = []
  for (const candidate of value.slice(0, maxPaths)) {
    const path =
      typeof candidate === 'string'
        ? candidate
        : readText(readRecord(candidate)?.path, maxDetailCharacters)
    if (path) paths.push(path)
  }
  return paths
}

function parseNotebookAiActivityItem(value: unknown): NotebookAiActivityItem {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'id',
      'source',
      'name',
      'status',
      'startedAt',
      'completedAt',
      'details',
      'error',
    ]) ||
    !isBoundedText(value.id, 256) ||
    !isActivitySource(value.source) ||
    !isBoundedText(value.name, 128) ||
    !isItemStatus(value.status) ||
    !isTimestamp(value.startedAt)
  ) {
    throw invalidActivity()
  }

  const completedAt = parseItemCompletedAt(value.completedAt, value.status)
  const error = parseItemError(value.error, value.status)
  const details = parseNotebookAiActivityDetails(value.details, value.name)
  if (completedAt !== undefined && completedAt < value.startedAt) {
    throw invalidActivity()
  }

  return {
    id: value.id,
    source: value.source,
    name: value.name,
    status: value.status,
    startedAt: value.startedAt,
    details,
    ...(completedAt === undefined ? {} : { completedAt }),
    ...(error === undefined ? {} : { error }),
  }
}

function parseNotebookAiActivityDetails(
  value: unknown,
  name: string,
): NotebookAiActivityDetails {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'path',
      'paths',
      'runtime',
      'entry',
      'packageName',
      'packageVersion',
      'offset',
      'nextOffset',
      'totalCharacters',
      'characters',
      'diff',
      'phase',
      'attempt',
      'maxAttempts',
      'message',
    ])
  ) {
    throw invalidActivity()
  }

  if (
    (name === 'read_file' || name === 'replace_file') &&
    value.message !== undefined
  ) {
    throw invalidActivity()
  }

  const details: NotebookAiActivityDetails = {}
  const path = parseOptionalText(value.path, maxDetailCharacters)
  const paths = parseOptionalPaths(value.paths)
  const runtime = parseOptionalText(value.runtime, maxDetailCharacters)
  const entry = parseOptionalText(value.entry, maxDetailCharacters)
  const packageName = parseOptionalText(value.packageName, maxDetailCharacters)
  const packageVersion = parseOptionalText(
    value.packageVersion,
    maxDetailCharacters,
  )
  const offset = parseOptionalNumber(value.offset)
  const nextOffset = parseOptionalNullableNumber(value.nextOffset)
  const totalCharacters = parseOptionalNumber(value.totalCharacters)
  const characters = parseOptionalNumber(value.characters)
  const diff = parseOptionalText(value.diff, maxDiffCharacters)
  const phase = parseOptionalText(value.phase, maxDetailCharacters)
  const attempt = parseOptionalNumber(value.attempt)
  const maxAttempts = parseOptionalNumber(value.maxAttempts)
  const message = parseOptionalText(value.message, maxDetailCharacters)

  if (path !== undefined) details.path = path
  if (paths !== undefined) details.paths = paths
  if (runtime !== undefined) details.runtime = runtime
  if (entry !== undefined) details.entry = entry
  if (packageName !== undefined) details.packageName = packageName
  if (packageVersion !== undefined) details.packageVersion = packageVersion
  if (offset !== undefined) details.offset = offset
  if (nextOffset !== undefined) details.nextOffset = nextOffset
  if (totalCharacters !== undefined) {
    details.totalCharacters = totalCharacters
  }
  if (characters !== undefined) details.characters = characters
  if (diff !== undefined) details.diff = diff
  if (phase !== undefined) details.phase = phase
  if (attempt !== undefined) details.attempt = attempt
  if (maxAttempts !== undefined) details.maxAttempts = maxAttempts
  if (message !== undefined) details.message = message
  return details
}

function parseCompletedAt(value: unknown, status: NotebookAiActivityStatus) {
  if (status === 'running') {
    if (value !== undefined) throw invalidActivity()
    return undefined
  }
  if (!isTimestamp(value)) throw invalidActivity()
  return value
}

function parseActivityError(value: unknown, status: NotebookAiActivityStatus) {
  if (status !== 'error') {
    if (value !== undefined) throw invalidActivity()
    return undefined
  }
  if (!isBoundedText(value, maxDetailCharacters)) throw invalidActivity()
  return cleanText(value, maxDetailCharacters)
}

function parseItemCompletedAt(
  value: unknown,
  status: NotebookAiActivityItemStatus,
) {
  if (status === 'preparing' || status === 'running') {
    if (value !== undefined) throw invalidActivity()
    return undefined
  }
  if (!isTimestamp(value)) throw invalidActivity()
  return value
}

function parseItemError(value: unknown, status: NotebookAiActivityItemStatus) {
  if (status !== 'error') {
    if (value !== undefined) throw invalidActivity()
    return undefined
  }
  if (!isBoundedText(value, maxDetailCharacters)) throw invalidActivity()
  return cleanText(value, maxDetailCharacters)
}

function parseOptionalText(value: unknown, maxCharacters: number) {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !value) throw invalidActivity()
  return cleanText(value, maxCharacters)
}

function parseOptionalPaths(value: unknown) {
  if (value === undefined) return undefined
  if (
    !Array.isArray(value) ||
    !value.every((path) => isBoundedText(path, maxDetailCharacters))
  ) {
    throw invalidActivity()
  }
  return value
    .slice(0, maxPaths)
    .map((path) => cleanText(path, maxDetailCharacters))
}

function parseOptionalNumber(value: unknown) {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalidActivity()
  }
  return value
}

function parseOptionalNullableNumber(value: unknown) {
  return value === null ? null : parseOptionalNumber(value)
}

function isActivitySource(value: unknown): value is NotebookAiActivitySource {
  return value === 'tool' || value === 'harness' || value === 'reasoning'
}

function isActivityStatus(value: unknown): value is NotebookAiActivityStatus {
  return (
    value === 'running' ||
    value === 'complete' ||
    value === 'error' ||
    value === 'stopped'
  )
}

function isItemStatus(value: unknown): value is NotebookAiActivityItemStatus {
  return (
    value === 'preparing' ||
    value === 'running' ||
    value === 'complete' ||
    value === 'error' ||
    value === 'stopped'
  )
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isBoundedText(value: unknown, maxCharacters: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxCharacters
  )
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  keys: ReadonlyArray<string>,
) {
  return Object.keys(value).every((key) => keys.includes(key))
}

function invalidActivity() {
  return new Error('Invalid notebook AI activity')
}

function cleanTimestamp(timestamp: number) {
  return Number.isFinite(timestamp) ? Math.max(0, timestamp) : 0
}
