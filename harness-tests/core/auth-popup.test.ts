import { expect, it } from 'vitest'
import { authPopupComplete } from '../../src/chat/server/auth-popup'
it('signals the saved attempt without returning credentials', async () => {
  const response = authPopupComplete(
    new Headers({ Location: '/chat' }),
    '732f0695-ed52-48ef-a6b6-1af54c701dd9',
  )
  const html = await response.text()
  expect(html).toContain('tanstack.auth.732f0695-ed52-48ef-a6b6-1af54c701dd9')
  expect(html).toContain('BroadcastChannel')
  expect(html).toContain('window.opener?.postMessage')
  expect(response.headers.get('Location')).toBeNull()
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(response.headers.get('Content-Security-Policy')).toContain(
    "default-src 'none'",
  )
  expect(html).not.toContain('access_token')
})
it('preserves existing callbacks without a channel identifier', async () => {
  const html = await authPopupComplete(new Headers()).text()
  expect(html).not.toContain('BroadcastChannel')
  expect(html).toContain('window.opener?.postMessage')
})
