import { useQuery } from '@tanstack/react-query'
import { useRouteContext } from '@tanstack/react-router'
import { getCurrentUser } from '~/utils/auth.server'

export function useCurrentUserQuery() {
  // Get user from route context (set in beforeLoad)
  const routeContext = useRouteContext({ strict: false })
  const contextUser = routeContext?.user

  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      return getCurrentUser()
    },
    initialData: contextUser,
    staleTime: 5 * 1000,
  })
}

/**
 * Simple hook to get the current user data
 * Returns undefined if not logged in
 */
export function useCurrentUser() {
  const query = useCurrentUserQuery()
  return query.data
}
