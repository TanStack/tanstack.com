import { expect, it, vi } from 'vitest'
import { withLocalReadTools } from '../../src/chat/server/local-task-tools'
import type { CatalogEntry } from '../../src/chat/server/mcp-catalog'
it('requires an exact single-use read grant and delegates external operations', async () => {
  const entry: CatalogEntry = {
    id: 'local',
    name: 'read',
    title: 'Read',
    description: 'Read local evidence',
    kind: 'tool',
    serverId: 'local',
    serverLabel: 'Local',
    target: { method: 'tools/call', name: 'read' },
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
  }
  const invoke = vi.fn(async () => ({ text: 'evidence' }))
  const external = vi.fn(async () => false)
  const tool = withLocalReadTools(
    [],
    {
      select: async () => ({ decision: { type: 'done' } }),
      bind: async () => ({ status: 'ready', arguments: {} }),
      authorize: external,
      invoke: async () => ({ ok: false, value: null }),
    },
    [{ entry, invoke }],
  )
  const signal = new AbortController().signal
  await expect(
    tool.dependencies.invoke(entry, { id: 'a' }, signal),
  ).rejects.toThrow('grant')
  await expect(
    tool.dependencies.authorize(entry, { id: 1 }, signal),
  ).rejects.toThrow('arguments')
  await tool.dependencies.authorize(entry, { id: 'a' }, signal)
  await expect(
    tool.dependencies.invoke(entry, { id: 'b' }, signal),
  ).rejects.toThrow('grant')
  await expect(
    tool.dependencies.invoke(entry, { id: 'a' }, signal),
  ).rejects.toThrow('grant')
  await tool.dependencies.authorize(entry, { id: 'a' }, signal)
  expect(await tool.dependencies.invoke(entry, { id: 'a' }, signal)).toEqual({
    ok: true,
    value: { text: 'evidence' },
  })
  expect(invoke).toHaveBeenCalledOnce()
  expect(
    await tool.dependencies.authorize({ ...entry, id: 'external' }, {}, signal),
  ).toBe(false)
  expect(external).toHaveBeenCalledOnce()
  await expect(
    tool.dependencies.authorize(
      { ...entry, serverId: 'impostor' },
      { id: 'a' },
      signal,
    ),
  ).rejects.toThrow('identity')
})
