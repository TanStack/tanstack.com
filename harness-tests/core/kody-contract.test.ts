import { expect, it } from 'vitest'
import {
  packageCallContract,
  builtinCallContract,
  kodyCallArguments,
  connectedToolCallContract,
  prepareKodyOperation,
} from '../../src/chat/server/discovery-integrations/kody-contract'
import type { CatalogEntry } from '../../src/chat/server/mcp-catalog'
const entry: CatalogEntry = {
  id: 'x',
  serverId: 'server',
  serverLabel: 'Server',
  kind: 'capability',
  name: 'read',
  title: 'Read',
  description: 'Read data',
  target: { method: 'tools/call', name: 'execute' },
  discovered: {
    sourceId: 'execute',
    sourceArguments: {},
    invocation: '',
    verified: false,
    evidence: JSON.stringify({
      importSpecifier: 'kody:@example/data/read',
      exportName: 'read',
      typeDefinition:
        'export declare function read(id: string, cursor?: string): Promise<string>',
    }),
  },
}
it('builds a schema-bound call without interpolating arguments into source', async () => {
  const contract = packageCallContract(entry)
  const injected = "'); throw new Error('injection'); //"
  const call = kodyCallArguments(contract, { id: injected })
  expect(call.code).not.toContain(injected)
  expect(call.params.arguments).toEqual({ id: injected })
  // Exercise the fixed adapter against an isolated module substitute.
  const body = call.code
    .replace(/^import .*\n/, '')
    .replace('export default async function main', 'async function main')
  const seen: unknown[][] = []
  const tools = {
    read: (...args: unknown[]) => {
      seen.push(args)
      return 'ok'
    },
  }
  expect(
    await new Function('tools', 'params', body + '\nreturn main(params)')(
      tools,
      call.params,
    ),
  ).toBe('ok')
  expect(seen).toEqual([[injected, undefined]])
  expect(() => kodyCallArguments(contract, {})).toThrow(
    'Invalid capability arguments',
  )
})
it('requires returned builtin identity to match the selected entry', () => {
  const raw = {
    structuredContent: {
      result: {
        kind: 'entity',
        type: 'capability',
        id: 'read',
        inputTypeDefinition: 'type Input = { id: string }',
      },
    },
  }
  expect(builtinCallContract(entry, raw).entry.inputSchema).toMatchObject({
    required: ['id'],
  })
  expect(() => builtinCallContract({ ...entry, name: 'other' }, raw)).toThrow(
    'identity mismatch',
  )
})
it('does not grant execution permissions from contracts or examples', () => {
  const contract = packageCallContract(entry)
  expect(contract.entry.annotations).toBeUndefined()
  expect(contract.entry.discovered?.verified).toBe(false)
  expect(contract.invocation.kind).toBe('package')
})

it('supports the runtime capability proxy without requiring enumerable own properties', async () => {
  const contract = builtinCallContract(entry, {
    structuredContent: {
      result: {
        kind: 'entity',
        type: 'capability',
        id: 'read',
        inputTypeDefinition: 'type Input = { id: string }',
      },
    },
  })
  const call = kodyCallArguments(contract, { id: 'A' })
  const runtime = new Proxy(
    {},
    {
      get: (_target, name) =>
        name === 'read' ? (args: unknown) => args : undefined,
    },
  )
  const body = call.code
    .replace(/^import .*\n/, '')
    .replace('export default async function main', 'async function main')
  expect(
    await new Function('kody', 'params', body + '\nreturn main(params)')(
      runtime,
      call.params,
    ),
  ).toEqual({ id: 'A' })
})

it('binds a connected tool to the inventoried server and inspected input contract', async () => {
  const mcpServer = {
    serverId: 'server-1',
    serverName: 'Home',
    kodyName: 'home',
    mcpToolName: 'get_status',
    toolName: 'get_status',
  }
  const connected: CatalogEntry = {
    ...entry,
    name: 'mcp:home:get_status',
    discovered: {
      ...entry.discovered!,
      evidence: JSON.stringify({
        name: 'mcp:home:get_status',
        source: 'mcp-server',
        mcpServer,
      }),
    },
  }
  const detail = {
    structuredContent: {
      result: {
        kind: 'entity',
        type: 'capability',
        source: 'mcp-server',
        id: 'mcp:home:get_status',
        inputTypeDefinition: 'type Input = { device: string }',
        mcpServer,
      },
    },
  }
  const contract = connectedToolCallContract(connected, detail)
  expect(contract.entry.inputSchema).toMatchObject({ required: ['device'] })
  expect(kodyCallArguments(contract, { device: 'lamp' }).params).toEqual({
    device: 'lamp',
  })
  expect(() => kodyCallArguments(contract, {})).toThrow(
    'Invalid capability arguments',
  )
  const jsonSchema = connectedToolCallContract(connected, {
    structuredContent: {
      result: {
        ...detail.structuredContent.result,
        inputTypeDefinition: 'type Input = unknown',
        inputSchema: {
          type: 'object',
          properties: { device: { type: 'string' } },
          required: ['device'],
          additionalProperties: false,
        },
      },
    },
  })
  expect(kodyCallArguments(jsonSchema, { device: 'lamp' }).params).toEqual({
    device: 'lamp',
  })
  const call = async () => detail
  const prepared = await prepareKodyOperation(connected, call)
  expect(prepared.toCall({ device: 'lamp' })).toMatchObject({ name: 'execute' })
  expect(() =>
    connectedToolCallContract(connected, {
      structuredContent: {
        result: {
          ...detail.structuredContent.result,
          mcpServer: { ...mcpServer, serverId: 'replacement' },
        },
      },
    }),
  ).toThrow('identity mismatch')
})
