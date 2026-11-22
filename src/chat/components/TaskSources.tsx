import { Link } from '@tanstack/react-router'
import {
  BookOpenIcon,
  CaretRightIcon,
  ChatCenteredIcon,
  FileIcon,
  PackageIcon,
  PlugIcon,
  WrenchIcon,
} from '@phosphor-icons/react'
import type { MessageReference } from '../core/message-references'
import { referenceKey } from '../core/message-references'
import { conversationLocation } from '../core/conversation-destination'
import { defaultWorkspaceSearch } from '../core/navigation'
import { useWorkspaceApi } from './WorkspaceApi'

const kinds = {
  file: { label: 'File', icon: FileIcon },
  conversation: { label: 'Conversation', icon: ChatCenteredIcon },
  connection: { label: 'Connection', icon: PlugIcon },
  tool: { label: 'Tool', icon: WrenchIcon },
  kody: { label: 'Kody', icon: PackageIcon },
  skill: { label: 'Skill', icon: BookOpenIcon },
  plugin: { label: 'Plugin', icon: PackageIcon },
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
                  <CaretRightIcon size={15} aria-hidden />
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
