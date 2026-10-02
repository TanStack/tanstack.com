import { z } from 'zod'
import type { WorkspaceIndex } from './workspace-index'
const id = z.string().min(1).max(200)
const placement = z
  .object({
    id,
    parent_id: id.nullable(),
    section_id: id.nullable(),
    pinned: z.boolean(),
    position: z.number().finite().min(-1e12).max(1e12),
    archived: z.boolean(),
  })
  .strict()
const section = z
  .object({
    id,
    name: z.string().trim().min(1).max(60),
    position: z.number().finite(),
    sort_override: z
      .enum(['position', 'name', 'created', 'activity', 'unread'])
      .nullable(),
  })
  .strict()
export const workspaceHistorySchema = z
  .object({
    bots: z.array(z.object({ before: placement, after: placement })).max(1000),
    sections: z
      .array(
        z.object({ before: section.nullable(), after: section.nullable() }),
      )
      .max(1000),
  })
  .strict()
export type WorkspaceHistoryChange = z.infer<typeof workspaceHistorySchema>
export function historyChange(
  before: WorkspaceIndex,
  after: WorkspaceIndex,
): WorkspaceHistoryChange {
  const pick = (b: WorkspaceIndex['bots'][number]) => ({
    id: b.id,
    parent_id: b.parent_id,
    section_id: b.section_id,
    pinned: b.pinned,
    position: b.position,
    archived: b.archived_at !== null,
  })
  const pickSection = (s: WorkspaceIndex['sections'][number]) => ({
    id: s.id,
    name: s.name,
    position: s.position,
    sort_override: s.sort_override ?? null,
  })
  return {
    bots: before.bots.flatMap((b) => {
      const a = after.bots.find((a) => a.id === b.id)
      if (!a || b.deleted_at !== null || a.deleted_at !== null) return []
      const old = pick(b),
        next = pick(a)
      return JSON.stringify(old) === JSON.stringify(next)
        ? []
        : [{ before: old, after: next }]
    }),
    sections: [
      ...new Set([...before.sections, ...after.sections].map((s) => s.id)),
    ].flatMap((id) => {
      const b = before.sections.find((s) => s.id === id),
        a = after.sections.find((s) => s.id === id)
      const old = b ? pickSection(b) : null,
        next = a ? pickSection(a) : null
      return JSON.stringify(old) === JSON.stringify(next)
        ? []
        : [{ before: old, after: next }]
    }),
  }
}
export function reverseHistory(
  change: WorkspaceHistoryChange,
): WorkspaceHistoryChange {
  return {
    bots: change.bots.map(({ before, after }) => ({
      before: after,
      after: before,
    })),
    sections: change.sections.map(({ before, after }) => ({
      before: after,
      after: before,
    })),
  }
}
