/**
 * GitHub Example Fetching Utilities
 *
 * Functions for fetching example files from GitHub repositories.
 */

import { fetchCached } from './cache.server'
import { env } from './env'

export interface FetchExampleFilesResult {
  success: true
  files: Record<string, string>
}

export interface FetchExampleFilesError {
  success: false
  error: string
}

type GitHubBranchResponse = {
  commit?: {
    commit?: {
      tree?: {
        sha?: string
      }
    }
  }
}

type GitHubTreeEntry = {
  path: string
  mode: string
  type: 'blob' | 'tree' | 'commit'
  sha: string
  size?: number
  url: string
}

type GitHubTreeResponse = {
  tree?: Array<GitHubTreeEntry>
  truncated?: boolean
}

const EXAMPLE_GIT_TREE_CACHE_TTL_MS = 5 * 60 * 1000
const EXAMPLE_FETCH_CONCURRENCY = 8

function getGitHubHeaders() {
  return {
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${env.GITHUB_AUTH_TOKEN}`,
  }
}

async function fetchExampleGitTree(
  repo: string,
  branch: string,
): Promise<Array<GitHubTreeEntry>> {
  return fetchCached({
    key: `example-git-tree:${repo}:${branch}`,
    ttl: EXAMPLE_GIT_TREE_CACHE_TTL_MS,
    fn: async () => {
      const headers = getGitHubHeaders()

      const branchResponse = await fetch(
        `https://api.github.com/repos/${repo}/branches/${branch}`,
        { headers },
      )

      if (!branchResponse.ok) {
        throw new Error(
          `Failed to fetch branch metadata (${branchResponse.status})`,
        )
      }

      const branchData = (await branchResponse.json()) as GitHubBranchResponse
      const treeSha = branchData.commit?.commit?.tree?.sha

      if (!treeSha) {
        throw new Error(`Missing tree SHA for ${repo}/${branch}`)
      }

      const treeResponse = await fetch(
        `https://api.github.com/repos/${repo}/git/trees/${treeSha}?recursive=1`,
        { headers },
      )

      if (!treeResponse.ok) {
        throw new Error(`Failed to fetch git tree (${treeResponse.status})`)
      }

      const treeData = (await treeResponse.json()) as GitHubTreeResponse

      if (!Array.isArray(treeData.tree)) {
        throw new Error(`Invalid git tree response for ${repo}/${branch}`)
      }

      if (treeData.truncated) {
        console.warn('[fetchExampleFiles] Git tree response was truncated:', {
          repo,
          branch,
        })
      }

      return treeData.tree
    },
  })
}

async function fetchRawFile(
  repo: string,
  branch: string,
  filePath: string,
): Promise<string> {
  const href = new URL(
    `${repo}/${branch}/${filePath}`,
    'https://raw.githubusercontent.com/',
  ).href

  const response = await fetch(href, {
    headers: { 'User-Agent': `example-fetch:${repo}` },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${filePath} (${response.status})`)
  }

  return response.text()
}

async function mapWithConcurrency<T>(
  items: Array<T>,
  limit: number,
  fn: (item: T) => Promise<void>,
) {
  let index = 0

  async function worker() {
    while (index < items.length) {
      const currentIndex = index
      index += 1
      await fn(items[currentIndex]!)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  )
}

/**
 * Fetch all files from a GitHub example directory
 *
 * Uses the Git tree API to list the branch once, filters excluded paths before
 * download, then fetches only the required file contents from raw GitHub.
 */
export async function fetchExampleFiles(
  repo: string,
  branch: string,
  examplePath: string,
): Promise<FetchExampleFilesResult | FetchExampleFilesError> {
  console.log('[fetchExampleFiles] Fetching:', { repo, branch, examplePath })

  let tree: Array<GitHubTreeEntry>
  try {
    tree = await fetchExampleGitTree(repo, branch)
  } catch (error) {
    console.error('[fetchExampleFiles] Git tree fetch failed:', {
      repo,
      branch,
      examplePath,
      message: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: `Failed to fetch example directory: ${examplePath}`,
    }
  }

  const normalizedExamplePath = examplePath.replace(/^\/+|\/+$/g, '')
  const pathPrefix = `${normalizedExamplePath}/`

  const candidateFiles = tree
    .filter((entry) => entry.type === 'blob')
    .filter(
      (entry) =>
        entry.path === normalizedExamplePath ||
        entry.path.startsWith(pathPrefix),
    )
    .map((entry) => ({
      relativePath:
        entry.path === normalizedExamplePath
          ? (entry.path.split('/').at(-1) ?? entry.path)
          : entry.path.slice(pathPrefix.length),
      fullPath: entry.path,
    }))
    .filter((entry) => entry.relativePath.length > 0)
    .filter((entry) => !shouldExcludeFile(entry.relativePath))

  if (candidateFiles.length === 0) {
    return {
      success: false,
      error: `No files found in example path: ${examplePath}`,
    }
  }

  const files: Record<string, string> = {}

  try {
    await mapWithConcurrency(
      candidateFiles,
      EXAMPLE_FETCH_CONCURRENCY,
      async ({ fullPath, relativePath }) => {
        files[relativePath] = await fetchRawFile(repo, branch, fullPath)
      },
    )
  } catch (error) {
    console.error('[fetchExampleFiles] File content fetch failed:', {
      repo,
      branch,
      examplePath,
      message: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: `Failed to fetch example files: ${examplePath}`,
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
