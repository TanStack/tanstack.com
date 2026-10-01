import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import type { KodyEnvironment } from './kody'
import { z } from 'zod'
import type { KodyAccount, KodyAccountSection } from '../core/kody-account'
import type { MessageReference } from '../core/message-references'
import { readKodyAccount } from './kody-account'
import { readKodyRun } from './kody-run'
import {
  assertKodyReferenceAccountUnchanged,
  kodyReferenceAccount,
  type KodyReferenceOptions,
  type KodyReferenceScope,
} from './kody-reference-access'

const sections = [
  'integrations',
  'servers',
  'jobs',
  'workflows',
  'runs',
] as const
const requiredSections = [
  'integrations',
  'servers',
  'jobs',
  'workflows',
] as const
type Section = (typeof sections)[number]
const objectSchema = z.object({
  entity: z
    .string()
    .min(1)
    .max(500)
    .regex(/^(integration|mcp-server|job|workflow-run|run):\S+$/),
  label: z.string().min(1).max(200),
  detail: z.string().max(200),
  section: z.enum(sections),
})
const catalogSchema = z.array(objectSchema).max(500)
const snapshotSchema = z.object({ items: catalogSchema, limited: z.boolean() })
type Item = z.infer<typeof objectSchema>
const maxBytes = 1024 * 1024
const freshFor = 5 * 60_000

function identity(kind: string, id: string) {
  return `${kind}:${encodeURIComponent(id)}`
}

export function projectKodyAccountReferences(account: KodyAccount): Item[] {
  if (
    account.status !== 'connected' ||
    requiredSections.some((section) => account[section].status !== 'ready')
  )
    throw new Error('Kody account objects could not be fully read.')
  const items: Item[] = [
    ...account.integrations.items.map((item) => ({
      entity: identity('integration', item.name),
      label: item.name,
      detail: `Integration · ${item.authFailure ? 'Reconnect needed' : (item.usageMode ?? 'Available')}`,
      section: 'integrations' as const,
    })),
    ...account.servers.items.map((item) => ({
      entity: identity('mcp-server', item.id),
      label: item.name,
      detail: `Kody MCP server · ${item.connected ? 'Connected' : item.state}`,
      section: 'servers' as const,
    })),
    ...account.jobs.items.map((item) => ({
      entity: identity('job', item.id),
      label: item.name,
      detail: `Saved job · ${item.enabled ? item.schedule : 'Paused'}`,
      section: 'jobs' as const,
    })),
    ...account.workflows.items.map((item) => ({
      entity: identity('workflow-run', item.id),
      label: item.name,
      detail: `Workflow run · ${item.status ?? 'Unknown status'}`,
      section: 'workflows' as const,
    })),
    ...(account.runs.status === 'ready'
      ? account.runs.items.map((item) => ({
          entity: identity('run', item.id),
          label: item.name || item.surface,
          detail:
            `Kody run · ${item.status} · ${item.surface} · ${item.startedAt}`.slice(
              0,
              200,
            ),
          section: 'runs' as const,
        }))
      : []),
  ]
  const parsed = catalogSchema.safeParse(items)
  if (
    !parsed.success ||
    new Set(items.map((item) => item.entity)).size !== items.length
  )
    throw new Error('Kody returned unsupported account object identities.')
  if (new TextEncoder().encode(JSON.stringify(items)).byteLength > maxBytes)
    throw new Error('Kody account object catalog is too large.')
  return parsed.data
}

function reference(item: Item): MessageReference {
  return {
    kind: 'kody',
    entity: item.entity,
    label: item.label,
    detail: item.detail,
  }
}

async function snapshot(
  env: KodyEnvironment,
  userId: string,
  fingerprint: string,
) {
  const [row] = await db.execute<{
    account_fingerprint: string
    metadata: string
    fetched_at: number
  }>(
    sql`SELECT account_fingerprint,metadata,fetched_at::double precision AS fetched_at FROM chat_kody_account_reference_catalog WHERE user_id=${userId}::uuid`,
  )
  if (
    !row ||
    row.account_fingerprint !== fingerprint ||
    row.fetched_at <= 0 ||
    new TextEncoder().encode(row.metadata).byteLength > maxBytes
  )
    return undefined
  try {
    const parsed = snapshotSchema.safeParse(JSON.parse(row.metadata))
    return parsed.success
      ? { ...parsed.data, fetchedAt: row.fetched_at }
      : undefined
  } catch {
    return undefined
  }
}

export async function listKodyAccountReferences(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions & { query: string },
) {
  const current = await kodyReferenceAccount(env, scope, options)
  if (!current.enabled)
    return {
      items: [] as MessageReference[],
      more: false,
      status: current.reason,
    }
  const saved = await snapshot(env, scope.userId, current.fingerprint)
  await assertKodyReferenceAccountUnchanged(env, scope, options, current)
  if (!saved)
    return {
      items: [] as MessageReference[],
      more: false,
      status: 'missing' as const,
    }
  const words = options.query.toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const found = saved.items.filter((item) =>
    words.every((word) =>
      `${item.label} ${item.detail}`.toLocaleLowerCase().includes(word),
    ),
  )
  found.sort(
    (a, b) =>
      a.label.localeCompare(b.label) || a.entity.localeCompare(b.entity),
  )
  return {
    items: found.slice(0, 50).map(reference),
    more: found.length > 50 || saved.limited,
    status:
      Date.now() - saved.fetchedAt < freshFor
        ? ('ready' as const)
        : ('stale' as const),
  }
}

export async function refreshKodyAccountReferences(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  signal: AbortSignal,
  read: typeof readKodyAccount = readKodyAccount,
) {
  const before = await kodyReferenceAccount(env, scope, options)
  if (!before.enabled) throw new Error('Kody account objects are unavailable.')
  if (signal.aborted)
    throw new Error('Kody account object refresh was stopped.')
  const [reservation] = await db.execute<{ revision: number }>(
    sql`INSERT INTO chat_kody_account_reference_catalog(user_id,account_fingerprint,metadata,fetched_at,revision) VALUES(${scope.userId}::uuid,${before.fingerprint},'[]',0,1) ON CONFLICT(user_id) DO UPDATE SET revision=chat_kody_account_reference_catalog.revision+1 RETURNING revision::double precision AS revision`,
  )
  if (!reservation)
    throw new Error('Kody account object refresh could not start.')
  const account = await read(
    env,
    scope.userId,
    scope.workspaceId,
    signal,
    sections,
  )
  if (signal.aborted)
    throw new Error('Kody account object refresh was stopped.')
  const items = projectKodyAccountReferences(account)
  const after = await assertKodyReferenceAccountUnchanged(
    env,
    scope,
    options,
    before,
  )
  const result =
    await db.execute(sql`UPDATE chat_kody_account_reference_catalog SET account_fingerprint=${after.fingerprint},metadata=${JSON.stringify({ items, limited: account.jobs.limited || account.workflows.limited || account.runs.status !== 'ready' || account.runs.more })},fetched_at=${Date.now()} WHERE user_id=${scope.userId}::uuid AND revision=${reservation.revision}
    AND EXISTS(SELECT 1 FROM chat_memberships m JOIN chat_workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=${scope.workspaceId} AND m.user_id=${scope.userId}::uuid AND w.policy=${after.policyText}::jsonb)
    AND (SELECT subject FROM chat_kody_links WHERE user_id=${scope.userId}::uuid) IS NOT DISTINCT FROM ${after.subject}::text RETURNING user_id`)
  if (!result.length)
    throw new Error(
      'Kody connection changed or a newer object refresh finished.',
    )
  return items.length
}

export async function resolveKodyAccountReference(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  input: { entity: string; operation?: string },
  options: KodyReferenceOptions,
  readRun: typeof readKodyRun = readKodyRun,
) {
  if (
    input.operation ||
    !objectSchema.shape.entity.safeParse(input.entity).success
  )
    throw new Error('Choose a Kody account object from the catalog.')
  const current = await kodyReferenceAccount(env, scope, options)
  if (!current.enabled) throw new Error('Connect Kody to use this reference.')
  const saved = await snapshot(env, scope.userId, current.fingerprint)
  const found = saved?.items.find((item) => item.entity === input.entity)
  if (!found && input.entity.startsWith('run:')) {
    const id = decodeURIComponent(input.entity.slice('run:'.length))
    const run = await readRun(
      env,
      scope.userId,
      id,
      AbortSignal.timeout(20_000),
    )
    await assertKodyReferenceAccountUnchanged(env, scope, options, current)
    return {
      kind: 'kody' as const,
      entity: input.entity,
      label: run.name || run.surface,
      detail: `Kody run · ${run.status} · ${run.surface}`,
    }
  }
  if (!found)
    throw new Error(
      'This Kody object changed. Refresh Kody and select it again.',
    )
  await assertKodyReferenceAccountUnchanged(env, scope, options, current)
  return reference(found)
}

export async function inspectKodyAccountReference(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  input: { entity: string; operation?: string },
  options: KodyReferenceOptions,
  signal: AbortSignal,
  read: typeof readKodyAccount = readKodyAccount,
  readRun: typeof readKodyRun = readKodyRun,
) {
  if (
    input.operation ||
    !objectSchema.shape.entity.safeParse(input.entity).success
  )
    throw new Error('Choose a Kody account object from the catalog.')
  const kind = input.entity.slice(0, input.entity.indexOf(':'))
  const id = decodeURIComponent(input.entity.slice(kind.length + 1))
  if (kind === 'run') {
    const current = await kodyReferenceAccount(env, scope, options)
    if (!current.enabled) throw new Error('Connect Kody to use this reference.')
    const run = await readRun(env, scope.userId, id, signal)
    await assertKodyReferenceAccountUnchanged(env, scope, options, current)
    return {
      kind: 'account-object' as const,
      title: run.name || run.surface,
      description: 'Kody run',
      fields: [
        { label: 'Status', value: run.status },
        { label: 'Surface', value: run.surface },
        { label: 'Started', value: run.startedAt ?? 'Unknown' },
        ...(run.finishedAt
          ? [{ label: 'Finished', value: run.finishedAt }]
          : []),
        ...(run.durationMs !== null
          ? [{ label: 'Duration', value: `${run.durationMs} ms` }]
          : []),
        ...(run.packageId ? [{ label: 'Package', value: run.packageId }] : []),
        ...(run.errorName ? [{ label: 'Error', value: run.errorName }] : []),
        ...(run.errorMessage
          ? [{ label: 'Error detail', value: run.errorMessage.slice(0, 1000) }]
          : []),
        { label: 'Logs', value: String(run.logCount) },
        ...(run.logs.length
          ? [
              {
                label: 'Recent logs',
                value: run.logs
                  .slice(-10)
                  .map(
                    (log) =>
                      `${log.sequence} ${log.level}: ${log.message.slice(0, 500)}`,
                  )
                  .join('\n'),
              },
            ]
          : []),
      ],
    }
  }
  await resolveKodyAccountReference(env, scope, input, options)
  const section: Section =
    kind === 'integration'
      ? 'integrations'
      : kind === 'mcp-server'
        ? 'servers'
        : kind === 'job'
          ? 'jobs'
          : 'workflows'
  const account = await read(env, scope.userId, scope.workspaceId, signal, [
    section,
  ] as KodyAccountSection[])
  if (account.status !== 'connected' || account[section].status !== 'ready')
    throw new Error('Kody object status could not be read.')
  const item =
    section === 'integrations'
      ? account.integrations.items.find((item) => item.name === id)
      : section === 'servers'
        ? account.servers.items.find((item) => item.id === id)
        : section === 'jobs'
          ? account.jobs.items.find((item) => item.id === id)
          : account.workflows.items.find((item) => item.id === id)
  if (!item) throw new Error('This Kody object is no longer available.')
  await resolveKodyAccountReference(env, scope, input, options)
  if (section === 'integrations') {
    const integration = account.integrations.items.find(
      (entry) => entry.name === id,
    )!
    return {
      kind: 'account-object' as const,
      title: integration.name,
      description: 'Kody integration',
      fields: [
        { label: 'Usage', value: integration.usageMode ?? 'Available' },
        ...(integration.authFailure
          ? [{ label: 'Needs attention', value: integration.authFailure.title }]
          : []),
      ],
    }
  }
  if (section === 'servers') {
    const server = account.servers.items.find((entry) => entry.id === id)!
    return {
      kind: 'account-object' as const,
      title: server.name,
      description: 'Kody MCP server',
      fields: [
        {
          label: 'Connection',
          value: server.connected ? 'Connected' : server.state,
        },
        { label: 'Enabled', value: server.enabled ? 'Yes' : 'No' },
        { label: 'Tools', value: String(server.toolCount) },
        ...(server.error ? [{ label: 'Error', value: server.error }] : []),
      ],
    }
  }
  if (section === 'jobs') {
    const job = account.jobs.items.find((entry) => entry.id === id)!
    return {
      kind: 'account-object' as const,
      title: job.name,
      description: 'Saved Kody job',
      fields: [
        { label: 'Schedule', value: job.schedule },
        { label: 'State', value: job.enabled ? 'Enabled' : 'Paused' },
        ...(job.nextRunAt ? [{ label: 'Next run', value: job.nextRunAt }] : []),
        ...(job.lastRunStatus
          ? [{ label: 'Last run', value: job.lastRunStatus }]
          : []),
      ],
    }
  }
  const workflow = account.workflows.items.find((entry) => entry.id === id)!
  return {
    kind: 'account-object' as const,
    title: workflow.name,
    description: 'Kody workflow run',
    fields: [
      { label: 'Status', value: workflow.status ?? 'Unknown' },
      ...(workflow.updatedAt
        ? [{ label: 'Updated', value: workflow.updatedAt }]
        : []),
    ],
  }
}
