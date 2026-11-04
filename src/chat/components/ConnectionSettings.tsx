import { LoadingState } from './ui/LoadingState'
import { Button } from './ui/Button'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Menu } from '@base-ui/react/menu'
import { ArrowLeft, MoreHorizontal, Pause, Play, RefreshCw } from 'lucide-react'
import { z } from 'zod'
import {
  mcpAccountCommandSchema,
  mcpAccountSummarySchema,
  type McpAccountCommand,
  type McpAccountSummary,
} from '../core/mcp-accounts'
import {
  mcpSetupSummarySchema,
  prepareMcpSetupSchema,
  type McpSetupSummary,
} from '../core/mcp-setup'
import {
  pluginSummarySchema,
  pluginVersionSchema,
  type PluginVersion,
} from '../core/plugin-lifecycle'
import { useWorkspaceApi } from './WorkspaceApi'
import { definiteConnectionRejection } from './connection-errors'
export { definiteConnectionRejection } from './connection-errors'
import { IconButton } from './IconButton'
import { kodyAccountSchema, type KodyAccount } from '../core/kody-account'
import { kodyJobChangeResultSchema } from '../core/kody-jobs'
import {
  kodyServerEnabledResultSchema,
  kodyServerReconnectResultSchema,
} from '../core/kody-servers'
import { KodyRunHistory } from './KodyRunHistory'
import { KodySavedPackages } from './KodySavedPackages'
import { KodyCommunity } from './KodyCommunity'
import { KodyUsage } from './KodyUsage'
import { KodyAddServer } from './KodyAddServer'
import './connection-settings.css'

export function connectionStateLabel(account: McpAccountSummary) {
  if (!account.enabled || account.status === 'disabled') return 'Disabled'
  switch (account.status) {
    case 'checked':
      return account.authMode === 'none' ? 'Available' : 'Connected'
    case 'needs_auth':
      return account.authMode === 'none' ? 'Set up again' : 'Sign in again'
    case 'error':
      return 'Could not check'
    default:
      return 'Configured'
  }
}

export function canBindSetup(setup: McpSetupSummary, plugin: PluginVersion) {
  if (
    setup.status !== 'complete' ||
    !setup.plugin ||
    plugin.removed ||
    plugin.compatibility.status !== 'supported' ||
    plugin.id !== setup.plugin.installationId ||
    plugin.version !== setup.plugin.version
  )
    return false
  const requirement = plugin.package.mcpServers.find(
    (item) => item.key === setup.plugin!.requirementKey,
  )
  if (!requirement?.supported || !requirement.url) return false
  try {
    return new URL(requirement.url).href === new URL(setup.url).href
  } catch {
    return false
  }
}

export function nextConnectionSetupFocus({
  setup,
  account,
  plugin,
  accountPending,
  pluginPending,
  bound,
  busy,
  allowed,
  previousStage,
}: {
  setup?: McpSetupSummary
  account?: McpAccountSummary
  plugin?: PluginVersion
  accountPending: boolean
  pluginPending: boolean
  bound: boolean
  busy: boolean
  allowed: boolean
  previousStage?: string
}): { stage: string; target: 'back' | 'check' | 'use' | 'return' } | undefined {
  if (!setup || busy) return
  const stage =
    setup.status === 'complete'
      ? `complete:${bound ? 'bound' : 'unbound'}`
      : setup.status
  if (stage === previousStage) return
  if (setup.status !== 'complete') return { stage, target: 'back' }
  if (accountPending || (setup.plugin && pluginPending)) return
  if (bound) return { stage, target: 'return' }
  if (!allowed) return { stage, target: 'back' }
  if (
    setup.kind === 'oauth' &&
    account?.enabled &&
    account.status !== 'checked'
  )
    return { stage, target: 'check' }
  if (plugin && account?.enabled && canBindSetup(setup, plugin))
    return { stage, target: 'use' }
  return {
    stage,
    target: setup.plugin ? 'return' : account?.enabled ? 'check' : 'back',
  }
}

export function connectionError(cause: unknown) {
  return cause instanceof z.ZodError
    ? (cause.issues[0]?.message ?? 'Check the connection details.')
    : cause instanceof Error
      ? cause.message
      : 'The connection request failed.'
}

type Prepare = z.infer<typeof prepareMcpSetupSchema>
type Props = {
  userId: string
  setupId?: string
  onSetup(id?: string): void
  onPlugin(id: string): void
  developer: boolean
  allowed?: boolean
  kodyAllowed: boolean
  kodyConnected: boolean
  onKodySettings(): void
  returnBotId?: string
  refresh(): Promise<unknown>
}

export function ConnectionSettings(props: Props) {
  const { workspaceId } = useWorkspaceApi()
  return (
    <PrivateConnectionSettings
      key={JSON.stringify([props.userId, workspaceId])}
      {...props}
    />
  )
}

function PrivateConnectionSettings({
  userId,
  setupId,
  onSetup,
  onPlugin,
  developer,
  allowed = true,
  kodyAllowed,
  kodyConnected,
  onKodySettings,
  returnBotId,
  refresh,
}: Props) {
  const { request, workspaceId } = useWorkspaceApi()
  const queries = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [custom, setCustom] = useState(false)
  const [editing, setEditing] = useState<McpAccountSummary | null>(null)
  const [manualOnly, setManualOnly] = useState(false)
  const [manualPlugin, setManualPlugin] = useState<string | undefined>()
  const [form, setForm] = useState({ label: '', url: '', token: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [kodyJobBusy, setKodyJobBusy] = useState<string | null>(null)
  const [kodyJobError, setKodyJobError] = useState('')
  const [kodyServerBusy, setKodyServerBusy] = useState<string | null>(null)
  const [kodyServerError, setKodyServerError] = useState('')
  const [kodyServerAuth, setKodyServerAuth] = useState<{
    id: string
    href: string
  } | null>(null)
  const [pending, setPending] = useState<McpAccountCommand | null>(null)
  const [preparation, setPreparation] = useState<Prepare | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const locked = useRef(false)
  const mounted = useRef(true)
  const portal = useRef<HTMLDivElement>(null)
  const rowButtons = useRef(new Map<string, HTMLButtonElement>())
  const backButton = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const mutationFocus = useRef<HTMLElement | null>(null)
  const connectionName = useRef<HTMLInputElement>(null)
  const disconnectCancel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (custom) connectionName.current?.focus()
  }, [custom])
  useEffect(() => {
    if (confirmDisconnect) disconnectCancel.current?.focus()
  }, [confirmDisconnect])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (!selectedId || custom || setupId) return
    const frame = requestAnimationFrame(() => backButton.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [selectedId, custom, setupId])
  useEffect(() => {
    if (busy || !mutationFocus.current) return
    const origin = mutationFocus.current
    mutationFocus.current = null
    if (document.activeElement !== document.body) return
    const target =
      origin.isConnected && !origin.matches(':disabled, [aria-disabled="true"]')
        ? origin
        : (backButton.current ?? heading.current)
    target?.focus()
  }, [busy])
  const accounts = useQuery({
    queryKey: ['mcp-accounts', userId, workspaceId],
    queryFn: async () =>
      z
        .object({ items: z.array(mcpAccountSummarySchema) })
        .parse(await request('mcp/accounts')),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })
  const kodyAccount = useQuery({
    queryKey: ['kody-account', userId, workspaceId],
    queryFn: async () => kodyAccountSchema.parse(await request('kody/account')),
    enabled: kodyAllowed && kodyConnected,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: 60000,
    retry: false,
  })
  async function setKodyJobEnabled(
    item: KodyAccount['jobs']['items'][number],
    enabled: boolean,
  ) {
    if (locked.current || kodyJobBusy) return
    locked.current = true
    setKodyJobBusy(item.id)
    setKodyJobError('')
    try {
      const result = kodyJobChangeResultSchema.parse(
        await request(`kody/jobs/${encodeURIComponent(item.id)}/enabled`, {
          enabled,
          expected: {
            enabled: item.enabled,
            sourceId: item.sourceId,
            publishedCommit: item.publishedCommit ?? null,
            updatedAt: item.updatedAt,
          },
        }),
      )
      if (result.id !== item.id || result.enabled !== enabled)
        throw new Error('Kody did not confirm the requested job state.')
      queries.setQueryData<KodyAccount>(
        ['kody-account', userId, workspaceId],
        (account) =>
          account
            ? {
                ...account,
                jobs: {
                  ...account.jobs,
                  items: account.jobs.items.map((job) =>
                    job.id === result.id
                      ? {
                          ...job,
                          enabled: result.enabled,
                          updatedAt: result.updatedAt,
                        }
                      : job,
                  ),
                },
              }
            : account,
      )
    } catch (cause) {
      setKodyJobError(
        cause instanceof Error
          ? cause.message
          : 'The job state could not be confirmed.',
      )
    } finally {
      locked.current = false
      setKodyJobBusy(null)
      void queries.invalidateQueries({
        queryKey: ['kody-account', userId, workspaceId],
      })
    }
  }
  async function checkKodyServer(
    item: KodyAccount['servers']['items'][number],
  ) {
    if (locked.current || kodyServerBusy) return
    locked.current = true
    setKodyServerBusy(item.id)
    setKodyServerError('')
    setKodyServerAuth(null)
    try {
      const result = kodyServerReconnectResultSchema.parse(
        await request(
          `kody/servers/${encodeURIComponent(item.id)}/${item.connected ? 'check' : 'reconnect'}`,
          {
            expected: {
              name: item.name,
              updatedAt: item.updatedAt,
              enabled: true,
              connected: item.connected,
            },
          },
        ),
      )
      if (result.id !== item.id || result.name !== item.name)
        throw new Error('Kody did not confirm the same connection.')
      queries.setQueryData<KodyAccount>(
        ['kody-account', userId, workspaceId],
        (account) =>
          account
            ? {
                ...account,
                servers: {
                  ...account.servers,
                  items: account.servers.items.map((server) =>
                    server.id === result.id
                      ? {
                          ...server,
                          connected: result.connected,
                          state: result.state,
                          error: result.error,
                        }
                      : server,
                  ),
                },
              }
            : account,
      )
      if (result.authUrl)
        setKodyServerAuth({ id: item.id, href: result.authUrl })
      if (!result.connected && !result.authUrl)
        setKodyServerError(
          result.error ||
            (item.connected
              ? 'Kody could not reach this server.'
              : 'Kody could not reconnect this server.'),
        )
    } catch (cause) {
      setKodyServerError(
        cause instanceof Error
          ? cause.message
          : 'The connection could not be checked.',
      )
    } finally {
      locked.current = false
      setKodyServerBusy(null)
      void queries.invalidateQueries({
        queryKey: ['kody-account', userId, workspaceId],
      })
      void queries.invalidateQueries({
        queryKey: ['reference-catalog', userId, workspaceId],
      })
    }
  }
  async function toggleKodyServer(
    item: KodyAccount['servers']['items'][number],
  ) {
    if (locked.current || kodyServerBusy) return
    locked.current = true
    setKodyServerBusy(item.id)
    setKodyServerError('')
    setKodyServerAuth(null)
    try {
      const result = kodyServerEnabledResultSchema.parse(
        await request(`kody/servers/${encodeURIComponent(item.id)}/enabled`, {
          operationId: crypto.randomUUID(),
          enabled: !item.enabled,
          expected: {
            name: item.name,
            updatedAt: item.updatedAt,
            enabled: item.enabled,
          },
        }),
      )
      if (result.id !== item.id || result.name !== item.name)
        throw new Error('Kody did not confirm the same connection.')
      queries.setQueryData<KodyAccount>(
        ['kody-account', userId, workspaceId],
        (account) =>
          account
            ? {
                ...account,
                servers: {
                  ...account.servers,
                  items: account.servers.items.map((server) =>
                    server.id === result.id
                      ? { ...server, enabled: result.enabled }
                      : server,
                  ),
                },
              }
            : account,
      )
    } catch (cause) {
      setKodyServerError(
        cause instanceof Error
          ? cause.message
          : 'The connection could not be changed.',
      )
    } finally {
      locked.current = false
      setKodyServerBusy(null)
      void queries.invalidateQueries({
        queryKey: ['kody-account', userId, workspaceId],
      })
      void queries.invalidateQueries({
        queryKey: ['reference-catalog', userId, workspaceId],
      })
    }
  }
  const items =
    accounts.isFetchedAfterMount && !accounts.isError
      ? (accounts.data?.items ?? [])
      : []
  const selected = items.find((item) => item.id === selectedId)
  const disabled = busy || !!pending || !!preparation
  const mutationDisabled = disabled || !allowed
  async function changed() {
    await Promise.all([
      queries.invalidateQueries({
        queryKey: ['mcp-accounts', userId, workspaceId],
      }),
      queries.invalidateQueries({
        queryKey: ['reference-catalog', userId, workspaceId],
      }),
      refresh(),
    ])
  }
  async function command(value: McpAccountCommand) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError('')
    const origin =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    try {
      const frozen = pending ?? mcpAccountCommandSchema.parse(value)
      setPending(frozen)
      mcpAccountSummarySchema.parse(await request('mcp/accounts', frozen))
      if (mounted.current) {
        setPending(null)
        setConfirmDisconnect(false)
        setForm({ label: '', url: '', token: '' })
        setCustom(false)
        setEditing(null)
      }
      await changed()
      mutationFocus.current = origin
      if (mounted.current && frozen.type === 'save' && manualPlugin) {
        setManualPlugin(undefined)
        onPlugin(manualPlugin)
      }
    } catch (cause) {
      if (mounted.current) {
        setError(connectionError(cause))
        if (definiteConnectionRejection(cause)) {
          setPending(null)
          await changed()
        }
      }
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function prepare(value: Prepare) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError('')
    try {
      const frozen =
        preparation ?? prepareMcpSetupSchema.parse({ ...value, returnBotId })
      setPreparation(frozen)
      const setup = mcpSetupSummarySchema.parse(
        await request('mcp/setup', frozen),
      )
      if (mounted.current) {
        setPreparation(null)
        setCustom(false)
        onSetup(setup.id)
      }
    } catch (cause) {
      if (mounted.current) {
        setError(connectionError(cause))
        if (definiteConnectionRejection(cause)) setPreparation(null)
      }
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }
  function reconnect(account: McpAccountSummary) {
    void prepare({
      id: crypto.randomUUID(),
      accountId: account.id,
      expectedRevision: account.revision,
    })
  }
  async function check(account: McpAccountSummary) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError('')
    try {
      mcpAccountSummarySchema.parse(
        await request(`mcp/accounts/${account.id}/check`, {
          expectedRevision: account.revision,
        }),
      )
      await changed()
    } catch (cause) {
      if (mounted.current) setError(connectionError(cause))
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }
  function enable(account: McpAccountSummary) {
    void command({
      type: 'enabled',
      id: account.id,
      commandId: crypto.randomUUID(),
      expectedRevision: account.revision,
      enabled: !account.enabled,
    })
  }
  function back() {
    const oldId = selectedId
    setSelectedId(null)
    setCustom(false)
    setEditing(null)
    setManualOnly(false)
    setManualPlugin(undefined)
    setError('')
    setConfirmDisconnect(false)
    requestAnimationFrame(() => {
      const target = oldId ? rowButtons.current.get(oldId) : undefined
      if (target?.isConnected) target.focus()
      else heading.current?.focus()
    })
  }
  if (setupId)
    return (
      <ConnectionSetup
        key={setupId}
        userId={userId}
        setupId={setupId}
        onBack={() => onSetup(undefined)}
        onPlugin={onPlugin}
        onChanged={changed}
        allowed={allowed}
        onManual={
          developer
            ? (setup) => {
                setForm({ label: setup.label, url: setup.url, token: '' })
                setEditing(
                  items.find((item) => item.id === setup.accountId) ?? null,
                )
                setManualOnly(true)
                setManualPlugin(setup.plugin?.installationId)
                setCustom(true)
                onSetup(undefined)
              }
            : undefined
        }
      />
    )
  return (
    <div className="connection-settings" ref={portal}>
      {kodyAllowed && (
        <section className="connection-kody">
          <div className="connection-kody-heading">
            <h3>Kody</h3>
            <span className="tag">Recommended</span>
          </div>
          {!kodyConnected ? (
            <Button type="button" variant="secondary" onClick={onKodySettings}>
              Connect Kody
            </Button>
          ) : kodyAccount.isPending ? (
            <LoadingState>Checking Kody connections…</LoadingState>
          ) : kodyAccount.isError ||
            kodyAccount.data?.status !== 'connected' ? (
            <div role="status">
              <p>Kody connections could not be checked.</p>
              <Button
                type="button"
                variant="secondary"
                onClick={onKodySettings}
              >
                Check Kody sign-in
              </Button>
            </div>
          ) : (
            <>
              {kodyAccount.data.identity.status === 'ready' && (
                <p className="connection-note">
                  {kodyAccount.data.identity.displayName ||
                    kodyAccount.data.identity.email}
                </p>
              )}
              {kodyAccount.data.integrations.items.map((item) => (
                <div
                  className="connection-kody-row"
                  key={`integration:${item.name}`}
                >
                  <strong>{item.name}</strong>
                  <span>
                    {item.authFailure ? 'Sign in again' : 'Saved in Kody'}
                  </span>
                  {item.authFailure?.reconnectHref && (
                    <a
                      href={item.authFailure.reconnectHref}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Reconnect
                    </a>
                  )}
                </div>
              ))}
              {kodyServerError && <p role="alert">{kodyServerError}</p>}
              {kodyAccount.data.servers.items.map((item) => (
                <div className="connection-kody-row" key={`server:${item.id}`}>
                  <strong>{item.name}</strong>
                  <span>
                    {!item.enabled
                      ? 'Disabled in Kody'
                      : item.connected
                        ? 'Connected in Kody'
                        : item.error || item.state}
                  </span>
                  {item.enabled &&
                    (kodyServerAuth?.id === item.id && !item.connected ? (
                      <a
                        href={kodyServerAuth.href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Continue sign-in at{' '}
                        {new URL(kodyServerAuth.href).hostname}
                      </a>
                    ) : (
                      <IconButton
                        label={`${item.connected ? 'Check' : 'Reconnect'} ${item.name}`}
                        disabled={!!kodyServerBusy || !!kodyJobBusy || disabled}
                        onClick={() => void checkKodyServer(item)}
                      >
                        <RefreshCw size={16} aria-hidden />
                      </IconButton>
                    ))}
                  {developer && (
                    <IconButton
                      label={`${item.enabled ? 'Disable' : 'Enable'} ${item.name}`}
                      disabled={!!kodyServerBusy || !!kodyJobBusy || disabled}
                      onClick={() => void toggleKodyServer(item)}
                    >
                      {item.enabled ? (
                        <Pause size={16} aria-hidden />
                      ) : (
                        <Play size={16} aria-hidden />
                      )}
                    </IconButton>
                  )}
                </div>
              ))}
              {developer && <KodyAddServer userId={userId} />}
              {kodyAccount.data.waiting.items
                .filter((item) => /integration|mcp|auth/iu.test(item.kind))
                .map((item) => (
                  <div
                    className="connection-kody-row"
                    key={`waiting:${item.kind}:${item.title}`}
                  >
                    <strong>{item.title}</strong>
                    {item.href && (
                      <a href={item.href} target="_blank" rel="noreferrer">
                        Open setup
                      </a>
                    )}
                  </div>
                ))}
              {kodyAccount.data.packages.status === 'ready' && (
                <KodySavedPackages
                  accountScope={kodyAccount.data.identity.userId || userId}
                  items={kodyAccount.data.packages.items}
                  limited={kodyAccount.data.packages.limited}
                />
              )}
              <KodyCommunity
                accountScope={kodyAccount.data.identity.userId || userId}
              />
              <KodyUsage
                accountScope={kodyAccount.data.identity.userId || userId}
              />
              {kodyAccount.data.jobs.status === 'ready' &&
                kodyAccount.data.jobs.items.length > 0 && (
                  <details className="connection-kody-section">
                    <summary>
                      Scheduled jobs ({kodyAccount.data.jobs.items.length}
                      {kodyAccount.data.jobs.limited ? '+' : ''})
                    </summary>
                    {kodyJobError && <p role="alert">{kodyJobError}</p>}
                    {kodyAccount.data.jobs.items.map((item) => (
                      <div className="connection-kody-row" key={item.id}>
                        <strong>{item.name}</strong>
                        <span>
                          {item.expired
                            ? 'Expired'
                            : item.killSwitchEnabled
                              ? 'Stopped in Kody'
                              : item.enabled
                                ? item.schedule
                                : 'Paused'}
                          {item.lastRunStatus
                            ? ` · Last run: ${item.lastRunStatus}`
                            : ''}
                        </span>
                        {!item.expired && !item.killSwitchEnabled && (
                          <IconButton
                            label={`${item.enabled ? 'Pause' : 'Resume'} ${item.name}`}
                            disabled={!!kodyJobBusy || disabled}
                            onClick={() =>
                              void setKodyJobEnabled(item, !item.enabled)
                            }
                          >
                            {item.enabled ? (
                              <Pause size={16} aria-hidden />
                            ) : (
                              <Play size={16} aria-hidden />
                            )}
                          </IconButton>
                        )}
                      </div>
                    ))}
                  </details>
                )}
              {kodyAccount.data.workflows.status === 'ready' &&
                kodyAccount.data.workflows.items.length > 0 && (
                  <details className="connection-kody-section">
                    <summary>
                      Recent workflows (
                      {kodyAccount.data.workflows.items.length}
                      {kodyAccount.data.workflows.limited ? '+' : ''})
                    </summary>
                    {kodyAccount.data.workflows.items.map((item) => (
                      <div className="connection-kody-row" key={item.id}>
                        <strong>{item.name}</strong>
                        <span>{item.status || 'Unknown status'}</span>
                      </div>
                    ))}
                  </details>
                )}
              <KodyRunHistory
                accountScope={
                  kodyAccount.data.identity.userId || kodyAccount.data.checkedAt
                }
              />
              {(
                [
                  kodyAccount.data.identity.status,
                  kodyAccount.data.packages.status,
                  kodyAccount.data.jobs.status,
                  kodyAccount.data.workflows.status,
                  kodyAccount.data.runs.status,
                  kodyAccount.data.integrations.status,
                  kodyAccount.data.servers.status,
                  kodyAccount.data.secrets.status,
                  kodyAccount.data.waiting.status,
                ] as const
              ).some((status) => status === 'unavailable') && (
                <p role="status">
                  Some Kody account details could not be checked.
                </p>
              )}
            </>
          )}
        </section>
      )}
      {!allowed && (
        <p className="connection-note">
          Workspace policy disables additional connections.
        </p>
      )}
      {(error || pending || preparation) && (
        <div role="alert" className="connection-error">
          {error && <p>{error}</p>}
          {(pending || preparation) && !busy && (
            <>
              <p>
                The result is unconfirmed. Retry this request before making
                another change.
              </p>
              <Button
                variant="secondary"
                type="button"
                onClick={() =>
                  pending
                    ? void command(pending)
                    : preparation && void prepare(preparation)
                }
              >
                Retry request
              </Button>
            </>
          )}
        </div>
      )}
      {custom ? (
        <>
          <div className="connection-heading">
            <IconButton
              ref={backButton}
              label="Back to connections"
              disabled={disabled}
              onClick={back}
            >
              <ArrowLeft size={16} aria-hidden />
            </IconButton>
            <strong>{editing ? 'Edit connection' : 'Custom connection'}</strong>
          </div>
          <form
            className="connection-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (form.token || editing)
                void command({
                  type: 'save',
                  id: editing?.id ?? crypto.randomUUID(),
                  commandId: crypto.randomUUID(),
                  expectedRevision: editing?.revision ?? 0,
                  label: form.label,
                  url: form.url,
                  authMode:
                    manualOnly || form.token || editing?.authMode === 'token'
                      ? 'token'
                      : 'none',
                  ...(form.token ? { token: form.token } : {}),
                })
              else
                void prepare({
                  id: crypto.randomUUID(),
                  label: form.label,
                  url: form.url,
                })
            }}
          >
            <fieldset disabled={mutationDisabled}>
              <label>
                Name
                <input
                  ref={connectionName}
                  required
                  maxLength={80}
                  value={form.label}
                  onChange={(event) =>
                    setForm({ ...form, label: event.target.value })
                  }
                />
              </label>
              <label>
                Service address
                <input
                  required
                  type="url"
                  maxLength={500}
                  placeholder="https://example.com/mcp"
                  value={form.url}
                  onChange={(event) =>
                    setForm({ ...form, url: event.target.value })
                  }
                />
              </label>
              <details open={manualOnly || undefined}>
                <summary>Manual token</summary>
                <label>
                  Bearer token
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder={
                      editing?.hasToken && editing.url === form.url
                        ? 'Leave blank to keep the saved token'
                        : ''
                    }
                    maxLength={16000}
                    value={form.token}
                    onChange={(event) =>
                      setForm({ ...form, token: event.target.value })
                    }
                  />
                </label>
                <p className="connection-note">
                  Access is checked after saving.
                </p>
              </details>
              <Button
                type="submit"
                variant="primary"
                disabled={manualOnly && !form.token}
              >
                {busy
                  ? form.token || editing
                    ? 'Saving…'
                    : 'Checking…'
                  : form.token || editing
                    ? 'Save connection'
                    : 'Continue'}
              </Button>
            </fieldset>
          </form>
        </>
      ) : selectedId ? (
        <>
          <div className="connection-heading">
            <IconButton
              ref={backButton}
              label="Back to connections"
              disabled={disabled}
              onClick={back}
            >
              <ArrowLeft size={16} aria-hidden />
            </IconButton>
            <strong>{selected?.label ?? 'Connection'}</strong>
          </div>
          {accounts.isError ? (
            <QueryError
              cause={accounts.error}
              onRetry={() => void accounts.refetch()}
            />
          ) : !accounts.isFetchedAfterMount ? (
            <LoadingState>Loading connection…</LoadingState>
          ) : !selected ? (
            <p>This connection is no longer available.</p>
          ) : (
            <>
              <ConnectionEvidence account={selected} />
              <label className="connection-enabled">
                Enabled
                <input
                  type="checkbox"
                  role="switch"
                  aria-label={`Enable ${selected.label}`}
                  checked={selected.enabled}
                  disabled={mutationDisabled}
                  onChange={() => enable(selected)}
                />
              </label>
              {!confirmDisconnect && (
                <div className="connection-actions">
                  {developer && selected.authMode !== 'oauth' && (
                    <Button
                      variant="secondary"
                      type="button"
                      disabled={mutationDisabled}
                      onClick={() => {
                        setEditing(selected)
                        setManualOnly(false)
                        setManualPlugin(undefined)
                        setForm({
                          label: selected.label,
                          url: selected.url,
                          token: '',
                        })
                        setCustom(true)
                      }}
                    >
                      Edit connection
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={mutationDisabled}
                    onClick={() => reconnect(selected)}
                  >
                    {selected.authMode === 'none'
                      ? 'Set up again'
                      : 'Reconnect'}
                  </Button>
                  <IconButton
                    label={`Check ${selected.label}`}
                    disabled={mutationDisabled || !selected.enabled}
                    onClick={() => void check(selected)}
                  >
                    <RefreshCw size={16} aria-hidden />
                  </IconButton>
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={mutationDisabled}
                    onClick={() => setConfirmDisconnect(true)}
                  >
                    Disconnect
                  </Button>
                </div>
              )}
              {confirmDisconnect && (
                <div className="connection-confirm">
                  <p>
                    Disconnect {selected.label}?{' '}
                    {selected.authMode === 'none'
                      ? 'This stops future use in TanChat.'
                      : 'This removes TanChat’s saved credentials, it does not guarantee that the service revokes its grant.'}{' '}
                    Plugins using this connection will lose access. An action
                    already running may still finish.
                  </p>
                  <div className="connection-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      ref={disconnectCancel}
                      disabled={disabled}
                      onClick={() => setConfirmDisconnect(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="secondary"
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        void command({
                          type: 'disconnect',
                          id: selected.id,
                          commandId: crypto.randomUUID(),
                          expectedRevision: selected.revision,
                        })
                      }
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div className="connection-toolbar">
            <h3 ref={heading} tabIndex={-1} className="sr-only">
              Connections
            </h3>
            {developer && (
              <Button
                type="button"
                variant="secondary"
                disabled={mutationDisabled}
                onClick={() => {
                  setForm({ label: '', url: '', token: '' })
                  setEditing(null)
                  setManualOnly(false)
                  setManualPlugin(undefined)
                  setCustom(true)
                }}
              >
                Custom connection
              </Button>
            )}
          </div>
          {accounts.isError ? (
            <QueryError
              cause={accounts.error}
              onRetry={() => void accounts.refetch()}
            />
          ) : !accounts.isFetchedAfterMount ? (
            <LoadingState>Loading connections…</LoadingState>
          ) : items.length === 0 ? (
            <p className="connection-note">
              Connect an account from a plugin that needs it.
            </p>
          ) : (
            <ul className="connection-list">
              {items.map((account) => (
                <li key={account.id}>
                  <button
                    className="connection-name"
                    type="button"
                    disabled={disabled}
                    ref={(element) => {
                      if (element) rowButtons.current.set(account.id, element)
                      else rowButtons.current.delete(account.id)
                    }}
                    onClick={() => {
                      setSelectedId(account.id)
                      setConfirmDisconnect(false)
                      setError('')
                    }}
                  >
                    <strong>{account.label}</strong>
                    <span>{connectionStateLabel(account)}</span>
                  </button>
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={`Enable ${account.label}`}
                    checked={account.enabled}
                    disabled={mutationDisabled}
                    onChange={() => enable(account)}
                  />
                  <Menu.Root>
                    <Menu.Trigger
                      disabled={disabled}
                      render={
                        <IconButton
                          label={`Manage ${account.label}`}
                          disabled={disabled}
                        >
                          <MoreHorizontal size={17} aria-hidden />
                        </IconButton>
                      }
                    />
                    <Menu.Portal container={portal}>
                      <Menu.Positioner
                        className="connection-menu-positioner"
                        sideOffset={5}
                        align="end"
                      >
                        <Menu.Popup
                          className="connection-menu"
                          finalFocus={() =>
                            backButton.current?.isConnected
                              ? backButton.current
                              : true
                          }
                        >
                          <Menu.Item
                            className="connection-menu-item"
                            onClick={() => {
                              setSelectedId(account.id)
                              setConfirmDisconnect(false)
                            }}
                          >
                            Details
                          </Menu.Item>
                          <Menu.Item
                            className="connection-menu-item"
                            disabled={!allowed || !account.enabled}
                            onClick={() => void check(account)}
                          >
                            Check connection
                          </Menu.Item>
                          <Menu.Item
                            className="connection-menu-item"
                            disabled={!allowed}
                            onClick={() => reconnect(account)}
                          >
                            Reconnect
                          </Menu.Item>
                          <Menu.Item
                            className="connection-menu-item"
                            disabled={!allowed}
                            onClick={() => {
                              setSelectedId(account.id)
                              setConfirmDisconnect(true)
                            }}
                          >
                            Disconnect…
                          </Menu.Item>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.Root>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export function ConnectionEvidence({
  account,
}: {
  account: McpAccountSummary
}) {
  return (
    <div className="connection-evidence">
      <p>{connectionStateLabel(account)}</p>
      <span>{account.url}</span>
      <small>
        {account.authMode === 'none'
          ? 'No account required'
          : !account.hasToken
            ? 'No usable sign-in'
            : account.authMode === 'oauth'
              ? 'OAuth account'
              : 'Saved token'}
      </small>
      {account.checkedAt !== undefined && (
        <small>
          Last checked {new Date(account.checkedAt).toLocaleString()}
        </small>
      )}
      {account.error && <p role="status">{account.error}</p>}
    </div>
  )
}
function QueryError({ cause, onRetry }: { cause: unknown; onRetry(): void }) {
  return (
    <div role="alert" className="connection-error">
      <p>{connectionError(cause)}</p>
      <Button type="button" variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

function ConnectionSetup({
  userId,
  setupId,
  onBack,
  onPlugin,
  onChanged,
  onManual,
  allowed,
}: {
  userId: string
  setupId: string
  onBack(): void
  onPlugin(id: string): void
  onChanged(): Promise<unknown>
  onManual?: (setup: McpSetupSummary) => void
  allowed: boolean
}) {
  const { request, workspaceId } = useWorkspaceApi()
  const queries = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pendingBind, setPendingBind] = useState<{
    type: 'bind'
    id: string
    commandId: string
    expectedRevision: number
    version: number
    requirementKey: string
    serverId: string
  } | null>(null)
  const lock = useRef(false)
  const mounted = useRef(true)
  const backAction = useRef<HTMLButtonElement>(null)
  const checkAction = useRef<HTMLButtonElement>(null)
  const useAction = useRef<HTMLButtonElement>(null)
  const returnAction = useRef<HTMLButtonElement>(null)
  const focusedStage = useRef<string | undefined>(undefined)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const key = ['mcp-setup', userId, workspaceId, setupId]
  const setupQuery = useQuery({
    queryKey: key,
    queryFn: async () =>
      mcpSetupSummarySchema.parse(
        await request(`mcp/setup/${encodeURIComponent(setupId)}`),
      ),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === 'starting' ? 1000 : false,
    refetchIntervalInBackground: false,
  })
  const setup =
    setupQuery.isFetchedAfterMount && !setupQuery.isError
      ? setupQuery.data
      : undefined
  const accounts = useQuery({
    queryKey: ['mcp-accounts', userId, workspaceId],
    queryFn: async () =>
      z
        .object({ items: z.array(mcpAccountSummarySchema) })
        .parse(await request('mcp/accounts')),
    enabled: setup?.status === 'complete',
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })
  const account =
    accounts.isFetchedAfterMount && !accounts.isError
      ? accounts.data?.items.find((item) => item.id === setup?.accountId)
      : undefined
  const pluginQuery = useQuery({
    queryKey: [
      'connection-plugin',
      userId,
      workspaceId,
      setupId,
      setup?.plugin?.installationId,
    ],
    enabled: setup?.status === 'complete' && !!setup.plugin,
    queryFn: async () =>
      pluginVersionSchema.parse(
        await request(
          `plugins/${encodeURIComponent(setup!.plugin!.installationId)}`,
        ),
      ),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })
  const plugin =
    pluginQuery.isFetchedAfterMount &&
    !pluginQuery.isError &&
    !pluginQuery.isFetching
      ? pluginQuery.data
      : undefined
  const bound =
    setup &&
    plugin &&
    canBindSetup(setup, plugin) &&
    plugin.bindings.some(
      (binding) =>
        binding.version === setup.plugin!.version &&
        binding.requirementKey === setup.plugin!.requirementKey &&
        binding.serverId === setup.accountId,
    )
  const completed = useRef(false)
  const nextFocus = nextConnectionSetupFocus({
    setup,
    account,
    plugin,
    accountPending:
      !accounts.isError &&
      (!accounts.isFetchedAfterMount || accounts.isFetching),
    pluginPending: !pluginQuery.isError && !plugin,
    bound: !!bound,
    busy,
    allowed,
    previousStage: focusedStage.current,
  })
  useEffect(() => {
    if (!nextFocus) return
    const target = {
      back: backAction,
      check: checkAction,
      use: useAction,
      return: returnAction,
    }[nextFocus.target].current
    if (
      !target ||
      target.disabled ||
      target.getAttribute('aria-disabled') === 'true'
    )
      return
    target.focus()
    focusedStage.current = nextFocus.stage
  }, [nextFocus?.stage, nextFocus?.target])
  useEffect(() => {
    if (setup?.status === 'complete' && !completed.current) {
      completed.current = true
      void onChanged().catch((cause) => {
        if (mounted.current) setError(connectionError(cause))
      })
    }
  }, [setup?.status])
  async function start() {
    if (lock.current || !setup) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const value = mcpSetupSummarySchema.parse(
        await request(`mcp/setup/${encodeURIComponent(setupId)}/start`, {}),
      )
      queries.setQueryData(key, value)
      if (value.status === 'authorize' && value.authorizationUrl)
        window.location.assign(value.authorizationUrl)
      else await setupQuery.refetch()
    } catch (cause) {
      if (mounted.current) setError(connectionError(cause))
    } finally {
      lock.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function bind() {
    if (
      lock.current ||
      !setup ||
      (!pendingBind && (!plugin || !canBindSetup(setup, plugin)))
    )
      return
    lock.current = true
    setBusy(true)
    setError('')
    const value = pendingBind ?? {
      type: 'bind' as const,
      id: plugin!.id,
      commandId: crypto.randomUUID(),
      expectedRevision: plugin!.revision,
      version: setup.plugin!.version,
      requirementKey: setup.plugin!.requirementKey,
      serverId: setup.accountId,
    }
    setPendingBind(value)
    try {
      pluginSummarySchema.parse(await request('plugins', value))
      setPendingBind(null)
      await Promise.all([
        pluginQuery.refetch(),
        onChanged(),
        queries.invalidateQueries({
          queryKey: ['plugin', userId, workspaceId],
        }),
      ])
    } catch (cause) {
      if (mounted.current) {
        setError(connectionError(cause))
        if (definiteConnectionRejection(cause)) {
          setPendingBind(null)
          await pluginQuery.refetch()
        }
      }
    } finally {
      lock.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function checkConnection() {
    if (lock.current || !account) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      mcpAccountSummarySchema.parse(
        await request(`mcp/accounts/${account.id}/check`, {
          expectedRevision: account.revision,
        }),
      )
      await Promise.all([accounts.refetch(), onChanged()])
    } catch (cause) {
      if (mounted.current) setError(connectionError(cause))
    } finally {
      lock.current = false
      if (mounted.current) setBusy(false)
    }
  }
  return (
    <div className="connection-settings">
      {!allowed && (
        <p className="connection-note">
          Workspace policy disables additional connections.
        </p>
      )}
      <div className="connection-heading">
        <IconButton
          ref={backAction}
          label="Back to connections"
          disabled={busy || !!pendingBind}
          onClick={onBack}
        >
          <ArrowLeft size={16} aria-hidden />
        </IconButton>
        <strong>{setup?.label ?? 'Connection setup'}</strong>
      </div>
      {error && (
        <p role="alert" className="connection-error">
          {error}
        </p>
      )}
      {setupQuery.isError ? (
        <QueryError
          cause={setupQuery.error}
          onRetry={() => void setupQuery.refetch()}
        />
      ) : !setup ? (
        <LoadingState>Loading connection…</LoadingState>
      ) : (
        <>
          {setup.status !== 'complete' && (
            <p className="connection-address">{setup.url}</p>
          )}
          {setup.error && (
            <p role="alert" className="connection-error">
              {setup.error}
            </p>
          )}
          {setup.status === 'complete' ? (
            <>
              <p role="status">
                {setup.kind === 'public'
                  ? 'Connection saved.'
                  : 'Sign-in saved.'}
              </p>
              {accounts.isError ? (
                <QueryError
                  cause={accounts.error}
                  onRetry={() => void accounts.refetch()}
                />
              ) : !accounts.isFetchedAfterMount ? (
                <LoadingState>Loading connection…</LoadingState>
              ) : account ? (
                <>
                  <ConnectionEvidence account={account} />
                  <div className="connection-actions">
                    <Button
                      ref={checkAction}
                      variant="secondary"
                      type="button"
                      disabled={
                        busy || !!pendingBind || !account.enabled || !allowed
                      }
                      onClick={() => void checkConnection()}
                    >
                      {busy ? 'Checking…' : 'Check connection'}
                    </Button>
                  </div>
                </>
              ) : (
                <p>This connection is no longer available.</p>
              )}
              {setup.plugin && (
                <>
                  {pluginQuery.isError ? (
                    <QueryError
                      cause={pluginQuery.error}
                      onRetry={() => void pluginQuery.refetch()}
                    />
                  ) : !plugin ? (
                    <p role="status">Checking plugin…</p>
                  ) : bound ? (
                    <p>Selected for {setup.plugin.name}.</p>
                  ) : canBindSetup(setup, plugin) ? (
                    <p>Use this connection for {setup.plugin.name}?</p>
                  ) : (
                    <p>
                      The plugin changed or is no longer available. Review its
                      current requirements.
                    </p>
                  )}
                  <div className="connection-actions">
                    {pendingBind ? (
                      <Button
                        variant="primary"
                        type="button"
                        disabled={busy}
                        onClick={() => void bind()}
                      >
                        Retry use connection
                      </Button>
                    ) : (
                      plugin &&
                      canBindSetup(setup, plugin) &&
                      !bound && (
                        <Button
                          ref={useAction}
                          variant="primary"
                          type="button"
                          disabled={busy || !account?.enabled || !allowed}
                          onClick={() => void bind()}
                        >
                          Use connection
                        </Button>
                      )
                    )}
                    <Button
                      ref={returnAction}
                      variant="secondary"
                      type="button"
                      disabled={busy || !!pendingBind}
                      onClick={() => onPlugin(setup.plugin!.installationId)}
                    >
                      Return to plugin
                    </Button>
                  </div>
                </>
              )}
            </>
          ) : setup.kind === 'unsupported' ? (
            <>
              {!setup.error && (
                <p>Manual setup is required for this connection.</p>
              )}
              {onManual && (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => onManual(setup)}
                >
                  Advanced setup
                </Button>
              )}
            </>
          ) : setup.status === 'starting' ? (
            <p role="status">Preparing sign-in…</p>
          ) : setup.status === 'failed' ? (
            <p>Start a new setup from the connection or plugin.</p>
          ) : (
            <>
              {setup.kind === 'public' ? (
                <p>
                  No account required. The service responded to an access check.
                </p>
              ) : (
                <>
                  <p>
                    Sign in at{' '}
                    <span className="connection-address">{setup.issuer}</span>
                  </p>
                  {setup.scopes.length > 0 && (
                    <div className="connection-scopes">
                      <strong>Requested access</strong>
                      <ul>
                        {setup.scopes.map((scope) => (
                          <li key={scope}>{scope}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              <Button
                variant="primary"
                type="button"
                disabled={busy || !allowed || Date.now() >= setup.expiresAt}
                onClick={() => void start()}
              >
                {busy
                  ? 'Connecting…'
                  : setup.kind === 'public'
                    ? 'Connect'
                    : 'Continue to sign-in'}
              </Button>
              {Date.now() >= setup.expiresAt && (
                <p role="status">
                  This setup expired. Start again from the connection or plugin.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
