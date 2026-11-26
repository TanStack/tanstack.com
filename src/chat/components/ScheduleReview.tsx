import type { Approval } from '../core/types'
import { CodeBlock } from './MessageMarkdown'
import './schedule-review.css'

export function ScheduleReview({ approval }: { approval: Approval }) {
  const review = approval.schedule!
  const spec = review.command.spec
  const cadence = spec.recurrence
  const time =
    cadence.kind === 'once'
      ? ''
      : `${String(cadence.hour).padStart(2, '0')}:${String(cadence.minute).padStart(2, '0')}`
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return (
    <div className="schedule-review">
      {approval.status === 'pending' && (
        <p>
          {review.reason === 'timezone-unset'
            ? 'Confirm the timezone for this schedule. Your account has no saved timezone.'
            : review.command.type === 'create'
              ? `This schedule uses ${spec.timezone} instead of your account timezone, ${review.previousTimezone}.`
              : `This changes the schedule’s timezone from ${review.previousTimezone} to ${spec.timezone}.`}
        </p>
      )}
      <p className="schedule-review-objective">{spec.objective}</p>
      <dl>
        <div>
          <dt>When</dt>
          <dd>
            {cadence.kind === 'once'
              ? 'Once'
              : cadence.kind === 'daily'
                ? `Every day at ${time}`
                : `${cadence.days.map((day) => days[day - 1]).join(', ')} at ${time}`}
          </dd>
        </div>
        <div>
          <dt>Timezone</dt>
          <dd>{spec.timezone}</dd>
        </div>
        <div>
          <dt>{cadence.kind === 'once' ? 'Time' : 'Next run'}</dt>
          <dd>{review.nextRun.local}</dd>
        </div>
      </dl>
      {(spec.runModel || spec.references?.length) && (
        <details>
          <summary>Model and references</summary>
          <CodeBlock
            code={JSON.stringify(
              { model: spec.runModel, references: spec.references },
              null,
              2,
            )}
            lang="json"
          />
        </details>
      )}
      {approval.status === 'running' && <p role="status">Saving schedule…</p>}
      {approval.status === 'error' && <p role="alert">{approval.result}</p>}
    </div>
  )
}
