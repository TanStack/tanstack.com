import { expect, it } from 'vitest'
import { redirectChatOrigin } from '../../src/chat/server/origin-redirect'

it.each(['tanstack.com', 'localhost:3001', 'chat.tanstack.com.attacker.test'])(
  'leaves the shared site and other hosts untouched: %s',
  (host) => {
    expect(
      redirectChatOrigin(new Request(`https://${host}/chat`)),
    ).toBeUndefined()
  },
)
it.each([
  ['/', '/chat'],
  [
    '/w/personal%3Aaccount/b/assistant%3Aaccount',
    '/chat/w/personal%3Aaccount/b/assistant%3Aaccount',
  ],
  ['/chat/w/team/b/project', '/chat/w/team/b/project'],
  ['/p/public-hash', '/chat/p/public-hash'],
  ['/project/project-id', '/chat/project/project-id'],
  ['/charts', '/chat/charts'],
  ['/auth/callback', '/chat'],
  ['/api/chat/turn', '/chat'],
])(
  'redirects %s to the canonical path without forwarding credentials',
  (path, expected) => {
    const result = redirectChatOrigin(
      new Request(
        `https://chat.tanstack.com${path}?code=private&state=private&access_token=private&returnTo=https://attacker.test`,
      ),
    )!
    expect(result.status).toBe(302)
    const url = new URL(result.headers.get('location')!)
    expect(url.origin).toBe('https://tanstack.com')
    expect(url.pathname).toBe(expected)
    expect(url.search).toBe('')
    expect(url.href.endsWith('#')).toBe(true)
    expect(result.headers.get('referrer-policy')).toBe('no-referrer')
    expect(result.headers.get('cache-control')).toBe('no-store')
    expect(result.headers.get('set-cookie')).toBeNull()
  },
)
it('retains validated workspace navigation and drops unknown or malformed values', () => {
  const result = redirectChatOrigin(
    new Request(
      'https://chat.tanstack.com/w/team/b/project?sort=activity&group=none&panel=usage&panels=%5B%22usage%22%5D&message=turn-1&draft=not-a-uuid&token=private',
    ),
  )!
  const search = new URL(result.headers.get('location')!).searchParams
  expect(search.get('sort')).toBe('activity')
  expect(search.get('group')).toBe('none')
  expect(search.get('panel')).toBe('usage')
  expect(JSON.parse(search.get('panels')!)).toEqual(['usage'])
  expect(search.get('message')).toBe('turn-1')
  expect(search.has('draft')).toBe(false)
  expect(search.has('token')).toBe(false)
})
it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
  'never redirects a %s body or action',
  (method) => {
    const result = redirectChatOrigin(
      new Request('https://chat.tanstack.com/api/chat/send', {
        method,
        body: 'private action',
      }),
    )!
    expect(result.status).toBe(405)
    expect(result.headers.get('location')).toBeNull()
    expect(result.headers.get('allow')).toBe('GET, HEAD')
  },
)
it('accepts HEAD without returning a body', async () => {
  const result = redirectChatOrigin(
    new Request('https://chat.tanstack.com/', { method: 'HEAD' }),
  )!
  expect(result.status).toBe(302)
  expect(await result.text()).toBe('')
})

it('keeps valid settings navigation on the alias entry page', () => {
  const result = redirectChatOrigin(
    new Request('https://chat.tanstack.com/?settings=appearance&code=private'),
  )!
  const target = new URL(result.headers.get('location')!)
  expect(target.pathname).toBe('/chat')
  expect(target.searchParams.get('settings')).toBe('appearance')
  expect(target.searchParams.has('code')).toBe(false)
})
