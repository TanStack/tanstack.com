import {
  bulkConversationSchema,
  bulkConversationCommand,
} from '../core/conversation-bulk-actions'
import {
  historyChange,
  reverseHistory,
  type WorkspaceHistoryChange,
} from '../core/workspace-history'
import {
  DbClient,
  collectionOptions,
  type SyncConfig,
} from '@tanstack/react-db'
import { DurableStream } from '@durable-streams/client'
import {
  projectionEntities,
  workspaceCommitSchema,
  type WorkspaceEntity,
  type WorkspaceCommit,
  type WorkspaceProjection,
  type WorkspaceSyncSnapshot,
} from '../core/workspace-sync'
import type { BotActivity } from '../core/bot-views'
import type { WorkspaceBot } from '../core/bot-workspace'
import { ApiError } from '../components/WorkspaceApi'
import { moveBotGroup } from '../core/bot-group-move'
import { botDragLayout } from '../core/bot-drag'
import {
  botMoveSchema,
  botGroupMoveSchema,
  botOrganizationSchema,
  botPatchSchema,
  botSectionPatchSchema,
  type WorkspaceIndex,
} from '../core/workspace-index'

type Request = (
  path: string,
  body?: unknown,
  method?: string,
  options?: { signal?: AbortSignal },
) => Promise<unknown>

export function isWorkspaceMutation(path: string, method: string) {
  return (
    (method === 'PATCH' && /^bots\/[^/]+(?:\/organization)?$/.test(path)) ||
    (method === 'POST' && /^bots\/[^/]+\/(move|delete|restore)$/.test(path)) ||
    (method === 'POST' &&
      (path === 'bots/bulk' || path === 'bots/move' || path === 'bots/bulk')) ||
    (method === 'POST' && path === 'workspace-history') ||
    (method === 'POST' && path === 'sections') ||
    (['PATCH', 'DELETE'].includes(method) && /^sections\/[^/]+$/.test(path))
  )
}

const sameGroup = (a: WorkspaceBot, b: WorkspaceBot) =>
  a.parent_id === b.parent_id &&
  a.pinned === b.pinned &&
  (a.pinned || a.section_id === b.section_id) &&
  (a.archived_at !== null) === (b.archived_at !== null) &&
  a.deleted_at === null &&
  b.deleted_at === null

// Match the server's placement rules, including both the old and new group.
function reorder(
  bots: WorkspaceBot[],
  group: WorkspaceBot,
  movingId?: string,
  position = 0,
) {
  const peers = bots
    .filter((bot) => sameGroup(bot, group) && bot.id !== movingId)
    .sort(
      (a, b) =>
        a.position - b.position ||
        a.created_at - b.created_at ||
        a.id.localeCompare(b.id),
    )
  const moving = bots.find(
    (bot) => bot.id === movingId && sameGroup(bot, group),
  )
  if (moving)
    peers.splice(
      Math.max(0, Math.min(Math.trunc(position), peers.length)),
      0,
      moving,
    )
  const positions = new Map(peers.map((bot, index) => [bot.id, index]))
  return bots.map((bot) =>
    positions.has(bot.id) && positions.get(bot.id) !== bot.position
      ? { ...bot, position: positions.get(bot.id)! }
      : bot,
  )
}

/** Only predict reversible metadata. Deletion/restoration and creation use server receipts. */
export function optimisticWorkspaceIndex(
  index: WorkspaceIndex,
  path: string,
  body: unknown,
  method: string,
  now = Date.now(),
): WorkspaceIndex {
  if (path === 'bots/bulk' && method === 'POST') {
    const parsed = bulkConversationSchema.safeParse(body)
    if (!parsed.success) return index
    return parsed.data.bots.reduce((current, bot) => {
      const existing = current.bots.find((item) => item.id === bot.id)
      if (
        !existing ||
        existing.deleted_at !== null ||
        (parsed.data.action.type === 'archive' &&
          existing.version !== bot.version)
      )
        return current
      const command = bulkConversationCommand(bot, parsed.data.action)
      return optimisticWorkspaceIndex(
        current,
        command.path,
        command.body,
        command.method,
        now,
      )
    }, index)
  }
  const next = predictWorkspaceIndex(index, path, body, method, now)
  const vacated = new Set(
    index.bots
      .filter(
        (bot) =>
          bot.section_id &&
          next.bots.some(
            (updated) =>
              updated.id === bot.id && updated.section_id !== bot.section_id,
          ),
      )
      .map((bot) => bot.section_id),
  )
  return {
    ...next,
    sections: next.sections.filter(
      (section) =>
        !vacated.has(section.id) ||
        next.bots.some((bot) => bot.section_id === section.id),
    ),
  }
}

function predictWorkspaceIndex(
  index: WorkspaceIndex,
  path: string,
  body: unknown,
  method: string,
  now = Date.now(),
): WorkspaceIndex {
  const [resource, encodedId, action] = path.split('/')
  const id = encodedId && decodeURIComponent(encodedId)
  let { bots, sections } = index
  if (path === 'bots/move' && method === 'POST') {
    const value = botGroupMoveSchema.parse(body)
    if (value.layout !== botDragLayout(bots))
      throw new Error('The conversation order changed. Refresh and try again.')
    return { ...index, bots: moveBotGroup(bots, value, now) }
  }
  if (resource === 'bots') {
    const original = bots.find((bot) => bot.id === id)
    if (!original) throw new Error('This conversation is no longer available.')
    let next = original
    let placement: number | undefined
    if (method === 'PATCH' && !action) {
      const value = botPatchSchema.parse(body)
      if (value.version !== original.version)
        throw new Error('This conversation changed. Refresh and try again.')
      next = {
        ...original,
        name: value.name ?? original.name,
        purpose: value.purpose ?? original.purpose,
        avatar: value.avatar === undefined ? original.avatar : value.avatar,
        parent_id:
          value.parentId === undefined ? original.parent_id : value.parentId,
        archived_at:
          value.archived === undefined
            ? original.archived_at
            : value.archived
              ? now
              : null,
        version: original.version + 1,
        updated_at: now,
      }
    } else if (method === 'PATCH' && action === 'organization') {
      const value = botOrganizationSchema.parse(body)
      next = {
        ...original,
        pinned: value.pinned ?? original.pinned,
        section_id:
          value.sectionId === undefined ? original.section_id : value.sectionId,
        position: value.position ?? original.position,
        tags: value.tags ? [...new Set(value.tags)] : original.tags,
      }
      if (
        next.pinned !== original.pinned ||
        next.section_id !== original.section_id ||
        value.position !== undefined
      )
        placement = value.position ?? Number.MAX_SAFE_INTEGER
    } else if (method === 'POST' && action === 'move') {
      const { version, ...value } = botMoveSchema.parse(body)
      return {
        ...index,
        bots: moveBotGroup(bots, { ...value, bots: [{ id, version }] }, now),
      }
    }
    if (next !== original) {
      bots = bots.map((bot) => (bot.id === id ? next : bot))
      if (placement !== undefined)
        bots = reorder(reorder(bots, original), next, id, placement)
    }
  } else if (resource === 'sections' && id) {
    if (method === 'DELETE') {
      sections = sections.filter((section) => section.id !== id)
      bots = bots.map((bot) =>
        bot.section_id === id ? { ...bot, section_id: null } : bot,
      )
    } else if (method === 'PATCH') {
      const value = botSectionPatchSchema.parse(body)
      const original = sections.find((section) => section.id === id)
      if (!original || value.version !== original.version)
        throw new Error('This section changed. Refresh and try again.')
      if (value.position !== undefined) {
        const ordered = sections
          .filter((section) => section.id !== id)
          .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
        ordered.splice(
          Math.max(0, Math.min(Math.trunc(value.position), ordered.length)),
          0,
          original,
        )
        sections = ordered.map((section, position) => ({
          ...section,
          position,
          version: section.version + 1,
        }))
      }
      sections = sections.map((section) =>
        section.id === id
          ? {
              ...section,
              name: value.name ?? section.name,
              version: section.version + (value.position === undefined ? 1 : 0),
            }
          : section,
      )
    }
  }
  return { ...index, bots, sections }
}

export function createWorkspaceCollections({
  request,
  initial,
  initialActivity = {},
  streamUrl,
}: {
  request: Request
  initial: WorkspaceIndex
  initialActivity?: Record<string, BotActivity>
  streamUrl: string
}) {
  const db = new DbClient()
  const { workspaceId, userId } = initial
  let sync!: Parameters<SyncConfig<WorkspaceEntity, string>['sync']>[0]
  let canonical = new Map<string, WorkspaceEntity>()
  let generation: string | undefined
  let version = -1
  const retiredGenerations = new Set<string>()
  let disposed = false
  let owners = 0
  let writes: Promise<unknown> = Promise.resolve()
  let connection: AbortController | undefined
  const listeners = new Set<() => void>()
  let status = { error: null as Error | null, isPending: true, isError: false }
  const setStatus = (error: Error | null, isPending = false) => {
    if (disposed || (status.error === error && status.isPending === isPending))
      return
    status = { error, isPending, isError: !!error }
    for (const listener of listeners) listener()
  }
  // One normalized collection is the atomic boundary across all entity types.
  const entities = db.collection(
    collectionOptions({
      id: `workspace:${JSON.stringify([workspaceId, userId])}`,
      getKey: (row: WorkspaceEntity) => row.id,
      startSync: true,
      sync: {
        sync: (params) => {
          sync = params
          params.begin()
          canonical = new Map(
            projectionEntities({ ...initial, activity: initialActivity }).map(
              (row) => [row.id, row],
            ),
          )
          for (const row of canonical.values())
            params.write({ type: 'insert', value: row })
          params.commit()
          params.markReady()
        },
      },
    }),
  )
  function assertScope(state: { workspaceId: string; userId: string }) {
    if (state.workspaceId !== workspaceId || state.userId !== userId)
      throw new ApiError(
        'Your account or workspace changed. Reload this workspace.',
        401,
      )
  }
  function publish(next: Map<string, WorkspaceEntity>) {
    sync.begin({ immediate: true })
    for (const row of next.values()) {
      const old = canonical.get(row.id)
      if (!old || JSON.stringify(old) !== JSON.stringify(row))
        sync.write({ type: old ? 'update' : 'insert', value: row })
    }
    for (const row of canonical.values())
      if (!next.has(row.id)) sync.write({ type: 'delete', key: row.id })
    const receipt = sync.commit()
    canonical = next
    return receipt
  }
  async function applySnapshot(
    snapshot: WorkspaceSyncSnapshot,
    allowGenerationChange = true,
  ) {
    assertScope(snapshot.state)
    if (
      snapshot.protocol !== 1 ||
      !Number.isSafeInteger(snapshot.version) ||
      !snapshot.generation ||
      !snapshot.offset
    )
      throw new Error('Invalid workspace snapshot.')
    if (snapshot.state.bots.some((bot) => bot.workspace_id !== workspaceId))
      throw new Error('Invalid workspace scope.')
    if (disposed || retiredGenerations.has(snapshot.generation)) return
    if (generation === snapshot.generation && snapshot.version <= version) {
      setStatus(null)
      return
    }
    if (
      generation &&
      generation !== snapshot.generation &&
      !allowGenerationChange
    ) {
      await refresh()
      return
    }
    const applied = publish(
      new Map(projectionEntities(snapshot.state).map((row) => [row.id, row])),
    )
    if (generation && generation !== snapshot.generation)
      retiredGenerations.add(generation)
    generation = snapshot.generation
    version = snapshot.version
    await applied
    setStatus(null)
  }
  async function applyCommit(input: WorkspaceCommit) {
    const event = workspaceCommitSchema.parse(input)
    assertScope(event)
    if (disposed || event.generation !== generation || event.version <= version)
      return
    if (event.version !== version + 1)
      throw new Error('Workspace stream has a gap. Reconnecting.')
    const next = event.reset
      ? new Map<string, WorkspaceEntity>()
      : new Map(canonical)
    for (const change of event.changes) {
      if (!change.key.startsWith(`${change.type}:`))
        throw new Error('Invalid workspace entity.')
      if (change.headers.operation === 'delete') next.delete(change.key)
      else {
        if (!change.value) throw new Error('Invalid workspace change.')
        next.set(change.key, {
          id: change.key,
          type: change.type,
          value: change.value,
        })
      }
    }
    const applied = publish(next)
    version = event.version
    await applied
    setStatus(null)
  }
  function read(): WorkspaceProjection {
    const state: WorkspaceProjection = {
      workspaceId,
      userId,
      bots: [],
      sections: [],
      activity: {},
    }
    for (const row of entities.values()) {
      if (row.type === 'bot')
        state.bots.push(row.value as unknown as WorkspaceBot)
      else if (row.type === 'section')
        state.sections.push(
          row.value as unknown as WorkspaceProjection['sections'][number],
        )
      else {
        const { id, ...value } = row.value
        state.activity[id as string] = value as BotActivity
      }
    }
    return state
  }
  async function follow(
    controller: AbortController,
    first: { resolve: () => void; reject: (error: unknown) => void },
  ) {
    let retry = 0
    while (!controller.signal.aborted && !disposed) {
      try {
        const snapshot = (await request(
          'workspace-sync/snapshot',
          undefined,
          'GET',
          { signal: controller.signal },
        )) as WorkspaceSyncSnapshot
        controller.signal.throwIfAborted()
        await applySnapshot(snapshot)
        first.resolve()
        retry = 0
        const url = new URL(
          streamUrl,
          globalThis.location?.origin ?? 'http://localhost',
        )
        url.searchParams.set('generation', snapshot.generation)
        const stream = new DurableStream({
          url: url.href,
          contentType: 'application/json',
        })
        const response = await stream.stream<WorkspaceCommit>({
          offset: snapshot.offset,
          live: 'long-poll',
          json: true,
          signal: controller.signal,
        })
        const unsubscribe = response.subscribeJson(async (batch) => {
          controller.signal.throwIfAborted()
          for (const event of batch.items) await applyCommit(event)
        })
        try {
          await response.closed
        } finally {
          unsubscribe()
        }
      } catch (error) {
        if (controller.signal.aborted || disposed) {
          first.reject(new DOMException('Aborted', 'AbortError'))
          return
        }
        const httpStatus = Number((error as { status?: number })?.status)
        const failure = [401, 403].includes(httpStatus)
          ? new ApiError('Workspace access changed.', httpStatus)
          : error instanceof Error
            ? error
            : new Error('Workspace sync failed.')
        setStatus(failure)
        first.reject(failure)
        // Authentication failures retire private data and stop automatic reconnect.
        if (
          [401, 403].includes(Number((error as { status?: number })?.status))
        ) {
          await publish(new Map())
          return
        }
        retry++
      }
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer)
          controller.signal.removeEventListener('abort', finish)
          resolve()
        }
        const timer = setTimeout(
          finish,
          Math.min(30_000, 500 * 2 ** Math.min(retry, 6)),
        )
        controller.signal.addEventListener('abort', finish, { once: true })
      })
    }
  }
  function refresh(): Promise<void> {
    if (disposed) return Promise.resolve()
    connection?.abort()
    connection = new AbortController()
    return new Promise<void>((resolve, reject) => {
      void follow(connection!, { resolve, reject }).catch(reject)
    })
  }
  const undoStack: WorkspaceHistoryChange[] = []
  const redoStack: WorkspaceHistoryChange[] = []
  let historyBusy = false
  let pendingWrites = 0
  const mutate: Request = async (
    path,
    body,
    method = body === undefined ? 'GET' : 'POST',
    options,
  ) => {
    if (!isWorkspaceMutation(path, method))
      return request(path, body, method, options)
    if (disposed) throw new Error('This workspace is no longer open.')
    if (historyBusy && path !== 'workspace-history')
      throw new Error('Wait for undo or redo to finish, then try again.')
    const before = read()
    const predicted = optimisticWorkspaceIndex(before, path, body, method)
    const old = new Map(projectionEntities(before).map((row) => [row.id, row]))
    const next = new Map(
      projectionEntities({ ...predicted, activity: before.activity }).map(
        (row) => [row.id, row],
      ),
    )
    let result: unknown
    const persist = async () => {
      if (disposed) throw new Error('This workspace is no longer open.')
      result = await request(path, body, method, options)
      const snapshot = (result as { sync?: WorkspaceSyncSnapshot }).sync
      if (!snapshot) {
        if (!(result as { syncPending?: boolean }).syncPending)
          throw new Error(
            'The change was saved, but its sync receipt is missing. Reconnect to check its state.',
          )
        // Keep the optimistic edit pending while a confirmed save catches up.
        // This retries reads only, never the command.
        while (!disposed) {
          try {
            await refresh()
            return
          } catch (error) {
            if (
              [401, 403].includes(
                Number((error as { status?: number })?.status),
              )
            )
              throw error
            await new Promise((resolve) => setTimeout(resolve, 1000))
          }
        }
        return
      }
      if (!disposed) await applySnapshot(snapshot, false)
    }
    const transaction = db.createTransaction({
      autoCommit: false,
      mutationFn: persist,
    })
    transaction.mutate(() => {
      for (const row of next.values()) {
        const previous = old.get(row.id)
        if (!previous) entities.insert(row)
        else if (JSON.stringify(previous.value) !== JSON.stringify(row.value))
          entities.update(row.id, (draft) => {
            draft.value = row.value
          })
      }
      for (const row of old.values())
        if (!next.has(row.id)) entities.delete(row.id)
    })
    const pending = writes.then(async () => {
      if (transaction.state === 'failed')
        throw new Error(
          'An earlier related change failed. Check the current state and try again.',
        )
      if (!transaction.mutations.length) await persist()
      await transaction.commit()
    })
    writes = pending.catch(() => {})
    pendingWrites++
    try {
      await pending
      if (path !== 'workspace-history') {
        // Only record saved placement and archive changes, never message content.
        const eligible =
          path === 'bots/bulk' ||
          path === 'bots/move' ||
          /^bots\/[^/]+\/(move|organization)$/.test(path) ||
          (method === 'PATCH' &&
            /^bots\/[^/]+$/.test(path) &&
            !!body &&
            typeof body === 'object' &&
            'archived' in body)
        const receipt = result as {
          index?: WorkspaceIndex
          sync?: WorkspaceSyncSnapshot
        }
        const after = receipt.index ?? receipt.sync?.state
        if (eligible && after) {
          const change = historyChange(before, predicted)
          const divergence = historyChange(predicted, after)
          const overlaps =
            divergence.bots.some((d) =>
              change.bots.some((c) => c.after.id === d.after.id),
            ) ||
            divergence.sections.some((d) =>
              change.sections.some(
                (c) =>
                  (c.after?.id ?? c.before?.id) ===
                  (d.after?.id ?? d.before?.id),
              ),
            )
          if (overlaps) {
            undoStack.length = 0
            redoStack.length = 0
            return result
          }
          if (change.bots.length || change.sections.length) {
            undoStack.push(change)
            if (undoStack.length > 50) undoStack.shift()
            redoStack.length = 0
          }
        } else {
          // Untracked mutations form a boundary, rather than replaying past them.
          undoStack.length = 0
          redoStack.length = 0
        }
      }
      return result
    } catch (error) {
      // Never repeat a command whose response may have been lost. Read authority.
      void writes.then(() => refresh()).catch(() => {})
      undoStack.length = 0
      redoStack.length = 0
      throw error
    } finally {
      pendingWrites--
    }
  }
  async function travel(redo: boolean) {
    if (historyBusy || pendingWrites) return
    const source = redo ? redoStack : undoStack
    const target = redo ? undoStack : redoStack
    const change = source.at(-1)
    if (!change) return
    historyBusy = true
    try {
      await mutate(
        'workspace-history',
        redo ? change : reverseHistory(change),
        'POST',
      )
      source.pop()
      target.push(change)
    } finally {
      historyBusy = false
    }
  }
  return {
    canUndo: () => !historyBusy && !pendingWrites && undoStack.length > 0,
    canRedo: () => !historyBusy && !pendingWrites && redoStack.length > 0,
    undo: () => travel(false),
    redo: () => travel(true),
    db,
    entities,
    read,
    request: mutate,
    refresh,
    applySnapshot,
    applyCommit,
    getStatus: () => status,
    subscribeStatus: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    retain(releaseQueries?: () => Promise<unknown>) {
      if (owners++ === 0) void refresh().catch(() => {})
      let released = false
      return () => {
        if (released) return
        released = true
        owners--
        queueMicrotask(() => {
          if (owners || disposed) return
          disposed = true
          connection?.abort()
          void Promise.resolve(releaseQueries?.()).then(() => db.cleanup())
        })
      }
    },
  }
}
