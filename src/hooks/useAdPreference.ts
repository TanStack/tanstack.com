import { useCurrentUserQuery } from './useCurrentUser'

// Legacy hook for backward compatibility - now uses current user query
export function useAdsPreference() {
  const userQuery = useCurrentUserQuery()

  if (userQuery.isLoading || !userQuery.data) {
    return { adsEnabled: true } // Default to showing ads while loading or not authenticated
  }

  const user = userQuery.data
  const adsDisabled = user.adsDisabled ?? false
  const canDisableAds = user.capabilities.includes('disableAds')

  // Ads are enabled if user can't disable them OR if they haven't disabled them
  const adsEnabled = !canDisableAds || !adsDisabled

  return { adsEnabled }
}
