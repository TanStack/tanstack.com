import { useQuery, queryOptions } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { getCurrentUser } from '~/utils/auth.functions'

export const currentUserQueryOptions = queryOptions({
  queryKey: ['currentUser'],
  queryFn: async () => {
    return getCurrentUser()
  },
  staleTime: 5 * 1000,
})

export function useCurrentUserQuery() {
  const contextUser = useRouterState({
    select: (state) => {
      const context = state.matches[state.matches.length - 1]?.context
      return context && 'user' in context ? context.user : undefined
    },
  })

  return useQuery({
    ...currentUserQueryOptions,
    initialData: contextUser,
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
