import { X } from 'lucide-react'
import type { useRetryPreparation } from './useRetryPreparation'
import { IconButton } from './IconButton'
import './retry.css'

export function RetryPreparation({
  preparation,
}: {
  preparation: ReturnType<typeof useRetryPreparation>
}) {
  const record = preparation.record
  const failed =
    !!record?.attemptId &&
    preparation.attempt?.attemptId === record.attemptId &&
    preparation.attempt.status === 'failed'
  if (!record && !preparation.error) return null
  return (
    <div className="retry-preparation">
      <span role={preparation.error ? 'alert' : 'status'}>
        {preparation.error ||
          (preparation.busy
            ? 'Preparing a new attempt…'
            : 'Retry preparation is saved.')}
      </span>
      {record && !preparation.busy && (
        <button
          type="button"
          className="quiet-button"
          onClick={() => void preparation.begin(record.messageId, failed)}
        >
          {failed ? 'Review again' : 'Resume preparation'}
        </button>
      )}
      {preparation.busy && (
        <IconButton
          label="Pause preparation"
          className="message-action"
          onClick={preparation.stop}
        >
          <X size={14} aria-hidden />
        </IconButton>
      )}
    </div>
  )
}
