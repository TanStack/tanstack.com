import { Link } from '@tanstack/react-router'
import { File as FileIcon } from 'lucide-react'
import type { MessageAttachment } from '../core/message-attachments'
import { defaultWorkspaceSearch } from '../core/navigation'
import { useWorkspaceApi } from './WorkspaceApi'
import { conversationLocation } from '../core/conversation-destination'
import './composer-attachments.css'

export function MessageAttachments({ files }: { files: MessageAttachment[] }) {
  const { workspaceId } = useWorkspaceApi()
  if (!files.length) return null
  return (
    <ul className="message-attachments" aria-label="Attachments">
      {files.map((file) => (
        <li key={file.id}>
          <FileIcon size={15} aria-hidden />
          {workspaceId ? (
            <Link
              {...conversationLocation(
                { workspaceId, ...file },
                { ...defaultWorkspaceSearch, panel: `file:${file.id}` },
              )}
            >
              {file.name}
            </Link>
          ) : (
            <span>{file.name}</span>
          )}
        </li>
      ))}
    </ul>
  )
}
