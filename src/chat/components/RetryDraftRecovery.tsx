import { useState } from 'react'
import { Download } from 'lucide-react'
import type { RetryDraftDocument } from '../core/retry-draft'
import { CopyButton } from './CopyButton'
import { IconButton } from './IconButton'

/** Retained independently of copyOrigin, which a conversation reset can clear. */
export function RetryDraftRecovery({
  document,
  busy,
  onContinue,
}: {
  document: RetryDraftDocument
  busy: boolean
  onContinue: () => void
}) {
  const [error, setError] = useState('')
  return (
    <section
      className="retry-draft-recovery"
      aria-label="Unsent edits from accepted retry"
    >
      <p>
        Your request was sent before these later edits. The saved draft is kept
        on this device.
      </p>
      <details open>
        <summary>Unsent edits</summary>
        <pre>{document.draft.text}</pre>
        {document.draft.attachments.map((file) => (
          <div key={file.id}>{file.name}</div>
        ))}
        {document.draft.references.map((reference, i) => (
          <div key={i}>{reference.label}</div>
        ))}
      </details>
      <CopyButton label="Copy unsent text" text={document.draft.text} />
      <IconButton
        label="Download complete saved draft"
        onClick={() => {
          try {
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(document.draft, null, 2)], {
                type: 'application/json',
              }),
            )
            const link = window.document.createElement('a')
            link.href = url
            link.download = 'gum-unsent-draft.json'
            link.click()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
          } catch {
            setError('The saved draft could not be downloaded.')
          }
        }}
      >
        <Download size={14} aria-hidden />
      </IconButton>
      <button
        type="button"
        className="quiet-button"
        disabled={busy}
        onClick={onContinue}
      >
        Continue
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
