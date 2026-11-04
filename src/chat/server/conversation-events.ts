import { EventType } from '@ag-ui/core'
import type { StreamChunk, UIMessage } from '@tanstack/ai'

export interface ProjectableConversation {
  identity?: { conversationId?: string }
  messages: UIMessage[]
  status: string
  activeRun: string | null
  archivedTurns?: number
  error?: string
}

// AG-UI carries the transcript; application state carries approvals, usage and
// routing progress. Both are committed at the same stream cursor.
export function conversationEvents(
  previous: ProjectableConversation | undefined,
  next: ProjectableConversation,
  threadId: string,
): StreamChunk[] {
  const events: StreamChunk[] = []
  const runId = next.activeRun ?? previous?.activeRun ?? 'session'
  if (
    next.status === 'running' &&
    (previous?.status !== 'running' || previous.activeRun !== next.activeRun)
  ) {
    events.push({ type: EventType.RUN_STARTED, threadId, runId })
  }
  const nextById = new Map(
    next.messages.map((message) => [message.id, message]),
  )
  const reset =
    !previous ||
    previous.messages.some((m) => {
      const message = nextById.get(m.id)
      // Replace authoritative metadata atomically so removed fields cannot remain
      // on an existing message, without clearing and replaying the transcript.
      return (
        (!message &&
          (next.archivedTurns ?? 0) <= (previous.archivedTurns ?? 0)) ||
        (message &&
          JSON.stringify(m.metadata) !== JSON.stringify(message.metadata))
      )
    })
  if (reset) {
    // The native processor preserves UI parts and timestamps in snapshots.
    events.push({
      type: EventType.MESSAGES_SNAPSHOT,
      rawEvent: {
        retainedHistoryBefore:
          (next.archivedTurns ?? 0) > 0 ? next.messages[0]?.id : undefined,
      },
      messages: next.messages.map((message) => ({
        ...message,
        metadata: message.metadata ?? {},
        content: message.parts
          .flatMap((part) => (part.type === 'text' ? [part.content] : []))
          .join(''),
      })),
    })
  }
  const before = new Map((reset ? [] : previous.messages).map((m) => [m.id, m]))
  for (const message of reset ? [] : next.messages) {
    const old = before.get(message.id)
    let textChanged = false
    if (!old)
      events.push({
        type: EventType.TEXT_MESSAGE_START,
        messageId: message.id,
        role: message.role,
        ...(message.metadata ? { metadata: message.metadata } : {}),
      })
    for (const [index, part] of message.parts.entries()) {
      if (part.type === 'text') {
        const oldPart = old?.parts[index]
        const oldText = oldPart?.type === 'text' ? oldPart.content : ''
        if (part.content !== oldText && part.content.startsWith(oldText)) {
          // Keep text after the tool events that precede it. A new segment
          // explicitly resets the processor's text accumulator after tools.
          if (!oldText)
            events.push({
              type: EventType.TEXT_MESSAGE_START,
              messageId: message.id,
              role: message.role,
            })
          events.push({
            type: EventType.TEXT_MESSAGE_CONTENT,
            messageId: message.id,
            delta: part.content.slice(oldText.length),
          })
          textChanged = true
        }
      } else if (part.type === 'tool-call') {
        const oldPart = old?.parts.find(
          (p) => p.type === 'tool-call' && p.id === part.id,
        )
        if (!oldPart)
          events.push({
            type: EventType.TOOL_CALL_START,
            toolCallId: part.id,
            toolCallName: part.name,
            parentMessageId: message.id,
          })
        const args =
          part.arguments ||
          (part.input !== undefined ? JSON.stringify(part.input) : '')
        const oldArgs =
          oldPart?.type === 'tool-call'
            ? oldPart.arguments ||
              (oldPart.input !== undefined ? JSON.stringify(oldPart.input) : '')
            : ''
        if (args && args.startsWith(oldArgs) && args !== oldArgs)
          events.push({
            type: EventType.TOOL_CALL_ARGS,
            toolCallId: part.id,
            delta: args.slice(oldArgs.length),
          })
        if (
          part.state !== 'input-streaming' &&
          (!oldPart ||
            (oldPart.type === 'tool-call' &&
              oldPart.state === 'input-streaming'))
        )
          events.push({
            type: EventType.TOOL_CALL_END,
            toolCallId: part.id,
            input: part.input,
          })
        if (
          part.output !== undefined &&
          (!oldPart ||
            (oldPart.type === 'tool-call' &&
              JSON.stringify(oldPart.output) !== JSON.stringify(part.output)))
        )
          events.push({
            type: EventType.TOOL_CALL_RESULT,
            messageId: `${part.id}-result`,
            toolCallId: part.id,
            content:
              typeof part.output === 'string'
                ? part.output
                : JSON.stringify(part.output),
            role: 'tool',
          })
      } else if (part.type === 'tool-result') {
        const oldPart = old?.parts.find(
          (p) => p.type === 'tool-result' && p.toolCallId === part.toolCallId,
        )
        if (JSON.stringify(oldPart) !== JSON.stringify(part))
          events.push({
            type: EventType.TOOL_CALL_RESULT,
            messageId: message.id,
            toolCallId: part.toolCallId,
            content:
              typeof part.content === 'string'
                ? part.content
                : JSON.stringify(part.content),
            role: 'tool',
          })
      }
    }
    if (
      next.status !== 'running' &&
      (textChanged || previous?.status === 'running' || !old)
    )
      events.push({ type: EventType.TEXT_MESSAGE_END, messageId: message.id })
  }
  const { messages, ...metadata } = next
  events.push({
    type: EventType.STATE_SNAPSHOT,
    snapshot: {
      ...metadata,
      toolStates: Object.fromEntries(
        messages.flatMap((m) =>
          m.parts.flatMap((p) =>
            p.type === 'tool-call' ? [[p.id, p.state]] : [],
          ),
        ),
      ),
    },
  })
  if (previous?.status === 'running' && next.status !== 'running') {
    // Error events need an existing assistant anchor after a snapshot clears
    // transient processor state. No text is replayed into that message.
    if (next.status === 'error') {
      const assistant = [...next.messages]
        .reverse()
        .find((message) => message.role === 'assistant')
      if (assistant)
        events.push({
          type: EventType.TEXT_MESSAGE_START,
          messageId: assistant.id,
          role: assistant.role,
        })
    }
    events.push(
      next.status === 'error'
        ? {
            type: EventType.RUN_ERROR,
            message: next.error ?? 'The run was interrupted.',
          }
        : { type: EventType.RUN_FINISHED, threadId, runId },
    )
  }
  return events
}
