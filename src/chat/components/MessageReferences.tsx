import { Link } from '@tanstack/react-router'
import { BookOpen, MessageCircle, Package, Plug, Wrench } from 'lucide-react'
import type { MessageReference } from '../core/message-references'
import { referenceKey } from '../core/message-references'
import { defaultWorkspaceSearch } from '../core/navigation'
import { useWorkspaceApi } from './WorkspaceApi'
import { conversationLocation } from '../core/conversation-destination'
import './message-references.css'

export function MessageReferences({
  references,
}: {
  references: MessageReference[]
}) {
  const { workspaceId } = useWorkspaceApi()
  const items = references.filter((item) => item.kind !== 'file')
  if (!items.length) return null
  return (
    <ul className="message-references" aria-label="References">
      {items.map((item) => (
        <li key={referenceKey(item)}>
          {item.kind === 'skill' ? (
            <BookOpen size={14} aria-hidden />
          ) : item.kind === 'plugin' ? (
            <Package size={14} aria-hidden />
          ) : item.kind === 'conversation' ? (
            <MessageCircle size={14} aria-hidden />
          ) : item.kind === 'tool' ? (
            <Wrench size={14} aria-hidden />
          ) : (
            <Plug size={14} aria-hidden />
          )}
          {item.kind === 'conversation' && workspaceId ? (
            <Link
              {...conversationLocation(
                { workspaceId, ...item },
                defaultWorkspaceSearch,
              )}
            >
              {item.label}
            </Link>
          ) : (
            <span className="reference-chip-text">
              <span className="reference-chip-label">{item.label}</span>
              {(item.kind === 'tool' ||
                item.kind === 'skill' ||
                item.kind === 'plugin') && (
                <small>
                  {item.kind === 'skill'
                    ? (item.detail ?? `Personal · v${item.version}`)
                    : item.kind === 'plugin'
                      ? item.detail || `Installed v${item.version}`
                      : item.detail || item.serverId}
                </small>
              )}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
