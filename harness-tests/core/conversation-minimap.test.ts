import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import type { TranscriptNavigationPage } from '../../src/chat/core/transcript-navigation'
import { conversationDestination } from '../../src/chat/core/conversation-destination'
const query = vi.hoisted(() => ({
  data: undefined as TranscriptNavigationPage | undefined,
  error: null as Error | null,
  isPending: false,
  isFetching: false,
  refetch: vi.fn(),
}))
vi.mock('@tanstack/react-query', () => ({ useQuery: () => query }))
// Render the popup contents without relying on a browser's positioning APIs.
vi.mock('@base-ui/react/popover', () => {
  const Container = ({ children }: { children: ReactNode }) => children
  return {
    Popover: {
      Root: Container,
      Portal: Container,
      Positioner: Container,
      Popup: Container,
      Title: Container,
      Trigger: ({ render }: { render: ReactNode }) => render,
    },
  }
})
import { ConversationMinimap } from '../../src/chat/components/ConversationMinimap'
const destination = conversationDestination(
  {
    userId: 'owner',
    workspaceId: 'private',
    botId: 'bot',
    mainConversationId: 'conversation',
  },
  {
    userId: 'owner',
    workspaceId: 'private',
    botId: 'bot',
    conversationId: 'conversation',
  },
)
const live = [
  {
    id: 'live',
    messageIds: ['live'],
    rowIndex: 0,
    prompt: 'Latest request',
    preview: 'Latest answer',
  },
]
const page: TranscriptNavigationPage = {
  epoch: 'epoch',
  total: 5,
  startIndex: 3,
  nextBefore: 4,
  items: [
    {
      id: 'old-4',
      sequence: 4,
      prompt: 'Earlier request',
      preview: 'Earlier answer',
    },
    {
      id: 'old-5',
      sequence: 5,
      prompt: 'Last archived request',
      preview: 'Last archived answer',
    },
  ],
}
beforeEach(() => {
  query.data = page
  query.error = null
  query.isPending = false
  query.isFetching = false
})
function render() {
  return renderToStaticMarkup(
    createElement(ConversationMinimap, {
      items: live,
      archive: { destination, count: 5, epoch: 'epoch' },
      activeRow: 0,
      onSelect: () => {},
    }),
  )
}
it('shows ordered archived and live previews with a current-location marker and named paging controls', () => {
  const html = render()
  expect(html.indexOf('Earlier request')).toBeLessThan(
    html.indexOf('Last archived request'),
  )
  expect(html.indexOf('Last archived request')).toBeLessThan(
    html.indexOf('Latest request'),
  )
  expect(html).toContain('Earlier answer')
  expect(html).toContain('aria-current="location"')
  expect(html).toContain('aria-label="Older messages"')
  expect(html).toContain('aria-label="Newer messages"')
})
it('withholds cached archive previews during authorization refresh and after a denied read', () => {
  query.isFetching = true
  expect(render()).not.toContain('Earlier request')
  expect(render()).toContain('Loading earlier messages')
  query.isFetching = false
  query.error = new Error('Conversation not found.')
  const html = render()
  expect(html).not.toContain('Earlier request')
  expect(html).toContain('Conversation not found.')
  expect(html).toContain('Retry')
})
it('does not duplicate a turn while it moves from the live window into the archive', () => {
  query.data = {
    ...page,
    items: [
      ...page.items,
      {
        id: 'live',
        sequence: 6,
        prompt: 'Stale duplicate',
        preview: 'Stale answer',
      },
    ],
  }
  const html = render()
  expect(html).not.toContain('Stale duplicate')
  expect(html.match(/Latest request/g)).toHaveLength(1)
})
