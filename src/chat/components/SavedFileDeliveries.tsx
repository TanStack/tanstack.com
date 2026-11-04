import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import { File as FileIcon, FileSymlink } from 'lucide-react'
import { fileDeliveryKey, type FileDelivery } from '../core/file-deliveries'
import {
  defaultWorkspaceSearch,
  validateWorkspaceSearch,
} from '../core/navigation'
import { openWorkspacePanel } from '../core/workspace-panels'
import {
  conversationLocation,
  type ConversationDestination,
} from '../core/conversation-destination'
import './saved-file-deliveries.css'

interface DeliveryProps {
  deliveries: FileDelivery[]
  currentConversation?: Pick<
    ConversationDestination,
    'workspaceId' | 'botId' | 'conversationId' | 'isMainConversation'
  >
}
export function SavedFileDeliveries({
  deliveries,
  currentConversation,
}: DeliveryProps) {
  if (!deliveries.length) return null
  return (
    <DeliveryLinks
      deliveries={deliveries}
      currentConversation={currentConversation}
    />
  )
}

function DeliveryLinks({ deliveries, currentConversation }: DeliveryProps) {
  const router = useRouter()
  const location = useRouterState({ select: (state) => state.location })
  const search = validateWorkspaceSearch(location.search)
  const unique = [
    ...new Map(
      deliveries.map((delivery) => [fileDeliveryKey(delivery), delivery]),
    ).values(),
  ]
  return (
    <ul className="saved-file-deliveries" aria-label="Saved files">
      {unique.map((delivery) => {
        const { file, workspaceId } = delivery
        const referenced = delivery.kind === 'file-reference'
        const Icon = referenced ? FileSymlink : FileIcon
        const destination = router.buildLocation({
          ...conversationLocation(
            { workspaceId, ...file },
            defaultWorkspaceSearch,
          ),
        })
        // Main URLs can omit their canonical conversation ID. Use the identity
        // resolved by the server, never infer a room from a bot ID or receipt.
        const currentMain =
          search.conversation === undefined &&
          currentConversation?.isMainConversation &&
          currentConversation.workspaceId === workspaceId &&
          currentConversation.botId === file.botId &&
          currentConversation.conversationId === file.conversationId
        const sameConversation =
          destination.pathname === location.pathname &&
          (file.conversationId === search.conversation || currentMain)
        return (
          <li key={fileDeliveryKey(delivery)} data-file-kind={delivery.kind}>
            <Link
              aria-label={`${file.name}, ${referenced ? 'existing file' : 'saved file'}`}
              title={referenced ? 'Open existing file' : 'Open saved file'}
              {...conversationLocation(
                { workspaceId, ...file },
                openWorkspacePanel(
                  sameConversation ? search : defaultWorkspaceSearch,
                  `file:${file.id}`,
                ),
              )}
              resetScroll={!sameConversation}
            >
              <Icon size={17} aria-hidden />
              <span className="saved-file-delivery-name">{file.name}</span>
              <span className="saved-file-delivery-size">
                {file.size >= 1024 * 1024
                  ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                  : file.size >= 1024
                    ? `${Math.ceil(file.size / 1024)} KB`
                    : `${file.size} B`}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
