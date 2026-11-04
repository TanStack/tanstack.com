import { LoadingState } from './ui/LoadingState'
import { Button } from './ui/Button'
import { SelectField } from './SelectField'
import { useEffect, useRef, useState } from 'react'
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Menu } from '@base-ui/react/menu'
import { ArrowLeft, MoreHorizontal, Upload } from 'lucide-react'
import { z } from 'zod'
import { readPluginArchive } from '../core/plugin-archive'
import {
  parsedPluginPackageSchema,
  type ParsedPluginPackage,
} from '../core/plugins'
import {
  pluginCommandSchema,
  pluginSummarySchema,
  pluginVersionSchema,
  pluginListSchema,
  type PluginCommand,
  type PluginSummary,
  type PluginVersion,
} from '../core/plugin-lifecycle'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'
import { IconButton } from './IconButton'
import { CopyButton } from './CopyButton'
import type { McpAccountSummary } from '../core/mcp-accounts'
import type { PluginConnectionTarget } from '../core/mcp-setup'
import './plugin-settings.css'

type AvailableConnection = Pick<
  McpAccountSummary,
  'id' | 'label' | 'url' | 'enabled' | 'hasToken'
>

export const maxPluginRecoveryBytes = 2 * 1024 * 1024
export const pluginCommandStorageKey = (userId: string, workspaceId?: string) =>
  JSON.stringify(['gum', 'plugin-command', 1, userId, workspaceId])
type CommandStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function definitePluginRejection(cause: unknown): cause is ApiError {
  return (
    cause instanceof ApiError &&
    cause.status >= 400 &&
    cause.status < 500 &&
    cause.status !== 408 &&
    cause.status !== 429
  )
}
export function pluginErrorMessage(cause: unknown) {
  return cause instanceof z.ZodError
    ? (cause.issues[0]?.message ?? 'Check the plugin package.')
    : cause instanceof Error
      ? cause.message
      : 'The plugin request failed.'
}
export class PluginCommandStore {
  constructor(
    private storage: CommandStorage,
    readonly key: string,
  ) {}
  read(): PluginCommand | null {
    const raw = this.storage.getItem(this.key)
    if (raw === null) return null
    if (new TextEncoder().encode(raw).byteLength > maxPluginRecoveryBytes)
      throw Error(
        'The saved plugin request exceeds this device’s 2 MiB recovery limit.',
      )
    return pluginCommandSchema.parse(JSON.parse(raw))
  }
  create(value: PluginCommand) {
    const existing = this.read()
    if (existing) return existing
    const command = pluginCommandSchema.parse(value)
    const raw = JSON.stringify(command)
    if (new TextEncoder().encode(raw).byteLength > maxPluginRecoveryBytes)
      throw Error(
        'This request exceeds the 2 MiB device recovery limit. Use a smaller package.',
      )
    this.storage.setItem(this.key, raw)
    if (this.storage.getItem(this.key) !== raw)
      throw Error('The plugin request could not be saved on this device.')
    return command
  }
  clear(commandId: string) {
    if (this.read()?.commandId !== commandId) return
    this.storage.removeItem(this.key)
    if (this.storage.getItem(this.key) !== null)
      throw Error(
        'The confirmed plugin request could not be cleared on this device.',
      )
  }
}

type PackageFile = ParsedPluginPackage['files'][number]
export function pluginFileChanges(before: PackageFile[], after: PackageFile[]) {
  const oldFiles = new Map(before.map((file) => [file.path, file.text]))
  const newFiles = new Map(after.map((file) => [file.path, file.text]))
  return [...new Set([...oldFiles.keys(), ...newFiles.keys()])]
    .sort()
    .flatMap((path) => {
      const oldText = oldFiles.get(path)
      const newText = newFiles.get(path)
      if (oldText === newText) return []
      return [
        {
          path,
          kind:
            oldText === undefined
              ? ('added' as const)
              : newText === undefined
                ? ('removed' as const)
                : ('changed' as const),
          before: oldText,
          after: newText,
        },
      ]
    })
}
export function matchingPluginConnections(
  endpoint: string | undefined,
  servers: AvailableConnection[],
) {
  if (!endpoint) return []
  try {
    const expected = new URL(endpoint).href
    return servers.filter((server) => {
      try {
        return server.enabled && new URL(server.url).href === expected
      } catch {
        return false
      }
    })
  } catch {
    return []
  }
}
export function pluginStateLabel(
  plugin: Pick<PluginSummary, 'removed' | 'enabled' | 'compatibility'>,
) {
  if (plugin.removed) return 'Removed'
  if (plugin.compatibility.status !== 'supported')
    return 'Not supported · Disabled'
  return plugin.enabled ? 'Enabled' : 'Disabled'
}

export function PluginContents({
  value,
  omitSupportedConnections = false,
}: {
  value: ParsedPluginPackage
  omitSupportedConnections?: boolean
}) {
  const shownConnections = value.mcpServers.filter(
    (server) => !omitSupportedConnections || !server.supported,
  )
  return (
    <div className="plugin-contents">
      {value.manifest.description && <p>{value.manifest.description}</p>}
      {value.compatibility.issues.length > 0 && (
        <ul className="plugin-issues">
          {value.compatibility.issues.map((issue, index) => (
            <li key={`${issue.path}:${issue.code}:${index}`}>
              <strong>
                {issue.severity === 'warning' ? 'Note' : 'Not supported'}
              </strong>{' '}
              {issue.message}
              <small>{issue.path}</small>
            </li>
          ))}
        </ul>
      )}
      {value.skills.length > 0 && (
        <section aria-label="Included skills">
          <h3>Skills</h3>
          {value.skills.map((skill) => (
            <details key={skill.path} className="plugin-file">
              <summary>{skill.document.name}</summary>
              <p>{skill.document.description}</p>
              <pre>{skill.document.instructions}</pre>
              {skill.document.allowedTools && (
                <p className="plugin-note">
                  Declared tools: {skill.document.allowedTools}. This does not
                  grant access.
                </p>
              )}
            </details>
          ))}
        </section>
      )}
      {shownConnections.length > 0 && (
        <section aria-label="Connection requirements">
          <h3>Connections</h3>
          {shownConnections.map((server) => (
            <div className="plugin-requirement" key={server.key}>
              <strong>{server.key}</strong>
              <span>{server.url ?? server.type}</span>
              {!server.supported && <small>Not supported</small>}
            </div>
          ))}
        </section>
      )}
      <details className="plugin-source">
        <summary>Package details</summary>
        <dl>
          <dt>Source</dt>
          <dd>Uploaded package</dd>
          {value.manifest.author?.name && (
            <>
              <dt>Declared author</dt>
              <dd>{value.manifest.author.name}</dd>
            </>
          )}
          <dt>Declared version</dt>
          <dd>{value.manifest.version ?? 'Not provided'}</dd>
          <dt>Digest</dt>
          <dd className="plugin-digest">
            <code>{value.digest}</code>
            <CopyButton text={value.digest} label="Copy package digest" />
          </dd>
        </dl>
        {value.manifest.author && (
          <p className="plugin-note">
            Author information comes from the uploaded files and is not
            verified.
          </p>
        )}
        {value.files.map((file) => (
          <details className="plugin-file" key={file.path}>
            <summary>{file.path}</summary>
            <pre>{file.text}</pre>
          </details>
        ))}
      </details>
    </div>
  )
}

function PackageChanges({
  before,
  after,
}: {
  before: ParsedPluginPackage
  after: ParsedPluginPackage
}) {
  const changes = pluginFileChanges(before.files, after.files)
  const oldServers = new Map(
    before.mcpServers.map((server) => [server.key, server]),
  )
  const newServers = new Map(
    after.mcpServers.map((server) => [server.key, server]),
  )
  const connectionChanges = [
    ...new Set([...oldServers.keys(), ...newServers.keys()]),
  ].filter(
    (key) =>
      JSON.stringify(oldServers.get(key)) !==
      JSON.stringify(newServers.get(key)),
  )
  return (
    <section className="plugin-changes" aria-label="Update changes">
      <h3>Changes</h3>
      {!changes.length && <p>No file changes.</p>}
      {connectionChanges.map((key) => (
        <div key={key} className="plugin-requirement">
          <strong>{key}</strong>
          <span>
            Previous:{' '}
            {oldServers.get(key)?.url ??
              oldServers.get(key)?.type ??
              'Not included'}
          </span>
          <span>
            New:{' '}
            {newServers.get(key)?.url ?? newServers.get(key)?.type ?? 'Removed'}
          </span>
        </div>
      ))}
      {changes.map((change) => (
        <details key={change.path} className="plugin-file">
          <summary>
            {change.kind === 'added'
              ? 'Added'
              : change.kind === 'removed'
                ? 'Removed'
                : 'Changed'}
            : {change.path}
          </summary>
          <div className="plugin-file-comparison">
            {change.before !== undefined && (
              <div>
                <strong>Previous</strong>
                <pre>{change.before}</pre>
              </div>
            )}
            {change.after !== undefined && (
              <div>
                <strong>New</strong>
                <pre>{change.after}</pre>
              </div>
            )}
          </div>
        </details>
      ))}
    </section>
  )
}

type Props = {
  userId: string
  servers: AvailableConnection[]
  allowMcp: boolean
  onConnections?: () => void
  initialId?: string
  onConnect?: (target: PluginConnectionTarget) => void | Promise<void>
}
type Review = {
  candidate: ParsedPluginPackage
  id: string
  base?: PluginVersion
}
export function PluginSettings(props: Props) {
  const { workspaceId } = useWorkspaceApi()
  return (
    <PrivatePluginSettings
      key={JSON.stringify([props.userId, workspaceId])}
      {...props}
    />
  )
}
function PrivatePluginSettings({
  userId,
  servers,
  allowMcp,
  onConnections,
  initialId,
  onConnect,
}: Props) {
  const { request, workspaceId } = useWorkspaceApi()
  const queries = useQueryClient()
  const [search, setSearch] = useState('')
  const [removed, setRemoved] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null)
  const [review, setReview] = useState<Review | null>(null)
  const [enableInstall, setEnableInstall] = useState(true)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [busy, setBusy] = useState(false)
  const [inspecting, setInspecting] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<PluginCommand | null>(null)
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [conflict, setConflict] = useState(false)
  const upload = useRef<HTMLInputElement>(null)
  const uploadBase = useRef<PluginVersion | undefined>(undefined)
  const portal = useRef<HTMLDivElement>(null)
  const searchField = useRef<HTMLInputElement>(null)
  const backButton = useRef<HTMLButtonElement>(null)
  const removeButton = useRef<HTMLButtonElement>(null)
  const removeCancel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (confirmRemove) removeCancel.current?.focus()
  }, [confirmRemove])
  const rowButtons = useRef(new Map<string, HTMLButtonElement>())
  const menuButtons = useRef(new Map<string, HTMLButtonElement>())
  const mounted = useRef(false)
  const locked = useRef(false)
  const recoveryKey = pluginCommandStorageKey(userId, workspaceId)
  const focusedInitialId = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (initialId) setSelectedId(initialId)
  }, [initialId])
  const invalidate = () =>
    Promise.all([
      queries.invalidateQueries({ queryKey: ['plugins', userId, workspaceId] }),
      queries.invalidateQueries({ queryKey: ['plugin', userId, workspaceId] }),
      queries.invalidateQueries({
        queryKey: ['reference-catalog', userId, workspaceId],
      }),
      queries.invalidateQueries({
        queryKey: ['private-skills', userId, workspaceId],
      }),
    ])
  const recover = () => {
    try {
      const value = new PluginCommandStore(localStorage, recoveryKey).read()
      setPending(value)
      setRecoveryReady(true)
      setError(value ? 'A saved plugin request is awaiting confirmation.' : '')
      if (value) setSelectedId(value.id)
    } catch (cause) {
      setRecoveryReady(false)
      setError(pluginErrorMessage(cause))
    }
  }
  useEffect(() => {
    mounted.current = true
    recover()
    const changed = (event: StorageEvent) => {
      if (event.key === recoveryKey || event.key === null) {
        recover()
        void invalidate()
      }
    }
    window.addEventListener('storage', changed)
    return () => {
      mounted.current = false
      window.removeEventListener('storage', changed)
    }
  }, [])
  const list = useInfiniteQuery({
    queryKey: ['plugins', userId, workspaceId, removed, search],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        query: search,
        removed: String(removed),
      })
      if (pageParam) params.set('cursor', pageParam)
      return pluginListSchema.parse(await request(`plugins?${params}`))
    },
    getNextPageParam: (page) => page.nextCursor,
    refetchOnMount: 'always',
    staleTime: 0,
    retry: false,
  })
  const detail = useQuery({
    queryKey: ['plugin', userId, workspaceId, selectedId],
    enabled: !!selectedId && !review && !(pending?.type === 'install'),
    queryFn: async () =>
      pluginVersionSchema.parse(
        await request(`plugins/${encodeURIComponent(selectedId!)}`),
      ),
    refetchOnMount: 'always',
    staleTime: 0,
    retry: false,
  })
  const current =
    detail.isFetchedAfterMount && !detail.isFetching && !detail.isError
      ? detail.data
      : undefined
  const disabled = busy || !!pending || !recoveryReady
  useEffect(() => {
    if (
      !initialId ||
      current?.id !== initialId ||
      disabled ||
      focusedInitialId.current === initialId
    )
      return
    backButton.current?.focus()
    focusedInitialId.current = initialId
  }, [initialId, current?.id, disabled])
  async function connect(target: PluginConnectionTarget) {
    if (!onConnect || locked.current || disabled) return
    locked.current = true
    setBusy(true)
    setError('')
    try {
      await onConnect(target)
    } catch (cause) {
      if (mounted.current) setError(pluginErrorMessage(cause))
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function command(value: PluginCommand) {
    if (locked.current || !recoveryReady) return
    locked.current = true
    setBusy(true)
    setError('')
    setConflict(false)
    try {
      if (!navigator.locks)
        throw Error('Use an up-to-date browser to save plugin changes safely.')
      await navigator.locks.request(recoveryKey, async () => {
        if (!mounted.current) return
        const store = new PluginCommandStore(localStorage, recoveryKey)
        const frozen = store.create(value)
        setPending(frozen)
        if (frozen.commandId !== value.commandId)
          throw Error(
            'Another plugin change is awaiting confirmation. Retry that request first.',
          )
        try {
          pluginSummarySchema.parse(await request('plugins', frozen))
        } catch (cause) {
          if (definitePluginRejection(cause)) store.clear(frozen.commandId)
          throw cause
        }
        store.clear(frozen.commandId)
      })
      await invalidate()
      if (mounted.current) {
        setPending(null)
        setReview(null)
        setConfirmRemove(false)
        setSelectedId(value.id)
        if (value.type === 'restore') setRemoved(false)
        requestAnimationFrame(() => backButton.current?.focus())
      }
    } catch (cause) {
      if (mounted.current) {
        setError(pluginErrorMessage(cause))
        if (definitePluginRejection(cause)) {
          setPending(null)
          setConflict(cause.status === 409)
        }
      }
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }
  function lifecycle(
    plugin: PluginSummary,
    type: 'enabled' | 'remove' | 'restore',
  ) {
    const common = {
      id: plugin.id,
      commandId: crypto.randomUUID(),
      expectedRevision: plugin.revision,
    }
    void command(
      type === 'enabled'
        ? { ...common, type, enabled: !plugin.enabled }
        : { ...common, type },
    )
  }
  async function inspectArchive(file: File) {
    if (locked.current || disabled) return
    const base = uploadBase.current
    locked.current = true
    setBusy(true)
    setInspecting(true)
    setError('')
    setConflict(false)
    try {
      if (file.size > 2 * 1024 * 1024)
        throw Error('Choose a plugin ZIP no larger than 2 MiB.')
      const files = await readPluginArchive(
        new Uint8Array(await file.arrayBuffer()),
      )
      const candidate = parsedPluginPackageSchema.parse(
        await request('plugins/preview', { files }),
      )
      if (!mounted.current) return
      setReview({ candidate, base, id: base?.id ?? crypto.randomUUID() })
      setEnableInstall(
        candidate.compatibility.status === 'supported' &&
          candidate.mcpServers.length === 0,
      )
      requestAnimationFrame(() => backButton.current?.focus())
    } catch (cause) {
      if (mounted.current) setError(pluginErrorMessage(cause))
    } finally {
      locked.current = false
      if (mounted.current) {
        setBusy(false)
        setInspecting(false)
      }
    }
  }
  function openArchive(base?: PluginVersion) {
    uploadBase.current = base
    if (upload.current) upload.current.value = ''
    upload.current?.click()
  }
  function back() {
    if (disabled) return
    const previousId = selectedId
    setReview(null)
    setSelectedId(null)
    setConfirmRemove(false)
    setError('')
    setConflict(false)
    requestAnimationFrame(() =>
      (
        (previousId && rowButtons.current.get(previousId)) ||
        searchField.current
      )?.focus(),
    )
  }
  const shown = list.data?.pages.flatMap((page) => page.items) ?? []
  const unsupportedReview =
    !!review && review.candidate.compatibility.status !== 'supported'
  return (
    <div className="plugin-settings" ref={portal}>
      <input
        ref={upload}
        type="file"
        accept=".zip,application/zip"
        hidden
        aria-label="Plugin ZIP"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void inspectArchive(file)
        }}
      />
      <p className="plugin-note">Only you, in this workspace.</p>
      {review ? (
        <>
          <div className="plugin-heading">
            <IconButton
              ref={backButton}
              label="Back to plugins"
              disabled={disabled}
              onClick={back}
            >
              <ArrowLeft size={16} aria-hidden />
            </IconButton>
            <strong>{review.candidate.manifest.name}</strong>
            <span>
              {review.base
                ? `${review.base.packageVersion ?? 'Undeclared version'} → ${review.candidate.manifest.version ?? 'Undeclared version'}`
                : review.candidate.manifest.version}
            </span>
          </div>
          <PluginContents value={review.candidate} />
          {review.candidate.skills.length > 0 && (
            <p className="plugin-note">
              Skills add instructions. They do not grant account or tool access.
            </p>
          )}
          {review.base && (
            <PackageChanges
              before={review.base.package}
              after={review.candidate}
            />
          )}
          {unsupportedReview && (
            <p className="plugin-note">
              This package can be kept for inspection, but cannot be enabled.
            </p>
          )}
          {review.base && review.candidate.mcpServers.length > 0 && (
            <p className="plugin-note">
              Choose matching connections again after updating. Existing task
              versions keep their saved bindings.
            </p>
          )}
          {!review.base &&
            !unsupportedReview &&
            review.candidate.mcpServers.length === 0 && (
              <label className="plugin-enable-install">
                <input
                  type="checkbox"
                  checked={enableInstall}
                  disabled={disabled}
                  onChange={(event) => setEnableInstall(event.target.checked)}
                />{' '}
                Enable after install
              </label>
            )}
          {!review.base &&
            review.candidate.mcpServers.length > 0 &&
            !unsupportedReview && (
              <p className="plugin-note">
                Install first, then choose existing connections before enabling.
              </p>
            )}
          {review.base?.enabled && unsupportedReview && (
            <p className="plugin-note">
              Disable the installed version before keeping this unsupported
              update.
            </p>
          )}
          <div className="plugin-actions">
            <Button
              type="button"
              variant="primary"
              disabled={
                disabled || !!(review.base?.enabled && unsupportedReview)
              }
              onClick={() => {
                const common = {
                  id: review.id,
                  commandId: crypto.randomUUID(),
                  files: review.candidate.files,
                  digest: review.candidate.digest,
                }
                void command(
                  review.base
                    ? {
                        ...common,
                        type: 'update',
                        expectedRevision: review.base.revision,
                      }
                    : {
                        ...common,
                        type: 'install',
                        enabled: !unsupportedReview && enableInstall,
                      },
                )
              }}
            >
              {busy
                ? 'Saving…'
                : review.base
                  ? 'Apply update'
                  : unsupportedReview
                    ? 'Keep disabled'
                    : 'Install'}
            </Button>
          </div>
        </>
      ) : selectedId ? (
        <>
          <div className="plugin-heading">
            <IconButton
              ref={backButton}
              label="Back to plugins"
              disabled={disabled}
              onClick={back}
            >
              <ArrowLeft size={16} aria-hidden />
            </IconButton>
            <strong>{current?.name ?? 'Plugin'}</strong>
          </div>
          {pending?.type === 'install' ? null : detail.isError ? (
            <p className="error" role="alert">
              {pluginErrorMessage(detail.error)}{' '}
              <Button
                variant="secondary"
                type="button"
                disabled={disabled}
                onClick={() => void detail.refetch()}
              >
                Retry
              </Button>
            </p>
          ) : !current ? (
            <LoadingState>Loading plugin…</LoadingState>
          ) : (
            <>
              <div className="plugin-detail-state">
                <span>{pluginStateLabel(current)}</span>
                {!current.removed && (
                  <label className="plugin-switch">
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label={`Enable ${current.name}`}
                      checked={current.enabled}
                      disabled={
                        disabled || current.compatibility.status !== 'supported'
                      }
                      onChange={() => lifecycle(current, 'enabled')}
                    />
                  </label>
                )}
              </div>
              {current.removed ? (
                <Button
                  variant="secondary"
                  type="button"
                  disabled={disabled}
                  onClick={() => lifecycle(current, 'restore')}
                >
                  Restore disabled
                </Button>
              ) : (
                <div className="plugin-actions">
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={disabled}
                    onClick={() => openArchive(current)}
                  >
                    Upload update
                  </Button>
                  {!confirmRemove && (
                    <Button
                      variant="secondary"
                      ref={removeButton}
                      type="button"
                      disabled={disabled}
                      onClick={() => setConfirmRemove(true)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              )}
              {confirmRemove && (
                <div className="plugin-remove-review">
                  <p>
                    Remove {current.name}? Its capabilities will no longer be
                    available. Conversation history, saved files and independent
                    connections remain. An action already running may still
                    finish.
                  </p>
                  <div className="plugin-actions">
                    <Button
                      variant="secondary"
                      ref={removeCancel}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setConfirmRemove(false)
                        requestAnimationFrame(() =>
                          removeButton.current?.focus(),
                        )
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="plugin-remove-button"
                      disabled={disabled}
                      onClick={() => lifecycle(current, 'remove')}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              )}
              <PluginContents
                value={current.package}
                omitSupportedConnections={!current.removed}
              />
              {!current.removed &&
                current.package.mcpServers.some(
                  (server) => server.supported,
                ) && (
                  <section
                    className="plugin-bindings"
                    aria-label="Choose connections"
                  >
                    <h3>Choose connections</h3>
                    {!allowMcp && (
                      <p className="plugin-note">
                        Workspace policy disables additional connections.
                      </p>
                    )}
                    {current.package.mcpServers
                      .filter((server) => server.supported)
                      .map((requirement) => {
                        const binding = current.bindings.find(
                          (item) =>
                            item.version === current.version &&
                            item.requirementKey === requirement.key,
                        )
                        const available = matchingPluginConnections(
                          requirement.url,
                          servers,
                        )
                        const validBinding = available.find(
                          (server) => server.id === binding?.serverId,
                        )
                        return (
                          <div className="plugin-binding" key={requirement.key}>
                            <label>
                              <span>{requirement.key}</span>
                              <SelectField
                                aria-label={`Connection for ${requirement.key}`}
                                value={binding?.serverId ?? ''}
                                disabled={disabled || !allowMcp}
                                onValueChange={(value) =>
                                  void command({
                                    type: 'bind',
                                    id: current.id,
                                    commandId: crypto.randomUUID(),
                                    expectedRevision: current.revision,
                                    version: current.version,
                                    requirementKey: requirement.key,
                                    serverId: value || null,
                                  })
                                }
                                items={[
                                  {
                                    value: '',
                                    label: 'Choose connection',
                                  },
                                  ...(binding && !validBinding
                                    ? [
                                        {
                                          value: binding.serverId,
                                          label: 'Saved connection unavailable',
                                          disabled: true,
                                        },
                                      ]
                                    : []),
                                  ...available.map((server) => ({
                                    value: server.id,
                                    label: server.label,
                                  })),
                                ]}
                              />
                            </label>
                            <small>{requirement.url}</small>
                            {!available.length && (
                              <p className="plugin-note">
                                No enabled connection matches this endpoint.
                              </p>
                            )}
                            {validBinding && (
                              <p className="plugin-note">
                                Configured: {validBinding.label}. Access is
                                checked when used.
                              </p>
                            )}
                            {onConnect && (
                              <Button
                                variant="secondary"
                                type="button"
                                disabled={disabled || !allowMcp}
                                onClick={() =>
                                  void connect({
                                    installationId: current.id,
                                    version: current.version,
                                    revision: current.revision,
                                    requirementKey: requirement.key,
                                  })
                                }
                              >
                                {busy
                                  ? 'Preparing…'
                                  : available.length
                                    ? 'Add connection'
                                    : 'Connect'}
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    {onConnections && (
                      <Button
                        variant="secondary"
                        type="button"
                        disabled={disabled}
                        onClick={onConnections}
                      >
                        Manage connections
                      </Button>
                    )}
                  </section>
                )}
            </>
          )}
        </>
      ) : (
        <>
          <div className="plugin-toolbar">
            <input
              ref={searchField}
              type="search"
              value={search}
              aria-label="Search plugins"
              placeholder="Search"
              disabled={disabled}
              onChange={(event) => setSearch(event.target.value)}
            />
            <SelectField
              value={removed ? 'removed' : 'installed'}
              aria-label="Plugin filter"
              disabled={disabled}
              onValueChange={(value) => setRemoved(value === 'removed')}
              items={[
                {
                  value: 'installed',
                  label: 'Installed',
                },
                {
                  value: 'removed',
                  label: 'Removed',
                },
              ]}
            />
            <Button
              variant="secondary"
              type="button"
              disabled={disabled}
              onClick={() => openArchive()}
            >
              <Upload size={15} aria-hidden /> Add ZIP
            </Button>
          </div>
          {list.isError ? (
            <p className="error" role="alert">
              {pluginErrorMessage(list.error)}{' '}
              <Button
                variant="secondary"
                type="button"
                disabled={disabled}
                onClick={() => void list.refetch()}
              >
                Retry
              </Button>
            </p>
          ) : !list.isFetchedAfterMount ? (
            <LoadingState>Loading plugins…</LoadingState>
          ) : (
            <>
              <ul className="plugin-list">
                {shown.map((plugin) => (
                  <li key={plugin.id}>
                    <div className="plugin-list-main">
                      <Button
                        variant="secondary"
                        type="button"
                        ref={(element) => {
                          if (element)
                            rowButtons.current.set(plugin.id, element)
                          else rowButtons.current.delete(plugin.id)
                        }}
                        disabled={disabled}
                        onClick={() => {
                          setSelectedId(plugin.id)
                          setConfirmRemove(false)
                        }}
                      >
                        {plugin.name}
                      </Button>
                      {plugin.description && <p>{plugin.description}</p>}
                      <small>
                        {plugin.packageVersion && `${plugin.packageVersion} · `}
                        {pluginStateLabel(plugin)}
                      </small>
                    </div>
                    {!plugin.removed && (
                      <label className="plugin-switch">
                        <input
                          type="checkbox"
                          role="switch"
                          aria-label={`Enable ${plugin.name}`}
                          checked={plugin.enabled}
                          disabled={
                            disabled ||
                            plugin.compatibility.status !== 'supported'
                          }
                          onChange={() => lifecycle(plugin, 'enabled')}
                        />
                      </label>
                    )}
                    <Menu.Root>
                      <Menu.Trigger
                        disabled={disabled}
                        ref={(element: HTMLButtonElement | null) => {
                          if (element)
                            menuButtons.current.set(plugin.id, element)
                          else menuButtons.current.delete(plugin.id)
                        }}
                        render={
                          <IconButton
                            label={`Manage ${plugin.name}`}
                            disabled={disabled}
                          >
                            <MoreHorizontal size={17} aria-hidden />
                          </IconButton>
                        }
                      />
                      <Menu.Portal container={portal}>
                        <Menu.Positioner
                          className="plugin-menu-positioner"
                          align="end"
                          sideOffset={5}
                        >
                          <Menu.Popup
                            className="plugin-menu"
                            finalFocus={() =>
                              menuButtons.current.get(plugin.id)?.isConnected
                                ? true
                                : (backButton.current ?? searchField.current)
                            }
                          >
                            <Menu.Item
                              className="plugin-menu-option"
                              onClick={() => setSelectedId(plugin.id)}
                            >
                              Details
                            </Menu.Item>
                            {plugin.removed ? (
                              <Menu.Item
                                className="plugin-menu-option"
                                onClick={() => lifecycle(plugin, 'restore')}
                              >
                                Restore disabled
                              </Menu.Item>
                            ) : (
                              <Menu.Item
                                className="plugin-menu-option"
                                onClick={() => {
                                  setSelectedId(plugin.id)
                                  setConfirmRemove(true)
                                }}
                              >
                                Remove
                              </Menu.Item>
                            )}
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.Root>
                  </li>
                ))}
              </ul>
              {!shown.length && (
                <p className="plugin-note">
                  {search
                    ? 'No matching plugins.'
                    : removed
                      ? 'No removed plugins.'
                      : 'No installed plugins.'}
                </p>
              )}
              {list.hasNextPage && (
                <Button
                  variant="secondary"
                  type="button"
                  disabled={disabled || list.isFetchingNextPage}
                  onClick={() => void list.fetchNextPage()}
                >
                  Load more
                </Button>
              )}
            </>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!recoveryReady && (
        <Button variant="secondary" type="button" onClick={recover}>
          Retry recovery
        </Button>
      )}
      {pending && (
        <Button
          variant="secondary"
          type="button"
          disabled={busy}
          onClick={() => void command(pending)}
        >
          {busy ? 'Checking…' : 'Retry saved request'}
        </Button>
      )}
      {conflict && review && (
        <Button
          variant="secondary"
          type="button"
          disabled={disabled}
          onClick={() => {
            setReview(null)
            setSelectedId(review.base?.id ?? null)
            setError('')
            setConflict(false)
            void detail.refetch()
          }}
        >
          Discard review and reload
        </Button>
      )}
      {conflict && !review && (
        <Button
          variant="secondary"
          type="button"
          disabled={disabled}
          onClick={() => {
            setError('')
            setConflict(false)
            void invalidate()
          }}
        >
          Reload plugin
        </Button>
      )}
      {inspecting && (
        <p className="plugin-note" role="status">
          Reading package…
        </p>
      )}
    </div>
  )
}
