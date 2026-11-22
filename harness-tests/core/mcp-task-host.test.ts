import { expect, it, vi } from 'vitest'
import { createMcpTaskHost } from '../../src/chat/server/mcp-task-host'
import { kodyDiscovery } from '../../src/chat/server/discovery-integrations/kody'
import type { CatalogEntry } from '../../src/chat/server/mcp-catalog'
const entry: CatalogEntry = {
  id: 'entry',
  name: 'read',
  title: 'Read',
  description: 'Read',
  kind: 'tool',
  serverId: 'one',
  serverLabel: 'One',
  target: { method: 'tools/call', name: 'read' },
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
    additionalProperties: false,
  },
}
const signal = new AbortController().signal
function setup() {
  const call = vi.fn<Parameters<typeof createMcpTaskHost>[0]['call']>(
    async () => ({
      content: [],
      structuredContent: { value: 1 },
    }),
  )
  const authorize = vi.fn<Parameters<typeof createMcpTaskHost>[0]['authorize']>(
    async () => ({
      allowed: true,
      effect: 'read' as const,
    }),
  )
  const host = createMcpTaskHost({
    connections: [
      {
        id: 'one',
        label: 'One',
        url: 'https://example.test/mcp',
        trustedForDiscovery: true,
        discoveryIntegration: 'kody',
      },
      { id: 'two', label: 'Two', url: 'https://example.test/other' },
    ],
    integrationFor: () => kodyDiscovery,
    call,
    authorize,
  })
  return { host, call, authorize }
}
it('executes standard MCP tools only after an exact single-use host grant', async () => {
  const { host, call } = setup()
  await expect(host.invoke(entry, { id: 'A' }, signal)).rejects.toThrow('grant')
  await host.authorize(entry, { id: 'A' }, signal)
  expect(await host.invoke(entry, { id: 'A' }, signal)).toMatchObject({
    ok: true,
  })
  expect(call).toHaveBeenCalledOnce()
  await expect(host.invoke(entry, { id: 'A' }, signal)).rejects.toThrow('grant')
  await host.authorize(entry, { id: 'A' }, signal)
  await expect(host.invoke(entry, { id: 'B' }, signal)).rejects.toThrow('grant')
  await host.authorize(entry, { id: 'A' }, signal)
  await expect(
    host.invoke({ ...entry, serverId: 'two' }, { id: 'A' }, signal),
  ).rejects.toThrow('grant')
  expect(call).toHaveBeenCalledOnce()
})
it('uses explicitly paired package contracts and exposes actual transport to policy', async () => {
  const { host, authorize, call } = setup()
  const capability: CatalogEntry = {
    ...entry,
    inputSchema: undefined,
    kind: 'capability',
    target: { method: 'tools/call', name: 'execute' },
    discovered: {
      sourceId: 'execute',
      sourceArguments: {},
      verified: false,
      invocation: '',
      evidence: JSON.stringify({
        importSpecifier: 'kody:@example/read',
        exportName: 'default',
        typeDefinition: 'export default function read(id: string): string',
      }),
    },
  }
  const resolved = await host.resolve!(capability, signal)
  expect(resolved.status).toBe('ready')
  if (resolved.status !== 'ready') throw new Error('Resolution failed')
  expect(call).not.toHaveBeenCalled()
  await host.authorize(resolved.entry, { id: 'A' }, signal)
  expect(authorize.mock.calls[0][2]).toMatchObject({
    name: 'execute',
    arguments: { params: { arguments: { id: 'A' } } },
  })
  await host.invoke(resolved.entry, { id: 'A' }, signal)
  expect(call.mock.calls[0][1]).toBe('execute')
})
it('keeps unsupported argument contracts explicit', async () => {
  const { host, call } = setup()
  const capability: CatalogEntry = {
    ...entry,
    inputSchema: undefined,
    kind: 'capability',
    target: { method: 'tools/call', name: 'execute' },
    discovered: {
      sourceId: 'execute',
      sourceArguments: {},
      verified: false,
      invocation: '',
      evidence: JSON.stringify({
        importSpecifier: 'kody:@example/read',
        exportName: 'default',
        typeDefinition:
          'export default function read(params: Record<string, unknown>)',
      }),
    },
  }
  expect(await host.resolve!(capability, signal)).toMatchObject({
    status: 'unsupported',
  })
  expect(call).not.toHaveBeenCalled()
})
