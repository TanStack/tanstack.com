import { z } from 'zod'
import { liteClient } from 'algoliasearch/lite'

const ALGOLIA_APP_ID = 'FQ0DQ6MA3C'
const ALGOLIA_API_KEY = '10c34d6a5c89f6048cf644d601e65172'
const ALGOLIA_INDEX = 'tanstack-test'

export const searchDocsSchema = z.object({
  query: z.string().describe('Search query'),
  library: z
    .string()
    .optional()
    .describe('Filter to specific library (e.g., query, router)'),
  framework: z
    .string()
    .optional()
    .describe('Filter to specific framework (e.g., react, vue, solid)'),
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .describe('Maximum number of results (default: 10, max: 50)'),
})

export type SearchDocsInput = z.infer<typeof searchDocsSchema>

interface AlgoliaHierarchy {
  lvl0?: string
  lvl1?: string
  lvl2?: string
  lvl3?: string
  lvl4?: string
  lvl5?: string
  lvl6?: string
}

interface AlgoliaHit {
  objectID: string
  url: string
  library?: string
  hierarchy: AlgoliaHierarchy
  content?: string
  _snippetResult?: {
    content?: {
      value?: string
    }
  }
}

export async function searchDocs(input: SearchDocsInput) {
  const { query, library, framework, limit = 10 } = input

  const client = liteClient(ALGOLIA_APP_ID, ALGOLIA_API_KEY)

  // Build filters
  // When library/framework specified, we filter to:
  // 1. Pages matching that library/framework
  // 2. Pages without that attribute (core docs, integrations, landing pages)
  //
  // Algolia doesn't support "NOT attr:*" well, so we build an exclusion list
  // of OTHER libraries/frameworks to filter out
  const ALL_LIBRARIES = [
    'config',
    'form',
    'optimistic',
    'pacer',
    'query',
    'ranger',
    'react-charts',
    'router',
    'start',
    'store',
    'table',
    'virtual',
    'db',
    'devtools',
  ]

  const ALL_FRAMEWORKS = ['react', 'vue', 'solid', 'svelte', 'angular']

  const filterParts: string[] = ['version:latest']

  if (library) {
    // Exclude other libraries, but allow pages with no library attribute
    const otherLibraries = ALL_LIBRARIES.filter((l) => l !== library)
    const exclusions = otherLibraries
      .map((l) => `NOT library:${l}`)
      .join(' AND ')
    if (exclusions) {
      filterParts.push(`(${exclusions})`)
    }
  }

  if (framework) {
    // Exclude other frameworks, but allow pages with no framework attribute
    const otherFrameworks = ALL_FRAMEWORKS.filter((f) => f !== framework)
    const exclusions = otherFrameworks
      .map((f) => `NOT framework:${f}`)
      .join(' AND ')
    if (exclusions) {
      filterParts.push(`(${exclusions})`)
    }
  }

  const response = await client.search<AlgoliaHit>({
    requests: [
      {
        indexName: ALGOLIA_INDEX,
        query,
        hitsPerPage: Math.min(limit, 50),
        filters: filterParts.join(' AND '),
        attributesToRetrieve: ['hierarchy', 'url', 'content', 'library'],
        attributesToSnippet: ['content:80'],
      },
    ],
  })

  const searchResult = response.results[0]
  if (!searchResult || !('hits' in searchResult)) {
    return { query, totalHits: 0, results: [] }
  }

  const formattedResults = searchResult.hits.map((hit) => {
    // Build breadcrumb from hierarchy
    const breadcrumb = Object.values(hit.hierarchy).filter((v): v is string =>
      Boolean(v),
    )

    return {
      title: hit.hierarchy?.lvl1 || hit.hierarchy?.lvl0 || 'Untitled',
      url: hit.url,
      snippet: hit._snippetResult?.content?.value || hit.content || '',
      library: hit.library || 'unknown',
      breadcrumb,
    }
  })

  return {
    query,
    totalHits:
      'nbHits' in searchResult ? searchResult.nbHits : formattedResults.length,
    results: formattedResults,
  }
}
