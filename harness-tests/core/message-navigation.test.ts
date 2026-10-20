import { describe, expect, it } from 'vitest'
import {
  buildConversationNavigation,
  formatTurnDuration,
  markdownText,
  messageAnchorId,
  turnDurationMs,
  type ConversationGroup,
} from '../../src/chat/core/message-navigation'

const turns: ConversationGroup[] = [
  {
    id: 'user/1',
    prompt: {
      id: 'user/1',
      role: 'user',
      parts: [{ type: 'text', content: '**What changed?**' }],
    },
    responses: [
      {
        id: 'assistant/1',
        role: 'assistant',
        parts: [
          { type: 'text', content: 'Checking now.' },
          {
            type: 'tool-call',
            id: 'tool',
            name: 'search',
            arguments: '{}',
            state: 'complete',
          },
          { type: 'text', content: 'The **release** is ready.' },
        ],
      },
    ],
  },
]

describe('message navigation', () => {
  it('indexes prompt and response IDs but previews only the final answer after tools', () => {
    expect(
      buildConversationNavigation(turns, {
        'user/1': { status: 'done', answerId: 'assistant/1' },
      }),
    ).toEqual([
      {
        id: 'user/1',
        messageIds: ['user/1', 'assistant/1'],
        rowIndex: 0,
        prompt: 'What changed?',
        preview: 'The release is ready.',
      },
    ])
  })

  it('does not label in-progress, failed, or waiting text as a final preview', () => {
    expect(
      buildConversationNavigation(turns, undefined, 'user/1')[0].preview,
    ).toBe('')
    for (const status of ['waiting', 'error'] as const) {
      expect(
        buildConversationNavigation(turns, {
          'user/1': { status, answerId: 'assistant/1' },
        })[0].preview,
      ).toBe('')
    }
  })

  it('uses stable anchors without collisions between encoded and literal IDs', () => {
    expect(messageAnchorId('a/b')).toBe('message-a%2Fb')
    expect(messageAnchorId('a%2Fb')).not.toBe(messageAnchorId('a/b'))
  })

  it('does not promote an unfinished inherited response to a final answer', () => {
    expect(
      buildConversationNavigation(turns, undefined, undefined, {
        'user/1': { partial: true },
      })[0].preview,
    ).toBe('')
  })

  it('copies readable Markdown as text while retaining code, lists, and link destinations', () => {
    expect(
      markdownText(
        '# Result\n\n**Ready** [details](https://example.com)\n\n- First\n- Second\n\n```ts\nconst x = "<tag>"\n```',
        true,
      ),
    ).toBe(
      'Result\n\nReady details (https://example.com)\n\n• First\n• Second\n\nconst x = "<tag>"',
    )
    expect(
      markdownText('| Name | Status |\n| --- | --- |\n| App | Ready |'),
    ).toBe('Name\tStatus\nApp\tReady')
  })

  it('does not guess durations without a valid recorded start and end', () => {
    expect(turnDurationMs()).toBeUndefined()
    expect(turnDurationMs({ completedAt: 20 })).toBeUndefined()
    expect(turnDurationMs({ startedAt: 20 })).toBeUndefined()
    expect(turnDurationMs({ startedAt: 20, completedAt: 10 })).toBeUndefined()
    expect(turnDurationMs({ startedAt: Number.NaN }, 20)).toBeUndefined()
    expect(turnDurationMs({ startedAt: 10, completedAt: 1510 }, 9999)).toBe(
      1500,
    )
    expect(turnDurationMs({ startedAt: 10 }, 1510)).toBe(1500)
    expect(formatTurnDuration(500)).toBe('<1s')
    expect(formatTurnDuration(65_000)).toBe('1m 5s')
  })
})

describe('independent conversation anchors', () => {
  it('keeps identical message IDs distinct in parent, side thread, and archive', () => {
    const ids = [
      messageAnchorId('same', 'parent'),
      messageAnchorId('same', 'thread'),
      messageAnchorId('same', 'thread:archive'),
      messageAnchorId('b-c', 'a'),
      messageAnchorId('c', 'a-b'),
    ]
    expect(new Set(ids).size).toBe(ids.length)
    expect(messageAnchorId('same')).toBe('message-same')
  })
})
