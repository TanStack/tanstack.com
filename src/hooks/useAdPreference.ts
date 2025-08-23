import { useConvexMutation } from '@convex-dev/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { useCurrentUserQuery } from './useCurrentUser'

export function useToggleAdPreference() {
  const queryClient = useQueryClient()
  
  return useConvexMutation(api.users.toggleAdPreference, {
    onSuccess: () => {
      // Invalidate current user query to refresh the ad preference
      queryClient.invalidateQueries({
        queryKey: ['convex', api.auth.getCurrentUser, {}],
      })
    },
  })
}

export function useSetAdPreference() {
  const queryClient = useQueryClient()
  
  return useConvexMutation(api.users.setAdPreference, {
    onSuccess: () => {
      // Invalidate current user query to refresh the ad preference
      queryClient.invalidateQueries({
        queryKey: ['convex', api.auth.getCurrentUser, {}],
      })
    },
  })
}

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