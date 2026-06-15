import { notFound } from '@tanstack/react-router'
import { setResponseHeader } from '@tanstack/react-start/server'
import {
  fetchRepoFile,
  isRecoverableGitHubContentError,
} from '~/utils/documents.server'

const temporarilyUnavailableMarkdown = `# Content temporarily unavailable

We are having trouble fetching this document from GitHub right now. Please try again in a minute.`

function buildUnavailableFile(filePath: string) {
  if (filePath.toLowerCase().endsWith('.md')) {
    return temporarilyUnavailableMarkdown
  }

  return 'Content temporarily unavailable. Please try again in a minute.'
}

async function readRepoFileOrFallback(
  repo: string,
  branch: string,
  filePath: string,
) {
  try {
    return await fetchRepoFile(repo, branch, filePath)
  } catch (error) {
    if (!isRecoverableGitHubContentError(error)) {
      throw error
    }

    return buildUnavailableFile(filePath)
  }
}

export async function readRequiredRepoFileOrFallback(
  repo: string,
  branch: string,
  filePath: string,
) {
  const file = await readRepoFileOrFallback(repo, branch, filePath)

  if (!file) {
    throw notFound()
  }

  return file
}

export function setDocsCacheHeaders(cdnCacheControl: string) {
  setResponseHeader('Cache-Control', 'public, max-age=0, must-revalidate')
  setResponseHeader('CDN-Cache-Control', cdnCacheControl)
}
