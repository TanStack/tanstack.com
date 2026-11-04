export function PendingMessage({
  text,
  fileCount = 0,
  uncertain = false,
  thinking = false,
}: {
  text: string
  fileCount?: number
  uncertain?: boolean
  thinking?: boolean
}) {
  return (
    <>
      <article className="message user" aria-label="Pending message">
        <div className="message-content">
          <p style={{ whiteSpace: 'pre-wrap' }}>{text}</p>
          {!!fileCount && (
            <span>
              {fileCount} attached {fileCount === 1 ? 'file' : 'files'}
            </span>
          )}
          {uncertain && <small role="status">Not yet confirmed</small>}
        </div>
      </article>
      {thinking && !uncertain && (
        <p className="turn-system-message" role="status">
          Thinking…
        </p>
      )}
    </>
  )
}
