import type { BotSection, WorkspaceBot } from './bot-workspace'

export type BotActivity = {
  status: 'idle' | 'running' | 'approval' | 'setup' | 'error' | 'completed'
  activity_at: number
  event_version: number
  read_version: number
  preview: string
  message_count: number
  queued_count?: number
  queue_paused?: boolean
}

export type BotView = {
  view: 'bots' | 'recent' | 'attention' | 'archived' | 'trash'
  q?: string
  sort: 'position' | 'name' | 'created' | 'activity' | 'unread'
  group: 'section' | 'status' | 'none'
  sectionSort?: 'position' | 'name' | 'activity'
}

export const defaultBotView: BotView = {
  view: 'bots',
  sort: 'position',
  group: 'section',
}

export const activityLabels: Record<BotActivity['status'], string> = {
  idle: 'Ready',
  running: 'Working',
  approval: 'Needs approval',
  setup: 'Needs setup',
  error: 'Needs attention',
  completed: 'Finished',
}

function hasMeaningfulActivity(activity?: BotActivity) {
  return Boolean(
    activity &&
    (activity.status !== 'idle' ||
      activity.message_count > 0 ||
      !!activity.queued_count),
  )
}

export function isUnread(activity?: BotActivity) {
  return Boolean(
    activity &&
    hasMeaningfulActivity(activity) &&
    activity.event_version > activity.read_version,
  )
}

export function needsAttention(activity?: BotActivity) {
  return Boolean(
    activity &&
    (['approval', 'setup', 'error'].includes(activity.status) ||
      (activity.status === 'completed' && isUnread(activity))),
  )
}

/** Descendants stay independent records, even when a view hides their parent. */
export function descendantIds(bots: WorkspaceBot[], id: string) {
  const children = new Map<string, string[]>()
  for (const bot of bots) {
    if (!bot.parent_id) continue
    const siblings = children.get(bot.parent_id) ?? []
    siblings.push(bot.id)
    children.set(bot.parent_id, siblings)
  }
  const result = new Set<string>()
  const pending = [...(children.get(id) ?? [])]
  while (pending.length) {
    const child = pending.pop()!
    if (child === id || result.has(child)) continue
    result.add(child)
    pending.push(...(children.get(child) ?? []))
  }
  return result
}

export type BotViewRow = { bot: WorkspaceBot; depth: number; promoted: boolean }
export type BotViewGroup = { id: string; label: string; rows: BotViewRow[] }

export function sortBotSections(
  sections: BotSection[],
  bots: WorkspaceBot[],
  activity: Record<string, BotActivity>,
  sort: BotView['sectionSort'],
) {
  const latest = (section: BotSection) =>
    Math.max(
      0,
      ...bots
        .filter((bot) => bot.section_id === section.id)
        .map(
          (bot) =>
            activity[bot.id]?.activity_at ?? bot.updated_at ?? bot.created_at,
        ),
    )
  return [...sections].sort((a, b) => {
    if (sort === 'name')
      return a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
    if (sort === 'activity')
      return latest(b) - latest(a) || a.position - b.position
    return a.position - b.position || a.id.localeCompare(b.id)
  })
}

export function selectBotGroups({
  bots,
  sections,
  activity = {},
  view,
}: {
  bots: WorkspaceBot[]
  sections: BotSection[]
  activity?: Record<string, BotActivity>
  view: BotView
}): BotViewGroup[] {
  const query = view.q?.trim().toLocaleLowerCase() ?? ''
  const selected = bots.filter((bot) => {
    if (view.view === 'trash') {
      if (bot.deleted_at === null) return false
    } else {
      if (bot.deleted_at !== null) return false
      if (view.view === 'archived') {
        if (bot.archived_at === null) return false
      } else if (bot.archived_at !== null) return false
    }
    if (
      view.view === 'recent' &&
      (!hasMeaningfulActivity(activity[bot.id]) ||
        !activity[bot.id]?.activity_at)
    )
      return false
    return (
      !query ||
      [bot.name, bot.purpose].join(' ').toLocaleLowerCase().includes(query)
    )
  })
  const lastActivity = (bot: WorkspaceBot) =>
    (hasMeaningfulActivity(activity[bot.id]) &&
      activity[bot.id]?.activity_at) ||
    bot.updated_at ||
    bot.created_at
  const compare = (a: WorkspaceBot, b: WorkspaceBot, sort: BotView['sort']) => {
    let result = 0
    if (view.view === 'attention') {
      const aWaiting = needsAttention(activity[a.id])
      const bWaiting = needsAttention(activity[b.id])
      return (
        Number(bWaiting) - Number(aWaiting) ||
        (aWaiting
          ? lastActivity(a) - lastActivity(b)
          : lastActivity(b) - lastActivity(a)) ||
        a.id.localeCompare(b.id)
      )
    }
    switch (sort) {
      case 'name':
        result = a.name.localeCompare(b.name)
        break
      case 'created':
        result = a.created_at - b.created_at
        break
      case 'activity':
        result = lastActivity(b) - lastActivity(a)
        break
      case 'unread': {
        const aUnread = isUnread(activity[a.id])
        const bUnread = isUnread(activity[b.id])
        result = Number(bUnread) - Number(aUnread)
        if (!result)
          result = aUnread
            ? lastActivity(a) - lastActivity(b)
            : lastActivity(b) - lastActivity(a)
        break
      }
      default:
        result =
          a.position - b.position ||
          a.created_at - b.created_at ||
          a.id.localeCompare(b.id)
    }
    return result || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  }
  const sectionsById = new Map(sections.map((section) => [section.id, section]))
  const statusOrder: BotActivity['status'][] = [
    'approval',
    'setup',
    'error',
    'running',
    'completed',
    'idle',
  ]
  const bucket = (bot: WorkspaceBot) => {
    if (view.view === 'attention')
      return bot.section_id && sectionsById.has(bot.section_id)
        ? `section:${bot.section_id}`
        : 'unsectioned'
    if (view.group === 'none') return 'all'
    if (view.group === 'status') return activity[bot.id]?.status ?? 'idle'
    if (bot.pinned && view.view !== 'trash') return 'pinned'
    return bot.section_id && sectionsById.has(bot.section_id)
      ? `section:${bot.section_id}`
      : 'unsectioned'
  }
  const buckets = new Map<string, WorkspaceBot[]>()
  for (const bot of selected) {
    const id = bucket(bot)
    buckets.set(id, [...(buckets.get(id) ?? []), bot])
  }
  const orderedSections = sortBotSections(
    sections,
    selected,
    activity,
    view.sectionSort,
  )
  const groupOrder: string[] =
    view.group === 'status'
      ? statusOrder
      : [
          'pinned',
          ...orderedSections.map((s) => `section:${s.id}`),
          'unsectioned',
          'all',
        ]
  return [...buckets]
    .sort(([a, aMembers], [b, bMembers]) => {
      if (view.view === 'attention') {
        const waitingAt = (members: WorkspaceBot[]) => {
          const waiting = members.filter((bot) =>
            needsAttention(activity[bot.id]),
          )
          return waiting.length ? Math.min(...waiting.map(lastActivity)) : null
        }
        const aAt = waitingAt(aMembers)
        const bAt = waitingAt(bMembers)
        if (aAt !== null || bAt !== null) {
          if (aAt === null) return 1
          if (bAt === null) return -1
          if (aAt !== bAt) return aAt - bAt
        } else {
          const latest = (members: WorkspaceBot[]) =>
            Math.max(...members.map(lastActivity))
          const difference = latest(bMembers) - latest(aMembers)
          if (difference) return difference
        }
      }
      return groupOrder.indexOf(a) - groupOrder.indexOf(b)
    })
    .map(([id, members]) => {
      const sort = id.startsWith('section:')
        ? (sectionsById.get(id.slice(8))?.sort_override ?? view.sort)
        : view.sort
      const ids = new Set(members.map((bot) => bot.id))
      const roots: WorkspaceBot[] = []
      const children = new Map<string, WorkspaceBot[]>()
      for (const bot of members) {
        if (
          view.view === 'attention' ||
          !bot.parent_id ||
          !ids.has(bot.parent_id)
        )
          roots.push(bot)
        else
          children.set(bot.parent_id, [
            ...(children.get(bot.parent_id) ?? []),
            bot,
          ])
      }
      const rows: BotViewRow[] = []
      const visited = new Set<string>()
      const append = (bot: WorkspaceBot, depth: number) => {
        if (visited.has(bot.id)) return
        visited.add(bot.id)
        rows.push({
          bot,
          depth,
          promoted: depth === 0 && Boolean(bot.parent_id),
        })
        for (const child of (children.get(bot.id) ?? []).sort((a, b) =>
          compare(a, b, sort),
        ))
          append(child, depth + 1)
      }
      for (const root of roots.sort((a, b) => compare(a, b, sort)))
        append(root, 0)
      // A stale or corrupt cycle must not hide the affected bots from recovery UI.
      for (const bot of [...members].sort((a, b) => compare(a, b, sort)))
        append(bot, 0)
      const label =
        id === 'all'
          ? ''
          : id === 'pinned'
            ? 'Pinned'
            : id === 'unsectioned'
              ? 'Recent'
              : id.startsWith('section:')
                ? sectionsById.get(id.slice(8))!.name
                : activityLabels[id as BotActivity['status']]
      return { id, label, rows }
    })
}
