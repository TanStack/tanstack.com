import { useState } from 'react'
import { Pencil } from 'lucide-react'
import type { WorkspaceBot } from '../core/bot-workspace'
import { workspaceApi } from './WorkspaceApi'
import { BotAvatar } from './BotAvatar'
import { AvatarEditor } from './AvatarEditor'
import { IconButton } from './IconButton'
import { Modal } from './ui/Modal'
import './personal-assistant.css'

export function PersonalAssistant({
  userId,
  assistant,
  active,
  working,
  onOpen,
  onChanged,
}: {
  userId: string
  assistant: WorkspaceBot
  active: boolean
  working: boolean
  onOpen: () => void
  onChanged: () => void | Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const api = workspaceApi(`personal:${userId}`)
  return (
    <div className="personal-assistant">
      <button
        type="button"
        className="personal-assistant-open"
        aria-current={active ? 'page' : undefined}
        onClick={onOpen}
      >
        <BotAvatar
          botId={assistant.id}
          customization={assistant.avatar}
          compactDot
          active={active}
          working={working}
        />
        <span className="personal-assistant-copy">
          <strong>Assistant</strong>
          <small>{working ? 'Working' : 'Your assistant'}</small>
        </span>
      </button>
      <IconButton label="Edit Assistant" onClick={() => setEditing(true)}>
        <Pencil size={15} aria-hidden />
      </IconButton>
      {editing && (
        <Modal
          title="Your assistant"
          onClose={() => setEditing(false)}
          busy={busy}
          className="bw-dialog"
        >
          <AvatarEditor
            key={assistant.id}
            botId={assistant.id}
            name="Assistant"
            nameEditable={false}
            value={assistant.avatar}
            busy={busy}
            onSave={async ({ avatar }) => {
              setBusy(true)
              try {
                await api.request(
                  `bots/${encodeURIComponent(assistant.id)}`,
                  { version: assistant.version, avatar },
                  'PATCH',
                )
                await onChanged()
                setEditing(false)
              } finally {
                setBusy(false)
              }
            }}
          />
        </Modal>
      )}
    </div>
  )
}
