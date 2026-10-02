export function PendingMessage({
  text,
  fileCount = 0,
  uncertain = false,
}: {
  text: string
  fileCount?: number
  uncertain?: boolean
}) {
  return (
    <article className="message user" aria-label="Pending message">
      <div className="message-content">
        <p style={{ whiteSpace: 'pre-wrap' }}>{text}</p>
        {!!fileCount && (
          <span>
            {fileCount} attached {fileCount === 1 ? 'file' : 'files'}
          </span>
        )}
        <small role="status">
          {uncertain ? 'Not yet confirmed' : 'Sending…'}
        </small>
      </div>
    </article>
  )
}
