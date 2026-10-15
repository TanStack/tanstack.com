import { workspacePreviewsEnabled } from '../core/workspace-panels'
import { SelectField } from './SelectField'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  Monitor,
  MousePointer,
  RotateCw,
  ScanText,
  Square,
  SquareTerminal,
  X,
} from 'lucide-react'
import { executionOwnerKey } from '../client/execution-owner'
import {
  executionOperationSchema,
  type ExecutionIdentity,
} from '../core/execution-sessions'
import { IconButton } from './IconButton'
import { useExecutionOwners, useExecutionOwnerViews } from './execution-context'
import { ExecutionPreviewViewport } from './ExecutionPreviewViewport'
import { deriveExecutionPreviews } from '../core/execution-preview'
import './execution-session-panel.css'
import { ExecutionEvidence } from './ExecutionSessionEvidence'
import { ExecutionSessionHistory } from './ExecutionSessionHistory'
export { decodeExecutionOutput } from './ExecutionSessionEvidence'

/** A completion belongs to one mounted owner and exact conversation scope. */
export function createExecutionPanelCompletionGuard() {
  let current: { owner: object | null; key: string } | undefined
  return {
    bind(owner: object | null, key: string) {
      current = { owner, key }
    },
    clear() {
      current = undefined
    },
    capture(owner: object | null, key: string) {
      const captured = current
      return () =>
        !!captured &&
        current === captured &&
        captured.owner === owner &&
        captured.key === key
    },
  }
}

function shortId(id: string) {
  return id.slice(0, 8)
}
function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'The workspace action could not be completed.'
}

export function ExecutionSessionPanel({
  identity,
  mode = 'commands',
  active = true,
  onOpen,
  historySessionId,
  onSelectHistorySession,
}: {
  identity: ExecutionIdentity
  mode?: 'summary' | 'commands' | 'preview'
  active?: boolean
  onOpen?: (panel: 'commands' | 'preview') => void
  historySessionId?: string
  onSelectHistorySession?: (id: string | undefined) => void
}) {
  const panel = (
    <SessionPanel
      key={executionOwnerKey(identity)}
      identity={identity}
      mode={mode}
      active={active && !(mode === 'commands' && historySessionId)}
      onOpen={onOpen}
    />
  )
  return mode === 'commands' && onSelectHistorySession ? (
    <ExecutionSessionHistory
      key={executionOwnerKey(identity)}
      identity={identity}
      active={active}
      sessionId={historySessionId}
      onSelect={onSelectHistorySession}
    >
      {panel}
    </ExecutionSessionHistory>
  ) : (
    panel
  )
}

function SessionPanel({
  identity,
  mode,
  active,
  onOpen,
}: {
  identity: ExecutionIdentity
  mode: 'summary' | 'commands' | 'preview'
  active: boolean
  onOpen?: (panel: 'commands' | 'preview') => void
}) {
  const owners = useExecutionOwners()
  const views = useExecutionOwnerViews()
  const key = executionOwnerKey(identity)
  const view = views.find((item) => item.key === key)
  const session = view?.snapshot?.session
  const receipts = view?.snapshot?.commands ?? []
  const processes = view?.snapshot?.processes ?? []
  const savedSnapshots = view?.snapshot?.savedSnapshots ?? []
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [path, setPath] = useState('/project/notes.txt')
  const [fileText, setFileText] = useState('')
  const [command, setCommand] = useState('node')
  const [args, setArgs] = useState('[]')
  const [cwd, setCwd] = useState('/project')
  const [port, setPort] = useState('3000')
  const [previewPath, setPreviewPath] = useState('/')
  const processId = useId()
  const [previewProcess, setPreviewProcess] = useState('')
  const [selectors, setSelectors] = useState<Record<string, string>>({})
  const mounted = useRef(true)
  const [completions] = useState(createExecutionPanelCompletionGuard)
  const abandonButton = useRef<HTMLButtonElement>(null)
  const startButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<'start' | 'abandon' | null>(null)
  useLayoutEffect(() => {
    mounted.current = true
    completions.bind(owners, key)
    returnFocus.current = null
    setBusy(null)
    setError('')
    setConfirmAbandon(false)
    return () => {
      mounted.current = false
      completions.clear()
    }
  }, [owners, key, completions])
  useLayoutEffect(() => {
    if (busy || confirmAbandon || !returnFocus.current) return
    const target =
      returnFocus.current === 'start'
        ? startButton.current
        : abandonButton.current
    returnFocus.current = null
    if (document.activeElement === document.body) target?.focus()
  }, [busy, confirmAbandon, view?.phase])
  useEffect(() => {
    let cancelled = false
    const current = completions.capture(owners, key)
    if (owners && !owners.getSnapshot().some((item) => item.key === key)) {
      setBusy('refresh')
      void owners
        .inspect(identity)
        .catch((error) => {
          if (!cancelled && mounted.current && current())
            setError(errorText(error))
        })
        .finally(() => {
          if (!cancelled && mounted.current && current()) setBusy(null)
        })
    }
    return () => {
      cancelled = true
    }
  }, [owners, key, completions])

  const ready = Boolean(
    owners &&
    view?.localOwner &&
    view.phase === 'ready' &&
    session?.status === 'ready',
  )
  const canStart = Boolean(
    owners &&
    view &&
    ['idle', 'closed', 'abandoned'].includes(view.phase) &&
    !view.localOwner &&
    (view.phase === 'abandoned' ||
      !['pending', 'unknown'].includes(view.cleanup)),
  )
  const canAbandon = Boolean(
    owners &&
    view &&
    !view.localOwner &&
    session &&
    ['awaiting_host', 'disconnected'].includes(session.status),
  )
  const previews = deriveExecutionPreviews(view?.snapshot ?? undefined, {
    localOwner: view?.localOwner ?? false,
    phase: view?.phase ?? 'idle',
    exitedProcessIds: new Set(
      (view?.events ?? []).flatMap((event) =>
        event.type === 'process-exit' ? [event.processId] : [],
      ),
    ),
  }).filter((preview) => !preview.closed)
  const snapshotBlocked = receipts.some(
    (receipt) => receipt.state === 'unknown',
  )
    ? 'A command outcome is still unconfirmed.'
    : receipts.some((receipt) =>
          ['queued', 'dispatched', 'running'].includes(receipt.state),
        )
      ? 'Wait for commands to finish before saving.'
      : processes.some((process) => process.state !== 'stopped') ||
          previews.length > 0
        ? 'Stop or clean up processes and close previews before saving.'
        : undefined

  async function act(
    name: string,
    action: () => Promise<unknown>,
    onSuccess?: () => void,
  ) {
    const current = completions.capture(owners, key)
    if (busy || !owners || !mounted.current || !current()) return
    setBusy(name)
    setError('')
    try {
      await action()
      if (mounted.current && current()) onSuccess?.()
    } catch (error) {
      if (mounted.current && current()) setError(errorText(error))
    } finally {
      if (mounted.current && current()) setBusy(null)
    }
  }
  async function enqueue(operation: unknown) {
    const parsed = executionOperationSchema.safeParse(operation)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the command fields.')
      return
    }
    await act(parsed.data.type, () => owners!.enqueue(identity, parsed.data))
  }
  function processCommand(type: 'run' | 'spawn', event: FormEvent) {
    event.preventDefault()
    let values: unknown
    try {
      values = JSON.parse(args)
    } catch {
      setError('Arguments must be a JSON array of strings.')
      return
    }
    void enqueue({
      type,
      command,
      args: values,
      cwd,
      timeoutMs: 30_000,
    })
  }
  const phase =
    view?.phase.replaceAll('_', ' ') ??
    (busy === 'refresh' ? 'Loading state' : 'State unavailable')

  const runningProcesses = processes.filter(
    (process) =>
      process.state === 'running' &&
      !(view?.events ?? []).some(
        (event) =>
          event.type === 'process-exit' && event.processId === process.id,
      ),
  )
  const selectedProcess =
    runningProcesses.find((process) => process.id === previewProcess) ??
    runningProcesses[0]

  if (mode === 'summary')
    return (
      <section
        className="execution-panel execution-panel-summary"
        aria-label="Local execution"
      >
        <div className="execution-panel-heading">
          <h3>Local execution</h3>
          {onOpen && (
            <div className="execution-panel-icon-actions">
              <IconButton
                label="Open commands"
                onClick={() => onOpen('commands')}
              >
                <SquareTerminal size={16} />
              </IconButton>
              {workspacePreviewsEnabled && (
                <IconButton
                  label="Open workspace preview"
                  onClick={() => onOpen('preview')}
                >
                  <Monitor size={16} />
                </IconButton>
              )}
            </div>
          )}
        </div>
        <span role="status">
          {phase.charAt(0).toUpperCase() + phase.slice(1)}
        </span>
        {session && !view?.localOwner && (
          <small>Recorded state: {session.status.replaceAll('_', ' ')}</small>
        )}
        {runningProcesses.length > 0 && (
          <span>
            {runningProcesses.length}{' '}
            {runningProcesses.length === 1 ? 'process' : 'processes'} recorded
            running
          </span>
        )}
        {view?.error && (
          <p role="alert" className="execution-panel-error">
            {view.error}
          </p>
        )}
      </section>
    )

  return (
    <section
      className={`execution-panel execution-panel-tab execution-panel-${mode}`}
      aria-label={
        mode === 'commands' ? 'Workspace commands' : 'Workspace preview'
      }
    >
      <header className="execution-panel-heading">
        <h3>Local workspace</h3>
        <div className="execution-panel-icon-actions">
          {onOpen && (mode !== 'commands' || workspacePreviewsEnabled) && (
            <IconButton
              label={
                mode === 'commands' ? 'Open workspace preview' : 'Open commands'
              }
              onClick={() =>
                onOpen(mode === 'commands' ? 'preview' : 'commands')
              }
            >
              {mode === 'commands' ? (
                <Monitor size={16} />
              ) : (
                <SquareTerminal size={16} />
              )}
            </IconButton>
          )}
          <IconButton
            label="Refresh workspace state"
            disabled={!owners || !!busy}
            onClick={() => void act('refresh', () => owners!.inspect(identity))}
          >
            <RotateCw size={15} />
          </IconButton>
        </div>
      </header>
      <small>
        {session?.project.source === 'snapshot'
          ? 'Restored from a saved snapshot.'
          : 'Uses the bundled test project.'}
      </small>
      <div className="execution-panel-status" role="status">
        <span>{phase.charAt(0).toUpperCase() + phase.slice(1)}</span>
        {session && !view?.localOwner && (
          <small>Recorded state: {session.status.replaceAll('_', ' ')}</small>
        )}
        {view?.cleanup === 'pending' && (
          <small>Waiting for shutdown confirmation</small>
        )}
        {view?.cleanup === 'unknown' && (
          <small>Runtime cleanup is unconfirmed</small>
        )}
      </div>
      {mode === 'commands' && (
        <div className="execution-panel-actions">
          {canStart && (
            <button
              ref={startButton}
              className="primary"
              type="button"
              disabled={!!busy}
              onClick={() => void act('start', () => owners!.start(identity))}
            >
              Start workspace
            </button>
          )}
          {view?.localOwner && (
            <button
              className="secondary"
              type="button"
              disabled={!ready || !!busy}
              onClick={() => void enqueue({ type: 'close' })}
            >
              Close workspace
            </button>
          )}
          {canAbandon && !confirmAbandon && (
            <button
              ref={abandonButton}
              className="secondary"
              type="button"
              disabled={!!busy}
              onClick={() => setConfirmAbandon(true)}
            >
              Abandon workspace…
            </button>
          )}
        </div>
      )}
      {mode === 'preview' && !ready && onOpen && (
        <button
          className="secondary"
          type="button"
          onClick={() => onOpen('commands')}
        >
          Open commands
        </button>
      )}
      {(error || view?.error) && (
        <p className="execution-panel-error" role="alert">
          {error || view?.error}
        </p>
      )}
      {confirmAbandon && canAbandon && (
        <div
          className="execution-panel-confirm"
          role="group"
          aria-label="Abandon workspace confirmation"
        >
          <p>
            Unknown command outcomes will remain unknown. Abandoning allows a
            new workspace, but does not confirm that the old runtime stopped.
          </p>
          <div className="execution-panel-actions">
            <button
              className="secondary"
              type="button"
              disabled={!!busy}
              onClick={() =>
                void act(
                  'abandon',
                  () => owners!.abandon(identity),
                  () => {
                    returnFocus.current = 'start'
                    setConfirmAbandon(false)
                  },
                )
              }
            >
              Abandon workspace
            </button>
            <button
              className="secondary"
              type="button"
              disabled={!!busy}
              onClick={() => {
                returnFocus.current = 'abandon'
                setConfirmAbandon(false)
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'commands' && (
        <details className="execution-panel-operations" open>
          <summary>Run a command</summary>
          <fieldset disabled={!ready || !!busy}>
            <form onSubmit={(event) => processCommand('run', event)}>
              <label>
                Directory
                <input
                  value={cwd}
                  onChange={(event) => setCwd(event.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
              <label>
                Command
                <input
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
              <label>
                Arguments (JSON array)
                <textarea
                  value={args}
                  onChange={(event) => setArgs(event.target.value)}
                  rows={2}
                  spellCheck={false}
                />
              </label>
              <div className="execution-panel-actions">
                <button className="secondary" type="submit">
                  Run
                </button>
                <button
                  className="secondary"
                  type="button"
                  onClick={(event) => processCommand('spawn', event)}
                >
                  Start process
                </button>
              </div>
            </form>
            <details className="execution-panel-file-editor">
              <summary>Project files</summary>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void enqueue({ type: 'read_file', path })
                }}
              >
                <label>
                  File path
                  <input
                    value={path}
                    onChange={(event) => setPath(event.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                  />
                </label>
                <label>
                  File contents
                  <textarea
                    value={fileText}
                    onChange={(event) => setFileText(event.target.value)}
                    rows={5}
                    spellCheck={false}
                  />
                </label>
                <div className="execution-panel-actions">
                  <button className="secondary" type="submit">
                    Read file
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    onClick={() =>
                      void enqueue({ type: 'write_file', path, text: fileText })
                    }
                  >
                    Write file
                  </button>
                </div>
              </form>
            </details>
          </fieldset>
        </details>
      )}

      {mode === 'commands' && processes.length > 0 && (
        <section className="execution-panel-processes" aria-label="Processes">
          <h4>Processes</h4>
          <ul>
            {processes.map((process) => {
              const exit = [...(view?.events ?? [])]
                .reverse()
                .find(
                  (event) =>
                    event.type === 'process-exit' &&
                    event.processId === process.id,
                )
              const label = `process ${process.pid}`
              return (
                <li key={process.id}>
                  <div>
                    <strong>Process {process.pid}</strong>
                    <span>Recorded: {process.state}</span>
                    {(process.exit || exit?.type === 'process-exit') && (
                      <small>
                        {process.exit ? 'Exit' : 'Exit observed'}:{' '}
                        {process.exit?.exitCode ??
                          process.exit?.signal ??
                          (exit?.type === 'process-exit'
                            ? (exit.exitCode ?? exit.signal)
                            : '')}
                      </small>
                    )}
                  </div>
                  {(process.state === 'running' ||
                    process.state === 'exited') && (
                    <div className="execution-panel-icon-actions">
                      <IconButton
                        label={
                          exit || process.state === 'exited'
                            ? `Clean up ${label}`
                            : `Stop ${label}`
                        }
                        disabled={!ready || !!busy}
                        onClick={() =>
                          void enqueue({
                            type: 'stop_process',
                            processId: process.id,
                          })
                        }
                      >
                        <Square size={14} />
                      </IconButton>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {mode === 'preview' && previews.length === 0 && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (selectedProcess)
              void enqueue({
                type: 'preview_open',
                processId: selectedProcess.id,
                port: Number(port),
                path: previewPath,
              })
          }}
        >
          <fieldset disabled={!ready || !!busy || !selectedProcess}>
            {runningProcesses.length > 1 && (
              <label htmlFor={processId}>
                Running process
                <SelectField
                  id={processId}
                  value={selectedProcess?.id ?? ''}
                  onValueChange={(value) => setPreviewProcess(value)}
                  items={[
                    ...runningProcesses.map((process) => ({
                      value: process.id,
                      label: <>Process {process.pid}</>,
                    })),
                  ]}
                />
              </label>
            )}
            <label>
              Workspace port
              <input
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(event) => setPort(event.target.value)}
              />
            </label>
            <label>
              Path
              <input
                value={previewPath}
                onChange={(event) => setPreviewPath(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button className="primary" type="submit">
              Open preview
            </button>
          </fieldset>
          {ready && !selectedProcess && (
            <p>Start a server in Commands to open its workspace port.</p>
          )}
        </form>
      )}

      {mode === 'preview' && previews.length > 0 && (
        <section aria-label="Owned previews">
          {previews.map((preview) => (
            <div className="execution-panel-preview" key={preview.id}>
              <div className="execution-panel-heading">
                <strong>
                  {preview.data.title || `Preview ${shortId(preview.id)}`}
                </strong>
                <div className="execution-panel-icon-actions">
                  <IconButton
                    label={`Inspect preview ${shortId(preview.id)}`}
                    disabled={!ready || !preview.live || !!busy}
                    onClick={() =>
                      void enqueue({
                        type: 'preview_inspect',
                        previewId: preview.id,
                      })
                    }
                  >
                    <ScanText size={16} />
                  </IconButton>
                  <IconButton
                    label={`Close preview ${shortId(preview.id)}`}
                    disabled={!ready || preview.closing || !!busy}
                    onClick={() =>
                      void enqueue({
                        type: 'preview_close',
                        previewId: preview.id,
                      })
                    }
                  >
                    <X size={16} />
                  </IconButton>
                </div>
              </div>
              {preview.live ? (
                <ExecutionPreviewViewport
                  identity={identity}
                  previewId={preview.id}
                  active={active}
                />
              ) : (
                <p>
                  {preview.closing
                    ? 'Preview closure is not yet confirmed.'
                    : 'This preview is not running in this tab.'}
                </p>
              )}
              <details className="execution-panel-preview-inspection">
                <summary>Inspect page</summary>
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!ready || !preview.live) return
                    void enqueue({
                      type: 'preview_click',
                      previewId: preview.id,
                      selector: selectors[preview.id] ?? '',
                    })
                  }}
                >
                  <label>
                    Element selector
                    <input
                      value={selectors[preview.id] ?? ''}
                      onChange={(event) =>
                        setSelectors((previous) => ({
                          ...previous,
                          [preview.id]: event.target.value,
                        }))
                      }
                      disabled={!ready || !preview.live || !!busy}
                      spellCheck={false}
                    />
                  </label>
                  <IconButton
                    label={`Click matching element in preview ${shortId(preview.id)}`}
                    disabled={
                      !ready ||
                      !preview.live ||
                      !!busy ||
                      !selectors[preview.id]?.trim()
                    }
                    onClick={() =>
                      void enqueue({
                        type: 'preview_click',
                        previewId: preview.id,
                        selector: selectors[preview.id],
                      })
                    }
                  >
                    <MousePointer size={16} />
                  </IconButton>
                </form>
                <pre aria-label="Preview text">{preview.data.text}</pre>
                {preview.data.truncated && (
                  <small>Preview text was truncated by the runtime.</small>
                )}
              </details>
            </div>
          ))}
        </section>
      )}

      {mode === 'commands' && (ready || savedSnapshots.length > 0) && (
        <section
          className="execution-panel-processes"
          aria-label="Workspace snapshots"
        >
          <div className="execution-panel-heading">
            <h4>Snapshots</h4>
            <button
              className="secondary"
              type="button"
              disabled={!ready || !!busy || !!snapshotBlocked}
              onClick={() => void enqueue({ type: 'save_snapshot' })}
            >
              Save snapshot
            </button>
          </div>
          <small>
            Snapshots save workspace files, without running processes.
          </small>
          {ready && snapshotBlocked && <p>{snapshotBlocked}</p>}
          {savedSnapshots.length > 0 && (
            <ul>
              {savedSnapshots.map((snapshot, index) => (
                <li key={snapshot.snapshotId}>
                  <div>
                    <strong>Snapshot {index + 1}</strong>
                    <small>
                      {
                        {
                          pending: 'Saving',
                          ready: 'Ready',
                          unavailable: 'Unavailable',
                        }[snapshot.state]
                      }
                      {' · '}
                      {snapshot.byteLength.toLocaleString()} bytes
                    </small>
                    <small>
                      <time
                        dateTime={new Date(snapshot.createdAt).toISOString()}
                      >
                        {new Date(snapshot.createdAt).toLocaleString(
                          undefined,
                          {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          },
                        )}
                      </time>
                    </small>
                  </div>
                  {snapshot.state === 'ready' && (
                    <button
                      className="secondary"
                      type="button"
                      aria-label={`Restore snapshot ${index + 1}`}
                      disabled={!canStart || !!busy}
                      onClick={() =>
                        void act('restore', () =>
                          owners!.start(identity, {
                            source: 'snapshot',
                            snapshotId: snapshot.snapshotId,
                            digest: snapshot.sha256,
                          }),
                        )
                      }
                    >
                      Restore
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {mode === 'commands' && view && <ExecutionEvidence evidence={view} />}
    </section>
  )
}
