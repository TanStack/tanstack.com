import { useQuery } from '@tanstack/react-query'
import type { SavedFile } from '../core/files'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'
import {
  conversationFilePath,
  savedFileQueryKey,
  type ConversationResource,
} from '../core/conversation-destination'

const accessDenied = (error: unknown) =>
  error instanceof ApiError && [401, 403, 404].includes(error.status)

export function useSavedFiles(
  botId: string,
  userId: string,
  destination?: ConversationResource,
) {
  const source = destination ?? { botId }
  const api = useWorkspaceApi()
  const query = useQuery({
    queryKey: savedFileQueryKey(api.workspaceId, userId, source),
    queryFn: () =>
      api.request<{ files: SavedFile[] }>(conversationFilePath(source)),
    staleTime: 5000,
    retry: false,
    refetchOnMount: 'always',
    refetchInterval: (query) =>
      query.state.data?.files.some((file) => file.state === 'pending')
        ? 5000
        : false,
    refetchIntervalInBackground: false,
  })
  return { ...query, data: accessDenied(query.error) ? undefined : query.data }
}
