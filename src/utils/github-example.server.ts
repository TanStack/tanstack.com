/**
 * GitHub Example Fetching Utilities
 *
 * Functions for fetching example files from GitHub repositories.
 */

import {
  cancelUnusedResponseBody,
  fetchGitHubRecursiveTree,
  getGitHubContentFetchOptions,
  GitHubContentError,
  isGitHubAuthFailureStatus,
} from './documents.server'
import { getCachedGitHubTextFile } from './github-content-cache.server'
import {
  fetchWithTimeout,
  readResponseBytesWithLimit,
  readResponseTextWithLimit,
} from './outbound-fetch.server'
import { encodeExampleBinaryFile } from './example-workspace'

const RAW_FETCH_CONCURRENCY = 6
const MAX_EXAMPLE_FILES = 500
const MAX_EXAMPLE_FILE_BYTES = 1 * 1024 * 1024
const MAX_EXAMPLE_TOTAL_BYTES = 5 * 1024 * 1024
const EXAMPLE_FETCH_TIMEOUT_MS = 10_000

export interface FetchExampleFilesResult {
  success: true
  files: Record<string, string>
  binaryFiles?: Record<string, string>
}

export interface FetchExampleFilesError {
  success: false
  error: string
  reason: 'fetch-failed' | 'not-found' | 'too-large' | 'too-many-files'
}

export function isFetchExampleFilesResponse(
  value: unknown,
): value is FetchExampleFilesResult | FetchExampleFilesError {
  if (!isRecord(value)) return false

  if (value.success === true) {
    return (
      isStringRecord(value.files) &&
      (value.binaryFiles === undefined || isStringRecord(value.binaryFiles))
    )
  }

  return (
    value.success === false &&
    typeof value.error === 'string' &&
    (value.reason === 'fetch-failed' ||
      value.reason === 'not-found' ||
      value.reason === 'too-large' ||
      value.reason === 'too-many-files')
  )
}

export function ensureCacheableFetchExampleFilesResponse(
  result: FetchExampleFilesResult | FetchExampleFilesError,
) {
  if (!result.success && result.reason === 'fetch-failed') {
    throw new Error(result.error)
  }

  return result
}

/**
 * Fetch all files from a GitHub example directory.
 */
export async function fetchExampleFiles(
  repo: string,
  branch: string,
  examplePath: string,
  options: { preserveBinary?: boolean } = {},
): Promise<FetchExampleFilesResult | FetchExampleFilesError> {
  console.log('[fetchExampleFiles] Fetching:', { repo, branch, examplePath })

  const tree = await fetchGitHubRecursiveTree(repo, branch)

  if (!tree) {
    return {
      success: false,
      error: `Failed to fetch example directory: ${examplePath}`,
      reason: 'not-found',
    }
  }

  const normalizedExamplePath = examplePath.replace(/^\/+|\/+$/g, '')
  const fileEntries = tree.filter(
    (entry) =>
      entry.type === 'blob' &&
      entry.path.startsWith(`${normalizedExamplePath}/`) &&
      !shouldExcludeFile(entry.path.slice(normalizedExamplePath.length + 1)),
  )

  if (fileEntries.length > MAX_EXAMPLE_FILES) {
    return {
      success: false,
      error: `Example has too many files; maximum is ${MAX_EXAMPLE_FILES}`,
      reason: 'too-many-files',
    }
  }

  const knownTotalBytes = fileEntries.reduce(
    (total, entry) => total + (entry.size ?? 0),
    0,
  )

  if (knownTotalBytes > MAX_EXAMPLE_TOTAL_BYTES) {
    return {
      success: false,
      error: `Example is too large; maximum is ${MAX_EXAMPLE_TOTAL_BYTES} bytes`,
      reason: 'too-large',
    }
  }

  if (fileEntries.length === 0) {
    return {
      success: false,
      error: `No files found in example path: ${examplePath}`,
      reason: 'not-found',
    }
  }

  try {
    let totalBytes = 0
    const fetchedFiles = await mapWithConcurrency(
      fileEntries,
      RAW_FETCH_CONCURRENCY,
      async (entry) => {
        const relativePath = entry.path.slice(normalizedExamplePath.length + 1)
        const content = options.preserveBinary
          ? await fetchRawGitHubWorkspaceFile(repo, branch, entry.path)
          : await fetchRawGitHubFile(repo, branch, entry.path)

        if (content === null) {
          throw new Error(`Missing file content for ${entry.path}`)
        }

        totalBytes +=
          typeof content === 'string'
            ? new TextEncoder().encode(content).byteLength
            : content.bytes.byteLength
        if (totalBytes > MAX_EXAMPLE_TOTAL_BYTES) {
          throw new Error(
            `Example is too large; maximum is ${MAX_EXAMPLE_TOTAL_BYTES} bytes`,
          )
        }

        return { content, relativePath }
      },
    )
    const files: Record<string, string> = {}
    const binaryFiles: Record<string, string> = {}

    for (const file of fetchedFiles) {
      if (typeof file.content === 'string') {
        files[file.relativePath] = file.content
      } else {
        binaryFiles[file.relativePath] = encodeExampleBinaryFile(
          file.content.bytes,
        )
      }
    }

    console.log(
      '[fetchExampleFiles] Fetched',
      Object.keys(files).length + Object.keys(binaryFiles).length,
      'files',
    )

    return {
      success: true,
      files,
      ...(Object.keys(binaryFiles).length ? { binaryFiles } : {}),
    }
  } catch (error) {
    console.error('[fetchExampleFiles] Failed:', error)

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to fetch example files',
      reason: 'fetch-failed',
    }
  }
}

async function fetchRawGitHubFile(
  repo: string,
  branch: string,
  filePath: string,
) {
  return getCachedGitHubTextFile({
    repo,
    gitRef: branch,
    path: filePath,
    origin: async () => {
      const response = await fetchRawGitHubResponse(repo, branch, filePath)
      if (!response) return null
      return readResponseTextWithLimit(response, MAX_EXAMPLE_FILE_BYTES)
    },
  })
}

async function fetchRawGitHubWorkspaceFile(
  repo: string,
  branch: string,
  filePath: string,
) {
  const response = await fetchRawGitHubResponse(repo, branch, filePath)
  if (!response) return null

  const bytes = await readResponseBytesWithLimit(
    response,
    MAX_EXAMPLE_FILE_BYTES,
  )

  try {
    const text = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes)
    const encoded = new TextEncoder().encode(text)
    if (
      !text.includes('\0') &&
      encoded.byteLength === bytes.byteLength &&
      encoded.every((byte, index) => byte === bytes[index])
    ) {
      return text
    }
  } catch {
    // Files that are not lossless UTF-8 must remain byte-for-byte intact.
  }

  return { bytes }
}

async function fetchRawGitHubResponse(
  repo: string,
  branch: string,
  filePath: string,
) {
  const href = new URL(
    `${repo}/${branch}/${filePath}`,
    'https://raw.githubusercontent.com/',
  ).href

  let response: Response

  try {
    response = await fetchWithTimeout(href, {
      ...getGitHubContentFetchOptions({
        includeApiVersion: false,
        userAgent: `examples:${repo}`,
      }),
      timeoutMs: EXAMPLE_FETCH_TIMEOUT_MS,
    })

    if (isGitHubAuthFailureStatus(response.status)) {
      await cancelUnusedResponseBody(response)
      response = await fetchWithTimeout(href, {
        ...getGitHubContentFetchOptions({
          includeApiVersion: false,
          includeAuthorization: false,
          userAgent: `examples:${repo}`,
        }),
        timeoutMs: EXAMPLE_FETCH_TIMEOUT_MS,
      })
    }
  } catch (error) {
    throw new GitHubContentError(
      'network',
      `Failed to fetch ${repo}@${branch}:${filePath}`,
      { cause: error },
    )
  }

  if (response.ok) return response

  await cancelUnusedResponseBody(response)
  if (response.status === 404) return null

  throw new GitHubContentError(
    response.status === 403 || response.status === 429
      ? 'rate-limit'
      : response.status >= 500
        ? 'server'
        : 'forbidden',
    `GitHub failed to serve ${repo}@${branch}:${filePath}`,
    { status: response.status },
  )
}

async function mapWithConcurrency<T, TResult>(
  values: Array<T>,
  concurrency: number,
  fn: (value: T) => Promise<TResult>,
) {
  const results = new Array<TResult>(values.length)
  let index = 0

  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (index < values.length) {
        const currentIndex = index
        index += 1
        results[currentIndex] = await fn(values[currentIndex])
      }
    },
  )

  await Promise.all(workers)

  return results
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  )
}
