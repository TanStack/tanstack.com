import type { Approval } from '../core/types'
import './kody-memory-create-review.css'

export function KodyMemoryCreateReview({ approval }: { approval: Approval }) {
  const review = approval.kodyMemoryCreate!
  return (
    <div className="kody-memory-create-review">
      <p>{review.candidate.summary}</p>
      {approval.status === 'pending' && (
        <p>Available to agents connected to your Kody account.</p>
      )}
      {review.candidate.details && (
        <details>
          <summary>Details</summary>
          <p>{review.candidate.details}</p>
        </details>
      )}
      {review.related.length > 0 && (
        <details>
          <summary>Related Kody memories ({review.related.length})</summary>
          <ul>
            {review.related.map((memory) => (
              <li key={memory.id}>
                <strong>{memory.subject}</strong>
                <span>{memory.summary}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {approval.status === 'running' && <p role="status">Saving to Kody…</p>}
      {approval.status === 'pending' &&
        approval.executionOutcome === 'unknown' && (
          <p role="alert">{approval.result}</p>
        )}
      {approval.status === 'error' && <p role="alert">{approval.result}</p>}
    </div>
  )
}
