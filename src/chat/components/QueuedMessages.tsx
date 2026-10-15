import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { QueueCommand, QueueSnapshot } from '../core/conversation-queue'
import type { RunModelSelection } from '../core/run-model'
import { Button } from './ui/Button'
import { IconButton } from './IconButton'
import { MessageAttachments } from './MessageAttachments'
import { MessageReferences } from './MessageReferences'
import './queued-messages.css'

export function QueuedMessages({
  queue,
  waiting,
  disabled,
  onCommand,
}: {
  queue?: QueueSnapshot
  running: boolean
  waiting: boolean
  disabled: boolean
  onCommand: (command: QueueCommand) => Promise<void>
  getModelLabel?: (selection: RunModelSelection) => string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const items = queue?.items ?? []
  if (!queue || !items.length) return null
  const locked = busy || disabled
  const command = async (value: QueueCommand) => {
    if (locked || pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await onCommand(value)
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not update the pending messages.',
      )
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <section className="queued-messages" aria-label="Pending messages">
      <div className="queue-heading">
        <span className="queue-note" role="status">
          {queue.paused ? 'Not sent yet' : 'Sending next'}
          {items.length > 1 ? ` (${items.length})` : ''}
        </span>
        {queue.paused && (
          <Button
            variant="secondary"
            type="button"
            disabled={locked || waiting}
            onClick={() =>
              void command({ type: 'resume', version: queue.version })
            }
          >
            {items.length === 1 ? 'Send' : 'Send messages'}
          </Button>
        )}
      </div>
      <ol>
        {items.map((item, index) => (
          <li key={item.id} className="queue-pending-row">
            <div className="queue-pending-content">
              <p className="queued-text">{item.text}</p>
              <MessageAttachments files={item.attachments ?? []} />
              <MessageReferences references={item.references ?? []} />
            </div>
            <IconButton
              label={`Remove pending message ${index + 1}`}
              disabled={locked}
              onClick={() =>
                void command({
                  type: 'delete',
                  id: item.id,
                  version: queue.version,
                })
              }
            >
              <Trash2 size={15} aria-hidden />
            </IconButton>
          </li>
        ))}
      </ol>
      {waiting && (
        <p className="queue-note">
          Waiting for your response to the pending action.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  )
}
