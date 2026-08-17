import * as React from 'react'
import {
  CaretDownIcon,
  CheckIcon,
  SpinnerGapIcon,
  StopIcon,
  XIcon,
} from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/Collapsible'
import {
  formatNotebookAiActivityDuration,
  getNotebookAiActivityItemLabel,
  getNotebookAiActivitySummary,
  type NotebookAiActivity,
  type NotebookAiActivityDetails,
  type NotebookAiActivityItem,
  type NotebookAiActivityItemStatus,
  type NotebookAiActivityStatus,
} from '~/utils/notebook-ai-activity'

export function NotebookAgentActivity({
  activity,
  className,
  defaultOpen,
  open: controlledOpen,
  onOpenChange,
}: {
  activity: NotebookAiActivity
  className?: string
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const triggerId = React.useId()
  const contentId = React.useId()
  const manuallyChangedRef = React.useRef(false)
  const previousStatusRef = React.useRef(activity.status)
  const previousActivityIdRef = React.useRef(activity.id)
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
    defaultOpen ?? shouldOpenActivity(activity.status),
  )
  const open = controlledOpen ?? uncontrolledOpen
  const summary = getNotebookAiActivitySummary(activity)
  const actionCount = activity.items.length
  const actionCountLabel = formatCount(actionCount, 'action')
  const meta =
    activity.completedAt !== undefined
      ? `${actionCountLabel} · ${formatNotebookAiActivityDuration(activity)}`
      : actionCountLabel

  React.useEffect(() => {
    if (previousActivityIdRef.current !== activity.id) {
      previousActivityIdRef.current = activity.id
      manuallyChangedRef.current = false
      if (controlledOpen === undefined) {
        setUncontrolledOpen(defaultOpen ?? shouldOpenActivity(activity.status))
      }
    } else if (
      previousStatusRef.current !== activity.status &&
      !manuallyChangedRef.current &&
      controlledOpen === undefined
    ) {
      setUncontrolledOpen(shouldOpenActivity(activity.status))
    }
    previousStatusRef.current = activity.status
  }, [activity.id, activity.status, controlledOpen, defaultOpen])

  return (
    <section
      aria-label="Agent activity"
      aria-busy={activity.status === 'running'}
      className={twMerge('w-full text-sm', className)}
    >
      <Collapsible
        open={open}
        onOpenChange={(nextOpen) => {
          manuallyChangedRef.current = true
          if (controlledOpen === undefined) setUncontrolledOpen(nextOpen)
          onOpenChange?.(nextOpen)
        }}
      >
        <CollapsibleTrigger
          id={triggerId}
          aria-controls={contentId}
          className="group flex min-h-8 w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-text-secondary outline-none transition-colors duration-150 hover:bg-background-subtle focus-visible:ring-2 focus-visible:ring-border-focus motion-reduce:transition-none"
        >
          <ActivityStatusIcon status={activity.status} />
          <span
            className={twMerge(
              'min-w-0 flex-1 truncate font-medium',
              activity.status === 'error' && 'text-text-error',
            )}
          >
            {summary}
          </span>
          <span className="shrink-0 text-xs text-text-muted">{meta}</span>
          <CaretDownIcon
            className={twMerge(
              'size-3.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none',
              !open && '-rotate-90',
            )}
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <CollapsibleContent
          id={contentId}
          role="region"
          aria-labelledby={triggerId}
          className="motion-reduce:transition-none"
        >
          <ol className="mt-1 ml-3 border-l border-border-default py-1 pl-3">
            {activity.items.map((item) => (
              <li key={item.id} className="py-0.5">
                <ActivityItem item={item} />
              </li>
            ))}
          </ol>
          {activity.error ? (
            <pre
              className="mt-2 ml-3 max-h-48 overflow-auto rounded-lg border border-border-default border-l-2 border-l-border-error bg-background-elevated px-3 py-2 font-ds-mono text-xs/5 whitespace-pre-wrap text-text-secondary"
              aria-label="Agent error"
            >
              {activity.error}
            </pre>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
      <span className="sr-only" role="status" aria-live="polite">
        {summary}
      </span>
    </section>
  )
}

function ActivityItem({ item }: { item: NotebookAiActivityItem }) {
  const triggerId = React.useId()
  const contentId = React.useId()
  const [open, setOpen] = React.useState(false)
  const hasDetails = hasActivityDetails(item.details) || Boolean(item.error)
  const label = getNotebookAiActivityItemLabel(item)

  if (!hasDetails) {
    return (
      <div className="flex min-h-7 items-center gap-2 px-1.5 py-1 text-text-muted">
        <ActivityItemStatusIcon status={item.status} />
        <span className="min-w-0 truncate">{label}</span>
      </div>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        id={triggerId}
        aria-controls={contentId}
        className="group flex min-h-7 w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-text-muted outline-none transition-colors duration-150 hover:bg-background-subtle hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-border-focus motion-reduce:transition-none"
      >
        <ActivityItemStatusIcon status={item.status} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <CaretDownIcon
          className={twMerge(
            'size-3 shrink-0 transition-transform duration-150 motion-reduce:transition-none',
            !open && '-rotate-90',
          )}
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent
        id={contentId}
        role="region"
        aria-labelledby={triggerId}
        className="motion-reduce:transition-none"
      >
        <ActivityItemDetails item={item} />
      </CollapsibleContent>
    </Collapsible>
  )
}

function ActivityItemDetails({ item }: { item: NotebookAiActivityItem }) {
  const details = item.details
  const range = formatRange(details)
  const attempt =
    details.attempt === undefined
      ? undefined
      : details.maxAttempts === undefined
        ? String(details.attempt)
        : `${details.attempt}/${details.maxAttempts}`

  return (
    <div className="mx-1.5 mt-1 mb-2 rounded-lg bg-background-subtle px-3 py-2 text-xs/5 text-text-muted">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
        {details.path ? (
          <Detail label="File" value={details.path} mono />
        ) : null}
        {details.runtime ? (
          <Detail label="Runtime" value={details.runtime} />
        ) : null}
        {details.entry ? (
          <Detail label="Entry" value={details.entry} mono />
        ) : null}
        {details.packageName ? (
          <Detail
            label="Package"
            value={
              details.packageVersion
                ? `${details.packageName}@${details.packageVersion}`
                : details.packageName
            }
            mono
          />
        ) : null}
        {range ? <Detail label="Range" value={range} mono /> : null}
        {details.characters !== undefined ? (
          <Detail
            label="Size"
            value={`${details.characters.toLocaleString()} characters`}
          />
        ) : null}
        {details.phase ? <Detail label="Phase" value={details.phase} /> : null}
        {attempt ? <Detail label="Attempt" value={attempt} /> : null}
      </dl>
      {details.paths?.length ? (
        <div className="mt-2">
          <p className="font-medium text-text-secondary">Files</p>
          <ul className="mt-1 space-y-0.5 font-ds-mono">
            {details.paths.map((path) => (
              <li key={path} className="break-all">
                {path}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {details.diff ? (
        <pre
          className="mt-2 max-h-72 overflow-auto rounded-md bg-background-default px-2.5 py-2 font-ds-mono text-xs/5 whitespace-pre text-text-secondary"
          aria-label={details.path ? `Diff for ${details.path}` : 'File diff'}
        >
          {details.diff}
        </pre>
      ) : null}
      {details.message ? (
        <pre
          className="mt-2 max-h-48 overflow-auto font-ds-mono text-xs/5 whitespace-pre-wrap text-text-secondary"
          aria-label={
            item.source === 'reasoning' ? 'Reasoning summary' : 'Action output'
          }
        >
          {details.message}
        </pre>
      ) : null}
      {item.error ? (
        <pre
          className="mt-2 max-h-48 overflow-auto font-ds-mono text-xs/5 whitespace-pre-wrap text-text-error"
          aria-label="Action error"
        >
          {item.error}
        </pre>
      ) : null}
    </div>
  )
}

function Detail({
  label,
  mono,
  value,
}: {
  label: string
  mono?: boolean
  value: string
}) {
  return (
    <>
      <dt>{label}</dt>
      <dd
        className={twMerge(
          'min-w-0 break-all text-text-secondary',
          mono && 'font-ds-mono',
        )}
      >
        {value}
      </dd>
    </>
  )
}

function ActivityStatusIcon({ status }: { status: NotebookAiActivityStatus }) {
  if (status === 'running') {
    return (
      <SpinnerGapIcon
        className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
    )
  }
  if (status === 'complete') {
    return <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
  }
  if (status === 'stopped') {
    return <StopIcon className="size-4 shrink-0" aria-hidden="true" />
  }
  return (
    <XIcon className="size-4 shrink-0 text-text-error" aria-hidden="true" />
  )
}

function ActivityItemStatusIcon({
  status,
}: {
  status: NotebookAiActivityItemStatus
}) {
  if (status === 'preparing' || status === 'running') {
    return (
      <SpinnerGapIcon
        className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
    )
  }
  if (status === 'complete') {
    return <CheckIcon className="size-3.5 shrink-0" aria-hidden="true" />
  }
  if (status === 'stopped') {
    return <StopIcon className="size-3.5 shrink-0" aria-hidden="true" />
  }
  return (
    <XIcon className="size-3.5 shrink-0 text-text-error" aria-hidden="true" />
  )
}

function shouldOpenActivity(status: NotebookAiActivityStatus) {
  return status === 'running' || status === 'error' || status === 'stopped'
}

function hasActivityDetails(details: NotebookAiActivityDetails) {
  return Object.keys(details).length > 0
}

function formatRange(details: NotebookAiActivityDetails) {
  if (details.offset === undefined) return undefined
  const end = details.nextOffset ?? details.totalCharacters
  return end === undefined
    ? details.offset.toLocaleString()
    : `${details.offset.toLocaleString()}–${end.toLocaleString()}`
}

function formatCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}
