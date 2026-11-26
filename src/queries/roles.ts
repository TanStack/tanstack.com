import { queryOptions } from '@tanstack/react-query'
import {
  listRoles,
  getBulkUserRoles,
  getBulkEffectiveCapabilities,
} from '~/utils/roles.functions'

export const listRolesQueryOptions = () =>
  queryOptions({
    queryKey: ['admin', 'roles'],
    queryFn: () => listRoles({ data: {} }),
  })

export const getBulkUserRolesQueryOptions = (userIds: string[]) =>
  queryOptions({
    queryKey: ['admin', 'bulkUserRoles', userIds],
    queryFn: () => getBulkUserRoles({ data: { userIds } }),
    enabled: userIds.length > 0,
  })

export const getBulkEffectiveCapabilitiesQueryOptions = (userIds: string[]) =>
  queryOptions({
    queryKey: ['admin', 'bulkEffectiveCapabilities', userIds],
    queryFn: () => getBulkEffectiveCapabilities({ data: { userIds } }),
    enabled: userIds.length > 0,
  })
