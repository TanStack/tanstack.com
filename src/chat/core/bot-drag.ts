import type { BotSection, WorkspaceBot } from './bot-workspace'
import {
  moveBotGroup,
  selectedBotRoots,
  type BotGroupMoveInput,
} from './bot-group-move'
export type BotDragSource =
  | { kind: 'bot'; id: string; ids?: string[] }
  | { kind: 'section'; id: string }
export type BotDropTarget =
  | { kind: 'bot'; id: string; placement: 'before' | 'inside' | 'after' }
  | { kind: 'section'; id: string; placement: 'before' | 'after' }
  | {
      kind: 'group'
      parentId: string | null
      sectionId: string | null
      pinned: boolean
    }
export interface BotMoveInput {
  version: number
  parentId: string | null
  sectionId: string | null
  pinned: boolean
  position: number
  layout: string
}
export type BotDropPlan = {
  path: string
  method: 'POST' | 'PATCH'
  body: BotMoveInput | BotGroupMoveInput | { version: number; position: number }
  announcement: string
}
export function botDragLayout(bots: WorkspaceBot[]): string {
  return JSON.stringify(
    [...bots]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((b) => [
        b.id,
        b.parent_id,
        b.section_id,
        Number(b.pinned),
        b.position,
        b.version,
        b.archived_at,
        b.deleted_at,
      ]),
  )
}
const active = (bot: WorkspaceBot) =>
  bot.archived_at === null && bot.deleted_at === null
const order = (a: WorkspaceBot, b: WorkspaceBot) =>
  a.position - b.position ||
  a.created_at - b.created_at ||
  a.id.localeCompare(b.id)
export function botDropPlacement(
  pointerY: number,
  top: number,
  height: number,
  allowInside = true,
): 'before' | 'inside' | 'after' {
  const ratio = height > 0 ? (pointerY - top) / height : 0.5
  return ratio < (allowInside ? 0.25 : 0.5)
    ? 'before'
    : ratio > (allowInside ? 0.75 : 0.5)
      ? 'after'
      : allowInside
        ? 'inside'
        : 'after'
}
export function planBotDrop(
  bots: WorkspaceBot[],
  sections: BotSection[],
  source: BotDragSource,
  target: BotDropTarget,
): BotDropPlan | null {
  if (source.kind === 'section') {
    if (target.kind !== 'section' || source.id === target.id) return null
    const section = sections.find((s) => s.id === source.id)
    const ordered = [...sections]
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
      .filter((s) => s.id !== source.id)
    const index = ordered.findIndex((s) => s.id === target.id)
    if (!section || index < 0) return null
    const position = index + (target.placement === 'after' ? 1 : 0)
    if (
      [...sections]
        .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
        .findIndex((s) => s.id === source.id) === position
    )
      return null
    return {
      path: 'sections/' + encodeURIComponent(source.id),
      method: 'PATCH',
      body: { version: section.version, position },
      announcement:
        'Move ' +
        section.name +
        ' ' +
        target.placement +
        ' ' +
        ordered[index].name,
    }
  }
  if (target.kind === 'section') return null
  const moving = bots.find((b) => b.id === source.id)
  if (!moving || !active(moving)) return null
  const ids = source.ids?.includes(source.id) ? source.ids : [source.id]
  let roots: WorkspaceBot[]
  try {
    roots = selectedBotRoots(bots, ids)
  } catch {
    return null
  }
  const movingIds = new Set(roots.map((bot) => bot.id))
  let parentId: string | null,
    sectionId: string | null,
    pinned: boolean,
    anchor: WorkspaceBot | undefined
  if (target.kind === 'group') ({ parentId, sectionId, pinned } = target)
  else {
    anchor = bots.find((b) => b.id === target.id)
    if (!anchor || !active(anchor) || ids.includes(anchor.id)) return null
    parentId = target.placement === 'inside' ? anchor.id : anchor.parent_id
    sectionId = anchor.pinned ? null : anchor.section_id
    pinned = anchor.pinned
  }
  if (sectionId && !sections.some((s) => s.id === sectionId)) return null
  if (parentId) {
    let parent = bots.find((b) => b.id === parentId)
    if (!parent || !active(parent)) return null
    const seen = new Set<string>()
    while (parent) {
      if (movingIds.has(parent.id) || seen.has(parent.id)) return null
      seen.add(parent.id)
      parent = parent.parent_id
        ? bots.find((b) => b.id === parent!.parent_id)
        : undefined
    }
  }
  const peers = bots
    .filter(
      (b) =>
        active(b) &&
        !movingIds.has(b.id) &&
        b.parent_id === parentId &&
        b.pinned === pinned &&
        (pinned || b.section_id === sectionId),
    )
    .sort(order)
  const index =
    anchor && target.kind === 'bot' && target.placement !== 'inside'
      ? peers.findIndex((b) => b.id === anchor!.id)
      : -1
  const position =
    index < 0
      ? peers.length
      : index + (target.kind === 'bot' && target.placement === 'after' ? 1 : 0)
  const groupInput: BotGroupMoveInput = {
    bots: ids.map((id) => ({
      id,
      version: bots.find((bot) => bot.id === id)!.version,
    })),
    parentId,
    sectionId,
    pinned,
    position,
    layout: botDragLayout(bots),
  }
  const projected = moveBotGroup(bots, groupInput, 0)
  if (
    projected.every(
      (bot, i) =>
        bot.parent_id === bots[i].parent_id &&
        bot.pinned === bots[i].pinned &&
        (bot.pinned || bot.section_id === bots[i].section_id) &&
        bot.position === bots[i].position,
    )
  )
    return null
  const destination =
    target.kind === 'bot'
      ? (target.placement === 'inside' ? 'inside ' : target.placement + ' ') +
        anchor!.name
      : parentId
        ? 'inside ' + bots.find((b) => b.id === parentId)!.name
        : pinned
          ? 'to Pinned'
          : sectionId
            ? 'to ' + sections.find((s) => s.id === sectionId)!.name
            : 'to the top level'
  return {
    path:
      ids.length > 1
        ? 'bots/move'
        : 'bots/' + encodeURIComponent(moving.id) + '/move',
    method: 'POST',
    body:
      ids.length > 1
        ? groupInput
        : {
            version: moving.version,
            parentId,
            sectionId,
            pinned,
            position,
            layout: botDragLayout(bots),
          },
    announcement:
      'Move ' +
      (ids.length > 1
        ? `${roots.length} conversations with their children`
        : moving.name) +
      ' ' +
      destination,
  }
}
