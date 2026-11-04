import type { QueryClient } from '@tanstack/react-query'
import type { AppearancePreferences } from '../core/appearance'
import type { AccountPreferences } from '../core/account-preferences'
import {
  accountPreferencesKey,
  saveAccountPreferences,
} from './account-preferences-client'
import { ApiError } from './WorkspaceApi'

export const localOnly = (userId: string) => {
  try {
    return (
      localStorage.getItem(`gum.appearance.local-only.${userId}`) === 'true'
    )
  } catch {
    return false
  }
}
export const setLocalOnly = (userId: string, value: boolean) => {
  try {
    localStorage.setItem(`gum.appearance.local-only.${userId}`, String(value))
  } catch {}
}
export async function saveSyncedAppearance(
  userId: string,
  appearance: AppearancePreferences,
  preferences: AccountPreferences,
  refresh: () => Promise<AccountPreferences | undefined>,
  client: QueryClient,
) {
  let latest: AccountPreferences
  try {
    latest = await saveAccountPreferences({
      revision: preferences.revision,
      appearance,
    })
  } catch (cause) {
    if (!(cause instanceof ApiError) || cause.status !== 409) throw cause
    const refreshed = await refresh()
    if (!refreshed) throw cause
    latest = await saveAccountPreferences({
      revision: refreshed.revision,
      appearance,
    })
  }
  client.setQueryData(accountPreferencesKey(userId), latest)
  return latest
}
