import { z } from 'zod'
import {
  kodyAccountSchema,
  type KodyAccount,
  type KodyAccountSection,
} from '../core/kody-account'
import { readWorkspacePolicy } from '../workspace-policy.server'
import type { KodyEnvironment } from './kody'
import { readCredentials } from './credentials'
import { kodyCall } from './kody'
import {
  KODY_INTERNAL_READ_PREFIX,
  kodyInternalReadArgs,
} from './kody-internal-read'

export const KODY_ACCOUNT_CODE = `import { kody } from 'kody:runtime'
export default async function main(params) {
  const allowed = ['metaGetCurrentUser', 'packageList', 'jobList', 'workflowRunList', 'runList', 'integrationList', 'mcpServerList', 'secretList', 'waitingSummary']
  const names = Array.isArray(params?.sources) ? [...new Set(params.sources)].filter(name => allowed.includes(name)) : []
  const pick = (value, fields) => Object.fromEntries(fields.map(field => [field, value?.[field]]))
  const rows = (value, field, limit, fields) => ({ [field]: Array.isArray(value?.[field]) ? value[field].slice(0, limit).map(item => pick(item, fields)) : value?.[field], limited: Array.isArray(value?.[field]) && value[field].length > limit })
  const project = (name, value) => {
    switch (name) {
      case 'metaGetCurrentUser': return pick(value, ['user_id', 'display_name', 'email'])
      case 'packageList': return rows(value, 'packages', 100, ['package_id', 'name', 'description', 'visibility', 'updated_at', 'origin_commit', 'source_listing_id', 'listing_name', 'source_id', 'has_app', 'locked_at', 'listing_ahead', 'listing_pinned_commit'])
      case 'jobList': return rows(value, 'jobs', 50, ['id', 'name', 'source_id', 'published_commit', 'schedule_summary', 'enabled', 'kill_switch_enabled', 'expired', 'updated_at', 'next_run_at', 'last_run_status'])
      case 'workflowRunList': return { ...rows(value, 'workflows', 25, ['id', 'workflow_name', 'status', 'source_id', 'updated_at']), limited: Array.isArray(value?.workflows) && value.workflows.length >= 25 }
      case 'runList': return value
      case 'integrationList': return { integrations: Array.isArray(value?.integrations) ? value.integrations.slice(0, 100).map(item => ({ ...pick(item, ['name', 'usageMode']), lastAuthFailure: item.lastAuthFailure ? pick(item.lastAuthFailure, ['title', 'why', 'reconnectHref']) : null })) : value?.integrations }
      case 'mcpServerList': return rows(value, 'servers', 100, ['id', 'name', 'enabled', 'connected', 'state', 'toolCount', 'updatedAt', 'error'])
      case 'secretList': return rows(value, 'secrets', 100, ['name', 'scope', 'expires_at'])
      case 'waitingSummary': return rows(value, 'items', 100, ['kind', 'title', 'why', 'href', 'severity'])
    }
  }
  const readRuns = async () => {
    const fields = ['id', 'surface', 'status', 'name', 'package_id', 'source_id', 'published_commit', 'started_at', 'duration_ms']
    const visible = []
    const seen = new Set()
    let cursor = null
    for (let page = 0; page < 10; page++) {
      const result = await kody.runList({ limit: 100, ...(cursor ? { cursor } : {}) })
      if (!Array.isArray(result?.runs)) throw new Error('Unsupported Kody run page')
      for (const run of result.runs) {
        if (typeof run?.idempotency_key === 'string' && run.idempotency_key.startsWith(${JSON.stringify(KODY_INTERNAL_READ_PREFIX)})) continue
        visible.push(pick(run, fields))
      }
      const next = result.next_cursor
      if (!next || visible.length >= 10) return { runs: visible.slice(0, 10), more: visible.length > 10 || Boolean(next) }
      if (typeof next !== 'string' || seen.has(next)) throw new Error('Unsupported Kody run cursor')
      seen.add(next)
      cursor = next
    }
    return { runs: visible.slice(0, 10), more: Boolean(cursor) }
  }
  const results = await Promise.allSettled(names.map(name => name === 'runList' ? readRuns() : kody[name](name === 'workflowRunList' ? { limit: 25 } : {})))
  return Object.fromEntries(names.map((name, index) => [name, results[index].status === 'fulfilled' ? { ok: true, value: project(name, results[index].value) } : { ok: false }]))
}`

const memoryCode = `import { kody } from 'kody:runtime'
export default async function main(params) {
  return await kody.metaMemorySearch({ query: params.query, limit: 2 })
}`

const envelope = z.object({
  isError: z.boolean().optional(),
  structuredContent: z.object({ result: z.unknown() }),
})
const source = z.object({ ok: z.boolean(), value: z.unknown().optional() })
const accountResult = z.object({
  metaGetCurrentUser: source.optional(),
  packageList: source.optional(),
  jobList: source.optional(),
  workflowRunList: source.optional(),
  runList: source.optional(),
  integrationList: source.optional(),
  mcpServerList: source.optional(),
  secretList: source.optional(),
  waitingSummary: source.optional(),
})
const accountSources: Record<KodyAccountSection, string> = {
  identity: 'metaGetCurrentUser',
  packages: 'packageList',
  jobs: 'jobList',
  workflows: 'workflowRunList',
  runs: 'runList',
  integrations: 'integrationList',
  servers: 'mcpServerList',
  secrets: 'secretList',
  waiting: 'waitingSummary',
}
const defaultAccountSections: KodyAccountSection[] = [
  'identity',
  'packages',
  'jobs',
  'workflows',
  'runs',
  'integrations',
  'servers',
  'waiting',
]
const identityResult = z.object({
  user_id: z.string(),
  display_name: z.string(),
  email: z.string(),
})
const packageResult = z.object({
  limited: z.boolean().optional(),
  packages: z
    .array(
      z.object({
        package_id: z.string(),
        source_id: z.string().optional(),
        has_app: z.boolean().optional(),
        locked_at: z.string().nullish(),
        listing_ahead: z.boolean().nullish(),
        listing_pinned_commit: z.string().nullish(),
        name: z.string(),
        description: z.string().nullish(),
        visibility: z.string().nullish(),
        updated_at: z.string().nullish(),
        origin_commit: z.string().nullish(),
        source_listing_id: z.string().nullish(),
        listing_name: z.string().nullish(),
      }),
    )
    .max(100),
})
const jobResult = z.object({
  limited: z.boolean().optional(),
  jobs: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        source_id: z.string(),
        published_commit: z.string().nullish(),
        schedule_summary: z.string(),
        enabled: z.boolean(),
        kill_switch_enabled: z.boolean(),
        expired: z.boolean(),
        updated_at: z.string(),
        next_run_at: z.string().nullish(),
        last_run_status: z.string().nullish(),
      }),
    )
    .max(50),
})
const workflowResult = z.object({
  limited: z.boolean().optional(),
  workflows: z
    .array(
      z.object({
        id: z.string(),
        workflow_name: z.string(),
        status: z.string().nullish(),
        source_id: z.string().nullish(),
        updated_at: z.string().nullish(),
      }),
    )
    .max(25),
})
const runResult = z.object({
  more: z.boolean().optional(),
  runs: z
    .array(
      z.object({
        id: z.string(),
        surface: z.string(),
        status: z.string(),
        name: z.string().nullish(),
        package_id: z.string().nullish(),
        source_id: z.string().nullish(),
        published_commit: z.string().nullish(),
        started_at: z.string(),
        duration_ms: z.number().nullish(),
      }),
    )
    .max(10),
  next_cursor: z.string().nullish(),
})
const integrationResult = z
  .object({
    integrations: z
      .array(
        z
          .object({
            name: z.string(),
            usageMode: z.string().optional(),
            lastAuthFailure: z
              .object({
                title: z.string().optional(),
                why: z.string().optional(),
                reconnectHref: z.string().optional(),
              })
              .passthrough()
              .nullish(),
          })
          .passthrough(),
      )
      .max(100),
  })
  .passthrough()
const serverResult = z
  .object({
    servers: z
      .array(
        z
          .object({
            id: z.string(),
            name: z.string(),
            enabled: z.boolean(),
            connected: z.boolean(),
            state: z.string(),
            toolCount: z.number(),
            updatedAt: z.string(),
            error: z.string().nullish(),
          })
          .passthrough(),
      )
      .max(100),
  })
  .passthrough()
const secretResult = z
  .object({
    secrets: z
      .array(
        z
          .object({
            name: z.string(),
            scope: z.string().optional(),
            expires_at: z.string().nullish(),
          })
          .passthrough(),
      )
      .max(100),
  })
  .passthrough()
const waitingResult = z
  .object({
    items: z
      .array(
        z
          .object({
            kind: z.string(),
            title: z.string(),
            why: z.string().optional(),
            href: z.string().optional(),
            severity: z.string().optional(),
          })
          .passthrough(),
      )
      .max(100),
  })
  .passthrough()
const memoryResult = z
  .object({
    matches: z
      .array(
        z
          .object({
            id: z.string(),
            subject: z.string(),
            summary: z.string(),
            status: z.string().optional(),
          })
          .passthrough(),
      )
      .max(20),
  })
  .passthrough()

function unwrap(raw: unknown) {
  const parsed = envelope.parse(raw)
  if (parsed.isError) throw new Error('Kody returned an error.')
  return parsed.structuredContent.result
}

function safeKodyUrl(value: string | undefined, origin: string) {
  if (!value) return undefined
  try {
    const url = new URL(value, origin)
    return url.origin === new URL(origin).origin ? url.href : undefined
  } catch {
    return undefined
  }
}

function unavailable(status: KodyAccount['status']): KodyAccount {
  return {
    status,
    identity: { status: 'unavailable' },
    packages: {
      status: 'unavailable',
      executionReadiness: 'not_checked',
      items: [],
      limited: false,
    },
    jobs: { status: 'unavailable', items: [], limited: false },
    workflows: { status: 'unavailable', items: [], limited: false },
    runs: { status: 'unavailable', items: [], more: false },
    integrations: { status: 'unavailable', items: [] },
    servers: { status: 'unavailable', items: [] },
    secrets: { status: 'unavailable', items: [] },
    waiting: { status: 'unavailable', items: [] },
    checkedAt: new Date().toISOString(),
  }
}

async function assertKodyAccess(userId: string, workspaceId: string) {
  const policy = await readWorkspacePolicy(workspaceId, userId)
  if (!policy.allowKody)
    throw new Error('Kody is unavailable in this workspace.')
}

export function projectKodyAccount(
  raw: unknown,
  origin: string,
  requestedSections: readonly KodyAccountSection[] = [
    'identity',
    'packages',
    'jobs',
    'workflows',
    'runs',
    'integrations',
    'servers',
    'secrets',
    'waiting',
  ],
): KodyAccount {
  const value = accountResult.parse(unwrap(raw))
  const requested = new Set(requestedSections)
  const readStatus = (section: KodyAccountSection, success: boolean) =>
    requested.has(section)
      ? success
        ? ('ready' as const)
        : ('unavailable' as const)
      : ('not_requested' as const)
  const identity = value.metaGetCurrentUser?.ok
    ? identityResult.safeParse(value.metaGetCurrentUser.value)
    : undefined
  const packages = value.packageList?.ok
    ? packageResult.safeParse(value.packageList.value)
    : undefined
  const jobs = value.jobList?.ok
    ? jobResult.safeParse(value.jobList.value)
    : undefined
  const workflows = value.workflowRunList?.ok
    ? workflowResult.safeParse(value.workflowRunList.value)
    : undefined
  const runs = value.runList?.ok
    ? runResult.safeParse(value.runList.value)
    : undefined
  const integrations = value.integrationList?.ok
    ? integrationResult.safeParse(value.integrationList.value)
    : undefined
  const servers = value.mcpServerList?.ok
    ? serverResult.safeParse(value.mcpServerList.value)
    : undefined
  const secrets = value.secretList?.ok
    ? secretResult.safeParse(value.secretList.value)
    : undefined
  const waiting = value.waitingSummary?.ok
    ? waitingResult.safeParse(value.waitingSummary.value)
    : undefined
  return kodyAccountSchema.parse({
    status: 'connected',
    identity: identity?.success
      ? {
          status: readStatus('identity', true),
          userId: identity.data.user_id,
          displayName: identity.data.display_name.slice(0, 120),
          email: identity.data.email.slice(0, 250),
        }
      : { status: readStatus('identity', false) },
    packages: {
      status: readStatus('packages', !!packages?.success),
      executionReadiness: 'not_checked',
      limited: packages?.success ? !!packages.data.limited : false,
      items: packages?.success
        ? packages.data.packages.map((item) => ({
            id: item.package_id,
            sourceId: item.source_id,
            hasApp: item.has_app,
            lockedAt: item.locked_at ?? undefined,
            upstreamAhead: item.listing_ahead ?? undefined,
            upstreamRevision: item.listing_pinned_commit ?? undefined,
            name: item.name.slice(0, 160),
            description: item.description?.slice(0, 500) ?? undefined,
            visibility: item.visibility ?? undefined,
            updatedAt: item.updated_at ?? undefined,
            revision: item.origin_commit ?? undefined,
            sourceListing: item.listing_name ?? undefined,
            iconUrl:
              item.source_listing_id && item.origin_commit
                ? `https://kody.codes/community/${encodeURIComponent(item.source_listing_id)}/icon/${encodeURIComponent(item.origin_commit)}`
                : undefined,
          }))
        : [],
    },
    jobs: {
      status: readStatus('jobs', !!jobs?.success),
      limited: jobs?.success ? !!jobs.data.limited : false,
      items: jobs?.success
        ? jobs.data.jobs.map((item) => ({
            id: item.id,
            name: item.name.slice(0, 160),
            sourceId: item.source_id,
            publishedCommit: item.published_commit ?? undefined,
            schedule: item.schedule_summary.slice(0, 160),
            enabled: item.enabled,
            killSwitchEnabled: item.kill_switch_enabled,
            expired: item.expired,
            updatedAt: item.updated_at,
            nextRunAt: item.next_run_at ?? undefined,
            lastRunStatus: item.last_run_status ?? undefined,
          }))
        : [],
    },
    workflows: {
      status: readStatus('workflows', !!workflows?.success),
      limited: workflows?.success ? !!workflows.data.limited : false,
      items: workflows?.success
        ? workflows.data.workflows.map((item) => ({
            id: item.id,
            name: item.workflow_name.slice(0, 160),
            status: item.status ?? undefined,
            sourceId: item.source_id ?? undefined,
            updatedAt: item.updated_at ?? undefined,
          }))
        : [],
    },
    runs: {
      status: readStatus('runs', !!runs?.success),
      items: runs?.success
        ? runs.data.runs.map((item) => ({
            id: item.id,
            surface: item.surface,
            status: item.status,
            name: item.name?.slice(0, 160) ?? undefined,
            packageId: item.package_id ?? undefined,
            sourceId: item.source_id ?? undefined,
            publishedCommit: item.published_commit ?? undefined,
            startedAt: item.started_at,
            durationMs: item.duration_ms ?? undefined,
          }))
        : [],
      more: runs?.success ? (runs.data.more ?? !!runs.data.next_cursor) : false,
    },
    integrations: {
      status: readStatus('integrations', !!integrations?.success),
      items: integrations?.success
        ? integrations.data.integrations.map((item) => ({
            name: item.name.slice(0, 120),
            usageMode: item.usageMode,
            ...(item.lastAuthFailure
              ? {
                  authFailure: {
                    title: (
                      item.lastAuthFailure.title ?? 'Reconnect required'
                    ).slice(0, 200),
                    why: item.lastAuthFailure.why?.slice(0, 500),
                    reconnectHref: safeKodyUrl(
                      item.lastAuthFailure.reconnectHref,
                      origin,
                    ),
                  },
                }
              : {}),
          }))
        : [],
    },
    servers: {
      status: readStatus('servers', !!servers?.success),
      items: servers?.success
        ? servers.data.servers.map((item) => ({
            id: item.id,
            name: item.name.slice(0, 120),
            enabled: item.enabled,
            connected: item.connected,
            state: item.state.slice(0, 80),
            toolCount: item.toolCount,
            updatedAt: item.updatedAt,
            error: item.error?.slice(0, 500),
          }))
        : [],
    },
    secrets: {
      status: readStatus('secrets', !!secrets?.success),
      items: secrets?.success
        ? secrets.data.secrets.map((item) => ({
            name: item.name.slice(0, 120),
            scope: item.scope?.slice(0, 80),
            expiresAt: item.expires_at ?? undefined,
          }))
        : [],
    },
    waiting: {
      status: readStatus('waiting', !!waiting?.success),
      items: waiting?.success
        ? waiting.data.items.slice(0, 20).map((item) => ({
            kind: item.kind.slice(0, 80),
            title: item.title.slice(0, 200),
            why: item.why?.slice(0, 500),
            severity: item.severity,
            href: safeKodyUrl(item.href, origin),
          }))
        : [],
    },
    checkedAt: new Date().toISOString(),
  })
}

export async function readKodyAccount(
  env: KodyEnvironment,
  userId: string,
  workspaceId: string,
  signal?: AbortSignal,
  sections: readonly KodyAccountSection[] = defaultAccountSections,
): Promise<KodyAccount> {
  await assertKodyAccess(userId, workspaceId)
  if (!env.KODY_ORIGIN || !(await readCredentials(env, userId))?.kody)
    return unavailable('disconnected')
  try {
    const boundedSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000)
    return projectKodyAccount(
      await kodyCall(
        env,
        userId,
        'execute',
        kodyInternalReadArgs({
          code: KODY_ACCOUNT_CODE,
          params: {
            sources: [...new Set(sections)].map(
              (section) => accountSources[section],
            ),
          },
          responseLimit: 200000,
        }),
        boundedSignal,
      ),
      env.KODY_ORIGIN,
      sections,
    )
  } catch {
    return unavailable('unavailable')
  }
}

export async function searchKodyMemory(
  env: KodyEnvironment,
  userId: string,
  workspaceId: string,
  query: string,
  signal?: AbortSignal,
) {
  await assertKodyAccess(userId, workspaceId)
  if (!env.KODY_ORIGIN || !query.trim()) return []
  const boundedSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(8000)])
    : AbortSignal.timeout(8000)
  return projectKodyMemories(
    await kodyCall(
      env,
      userId,
      'execute',
      kodyInternalReadArgs({
        code: memoryCode,
        params: { query: query.slice(0, 1000) },
        responseLimit: 20000,
      }),
      boundedSignal,
    ),
  )
}

export function projectKodyMemories(raw: unknown) {
  const result = memoryResult.parse(unwrap(raw))
  return result.matches
    .filter((item) => !item.status || item.status === 'active')
    .slice(0, 2)
    .map(({ id, subject, summary }) => ({
      id,
      subject: subject.slice(0, 300),
      summary: summary.slice(0, 1200),
    }))
}
