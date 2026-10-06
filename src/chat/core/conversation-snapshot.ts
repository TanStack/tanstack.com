import type { StreamChunk, UIMessage } from '@tanstack/ai'

// The server window omits archived turns, but an open transcript keeps them.
// A reset has no boundary and still replaces the entire displayed history.
export function retainArchivedMessages(
  chunk: StreamChunk,
  displayed: UIMessage[],
): StreamChunk {
  if (chunk.type !== 'MESSAGES_SNAPSHOT') return chunk
  const boundary = chunk.rawEvent?.retainedHistoryBefore
  if (typeof boundary !== 'string') return chunk
  const index = displayed.findIndex((message) => message.id === boundary)
  if (index < 1) return chunk
  return {
    ...chunk,
    messages: [
      ...displayed.slice(0, index).map((message) => ({
        ...message,
        content: message.parts
          .flatMap((part) => (part.type === 'text' ? [part.content] : []))
          .join(''),
      })),
      ...chunk.messages,
    ],
  }
}
