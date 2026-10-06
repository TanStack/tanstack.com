import { z } from 'zod'
import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import type { KodyEnvironment } from './kody'
import { policySchema, type Policy } from '../core/types'
import { readCredentials } from './credentials'
import { hash } from './crypto'
import { kodyCall } from './kody'
import { kodyInternalReadArgs } from './kody-internal-read'
import { KODY_INVENTORY_CODE } from './discovery-integrations/kody-inventory'
import { currentKodyReferences } from './kody-reference-catalog'
import { KodySkillCatalog } from './kody-skill-catalog'

const probeInterval = 60_000
export const KODY_ACCOUNT_PROBE_CODE = `import { kody } from 'kody:runtime'
export default async function main() {
  const [packages, capabilities, servers] = await Promise.all([
    kody.packageList({}), kody.metaListCapabilities({}), kody.mcpServerList({})
  ])
  if (!Array.isArray(packages.packages) ||
      !Array.isArray(capabilities.domains) ||
      !Array.isArray(servers.servers))
    throw new Error('Unsupported Kody account index')
  const index = {
    packages: packages.packages.map(item => ({
      id: item.package_id, name: item.name ?? null,
      hidden: item.hidden ?? false, visibility: item.visibility ?? null,
      updatedAt: item.updated_at ?? null,
      commit: item.origin_commit ?? null, listingCommit: item.listing_pinned_commit ?? null
    })).sort((a, b) => a.id.localeCompare(b.id)),
    domains: capabilities.domains.map(item => ({
      id: item.id, count: item.capabilityCount
    })).sort((a, b) => a.id.localeCompare(b.id)),
    servers: servers.servers.map(item => ({
      id: item.id, name: item.name, enabled: item.enabled, connected: item.connected,
      state: item.state, tools: Array.isArray(item.tools)
        ? item.tools.filter(name => typeof name === 'string').sort() : [],
      toolCount: item.toolCount, updatedAt: item.updatedAt ?? null,
      usageMode: item.usageMode,
      allowedPackageIds: Array.isArray(item.allowedPackageIds)
        ? item.allowedPackageIds.filter(id => typeof id === 'string').sort() : []
    })).sort((a, b) => a.id.localeCompare(b.id))
  }
  const bytes = new TextEncoder().encode(JSON.stringify(index))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return {
    format: 'banks-kody-account-index-v2',
    fingerprint: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''),
    counts: {
      packages: index.packages.length,
      domains: index.domains.length,
      servers: index.servers.length
    }
  }
}`
const probeResult = z.object({
  format: z.literal('banks-kody-account-index-v2'),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  counts: z.object({
    packages: z.number().int().nonnegative(),
    domains: z.number().int().nonnegative(),
    servers: z.number().int().nonnegative(),
  }),
})

async function probeAccount(
  env: KodyEnvironment,
  scope: { workspaceId: string; userId: string },
  options: { policy: Policy; fixture: boolean },
) {
  if (options.fixture || !options.policy.allowKody || !env.KODY_ORIGIN)
    return undefined
  const [row] = await db.execute<
    { policy: string; subject: string | null } & Record<string, unknown>
  >(
    sql`SELECT w.policy::text AS policy,(SELECT subject FROM chat_kody_links WHERE user_id=${scope.userId}) AS subject FROM chat_workspaces w JOIN chat_memberships m ON m.workspace_id=w.id WHERE w.id=${scope.workspaceId} AND m.user_id=${scope.userId}`,
  )
  if (!row) return undefined
  let policy: Policy
  try {
    policy = policySchema.parse(JSON.parse(row.policy))
  } catch {
    return undefined
  }
  if (!policy.allowKody) return undefined
  const credentials = await readCredentials(env, scope.userId)
  if (!credentials?.kody) return undefined
  return {
    policyText: row.policy,
    subject: row.subject,
    fingerprint: await hash(
      JSON.stringify([
        'kody-account-probe-v1',
        env.KODY_ORIGIN,
        row.subject,
        credentials.kody.client_id,
        ...(row.subject ? [] : [credentials.kody.access_token]),
      ]),
    ),
  }
}

/** Recheck the complete Kody account index, returning only its digest. */
export async function probeKodyAccount(
  env: KodyEnvironment,
  scope: { workspaceId: string; userId: string },
  options: { policy: Policy; fixture: boolean },
  signal: AbortSignal,
  call: typeof kodyCall = kodyCall,
): Promise<boolean> {
  const before = await probeAccount(env, scope, options)
  if (!before || signal.aborted) return false
  const [claimed] = await db.execute<
    { revision: number; source_fingerprint: string } & Record<string, unknown>
  >(
    sql`INSERT INTO chat_kody_account_probe(user_id,account_fingerprint,checked_at,revision) VALUES(${scope.userId},${before.fingerprint},${Date.now()},1) ON CONFLICT(user_id) DO UPDATE SET source_fingerprint=CASE WHEN chat_kody_account_probe.account_fingerprint<>excluded.account_fingerprint THEN '' ELSE chat_kody_account_probe.source_fingerprint END,account_fingerprint=excluded.account_fingerprint,checked_at=excluded.checked_at,revision=chat_kody_account_probe.revision+1 WHERE chat_kody_account_probe.account_fingerprint<>excluded.account_fingerprint OR chat_kody_account_probe.checked_at<=excluded.checked_at-${probeInterval} RETURNING revision::float8 AS revision,source_fingerprint`,
  )
  if (!claimed) return false
  try {
    const raw = await call(
      env,
      scope.userId,
      'execute',
      kodyInternalReadArgs({
        code: KODY_ACCOUNT_PROBE_CODE,
        responseLimit: 1000,
      }),
      signal,
    )
    const envelope = z
      .object({
        isError: z.boolean().optional(),
        structuredContent: z.object({ result: z.unknown() }),
      })
      .parse(raw)
    if (envelope.isError) throw new Error('Kody account index failed.')
    const index = probeResult.parse(envelope.structuredContent.result)
    const after = await probeAccount(env, scope, options)
    if (
      !after ||
      after.fingerprint !== before.fingerprint ||
      after.policyText !== before.policyText ||
      after.subject !== before.subject ||
      signal.aborted
    )
      throw new Error('Kody account changed during sync.')
    const fingerprint = `${index.format}:${index.fingerprint}`
    const changed = fingerprint !== claimed.source_fingerprint
    return db.transaction(async (tx) => {
      const published = await tx.execute(
        sql`UPDATE chat_kody_account_probe SET source_fingerprint=${fingerprint} WHERE user_id=${scope.userId} AND account_fingerprint=${before.fingerprint} AND revision=${claimed.revision} AND EXISTS(SELECT 1 FROM chat_memberships m JOIN chat_workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=${scope.workspaceId} AND m.user_id=${scope.userId} AND w.policy=${before.policyText}::jsonb) AND (SELECT subject FROM chat_kody_links WHERE user_id=${scope.userId}) IS NOT DISTINCT FROM ${before.subject}::text RETURNING user_id`,
      )
      if (!published.length) return false
      if (changed) {
        await tx.execute(
          sql`UPDATE chat_kody_reference_catalog SET fetched_at=0,revision=revision+1 WHERE user_id=${scope.userId}`,
        )
        await tx.execute(
          sql`UPDATE chat_kody_account_reference_catalog SET fetched_at=0,revision=revision+1 WHERE user_id=${scope.userId}`,
        )
        await tx.execute(
          sql`UPDATE chat_kody_skill_sync SET fetched_at=0,lease_until=0,revision=revision+1 WHERE user_id=${scope.userId}`,
        )
      }
      return changed
    })
  } catch (error) {
    await db.execute(
      sql`UPDATE chat_kody_account_probe SET checked_at=0 WHERE user_id=${scope.userId} AND revision=${claimed.revision}`,
    )
    throw error
  }
}

/** An executed Kody action may have changed account-owned tools or skills. */
export async function invalidateKodyCatalogs(
  env: KodyEnvironment,
  userId: string,
) {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`UPDATE chat_kody_reference_catalog SET fetched_at=0,revision=revision+1 WHERE user_id=${userId}`,
    )
    await tx.execute(
      sql`UPDATE chat_kody_account_reference_catalog SET fetched_at=0,revision=revision+1 WHERE user_id=${userId}`,
    )
    await tx.execute(
      sql`UPDATE chat_kody_skill_sync SET fetched_at=0,lease_until=0,revision=revision+1 WHERE user_id=${userId}`,
    )
    await tx.execute(
      sql`UPDATE chat_kody_account_probe SET checked_at=0,revision=revision+1 WHERE user_id=${userId}`,
    )
  })
}

/** Best-effort account sync after sign-in and while the app is active. */
export async function syncKodyAccount(
  env: KodyEnvironment,
  scope: { workspaceId: string; userId: string },
  options: { policy: Policy; fixture: boolean; skipProbe?: boolean },
  call: typeof kodyCall = kodyCall,
) {
  if (options.fixture || !options.policy.allowKody) return false
  let changed = false
  if (!options.skipProbe) {
    try {
      changed = await probeKodyAccount(
        env,
        scope,
        options,
        AbortSignal.timeout(30000),
        call,
      )
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: 'kody_account_probe_failed',
          type: error instanceof Error ? error.name : 'unknown',
        }),
      )
    }
  }
  const signal = AbortSignal.timeout(90000)
  const inventory = new Map<string, ReturnType<typeof kodyCall>>()
  const sharedCall: typeof kodyCall = (...args) => {
    if (args[2] !== 'execute' || args[3].code !== KODY_INVENTORY_CODE)
      return call(...args)
    const page = JSON.stringify(args[3].params ?? {})
    let pending = inventory.get(page)
    if (!pending) {
      pending = call(...args)
      inventory.set(page, pending)
    }
    return pending
  }
  const results = await Promise.allSettled([
    currentKodyReferences(
      env,
      scope,
      { ...options, query: '' },
      signal,
      sharedCall,
    ),
    new KodySkillCatalog(env, scope, sharedCall).list(''),
  ])
  for (const [index, result] of results.entries())
    if (result.status === 'rejected')
      console.warn(
        JSON.stringify({
          event: 'kody_account_sync_failed',
          source: index === 0 ? 'references' : 'skills',
          type: result.reason instanceof Error ? result.reason.name : 'unknown',
        }),
      )
  return changed
}
