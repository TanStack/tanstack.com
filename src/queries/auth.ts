import { queryOptions } from '@tanstack/react-query'
import { getCurrentUser } from '~/utils/auth.server'

export const currentUserQueryOptions = () =>
  queryOptions({
    queryKey: ['auth', 'currentUser'],
    queryFn: () => getCurrentUser(),
  })
