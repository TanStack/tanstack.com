import { z } from 'zod'
import type { CatalogEntry } from '../mcp-catalog'
import type { InventoryContext, InventoryResult } from './contract'
import { kodyInternalReadArgs } from '../kody-internal-read'

/** Reviewed metadata-only program. Never constructed from a user/model response. */
export const KODY_INVENTORY_CODE = `import { kody } from 'kody:runtime'
export default async function main(params) {
  const issues = []
  const [registry, saved] = await Promise.all([kody.metaListCapabilities({}), kody.packageList({})])
  if (!Array.isArray(registry.domains) || !Array.isArray(saved.packages)) throw new Error('Unsupported inventory index')
  const pageIndex = params?.page ?? 0
  const cursor = params?.cursor ?? { phase: 'domains', index: 0, item: 0 }
  if (!Number.isSafeInteger(pageIndex) || pageIndex < 0 || !['domains', 'packages'].includes(cursor.phase) || !Number.isSafeInteger(cursor.index) || cursor.index < 0 || !Number.isSafeInteger(cursor.item) || cursor.item < 0 || (cursor.fragmentOffset !== undefined && (!Number.isSafeInteger(cursor.fragmentOffset) || cursor.fragmentOffset <= 0 || !cursor.detail))) throw new Error('Unsupported inventory cursor')
  if (pageIndex === 0 && (cursor.phase !== 'domains' || cursor.index !== 0 || cursor.item !== 0)) throw new Error('Unsupported first inventory cursor')
  if (cursor.index > (cursor.phase === 'domains' ? registry.domains.length : saved.packages.length)) throw new Error('Unsupported inventory cursor')
  async function hash(value) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  }
  const fingerprint = await hash([registry.domains, saved.packages])
  const capabilities = []
  const packages = []
  const exports = []
  const modules = []
  const counts = { domains: registry.domains.length, packages: saved.packages.length, advertisedCapabilities: registry.domains.reduce((sum, domain) => sum + domain.capabilityCount, 0) }
  const baseSize = JSON.stringify({ format: 'gum-kody-inventory-v6', counts, fingerprint }).length + 2048
  let size = baseSize
  let next = { ...cursor }
  let sources = 0
  let fragment = null
  function append(target, item, kind) {
    const serialized = JSON.stringify(item)
    if (typeof serialized !== 'string') throw new Error('Unsupported inventory item')
    const offset = next.fragmentOffset ?? 0
    if (offset || (size === baseSize && size + serialized.length + 32 > 600000)) {
      if (size !== baseSize || offset >= serialized.length) throw new Error('Unsupported inventory fragment')
      const data = serialized.slice(offset, offset + 200000)
      fragment = { kind, offset, total: serialized.length, data }
      return 'fragment'
    }
    const cost = serialized.length + 32
    if (size + cost > 600000) return 'full'
    target.push(item)
    size += cost
    return 'added'
  }
  while (sources < 32) {
    if (next.phase === 'domains' && next.index >= registry.domains.length) next = { phase: 'packages', index: 0, item: 0 }
    if (next.phase === 'packages' && next.index >= saved.packages.length) break
    if (next.phase === 'domains') {
      const domain = registry.domains[next.index]
      let result
      try { result = await kody.metaListCapabilities({ domain: domain.id }); if (!Array.isArray(result.capabilities)) throw new Error('Unsupported domain') }
      catch { issues.push('A metadata collection failed'); next = { phase: 'domains', index: next.index + 1, item: 0 }; sources++; continue }
      if (result.capabilities.length !== domain.capabilityCount) issues.push('Domain count mismatch')
      if (next.item > result.capabilities.length) throw new Error('Kody domain changed during inventory read')
      if (next.detail && next.detail !== await hash(result.capabilities)) throw new Error('Kody domain changed during inventory read')
      let stopped = false
      for (let item = next.item; item < result.capabilities.length; item++) {
        const c = result.capabilities[item]
        const projected = { identity: c.name, name: c.name, description: c.description, domain: c.domain, source: c.source, ...(c.mcpServer ? { mcpServer: { serverId: c.mcpServer.serverId, serverName: c.mcpServer.serverName, kodyName: c.mcpServer.kodyName, mcpToolName: c.mcpServer.mcpToolName, toolName: c.mcpServer.toolName } } : {}) }
        const status = append(capabilities, projected, 'capability')
        if (status !== 'added') {
          const fragmentOffset = status === 'fragment' ? fragment.offset + fragment.data.length : 0
          next = { phase: 'domains', index: next.index, item: status === 'fragment' && fragmentOffset === fragment.total ? item + 1 : item, ...(fragmentOffset && fragmentOffset < fragment.total ? { fragmentOffset } : {}), ...(item || status === 'fragment' ? { detail: await hash(result.capabilities) } : {}) }
          stopped = true
          break
        }
      }
      if (stopped) break
      next = { phase: 'domains', index: next.index + 1, item: 0 }
    } else {
      const pkg = saved.packages[next.index]
      let result
      try { result = await kody.packageGet({ package_id: pkg.package_id }); if (!Array.isArray(result.exports)) throw new Error('Unsupported package') }
      catch { issues.push('A metadata collection failed'); next = { phase: 'packages', index: next.index + 1, item: 0 }; sources++; continue }
      const items = [{ kind: 'package', value: { packageId: pkg.package_id, name: pkg.name || pkg.kody_id || pkg.package_id, description: pkg.description || '' } }]
      for (const exp of result.exports) {
        if (!Array.isArray(exp.functions)) { issues.push('Unsupported functions'); continue }
        if (!exp.functions.length) items.push({ kind: 'module', value: { name: exp.import_specifier, description: exp.description || result.description || '', importSpecifier: exp.import_specifier, packageId: pkg.package_id, subpath: exp.subpath } })
        for (const fn of exp.functions) items.push({ kind: 'export', value: { identity: JSON.stringify([exp.import_specifier, fn.name]), name: exp.import_specifier + '#' + fn.name, description: fn.description || exp.description || result.description || '', importSpecifier: exp.import_specifier, exportName: fn.name, packageId: pkg.package_id, subpath: exp.subpath, typeDefinition: fn.type_definition ?? null, referencedTypes: (exp.referenced_types ?? []).map(type => ({ name: type.name, definition: type.definition })) } })
      }
      if (next.item > items.length) throw new Error('Kody package changed during inventory read')
      if (next.detail && next.detail !== await hash([result.description, result.exports])) throw new Error('Kody package changed during inventory read')
      let stopped = false
      for (let item = next.item; item < items.length; item++) {
        const status = append(items[item].kind === 'package' ? packages : items[item].kind === 'module' ? modules : exports, items[item].value, items[item].kind)
        if (status !== 'added') {
          const fragmentOffset = status === 'fragment' ? fragment.offset + fragment.data.length : 0
          next = { phase: 'packages', index: next.index, item: status === 'fragment' && fragmentOffset === fragment.total ? item + 1 : item, ...(fragmentOffset && fragmentOffset < fragment.total ? { fragmentOffset } : {}), ...(item || status === 'fragment' ? { detail: await hash([result.description, result.exports]) } : {}) }
          stopped = true
          break
        }
      }
      if (stopped) break
      next = { phase: 'packages', index: next.index + 1, item: 0 }
    }
    sources++
  }
  const done = next.phase === 'packages' && next.index >= saved.packages.length
  return { format: 'gum-kody-inventory-v6', capabilities, packages, exports, modules, counts, page: { index: pageIndex, fingerprint, ...(done ? {} : { next }) }, ...(fragment ? { fragment } : {}), issues }
}`
const inventorySchema = z.object({
  format: z.enum([
    'gum-kody-inventory-v1',
    'gum-kody-inventory-v2',
    'gum-kody-inventory-v3',
    'gum-kody-inventory-v4',
    'gum-kody-inventory-v5',
    'gum-kody-inventory-v6',
  ]),
  capabilities: z.array(
    z.object({
      identity: z.string(),
      name: z.string(),
      description: z.string(),
      domain: z.string(),
      source: z.string(),
      mcpServer: z
        .object({
          serverId: z.string(),
          serverName: z.string(),
          kodyName: z.string(),
          mcpToolName: z.string(),
          toolName: z.string(),
        })
        .optional(),
    }),
  ),
  exports: z.array(
    z.object({
      identity: z.string(),
      name: z.string(),
      description: z.string(),
      importSpecifier: z.string(),
      exportName: z.string(),
      packageId: z.string().optional(),
      subpath: z.string().optional(),
      typeDefinition: z.string().nullable().optional(),
      referencedTypes: z
        .array(z.object({ name: z.string(), definition: z.string() }))
        .optional(),
    }),
  ),
  modules: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        importSpecifier: z.string(),
        packageId: z.string(),
        subpath: z.string(),
      }),
    )
    .optional(),
  packages: z
    .array(
      z.object({
        packageId: z.string(),
        name: z.string(),
        description: z.string(),
      }),
    )
    .optional(),
  counts: z.object({
    domains: z.number().int().nonnegative(),
    packages: z.number().int().nonnegative(),
    advertisedCapabilities: z.number().int().nonnegative(),
  }),
  issues: z.array(z.string()),
  fragment: z
    .object({
      kind: z.enum(['capability', 'package', 'module', 'export']),
      offset: z.number().int().nonnegative(),
      total: z.number().int().positive(),
      data: z.string().min(1),
    })
    .optional(),
  page: z
    .object({
      index: z.number().int().nonnegative(),
      total: z.number().int().positive().optional(),
      fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
      next: z
        .object({
          phase: z.enum(['domains', 'packages']),
          index: z.number().int().nonnegative(),
          item: z.number().int().nonnegative(),
          detail: z
            .string()
            .regex(/^[0-9a-f]{64}$/)
            .optional(),
          fragmentOffset: z.number().int().positive().optional(),
        })
        .optional(),
    })
    .optional(),
})
export function readKodyInventory(raw: unknown) {
  const envelope = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.object({ result: z.unknown() }),
    })
    .parse(raw)
  if (envelope.isError) throw new Error('Kody inventory returned an error.')
  const inventory = inventorySchema.parse(envelope.structuredContent.result)
  if (
    (inventory.format === 'gum-kody-inventory-v5' &&
      (!inventory.page || !inventory.page.total)) ||
    (inventory.format === 'gum-kody-inventory-v6' && !inventory.page)
  )
    throw new Error('Kody inventory page metadata was not returned.')
  const warnings = [...inventory.issues]
  if (inventory.capabilities.length !== inventory.counts.advertisedCapabilities)
    warnings.push(
      'Registry total did not match the collected capability count.',
    )
  if (
    [
      'gum-kody-inventory-v3',
      'gum-kody-inventory-v4',
      'gum-kody-inventory-v5',
      'gum-kody-inventory-v6',
    ].includes(inventory.format) &&
    inventory.packages?.length !== inventory.counts.packages
  )
    warnings.push('Package count did not match the collected package index.')
  if (
    [
      'gum-kody-inventory-v4',
      'gum-kody-inventory-v5',
      'gum-kody-inventory-v6',
    ].includes(inventory.format) &&
    !inventory.modules
  )
    warnings.push('Helper module index was not returned.')
  return { inventory, warnings, complete: warnings.length === 0 }
}

/** Read every account page while refusing to join different Kody indexes. */
export async function collectKodyInventory(
  fetchPage: (
    page: number,
    cursor?: {
      phase: 'domains' | 'packages'
      index: number
      item: number
      detail?: string
      fragmentOffset?: number
    },
  ) => Promise<unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  const firstRaw = await fetchPage(0)
  const first = readKodyInventory(firstRaw).inventory
  if (first.format === 'gum-kody-inventory-v6' && first.page) {
    if (first.page.index !== 0 || first.page.total !== undefined)
      throw new Error('Kody returned the wrong inventory page.')
    if (!first.page.next && first.fragment)
      throw new Error('Kody returned an unfinished inventory fragment.')
    if (!first.page.next) return firstRaw
    const merged = {
      ...first,
      capabilities: [...first.capabilities],
      packages: [...(first.packages ?? [])],
      exports: [...first.exports],
      modules: [...(first.modules ?? [])],
      issues: [...first.issues],
      fragment: undefined,
      page: { index: 0, fingerprint: first.page.fingerprint },
    }
    let cursor:
      | {
          phase: 'domains' | 'packages'
          index: number
          item: number
          detail?: string
          fragmentOffset?: number
        }
      | undefined = first.page.next
    let page = 1
    const advances = (
      current: NonNullable<typeof cursor>,
      candidate: NonNullable<typeof cursor>,
    ) => {
      if (current.phase !== candidate.phase)
        return current.phase === 'domains' && candidate.phase === 'packages'
      return (
        candidate.index > current.index ||
        (candidate.index === current.index &&
          (candidate.item > current.item ||
            (candidate.item === current.item &&
              (candidate.fragmentOffset ?? 0) > (current.fragmentOffset ?? 0))))
      )
    }
    let pending:
      | {
          kind: NonNullable<typeof first.fragment>['kind']
          total: number
          data: string
        }
      | undefined
    const collectFragment = (inventory: typeof first) => {
      const fragment = inventory.fragment
      if (!fragment) {
        if (pending || inventory.page?.next?.fragmentOffset)
          throw new Error('Kody inventory fragment was lost.')
        return
      }
      if (fragment.offset + fragment.data.length > fragment.total)
        throw new Error('Kody returned an invalid inventory fragment.')
      if (fragment.offset === 0) {
        if (pending) throw new Error('Kody inventory fragment changed.')
        pending = {
          kind: fragment.kind,
          total: fragment.total,
          data: fragment.data,
        }
      } else {
        if (
          !pending ||
          pending.kind !== fragment.kind ||
          pending.total !== fragment.total ||
          pending.data.length !== fragment.offset
        )
          throw new Error('Kody inventory fragment changed.')
        pending.data += fragment.data
      }
      if (pending.data.length === pending.total) {
        let value: unknown
        try {
          value = JSON.parse(pending.data)
        } catch {
          throw new Error('Kody returned an invalid inventory fragment.')
        }
        if (pending.kind === 'capability')
          merged.capabilities.push(value as (typeof first.capabilities)[number])
        else if (pending.kind === 'package')
          merged.packages.push(
            value as NonNullable<typeof first.packages>[number],
          )
        else if (pending.kind === 'module')
          merged.modules.push(
            value as NonNullable<typeof first.modules>[number],
          )
        else merged.exports.push(value as (typeof first.exports)[number])
        pending = undefined
      }
      if (
        (inventory.page?.next?.fragmentOffset ?? 0) !==
        (pending?.data.length ?? 0)
      )
        throw new Error('Kody inventory fragment cursor changed.')
    }
    collectFragment(first)
    if (!advances({ phase: 'domains', index: 0, item: 0 }, cursor))
      throw new Error('Kody inventory cursor did not advance.')
    while (cursor) {
      if (signal?.aborted) throw new Error('Kody inventory read was stopped.')
      if (page > 10_000)
        throw new Error('Kody inventory exceeded the page limit.')
      let next: typeof first
      try {
        next = readKodyInventory(await fetchPage(page, cursor)).inventory
      } catch {
        if (signal?.aborted) throw new Error('Kody inventory read was stopped.')
        merged.issues.push(`Inventory page ${page} could not be loaded.`)
        break
      }
      if (
        next.format !== first.format ||
        next.page?.index !== page ||
        next.page.total !== undefined ||
        next.page.fingerprint !== first.page.fingerprint ||
        JSON.stringify(next.counts) !== JSON.stringify(first.counts) ||
        (next.page.next && !advances(cursor, next.page.next))
      )
        throw new Error('Kody inventory changed during refresh.')
      collectFragment(next)
      merged.capabilities.push(...next.capabilities)
      merged.packages.push(...(next.packages ?? []))
      merged.exports.push(...next.exports)
      merged.modules.push(...(next.modules ?? []))
      merged.issues.push(...next.issues)
      cursor = next.page.next
      page++
    }
    if (pending)
      merged.issues.push('Inventory fragment could not be completed.')
    return { structuredContent: { result: merged } }
  }
  if (first.format !== 'gum-kody-inventory-v5' || !first.page) return firstRaw
  const total = first.page.total
  if (!total) throw new Error('Kody inventory page count was not returned.')
  if (first.page.index !== 0)
    throw new Error('Kody returned the wrong inventory page.')
  if (
    total !==
    Math.max(
      1,
      Math.ceil(first.counts.domains / 64),
      Math.ceil(first.counts.packages / 200),
    )
  )
    throw new Error('Kody returned an inconsistent inventory page count.')
  if (total === 1) return firstRaw
  const merged = {
    ...first,
    capabilities: [...first.capabilities],
    packages: [...(first.packages ?? [])],
    exports: [...first.exports],
    modules: [...(first.modules ?? [])],
    issues: [...first.issues],
    page: { ...first.page, total: 1 },
  }
  for (let page = 1; page < total; page++) {
    if (signal?.aborted) throw new Error('Kody inventory read was stopped.')
    let next: typeof first
    try {
      next = readKodyInventory(await fetchPage(page)).inventory
    } catch {
      if (signal?.aborted) throw new Error('Kody inventory read was stopped.')
      merged.issues.push(`Inventory page ${page} could not be loaded.`)
      continue
    }
    if (
      next.format !== first.format ||
      next.page?.index !== page ||
      next.page.total !== total ||
      next.page.fingerprint !== first.page.fingerprint ||
      JSON.stringify(next.counts) !== JSON.stringify(first.counts)
    )
      throw new Error('Kody inventory changed during refresh.')
    merged.capabilities.push(...next.capabilities)
    merged.packages.push(...(next.packages ?? []))
    merged.exports.push(...next.exports)
    merged.modules.push(...(next.modules ?? []))
    merged.issues.push(...next.issues)
  }
  return { structuredContent: { result: merged } }
}
export function parseKodyInventory(
  raw: unknown,
  source: CatalogEntry,
): InventoryResult {
  const { inventory, warnings } = readKodyInventory(raw)
  const entries: CatalogEntry[] = [
    ...inventory.capabilities,
    ...inventory.exports,
  ].map((item) => ({
    id: JSON.stringify([source.serverId, 'kody-inventory-v1', item.identity]),
    serverId: source.serverId,
    serverLabel: source.serverLabel,
    kind: 'capability',
    name: item.name,
    title: item.name,
    description: item.description,
    target: source.target,
    discovered: {
      sourceId: source.id,
      sourceArguments: { operation: 'inventory-v1' },
      evidence: JSON.stringify(item),
      invocation: '',
      verified: false,
    },
  }))
  const unique = new Map(entries.map((entry) => [entry.id, entry]))
  if (unique.size !== entries.length)
    warnings.push('Duplicate capability identities were returned.')
  return {
    entries: [...unique.values()],
    complete: warnings.length === 0,
    warnings,
    counts: inventory.counts,
    version:
      inventory.format === 'gum-kody-inventory-v6'
        ? 6
        : inventory.format === 'gum-kody-inventory-v5'
          ? 5
          : inventory.format === 'gum-kody-inventory-v4'
            ? 4
            : inventory.format === 'gum-kody-inventory-v3'
              ? 3
              : inventory.format === 'gum-kody-inventory-v2'
                ? 2
                : 1,
  }
}
export async function enumerateKody(context: InventoryContext) {
  const source = context.entries.find(
    (e) => e.kind === 'tool' && e.name === 'execute',
  )
  if (!source)
    throw new Error(
      'The paired Kody inventory requires the advertised execute tool.',
    )
  const raw = await collectKodyInventory((page, cursor) =>
    context.call(
      source,
      kodyInternalReadArgs({
        code: KODY_INVENTORY_CODE,
        ...(page ? { params: { page, cursor } } : {}),
        responseLimit: 1000000,
      }),
    ),
  )
  return parseKodyInventory(raw, source)
}
