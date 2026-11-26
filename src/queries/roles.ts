import { queryOptions } from '@tanstack/react-query'
import {
  listRoles,
  getBulkUserRoles,
  getBulkEffectiveCapabilities,
} from '~/utils/roles.functions'
import type { Capability } from '~/db/types'

export interface ListRolesFilters {
  nameFilter?: string
  capabilityFilter?: Capability[]
}

export const rolesQueries = {
  list: (filters?: ListRolesFilters) =>
    queryOptions({
      queryKey: ['admin', 'roles', filters],
      queryFn: () => listRoles({ data: filters || {} }),
    }),
  bulkUserRoles: (userIds: string[]) =>
    queryOptions({
      queryKey: ['admin', 'bulkUserRoles', userIds],
      queryFn: () => getBulkUserRoles({ data: { userIds } }),
      enabled: userIds.length > 0,
    }),
  bulkEffectiveCapabilities: (userIds: string[]) =>
    queryOptions({
      queryKey: ['admin', 'bulkEffectiveCapabilities', userIds],
      queryFn: () => getBulkEffectiveCapabilities({ data: { userIds } }),
      enabled: userIds.length > 0,
    }),
}
