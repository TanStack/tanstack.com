import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { captureEvent } from '~/utils/posthog.server'
import { withSentrySpan, captureException } from '~/utils/sentry.server'
import { listLibraries, listLibrariesSchema } from './tools/list-libraries'
import { doc, docSchema } from './tools/doc'
import { searchDocs, searchDocsSchema } from './tools/search-docs'
import { npmStats, npmStatsSchema } from './tools/npm-stats'
import { ecosystem, ecosystemSchema } from './tools/ecosystem'
import { env } from '~/utils/env'

export type McpAuthContext = {
  userId: string
  keyId: string
}

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

type ToolHandler<TArgs> = (args: TArgs) => Promise<ToolResult>

function textResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }] }
}

function jsonResult(data: unknown): ToolResult {
  return textResult(JSON.stringify(data))
}

function errorResult(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : 'Unknown error'
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  }
}

function withAnalytics<TArgs>(
  toolName: string,
  handler: ToolHandler<TArgs>,
  authContext?: McpAuthContext,
): ToolHandler<TArgs> {
  return async (args: TArgs) => {
    const startTime = performance.now()
    let success = false
    let caughtError: Error | null = null

    try {
      const result = await withSentrySpan(`mcp.${toolName}`, 'mcp.tool', () =>
        handler(args),
      )
      success = !result.isError
      return result
    } catch (error) {
      caughtError = error instanceof Error ? error : new Error(String(error))
      captureException(caughtError, { toolName, userId: authContext?.userId })
      throw error
    } finally {
      captureEvent(authContext?.userId ?? 'anonymous', 'mcp_tool_called', {
        tool: toolName,
        success,
        response_time_ms: Math.round(performance.now() - startTime),
        has_error: caughtError !== null,
        error_type: caughtError?.name,
        error_message: caughtError?.message,
        key_id: authContext?.keyId,
        environment: process.env.NODE_ENV ?? 'development',
      })
    }
  }
}

export const ALL_TOOL_NAMES = [
  'list_libraries',
  'doc',
  'search_docs',
  'npm_stats',
  'ecosystem',
] as const

export type ToolName = (typeof ALL_TOOL_NAMES)[number]

function getEnabledTools(): Set<ToolName> | undefined {
  const envVar = env.TANSTACK_MCP_ENABLED_TOOLS
  if (!envVar) return undefined

  const validTools = new Set<ToolName>()
  const invalidTools: Array<string> = []

  for (const tool of envVar
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)) {
    if (ALL_TOOL_NAMES.includes(tool as ToolName)) {
      validTools.add(tool as ToolName)
    } else {
      invalidTools.push(tool)
    }
  }

  if (invalidTools.length > 0) {
    console.warn(
      `[MCP] Invalid tools: ${invalidTools.join(', ')}. Valid: ${ALL_TOOL_NAMES.join(', ')}`,
    )
  }

  return validTools
}

export function createMcpServer(authContext?: McpAuthContext) {
  const server = new McpServer({ name: 'tanstack', version: '1.0.0' })
  const enabledTools = getEnabledTools()

  const isEnabled = (name: ToolName) => !enabledTools || enabledTools.has(name)

  if (isEnabled('list_libraries')) {
    server.tool(
      'list_libraries',
      'List TanStack libraries with metadata, frameworks, and docs URLs.',
      listLibrariesSchema.shape,
      withAnalytics(
        'list_libraries',
        async (args) =>
          jsonResult(await listLibraries(listLibrariesSchema.parse(args))),
        authContext,
      ),
    )
  }

  if (isEnabled('doc')) {
    server.tool(
      'doc',
      'Fetch a TanStack documentation page by library and path.',
      docSchema.shape,
      withAnalytics(
        'doc',
        async (args) => {
          try {
            const result = await doc(docSchema.parse(args))
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    title: result.title,
                    url: result.url,
                    library: result.library,
                    version: result.version,
                  }),
                },
                { type: 'text', text: `\n---\n\n${result.content}` },
              ],
            }
          } catch (error) {
            return errorResult(error)
          }
        },
        authContext,
      ),
    )
  }

  if (isEnabled('search_docs')) {
    server.tool(
      'search_docs',
      'Search TanStack documentation. Returns matching pages with snippets.',
      searchDocsSchema.shape,
      withAnalytics(
        'search_docs',
        async (args) =>
          jsonResult(await searchDocs(searchDocsSchema.parse(args))),
        authContext,
      ),
    )
  }

  if (isEnabled('npm_stats')) {
    server.tool(
      'npm_stats',
      'NPM download statistics. Org summary (default), library breakdown, or package comparison.',
      npmStatsSchema.shape,
      withAnalytics(
        'npm_stats',
        async (args) => {
          try {
            return jsonResult(await npmStats(npmStatsSchema.parse(args)))
          } catch (error) {
            return errorResult(error)
          }
        },
        authContext,
      ),
    )
  }

  if (isEnabled('ecosystem')) {
    server.tool(
      'ecosystem',
      'Ecosystem partner recommendations. Filter by category (database, auth, deployment, monitoring, cms, api, data-grid) or library.',
      ecosystemSchema.shape,
      withAnalytics(
        'ecosystem',
        async (args) => {
          try {
            return jsonResult(await ecosystem(ecosystemSchema.parse(args)))
          } catch (error) {
            return errorResult(error)
          }
        },
        authContext,
      ),
    )
  }

  return server
}
