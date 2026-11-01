import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import type { KodyEnvironment } from './kody'
import { z } from 'zod'
import {
  kodyReferenceDetailSchema,
  type KodyReferenceDetail,
} from '../core/kody-reference-detail'
import {
  referenceInputSchema,
  type MessageReference,
  type ReferenceCatalog,
} from '../core/message-references'
import {
  assertKodyReferenceAccountUnchanged,
  kodyReferenceAccount,
  type KodyReferenceOptions,
  type KodyReferenceScope,
} from './kody-reference-access'
import {
  collectKodyInventory,
  KODY_INVENTORY_CODE,
  readKodyInventory,
} from './discovery-integrations/kody-inventory'
import { hash } from './crypto'
import { kodyCall } from './kody'
import { kodyInternalReadArgs } from './kody-internal-read'
import {
  inspectKodyAccountReference,
  listKodyAccountReferences,
  refreshKodyAccountReferences,
  resolveKodyAccountReference,
} from './kody-account-reference-catalog'

export class KodyReferenceError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
    this.name = 'KodyReferenceError'
  }
}

type Scope = KodyReferenceScope
type Options = KodyReferenceOptions
const itemSchema = z.object({
  entity: z.string().min(1).max(500),
  operation: z.string().min(1).max(200).optional(),
  label: z.string().min(1).max(200),
  detail: z.string().max(200),
  description: z.string().max(2000),
  search: z.string().max(3000),
})
const catalogSchema = z.array(itemSchema)
type Item = z.infer<typeof itemSchema>
export interface KodyCapabilitySuggestion {
  entity: string
  operation?: string
  label: string
  detail: string
}
interface Row {
  account_fingerprint: string
  metadata: string
  fetched_at: number
  complete: number
  data_revision: number
}
const freshFor = 5 * 60_000
const legacyMaxBytes = 1024 * 1024
const stageChunkBytes = 500_000
const storedCatalogSchema = z.object({
  format: z.literal('banks-kody-reference-items-v1'),
  count: z.number().int().nonnegative(),
  digest: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
})

function reference(item: Item): MessageReference {
  return {
    kind: 'kody',
    entity: item.entity,
    ...(item.operation ? { operation: item.operation } : {}),
    label: item.label,
    detail: item.detail,
  }
}

/** The reviewed inventory excludes package secrets and executable code. */
function projectKodyReferencesResult(raw: unknown): {
  items: Item[]
  complete: boolean
} {
  const { inventory, complete } = readKodyInventory(raw)
  const items: Item[] = [
    ...inventory.capabilities.map((capability) => {
      const server =
        capability.source === 'mcp-server' ? capability.mcpServer : undefined
      const label = server
        ? `${server.serverName} · ${server.mcpToolName}`
        : capability.name
      return {
        entity: `capability:${capability.name}`,
        label: label.slice(0, 200),
        detail:
          `${server ? 'Connected tool' : `Action · ${capability.domain}`} · ${capability.description}`.slice(
            0,
            200,
          ),
        description: capability.description.slice(0, 2000),
        search:
          `${capability.name} ${capability.domain} ${label} ${capability.description}`.slice(
            0,
            3000,
          ),
      }
    }),
    ...(inventory.packages ?? []).map((pkg) => ({
      entity: `package:${pkg.packageId}`,
      label: pkg.name.slice(0, 200),
      detail: `Saved package · ${pkg.description}`.slice(0, 200),
      description: pkg.description.slice(0, 2000),
      search: `${pkg.name} ${pkg.description}`.slice(0, 3000),
    })),
    ...(inventory.modules ?? []).map((module) => {
      const name = module.importSpecifier.replace(/^kody:/, '')
      return {
        entity: `package:${module.packageId}#${module.subpath}`,
        label: name.slice(0, 200),
        detail: `Saved module · ${module.description}`.slice(0, 200),
        description: module.description.slice(0, 2000),
        search: `${name} ${module.description}`.slice(0, 3000),
      }
    }),
    ...inventory.exports.map((entry) => {
      if (!entry.packageId || !entry.subpath)
        throw new KodyReferenceError(
          'Kody returned a package without a stable reference.',
          502,
        )
      const name = entry.importSpecifier.replace(/^kody:/, '')
      return {
        entity: `package:${entry.packageId}#${entry.subpath}`,
        operation: entry.exportName,
        label:
          `${name}${entry.exportName === 'default' ? '' : ` · ${entry.exportName}`}`.slice(
            0,
            200,
          ),
        detail: `Saved action · ${entry.description}`.slice(0, 200),
        description: entry.description.slice(0, 2000),
        search: `${name} ${entry.exportName} ${entry.description}`.slice(
          0,
          3000,
        ),
      }
    }),
  ]
  const parsed = catalogSchema.safeParse(items)
  if (
    !parsed.success ||
    !items.every(
      (item) =>
        referenceInputSchema.safeParse({
          kind: 'kody',
          entity: item.entity,
          ...(item.operation ? { operation: item.operation } : {}),
        }).success,
    )
  )
    throw new KodyReferenceError('Kody returned an unsupported inventory.', 502)
  const identities = new Set(
    items.map((item) => JSON.stringify([item.entity, item.operation ?? null])),
  )
  if (identities.size !== items.length)
    throw new KodyReferenceError('Kody returned duplicate references.', 502)
  parsed.data.sort(
    (a, b) =>
      a.entity.localeCompare(b.entity) ||
      (a.operation ?? '').localeCompare(b.operation ?? ''),
  )
  return { items: parsed.data, complete }
}

/** A complete projection is required when callers need an authoritative list. */
export function projectKodyReferences(raw: unknown): Item[] {
  const projected = projectKodyReferencesResult(raw)
  if (!projected.complete)
    throw new KodyReferenceError(
      'Kody returned an incomplete inventory. Try again.',
      502,
    )
  return projected.items
}

async function account(env: KodyEnvironment, scope: Scope, options: Options) {
  try {
    return await kodyReferenceAccount(env, scope, options)
  } catch (error) {
    throw new KodyReferenceError(
      error instanceof Error &&
        error.message === 'Workspace policy is unavailable.'
        ? error.message
        : 'Workspace access is unavailable.',
      403,
    )
  }
}

async function unchanged(
  env: KodyEnvironment,
  scope: Scope,
  options: Options,
  previous: Awaited<ReturnType<typeof account>>,
) {
  try {
    return await assertKodyReferenceAccountUnchanged(
      env,
      scope,
      options,
      previous,
    )
  } catch {
    throw new KodyReferenceError(
      'Kody connection or access changed. Try again.',
      409,
    )
  }
}

async function catalogRow(env: KodyEnvironment, userId: string) {
  const [row] = await db.execute<Row & Record<string, unknown>>(
    sql`SELECT account_fingerprint,metadata,fetched_at::double precision AS fetched_at,complete::integer AS complete,data_revision::double precision AS data_revision FROM chat_kody_reference_catalog WHERE user_id=${userId}::uuid`,
  )
  return row ?? null
}

async function readSnapshot(
  env: KodyEnvironment,
  userId: string,
  fingerprint: string,
  row: Row | null,
) {
  if (
    !row ||
    row.fetched_at <= 0 ||
    row.account_fingerprint !== fingerprint ||
    new TextEncoder().encode(row.metadata).byteLength > legacyMaxBytes
  )
    return undefined
  try {
    let items: Item[]
    if (row.data_revision === 0) {
      const parsed = catalogSchema.safeParse(JSON.parse(row.metadata))
      if (!parsed.success) return undefined
      items = parsed.data
    } else {
      const manifest = storedCatalogSchema.parse(JSON.parse(row.metadata))
      items = []
      while (items.length < manifest.count) {
        const rows = await db.execute<{ ordinal: number; payload: string }>(
          sql`SELECT ordinal::double precision AS ordinal,payload::text AS payload FROM chat_kody_reference_items WHERE user_id=${userId}::uuid AND revision=${row.data_revision} AND ordinal>=${items.length} ORDER BY ordinal LIMIT 200`,
        )
        const page = { results: rows }
        if (
          !page.results.length ||
          items.length + page.results.length > manifest.count
        )
          return undefined
        for (const stored of page.results) {
          if (stored.ordinal !== items.length) return undefined
          items.push(itemSchema.parse(JSON.parse(stored.payload)))
        }
      }
    }
    return {
      items,
      fetchedAt: row.fetched_at,
      complete: !!row.complete,
    }
  } catch {
    return undefined
  }
}

async function snapshot(
  env: KodyEnvironment,
  userId: string,
  fingerprint: string,
) {
  const first = await catalogRow(env, userId)
  const saved = await readSnapshot(env, userId, fingerprint, first)
  if (saved || !first?.data_revision) return saved
  // A published revision can change between reading its header and rows.
  const latest = await catalogRow(env, userId)
  if (
    latest?.data_revision === first.data_revision &&
    latest.fetched_at === first.fetched_at
  )
    return undefined
  return readSnapshot(env, userId, fingerprint, latest)
}

const commonWords = new Set(
  'a an and are as at be by can could do does find for from get give have how i in is it me my of on or our please show that the this to use using want what where which who with would you your'.split(
    ' ',
  ),
)

function terms(value: string) {
  return new Set(
    value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter((word) => word.length > 2 && !commonWords.has(word)) ?? [],
  )
}

/** Bounded, account-scoped discovery hints. These are candidates, not verified calls. */
export function rankKodyReferenceHints(
  items: readonly Item[],
  request: string,
  limit = 5,
): KodyCapabilitySuggestion[] {
  const query = [...terms(request)]
  if (!query.length) return []
  const documents = items.map((item) => ({
    item,
    label: terms(item.label),
    description: terms(item.description),
  }))
  const frequency = new Map(
    query.map((word) => [
      word,
      documents.filter(
        (document) =>
          document.label.has(word) || document.description.has(word),
      ).length,
    ]),
  )
  return documents
    .map((document) => ({
      item: document.item,
      score: query.reduce((total, word) => {
        const count = frequency.get(word) ?? 0
        if (!count) return total
        const weight = Math.log(1 + (items.length + 1) / count)
        return (
          total +
          weight *
            (document.label.has(word)
              ? 3
              : document.description.has(word)
                ? 1
                : 0)
        )
      }, 0),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.item.entity.localeCompare(b.item.entity) ||
        (a.item.operation ?? '').localeCompare(b.item.operation ?? ''),
    )
    .slice(0, limit)
    .map(({ item }) => ({
      entity: item.entity,
      ...(item.operation ? { operation: item.operation } : {}),
      label: item.label,
      detail: item.detail,
    }))
}

export async function suggestKodyReferences(
  env: KodyEnvironment,
  scope: Scope,
  options: Options,
  request: string,
): Promise<KodyCapabilitySuggestion[]> {
  const current = await account(env, scope, options)
  if (!current.enabled) return []
  const saved = await snapshot(env, scope.userId, current.fingerprint)
  await unchanged(env, scope, options, current)
  return saved ? rankKodyReferenceHints(saved.items, request) : []
}

async function listKodyActionReferences(
  env: KodyEnvironment,
  scope: Scope,
  options: Options & { query: string },
): Promise<ReferenceCatalog> {
  const query = z.string().trim().max(200).safeParse(options.query)
  if (!query.success)
    throw new KodyReferenceError('Use a search up to 200 characters.')
  const current = await account(env, scope, options)
  if (!current.enabled)
    return { items: [], more: false, kodyStatus: current.reason }
  const saved = await snapshot(env, scope.userId, current.fingerprint)
  await unchanged(env, scope, options, current)
  if (!saved) return { items: [], more: false, kodyStatus: 'missing' }
  const words = query.data.toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const found = saved.items.filter((item) =>
    words.every((word) => item.search.toLocaleLowerCase().includes(word)),
  )
  found.sort(
    (a, b) =>
      a.label.localeCompare(b.label) || a.entity.localeCompare(b.entity),
  )
  return {
    items: found.slice(0, 50).map(reference),
    more: found.length > 50,
    kodyStatus: !saved.complete
      ? 'partial'
      : Date.now() - saved.fetchedAt < freshFor
        ? 'ready'
        : 'stale',
  }
}

export async function listKodyReferences(
  env: KodyEnvironment,
  scope: Scope,
  options: Options & { query: string },
): Promise<ReferenceCatalog> {
  const actions = await listKodyActionReferences(env, scope, options)
  if (actions.kodyStatus === 'blocked' || actions.kodyStatus === 'disconnected')
    return actions
  try {
    const objects = await listKodyAccountReferences(env, scope, options)
    return {
      items: [...actions.items, ...objects.items],
      more: actions.more || objects.more,
      kodyStatus: actions.kodyStatus,
      kodyObjectsStatus: objects.status,
    }
  } catch {
    return { ...actions, kodyObjectsStatus: 'missing' }
  }
}

/** Keep the account catalog warm whenever an active client asks for it. */
export async function currentKodyReferences(
  env: KodyEnvironment,
  scope: Scope,
  options: Options & { query: string },
  signal: AbortSignal,
  fetchInventory: typeof kodyCall = kodyCall,
): Promise<ReferenceCatalog> {
  const actions = await listKodyActionReferences(env, scope, options)
  if (actions.kodyStatus === 'blocked' || actions.kodyStatus === 'disconnected')
    return actions
  const objects = await listKodyAccountReferences(env, scope, options).catch(
    () => undefined,
  )
  const refreshes: Promise<unknown>[] = []
  const currentAccount =
    actions.kodyStatus === 'partial'
      ? await account(env, scope, options)
      : undefined
  const partialSnapshot = currentAccount?.enabled
    ? await snapshot(env, scope.userId, currentAccount.fingerprint)
    : undefined
  if (
    actions.kodyStatus === 'missing' ||
    actions.kodyStatus === 'stale' ||
    (partialSnapshot && Date.now() - partialSnapshot.fetchedAt >= freshFor)
  )
    refreshes.push(
      refreshKodyReferences(env, scope, options, signal, fetchInventory),
    )
  if (!objects || objects.status === 'missing' || objects.status === 'stale')
    refreshes.push(refreshKodyAccountReferences(env, scope, options, signal))
  if (refreshes.length) {
    const results = await Promise.allSettled(refreshes)
    if (actions.kodyStatus === 'missing' && results[0]?.status === 'rejected')
      throw results[0].reason
  }
  return listKodyReferences(env, scope, options)
}

async function resolveKodyReferenceMatching(
  env: KodyEnvironment,
  scope: Scope,
  input: { entity: string; operation?: string },
  options: Options,
  allowEntityOnlyInspection: boolean,
  fetchInventory: typeof kodyCall = kodyCall,
): Promise<MessageReference> {
  if (/^(integration|mcp-server|job|workflow-run|run):/.test(input.entity)) {
    try {
      return await resolveKodyAccountReference(env, scope, input, options)
    } catch (error) {
      throw new KodyReferenceError(
        error instanceof Error ? error.message : 'Kody object is unavailable.',
        409,
      )
    }
  }
  const parsed = referenceInputSchema.safeParse({ kind: 'kody', ...input })
  if (!parsed.success || parsed.data.kind !== 'kody')
    throw new KodyReferenceError('Choose a Kody reference from the catalog.')
  const current = await account(env, scope, options)
  if (!current.enabled)
    throw new KodyReferenceError(
      current.reason === 'blocked'
        ? 'Kody is disabled by workspace policy.'
        : 'Connect Kody to use this reference.',
      409,
    )
  let saved = await snapshot(env, scope.userId, current.fingerprint)
  if (!saved) {
    const [row] = await db.execute<{ account_fingerprint: string }>(
      sql`SELECT account_fingerprint FROM chat_kody_reference_catalog WHERE user_id=${scope.userId}::uuid`,
    )
    if (row && row.account_fingerprint !== current.fingerprint)
      throw new KodyReferenceError(
        'Kody connection or access changed. Try again.',
        409,
      )
    // An approved Kody action invalidates the account catalog before the
    // assistant continues. Restore the current inventory before checking a
    // reference that was already selected for this task.
    for (let attempt = 0; attempt < 2 && !saved; attempt++) {
      try {
        await refreshKodyReferences(
          env,
          scope,
          options,
          AbortSignal.timeout(90_000),
          fetchInventory,
        )
      } catch (error) {
        saved = await snapshot(env, scope.userId, current.fingerprint)
        if (saved) break
        if (
          attempt > 0 ||
          !(error instanceof KodyReferenceError) ||
          error.status !== 409 ||
          !error.message.includes('newer refresh finished')
        )
          throw error
      }
      saved = await snapshot(env, scope.userId, current.fingerprint)
    }
  }
  const found = saved?.items.find(
    (item) =>
      item.entity === input.entity &&
      (item.operation === input.operation ||
        (allowEntityOnlyInspection && input.operation === undefined)),
  )
  if (!found)
    throw new KodyReferenceError(
      'This Kody reference changed. Refresh Kody and select it again.',
      409,
    )
  await unchanged(env, scope, options, current)
  return reference(found)
}

/** Message references retain the exact operation selected from the catalog. */
export async function resolveKodyReference(
  env: KodyEnvironment,
  scope: Scope,
  input: { entity: string; operation?: string },
  options: Options,
  fetchInventory: typeof kodyCall = kodyCall,
): Promise<MessageReference> {
  return resolveKodyReferenceMatching(
    env,
    scope,
    input,
    options,
    false,
    fetchInventory,
  )
}

const inspectedEntitySchema = z.object({
  isError: z.boolean().optional(),
  structuredContent: z.object({
    result: z.discriminatedUnion('type', [
      z.object({
        kind: z.literal('entity'),
        type: z.literal('capability'),
        id: z.string(),
        title: z.string(),
        description: z.string(),
        readOnly: z.boolean().optional(),
        destructive: z.boolean().optional(),
        inputTypeDefinition: z.string().nullish(),
        outputTypeDefinition: z.string().nullish(),
      }),
      z.object({
        kind: z.literal('entity'),
        type: z.literal('package'),
        detailMode: z.enum(['index', 'export', 'file']),
        entityRef: z.string().optional(),
        packageId: z.string(),
        title: z.string(),
        description: z.string(),
        readmeIntent: z
          .object({ path: z.string(), content: z.string().optional() })
          .nullish(),
        agentsDocs: z.object({ path: z.string() }).nullish(),
        importSpecifier: z.string().nullish(),
        typeDefinition: z.string().nullish(),
        exports: z
          .array(
            z.object({
              subpath: z.string(),
              description: z.string().nullish(),
            }),
          )
          .optional(),
        functions: z
          .array(
            z.object({
              name: z.string(),
              description: z.string().nullish(),
              typeDefinition: z.string().nullish(),
            }),
          )
          .optional(),
      }),
    ]),
  }),
})

/** Read fresh Kody metadata for an exact item in this account's catalog. */
export async function inspectKodyReference(
  env: KodyEnvironment,
  scope: Scope,
  input: { entity: string; operation?: string },
  options: Options,
  signal: AbortSignal,
  search: typeof kodyCall = kodyCall,
): Promise<KodyReferenceDetail> {
  if (/^(integration|mcp-server|job|workflow-run|run):/.test(input.entity)) {
    try {
      return kodyReferenceDetailSchema.parse(
        await inspectKodyAccountReference(env, scope, input, options, signal),
      )
    } catch (error) {
      throw new KodyReferenceError(
        error instanceof Error
          ? error.message
          : 'Kody object could not be read.',
        409,
      )
    }
  }
  // A package detail page can inspect an export path without choosing one of
  // its callable functions. Execution still requires an exact operation.
  const allowEntityOnlyInspection =
    input.operation === undefined && /^package:[^#]+#/.test(input.entity)
  await resolveKodyReferenceMatching(
    env,
    scope,
    input,
    options,
    allowEntityOnlyInspection,
  )
  if (signal.aborted)
    throw new KodyReferenceError('Kody inspection was stopped.', 409)
  let raw: unknown
  try {
    raw = await search(
      env,
      scope.userId,
      'search',
      { entity: input.entity, maxResponseSize: 12000 },
      signal,
    )
  } catch {
    throw new KodyReferenceError(
      signal.aborted
        ? 'Kody inspection was stopped.'
        : 'Kody detail could not be loaded.',
      signal.aborted ? 409 : 502,
    )
  }
  const parsed = inspectedEntitySchema.safeParse(raw)
  if (!parsed.success || parsed.data.isError)
    throw new KodyReferenceError('Kody detail could not be read.', 502)
  const entity = parsed.data.structuredContent.result
  let detail: unknown
  if (entity.type === 'capability') {
    if (input.entity !== `capability:${entity.id}`)
      throw new KodyReferenceError('Kody capability identity changed.', 409)
    detail = {
      kind: 'capability',
      title: entity.title,
      description: entity.description,
      readOnly: entity.readOnly,
      destructive: entity.destructive,
      inputTypeDefinition: entity.inputTypeDefinition ?? undefined,
      outputTypeDefinition: entity.outputTypeDefinition ?? undefined,
    }
  } else {
    const match = /^package:([^#]+)(?:#(.+))?$/.exec(input.entity)
    if (!match || entity.packageId !== match[1])
      throw new KodyReferenceError('Kody package identity changed.', 409)
    const expectedMode = match[2] ? 'export' : 'index'
    if (entity.detailMode !== expectedMode)
      throw new KodyReferenceError('Kody package surface changed.', 409)
    if (expectedMode === 'export') {
      const returnedSubpath = /^package:[^#]+#(.+)$/.exec(
        entity.entityRef ?? '',
      )?.[1]
      const normalize = (subpath: string) => subpath.replace(/^\.\//, '')
      if (
        !returnedSubpath ||
        normalize(returnedSubpath) !== normalize(match[2])
      )
        throw new KodyReferenceError('Kody package export changed.', 409)
    }
    const operation = input.operation
      ? entity.functions?.find((fn) => fn.name === input.operation)
      : undefined
    if (input.operation && !operation)
      throw new KodyReferenceError('Kody package function changed.', 409)
    detail = {
      kind: 'package',
      title: entity.title,
      description: operation?.description ?? entity.description,
      detailMode: entity.detailMode,
      intent: entity.readmeIntent?.content,
      ...(entity.detailMode === 'index'
        ? {
            documents: {
              readme: !!entity.readmeIntent?.path,
              agents: !!entity.agentsDocs?.path,
            },
          }
        : {}),
      importSpecifier: entity.importSpecifier ?? undefined,
      typeDefinition:
        operation?.typeDefinition ?? entity.typeDefinition ?? undefined,
      exports: entity.exports?.map((item) => ({
        subpath: item.subpath,
        description: item.description ?? '',
      })),
    }
  }
  const projected = kodyReferenceDetailSchema.safeParse(detail)
  if (!projected.success)
    throw new KodyReferenceError('Kody detail is too large to display.', 502)
  await resolveKodyReferenceMatching(
    env,
    scope,
    input,
    options,
    allowEntityOnlyInspection,
  )
  return projected.data
}

export async function refreshKodyReferences(
  env: KodyEnvironment,
  scope: Scope,
  options: Options,
  signal: AbortSignal,
  fetchInventory: typeof kodyCall = kodyCall,
) {
  const startedAt = Date.now()
  const before = await account(env, scope, options)
  if (!before.enabled)
    throw new KodyReferenceError(
      before.reason === 'blocked'
        ? 'Kody is disabled by workspace policy.'
        : 'Connect Kody to load its capabilities.',
      409,
    )
  if (signal.aborted)
    throw new KodyReferenceError('Kody refresh was stopped.', 409)
  const [reservation] = await db.execute<{ revision: number }>(
    sql`INSERT INTO chat_kody_reference_catalog(user_id,account_fingerprint,metadata,fetched_at,refresh_started_at,revision) VALUES(${scope.userId}::uuid,${before.fingerprint},'[]',0,${startedAt},1) ON CONFLICT(user_id) DO UPDATE SET revision=chat_kody_reference_catalog.revision+1,refresh_started_at=excluded.refresh_started_at RETURNING revision::double precision AS revision`,
  )
  if (!reservation)
    throw new KodyReferenceError('Kody refresh could not start.', 502)
  let raw: unknown
  try {
    raw = await collectKodyInventory(
      (page, cursor) =>
        fetchInventory(
          env,
          scope.userId,
          'execute',
          kodyInternalReadArgs({
            code: KODY_INVENTORY_CODE,
            ...(page ? { params: { page, cursor } } : {}),
            responseLimit: 1000000,
          }),
          signal,
        ),
      signal,
    )
  } catch {
    throw new KodyReferenceError(
      signal.aborted
        ? 'Kody refresh was stopped.'
        : 'Kody inventory could not be loaded.',
      signal.aborted ? 409 : 502,
    )
  }
  if (signal.aborted)
    throw new KodyReferenceError('Kody refresh was stopped.', 409)
  const { items, complete } = projectKodyReferencesResult(raw)
  const digest = await hash(JSON.stringify(items))
  const previous = await catalogRow(env, scope.userId)
  const stored =
    previous?.data_revision && previous.fetched_at > 0
      ? storedCatalogSchema.safeParse(JSON.parse(previous.metadata))
      : undefined
  if (
    previous?.account_fingerprint === before.fingerprint &&
    stored?.success &&
    stored.data.count === items.length &&
    stored.data.digest === digest &&
    (await readSnapshot(env, scope.userId, before.fingerprint, previous))
  ) {
    const bound = await unchanged(env, scope, options, before)
    const current = await db.execute(
      sql`UPDATE chat_kody_reference_catalog SET account_fingerprint=${bound.fingerprint},fetched_at=${Date.now()},complete=${complete} WHERE user_id=${scope.userId}::uuid AND revision=${reservation.revision} AND data_revision=${previous.data_revision} AND EXISTS(SELECT 1 FROM chat_memberships m JOIN chat_workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=${scope.workspaceId} AND m.user_id=${scope.userId}::uuid AND w.policy=${bound.policyText}::jsonb) AND (SELECT subject FROM chat_kody_links WHERE user_id=${scope.userId}::uuid) IS NOT DISTINCT FROM ${bound.subject}::text RETURNING user_id`,
    )
    if (!current.length)
      throw new KodyReferenceError(
        'Kody connection changed or a newer refresh finished. Try again.',
        409,
      )
    return listKodyReferences(env, scope, { ...options, query: '' })
  }
  let published = false
  try {
    let chunk: Array<{ ordinal: number; item: Item }> = []
    let chunkBytes = 2
    const writeChunk = async () => {
      if (!chunk.length) return
      await db.execute(
        sql`INSERT INTO chat_kody_reference_items(user_id,revision,ordinal,payload) SELECT ${scope.userId}::uuid,${reservation.revision},(value->>'ordinal')::bigint,value->'item' FROM jsonb_array_elements(${JSON.stringify(chunk)}::jsonb) WHERE EXISTS(SELECT 1 FROM chat_kody_reference_catalog WHERE user_id=${scope.userId}::uuid AND revision=${reservation.revision})`,
      )
      chunk = []
      chunkBytes = 2
    }
    for (const [ordinal, item] of items.entries()) {
      const entry = { ordinal, item }
      const size = new TextEncoder().encode(JSON.stringify(entry)).byteLength
      if (chunk.length && chunkBytes + size + 1 > stageChunkBytes)
        await writeChunk()
      chunk.push(entry)
      chunkBytes += size + 1
      if (chunkBytes >= stageChunkBytes) await writeChunk()
    }
    await writeChunk()
    const [staged] = await db.execute<{ count: number }>(
      sql`SELECT count(*)::integer AS count FROM chat_kody_reference_items WHERE user_id=${scope.userId}::uuid AND revision=${reservation.revision}`,
    )
    if (staged?.count !== items.length)
      throw new KodyReferenceError(
        'Kody changed during refresh. Try again.',
        409,
      )
    const bound = await unchanged(env, scope, options, before)
    await db.transaction(async (tx) => {
      const result = await tx.execute(
        sql`UPDATE chat_kody_reference_catalog SET account_fingerprint=${bound.fingerprint},metadata=${JSON.stringify({ format: 'banks-kody-reference-items-v1', count: items.length, digest })},fetched_at=${Date.now()},complete=${complete},data_revision=${reservation.revision} WHERE user_id=${scope.userId}::uuid AND revision=${reservation.revision} AND EXISTS(SELECT 1 FROM chat_memberships m JOIN chat_workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=${scope.workspaceId} AND m.user_id=${scope.userId}::uuid AND w.policy=${bound.policyText}::jsonb) AND (SELECT subject FROM chat_kody_links WHERE user_id=${scope.userId}::uuid) IS NOT DISTINCT FROM ${bound.subject}::text RETURNING user_id`,
      )
      if (!result.length)
        throw new KodyReferenceError(
          'Kody connection changed or a newer refresh finished. Try again.',
          409,
        )
      await tx.execute(
        sql`DELETE FROM chat_kody_reference_items WHERE user_id=${scope.userId}::uuid AND revision<>${reservation.revision} AND EXISTS(SELECT 1 FROM chat_kody_reference_catalog WHERE user_id=${scope.userId}::uuid AND data_revision=${reservation.revision})`,
      )
    })
    published = true
  } finally {
    if (!published)
      await db.execute(
        sql`DELETE FROM chat_kody_reference_items WHERE user_id=${scope.userId}::uuid AND revision=${reservation.revision}`,
      )
  }
  return listKodyReferences(env, scope, { ...options, query: '' })
}
