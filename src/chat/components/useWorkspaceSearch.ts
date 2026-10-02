import { useParams, useSearch } from '@tanstack/react-router'
import { validateWorkspaceSearch } from '../core/navigation'

export function useWorkspaceSearch() {
  const params = useParams({ strict: false })
  return validateWorkspaceSearch({
    ...useSearch({ strict: false }),
    ...(params.conversationId ? { conversation: params.conversationId } : {}),
    ...(params.messageId ? { message: params.messageId } : {}),
  })
}
