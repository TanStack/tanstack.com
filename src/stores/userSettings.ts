import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'

export type UserSettings = {
  adsDisabled: boolean
}

type UserSettingsState = {
  settings: UserSettings
  hasHydrated: boolean
  setHasHydrated: (value: boolean) => void
  toggleAds: () => void
}

export const useUserSettingsStore = create<UserSettingsState>()(
  persist(
    (set, get) => ({
      settings: {
        adsDisabled: false,
      },
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      toggleAds: () =>
        set({
          settings: {
            ...get().settings,
            adsDisabled: !get().settings.adsDisabled,
          },
        }),
    }),
    {
      name: 'user_settings_v1',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state, error) => {
        if (!state || error) return
        state.setHasHydrated(true)
      },
      partialize: (state) => ({ settings: state.settings }),
    }
  )
)

export function useAdsPreference() {
  const userQuery = useCurrentUserQuery()
  const settings = useUserSettingsStore((s) => s.settings)

  const status = userQuery.isLoading ? 'unknown' : 'ready'
  
  // Show ads if:
  // - User doesn't have the 'disableAds' capability (they haven't paid to disable ads), OR
  // - User has the capability but hasn't disabled ads in settings
  const adsEnabled = userQuery.data
    ? !userQuery.data.capabilities.includes('disableAds') ||
      !settings.adsDisabled
    : true
    
  return { adsEnabled, status }
}
