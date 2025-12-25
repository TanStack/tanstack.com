import {
  extractFrontMatter,
  fetchApiContents,
  fetchRepoFile,
} from '~/utils/documents.server'
import removeMarkdown from 'remove-markdown'
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { setResponseHeader } from '@tanstack/react-start/server'

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
    z.object({ repo: z.string(), branch: z.string(), filePath: z.string() }),
  )
  .handler(async ({ data: { repo, branch, filePath } }) => {
    const file = await fetchRepoFile(repo, branch, filePath)

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
    z.object({ repo: z.string(), branch: z.string(), filePath: z.string() }),
  )
  .handler(async ({ data: { repo, branch, filePath } }) => {
    const file = await fetchRepoFile(repo, branch, filePath)

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
    z.object({
      repo: z.string(),
      branch: z.string(),
      startingPath: z.string(),
    }),
  )
  .handler(async ({ data: { repo, branch, startingPath } }) => {
    const githubContents = await fetchApiContents(repo, branch, startingPath)

    // Cache for 60 minutes on shared cache
    // Revalidate in the background
    setResponseHeader('Cache-Control', 'public, max-age=0, must-revalidate')
    setResponseHeader(
      'CDN-Cache-Control',
      'max-age=3600, stale-while-revalidate=3600, durable',
    )

    return githubContents
  })
