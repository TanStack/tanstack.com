import { expect, it } from 'vitest'
import { validateMcpEndpoint } from '../../src/chat/server/public-endpoint'
it('preserves MCP paths and excludes embedded credentials and local URL forms', () => {
  expect(validateMcpEndpoint('https://example.com/mcp/')).toBe(
    'https://example.com/mcp/',
  )
  for (const url of [
    'http://example.com/mcp',
    'https://localhost./',
    'https://x.localhost/',
    'https://127.0.0.1/',
    'https://[::1]/',
    'https://user:pass@example.com/',
    'https://example.com/?token=x',
    'https://example.com/#x',
    'https://x.internal./',
  ])
    expect(() => validateMcpEndpoint(url)).toThrow('public HTTPS')
})
