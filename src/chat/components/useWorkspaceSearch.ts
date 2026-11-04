import { useMemo } from 'react'
import { useParams, useSearch } from '@tanstack/react-router'
import { validateWorkspaceSearch } from '../core/navigation'

export function useWorkspaceSearch() {
  const params = useParams({ strict: false })
  const search = useSearch({ strict: false })
  return useMemo(
    () =>
      validateWorkspaceSearch({
        ...search,
        ...(params.conversationId
          ? { conversation: params.conversationId }
          : {}),
        ...(params.messageId ? { message: params.messageId } : {}),
      }),
    [search, params.conversationId, params.messageId],
  )
}
