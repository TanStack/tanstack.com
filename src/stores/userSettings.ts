import { create } from 'zustand'

// Update the export to use the new hook
export { useAdsPreference } from '~/hooks/useAdPreference'

export type UserSettings = {
  // Remove adsDisabled since it's now handled by Convex
  // Other settings can be added here in the future
}

type UserSettingsState = {
  settings: UserSettings
  hasHydrated: boolean
  setHasHydrated: (value: boolean) => void
  // Remove toggleAds since it's now handled by the new hooks
}

export const useUserSettingsStore = create<UserSettingsState>()((set, __) => ({
  settings: {
    // Remove adsDisabled initialization
  },
  hasHydrated: true, // No need for hydration since we're not using persistence
  setHasHydrated: (value) => set({ hasHydrated: value }),
  // Remove toggleAds function
}))

// Remove the persist wrapper and localStorage configuration
// The useAdsPreference function is now exported from useAdPreference.ts
