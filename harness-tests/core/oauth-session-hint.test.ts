import { beforeEach, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({ user: vi.fn() }))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: auth.user }),
}))
import { handleSessionHint } from '~/auth/oauth-session-hint.server'

const request = (origin = 'https://source.tanstack.com', method = 'GET') =>
  new Request('https://tanstack.com/oauth/session-hint', {
    method,
    headers: { origin, cookie: 'session=opaque-cookie' },
  })
beforeEach(() => {
  auth.user.mockReset()
  auth.user.mockResolvedValue(null)
})
it('shares only an account display hint with Source, without tokens, email or identifiers', async () => {
  auth.user.mockResolvedValue({
    userId: 'private-id',
    email: 'private@example.com',
    name: 'Tanner',
    image: 'https://avatars.githubusercontent.com/u/1',
    oauthImage: null,
    displayUsername: 'tanner',
  })
  const response = await handleSessionHint(request())
  expect(await response.json()).toEqual({
    account: {
      name: 'Tanner',
      avatar: 'https://avatars.githubusercontent.com/u/1',
    },
  })
  expect(response.headers.get('access-control-allow-origin')).toBe(
    'https://source.tanstack.com',
  )
  expect(response.headers.get('access-control-allow-credentials')).toBe('true')
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(response.headers.get('vary')).toContain('Cookie')
})
it('does not look up sessions or expose a hint to another origin or a direct visit', async () => {
  for (const origin of [
    'https://evil.test',
    'https://source.tanstack.com.evil.test',
    'null',
    '',
  ]) {
    const response = await handleSessionHint(request(origin))
    expect(response.status).toBe(403)
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  }
  expect(auth.user).not.toHaveBeenCalled()
})
it('returns no hint when signed out, and handles preflights without inspecting a session', async () => {
  expect(await (await handleSessionHint(request())).json()).toEqual({
    account: null,
  })
  auth.user.mockClear()
  expect(
    (await handleSessionHint(request('https://source.tanstack.com', 'OPTIONS')))
      .status,
  ).toBe(204)
  expect(auth.user).not.toHaveBeenCalled()
})
it('uses the account name fallback and refuses non-HTTPS avatars', async () => {
  auth.user.mockResolvedValue({
    userId: 'id',
    email: 'private@example.com',
    name: null,
    displayUsername: 'tanner',
    image: 'javascript:alert(1)',
    oauthImage: null,
  })
  expect(await (await handleSessionHint(request())).json()).toEqual({
    account: { name: 'tanner', avatar: null },
  })
})
