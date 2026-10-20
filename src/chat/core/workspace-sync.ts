import { z } from 'zod'
import type { WorkspaceIndex } from './workspace-index'
import type { BotActivity } from './bot-views'

export type WorkspaceProjection = WorkspaceIndex & {
  activity: Record<string, BotActivity>
}
export type WorkspaceSyncSnapshot = {
  protocol: 1
  generation: string
  version: number
  offset: string
  state: WorkspaceProjection
}
export type WorkspaceEntity = {
  id: string
  type: 'bot' | 'section' | 'activity'
  value: Record<string, unknown>
}
export const workspaceCommitSchema = z.object({
  protocol: z.literal(1),
  workspaceId: z.string(),
  userId: z.string(),
  generation: z.string(),
  version: z.number().int().nonnegative(),
  reset: z.boolean(),
  changes: z.array(
    z.object({
      type: z.enum(['bot', 'section', 'activity']),
      key: z.string(),
      headers: z.object({ operation: z.enum(['insert', 'update', 'delete']) }),
      value: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
})
export type WorkspaceCommit = z.infer<typeof workspaceCommitSchema>
export function projectionEntities(
  state: WorkspaceProjection,
): WorkspaceEntity[] {
  return [
    ...state.bots.map((value) => ({
      id: `bot:${value.id}`,
      type: 'bot' as const,
      value: { ...value },
    })),
    ...state.sections.map((value) => ({
      id: `section:${value.id}`,
      type: 'section' as const,
      value: { ...value },
    })),
    ...Object.entries(state.activity).map(([id, value]) => ({
      id: `activity:${id}`,
      type: 'activity' as const,
      value: { ...value, id },
    })),
  ]
}
export function workspaceCommit(
  previous: WorkspaceProjection | undefined,
  state: WorkspaceProjection,
  generation: string,
  version: number,
): WorkspaceCommit {
  const old = new Map(
    previous ? projectionEntities(previous).map((row) => [row.id, row]) : [],
  )
  const next = new Map(projectionEntities(state).map((row) => [row.id, row]))
  const changes: WorkspaceCommit['changes'] = []
  for (const row of next.values()) {
    const before = old.get(row.id)
    if (!before || JSON.stringify(before.value) !== JSON.stringify(row.value))
      changes.push({
        type: row.type,
        key: row.id,
        value: row.value,
        headers: { operation: before ? 'update' : 'insert' },
      })
  }
  for (const row of old.values())
    if (!next.has(row.id))
      changes.push({
        type: row.type,
        key: row.id,
        headers: { operation: 'delete' },
      })
  return {
    protocol: 1,
    workspaceId: state.workspaceId,
    userId: state.userId,
    generation,
    version,
    reset: !previous,
    changes,
  }
}
