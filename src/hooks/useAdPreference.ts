import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'

export function useAdPreferenceQuery() {
  return useQuery(convexQuery(api.users.getUserAdPreference, {}))
}

export function useToggleAdPreference() {
  const queryClient = useQueryClient()
  
  return useConvexMutation(api.users.toggleAdPreference, {
    onSuccess: () => {
      // Invalidate and refetch ad preference query
      queryClient.invalidateQueries({
        queryKey: ['convex', api.users.getUserAdPreference, {}],
      })
      // Also invalidate current user query since it might contain ad preferences
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
      // Invalidate and refetch ad preference query
      queryClient.invalidateQueries({
        queryKey: ['convex', api.users.getUserAdPreference, {}],
      })
      // Also invalidate current user query
      queryClient.invalidateQueries({
        queryKey: ['convex', api.auth.getCurrentUser, {}],
      })
    },
  })
}

// Legacy hook for backward compatibility - replace the useAdsPreference function
export function useAdsPreference() {
  const adPreferenceQuery = useAdPreferenceQuery()
  
  if (adPreferenceQuery.isLoading || !adPreferenceQuery.data) {
    return { adsEnabled: true } // Default to showing ads while loading
  }
  
  const { adsDisabled, canDisableAds } = adPreferenceQuery.data
  
  // Ads are enabled if user can't disable them OR if they haven't disabled them
  const adsEnabled = !canDisableAds || !adsDisabled
  
  return { adsEnabled }
}