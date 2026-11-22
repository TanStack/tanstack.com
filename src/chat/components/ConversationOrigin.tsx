import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useWorkspaceApi } from './WorkspaceApi'
import { conversationCopySourceSchema } from './copy-source'
import './conversation-origin.css'
import {
  conversationLocation,
  conversationResourcePath,
  type ConversationResource,
} from '../core/conversation-destination'

export type ConversationCopyOrigin = {
  operationId: string
  kind: 'duplicate' | 'fork'
  copiedAt: number
  retryAttemptId?: string
  submittedMessageId?: string
  submittedDraftRevision?: number
}

export function ConversationOrigin({
  botId,
  userId,
  origin,
  destination,
}: {
  botId: string
  userId: string
  origin: ConversationCopyOrigin
  destination?: ConversationResource
}) {
  const { request, workspaceId } = useWorkspaceApi()
  const sourcePath = conversationResourcePath(destination ?? { botId })
  const source = useQuery({
    queryKey: [
      'copy-source',
      workspaceId,
      userId,
      sourcePath,
      origin.operationId,
    ],
    queryFn: async () =>
      conversationCopySourceSchema.parse(
        await request(`${sourcePath}/copy-source`),
      ),
  })
  const visible = source.isError ? undefined : source.data?.source
  return (
    <div className="conversation-origin">
      {visible && workspaceId ? (
        <>
          {origin.kind === 'fork'
            ? visible.messagePosition === 'before'
              ? 'Forked before a message in '
              : 'Forked from '
            : 'Copied from '}
          <Link
            {...conversationLocation(
              { workspaceId, ...visible },
              {
                view: 'bots',
                q: '',
                sort: 'position',
                group: 'section',
                message: visible.messageId ?? undefined,
              },
            )}
          >
            {visible.name}
          </Link>
        </>
      ) : origin.kind === 'fork' ? (
        'Forked history'
      ) : (
        'Copied history'
      )}
    </div>
  )
}
