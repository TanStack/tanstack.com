import { describe, expect, it, vi } from 'vitest'
import {
  assistantMcpTools,
  loadReferencedMcpTools,
} from '../../src/chat/server/assistant-mcp-tools'
import type {
  CatalogEntry,
  ServerCatalog,
} from '../../src/chat/server/mcp-catalog'

const connection = (id: string) => ({
  id,
  label: id,
  url: `https://${id}.example/mcp`,
})
const tool = (serverId: string, name = 'find_record'): CatalogEntry => ({
  id: JSON.stringify([serverId, 'tool', name]),
  serverId,
  serverLabel: serverId,
  kind: 'tool',
  name,
  title: 'Find record',
  description: 'Find a record by its code.',
  target: { method: 'tools/call', name },
  inputSchema: {
    type: 'object',
    properties: { code: { type: 'string' } },
    required: ['code'],
    additionalProperties: false,
  },
})
const snapshot = (
  serverId: string,
  entries: CatalogEntry[],
): ServerCatalog => ({
  serverId,
  entries,
  fetchedAt: Date.now(),
  complete: true,
  scope: 'server-advertised',
  warnings: [],
})
const reference = (serverId: string, toolName = 'find_record') => ({
  kind: 'tool' as const,
  serverId,
  toolName,
})

describe('explicit tool contracts', () => {
  it('resolves exact server identities, refreshes each selected server once and executes nothing', async () => {
    const records = [
      tool('first'),
      tool('second'),
      tool('second', 'read_record'),
    ]
    const catalog = vi.fn(async ({ id }: { id: string }) =>
      snapshot(
        id,
        records.filter((entry) => entry.serverId === id),
      ),
    )
    const selected = await loadReferencedMcpTools(
      [reference('second'), reference('second', 'read_record')],
      [connection('first'), connection('second')],
      catalog,
    )
    expect(selected).toEqual(records.slice(1))
    expect(catalog).toHaveBeenCalledExactlyOnceWith(connection('second'), true)
  })

  it('loads selected contracts for inspection and keeps argument validation and approval', async () => {
    const entry = tool('records')
    const catalog = vi.fn(async () => snapshot('records', [entry]))
    const selectedTools = await loadReferencedMcpTools(
      [reference('records')],
      [connection('records')],
      catalog,
    )
    const propose = vi.fn(async () => ({ status: 'awaiting_user_approval' }))
    const read = vi.fn()
    const tools = assistantMcpTools({
      connections: [connection('records')],
      catalog,
      selectedTools,
      propose,
      read,
    })
    const invoke = (name: string, args: unknown) =>
      tools.find((candidate) => candidate.name === name)!.execute!(
        args as never,
      )
    expect(
      await invoke('inspect_connected_tool', { entryId: entry.id }),
    ).toEqual(entry)
    expect(
      await invoke('call_connected_tool', {
        entryId: entry.id,
        arguments: { oldId: 'stale' },
      }),
    ).toMatchObject({ status: 'invalid_arguments' })
    expect(propose).not.toHaveBeenCalled()
    expect(
      await invoke('call_connected_tool', {
        entryId: entry.id,
        arguments: { code: 'one' },
      }),
    ).toEqual({ status: 'awaiting_user_approval' })
    expect(propose).toHaveBeenCalledExactlyOnceWith(entry, { code: 'one' })
    expect(read).not.toHaveBeenCalled()
    expect(catalog).toHaveBeenCalledTimes(1)
  })

  it('fails closed when the connection is disabled without querying another same-name tool', async () => {
    const catalog = vi.fn()
    await expect(
      loadReferencedMcpTools(
        [reference('removed')],
        [connection('other')],
        catalog,
      ),
    ).rejects.toThrow('no longer available')
    expect(catalog).not.toHaveBeenCalled()
  })

  it.each([
    'removed',
    'duplicate',
    'discovered',
    'wrong-server',
    'wrong-target',
    'incomplete',
  ])(
    'does not seed an unavailable or ambiguous %s contract',
    async (reason) => {
      const entry = tool('records')
      const invalid =
        reason === 'discovered'
          ? {
              ...entry,
              discovered: {
                sourceId: 'search',
                sourceArguments: {},
                evidence: '',
                invocation: '',
                verified: false as const,
              },
            }
          : reason === 'wrong-server'
            ? tool('other')
            : reason === 'wrong-target'
              ? {
                  ...entry,
                  target: {
                    method: 'tools/call' as const,
                    name: 'delete_record',
                  },
                }
              : entry
      const value = snapshot(
        'records',
        reason === 'removed'
          ? []
          : reason === 'duplicate'
            ? [entry, entry]
            : [invalid],
      )
      if (reason === 'incomplete') value.complete = false
      await expect(
        loadReferencedMcpTools(
          [reference('records')],
          [connection('records')],
          async () => value,
        ),
      ).rejects.toThrow(/referenced tool/)
    },
  )

  it('does not fetch catalogs for ordinary file, conversation or connection references', async () => {
    const catalog = vi.fn()
    expect(
      await loadReferencedMcpTools(
        [
          { kind: 'connection', serverId: 'records' },
          { kind: 'conversation', botId: 'notes' },
        ],
        [connection('records')],
        catalog,
      ),
    ).toEqual([])
    expect(catalog).not.toHaveBeenCalled()
  })
})

it('restores listed identities after reconstruction and validates the current schema', async () => {
  const discoveredEntries: Array<{ id: string; serverId: string }> = []
  let current = tool('first')
  const catalog = vi.fn(async () => snapshot('first', [current]))
  const propose = vi.fn(async () => ({ status: 'awaiting_user_approval' }))
  const host = {
    connections: [connection('first')],
    catalog,
    propose,
    read: vi.fn(),
    discoveredEntries,
  }
  const initial = assistantMcpTools(host)
  await initial.find((t) => t.name === 'list_connected_tools')!.execute!({
    serverId: 'first',
  })
  expect(discoveredEntries).toEqual([{ id: current.id, serverId: 'first' }])
  expect(JSON.stringify(discoveredEntries)).not.toContain('inputSchema')
  current = {
    ...current,
    inputSchema: {
      type: 'object',
      properties: { revision: { type: 'number' } },
      required: ['revision'],
      additionalProperties: false,
    },
  }
  const resumed = assistantMcpTools({
    ...host,
    discoveredEntries: JSON.parse(JSON.stringify(discoveredEntries)),
  })
  const call = resumed.find((t) => t.name === 'call_connected_tool')!
  expect(
    await call.execute!({
      entryId: current.id,
      arguments: { code: 'old-schema' },
    }),
  ).toMatchObject({ status: 'invalid_arguments' })
  expect(propose).not.toHaveBeenCalled()
  expect(catalog).toHaveBeenLastCalledWith(connection('first'), true)
  await call.execute!({ entryId: current.id, arguments: { revision: 2 } })
  expect(propose).toHaveBeenCalledExactlyOnceWith(current, { revision: 2 })
})

it.each([
  'removed-connection',
  'removed-entry',
  'incomplete',
  'wrong-server',
  'unknown-id',
])('does not turn discovery memory into authority: %s', async (scenario) => {
  const entry = tool('first')
  const propose = vi.fn()
  const catalog = vi.fn(async () => ({
    ...snapshot(
      scenario === 'wrong-server' ? 'second' : 'first',
      scenario === 'removed-entry' ? [] : [entry],
    ),
    complete: scenario !== 'incomplete',
  }))
  const tools = assistantMcpTools({
    connections: scenario === 'removed-connection' ? [] : [connection('first')],
    discoveredEntries: [{ id: entry.id, serverId: 'first' }],
    catalog,
    propose,
    read: vi.fn(),
  })
  await expect(
    tools.find((t) => t.name === 'call_connected_tool')!.execute!({
      entryId: scenario === 'unknown-id' ? 'unseen' : entry.id,
      arguments: { code: 'x' },
    }),
  ).rejects.toThrow()
  expect(propose).not.toHaveBeenCalled()
  if (scenario === 'unknown-id' || scenario === 'removed-connection')
    expect(catalog).not.toHaveBeenCalled()
})
