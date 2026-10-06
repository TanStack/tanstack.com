import { describe, it, expect, vi } from 'vitest'
import {
  KODY_INVENTORY_CODE,
  collectKodyInventory,
  enumerateKody,
  parseKodyInventory,
  readKodyInventory,
} from '../../src/chat/server/discovery-integrations/kody-inventory'
import type { CatalogEntry } from '../../src/chat/server/mcp-catalog'
const source: CatalogEntry = {
  id: 'execute',
  name: 'execute',
  title: 'Execute',
  description: '',
  kind: 'tool',
  serverId: 'one',
  serverLabel: 'One',
  target: { method: 'tools/call', name: 'execute' },
}
// Execute the reviewed program with a fake metadata API, never network or Kody.
async function program(
  kody: unknown,
  params?: {
    page: number
    cursor?: {
      phase: 'domains' | 'packages'
      index: number
      item: number
      detail?: string
      fragmentOffset?: number
    }
  },
) {
  const body = KODY_INVENTORY_CODE.replace(
    "import { kody } from 'kody:runtime'",
    '',
  ).replace(
    'export default async function main(params)',
    'async function main(params)',
  )
  return new Function('kody', 'params', body + '\nreturn main(params)')(
    kody,
    params,
  )
}
function api() {
  return {
    metaListCapabilities: vi.fn<
      (args: { domain?: string }) => Promise<unknown>
    >(async ({ domain }) =>
      domain
        ? {
            capabilities: [
              {
                name: 'read',
                description: 'Read activity',
                domain,
                source: 'builtin',
              },
            ],
          }
        : { total: 1, domains: [{ id: 'activity', capabilityCount: 1 }] },
    ),
    packageList: vi.fn(async () => ({ packages: [{ package_id: 'p' }] })),
    packageGet: vi.fn<() => Promise<unknown>>(async () => ({
      description: 'Package',
      package_secrets: [{ name: 'sensitive' }],
      exports: [
        {
          import_specifier: 'kody:@example/activity/read',
          description: 'Read recent messages',
          subpath: './read',
          functions: [
            {
              name: 'default',
              description: null,
              type_definition:
                'export default function read(input: Input): Promise<string>',
            },
          ],
          referenced_types: [
            { name: 'Input', definition: 'type Input = { id: string }' },
          ],
        },
      ],
    })),
  }
}
const wrap = (result: unknown) => ({ structuredContent: { result } })
describe('query-independent Kody inventory', () => {
  it('collects both registries without a query and projects away secret metadata', async () => {
    const kody = api()
    const raw = await program(kody)
    expect(raw.packages).toEqual([
      { packageId: 'p', name: 'p', description: '' },
    ])
    expect(raw.modules).toEqual([])
    expect(kody.packageList).toHaveBeenCalledWith({})
    expect(kody.metaListCapabilities).toHaveBeenCalledWith({
      domain: 'activity',
    })
    expect(kody.packageGet).toHaveBeenCalledWith({ package_id: 'p' })
    expect(JSON.stringify(raw)).not.toContain('sensitive')
    const result = parseKodyInventory(wrap(raw), source)
    expect(result.entries).toHaveLength(2)
    expect(result.complete).toBe(true)
    expect(result.version).toBe(6)
    const metadata = JSON.parse(result.entries[1].discovered!.evidence)
    expect(metadata.packageId).toBe('p')
    expect(metadata.subpath).toBe('./read')
    expect(metadata.typeDefinition).toContain('input: Input')
    expect(metadata.referencedTypes).toEqual([
      { name: 'Input', definition: 'type Input = { id: string }' },
    ])
    expect(result.entries.every((e) => e.discovered?.verified === false)).toBe(
      true,
    )
  })
  it('retains non-callable package modules as metadata without presenting runnable tools', async () => {
    const kody = api()
    kody.packageGet = vi.fn(async () => ({
      description: 'Question helpers',
      exports: [
        {
          import_specifier: 'kody:@example/activity/wikipedia-read',
          description: 'Read a Wikipedia page',
          subpath: './wikipedia-read',
          functions: [],
        },
      ],
    }))
    const raw = await program(kody)
    expect(raw.exports).toEqual([])
    expect(raw.modules).toEqual([
      {
        name: 'kody:@example/activity/wikipedia-read',
        description: 'Read a Wikipedia page',
        importSpecifier: 'kody:@example/activity/wikipedia-read',
        packageId: 'p',
        subpath: './wikipedia-read',
      },
    ])
    expect(parseKodyInventory(wrap(raw), source)).toMatchObject({
      complete: true,
      entries: [{ name: 'read' }],
    })
  })
  it('counts advertised capabilities from domains, not the domain-index total', async () => {
    const kody = api()
    kody.metaListCapabilities = vi.fn(async ({ domain }: { domain?: string }) =>
      domain
        ? {
            capabilities: [
              { name: 'a', description: 'A', domain, source: 'builtin' },
              { name: 'b', description: 'B', domain, source: 'builtin' },
            ],
          }
        : { total: 1, domains: [{ id: 'activity', capabilityCount: 2 }] },
    )
    const result = parseKodyInventory(wrap(await program(kody)), source)
    expect(result.counts.advertisedCapabilities).toBe(2)
    expect(result.complete).toBe(true)
  })
  it('keeps connected tool identity without copying server credentials', async () => {
    const kody = api()
    kody.metaListCapabilities = vi.fn(async ({ domain }: { domain?: string }) =>
      domain
        ? {
            capabilities: [
              {
                name: 'mcp:home:get_status',
                description: 'Get device status',
                domain,
                source: 'mcp-server',
                mcpServer: {
                  serverId: 'server-1',
                  serverName: 'Home',
                  kodyName: 'home',
                  mcpToolName: 'get_status',
                  toolName: 'get_status',
                  accessToken: 'do-not-copy',
                },
              },
            ],
          }
        : { domains: [{ id: 'mcp:home', capabilityCount: 1 }] },
    )
    const raw = await program(kody)
    expect(JSON.stringify(raw)).not.toContain('do-not-copy')
    const result = parseKodyInventory(wrap(raw), source)
    expect(JSON.parse(result.entries[0].discovered!.evidence!)).toMatchObject({
      source: 'mcp-server',
      mcpServer: { serverId: 'server-1', mcpToolName: 'get_status' },
    })
  })
  it('preserves other collections and reports failed reads as incomplete', async () => {
    const kody = api()
    kody.packageGet.mockRejectedValue(new Error('Unavailable'))
    const result = parseKodyInventory(wrap(await program(kody)), source)
    expect(result.complete).toBe(false)
    expect(result.entries).toHaveLength(1)
  })
  it('collects every page past the former domain and package limits', async () => {
    const domains = Array.from({ length: 65 }, (_, index) => ({
      id: `domain-${index}`,
      capabilityCount: 1,
    }))
    const packages = Array.from({ length: 201 }, (_, index) => ({
      package_id: `package-${index}`,
      name: `Package ${index}`,
    }))
    const kody = {
      metaListCapabilities: vi.fn<
        (args: { domain?: string }) => Promise<unknown>
      >(async ({ domain }) =>
        domain
          ? {
              capabilities: [
                {
                  name: `read-${domain}`,
                  description: 'Read data',
                  domain,
                  source: 'builtin',
                },
              ],
            }
          : { domains },
      ),
      packageList: vi.fn(async () => ({ packages })),
      packageGet: vi.fn(async ({ package_id }: { package_id: string }) => ({
        description: 'Saved package',
        exports: [
          {
            import_specifier: `kody:@example/${package_id}/read`,
            subpath: './read',
            functions: [{ name: 'default' }],
          },
        ],
      })),
    }
    const first = await program(kody)
    expect(first.page).toMatchObject({
      index: 0,
      next: { phase: 'domains', index: 32, item: 0 },
    })
    expect(first.packages).toHaveLength(0)
    expect(readKodyInventory(wrap(first)).complete).toBe(false)
    const fetch = vi.fn(
      async (page: number, cursor?: NonNullable<typeof first.page.next>) =>
        wrap(page === 0 ? first : await program(kody, { page, cursor })),
    )
    const combined = await collectKodyInventory(fetch)
    const parsed = readKodyInventory(combined)
    expect(fetch).toHaveBeenCalledTimes(9)
    expect(parsed.complete).toBe(true)
    expect(parsed.inventory.capabilities).toHaveLength(65)
    expect(parsed.inventory.packages).toHaveLength(201)
    expect(parsed.inventory.exports).toHaveLength(201)
    expect(kody.packageGet).toHaveBeenCalledWith({ package_id: 'package-200' })
    expect(parseKodyInventory(combined, source).entries).toHaveLength(266)
  })
  it('rejects mixed account pages and retains healthy pages when a page fails', async () => {
    const kody = api()
    kody.packageList = vi.fn(async () => ({
      packages: Array.from({ length: 201 }, (_, index) => ({
        package_id: `package-${index}`,
      })),
    }))
    const first = await program(kody)
    const partial = await collectKodyInventory(async (page) => {
      if (page === 0) return wrap(first)
      throw new Error('Kody page unavailable')
    })
    expect(readKodyInventory(partial).complete).toBe(false)
    expect(readKodyInventory(partial).inventory.capabilities).toHaveLength(1)
    const changed = structuredClone(
      await program(kody, {
        page: 1,
        cursor: first.page.next,
      }),
    )
    changed.page.fingerprint = '0'.repeat(64)
    await expect(
      collectKodyInventory(async (page) => wrap(page === 0 ? first : changed)),
    ).rejects.toThrow('changed during refresh')
  })
  it('pages within one large package before the execute response limit', async () => {
    const kody = api()
    kody.packageGet = vi.fn(async () => ({
      description: 'Large package',
      exports: [
        {
          import_specifier: 'kody:@example/large',
          subpath: './large',
          functions: Array.from({ length: 30 }, (_, index) => ({
            name: `function${index}`,
            description: 'x'.repeat(30_000),
            type_definition: 'type Input = string',
          })),
        },
      ],
    }))
    const pages: Array<Awaited<ReturnType<typeof program>>> = []
    const combined = await collectKodyInventory(async (page, cursor) => {
      const result = await program(kody, { page, cursor })
      expect(JSON.stringify(result).length).toBeLessThan(650_000)
      pages.push(result)
      return wrap(result)
    })
    expect(pages.length).toBeGreaterThan(1)
    expect(pages[0].page.next).toMatchObject({
      phase: 'packages',
      index: 0,
    })
    expect(readKodyInventory(combined).complete).toBe(true)
    expect(readKodyInventory(combined).inventory.exports).toHaveLength(30)
    expect(readKodyInventory(combined).inventory.packages).toHaveLength(1)
  })
  it('pages within one large capability domain and detects changed detail', async () => {
    const kody = api()
    let description = 'x'.repeat(20_000)
    kody.metaListCapabilities = vi.fn(async ({ domain }: { domain?: string }) =>
      domain
        ? {
            capabilities: Array.from({ length: 35 }, (_, index) => ({
              name: `capability${index}`,
              description,
              domain,
              source: 'builtin',
            })),
          }
        : { domains: [{ id: 'large', capabilityCount: 35 }] },
    )
    const first = await program(kody)
    expect(first.page.next).toMatchObject({
      phase: 'domains',
      index: 0,
      item: expect.any(Number),
      detail: expect.stringMatching(/^[0-9a-f]{64}$/),
    })
    const complete = await collectKodyInventory(async (page, cursor) =>
      wrap(page === 0 ? first : await program(kody, { page, cursor })),
    )
    expect(readKodyInventory(complete).complete).toBe(true)
    expect(readKodyInventory(complete).inventory.capabilities).toHaveLength(35)
    description = 'y'.repeat(20_000)
    const changed = await collectKodyInventory(async (page, cursor) =>
      wrap(page === 0 ? first : await program(kody, { page, cursor })),
    )
    expect(readKodyInventory(changed).complete).toBe(false)
    expect(readKodyInventory(changed).inventory.issues).toContain(
      'Inventory page 1 could not be loaded.',
    )
  })
  it('reassembles a single function contract larger than one execute response', async () => {
    const kody = api()
    let typeDefinition = `type LargeInput = '${'x'.repeat(1_200_000)}'`
    kody.packageGet = vi.fn(async () => ({
      description: 'Large function contract',
      exports: [
        {
          import_specifier: 'kody:@example/large/execute',
          subpath: './execute',
          functions: [{ name: 'default', type_definition: typeDefinition }],
        },
      ],
    }))
    const pages: Array<Awaited<ReturnType<typeof program>>> = []
    const combined = await collectKodyInventory(async (page, cursor) => {
      const result = await program(kody, { page, cursor })
      expect(JSON.stringify(result).length).toBeLessThan(650_000)
      pages.push(result)
      return wrap(result)
    })
    expect(pages.length).toBeGreaterThan(5)
    expect(pages.some((page) => page.fragment?.kind === 'export')).toBe(true)
    const inventory = readKodyInventory(combined)
    expect(inventory.complete).toBe(true)
    expect(inventory.inventory.exports).toHaveLength(1)
    expect(inventory.inventory.exports[0].typeDefinition).toBe(typeDefinition)
    typeDefinition = `type LargeInput = '${'y'.repeat(1_200_000)}'`
    const changed = await collectKodyInventory(async (page, cursor) =>
      wrap(page === 0 ? pages[0] : await program(kody, { page, cursor })),
    )
    expect(readKodyInventory(changed).complete).toBe(false)
  })
  it('reassembles one oversized built-in capability description', async () => {
    const kody = api()
    const description = 'read '.repeat(150_000)
    kody.metaListCapabilities = vi.fn(async ({ domain }: { domain?: string }) =>
      domain
        ? {
            capabilities: [
              { name: 'largeRead', description, domain, source: 'builtin' },
            ],
          }
        : { domains: [{ id: 'large', capabilityCount: 1 }] },
    )
    const combined = await collectKodyInventory(async (page, cursor) => {
      const result = await program(kody, { page, cursor })
      expect(JSON.stringify(result).length).toBeLessThan(650_000)
      return wrap(result)
    })
    const inventory = readKodyInventory(combined)
    expect(inventory.complete).toBe(true)
    expect(inventory.inventory.capabilities[0].description).toBe(description)
  })
  it('rejects truncated output and flags count mismatches', async () => {
    expect(() =>
      parseKodyInventory(wrap({ truncated: true }), source),
    ).toThrow()
    const raw = await program(api())
    raw.counts.advertisedCapabilities = 20
    expect(parseKodyInventory(wrap(raw), source).complete).toBe(false)
    raw.counts.advertisedCapabilities = 1
    raw.packages = []
    expect(parseKodyInventory(wrap(raw), source).complete).toBe(false)
    raw.packages = [{ packageId: 'p', name: 'p', description: '' }]
    delete raw.modules
    expect(parseKodyInventory(wrap(raw), source).complete).toBe(false)
    expect(() =>
      parseKodyInventory({ ...wrap(raw), isError: true }, source),
    ).toThrow()
  })
  it('can invoke only the fixed program against an advertised execute entry', async () => {
    const raw = await program(api())
    const call = vi.fn(async () => wrap(raw))
    await enumerateKody({ entries: [source], call })
    expect(call).toHaveBeenCalledWith(source, {
      code: KODY_INVENTORY_CODE,
      responseLimit: 1000000,
      idempotencyKey: expect.stringMatching(
        /^banks-internal-read-[0-9a-f-]{36}$/,
      ),
    })
    await expect(enumerateKody({ entries: [], call })).rejects.toThrow(
      'advertised',
    )
  })
})
