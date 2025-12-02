import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  updateUserCapabilities,
  adminSetAdsDisabled,
  bulkUpdateUserCapabilities,
} from './users.server'
import {
  createRole,
  updateRole,
  deleteRole,
  assignRolesToUser,
  bulkAssignRolesToUsers,
  removeUsersFromRole,
} from './roles.server'
import {
  toggleFeedEntryVisibility,
  setFeedEntryFeatured,
  deleteFeedEntry,
  createFeedEntry,
  updateFeedEntry,
} from './feed.server'

// User mutations
export function useUpdateUserCapabilities() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { userId: string; capabilities: string[] }) =>
      updateUserCapabilities({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}

export function useAdminSetAdsDisabled() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { userId: string; adsDisabled: boolean }) =>
      adminSetAdsDisabled({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}

export function useBulkUpdateUserCapabilities() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { userIds: string[]; capabilities: string[] }) =>
      bulkUpdateUserCapabilities({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}

// Role mutations
export function useCreateRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name: string
      description?: string
      capabilities: string[]
    }) => createRole({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}

export function useUpdateRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      roleId: string
      name?: string
      description?: string
      capabilities?: string[]
    }) => updateRole({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}

export function useDeleteRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { roleId: string }) => deleteRole({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}

export function useAssignRolesToUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { userId: string; roleIds: string[] }) =>
      assignRolesToUser({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}

export function useBulkAssignRolesToUsers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { userIds: string[]; roleIds: string[] }) =>
      bulkAssignRolesToUsers({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}

export function useRemoveUsersFromRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { roleId: string; userIds: string[] }) =>
      removeUsersFromRole({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}

// Feed mutations
export function useToggleFeedEntryVisibility() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { id: string; isVisible: boolean }) =>
      toggleFeedEntryVisibility({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}

export function useSetFeedEntryFeatured() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { id: string; featured: boolean }) =>
      setFeedEntryFeatured({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}

export function useDeleteFeedEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { id: string }) => deleteFeedEntry({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}

export function useCreateFeedEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      id: string
      source: string
      title: string
      content: string
      excerpt?: string
      publishedAt: number
      metadata?: any
      libraryIds: string[]
      partnerIds?: string[]
      tags: string[]
      category: string
      isVisible: boolean
      featured?: boolean
      autoSynced: boolean
    }) => createFeedEntry({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}

export function useUpdateFeedEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      id: string
      title?: string
      content?: string
      excerpt?: string
      publishedAt?: number
      metadata?: any
      libraryIds?: string[]
      partnerIds?: string[]
      tags?: string[]
      category?: string
      isVisible?: boolean
      featured?: boolean
      lastSyncedAt?: number
    }) => updateFeedEntry({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}
