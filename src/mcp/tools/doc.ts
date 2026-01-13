import { z } from 'zod'
import { findLibrary, getBranch } from '~/libraries'
import { fetchRepoFile, extractFrontMatter } from '~/utils/documents.server'

export const docSchema = z.object({
  library: z.string().describe('Library ID (e.g., query, router, table, form)'),
  path: z
    .string()
    .describe('Documentation path (e.g., framework/react/overview)'),
  version: z
    .string()
    .optional()
    .describe('Version (e.g., v5, v1). Defaults to latest'),
})

export type DocInput = z.infer<typeof docSchema>

export async function doc(input: DocInput) {
  const { library: libraryId, path, version = 'latest' } = input

  const library = findLibrary(libraryId)
  if (!library) {
    throw new Error(
      `Library "${libraryId}" not found. Use list_libraries to see available libraries.`,
    )
  }

  if (version !== 'latest' && !library.availableVersions.includes(version)) {
    throw new Error(
      `Version "${version}" not found for ${library.name}. Available: ${library.availableVersions.join(', ')}`,
    )
  }

  const branch = getBranch(library, version)
  const filePath = `${library.docsRoot || 'docs'}/${path}.md`
  const file = await fetchRepoFile(library.repo, branch, filePath)

  if (!file) {
    throw new Error(
      `Document not found: ${library.name} / ${path} (version: ${version})`,
    )
  }

  const frontMatter = extractFrontMatter(file)

  return {
    title: frontMatter.data?.title || path.split('/').pop() || 'Untitled',
    content: frontMatter.content,
    url: `https://tanstack.com/${libraryId}/${version}/docs/${path}`,
    library: library.name,
    version: version === 'latest' ? library.latestVersion : version,
  }
}
