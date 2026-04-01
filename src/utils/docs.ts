import {
  extractFrontMatter,
  fetchApiContents,
  fetchRepoFile,
  isRecoverableGitHubContentError,
} from '~/utils/documents.server'
import removeMarkdown from 'remove-markdown'
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import * as v from 'valibot'
import { setResponseHeader } from '@tanstack/react-start/server'

const DOCS_UNAVAILABLE_TITLE = 'Content temporarily unavailable'

function buildUnavailableDoc(filePath: string) {
  return {
    title: DOCS_UNAVAILABLE_TITLE,
    description:
      'This page could not be refreshed from GitHub right now. Please try again shortly.',
    filePath,
    content: [
      '# Content temporarily unavailable',
      '',
      'This page could not be refreshed from GitHub right now.',
      'Please try again shortly.',
    ].join('\n'),
    frontmatter: {
      title: DOCS_UNAVAILABLE_TITLE,
      description:
        'This page could not be refreshed from GitHub right now. Please try again shortly.',
    },
  }
}

function buildUnavailableFile(filePath: string) {
  const lowerFilePath = filePath.toLowerCase()
  const isMarkdown = lowerFilePath.endsWith('.md')

  if (isMarkdown) {
    return [
      '# Content temporarily unavailable',
      '',
      'This file could not be refreshed from GitHub right now.',
      'Please try again shortly.',
    ].join('\n')
  }

  return [
    '// Content temporarily unavailable',
    `// ${filePath}`,
    '// This file could not be refreshed from GitHub right now.',
    '// Please try again shortly.',
  ].join('\n')
}

export const loadDocs = async ({
  repo,
  branch,
  docsPath,
}: {
  repo: string
  branch: string
  docsPath: string
}) => {
  if (!branch || !docsPath) {
    throw notFound({
      data: {
        message: 'No doc was found here!',
      },
    })
  }

  const filePath = `${docsPath}.md`

  return await fetchDocs({
    data: {
      repo,
      branch,
      filePath,
    },
  })
}

export const fetchDocs = createServerFn({ method: 'GET' })
  .inputValidator(
    v.object({ repo: v.string(), branch: v.string(), filePath: v.string() }),
  )
  .handler(async ({ data: { repo, branch, filePath } }) => {
    let file: string | null

    try {
      file = await fetchRepoFile(repo, branch, filePath)
    } catch (error) {
      if (isRecoverableGitHubContentError(error)) {
        console.warn('[fetchDocs] Falling back to unavailable placeholder:', {
          repo,
          branch,
          filePath,
          message: error instanceof Error ? error.message : String(error),
        })
        return buildUnavailableDoc(filePath)
      }

      throw error
    }

    if (!file) {
      throw notFound()
    }

    const frontMatter = extractFrontMatter(file)
    const description = removeMarkdown(frontMatter.excerpt ?? '')

    // Cache for 5 minutes on shared cache
    // Revalidate in the background
    setResponseHeader('Cache-Control', 'public, max-age=0, must-revalidate')
    setResponseHeader(
      'CDN-Cache-Control',
      'max-age=300, stale-while-revalidate=300, durable',
    )

    return {
      title: frontMatter.data?.title,
      description,
      filePath,
      content: frontMatter.content,
      frontmatter: frontMatter.data,
    }
  })

export const fetchFile = createServerFn({ method: 'GET' })
  .inputValidator(
    v.object({ repo: v.string(), branch: v.string(), filePath: v.string() }),
  )
  .handler(async ({ data: { repo, branch, filePath } }) => {
    let file: string | null

    try {
      file = await fetchRepoFile(repo, branch, filePath)
    } catch (error) {
      if (isRecoverableGitHubContentError(error)) {
        console.warn('[fetchFile] Falling back to unavailable placeholder:', {
          repo,
          branch,
          filePath,
          message: error instanceof Error ? error.message : String(error),
        })
        return buildUnavailableFile(filePath)
      }

      throw error
    }

    if (!file) {
      throw notFound()
    }

    // Cache for 60 minutes on shared cache
    // Revalidate in the background
    setResponseHeader('Cache-Control', 'public, max-age=0, must-revalidate')
    setResponseHeader(
      'CDN-Cache-Control',
      'max-age=3600, stale-while-revalidate=3600, durable',
    )

    return file
  })

export const fetchRepoDirectoryContents = createServerFn({
  method: 'GET',
})
  .inputValidator(
    v.object({
      repo: v.string(),
      branch: v.string(),
      startingPath: v.string(),
    }),
  )
  .handler(async ({ data: { repo, branch, startingPath } }) => {
    const githubContents = await fetchApiContents(repo, branch, startingPath)

    if (!githubContents) {
      throw notFound()
    }

    // Cache for 60 minutes on shared cache
    // Revalidate in the background
    setResponseHeader('Cache-Control', 'public, max-age=0, must-revalidate')
    setResponseHeader(
      'CDN-Cache-Control',
      'max-age=3600, stale-while-revalidate=3600, durable',
    )

    return githubContents
  })
