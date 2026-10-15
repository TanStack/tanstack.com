import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { ConversationTurn } from '../../src/chat/components/ConversationTurn'

const copied = vi.hoisted(() => new Map<string, string>())
vi.mock('../../src/chat/components/CopyButton', () => ({
  CopyButton: ({
    label,
    text,
  }: {
    label: string
    text: string | (() => string)
  }) => {
    copied.set(label, typeof text === 'function' ? text() : text)
    return null
  },
}))

it('copies ordered assistant prose across messages and tools without duplicating mixed-message text', () => {
  copied.clear()
  renderToStaticMarkup(
    createElement(ConversationTurn, {
      name: 'Gum',
      running: false,
      waiting: false,
      results: new Map(),
      expanded: {},
      setExpanded: () => {},
      turn: {
        id: 'u',
        responses: [
          {
            id: 'progress',
            role: 'assistant',
            parts: [{ type: 'text', content: 'Checking **sources**.' }],
          },
          {
            id: 'final',
            role: 'assistant',
            parts: [
              { type: 'text', content: 'Found the source.' },
              {
                type: 'tool-call',
                id: 't',
                name: 'read',
                arguments: '{}',
                state: 'complete',
                output: 'Private tool details',
              },
              { type: 'text', content: 'Here is the **answer**.' },
            ],
          },
        ],
      },
    }),
  )
  expect(copied.get('Copy Markdown')).toBe(
    'Checking **sources**.\n\nFound the source.\n\nHere is the **answer**.',
  )
  expect(copied.get('Copy response')).toBe(
    'Checking sources.\n\nFound the source.\n\nHere is the answer.',
  )
})
