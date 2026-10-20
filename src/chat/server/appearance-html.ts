import { resolvePalette, type AppearancePreferences } from '../core/appearance'

export function appearancePayload(
  userId: string,
  appearance: AppearancePreferences,
) {
  const payload = JSON.stringify({
    userId,
    settings: appearance,
    paint: {
      light: resolvePalette(appearance, 'light'),
      dark: resolvePalette(appearance, 'dark'),
    },
  }).replace(/</g, '\\u003c')
  return payload
}

export async function readInitialAppearance() {
  const { getCurrentUser } = await import('~/utils/auth.server')
  const { readAccountPreferences } = await import('./account-preferences')
  const user = await getCurrentUser()
  if (!user) return null
  const preferences = await readAccountPreferences(user.userId)
  return preferences.appearance
    ? appearancePayload(user.userId, preferences.appearance)
    : null
}
