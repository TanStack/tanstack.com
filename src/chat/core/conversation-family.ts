import type { WorkspaceBot } from './bot-workspace'

/** Navigation stays in the same accessible family when the selected chat changes. */
export function conversationFamily(
  selected: WorkspaceBot,
  bots: WorkspaceBot[],
) {
  const available = bots.filter(
    (bot) =>
      bot.workspace_id === selected.workspace_id &&
      !bot.archived_at &&
      !bot.deleted_at,
  )
  const byId = new Map(available.map((bot) => [bot.id, bot]))
  const ancestors = new Set([selected.id])
  let root = selected
  while (root.parent_id) {
    const parent = byId.get(root.parent_id)
    if (!parent || ancestors.has(parent.id)) break
    ancestors.add(parent.id)
    root = parent
  }
  const members: { bot: WorkspaceBot; depth: number }[] = []
  const visited = new Set([root.id])
  const visit = (parentId: string, depth: number) => {
    for (const bot of available
      .filter((bot) => bot.parent_id === parentId)
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))) {
      if (visited.has(bot.id)) continue
      visited.add(bot.id)
      members.push({ bot, depth })
      visit(bot.id, depth + 1)
    }
  }
  visit(root.id, 0)
  return { root, members }
}

/** Filter authorized rows, keeping ancestors of matching names. */
export function filterConversationNames(bots: WorkspaceBot[], query: string) {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return bots
  const byId = new Map(bots.map((bot) => [bot.id, bot]))
  const retained = new Set<string>()
  for (const bot of bots) {
    if (!bot.name.toLocaleLowerCase().includes(needle)) continue
    let current: WorkspaceBot | undefined = bot
    const visited = new Set<string>()
    while (current && !visited.has(current.id)) {
      visited.add(current.id)
      retained.add(current.id)
      current = current.parent_id ? byId.get(current.parent_id) : undefined
    }
  }
  return bots.filter((bot) => retained.has(bot.id))
}
