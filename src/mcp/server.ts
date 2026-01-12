import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { captureEvent } from '~/utils/posthog.server'
import { withSentrySpan, captureException } from '~/utils/sentry.server'
import { listLibraries, listLibrariesSchema } from './tools/list-libraries'
import { getDoc, getDocSchema } from './tools/get-doc'
import { searchDocs, searchDocsSchema } from './tools/search-docs'
import {
  searchShowcases,
  searchShowcasesSchema,
} from './tools/search-showcases'
import { getShowcase, getShowcaseSchema } from './tools/get-showcase'
import { submitShowcase, submitShowcaseSchema } from './tools/submit-showcase'
import { updateShowcase, updateShowcaseSchema } from './tools/update-showcase'
import { deleteShowcase, deleteShowcaseSchema } from './tools/delete-showcase'
import {
  listMyShowcases,
  listMyShowcasesSchema,
} from './tools/list-my-showcases'
import { getNpmStats, getNpmStatsSchema } from './tools/get-npm-stats'
import {
  listNpmComparisons,
  listNpmComparisonsSchema,
} from './tools/list-npm-comparisons'
import {
  compareNpmPackages,
  compareNpmPackagesSchema,
} from './tools/compare-npm-packages'
import {
  getNpmPackageDownloads,
  getNpmPackageDownloadsSchema,
} from './tools/get-npm-package-downloads'
import {
  getEcosystemRecommendations,
  getEcosystemRecommendationsSchema,
} from './tools/get-ecosystem-recommendations'

export type McpAuthContext = {
  userId: string
  keyId: string
}

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

type ToolHandler<TArgs> = (args: TArgs) => Promise<ToolResult>

/**
 * Wrap a tool handler with analytics tracking
 * - Sentry: performance tracing (spans) + error capture
 * - PostHog: usage analytics (event counts, trends)
 */
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
      const responseTimeMs = Math.round(performance.now() - startTime)

      captureEvent(authContext?.userId ?? 'anonymous', 'mcp_tool_called', {
        tool: toolName,
        success,
        response_time_ms: responseTimeMs,
        has_error: caughtError !== null,
        error_type: caughtError?.name,
        error_message: caughtError?.message,
        key_id: authContext?.keyId,
        environment: process.env.NODE_ENV ?? 'development',
      })
    }
  }
}

export function createMcpServer(authContext?: McpAuthContext) {
  const server = new McpServer({
    name: 'tanstack',
    version: '1.0.0',
  })

  // Register list_libraries tool
  server.tool(
    'list_libraries',
    'List all TanStack libraries with metadata. Returns library IDs, names, descriptions, supported frameworks, and documentation URLs.',
    listLibrariesSchema.shape,
    withAnalytics(
      'list_libraries',
      async (args) => {
        const parsed = listLibrariesSchema.parse(args)
        const result = await listLibraries(parsed)
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      },
      authContext,
    ),
  )

  // Register get_doc tool
  server.tool(
    'get_doc',
    'Fetch a specific TanStack documentation page. Returns the full markdown content.',
    getDocSchema.shape,
    withAnalytics(
      'get_doc',
      async (args) => {
        try {
          const parsed = getDocSchema.parse(args)
          const result = await getDoc(parsed)
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    title: result.title,
                    url: result.url,
                    library: result.library,
                    version: result.version,
                  },
                  null,
                  2,
                ),
              },
              {
                type: 'text' as const,
                text: `\n---\n\n${result.content}`,
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          }
        }
      },
      authContext,
    ),
  )

  // Register search_docs tool
  server.tool(
    'search_docs',
    'Search TanStack documentation. Returns matching pages with titles, URLs, and content snippets.',
    searchDocsSchema.shape,
    withAnalytics(
      'search_docs',
      async (args) => {
        const parsed = searchDocsSchema.parse(args)
        const result = await searchDocs(parsed)
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      },
      authContext,
    ),
  )

  // ============================================================================
  // Showcase Tools
  // ============================================================================

  // Register search_showcases tool (public, no auth required)
  server.tool(
    'search_showcases',
    'Search approved TanStack showcase projects. Filter by libraries, use cases, or text search. Returns project details with links.',
    searchShowcasesSchema.shape,
    withAnalytics(
      'search_showcases',
      async (args) => {
        try {
          const parsed = searchShowcasesSchema.parse(args)
          const result = await searchShowcases(parsed)
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          }
        }
      },
      authContext,
    ),
  )

  // Register get_showcase tool (public, no auth required for approved showcases)
  server.tool(
    'get_showcase',
    'Get details of a specific showcase project by ID. Returns full project information.',
    getShowcaseSchema.shape,
    withAnalytics(
      'get_showcase',
      async (args) => {
        try {
          const parsed = getShowcaseSchema.parse(args)
          const result = await getShowcase(parsed, authContext)
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          }
        }
      },
      authContext,
    ),
  )

  // Register submit_showcase tool (requires auth)
  server.tool(
    'submit_showcase',
    'Submit a new project to the TanStack showcase. Requires authentication. Submissions are reviewed by moderators before appearing publicly.',
    submitShowcaseSchema.shape,
    withAnalytics(
      'submit_showcase',
      async (args) => {
        try {
          const parsed = submitShowcaseSchema.parse(args)
          const result = await submitShowcase(parsed, authContext)
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          }
        }
      },
      authContext,
    ),
  )

  // Register update_showcase tool (requires auth + ownership)
  server.tool(
    'update_showcase',
    'Update an existing showcase submission. Requires authentication and ownership. Updates reset the showcase to pending review.',
    updateShowcaseSchema.shape,
    withAnalytics(
      'update_showcase',
      async (args) => {
        try {
          const parsed = updateShowcaseSchema.parse(args)
          const result = await updateShowcase(parsed, authContext)
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          }
        }
      },
      authContext,
    ),
  )

  // Register delete_showcase tool (requires auth + ownership)
  server.tool(
    'delete_showcase',
    'Delete a showcase submission. Requires authentication and ownership.',
    deleteShowcaseSchema.shape,
    withAnalytics(
      'delete_showcase',
      async (args) => {
        try {
          const parsed = deleteShowcaseSchema.parse(args)
          const result = await deleteShowcase(parsed, authContext)
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          }
        }
      },
      authContext,
    ),
  )

  // Register list_my_showcases tool (requires auth)
  server.tool(
    'list_my_showcases',
    'List your own showcase submissions. Requires authentication. Shows all your submissions including pending and denied ones.',
    listMyShowcasesSchema.shape,
    withAnalytics(
      'list_my_showcases',
      async (args) => {
        try {
          const parsed = listMyShowcasesSchema.parse(args)
          const result = await listMyShowcases(parsed, authContext)
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          }
        }
      },
      authContext,
    ),
  )

  // ============================================================================
  // NPM Stats Tools
  // ============================================================================

  // Register get_npm_stats tool
  server.tool(
    'get_npm_stats',
    'Get aggregated NPM download statistics for TanStack org or a specific library. Returns total downloads, growth rate, and package breakdown.',
    getNpmStatsSchema.shape,
    withAnalytics(
      'get_npm_stats',
      async (args) => {
        try {
          const parsed = getNpmStatsSchema.parse(args)
          const result = await getNpmStats(parsed)
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          }
        }
      },
      authContext,
    ),
  )

  // Register list_npm_comparisons tool
  server.tool(
    'list_npm_comparisons',
    'List available preset package comparisons (Data Fetching, State Management, Routing, etc.). Use with compare_npm_packages for quick comparisons.',
    listNpmComparisonsSchema.shape,
    withAnalytics(
      'list_npm_comparisons',
      async (args) => {
        try {
          const parsed = listNpmComparisonsSchema.parse(args)
          const result = await listNpmComparisons(parsed)
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          }
        }
      },
      authContext,
    ),
  )

  // Register compare_npm_packages tool
  server.tool(
    'compare_npm_packages',
    'Compare NPM download statistics for multiple packages over a time range. Returns daily/weekly/monthly download data for visualization and analysis.',
    compareNpmPackagesSchema.shape,
    withAnalytics(
      'compare_npm_packages',
      async (args) => {
        try {
          const parsed = compareNpmPackagesSchema.parse(args)
          const result = await compareNpmPackages(parsed)
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          }
        }
      },
      authContext,
    ),
  )

  // Register get_npm_package_downloads tool
  server.tool(
    'get_npm_package_downloads',
    'Get detailed historical download data for a single NPM package. Returns daily download counts for analysis.',
    getNpmPackageDownloadsSchema.shape,
    withAnalytics(
      'get_npm_package_downloads',
      async (args) => {
        try {
          const parsed = getNpmPackageDownloadsSchema.parse(args)
          const result = await getNpmPackageDownloads(parsed)
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          }
        }
      },
      authContext,
    ),
  )

  // ============================================================================
  // Ecosystem Tools
  // ============================================================================

  // Register get_ecosystem_recommendations tool
  server.tool(
    'get_ecosystem_recommendations',
    'Get ecosystem integration recommendations (Neon, Clerk, Convex, AG Grid, Netlify, Cloudflare, Sentry, Prisma, Strapi, etc.). Filter by category (database, auth, deployment, monitoring, cms, api, data-grid) or by TanStack library. Supports aliases like postgres→database, login→auth, serverless→deployment. USE THIS TOOL when users ask about: where to host/deploy, which database to use, authentication solutions, error monitoring, CMS options, or any infrastructure/tooling recommendations for TanStack apps.',
    getEcosystemRecommendationsSchema.shape,
    withAnalytics(
      'get_ecosystem_recommendations',
      async (args) => {
        try {
          const parsed = getEcosystemRecommendationsSchema.parse(args)
          const result = await getEcosystemRecommendations(parsed)
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          }
        }
      },
      authContext,
    ),
  )

  return server
}
