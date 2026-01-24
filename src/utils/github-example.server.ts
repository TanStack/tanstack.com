/**
 * GitHub Example Fetching Utilities
 *
 * Functions for fetching example files from GitHub repositories.
 */

import { env } from './env'

export interface FetchExampleFilesResult {
  success: true
  files: Record<string, string>
}

export interface FetchExampleFilesError {
  success: false
  error: string
}

/**
 * Fetch all files from a GitHub example directory
 *
 * Uses the Contents API to get the directory structure,
 * then fetches each file's content via raw.githubusercontent.com.
 */
export async function fetchExampleFiles(
  repo: string,
  branch: string,
  examplePath: string,
): Promise<FetchExampleFilesResult | FetchExampleFilesError> {
  const token = env.GITHUB_AUTH_TOKEN

  const headers: Record<string, string> = {
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${token}`,
  }

  const files: Record<string, string> = {}

  async function fetchDirectory(dirPath: string): Promise<boolean> {
    const url = `https://api.github.com/repos/${repo}/contents/${dirPath}?ref=${branch}`
    const response = await fetch(url, { headers })

    if (!response.ok) {
      if (response.status === 404) {
        console.error(`[fetchExampleFiles] Directory not found: ${dirPath}`)
        return false
      }
      const errorBody = await response.text().catch(() => 'no body')
      console.error('[fetchExampleFiles] Contents fetch failed:', {
        url,
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
      })
      return false
    }

    const contents = (await response.json()) as Array<{
      name: string
      path: string
      type: 'file' | 'dir'
      download_url: string | null
    }>

    // Process files and directories
    for (const item of contents) {
      if (item.type === 'dir') {
        if (shouldExcludeFile(item.name)) continue
        await fetchDirectory(item.path)
      } else if (item.type === 'file' && item.download_url) {
        const fileResponse = await fetch(item.download_url)
        if (fileResponse.ok) {
          const content = await fileResponse.text()
          const relativePath = item.path.slice(examplePath.length + 1)
          files[relativePath] = content
        }
      }
    }

    return true
  }

  console.log('[fetchExampleFiles] Fetching:', { repo, branch, examplePath })

  const success = await fetchDirectory(examplePath)

  if (!success) {
    return {
      success: false,
      error: `Failed to fetch example directory: ${examplePath}`,
    }
  }

  if (Object.keys(files).length === 0) {
    return {
      success: false,
      error: `No files found in example path: ${examplePath}`,
    }
  }

  console.log('[fetchExampleFiles] Fetched', Object.keys(files).length, 'files')

  return { success: true, files }
}

/**
 * Files/directories to exclude when copying examples
 */
const EXCLUDED_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  '.output',
  '.netlify',
  '.vercel',
  '.DS_Store',
  '.nitro',
  'test-results',
  'playwright-report',
]

/**
 * Check if a file should be excluded
 */
export function shouldExcludeFile(path: string): boolean {
  return EXCLUDED_PATTERNS.some(
    (pattern) => path === pattern || path.startsWith(`${pattern}/`),
  )
}

/**
 * Filter out excluded files from a files record
 */
export function filterExcludedFiles(
  files: Record<string, string>,
): Record<string, string> {
  const filtered: Record<string, string> = {}

  for (const [path, content] of Object.entries(files)) {
    if (!shouldExcludeFile(path)) {
      filtered[path] = content
    }
  }

  return filtered
}
