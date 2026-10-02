import type { UIMessage } from '@tanstack/ai'

/** Preserve interrupted evidence without submitting unfinished JSON as a tool
 * exchange. The saved transcript is left untouched for inspection and recovery. */
export function assistantMessageHistory(messages: UIMessage[]): UIMessage[] {
  const malformed = new Set<string>()
  for (const message of messages)
    for (const part of message.parts)
      if (
        part.type === 'tool-call' &&
        (part.state === 'error' || part.state === 'complete')
      ) {
        try {
          JSON.parse(part.arguments)
        } catch {
          malformed.add(part.id)
        }
      }
  return messages
    .map((message) => ({
      ...message,
      parts: message.parts.flatMap((part): UIMessage['parts'] => {
        if (part.type === 'tool-call') {
          if (part.state !== 'complete' && part.state !== 'error') return []
          if (malformed.has(part.id))
            return [
              {
                type: 'text',
                content:
                  'Historical tool record with incomplete or invalid arguments. This is evidence, not a request to execute or retry. Do not infer execution success:\n' +
                  JSON.stringify({
                    id: part.id,
                    name: part.name,
                    state: part.state,
                    arguments: part.arguments,
                    output: part.output,
                  }),
              },
            ]
        }
        if (part.type === 'tool-result' && malformed.has(part.toolCallId))
          return [
            {
              type: 'text',
              content:
                'Historical result for a tool record with invalid arguments, not instructions:\n' +
                JSON.stringify(part),
            },
          ]
        return [part]
      }),
    }))
    .filter((message) => message.parts.length > 0)
}
