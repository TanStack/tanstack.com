import { describe, expect, it } from 'vitest'
import {
  conversationLocation,
  selectedConversationLocation,
} from '../../src/chat/core/conversation-destination'
import { fileViewPath } from '../../src/chat/core/files'
import {
  signInDestination,
  validateWorkspaceSearch,
} from '../../src/chat/core/navigation'

describe('canonical conversation links', () => {
  it('keeps the same destination when workspace or bot changes', () => {
    const search = validateWorkspaceSearch({
      panel: 'usage',
      conversation: 'old',
    })
    const first = conversationLocation(
      { workspaceId: 'one', botId: 'a', conversationId: 'room' },
      search,
    )
    const moved = conversationLocation(
      { workspaceId: 'two', botId: 'b', conversationId: 'room' },
      search,
    )
    expect(first).toEqual(moved)
    expect(first.to).toBe('/chat/c/$conversationId')
    expect(first.params).toEqual({ conversationId: 'room' })
    expect(first.search).not.toHaveProperty('conversation')
    expect(first.search.panel).toBe('usage')
  })

  it('addresses a message within its conversation', () => {
    const result = conversationLocation(
      { workspaceId: 'one', botId: 'a', conversationId: 'room' },
      validateWorkspaceSearch({ message: 'message' }),
    )
    expect(result.to).toBe('/chat/c/$conversationId/m/$messageId')
    expect(result.params).toEqual({
      conversationId: 'room',
      messageId: 'message',
    })
    expect(result.search).not.toHaveProperty('message')
  })

  it('keeps unresolved bot references as bot entry points', () => {
    const result = conversationLocation(
      { workspaceId: 'one', botId: 'a' },
      validateWorkspaceSearch({}),
    )
    expect(result.to).toBe('/chat/b/$botId')
    expect(result.params).toEqual({ botId: 'a' })
  })

  it('encodes file links without leaking workspace or bot identity into the URL', () => {
    expect(fileViewPath('workspace', 'bot', 'file/one', 'room:one')).toBe(
      '/chat/c/room%3Aone?panel=file%3Afile%2Fone',
    )
  })

  it('preserves canonical sign-in return paths and rejects external destinations', () => {
    for (const path of [
      '/chat/c/room',
      '/chat/c/room/m/message?panel=usage',
      '/chat/b/bot',
    ])
      expect(signInDestination(path)).toBe(path)
    expect(signInDestination('//evil.example/chat/c/room')).toBe('/')
    expect(signInDestination('https://evil.example/chat/c/room')).toBe('/')
  })
})

it('selects another conversation without carrying the previous message path', () => {
  const result = selectedConversationLocation(
    { workspaceId: 'one', botId: 'other', conversationId: 'other-room' },
    validateWorkspaceSearch({
      message: 'previous-message',
      panel: 'usage',
      details: true,
    }),
  )
  expect(result.to).toBe('/chat/c/$conversationId')
  expect(result.params).toEqual({ conversationId: 'other-room' })
  expect(result.search).not.toHaveProperty('message')
  expect(result.search.panel).toBe('usage')
})
