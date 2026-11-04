import { expect, it } from 'vitest'
import { appearancePayload } from '../../src/chat/server/appearance-html'
import {
  defaultAppearance,
  resolvePalette,
} from '../../src/chat/core/appearance'
it('uses the original palette resolver for the first paint', () => {
  const payload = JSON.parse(appearancePayload('account', defaultAppearance))
  expect(payload).toEqual({
    userId: 'account',
    settings: defaultAppearance,
    paint: {
      light: resolvePalette(defaultAppearance, 'light'),
      dark: resolvePalette(defaultAppearance, 'dark'),
    },
  })
})
it('escapes HTML script delimiters in serialized account identity', () => {
  const payload = appearancePayload(
    '</script><script>bad()</script>',
    defaultAppearance,
  )
  expect(payload).not.toContain('<')
  expect(JSON.parse(payload).userId).toBe('</script><script>bad()</script>')
})
