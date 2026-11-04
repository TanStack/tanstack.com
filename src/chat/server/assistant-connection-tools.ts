import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'
import type { McpAccountSummary } from '../core/mcp-accounts'
import type { McpSetupSummary } from '../core/mcp-setup'
import type { PendingTask } from '../core/tasks'

const prepareInput = z
  .object({
    target: z
      .enum(['kody', 'remote'])
      .describe(
        'Use kody for the built-in Kody MCP integration. Use remote for any other Streamable HTTP MCP server.',
      ),
    label: z.string().trim().min(1).max(80).optional(),
    url: z.string().trim().min(1).max(500).optional(),
    accountId: z.string().uuid().optional(),
  })
  .strict()

export function assistantConnectionTools(options: {
  workspaceId: string
  botId: string
  turnId: string
  request: string
  allowKody: boolean
  allowMcp: boolean
  listKody(): Promise<boolean>
  listRemote(): Promise<McpAccountSummary[]>
  prepareRemote(input: {
    id: string
    label?: string
    url?: string
    accountId?: string
    expectedRevision?: number
    returnBotId: string
  }): Promise<McpSetupSummary>
  pause(task: PendingTask): Promise<void>
}) {
  const base = `/w/${encodeURIComponent(options.workspaceId)}/b/${encodeURIComponent(options.botId)}`
  return [
    toolDefinition({
      name: 'list_mcp_connections',
      description:
        'List the built-in Kody connection and saved remote MCP connections with their current setup state. This lists connection metadata, not credentials or tools. Use before adding or reconnecting a service.',
      inputSchema: z.object({}).strict(),
    }).server(async () => ({
      kody: {
        allowed: options.allowKody,
        connected: options.allowKody ? await options.listKody() : false,
      },
      remote: {
        allowed: options.allowMcp,
        connections: options.allowMcp ? await options.listRemote() : [],
      },
    })),
    toolDefinition({
      name: 'prepare_mcp_connection',
      description:
        'Start user-reviewed setup for the built-in Kody MCP integration or a remote Streamable HTTP MCP server. For Kody, no URL is needed. For another server, provide its documented exact endpoint URL and a label, or an accountId from list_mcp_connections to reconnect it. This does not grant access, save credentials, or complete sign-in. Never ask for a token in chat.',
      inputSchema: prepareInput,
    }).server(async (raw) => {
      const input = prepareInput.parse(raw)
      let pending: PendingTask
      if (input.target === 'kody') {
        if (input.label || input.url || input.accountId)
          throw new Error(
            'Kody uses its built-in connection. Omit label, URL and accountId.',
          )
        if (!options.allowKody)
          return {
            status: 'unavailable',
            reason: 'Kody is disabled by workspace policy.',
          }
        if (await options.listKody())
          return { status: 'connected', service: 'Kody' }
        pending = {
          id: crypto.randomUUID(),
          kind: 'external-step',
          turnId: options.turnId,
          request: options.request,
          title: 'Connect Kody',
          instructions:
            'Open settings and sign in to Kody, then continue here.',
          url: base + '?settings=general',
          evidenceRef: 'gum:kody-connection',
          connection: { kind: 'kody' },
        }
      } else {
        if (!options.allowMcp)
          return {
            status: 'unavailable',
            reason:
              'Additional MCP connections are disabled by workspace policy.',
          }
        if (input.accountId && (input.label || input.url))
          throw new Error(
            'To reconnect, provide only an accountId from list_mcp_connections.',
          )
        if (!input.accountId && (!input.label || !input.url))
          throw new Error(
            'Provide a service label and its exact Streamable HTTP MCP endpoint URL.',
          )
        const account = input.accountId
          ? (await options.listRemote()).find(
              (item) => item.id === input.accountId,
            )
          : undefined
        if (input.accountId && !account)
          throw new Error(
            'That connection is not available. List connections again.',
          )
        const setup = await options.prepareRemote({
          id: crypto.randomUUID(),
          ...(account
            ? { accountId: account.id, expectedRevision: account.revision }
            : { label: input.label, url: input.url }),
          returnBotId: options.botId,
        })
        const setupUrl =
          base + '?settings=mcp&connectionSetup=' + encodeURIComponent(setup.id)
        if (setup.kind === 'unsupported')
          return {
            status: 'manual_setup_required',
            service: setup.label,
            reason:
              setup.error ?? 'Automatic setup is unavailable for this service.',
            url: setupUrl,
          }
        pending = {
          id: crypto.randomUUID(),
          kind: 'external-step',
          turnId: options.turnId,
          request: options.request,
          title: `Connect ${setup.label}`,
          instructions:
            'Review this connection and finish setup, then continue here.',
          url: setupUrl,
          evidenceRef: 'gum:mcp-connection',
          connection: {
            kind: 'mcp',
            setupId: setup.id,
            accountId: setup.accountId,
          },
        }
      }
      await options.pause(pending)
      return {
        status: 'awaiting_user_step',
        taskId: pending.id,
        title: pending.title,
        url: pending.url,
      }
    }),
  ]
}
