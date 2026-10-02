import type { WorkspaceBot } from './bot-workspace'

export interface BotGroupMoveInput {
  bots: Array<{ id: string; version: number }>
  parentId: string | null
  sectionId: string | null
  pinned: boolean
  position: number
  layout: string
}

const active = (bot: WorkspaceBot) =>
  bot.archived_at === null && bot.deleted_at === null
const order = (a: WorkspaceBot, b: WorkspaceBot) =>
  a.position - b.position ||
  a.created_at - b.created_at ||
  a.id.localeCompare(b.id)
const sameGroup = (a: WorkspaceBot, b: WorkspaceBot) =>
  a.parent_id === b.parent_id &&
  a.pinned === b.pinned &&
  (a.pinned || a.section_id === b.section_id)

/** Selecting both an ancestor and a child moves their subtree just once. */
export function selectedBotRoots(bots: WorkspaceBot[], ids: readonly string[]) {
  const byId = new Map(bots.map((bot) => [bot.id, bot]))
  const selected = new Set(ids)
  return ids
    .filter((id) => {
      const bot = byId.get(id)
      if (!bot || !active(bot))
        throw new Error('A selected conversation is no longer active.')
      const visited = new Set([id])
      let parentId = bot.parent_id
      while (parentId) {
        if (visited.has(parentId))
          throw new Error('The conversation hierarchy is invalid.')
        if (selected.has(parentId)) return false
        visited.add(parentId)
        parentId = byId.get(parentId)?.parent_id ?? null
      }
      return true
    })
    .map((id) => byId.get(id)!)
}

/** Shared placement rules for optimistic UI and the guarded database batch. */
export function moveBotGroup(
  bots: WorkspaceBot[],
  input: BotGroupMoveInput,
  now: number,
): WorkspaceBot[] {
  for (const selected of input.bots) {
    const bot = bots.find((bot) => bot.id === selected.id)
    if (!bot || bot.version !== selected.version)
      throw new Error('A selected conversation changed. Refresh and try again.')
  }
  const roots = selectedBotRoots(
    bots,
    input.bots.map((bot) => bot.id),
  )
  if (!roots.length) throw new Error('Select at least one active conversation.')
  const moving = new Set(roots.map((bot) => bot.id))
  if (input.parentId) {
    let parent = bots.find((bot) => bot.id === input.parentId)
    if (!parent || !active(parent))
      throw new Error('Choose an active parent conversation.')
    const visited = new Set<string>()
    while (parent) {
      if (moving.has(parent.id) || visited.has(parent.id))
        throw new Error(
          'A conversation cannot be nested under itself or its children.',
        )
      visited.add(parent.id)
      parent = bots.find((bot) => bot.id === parent!.parent_id)
    }
  }
  const updates = new Map<string, WorkspaceBot>()
  const carried = bots.filter((bot) => {
    if (!active(bot) || moving.has(bot.id)) return false
    let parentId = bot.parent_id
    const visited = new Set<string>()
    while (parentId && !visited.has(parentId)) {
      if (moving.has(parentId)) return true
      visited.add(parentId)
      parentId =
        bots.find((parent) => parent.id === parentId)?.parent_id ?? null
    }
    return false
  })
  const carriedIds = new Set(carried.map((bot) => bot.id))
  const remaining = bots.filter(
    (bot) => !moving.has(bot.id) && !carriedIds.has(bot.id),
  )
  // Keep the visible subtree together, without changing its parent relationships.
  for (const bot of carried)
    updates.set(bot.id, {
      ...bot,
      section_id: input.sectionId,
      pinned: input.pinned,
    })
  for (const parentId of new Set(carried.map((bot) => bot.parent_id)))
    carried
      .filter((bot) => bot.parent_id === parentId)
      .sort(order)
      .forEach((bot, position) =>
        updates.set(bot.id, { ...updates.get(bot.id)!, position }),
      )
  // Close gaps in every source group.
  for (const root of [...roots, ...carried])
    remaining
      .filter((bot) => active(bot) && sameGroup(bot, root))
      .sort(order)
      .forEach((bot, position) => {
        if (bot.position !== position) updates.set(bot.id, { ...bot, position })
      })
  const moved = roots.map((bot) => ({
    ...bot,
    parent_id: input.parentId,
    section_id: input.sectionId,
    pinned: input.pinned,
    version: bot.version + 1,
    updated_at: now,
  }))
  const peers = remaining
    .filter((bot) => active(bot) && sameGroup(bot, moved[0]))
    .sort(order)
  peers.splice(Math.min(input.position, peers.length), 0, ...moved)
  peers.forEach((bot, position) => updates.set(bot.id, { ...bot, position }))
  return bots.map((bot) => updates.get(bot.id) ?? bot)
}
