import { LoadingState } from './ui/LoadingState'
import { SelectField } from './SelectField'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Temporal } from '@js-temporal/polyfill'
import {
  CirclePlay,
  MessageSquare,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { z } from 'zod'
import {
  scheduleCommandSchema,
  scheduleSnapshotSchema,
  scheduleSpecSchema,
  type ScheduleCommand,
  type ScheduleOccurrence,
  type ScheduleRecord,
  type ScheduleSnapshot,
  type ScheduleSpec,
} from '../core/schedules'
import { nextScheduleTime } from '../core/schedule-preview'
import {
  conversationResourcePath,
  type ConversationResource,
} from '../core/conversation-destination'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'
import { IconButton } from './IconButton'
import {
  confirmedAccountTimezone,
  useAccountPreferences,
} from './account-preferences-client'
import './schedules.css'

type Props = {
  userId: string
  botId: string
  conversationId?: string
  readOnly?: boolean
  runVersion?: string
  onSelectMessage?: (id: string) => void
}
const outstanding = new Set<ScheduleOccurrence['status']>([
  'pending',
  'queued',
  'running',
  'waiting_approval',
  'waiting_user',
  'waiting_children',
])
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const runLabels: Record<ScheduleOccurrence['status'], string> = {
  pending: 'Waiting to start',
  queued: 'Queued',
  running: 'Running',
  waiting_approval: 'Waiting for approval',
  waiting_user: 'Waiting for you',
  waiting_children: 'Waiting for delegated work',
  completed: 'Finished',
  incomplete: 'Incomplete',
  interrupted: 'Interrupted',
  cancelled: 'Cancelled',
  failed: 'Failed',
  skipped: 'Skipped',
}
const accessDenied = (cause: unknown) =>
  cause instanceof ApiError && [401, 403, 404].includes(cause.status)
export const definiteScheduleRejection = (cause: unknown) =>
  cause instanceof ApiError && [400, 409, 413, 422].includes(cause.status)
function errorMessage(cause: unknown) {
  if (cause instanceof z.ZodError) {
    const issue = cause.issues[0]
    return `${String(issue?.path[0] ?? 'Schedule')}: ${issue?.message ?? 'Check the settings.'}`
  }
  return cause instanceof Error ? cause.message : 'The schedule request failed.'
}
export const scheduleCommandStorageKey = (
  userId: string,
  workspaceId: string | undefined,
  source: ConversationResource,
) =>
  JSON.stringify([
    'gum',
    'schedule-command',
    1,
    userId,
    workspaceId,
    source.botId,
    conversationResourcePath(source),
  ])
type CommandStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** An uncertain command is frozen across reloads. A retry never creates a new
 * run-now ID or overwrites its original settings with edits made afterward. */
export class ScheduleCommandStore {
  constructor(
    private storage: CommandStorage,
    readonly key: string,
  ) {}
  read(): ScheduleCommand | null {
    const raw = this.storage.getItem(this.key)
    if (raw === null) return null
    if (new TextEncoder().encode(raw).byteLength > 192 * 1024)
      throw new Error(
        'The saved schedule change is too large to recover on this device.',
      )
    return scheduleCommandSchema.parse(JSON.parse(raw))
  }
  create(value: ScheduleCommand) {
    const existing = this.read()
    if (existing) return existing
    const command = scheduleCommandSchema.parse(value)
    const raw = JSON.stringify(command)
    if (new TextEncoder().encode(raw).byteLength > 192 * 1024)
      throw new Error(
        'This schedule change is too large to save on this device.',
      )
    this.storage.setItem(this.key, raw)
    if (this.storage.getItem(this.key) !== raw)
      throw new Error(
        'The schedule change could not be saved on this device. Nothing was sent.',
      )
    return command
  }
  clear(commandId: string) {
    if (this.read()?.commandId !== commandId) return
    this.storage.removeItem(this.key)
    if (this.storage.getItem(this.key) !== null)
      throw new Error(
        'The saved change could not be cleared on this device. Retry to confirm it.',
      )
  }
}

export type ScheduleFields = {
  name: string
  objective: string
  timezone: string
  kind: ScheduleSpec['recurrence']['kind']
  time: string
  dateTime: string
  days: number[]
}
export function scheduleFields(
  spec?: ScheduleSpec,
  now = Date.now(),
  defaultTimezone?: string,
): ScheduleFields {
  const timezone =
    spec?.timezone ??
    defaultTimezone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    'UTC'
  const recurrence = spec?.recurrence
  const local = Temporal.Instant.fromEpochMilliseconds(
    recurrence?.kind === 'once' ? recurrence.at : now + 86400000,
  ).toZonedDateTimeISO(timezone)
  return {
    name: spec?.name ?? '',
    objective: spec?.objective ?? '',
    timezone,
    kind: recurrence?.kind ?? 'daily',
    time:
      recurrence && recurrence.kind !== 'once'
        ? `${String(recurrence.hour).padStart(2, '0')}:${String(recurrence.minute).padStart(2, '0')}`
        : '09:00',
    dateTime: local
      .toPlainDateTime()
      .with({ second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 })
      .toString({ smallestUnit: 'minute' }),
    days:
      recurrence?.kind === 'weekly' ? [...recurrence.days] : [1, 2, 3, 4, 5],
  }
}
export function scheduleSpecFromFields(
  fields: ScheduleFields,
  original?: ScheduleSpec,
): ScheduleSpec {
  let recurrence: ScheduleSpec['recurrence']
  if (fields.kind === 'once') {
    let wall: Temporal.PlainDateTime, instant: Temporal.ZonedDateTime
    try {
      wall = Temporal.PlainDateTime.from(fields.dateTime, {
        overflow: 'reject',
      })
      instant = wall.toZonedDateTime(fields.timezone, {
        disambiguation: 'earlier',
      })
    } catch {
      throw new Error('Choose a valid date, time and timezone.')
    }
    if (!instant.toPlainDateTime().equals(wall))
      throw new Error(
        'That local time is skipped by a clock change. Choose another time.',
      )
    // Preserve a previously stored exact instant, including the later fold and
    // seconds, when its local date/time has not been edited.
    const prior = original && scheduleFields(original)
    recurrence =
      original?.recurrence.kind === 'once' &&
      prior?.dateTime === fields.dateTime &&
      prior.timezone === fields.timezone
        ? original.recurrence
        : { kind: 'once', at: instant.epochMilliseconds }
  } else {
    if (!/^\d{2}:\d{2}$/.test(fields.time))
      throw new Error('Choose a valid time.')
    const [hour, minute] = fields.time.split(':').map(Number)
    recurrence =
      fields.kind === 'daily'
        ? { kind: 'daily', hour, minute }
        : { kind: 'weekly', days: fields.days, hour, minute }
  }
  return scheduleSpecSchema.parse({
    ...original,
    name: fields.name,
    objective: fields.objective,
    timezone: fields.timezone,
    recurrence,
  })
}
function formatTime(at: number, timezone?: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(at)
}
export function scheduleCadence(spec: ScheduleSpec) {
  const recurrence = spec.recurrence
  if (recurrence.kind === 'once')
    return `Once · ${formatTime(recurrence.at, spec.timezone)}`
  const time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(Date.UTC(2000, 0, 1, recurrence.hour, recurrence.minute))
  return `${
    recurrence.kind === 'daily'
      ? 'Daily'
      : [...recurrence.days]
          .sort((a, b) => a - b)
          .map((day) => weekdays[day - 1])
          .join(', ')
  } · ${time}`
}
function reasonLabel(reason: string) {
  return (
    (
      {
        'paused-by-user': '',
        'schedule-changed': 'Schedule changed',
        'cancelled-by-user': 'Cancelled by you',
        'start-deadline': 'Too late to start',
        missed: 'Too late to start',
        'missed-deadline': 'Too late to start',
        overlap: 'An earlier run is unfinished',
        'conversation-reset': 'Conversation reset',
        'access-unavailable': 'Access is unavailable',
        'queue-full': 'Queue is full',
        'queue-paused': 'Queue is paused',
      } as Record<string, string>
    )[reason] ?? 'Check this schedule before continuing.'
  )
}

export function ScheduleEditor({
  record,
  defaultTimezone,
  disabled,
  onSave,
  onCancel,
}: {
  record?: ScheduleRecord
  defaultTimezone?: string
  disabled: boolean
  onSave: (spec: ScheduleSpec) => void
  onCancel: () => void
}) {
  const nameInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    nameInput.current?.focus()
  }, [])
  const [fields, setFields] = useState(() =>
    scheduleFields(record?.spec, Date.now(), defaultTimezone),
  )
  const [error, setError] = useState('')
  const policyId = useId()
  const repeatId = useId()
  const preview: number[] = []
  try {
    const spec = scheduleSpecFromFields(fields, record?.spec)
    let after = Date.now()
    for (let i = 0; i < 3; i++) {
      const next = nextScheduleTime(spec, after)
      if (next === undefined) break
      preview.push(next)
      after = next
    }
  } catch {
    /* Incomplete fields are explained on submit, not while typing. */
  }
  const change = <K extends keyof ScheduleFields>(
    key: K,
    value: ScheduleFields[K],
  ) => setFields((previous) => ({ ...previous, [key]: value }))
  return (
    <form
      className="schedule-editor"
      onSubmit={(event) => {
        event.preventDefault()
        if (disabled) return
        try {
          const spec = scheduleSpecFromFields(fields, record?.spec)
          if (!record && nextScheduleTime(spec, Date.now()) === undefined)
            throw new Error('Choose a future time.')
          setError('')
          onSave(spec)
        } catch (cause) {
          setError(errorMessage(cause))
        }
      }}
    >
      <fieldset disabled={disabled}>
        <legend>{record ? 'Edit schedule' : 'New schedule'}</legend>
        <label>
          Name
          <input
            ref={nameInput}
            required
            maxLength={80}
            value={fields.name}
            onChange={(event) => change('name', event.target.value)}
          />
        </label>
        <label>
          Task
          <textarea
            required
            maxLength={12000}
            rows={3}
            value={fields.objective}
            placeholder="What should happen?"
            onChange={(event) => change('objective', event.target.value)}
          />
        </label>
        <div className="schedule-form-row">
          <label htmlFor={repeatId}>
            Repeat
            <SelectField
              id={repeatId}
              value={fields.kind}
              onValueChange={(value) => {
                if (value === 'once' || value === 'daily' || value === 'weekly')
                  change('kind', value)
              }}
              items={[
                {
                  value: 'once',
                  label: 'Once',
                },
                {
                  value: 'daily',
                  label: 'Daily',
                },
                {
                  value: 'weekly',
                  label: 'Weekly',
                },
              ]}
            />
          </label>
          {fields.kind === 'once' ? (
            <label>
              Date and time
              <input
                type="datetime-local"
                required
                value={fields.dateTime}
                onChange={(event) => change('dateTime', event.target.value)}
                aria-describedby={policyId}
              />
            </label>
          ) : (
            <label>
              Time
              <input
                type="time"
                required
                value={fields.time}
                onChange={(event) => change('time', event.target.value)}
                aria-describedby={policyId}
              />
            </label>
          )}
        </div>
        {fields.kind === 'weekly' && (
          <fieldset className="schedule-weekdays">
            <legend>Days</legend>
            {weekdays.map((day, index) => (
              <label key={day}>
                <input
                  type="checkbox"
                  checked={fields.days.includes(index + 1)}
                  onChange={(event) =>
                    change(
                      'days',
                      event.target.checked
                        ? [...fields.days, index + 1]
                        : fields.days.filter((value) => value !== index + 1),
                    )
                  }
                />
                {day}
              </label>
            ))}
          </fieldset>
        )}
        <label>
          Timezone
          <input
            required
            maxLength={100}
            value={fields.timezone}
            onChange={(event) => change('timezone', event.target.value)}
            placeholder="America/Denver"
          />
        </label>
        <p className="schedule-note" id={policyId}>
          {fields.kind === 'once'
            ? 'Repeated local times use the earlier occurrence.'
            : 'During daylight saving changes, missing times are skipped and repeated times run once, at the earlier time.'}
        </p>
        {preview.length > 0 && (
          <div className="schedule-preview">
            <span>Next {preview.length === 1 ? 'run' : 'runs'}</span>
            <ol>
              {preview.map((at) => (
                <li key={at}>
                  <time dateTime={new Date(at).toISOString()}>
                    {formatTime(at, fields.timezone)}
                  </time>
                </li>
              ))}
            </ol>
          </div>
        )}
        {record && (
          <p className="schedule-note">Changes apply to future runs.</p>
        )}
        {error && (
          <p className="schedule-error" role="alert">
            {error}
          </p>
        )}
        <div className="schedule-form-actions">
          <button type="submit">
            {record ? 'Save changes' : 'Create schedule'}
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  )
}

export function ScheduleEntries({
  snapshot,
  disabled,
  readOnly,
  onEdit,
  onCommand,
  onSelectMessage,
}: {
  onSelectMessage?: (id: string) => void
  snapshot: ScheduleSnapshot
  disabled: boolean
  readOnly?: boolean
  onEdit: (record: ScheduleRecord) => void
  onCommand: (command: ScheduleCommand) => void
}) {
  const schedules = snapshot.schedules.filter(
    (record) => record.status !== 'deleted',
  )
  const act = (
    record: ScheduleRecord,
    type: 'pause' | 'resume' | 'delete' | 'run-now',
  ) =>
    onCommand({
      type,
      id: record.id,
      revision: record.revision,
      commandId: crypto.randomUUID(),
    })
  return (
    <>
      {!schedules.length && <p className="schedule-note">No schedules yet.</p>}
      <ul className="schedule-list">
        {schedules.map((record) => (
          <li key={record.id}>
            <div className="schedule-heading">
              <strong>{record.spec.name}</strong>
              <span>
                {record.status === 'paused'
                  ? 'Paused'
                  : record.nextDueAt === undefined
                    ? 'No future runs'
                    : 'Active'}
              </span>
            </div>
            <p className="schedule-cadence">
              {scheduleCadence(record.spec)}{' '}
              <span>· {record.spec.timezone}</span>
            </p>
            {record.nextDueAt !== undefined && (
              <p className="schedule-note">
                Next{' '}
                <time dateTime={new Date(record.nextDueAt).toISOString()}>
                  {formatTime(record.nextDueAt, record.spec.timezone)}
                </time>
              </p>
            )}
            {record.pauseReason && reasonLabel(record.pauseReason) && (
              <p className="schedule-note">{reasonLabel(record.pauseReason)}</p>
            )}
            <details className="schedule-task">
              <summary>Task</summary>
              <p>{record.spec.objective}</p>
              {record.spec.runModel && (
                <small>{record.spec.runModel.model}</small>
              )}
            </details>
            {!readOnly && (
              <div className="schedule-actions">
                <IconButton
                  label={`Run ${record.spec.name} now`}
                  tooltip="Run now"
                  disabled={
                    disabled ||
                    record.status !== 'active' ||
                    snapshot.occurrences.some(
                      (item) =>
                        item.scheduleId === record.id &&
                        outstanding.has(item.status),
                    )
                  }
                  onClick={() => act(record, 'run-now')}
                >
                  <CirclePlay size={16} aria-hidden />
                </IconButton>
                <IconButton
                  label={`Edit ${record.spec.name}`}
                  disabled={disabled}
                  onClick={() => onEdit(record)}
                >
                  <Pencil size={15} aria-hidden />
                </IconButton>
                <IconButton
                  label={`${record.status === 'paused' ? 'Resume' : 'Pause'} ${record.spec.name}`}
                  disabled={disabled}
                  onClick={() =>
                    act(record, record.status === 'paused' ? 'resume' : 'pause')
                  }
                >
                  {record.status === 'paused' ? (
                    <Play size={15} aria-hidden />
                  ) : (
                    <Pause size={15} aria-hidden />
                  )}
                </IconButton>
                <IconButton
                  label={`Delete ${record.spec.name}`}
                  tooltip="Delete schedule. An active run will continue."
                  disabled={disabled}
                  onClick={() => act(record, 'delete')}
                >
                  <Trash2 size={15} aria-hidden />
                </IconButton>
              </div>
            )}
          </li>
        ))}
      </ul>
      {snapshot.occurrences.length > 0 && (
        <section className="schedule-runs" aria-label="Scheduled runs">
          <h3>Recent runs</h3>
          <ol>
            {[...snapshot.occurrences]
              .sort(
                (a, b) =>
                  Number(outstanding.has(b.status)) -
                    Number(outstanding.has(a.status)) ||
                  b.createdAt - a.createdAt ||
                  b.id.localeCompare(a.id),
              )
              .slice(0, 20)
              .map((run) => {
                const schedule = snapshot.schedules.find(
                  (record) => record.id === run.scheduleId,
                )
                const messageId = run.runMessageId
                return (
                  <li key={run.id}>
                    <div>
                      <strong>
                        {schedule?.spec.name ?? 'Removed schedule'}
                      </strong>
                      <span>
                        {runLabels[run.status]} ·{' '}
                        {run.source === 'manual' ? 'Run now' : 'Scheduled'}
                      </span>
                      <time dateTime={new Date(run.dueAt).toISOString()}>
                        {formatTime(run.dueAt, schedule?.spec.timezone)}
                      </time>
                      {run.reason && reasonLabel(run.reason) && (
                        <span>{reasonLabel(run.reason)}</span>
                      )}
                    </div>
                    {messageId && onSelectMessage && (
                      <IconButton
                        label={`Open run conversation: ${schedule?.spec.name ?? 'Removed schedule'}`}
                        tooltip="Open run conversation"
                        onClick={() => onSelectMessage(messageId)}
                      >
                        <MessageSquare size={16} aria-hidden />
                      </IconButton>
                    )}
                    {!readOnly && outstanding.has(run.status) && (
                      <button
                        type="button"
                        className="secondary"
                        disabled={disabled}
                        onClick={() =>
                          onCommand({
                            type: 'cancel-run',
                            commandId: crypto.randomUUID(),
                            occurrenceId: run.id,
                          })
                        }
                      >
                        {run.status === 'pending' || run.status === 'queued'
                          ? 'Cancel run'
                          : 'Stop run'}
                      </button>
                    )}
                  </li>
                )
              })}
          </ol>
        </section>
      )}
    </>
  )
}

export function Schedules(props: Props) {
  const { workspaceId } = useWorkspaceApi()
  return (
    <SchedulePanel
      key={scheduleCommandStorageKey(props.userId, workspaceId, props)}
      {...props}
    />
  )
}
function SchedulePanel({
  userId,
  botId,
  conversationId,
  readOnly = false,
  runVersion,
  onSelectMessage,
}: Props) {
  const api = useWorkspaceApi()
  const preferences = useAccountPreferences(userId)
  const queries = useQueryClient()
  const source = { botId, conversationId }
  const resourcePath = conversationResourcePath(source)
  const path = `${resourcePath}/schedules`
  const key = useMemo(
    () => ['schedules', api.workspaceId, userId, botId, resourcePath],
    [api.workspaceId, userId, botId, resourcePath],
  )
  const storageKey = scheduleCommandStorageKey(userId, api.workspaceId, source)
  const [editor, setEditor] = useState<ScheduleRecord | 'new' | null>(null)
  const [pending, setPending] = useState<ScheduleCommand | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)
  const mounted = useRef(true)
  const locked = useRef(false)
  const lastRunVersion = useRef(runVersion)
  const validate = (value: unknown) => {
    const snapshot = scheduleSnapshotSchema.parse(value)
    if (
      snapshot.schedules.some(
        (record) =>
          record.identity.userId !== userId ||
          record.identity.botId !== botId ||
          (api.workspaceId !== undefined &&
            record.identity.workspaceId !== api.workspaceId) ||
          (conversationId !== undefined &&
            record.identity.conversationId !== conversationId),
      )
    )
      throw new Error(
        'These schedules belong to another conversation. Reload to continue.',
      )
    return snapshot
  }
  const query = useQuery({
    queryKey: key,
    queryFn: async () => validate(await api.request(path)),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: (current) =>
      busy || denied || accessDenied(current.state.error) ? false : 5000,
    refetchIntervalInBackground: false,
  })
  useEffect(() => {
    // The first mount already fetches. Only new run evidence refreshes this
    // exact conversation; defer while a command is publishing its snapshot.
    if (busy || denied || lastRunVersion.current === runVersion) return
    lastRunVersion.current = runVersion
    void queries.invalidateQueries({ queryKey: key, exact: true })
  }, [runVersion, queries, key, busy, denied])
  const recover = () => {
    try {
      setPending(new ScheduleCommandStore(localStorage, storageKey).read())
      setReady(true)
    } catch (cause) {
      setReady(false)
      setError(errorMessage(cause))
    }
  }
  useEffect(() => {
    mounted.current = true
    recover()
    const changed = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) {
        recover()
        void query.refetch()
      }
    }
    window.addEventListener('storage', changed)
    return () => {
      mounted.current = false
      window.removeEventListener('storage', changed)
    }
  }, [])
  async function command(value: ScheduleCommand) {
    if (locked.current || !ready || readOnly) return
    locked.current = true
    setBusy(true)
    setError('')
    try {
      if (!navigator.locks)
        throw new Error(
          'Use an up-to-date browser to save schedule changes safely.',
        )
      await navigator.locks.request(storageKey, async () => {
        if (!mounted.current) return
        const store = new ScheduleCommandStore(localStorage, storageKey)
        const frozen = store.create(value)
        setPending(frozen)
        if (frozen.commandId !== value.commandId)
          throw new Error(
            'Confirm the saved schedule change before making another.',
          )
        await queries.cancelQueries({ queryKey: key })
        let snapshot: ScheduleSnapshot
        try {
          snapshot = validate(await api.request(path, frozen))
        } catch (cause) {
          if (definiteScheduleRejection(cause)) store.clear(frozen.commandId)
          throw cause
        }
        store.clear(frozen.commandId)
        if (mounted.current) {
          queries.setQueryData(key, snapshot)
          setPending(null)
          setEditor(null)
          setDenied(false)
        }
      })
    } catch (cause) {
      if (mounted.current) {
        setError(errorMessage(cause))
        if (accessDenied(cause)) {
          setDenied(true)
          queries.removeQueries({ queryKey: key, exact: true })
        }
        if (definiteScheduleRejection(cause)) {
          setPending(null)
          if (cause instanceof ApiError && cause.status === 409) {
            setEditor(null)
            await query.refetch()
          }
        }
      }
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const blocked = readOnly || busy || !!pending || !ready
  const inaccessible = denied || accessDenied(query.error)
  const snapshot =
    query.isFetchedAfterMount && !query.isError && !inaccessible
      ? query.data
      : undefined
  return (
    <div className="schedules">
      <header className="schedules-toolbar">
        <IconButton
          label="Refresh schedules"
          disabled={busy}
          onClick={async () => {
            const result = await query.refetch()
            if (mounted.current && !result.isError) {
              setDenied(false)
              setError('')
            }
          }}
        >
          <RefreshCw size={16} aria-hidden />
        </IconButton>
        {!readOnly && (
          <button
            type="button"
            className="secondary"
            disabled={blocked || !snapshot || preferences.isPending}
            onClick={() => setEditor('new')}
          >
            <Plus size={15} aria-hidden /> New schedule
          </button>
        )}
      </header>
      {(error || query.isError) && (
        <p className="schedule-error" role="alert">
          {error || errorMessage(query.error)}
        </p>
      )}
      {!inaccessible && (
        <>
          {pending && (
            <div className="schedule-pending" role="status">
              <span>A schedule change needs confirmation.</span>
              <button
                className="secondary"
                type="button"
                disabled={busy || readOnly}
                onClick={() => void command(pending)}
              >
                {busy ? 'Confirming…' : 'Retry change'}
              </button>
            </div>
          )}
          {!ready && (
            <button type="button" className="secondary" onClick={recover}>
              Check device storage
            </button>
          )}
          {!query.isFetchedAfterMount && !query.isError && (
            <LoadingState>Loading schedules…</LoadingState>
          )}
          {snapshot && (
            <>
              {editor && !readOnly && (
                <ScheduleEditor
                  key={
                    editor === 'new' ? 'new' : `${editor.id}:${editor.revision}`
                  }
                  record={editor === 'new' ? undefined : editor}
                  defaultTimezone={confirmedAccountTimezone(preferences.data)}
                  disabled={blocked}
                  onCancel={() => setEditor(null)}
                  onSave={(spec) =>
                    void command(
                      editor === 'new'
                        ? {
                            type: 'create',
                            commandId: crypto.randomUUID(),
                            spec,
                          }
                        : {
                            type: 'update',
                            commandId: crypto.randomUUID(),
                            id: editor.id,
                            revision: editor.revision,
                            spec,
                          },
                    )
                  }
                />
              )}
              {(!editor ||
                snapshot.schedules.length > 0 ||
                snapshot.occurrences.length > 0) && (
                <ScheduleEntries
                  snapshot={snapshot}
                  onSelectMessage={onSelectMessage}
                  disabled={blocked}
                  readOnly={readOnly}
                  onEdit={setEditor}
                  onCommand={(value) => void command(value)}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
