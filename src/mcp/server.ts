import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { listLibraries, listLibrariesSchema } from './tools/list-libraries'
import { getDoc, getDocSchema } from './tools/get-doc'
import { searchDocs, searchDocsSchema } from './tools/search-docs'

export function createMcpServer() {
  const server = new McpServer({
    name: 'tanstack',
    version: '1.0.0',
  })

  // Register list_libraries tool
  server.tool(
    'list_libraries',
    'List all TanStack libraries with metadata. Returns library IDs, names, descriptions, supported frameworks, and documentation URLs.',
    listLibrariesSchema.shape,
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
  )

  // Register get_doc tool
  server.tool(
    'get_doc',
    'Fetch a specific TanStack documentation page. Returns the full markdown content.',
    getDocSchema.shape,
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
  )

  // Register search_docs tool
  server.tool(
    'search_docs',
    'Search TanStack documentation. Returns matching pages with titles, URLs, and content snippets.',
    searchDocsSchema.shape,
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
  )

  return server
}
