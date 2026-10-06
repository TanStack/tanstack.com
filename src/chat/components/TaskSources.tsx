import { Link } from '@tanstack/react-router'
import {
  BookOpen,
  ChevronRight,
  File,
  MessageSquare,
  Package,
  Plug,
  Wrench,
} from 'lucide-react'
import type { MessageReference } from '../core/message-references'
import { referenceKey } from '../core/message-references'
import { conversationLocation } from '../core/conversation-destination'
import { defaultWorkspaceSearch } from '../core/navigation'
import { useWorkspaceApi } from './WorkspaceApi'

const kinds = {
  file: { label: 'File', icon: File },
  conversation: { label: 'Conversation', icon: MessageSquare },
  connection: { label: 'Connection', icon: Plug },
  tool: { label: 'Tool', icon: Wrench },
  kody: { label: 'Kody', icon: Package },
  skill: { label: 'Skill', icon: BookOpen },
  plugin: { label: 'Plugin', icon: Package },
}

export function TaskSources({ sources }: { sources: MessageReference[] }) {
  const { workspaceId } = useWorkspaceApi()
  if (!sources.length) return null
  return (
    <section aria-label="Selected inputs">
      <h3>Selected inputs</h3>
      <ul>
        {sources.map((source) => {
          const { icon: Icon, label: kind } = kinds[source.kind]
          const content = (
            <>
              <Icon size={17} aria-hidden />
              <span title={source.label}>{source.label}</span>
            </>
          )
          const location =
            workspaceId &&
            (source.kind === 'file' || source.kind === 'conversation')
              ? conversationLocation(
                  { workspaceId, ...source },
                  {
                    ...defaultWorkspaceSearch,
                    ...(source.kind === 'file'
                      ? { panel: `file:${source.fileId}` as const }
                      : {}),
                  },
                )
              : undefined
          return (
            <li key={referenceKey(source)}>
              {location ? (
                <Link
                  {...location}
                  className="details-summary-link"
                  aria-label={`Open ${kind.toLowerCase()}: ${source.label}`}
                >
                  {content}
                  <ChevronRight size={15} aria-hidden />
                </Link>
              ) : (
                <div
                  className="details-summary-item"
                  aria-label={`${kind}: ${source.label}`}
                >
                  {content}
                  <small>
                    {source.kind === 'skill'
                      ? `v${source.version}`
                      : source.kind === 'plugin'
                        ? source.detail || `Installed v${source.version}`
                        : kind}
                  </small>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
