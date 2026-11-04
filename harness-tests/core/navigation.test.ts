import { describe, expect, it } from 'vitest'
import {
  defaultParseSearch,
  defaultStringifySearch,
} from '@tanstack/react-router'
import {
  executionHistorySession,
  maxWorkspaceReturnPathCharacters,
  selectExecutionHistory,
  signInDestination,
  validateWorkspaceSearch,
} from '../../src/chat/core/navigation'

describe('workspace URLs', () => {
  it('preserves asset identities and collection filters through a URL round trip', () => {
    const value = validateWorkspaceSearch({
      asset: 'integration:team/a?b=c',
      homeQuery: 'calendar & routines',
      projectTemplate: 'tanstack-chart-example',
    })
    expect(
      validateWorkspaceSearch(
        defaultParseSearch(defaultStringifySearch(value)),
      ),
    ).toEqual(value)
    expect(
      validateWorkspaceSearch({ asset: ['wrong'], homeQuery: 'x'.repeat(201) })
        .asset,
    ).toBeUndefined()
    expect(
      validateWorkspaceSearch({ homeQuery: 'x'.repeat(201) }).homeQuery,
    ).toBeUndefined()
    expect(
      validateWorkspaceSearch({ projectTemplate: 'x'.repeat(201) })
        .projectTemplate,
    ).toBeUndefined()
  })
  it('retains bounded opaque conversation identities for later authorization', () => {
    const conversation = 'room/with?controls\u0000' + 'x'.repeat(980)
    expect(conversation).toHaveLength(999)
    expect(validateWorkspaceSearch({ conversation }).conversation).toBe(
      conversation,
    )
    expect(
      validateWorkspaceSearch({ conversation: 'x'.repeat(1000) }).conversation,
    ).toHaveLength(1000)
    for (const conversation of ['', 'x'.repeat(1001), 123, ['room']])
      expect(
        validateWorkspaceSearch({ conversation }).conversation,
      ).toBeUndefined()
  })
  it('leaves panel fields absent until a known panel is opened', () => {
    expect(validateWorkspaceSearch({})).toEqual({
      view: 'bots',
      q: '',
      sort: 'position',
      group: 'section',
    })
    expect(validateWorkspaceSearch({ panel: 'usage' })).toMatchObject({
      panel: 'usage',
      panels: ['usage'],
    })
    expect(
      validateWorkspaceSearch({
        panels: ['activity', 'schedules', 'activity'],
        fullscreen: true,
      }),
    ).toMatchObject({
      panels: ['activity', 'schedules'],
      panel: 'activity',
      fullscreen: true,
    })
    expect(
      validateWorkspaceSearch({
        panels: ['activity', 'schedules'],
        panel: 'usage',
      }),
    ).toMatchObject({
      panels: ['activity', 'schedules', 'usage'],
      panel: 'usage',
    })
  })
  it('rejects arbitrary panels, oversized lists, and fullscreen without a panel', () => {
    const empty = validateWorkspaceSearch({})
    for (const input of [
      { panel: 'https://example.com/private' },
      { panel: ['schedules'] },
      { panels: 'schedules' },
      { panels: Array(9).fill('schedules') },
      { panels: [], fullscreen: true },
      { fullscreen: true },
    ])
      expect(validateWorkspaceSearch(input)).toEqual(empty)
    for (const fullscreen of [false, 'true', 1, ['true']])
      expect(
        validateWorkspaceSearch({ panel: 'schedules', fullscreen }),
      ).not.toHaveProperty('fullscreen')
  })
  it('keeps valid file identities and removes invalid references without removing known tabs', () => {
    const file = 'file:12345678-1234-8123-8123-123456789012'
    expect(
      validateWorkspaceSearch({
        panels: ['files', 'file:../../secret', file],
        panel: file,
      }),
    ).toMatchObject({
      panels: ['files', file],
      panel: file,
    })
    expect(
      validateWorkspaceSearch({ panels: ['schedules', 'private text'] }),
    ).toMatchObject({
      panels: ['schedules'],
      panel: 'schedules',
    })
    expect(
      validateWorkspaceSearch({ panel: 'file:untrusted-name.txt' }),
    ).not.toHaveProperty('panel')
  })
  it('preserves only draft identifiers, never the first message', () => {
    const draft = '12345678-1234-4123-8123-123456789012'
    expect(
      validateWorkspaceSearch({ draft, parent: 'parent-bot', text: 'private' }),
    ).toMatchObject({ draft, parent: 'parent-bot' })
    expect(
      validateWorkspaceSearch({ draft, parent: 'parent-bot', text: 'private' }),
    ).not.toHaveProperty('text')
    expect(
      validateWorkspaceSearch({ draft: 'not-an-id' }).draft,
    ).toBeUndefined()
  })
  it('validates shared filters without carrying unknown values or secrets', () => {
    expect(
      validateWorkspaceSearch({
        view: 'attention',
        sort: 'unread',
        group: 'status',
        q: 'launch',
        token: 'secret',
      }),
    ).toEqual({
      view: 'attention',
      sort: 'unread',
      group: 'status',
      q: 'launch',
    })
    expect(
      validateWorkspaceSearch({
        view: ['trash'],
        sort: 'bogus',
        group: {},
        q: 'x'.repeat(201),
        settings: 'unknown',
      }),
    ).toEqual({
      view: 'bots',
      sort: 'position',
      group: 'section',
      q: '',
      settings: undefined,
    })
  })
  it('preserves an internal destination across sign-in without allowing open redirects', () => {
    const destination = '/chat/w/personal%3Aexample/b/bot-123?view=attention'
    expect(signInDestination(destination)).toBe(destination)
    for (const input of [
      'https://evil.example/chat/w/a',
      '//evil.example/chat/w/a',
      '/auth/logout',
      '/chat/w/..//evil.example',
      '/chat/w/%2e%2e//evil.example',
      '/chat/w/a#signin=secret',
      '',
      null,
    ])
      expect(signInDestination(input)).toBe('/')
  })
  it('round-trips an encoded exact room and file layout through both sign-in validations', () => {
    const workspaceId = '界'.repeat(200)
    const botId = '路'.repeat(200)
    const conversation = '室'.repeat(1000)
    const panels = Array.from(
      { length: 8 },
      (_, index) => `file:${index}2345678-1234-8123-8123-123456789012`,
    )
    const search = validateWorkspaceSearch({
      conversation,
      executionHistory: {
        conversationId: '歴'.repeat(1000),
        sessionId: '12345678-1234-4123-8123-123456789012',
      },
      thread: '脇'.repeat(1000),
      threadMessage: '話'.repeat(128),
      message: '文'.repeat(128),
      parent: '親'.repeat(200),
      q: '探'.repeat(200),
      panels,
      panel: panels[7],
      fullscreen: true,
    })
    const path = `/chat/w/${encodeURIComponent(workspaceId)}/b/${encodeURIComponent(botId)}`
    const destination = path + defaultStringifySearch(search)
    expect(destination.length).toBeGreaterThan(4000)
    expect(destination.length).toBeLessThanOrEqual(
      maxWorkspaceReturnPathCharacters,
    )
    const stored = signInDestination(destination)
    const resumed = signInDestination(stored)
    expect(resumed).toBe(destination)
    const url = new URL(resumed, 'https://gum.invalid')
    expect(url.pathname).toBe(path)
    expect(validateWorkspaceSearch(defaultParseSearch(url.search))).toEqual(
      search,
    )
    expect(
      signInDestination(
        '/chat/w/' + 'x'.repeat(maxWorkspaceReturnPathCharacters),
      ),
    ).toBe('/')
    // A short unencoded input cannot expand past the same bound after parsing.
    expect(
      signInDestination(
        '/chat/w/' +
          '界'.repeat(Math.ceil(maxWorkspaceReturnPathCharacters / 9)),
      ),
    ).toBe('/')
  })
  it('keeps a bounded message target without putting message contents in the URL', () => {
    expect(validateWorkspaceSearch({ message: 'message-123' }).message).toBe(
      'message-123',
    )
    expect(
      validateWorkspaceSearch({ message: ['one', 'two'] }).message,
    ).toBeUndefined()
    expect(
      validateWorkspaceSearch({ message: 'x'.repeat(129) }).message,
    ).toBeUndefined()
  })
})

describe('read-only execution history navigation', () => {
  const sessionId = '12345678-1234-4123-8123-123456789012'
  const conversationId = 'exact/room?\u0000'

  it('round-trips the selected session without storing runtime authority', () => {
    const search = validateWorkspaceSearch({
      conversation: conversationId,
      panel: 'commands',
      executionHistory: { conversationId, sessionId },
      leaseProof: 'never-in-the-url',
    })
    const reloaded = validateWorkspaceSearch(
      defaultParseSearch(defaultStringifySearch(search)),
    )
    expect(reloaded).toEqual(search)
    expect(reloaded.executionHistory).toEqual({ conversationId, sessionId })
    expect(reloaded).not.toHaveProperty('leaseProof')
    expect(
      executionHistorySession(reloaded.executionHistory, conversationId),
    ).toBe(sessionId)
  })

  it('rejects malformed, extra, and oversized selection fields', () => {
    for (const executionHistory of [
      null,
      [],
      sessionId,
      { conversationId },
      { sessionId },
      { conversationId: '', sessionId },
      { conversationId: 'x'.repeat(1001), sessionId },
      { conversationId: ['room'], sessionId },
      { conversationId, sessionId: '../session' },
      { conversationId, sessionId, leaseProof: 'secret' },
    ])
      expect(
        validateWorkspaceSearch({ executionHistory }).executionHistory,
      ).toBeUndefined()
    expect(
      validateWorkspaceSearch({
        executionHistory: { conversationId: '界'.repeat(1000), sessionId },
      }).executionHistory?.conversationId,
    ).toHaveLength(1000)
  })

  it('keeps parent and thread history separate even when they share the same assistant', () => {
    const parent = validateWorkspaceSearch({
      conversation: 'main',
      thread: 'child',
      panel: 'commands',
      executionHistory: { conversationId: 'main', sessionId },
    })
    expect(executionHistorySession(parent.executionHistory, 'main')).toBe(
      sessionId,
    )
    expect(
      executionHistorySession(parent.executionHistory, 'child'),
    ).toBeUndefined()
    const child = selectExecutionHistory(parent, 'child', sessionId)
    expect(executionHistorySession(child.executionHistory, 'child')).toBe(
      sessionId,
    )
    expect(
      executionHistorySession(child.executionHistory, 'main'),
    ).toBeUndefined()
    expect(parent.executionHistory).toEqual({
      conversationId: 'main',
      sessionId,
    })
    const live = selectExecutionHistory(child, 'child', undefined)
    expect(live).not.toHaveProperty('executionHistory')
    expect(live.panel).toBe('commands')
  })

  it('removes historical selection from a draft URL', () => {
    const search = validateWorkspaceSearch({
      draft: '12345678-1234-4123-8123-123456789013',
      panel: 'commands',
      executionHistory: { conversationId, sessionId },
    })
    expect(search).not.toHaveProperty('executionHistory')
    expect(search.panel).toBe('commands')
  })
})

describe('parent and thread navigation', () => {
  it('round-trips separate parent and thread targets without merging identities', () => {
    const search = validateWorkspaceSearch({
      conversation: 'parent/a',
      message: 'source',
      thread: 'thread/b',
      threadMessage: 'reply',
      panel: 'thread',
      panels: ['schedules', 'thread'],
    })
    expect(
      validateWorkspaceSearch(
        defaultParseSearch(defaultStringifySearch(search)),
      ),
    ).toEqual(search)
    expect(search).toMatchObject({
      conversation: 'parent/a',
      message: 'source',
      thread: 'thread/b',
      threadMessage: 'reply',
      panel: 'thread',
    })
  })
  it('does not mount a thread pane without a distinct valid thread identity', () => {
    for (const extra of [
      {},
      { thread: '' },
      { thread: 'x'.repeat(1001) },
      { thread: 'same', conversation: 'same' },
    ]) {
      const search = validateWorkspaceSearch({
        panel: 'thread',
        panels: ['schedules', 'thread'],
        threadMessage: 'reply',
        ...extra,
      })
      expect(search.thread).toBeUndefined()
      expect(search.threadMessage).toBeUndefined()
      expect(search.panels).toEqual(['schedules'])
      expect(search.panel).toBe('schedules')
    }
  })
})

it('round trips bounded family-scoped name filters without granting access', () => {
  const search = validateWorkspaceSearch({
    navigatorSearch: { rootBotId: 'family', query: 'Cedar' },
  })
  expect(
    validateWorkspaceSearch(defaultParseSearch(defaultStringifySearch(search)))
      .navigatorSearch,
  ).toEqual({ rootBotId: 'family', query: 'Cedar' })
  expect(
    validateWorkspaceSearch({
      navigatorSearch: { rootBotId: 'family', query: 'x'.repeat(201) },
    }).navigatorSearch,
  ).toBeUndefined()
  expect(
    validateWorkspaceSearch({
      navigatorSearch: { rootBotId: 'family', query: '', userId: 'other' },
    }).navigatorSearch,
  ).toBeUndefined()
})
