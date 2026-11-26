import { Validator } from '@cfworker/json-schema'
import type { CatalogEntry } from './mcp-catalog'
import type { McpConnection } from './mcp'
import type { TaskDependencies } from './system-one-loop'
import type {
  DiscoveryIntegration,
  PreparedMcpOperation,
} from './discovery-integrations/contract'

/** Host policy receives the capability and actual transport call, never a model permission decision. */
export function createMcpTaskHost(options: {
  connections: McpConnection[]
  integrationFor(id: string | undefined): DiscoveryIntegration | undefined
  call(
    connection: McpConnection,
    name: string,
    args: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<unknown>
  authorize(
    entry: CatalogEntry,
    args: Record<string, unknown>,
    transport: { name: string; arguments: Record<string, unknown> },
    signal: AbortSignal,
  ): ReturnType<TaskDependencies['authorize']>
}): Pick<TaskDependencies, 'resolve' | 'authorize' | 'invoke'> {
  const prepared = new Map<string, PreparedMcpOperation>()
  const connectionFor = (entry: CatalogEntry) => {
    const connection = options.connections.find(
      (connection) => connection.id === entry.serverId,
    )
    if (!connection) throw new Error('Selected MCP connection is unavailable.')
    return connection
  }
  const transportFor = (entry: CatalogEntry, args: Record<string, unknown>) => {
    if (
      !entry.inputSchema ||
      !new Validator(entry.inputSchema).validate(args).valid
    )
      throw new Error('Invalid task arguments.')
    const operation = prepared.get(entry.id)
    if (operation) return operation.toCall(args)
    if (
      entry.kind !== 'tool' ||
      entry.target.method !== 'tools/call' ||
      entry.target.name !== entry.name
    )
      throw new Error('Capability has no prepared transport.')
    return { name: entry.name, arguments: args }
  }
  // A grant applies to one exact call only, and is consumed before network dispatch.
  const grants = new Map<
    string,
    {
      serverId: string
      transport: { name: string; arguments: Record<string, unknown> }
    }
  >()
  return {
    async resolve(entry, signal) {
      const connection = connectionFor(entry)
      const integration = options.integrationFor(
        connection.discoveryIntegration,
      )
      if (!connection.trustedForDiscovery || !integration?.prepare)
        return {
          status: 'unsupported',
          reason: 'No paired contract resolver is configured.',
        }
      try {
        const operation = await integration.prepare(entry, (name, args) =>
          options.call(connection, name, args, signal),
        )
        prepared.set(entry.id, operation)
        return { status: 'ready', entry: operation.entry }
      } catch (error) {
        signal.throwIfAborted()
        return {
          status: 'unsupported',
          reason:
            error instanceof Error
              ? error.message
              : 'Contract resolution failed.',
        }
      }
    },
    async authorize(entry, args, signal) {
      connectionFor(entry)
      const transport = transportFor(entry, args)
      const grant = await options.authorize(entry, args, transport, signal)
      if (typeof grant === 'boolean' ? grant : grant.allowed)
        grants.set(entry.id, {
          serverId: entry.serverId,
          transport: structuredClone(transport),
        })
      else grants.delete(entry.id)
      return grant
    },
    async invoke(entry, args, signal) {
      const transport = transportFor(entry, args)
      const grant = grants.get(entry.id)
      grants.delete(entry.id)
      if (
        !grant ||
        grant.serverId !== entry.serverId ||
        JSON.stringify(grant.transport) !== JSON.stringify(transport)
      )
        throw new Error('No matching execution grant.')
      signal.throwIfAborted()
      const raw = await options.call(
        connectionFor(entry),
        transport.name,
        transport.arguments,
        signal,
      )
      const failed =
        typeof raw === 'object' &&
        raw !== null &&
        'isError' in raw &&
        raw.isError === true
      return { ok: !failed, value: raw }
    },
  }
}
