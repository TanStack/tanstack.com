import { useUser } from '@clerk/tanstack-react-start'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

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
  const { isSignedIn } = useUser()
  const { settings, hasHydrated } = useUserSettingsStore((s) => ({
    settings: s.settings,
    hasHydrated: s.hasHydrated,
  }))

  const adsEnabled = isSignedIn && !settings.adsDisabled
  const status = hasHydrated ? (adsEnabled ? 'enabled' : 'disabled') : 'unknown'
  return { status: status as 'unknown' | 'enabled' | 'disabled', adsEnabled }
}
