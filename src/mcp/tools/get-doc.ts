import { z } from 'zod'
import { findLibrary, getBranch } from '~/libraries'
import { fetchRepoFile, extractFrontMatter } from '~/utils/documents.server'

export const getDocSchema = z.object({
  library: z.string().describe('Library ID (e.g., query, router, table, form)'),
  path: z
    .string()
    .describe('Documentation path (e.g., framework/react/overview)'),
  version: z
    .string()
    .optional()
    .describe('Version (e.g., v5, v1). Defaults to latest'),
})

export type GetDocInput = z.infer<typeof getDocSchema>

export async function getDoc(input: GetDocInput) {
  const { library: libraryId, path, version = 'latest' } = input

  // Validate library exists
  const library = findLibrary(libraryId)
  if (!library) {
    throw new Error(
      `Library "${libraryId}" not found. Use list_libraries to see available libraries.`,
    )
  }

  // Validate version
  if (version !== 'latest' && !library.availableVersions.includes(version)) {
    throw new Error(
      `Version "${version}" not found for ${library.name}. Available versions: ${library.availableVersions.join(', ')}`,
    )
  }

  // Get branch for version
  const branch = getBranch(library, version)

  // Build file path
  const docsRoot = library.docsRoot || 'docs'
  const filePath = `${docsRoot}/${path}.md`

  // Fetch the document
  const file = await fetchRepoFile(library.repo, branch, filePath)

  if (!file) {
    throw new Error(
      `Document not found: ${library.name} / ${path} (version: ${version})`,
    )
  }

  // Extract frontmatter and content
  const frontMatter = extractFrontMatter(file)

  // Build canonical URL
  const canonicalUrl = `https://tanstack.com/${libraryId}/${version}/docs/${path}`

  return {
    title: frontMatter.data?.title || path.split('/').pop() || 'Untitled',
    content: frontMatter.content,
    url: canonicalUrl,
    library: library.name,
    version: version === 'latest' ? library.latestVersion : version,
  }
}
