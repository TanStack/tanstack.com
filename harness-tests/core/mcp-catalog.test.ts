import { describe, it, expect, vi } from 'vitest'
import {
  replaceServerCatalog,
  cachedMcpCatalog,
  collectMcpCatalog,
  type CatalogSource,
  type ServerCatalog,
} from '../../src/chat/server/mcp-catalog'

const signal = () => new AbortController().signal
const tool = {
  name: 'read',
  description: 'Read something',
  inputSchema: { type: 'object' },
}
function source(id: string): CatalogSource {
  return {
    id,
    label: id,
    kinds: ['tools', 'prompts', 'resources', 'resourceTemplates'],
    list: vi.fn<CatalogSource['list']>(
      async (kind) =>
        ({
          tools: { tools: [tool] },
          prompts: {
            prompts: [
              {
                name: 'guide',
                description: 'Reusable instructions',
                arguments: [{ name: 'topic', required: true }],
              },
            ],
          },
          resources: {
            resources: [{ name: 'SKILL.md', uri: 'skill://example/guide' }],
          },
          resourceTemplates: {
            resourceTemplates: [
              { name: 'Document', uriTemplate: 'docs://{id}' },
            ],
          },
        })[kind],
    ),
  }
}
describe('standard MCP catalog', () => {
  it.each(['alpha', 'beta'])(
    'handles %s without provider-specific parsing',
    async (id) => {
      const result = await collectMcpCatalog(source(id), signal())
      expect(result.entries.map((entry) => entry.kind)).toEqual([
        'tool',
        'prompt',
        'resource',
        'resource-template',
      ])
      expect(result.entries.every((entry) => entry.serverId === id)).toBe(true)
      expect(result.entries[0].target).toEqual({
        method: 'tools/call',
        name: 'read',
      })
      expect(result.entries[1].arguments).toEqual([
        { name: 'topic', required: true },
      ])
      expect(result.entries[2].target).toEqual({
        method: 'resources/read',
        uri: 'skill://example/guide',
      })
      expect(result.scope).toBe('server-advertised')
    },
  )
  it('namespaces identical names by server and entry kind', async () => {
    const a = await collectMcpCatalog(source('a'), signal())
    const b = await collectMcpCatalog(source('b'), signal())
    expect(new Set([...a.entries, ...b.entries].map((e) => e.id)).size).toBe(8)
  })
  it('enumerates all pages without a user query', async () => {
    const list = vi.fn(async (_kind, cursor) =>
      cursor
        ? { tools: [{ ...tool, name: 'second' }] }
        : { tools: [tool], nextCursor: 'next' },
    )
    const result = await collectMcpCatalog(
      { ...source('a'), kinds: ['tools'], list },
      signal(),
    )
    expect(list.mock.calls).toEqual([
      ['tools', undefined],
      ['tools', 'next'],
    ])
    expect(result.entries).toHaveLength(2)
  })
  it('does not execute a discovery tool or invent its children from prose', async () => {
    const result = await collectMcpCatalog(
      {
        ...source('a'),
        kinds: ['tools'],
        list: async () => ({
          tools: [
            {
              ...tool,
              name: 'discover',
              description: 'Call this to get more tools',
              outputSchema: {
                type: 'object',
                properties: { tools: { type: 'array' } },
              },
            },
          ],
        }),
      },
      signal(),
    )
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].outputSchema).toBeDefined()
    expect(result.scope).toBe('server-advertised')
  })
  it('rejects cursor cycles and invalid schemas', async () => {
    await expect(
      collectMcpCatalog(
        {
          ...source('a'),
          kinds: ['tools'],
          list: async () => ({ tools: [tool], nextCursor: 'repeat' }),
        },
        signal(),
      ),
    ).rejects.toThrow('cursor')
    await expect(
      collectMcpCatalog(
        {
          ...source('a'),
          kinds: ['tools'],
          list: async () => ({ tools: [{ name: 'missing-schema' }] }),
        },
        signal(),
      ),
    ).rejects.toThrow('invalid')
  })
  it('labels page-limited snapshots incomplete', async () => {
    let page = 0
    const result = await collectMcpCatalog(
      {
        ...source('a'),
        kinds: ['tools'],
        list: async () => ({ tools: [tool], nextCursor: String(++page) }),
      },
      signal(),
    )
    expect(result.complete).toBe(false)
    expect(result.warnings).toHaveLength(1)
  })
})
describe('MCP snapshot cache', () => {
  const connection = {
    id: 'a',
    label: 'A',
    url: 'https://example.com/mcp',
    accessToken: 'private-token',
  }
  const scope = { userId: 'u', workspaceId: 'w' }
  function fixture() {
    const data = new Map<string, ServerCatalog>()
    return {
      data,
      store: {
        get: async (key: string) => data.get(key),
        put: async (key: string, value: ServerCatalog) => {
          data.set(key, value)
        },
      },
      fetch: vi.fn(async () => collectMcpCatalog(source('a'), signal())),
    }
  }
  it('reuses a complete snapshot and supports explicit refresh', async () => {
    const { store, fetch, data } = fixture()
    await cachedMcpCatalog(connection, scope, store, signal(), false, fetch)
    expect(
      (await cachedMcpCatalog(connection, scope, store, signal(), false, fetch))
        .cache,
    ).toBe('hit')
    expect(fetch).toHaveBeenCalledOnce()
    expect(JSON.stringify([...data])).not.toContain('private-token')
    await cachedMcpCatalog(connection, scope, store, signal(), true, fetch)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('separates users, workspaces, endpoints, and authorization contexts', async () => {
    const { store, fetch } = fixture()
    for (const [server, owner] of [
      [connection, scope],
      [connection, { ...scope, userId: 'other' }],
      [connection, { ...scope, workspaceId: 'other' }],
      [connection, { ...scope, taskId: 'task-A' }],
      [connection, { ...scope, taskId: 'task-B' }],
      [{ ...connection, accessToken: 'new-token' }, scope],
      [{ ...connection, url: 'https://other.example/mcp' }, scope],
    ] as const)
      await cachedMcpCatalog(server, owner, store, signal(), false, fetch)
    expect(fetch).toHaveBeenCalledTimes(7)
  })
  it('refreshes expired snapshots, never returns stale results after a failure', async () => {
    const { store, fetch, data } = fixture()
    await cachedMcpCatalog(connection, scope, store, signal(), false, fetch)
    for (const value of data.values()) value.fetchedAt = 0
    fetch.mockRejectedValueOnce(new Error('offline'))
    await expect(
      cachedMcpCatalog(connection, scope, store, signal(), false, fetch),
    ).rejects.toThrow('offline')
  })
  it('stops aborted enumeration', async () => {
    const abort = new AbortController()
    abort.abort()
    const { store, fetch } = fixture()
    await expect(
      cachedMcpCatalog(connection, scope, store, abort.signal, false, fetch),
    ).rejects.toThrow('Stopped')
    expect(fetch).not.toHaveBeenCalled()
  })
})

it('refreshes one complete server catalog without preserving removed native tools or affecting other servers', async () => {
  const first = await collectMcpCatalog(source('a'), signal())
  const other = await collectMcpCatalog(source('b'), signal())
  const updated = {
    ...first,
    entries: first.entries.filter((entry) => entry.kind === 'tool'),
  }
  const merged = replaceServerCatalog(
    [...first.entries, ...other.entries],
    updated,
  )
  expect(merged.filter((entry) => entry.serverId === 'a')).toEqual(
    updated.entries,
  )
  expect(merged.filter((entry) => entry.serverId === 'b')).toEqual(
    other.entries,
  )
  expect(() =>
    replaceServerCatalog(first.entries, { ...updated, complete: false }),
  ).toThrow('incomplete')
  expect(() =>
    replaceServerCatalog(first.entries, { ...updated, entries: other.entries }),
  ).toThrow('scope')
})
