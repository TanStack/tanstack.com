import type { UIMessage } from '@tanstack/ai'
import { readAutomatedRunOrigin } from './conversation-runs'
export type BotActivityStatus =
  | 'idle'
  | 'running'
  | 'approval'
  | 'setup'
  | 'error'
  | 'completed'
export interface BotActivitySummary {
  conversationId?: string
  botId: string
  userId: string
  status: BotActivityStatus
  activityAt: number
  eventVersion: number
  readVersion: number
  preview: string
  messageCount: number
  queuedCount: number
  queuePaused: boolean
}
export interface ActivityIdentity {
  conversationId?: string
  botId: string
  userId: string
  workspaceId: string
}
export interface ActivityProjection {
  identity: ActivityIdentity
  summary: BotActivitySummary
  fingerprint: string
  messageIds: string[]
  messageCount: number
}
export interface ActivityState {
  status: 'idle' | 'running' | 'error'
  messages: UIMessage[]
  approvals: { id: string; status: string }[]
  delegationWait?: string
  pendingTask?: { id: string }
  resumingTask?: { id: string }
  queue?: { items: unknown[]; paused: boolean; error?: string }
}
export function boundedActivityPreview(text: string): string {
  return text
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)
}
export function activityStatus(state: ActivityState): BotActivityStatus {
  if (
    state.status === 'running' ||
    state.approvals.some((a) => a.status === 'running')
  )
    return 'running'
  if (state.approvals.some((a) => a.status === 'pending')) return 'approval'
  if (state.pendingTask || state.resumingTask) return 'setup'
  if (state.delegationWait) return 'running'
  if (state.status === 'error' || state.queue?.error) return 'error'
  return state.messages.some(
    (m) => m.role === 'user' && !m.metadata?.gumInherited,
  )
    ? 'completed'
    : 'idle'
}
/** Only public user text or final assistant text is eligible for a sidebar preview. */
export function projectBotActivity(
  previous: ActivityProjection | undefined,
  identity: ActivityIdentity,
  state: ActivityState,
  now: number,
): ActivityProjection {
  if (
    previous &&
    (previous.identity.botId !== identity.botId ||
      previous.identity.userId !== identity.userId ||
      previous.identity.workspaceId !== identity.workspaceId ||
      (previous.identity.conversationId !== undefined &&
        previous.identity.conversationId !== identity.conversationId))
  )
    throw new Error('Conversation identity cannot change.')
  const status = activityStatus(state)
  const promptIndex = state.messages.reduce(
    (last, m, i) => (m.role === 'user' ? i : last),
    -1,
  )
  const prompt = state.messages[promptIndex]
  const answer =
    status === 'completed'
      ? state.messages
          .slice(promptIndex + 1)
          .filter(
            (m) =>
              m.role === 'assistant' &&
              m.parts.some((p) => p.type === 'text' && p.content.trim()),
          )
          .at(-1)
      : undefined
  const visible = answer ?? prompt
  const preview = boundedActivityPreview(
    visible?.parts
      .filter((p) => p.type === 'text')
      .map((p) => p.content)
      .join(' ') ?? '',
  )
  const fingerprint = JSON.stringify([
    status,
    prompt?.id,
    answer?.id,
    state.approvals
      .filter((a) => a.status === 'pending')
      .map((a) => a.id)
      .sort(),
    state.pendingTask?.id ?? state.resumingTask?.id,
    state.queue?.items.length ?? 0,
    state.queue?.paused ?? false,
  ])
  const oldIds = new Set(previous?.messageIds ?? [])
  const messageCount =
    (previous?.messageCount ?? 0) +
    state.messages.filter(
      (m) =>
        !oldIds.has(m.id) && !(m.role === 'user' && readAutomatedRunOrigin(m)),
    ).length
  const changed = !previous || previous.fingerprint !== fingerprint
  return {
    identity,
    fingerprint,
    messageIds: state.messages.map((m) => m.id),
    messageCount,
    summary: changed
      ? {
          ...(identity.conversationId
            ? { conversationId: identity.conversationId }
            : {}),
          botId: identity.botId,
          userId: identity.userId,
          status,
          activityAt: Math.max(now, previous?.summary.activityAt ?? 0),
          eventVersion: (previous?.summary.eventVersion ?? 0) + 1,
          readVersion: previous?.summary.readVersion ?? 0,
          preview,
          messageCount,
          queuedCount: state.queue?.items.length ?? 0,
          queuePaused: state.queue?.paused ?? false,
        }
      : {
          ...previous.summary,
          ...(identity.conversationId
            ? { conversationId: identity.conversationId }
            : {}),
        },
  }
}
export function nextReadVersion(
  current: number,
  event: number,
  requested: number,
) {
  return Math.max(
    current,
    Math.min(
      event,
      Number.isSafeInteger(requested) && requested >= 0 ? requested : 0,
    ),
  )
}
