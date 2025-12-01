import { useCurrentUserQuery } from './useCurrentUser'

/**
 * Hook to get capabilities for the current user.
 * Returns an empty array until the user query is resolved.
 */
export function useCapabilities() {
  const userQuery = useCurrentUserQuery()
  return userQuery.data?.capabilities || []
}

